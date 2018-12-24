/*
 * This file is part of the xPack distribution
 *   (http://xpack.github.io).
 * Copyright (c) 2017 Liviu Ionescu.
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom
 * the Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

'use strict'
/* eslint valid-jsdoc: "error" */
/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */

// ----------------------------------------------------------------------------

/**
 * Classes to manage the source tree.
 *
 * The source tree is a tree of folder nodes, with file nodes as leaves.
 * It maps 1:1 to the filesystem folders and files.
 * The root node corresponds to the package root or the test root;
 * all input paths are relative to it.
 *
 * Each node may have computed toolchain definitions:
 * .options.tools[].definedSymbols
 * .options.tools[].undefinedSymbols
 * .options.tools[].includeFiles
 * .options.tools[].includeFolders
 * .options.tools[].includeSystemFolders
 *
 * All the above are getters, that cache results.
 * Options are maps, accessed by tool names.
 *
 * The input definitions are CFToolchain definitions with:
 * options.tools[].symbols.*
 * options.tools[].includes.*
 * options.tools[].options.*
 *
 * The link between file types and tools is defined by `fileExtensions`.
 */

// ----------------------------------------------------------------------------

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

const DirCache = require('./dir-cache.js').DirCache
const Util = require('./util.js').Util
const CFToolchain = require('./cf-objects.js').CFToolchain
const CFCommon = require('./cf-objects.js').CFCommon
const CFArrays = require('./cf-objects.js').CFArrays
// const CFSymbols = require('./cf-objects.js').CFSymbols
const CFIncludes = require('./cf-objects.js').CFIncludes
const IgnorerCache = require('./ignorer-cache.js').IgnorerCache
const Tool = require('./toolchain.js').Tool
const Toolchain = require('./toolchain.js').Toolchain

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'readdir')

// ============================================================================

/**
 * @typedef {Object} DMToolchainOptions
 * @property {DMNode} node The associated node.
 * @property {Object} log The logger.
 * @property {Object} tools A map of NodeToolOptions.
 * @property {Toolchain} toolchain The toolchain definition.
 */

class DMToolchainOptions {
  /**
   * @summary Create the storage for the toolchain options.
   * @param {Object} args The arguments.
   * @param {DMNode} args.node The associated node.
   * @param {Object} args.log The logger.
   * @param {Object} args.toolchain The toolchain definition.
   * @param {String} args.toolName The optional tool name (for FileNodes)
   * @param {CFToolchain} args.toolchainOptions Optional initial values.
   */
  constructor (args) {
    assert(args, 'There must be args.')
    assert(args.node instanceof DMNode, 'There must be a DMNode.')
    this.node = args.node

    assert(args.log, 'There must be a context.log.')
    this.log = args.log

    assert(args.toolchain instanceof Toolchain)
    this.toolchain = args.toolchain

    this.tools = {}

    if (args.toolchainOptions) {
      this.copyFrom(args.toolchainOptions)
    } else if (this.node instanceof DMFile) {
      assert(args.tool instanceof Tool)
      this.tool = args.tool
      // Initialise a single empty tool.
      this.tools[this.tool.name] =
          new DMToolOptions({
          node: this.node,
          log: this.log,
          tool: this.tool
        })
    } else if (this.node instanceof DMFolder) {
      // Initialise all tools as empty.
      for (const toolName of
        Object.keys(this.toolchain.tools)) {
        this.tools[toolName] =
          new DMToolOptions({
            node: this.node,
            log: this.log,
            tool: this.toolchain.tools[toolName]
          })
      }
    }
  }

  clear () {
    for (const toolName of Object.keys(this.tools)) {
      this.tools[toolName].clear()
    }
  }

  copyFrom (from) {
    assert(from instanceof CFToolchain)

    if (this.node instanceof DMFile) {
      this.tools[this.toolName] = new DMToolOptions({
        node: this.node,
        log: this.log,
        tool: this.tool,
        toolchainOptions: from
      })
    } else if (this.node instanceof DMFolder) {
      for (const [toolName, toolOptions] of Object.entries(from.tools)) {
        this.tools[toolName] = new DMToolOptions({
          node: this.node,
          log: this.log,
          tool: toolOptions.tool,
          toolchainOptions: from
        })
      }
    }
  }

  appendFrom (from, fromPath) {
    assert(from instanceof CFToolchain)

    // For FileNodes there is a single tool, no need to test again the toolName.
    for (const [toolName, tool] of Object.entries(this.tools)) {
      tool.appendFrom(from.common, fromPath)
      tool.appendFrom(from.tools[toolName], fromPath)
    }
  }
}

// ============================================================================

/**
 * @typedef {Object} DMToolOptions
 * @property {DMNode} node
 * @property {Object} log
 * @property {Tool} tool
 *
 * @description
 * The actual options are stored in arrays like addSuffix[], removeSuffix[].
 *
 * This object collects symbols, includes and toolchain options under the
 * same hat, to make access uniform.
 */

class DMToolOptions {
  constructor (args) {
    assert(args, 'There must be args.')
    assert(args.node instanceof DMNode, 'There must be a DMNode.')
    this.node = args.node

    assert(args.log, 'There must be an args.log.')
    this.log = args.log

    assert(args.tool instanceof Tool, 'There must be a Tool.')
    this.tool = args.tool

    this.cache_ = {}

    // Beware that parent options may change, so caching a reference to the
    // parent options is a bad idea. Thus the getter, to be always up to date.

    this.copyFrom(args.toolchainOptions)
  }

  clear () {
    this.cache_ = {}

    const keys = Object.keys(this)
    for (const key of keys) {
      if (Util.isArray(this[key]) &&
        (key.startsWith('add') || key.startsWith('remove'))) {
        delete this[key]
      }
    }
  }

  get parent () {
    // Warning! This is an extra dependency!
    // To minimise damage, keep it in one place.
    return this.node.parent.options.tools[this.tool.name]
  }

  copyFrom (from) {
    if (from instanceof CFToolchain) {
      this.copyFrom(from.toolchainOptions.common)
      this.appendFrom(from.toolchainOptions.tools[this.tool.name])
    } else if (from instanceof CFCommon) {
      this.copyFrom(from.symbols)
      this.copyFrom(from.includes)
      this.copyFrom(from.options)
    } else if (from instanceof CFArrays) {
      for (const suffix of from.suffixes) {
        for (const prefix of ['add', 'remove']) {
          const property = prefix + suffix
          if (from[property] &&
            from[property].length !== 0) {
            // Create e local copy of the array.
            this[property] = [...from[property]]
          } else {
            this[property] = []
          }
        }
      }
    }
  }

  appendFrom (from, fromPath) {
    if (from instanceof CFToolchain) {
      this.appendFrom(from.toolchainOptions.common, fromPath)
      this.appendFrom(from.toolchainOptions.tools[this.tool.name], fromPath)
    } else if (from instanceof CFCommon) {
      this.appendFrom(from.symbols)
      this.appendFrom(from.includes, fromPath)
      this.appendFrom(from.options)
    } else if (from instanceof CFArrays) {
      for (const suffix of from.suffixes) {
        for (const prefix of ['add', 'remove']) {
          const property = prefix + suffix
          let arr = from[property]
          if (arr && arr.length !== 0) {
            if (fromPath && from instanceof CFIncludes) {
              arr = Util.toPosixRelativePath(fromPath, arr)
            }
            if (this[property] && this[property].length !== 0) {
              this[property] =
                [...this[property], ...arr]
            } else {
              // Create e local copy of the array.
              this[property] = [...arr]
            }
          }
        }
      }
    }
  }

  /**
   * @summary Compose an add/remove property array using parent and
   * local values.
   *
   * @param {*} name Property name.
   * @returns {String[]} Array of string properties.
   *
   * @description
   * It keeps a local cache.
   * It always creates a new array, it does not reuse parent defs.
   */
  propertyWithParent_ (name) {
    const cachedName = `${name}WithParent_`

    if (!this.cache_[cachedName]) {
      // Start a new empty array.
      this.cache_[cachedName] = []

      if (this.node.parent) {
        // Inherit from parent array, if not empty.
        const parentArray = this.parent.propertyWithParent_(name)
        if (parentArray.length !== 0) {
          this.cache_[cachedName] = [...this.cache_[cachedName], ...parentArray]
        }
      }
      if (this[name] && this[name].length !== 0) {
        // Contribute the current definitions.
        this.cache_[cachedName] = [...this.cache_[cachedName], ...this[name]]
      }
    }
    return this.cache_[cachedName]
  }

  /**
   * @summary Compose a final property array by processing removes.
   *
   * @param {*} suffix Property suffix, actually the final property name.
   * @returns {String[]} Array of string properties.
   *
   * @description
   * It keeps a local cache.
   * It silently ignores properties to remove that are not present.
   */
  propertyWithAddAndRemove_ (suffix) {
    const namedCache = `${suffix}_`
    const capitalisedName = Util.capitalizeFirstLetter(suffix)
    const addName = `add${capitalisedName}`
    const removeName = `remove${capitalisedName}`

    if (!this.cache_[namedCache]) {
      if (!this[addName] && !this[removeName]) {
        // Start with an empty array, or inherit from parent.
        if (!this.node.parent) {
          this.cache_[namedCache] = []
        } else {
          this.cache_[namedCache] =
            this.parent.propertyWithAddAndRemove_(suffix)
        }
      } else {
        const arr = this.propertyWithParent_(addName)
        if (arr.length !== 0) {
          this.log.trace(
            `node '${this.node.name}' add ${suffix} ${arr}`)
        }
        // Create a set with all values to be added.
        const properties = new Set(arr)

        // Remove unwanted properties from the set.
        for (const toRemove of this.propertyWithParent_(removeName)) {
          if (properties.delete(toRemove)) {
            this.log.trace(
              `node '${this.node.name}' remove ${suffix} ${toRemove}`)
          } else {
            this.log.trace(
              `node '${this.node.name}' remove ${suffix} ${toRemove} ignored`)
          }
        }

        // Use the spread operator to transform a set into an Array.
        this.cache_[namedCache] = [ ...properties ]
      }
    }
    return this.cache_[namedCache]
  }

  get definedSymbols () {
    return this.propertyWithAddAndRemove_('definedSymbols')
  }

  get undefinedSymbols () {
    return this.propertyWithAddAndRemove_('undefinedSymbols')
  }

  get includeFolders () {
    return this.propertyWithAddAndRemove_('includeFolders')
  }

  get includeSystemFolders () {
    return this.propertyWithAddAndRemove_('includeSystemFolders')
  }

  get includeFiles () {
    return this.propertyWithAddAndRemove_('includeFiles')
  }

  toString () {
    if (!this.cache_.allString_) {
      // Get help from the tool to collect all options. Not very nice
      // because it adds an extra dependency.
      this.cache_.allString_ = this.tool.fullOptions(this.node)
    }
    return this.cache_.allString_
  }
}

// ============================================================================

/**
 * @typedef {Object} DMNode
 *
 * @property {String} name The file or folder name.
 * @property {Folder|DMTree} parent The parent folder or the tree root.
 * @property {DMToolchainOptions} options The toolchain options.
 * @property {String} absolutePath The node absolute path.
 * @property {String} relativePath The node path, relative to the project root.
 * @property {String[]} symbols Array of symbols.
 * @property {String[]} includeFolders Array of paths.
 * @property {String[]} includeSystemFolders Array of paths.
 * @property {String[]} includeFiles Array of paths.
 *
 * @property {String[]} addDefinedSymbols Array of symbols or undefined.
 * @property {String[]} removeDefinedSymbols Array of symbols or undefined.
 * @property {String[]} addIncludeFolders Array of paths or undefined.
 * @property {String[]} removeIncludeFolders Array of paths or undefined.
 * @property {String[]} addIncludeSystemFolders Array of paths or undefined.
 * @property {String[]} removeIncludeSystemFolders Array of paths or undefined.
 * @property {String[]} addIncludeFiles Array of paths or undefined.
 * @property {String[]} removeIncludeFiles Array of paths or undefined.
 */

class DMNode {
  // --------------------------------------------------------------------------

  /**
   * @summary Construct a tree node.
   *
   * @param {Object} args The arguments.
   * @param {Object} args.log The logger.
   * @param {String} args.name The node name.
   * @param {DMFolder} args.parent Optional parent folder.
   * @param {Toolchain} args.toolchain The toolchain definition.
   * @param {Tool} args.tool The optional tool definition (for FileNodes).
   */
  constructor (args) {
    assert(args, 'There must be args.')

    assert(args.log, 'There must be a logger.')
    this.log = args.log
    const log = this.log

    assert(Util.isString(args.name), 'There must be a string name.')
    this.name = args.name

    if (args.parent) {
      assert(args.parent instanceof DMFolder,
        'The parent must be a folder.')
      this.parent = args.parent
    }

    assert(args.toolchain instanceof Toolchain, 'There must be a Toolchain.')
    this.toolchain = args.toolchain

    if (args.tool) {
      assert(args.tool instanceof Tool, 'For files, there must be a Tool.')
      this.tool = args.tool
    }

    this.cache_ = {}
    this.options = new DMToolchainOptions({
      log,
      node: this,
      tool: this.tool, // Defined only for FileNodes.
      toolchain: this.toolchain
    })
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files,
    // for root, folders or files.

    this.cache_ = {}

    this.options.clear()
  }

  get absolutePath () {
    if (!this.cache_.absolutePath_) {
      this.cache_.absolutePath_ =
        path.join(this.parent.absolutePath, this.name)
    }
    return this.cache_.absolutePath_
  }

  get relativePath () {
    if (!this.cache_.relativePath_) {
      // POSIX path!
      this.cache_.relativePath_ =
        path.posix.join(this.parent.relativePath, this.name)
    }
    return this.cache_.relativePath_
  }

  get buildRelativePath () {
    if (!this.cache_.buildRelativePath_) {
      // POSIX path!
      this.cache_.buildRelativePath_ =
        path.posix.join(this.parent.buildRelativePath, this.name)
    }
    return this.cache_.buildRelativePath_
  }

  set buildRelativePath (value) {
    this.cache_.buildRelativePath_ = value
  }

  get buildRelativePathEscaped () {
    if (!this.cache_.buildRelativePathEscaped_) {
      this.cache_.buildRelativePathEscaped_ =
        Util.escapeSpaces(this.buildRelativePath)
    }
    return this.cache_.buildRelativePathEscaped_
  }

  get relativePathShortName () {
    if (!this.cache_.relativePathShortName_) {
      // POSIX path!
      this.cache_.relativePathShortName_ =
        path.posix.join(this.parent.relativePath, this.shortName)
    }
    return this.cache_.relativePathShortName_
  }

  get relativePathShortNameEscaped () {
    if (!this.cache_.relativePathShortNameEscaped_) {
      this.cache_.relativePathShortNameEscaped_ =
        Util.escapeSpaces(this.relativePathShortName)
    }
    return this.cache_.relativePathShortNameEscaped_
  }

  // --------------------------------------------------------------------------

  propertyWithParent_ (name, groupName) {
    const cachedName = `${name}WithParent_`

    const group = this[groupName]
    const groupCache = group.cache_

    if (!groupCache[cachedName]) {
      // Create a new array.
      groupCache[cachedName] = []
      if (this.parent) {
        // Inherit parent array.
        const parentArray = this.parent.propertyWithParent_(name, groupName)
        if (parentArray.length !== 0) {
          groupCache[cachedName] = [...groupCache[cachedName], ...parentArray]
        }
      }
      if (group[name] && group[name].length !== 0) {
        // Contribute the current definitions.
        groupCache[cachedName] = [...groupCache[cachedName], ...group[name]]
      }
    }
    return groupCache[cachedName]
  }

  addProperties (buildObject, buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.addProperties(` +
      `'${buildObject.name}', ` +
      `'${buildConfiguration.name}')`)

    // Keep a link to the source tree node, it will later help
    // exporters.
    buildObject.node = this

    // For files add only one tool, for folders add all tools.
    // Also make include paths relative.
    this.options.appendFrom(buildObject.toolchainOptions,
      buildConfiguration.actual.buildAbsolutePath)

    if (log.isTrace()) {
      for (const [toolName, toolOptions] of
        Object.entries(this.options.tools)) {
        log.trace(`node '${this.name}' ${toolName}: ${toolOptions}`)
      }
    }
  }

  propertyWithAddAndRemove___ (name, groupName) {
    const log = this.log

    const cachedName = `${name}_`
    const capitalisedName = Util.capitalizeFirstLetter(name)
    const addName = `add${capitalisedName}`
    const removeName = `remove${capitalisedName}`

    const group = this[groupName]
    const groupCache = group.cache_

    if (!groupCache[cachedName]) {
      if (group[addName].length === 0 &&
        group[removeName].length === 0) {
        // Start with an empty array, or inherit from parent.
        if (!this.parent) {
          groupCache[cachedName] = []
        } else {
          groupCache[cachedName] =
            this.parent.propertyWithAddAndRemove_(name, groupName)
        }
      } else {
        const arr = this.propertyWithParent_(addName, groupName)
        if (arr.length) {
          log.trace(
            `node '${this.name}' add '${name}' ${arr}`)
        }
        // Create a set with all properties to be added.
        const properties = new Set(arr)

        // Remove unwanted properties from the set.
        for (const toRemove of
          this.propertyWithParent_(removeName, groupName)) {
          if (properties.delete(toRemove)) {
            log.trace(`node '${this.name}' remove '${name}' ${toRemove}`)
          } else {
            log.trace(`node '${this.name}' remove '${name}' ${toRemove}` +
              ' ignored')
          }
        }

        // Use the spread operator to transform a set into an Array.
        groupCache[cachedName] = [...properties]
      }
    }
    return groupCache[cachedName]
  }

  // --------------------------------------------------------------------------

  toString () {
    if (!this.cache_.allString_) {
      this.cache_.allString_ = this.relativePath

      // TODO: add more properties.
    }

    return this.cache_.allString_
  }
}

// ============================================================================

/**
  * @typedef {Object} DMFile
  *
  * @augments DMNode
  * @property {Object} fileExtension The toolchain file extension object.
  * @property {Tool} tool The toolchain tool.
  * @property {String} shortName The file name without extension.
  * @property {String} fullCommand The full command line.
  */

class DMFile extends DMNode {
  // --------------------------------------------------------------------------

  /**
   * @summary Construct a file node.
   *
   * @param {Object} args The arguments.
   * @param {Object} args.log The logger.
   * @param {String} args.name The node name.
   * @param {DMFolder} args.parent Optional parent folder.
   * @param {Toolchain} args.toolchain The toolchain definition.
   * @param {Tool} args.tool The optional tool definition (for FileNodes).
   * @param {FileType} fileExtension Reference to file extension.
   */
  constructor (args) {
    assert(args, 'There must be args.')
    assert(args.parent instanceof DMFolder,
      'The parent must be a folder.')
    super(args)

    if (args.parent) {
      this.parent.files.push(this)
    }

    const log = this.log
    log.trace(`${this.constructor.name}.construct('${args.name}')`)

    assert(args.fileExtension, 'There must be a file extension.')
    this.fileExtension = args.fileExtension

    this.shortName = this.name.substr(0,
      this.name.length - this.fileExtension.name.length - 1)
  }

  static add (args) {
    assert(args, 'There must be args.')
    assert(args.parent instanceof DMFolder,
      'The parent must be a folder.')

    for (const node of args.parent.files) {
      if (node.name === args.name) {
        return node
      }
    }

    return new DMFile(args)
  }

  /**
   * @override
   */
  clear () {
    super.clear()
  }

  /**
   * @summary Get the full command string.
   *
   * @returns {String} The full command string.
   */
  get fullCommand () {
    if (!this.cache_.fullCommand_) {
      this.cache_.fullCommand_ = this.tool.fullCommand(this)
    }
    return this.cache_.fullCommand_
  }

  // --------------------------------------------------------------------------
}

// ============================================================================

class DMFolder extends DMNode {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set the context.
   *
   * @param {Object} args Reference to a context.
    */
  constructor (args) {
    assert(args, 'There must be args.')
    super(args)

    if (args.parent) {
      this.parent.folders.push(this)
    }

    const log = this.log
    log.trace(`${this.constructor.name}.construct('${args.name}')`)

    this.folders = []
    this.files = []
  }

  static add (args) {
    assert(args, 'There must be args.')
    assert(args.parent instanceof DMFolder,
      'The parent must be a folder.')

    for (const node of args.parent.folders) {
      if (node.name === args.name) {
        return node
      }
    }

    return new DMFolder(args)
  }

  /**
   * @summary Get the tools used to build the files in the current folder.
   *
   * @returns {Tool[]} Array of tools.
   */
  get usedTools () {
    if (!this.cache_.usedTools_) {
      const toolsSet = new Set()
      for (const folder of this.folders) {
        folder.usedTools.forEach((val) => {
          toolsSet.add(val)
        })
      }
      for (const file of this.files) {
        toolsSet.add(file.tool)
      }
      if (this.tool) {
        toolsSet.add(this.tool)
      }
      this.cache_.usedTools_ = [...toolsSet]
    }
    return this.cache_.usedTools_
  }

  // --------------------------------------------------------------------------
}

// ============================================================================

class DMTree extends DMFolder {
  // --------------------------------------------------------------------------

  /**
   * @summary Create the source tree, where all folders will be added.
   *
   * @param {Object} args Reference to a context.
   */
  constructor (args) {
    super({
      name: 'tree',
      parent: null,
      ...args
    })

    assert(args.cwd, 'There must be an args.cwd.')
    this.cwd = args.cwd
    // Not public, no need for a setter.
    this.cache_.absolutePath_ = args.cwd

    assert(args.tool instanceof Tool, 'There must be an args.tool.')
    this.tool = args.tool

    assert(args.language, 'There must be an args.language.')
    this.language = args.language

    assert(args.xmakeParser)
    this.xmakeParser = args.xmakeParser
  }

  /**
   * @summary Getter for the absolute path.
   *
   * @override
   * @description
   * The absolute path is the project path.
   */
  get absolutePath () {
    return this.cache_.absolutePath_
  }

  /**
   * @summary Getter for the relative path.
   *
   * @override
   * @description
   * The relative path is ''.
   */
  get relativePath () {
    return ''
  }

  /**
   * @summary Create the source tree, based on the source folders.
   *
   * @async
   * @param {String[]} sourceFoldersAbsolutePaths Array of absolute paths
   * to source folders.
   * @returns {undefined} Nothing.
   */
  async create (sourceFoldersAbsolutePaths) {
    assert(Array.isArray(sourceFoldersAbsolutePaths))

    const log = this.log
    log.trace(`${this.constructor.name}.create()`)

    for (const sourceFolderAbsolutePath of sourceFoldersAbsolutePaths) {
      await this.addFolder(sourceFolderAbsolutePath, this)
    }
  }

  /**
   * @summary Add a folder and all its children, recursively.
   *
   * @async
   * @param {String} sourceFolderAbsolutePath The absolute path to the folder.
   * @param {DMNode} parentNode The parent folder node.
   * @returns {undefined} Nothing.
   */
  async addFolder (sourceFolderAbsolutePath, parentNode) {
    assert(Util.isString(sourceFolderAbsolutePath))
    assert(parentNode instanceof DMTree ||
      parentNode instanceof DMFolder, 'There must be a parent node.')

    const log = this.log
    log.trace(
      `${this.constructor.name}.addFolder('${sourceFolderAbsolutePath}')`)

    // const context = this.context

    // Make relative and extract the first part and the rest.
    const parts = path.relative(this.cwd, sourceFolderAbsolutePath)
      .split(path.sep)

    // log.trace(`parts: ${parts}`)
    let folderNode = parentNode
    if (parts.length > 0) {
      for (const part of parts) {
        folderNode = DMFolder.add({
          name: part,
          parent: folderNode,
          log,
          toolchain: this.toolchain
        })
      }
    }
    await this.addChildren_(folderNode)
  }

  /**
   * @summary Add children files and folders.
   *
   * @param {DMFolder} folderNode The parent folder node.
   * @returns {undefined}
   *
   * @description
   * The work horse to the class. Recursively examine the folder and
   * add children nodes for all folders and files with known extensions.
   */
  async addChildren_ (folderNode) {
    const log = this.log

    log.trace(
      `${this.constructor.name}.addChildren_('${folderNode.relativePath}')`)

    // Recursively iterate files and folders below this folder.
    const absolutePath = folderNode.absolutePath
    const names = await DirCache.readdir(absolutePath)

    // Cannot place it at the beginning, circular refs.
    const XmakeParser = require('./xmake-parser.js').XmakeParser
    const toIgnoreFileName = XmakeParser.dotXmakeIgnoreFileName

    let toIgnore
    for (const part of names) {
      if (part.name === toIgnoreFileName) {
        const toIgnoreAbsolutePath = path.join(absolutePath, toIgnoreFileName)
        toIgnore = await IgnorerCache.read(toIgnoreAbsolutePath, log)
        break
      }
    }
    for (const part of names) {
      const name = part.name
      const stat = part.stat

      if (toIgnore && toIgnore.indexOf(name) !== -1) {
        // Ignore all names present in the `.xmakeignore`.
        log.trace(`ignore '${name}', explicit`)
        continue
      }

      if (stat.isDirectory()) {
        if (name.startsWith('.')) {
          // Ignore all folder names starting with a dot.
          log.trace(`ignore '${name}', dot`)
          continue
        }
        // Recurse
        const childFolder = DMFolder.add({
          name,
          parent: folderNode,
          log,
          toolchain: this.toolchain
        })
        await this.addChildren_(childFolder)
      } else if (stat.isFile()) {
        // Since it may start with dot, it must be located before the dot
        // test, otherwise it'll be filtered out.
        if (XmakeParser.isXmakeJson(name)) {
          const json = await this.xmakeParser.parse({
            folderAbsolutePath: absolutePath,
            purpose: 'meta',
            fileName: name
          })
          if (json) { /* TODO */ }
        }

        if (name.startsWith('.')) {
          // Ignore all file names starting with a dot.
          log.trace(`ignore '${name}', dot`)
          continue
        }

        const fileExtension = this.toolchain.extensionForFile(name)
        if (!fileExtension) {
          continue
        }
        if (fileExtension.tool.languages.indexOf(this.language) === -1) {
          log.trace(`ignored '${name}', language`)
          continue
        }
        // As a known extension, this must be a source file.
        const fileNode = DMFile.add({
          name,
          parent: folderNode,
          fileExtension,
          log,
          toolchain: this.toolchain,
          tool: fileExtension.tool
        })
        log.debug(`source file: '${fileNode.relativePath}' ` +
              `${fileExtension.tool.fullCommandName}`)
      } else {
        log.trace(`ignore '${name}', stat`)
      }
    }
  }

  // --------------------------------------------------------------------------

  set sourceFolderNodes (nodes) {
    const log = this.log
    for (const node of nodes) {
      log.trace(`src node '${node}'`)
    }

    this.cache_.sourceFolderNodes_ = nodes
  }

  get sourceFolderNodes () {
    if (!this.cache_.sourceFolderNodes_) {
      this.getSrcsObjs_()
    }
    return this.cache_.sourceFolderNodes_
  }

  // --------------------------------------------------------------------------

  set objs (values) {
    const log = this.log
    for (const obj of values) {
      log.trace(`obj '${obj}'`)
    }

    this.cache_.objs_ = values
  }

  get objs () {
    if (!this.cache_.objs_) {
      this.getSrcsObjs_()
    }
    return this.cache_.objs_
  }

  // --------------------------------------------------------------------------

  /**
   * @summary Collect source folders, objects and tools from the entire tree.
   *
   * @returns {undefined} Nothing
   *
   * @description
   * The function descends the tree and collects data.
   * At the end it calls the setters o cache the values
   */
  getSrcsObjs_ () {
    const out = {
      sourceFolderNodes: [],
      objs: []
    }
    this.getSrcsObjsRecursive_(this, out)

    this.sourceFolderNodes = out.sourceFolderNodes
    this.objs = out.objs
  }

  getSrcsObjsRecursive_ (node, out) {
    if (node.files.length > 0) {
      out.sourceFolderNodes.push(node)

      for (const file of node.files) {
        out.objs.push(file.relativePath + '.' +
          file.tool.toolchain.objectExtension)
      }
    }
    for (const folder of node.folders) {
      this.getSrcsObjsRecursive_(folder, out)
    }
  }

  /**
   * @summary Copy properties from the build configuration to the source tree.
   *
   * @param {CFBuildConfiguration} buildConfiguration Reference to the build
   * configuration.
   * @returns {undefined} Nothing.
   *
   * @description
   * Copy properties to the root node and to all folder and file nodes.
   */
  addNodesProperties (buildConfiguration) {
    const log = this.log
    log.trace(
      `${this.constructor.name}.addNodesProperties(` +
      `'${buildConfiguration.name}')`)

    const topConfiguration = buildConfiguration.topConfiguration

    // Be sure the build path is available, since it is needed to make
    // include path relative.
    assert(buildConfiguration.actual.buildAbsolutePath)

    // Collect options for the root node, grouped by tool.
    // Symbols and include folder paths (changed to relative) are also
    // included for each tool.
    this.options.appendFrom(buildConfiguration.actual.toolchainOptions,
      buildConfiguration.actual.buildAbsolutePath)

    this.buildRelativePath = path.posix.relative(
      buildConfiguration.actual.buildAbsolutePath,
      topConfiguration.actual.cwd)

    this.targetArtefact = buildConfiguration.actual.targetArtefact

    // Contribute folders properties. Skip root folder.
    for (const buildFolder of
      Object.values(buildConfiguration.actual.folders)) {
      if (buildFolder.name !== '') {
        this.addFolderProperties_(buildFolder, buildConfiguration)
      }
    }

    // Contribute files properties.
    for (const buildFile of
      Object.values(buildConfiguration.actual.files)) {
      this.addFileProperties_(buildFile, buildConfiguration)
    }
  }

  addFolderProperties_ (buildFolder, buildConfiguration) {
    const folderNode = this.findFolderNode_(buildFolder.name)

    folderNode.addProperties(buildFolder, buildConfiguration)
  }

  addFileProperties_ (buildFile, buildConfiguration) {
    const fileNode = this.findFileNode_(buildFile.name)

    fileNode.addProperties(buildFile, buildConfiguration)
  }

  /**
   * @summary Given a folder relative path, find the folder node.
   * @param {*} folderRelativePath A relative path to a folder.
   * @returns {DMFolder} The folder node.
   */
  findFolderNode_ (folderRelativePath) {
    if (folderRelativePath === '') {
      // The top folder is exactly this one, the sourceTree node.
      return this
    }
    // Split the path into folders.
    const parts = folderRelativePath.split(path.sep)
    let folderNode = this
    let i
    for (i = 0; i < parts.length; ++i) {
      let ix = -1
      for (let j = 0; j < folderNode.folders.length; ++j) {
        if (folderNode.folders[j].name === parts[i]) {
          ix = j
          break
        }
      }
      if (ix === -1) {
        throw new Error(`Folder path '${folderRelativePath}' not found.`)
      }
      folderNode = folderNode.folders[ix]
    }
    return folderNode
  }

  /**
   * @summary Given a file relative path, find the file node.
   * @param {String} fileRelativePath A relative path to a file.
   * @returns {DMFile} The file node.
   */
  findFileNode_ (fileRelativePath) {
    // Split path into folder path and file name.
    const parts = path.parse(fileRelativePath)
    let folderNode
    try {
      folderNode = this.findFolderNode_(parts.dir)
    } catch (ex) {
      throw new Error(`File path '${fileRelativePath}' not found.`)
    }

    // Inside a folder node, identify the file child.
    const base = parts.base
    let ix = -1
    for (let i = 0; i < folderNode.files.length; ++i) {
      if (folderNode.files[i].name === base) {
        ix = i
        break
      }
    }
    if (ix === -1) {
      throw new Error(`File path '${fileRelativePath}' not found.`)
    }
    const fileNode = folderNode.files[ix]
    return fileNode
  }

  /**
   * @summary Get the full command string.
   *
   * @returns {String} The full command string.
   */
  get fullCommand () {
    if (!this.cache_.fullCommand_) {
      this.cache_.fullCommand_ = this.tool.fullCommand(this)
    }
    return this.cache_.fullCommand_
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.DMNode = DMNode
module.exports.DMFile = DMFile
module.exports.DMFolder = DMFolder
module.exports.DMTree = DMTree
// module.exports.fileExtensions = fileExtensions

// In ES6, it would be:
// export class DMFile { ... }
// ...
// import { DMFile, DMFolder, DMTree } from 'utils/source-tree.js'

// ----------------------------------------------------------------------------
