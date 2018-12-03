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
 * The root node corresponds to the package root; all input paths
 * are relative to it.
 *
 * Each node may have computed toolchain definitions:
 * .symbols
 * .includes
 * .options.tools[].optimizations
 * .options.tools[].warnings
 * .options.tools[].miscellaneous
 *
 * All the above are getters, that cache results.
 * Options are maps, accessed by tool names.
 *
 * The input definitions are:
 * .addSymbols
 * .removeSymbols
 * .addIncludes
 * .removeIncludes
 * .options.tools[].removeOptimizations
 * .options.tools[].addOptimizations
 * .options.tools[].removeWarnings
 * .options.tools[].addWarnings
 * .options.tools[].removeMiscellaneous
 * .options.tools[].addMiscellaneous
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
const XmakeToolchainOptions =
  require('./xmake-objects.js').XmakeToolchainOptions
const XmakeCommonOptions =
  require('./xmake-objects.js').XmakeCommonOptions
const XmakeSymbols = require('./xmake-objects.js').XmakeSymbols
const XmakeIncludes = require('./xmake-objects.js').XmakeIncludes
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
 * @typedef {Object} NodeToolchainOptions
 * @property {Node} node
 * @property {Object} log
 *
 * @property {Object} tools Map of NodeToolOptions
 * @property {Toolchain} toolchain
 */

class NodeToolchainOptions {
  constructor (node, context) {
    assert(node instanceof Node, 'There must be a Node.')
    this.node = node

    assert(context, 'There must be a context.')
    assert(context.log, 'There must be a context.log.')
    this.log = context.log

    this.tools = {}
    if (context.toolchainOptions) {
      this.copyFrom(context.toolchainOptions)
    } else if (node instanceof FileNode) {
      this.toolchain = context.toolchain
      // For file nodes skip the tools,
      // the FileNode constructor will add a single tool later.
    } else {
      assert(context.toolchain instanceof Toolchain)

      this.toolchain = context.toolchain
      for (const toolName of
        Object.keys(this.toolchain.tools)) {
        this.tools[toolName] =
            new NodeToolOptions(this.node, {
            log: this.log,
            tool: this.toolchain.tools[toolName]
          })
      }
    }
  }

  copyFrom (toolchainOptions) {
    if (toolchainOptions) {
      assert(toolchainOptions instanceof XmakeToolchainOptions)

      this.toolchain = toolchainOptions.toolchain
      for (const [toolName, toolOptions] of
        Object.entries(toolchainOptions.tools)) {
        this.tools[toolName] =
          new NodeToolOptions(this.node, {
            log: this.log,
            tool: toolOptions.tool,
            commonOptions: toolchainOptions.commonOptions,
            toolOptions
          })
      }
    }
  }

  appendFrom (toolchainOptions) {
    assert(toolchainOptions instanceof XmakeToolchainOptions)

    for (const [toolName, tool] of Object.entries(this.tools)) {
      tool.appendFrom(toolchainOptions.commonOptions)
      tool.appendFrom(toolchainOptions.tools[toolName])
    }
  }
}

// ============================================================================

/**
 * @typedef {Object} NodeToolOptions
 * @property {Node} node
 * @property {Object} log
 * @property {Tool} tool
 * @property {String[]} suffixes
 *
 * @description
 * The actual options are stored in arrays like addSuffix[], removeSuffix[].
 */

class NodeToolOptions {
  constructor (node, context) {
    assert(node instanceof Node, 'There must be a Node.')
    this.node = node

    assert(context, 'There must be a context.')
    assert(context.log, 'There must be a context.log.')
    this.log = context.log
    assert(context.tool instanceof Tool)
    this.tool = context.tool

    // Beware that parent options may change, so caching a reference to the
    // parent options is a bad idea. Thus the getter, to be always up to date.

    this.copyFrom(context.commonOptions)
    this.appendFrom(context.toolOptions)
  }

  get parent () {
    // Warning! This is an extra dependency!
    // To minimise damage, keep it in one place.
    return this.node.parent.options.tools[this.tool.name]
  }

  copyFrom (buildOptions) {
    if (buildOptions) {
      assert(buildOptions instanceof XmakeCommonOptions)

      // Only properties with the known suffixes are copied.
      this.suffixes = buildOptions.suffixes
      for (const suffix of this.suffixes) {
        for (const prefix of ['add', 'remove']) {
          const property = prefix + suffix
          if (buildOptions[property] &&
            buildOptions[property].length !== 0) {
            // Create e local copy of the array.
            this[property] = [...buildOptions[property]]
          } else {
            this[property] = []
          }
        }
      }
    } else {
      this.suffixes = this.tool.configurationSuffixes
    }
  }

  appendFrom (buildOptions) {
    if (buildOptions) {
      assert(buildOptions instanceof XmakeCommonOptions)

      for (const suffix of this.suffixes) {
        for (const prefix of ['add', 'remove']) {
          const property = prefix + suffix
          if (buildOptions[property] &&
            buildOptions[property].length !== 0) {
            if (this[property] && this[property].length !== 0) {
              this[property] =
                [...this[property], ...buildOptions[property]]
            } else {
              // Create e local copy of the array.
              this[property] = [...buildOptions[property]]
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
    const cachedName = `${name}WithParentCached_`

    if (!this[cachedName]) {
      // Start a new empty array.
      this[cachedName] = []

      if (this.node.parent) {
        // Inherit from parent array, if not empty.
        const parentArray = this.parent.propertyWithParent_(name)
        if (parentArray.length !== 0) {
          this[cachedName] = [...this[cachedName], ...parentArray]
        }
      }
      if (this[name] && this[name].length !== 0) {
        // Contribute the current definitions.
        this[cachedName] = [...this[cachedName], ...this[name]]
      }
    }
    return this[cachedName]
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
    const namedCache = `${suffix}Cached_`
    const capitalisedName = Util.capitalizeFirstLetter(suffix)
    const addName = `add${capitalisedName}`
    const removeName = `remove${capitalisedName}`

    if (!this[namedCache]) {
      if (!this[addName] && !this[removeName]) {
        // Start with an empty array, or inherit from parent.
        if (!this.node.parent) {
          this[namedCache] = []
        } else {
          this[namedCache] = this.parent.propertyWithAddAndRemove_(suffix)
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
        this[namedCache] = [ ...properties ]
      }
    }
    return this[namedCache]
  }

  toString () {
    if (!this.allStringCached_) {
      // Get help from the tool to collect all options. Not very nice
      // because it adds an extra dependency.
      this.allStringCached_ = this.tool.fullOptions(this.node)
    }
    return this.allStringCached_
  }
}

// ============================================================================

/**
 * @typedef {Object} Node
 *
 * @property {String} name The file or folder name.
 * @property {Folder|SourceTree} parent The parent folder or the tree root.
 * @property {NodeToolchainOptions} options The toolchain options.
 * @property {String} absolutePath The node absolute path.
 * @property {String} relativePath The node path, relative to the project root.
 * @property {String[]} symbols Array of symbols.
 * @property {String[]} includeFolders Array of paths.
 * @property {String[]} includeSystemFolders Array of paths.
 * @property {String[]} includeFiles Array of paths.
 *
 * @property {String[]} addSymbols Array of symbols or undefined.
 * @property {String[]} removeSymbols Array of symbols or undefined.
 * @property {String[]} addIncludeFolders Array of paths or undefined.
 * @property {String[]} removeIncludeFolders Array of paths or undefined.
 * @property {String[]} addIncludeSystemFolders Array of paths or undefined.
 * @property {String[]} removeIncludeSystemFolders Array of paths or undefined.
 * @property {String[]} addIncludeFiles Array of paths or undefined.
 * @property {String[]} removeIncludeFiles Array of paths or undefined.
 */

class Node {
  // --------------------------------------------------------------------------

  constructor (name, parent, context) {
    assert(context, 'There must be a context.')
    this.context = context

    assert(context.cwd, 'There must be a context.cwd.')

    assert(context.log, 'There must be a context.log.')
    this.log = context.log

    this.name = name
    this.parent = parent

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files,
    // for root, folders or files.

    this.symbols_ = new XmakeSymbols()
    this.includes_ = new XmakeIncludes()

    this.options = new NodeToolchainOptions(this, {
      log: this.log,
      tool: this.context.tool, // Defined only for FileNodes
      toolchain: this.context.toolchain
    })

    // ------------------------------------------------------------------------
    // These properties will be computed and cached.

    this.absolutePathCached_ = undefined // string
    this.relativePathCached_ = undefined // string

    this.allStringCached_ = undefined // string
  }

  get absolutePath () {
    if (!this.absolutePathCached_) {
      this.absolutePathCached_ =
        path.join(this.parent.absolutePath, this.name)
    }
    return this.absolutePathCached_
  }

  get relativePath () {
    if (!this.relativePathCached_) {
      // POSIX path!
      this.relativePathCached_ =
        path.posix.join(this.parent.relativePath, this.name)
    }
    return this.relativePathCached_
  }

  get buildRelativePath () {
    if (!this.buildRelativePathCached_) {
      // POSIX path!
      this.buildRelativePathCached_ =
        path.posix.join(this.parent.buildRelativePath, this.name)
    }
    return this.buildRelativePathCached_
  }

  set buildRelativePath (value) {
    this.buildRelativePathCached_ = value
  }

  get buildRelativePathEscaped () {
    if (!this.buildRelativePathEscapedCached_) {
      this.buildRelativePathEscapedCached_ =
        Util.escapeSpaces(this.buildRelativePath)
    }
    return this.buildRelativePathEscapedCached_
  }

  get relativePathShortName () {
    if (!this.relativePathShortNameCached_) {
      // POSIX path!
      this.relativePathShortNameCached_ =
        path.posix.join(this.parent.relativePath, this.shortName)
    }
    return this.relativePathShortNameCached_
  }

  get relativePathShortNameEscaped () {
    if (!this.relativePathShortNameEscapedCached_) {
      this.relativePathShortNameEscapedCached_ =
        Util.escapeSpaces(this.relativePathShortName)
    }
    return this.relativePathShortNameEscapedCached_
  }

  // --------------------------------------------------------------------------

  propertyWithParent_ (name, groupName) {
    const cachedName = `${name}WithParentCached_`

    const group = this[groupName]
    if (!group[cachedName]) {
      // Create a new array.
      group[cachedName] = []
      if (this.parent) {
        // Inherit parent array.
        const parentArray = this.parent.propertyWithParent_(name, groupName)
        if (parentArray.length !== 0) {
          group[cachedName] = group[cachedName].concat(parentArray)
        }
      }
      if (group[name] && group[name].length !== 0) {
        // Contribute the current definitions.
        group[cachedName] = group[cachedName].concat(group[name])
      }
    }
    return group[cachedName]
  }

  propertyWithAddAndRemove_ (name, groupName) {
    const log = this.log

    const namedCache = `${name}Cached_`
    const capitalisedName = Util.capitalizeFirstLetter(name)
    const addName = `add${capitalisedName}`
    const removeName = `remove${capitalisedName}`

    const group = this[groupName]

    if (!group[namedCache]) {
      if (group[addName].length === 0 && group[removeName].length === 0) {
        // Start with an empty array, or inherit from parent.
        if (!this.parent) {
          group[namedCache] = []
        } else {
          group[namedCache] =
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
        group[namedCache] = [ ...properties ]
      }
    }
    return group[namedCache]
  }

  // --------------------------------------------------------------------------

  get symbols () {
    return this.propertyWithAddAndRemove_('symbols', 'symbols_')
  }

  get includeFolders () {
    return this.propertyWithAddAndRemove_('includeFolders', 'includes_')
  }

  get includeSystemFolders () {
    return this.propertyWithAddAndRemove_('includeSystemFolders', 'includes_')
  }

  get includeFiles () {
    return this.propertyWithAddAndRemove_('includeFiles', 'includes_')
  }

  // --------------------------------------------------------------------------

  toString () {
    if (!this.allStringCached_) {
      this.allStringCached_ = this.relativePath
    }

    return this.allStringCached_
  }
}

// ============================================================================

/**
  * @typedef {Object} FileNode
  *
  * @augments Node
  * @property {Object} fileExtension The toolchain file extension object.
  * @property {Tool} tool The toolchain tool.
  * @property {String} shortName The file name without extension.
  * @property {String} fullCommand The full command line.
  */

class FileNode extends Node {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set the context.
   *
   * @param {string} name File name, as in the file system.
   * @param {FolderNode|null} parent Reference to parent node.
   * @param {FileType} fileExtension Reference to file extension.
   * @param {Object} context Reference to a context.
   */
  constructor (name, parent, fileExtension, context) {
    assert(parent instanceof FolderNode,
      'The parent must be a folder.')
    assert(Util.isString(name), 'There must be a string name.')
    super(name, parent, context)

    const log = this.log
    log.trace(`${this.constructor.name}.construct('${name}')`)

    assert(fileExtension, 'There must be a file extension.')
    this.fileExtension = fileExtension
    this.tool = fileExtension.tool
    this.options.tools[this.tool.name] = new NodeToolOptions(this, {
      log,
      tool: this.tool
    })
    this.shortName = name.substr(0, name.length - fileExtension.name.length - 1)

    parent.files.push(this)
  }

  static add (name, parent, fileExtension, context) {
    for (const node of parent.files) {
      if (node.name === name) {
        return node
      }
    }

    return new FileNode(name, parent, fileExtension, context)
  }

  /**
   * @override
   */
  clear () {
    super.clear()

    this.fullCommandString_ = undefined
  }

  /**
   * @summary Get the full command string.
   *
   * @returns {String} The full command string.
   */
  get fullCommand () {
    if (!this.fullCommandCached_) {
      this.fullCommandCached_ = this.tool.fullCommand(this)
    }
    return this.fullCommandCached_
  }

  // --------------------------------------------------------------------------
}

// ============================================================================

class FolderNode extends Node {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set the context.
   *
   * @param {string} name Folder name, as in the file system.
   * @param {FolderNode|SourceTree} parent Reference to parent node.
   * @param {Object} context Reference to a context.
    */
  constructor (name, parent, context) {
    assert(parent === null ||
      parent instanceof FolderNode ||
      parent instanceof SourceTree,
    'The parent must be a folder or the tree.')
    assert(Util.isString(name), 'There must be a string name.')
    super(name, parent, context)

    const log = this.log
    log.trace(`${this.constructor.name}.construct('${name}')`)

    this.folders = []
    this.files = []

    assert(context.toolchain instanceof Toolchain)
    this.toolchain = context.toolchain
    if (parent) {
      parent.folders.push(this)
    }
  }

  static add (name, parent, context) {
    for (const node of parent.folders) {
      if (node.name === name) {
        return node
      }
    }

    return new FolderNode(name, parent, context)
  }

  // --------------------------------------------------------------------------
}

// ============================================================================

class SourceTree extends Node {
  // --------------------------------------------------------------------------

  /**
   * @summary Create the source tree, where all folders will be added.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    super('tree', null, context)

    const log = this.log
    log.trace(`${this.constructor.name}.constructor()`)

    assert(context.cwd, 'There must be a context.cwd.')
    this.cwd = context.cwd

    assert(context.fileExtensions, 'There must be a context.fileExtensions.')
    this.fileExtensions = context.fileExtensions

    assert(context.tool instanceof Tool, 'There must be a context.tool.')
    this.tool = context.tool

    assert(context.toolchain instanceof Toolchain,
      'There must be a context.toolchain.')
    this.toolchain = context.toolchain

    assert(context.language, 'There must be a context.language.')
    this.language = context.language

    assert(context.xmakeParser)
    this.xmakeParser = context.xmakeParser

    this.folders = []
    this.files = []

    this.absolutePathCached_ = context.cwd
  }

  /**
   * @summary Getter for the absolute path.
   *
   * @override
   * @description
   * The absolute path is the project path.
   */
  get absolutePath () {
    return this.absolutePathCached_
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
   * @param {Node} parentNode The parent folder node.
   * @returns {undefined} Nothing.
   */
  async addFolder (sourceFolderAbsolutePath, parentNode) {
    assert(Util.isString(sourceFolderAbsolutePath))
    assert(parentNode instanceof SourceTree ||
      parentNode instanceof FolderNode, 'There must be a parent node.')

    const log = this.log
    log.trace(
      `${this.constructor.name}.addFolder('${sourceFolderAbsolutePath}')`)

    const context = this.context

    // Make relative and extract the first part and the rest.
    const parts = path.relative(this.cwd, sourceFolderAbsolutePath)
      .split(path.sep)

    // log.trace(`parts: ${parts}`)
    let folderNode = parentNode
    if (parts.length > 0) {
      for (const part of parts) {
        folderNode = FolderNode.add(part, folderNode, context)
      }
    }
    await this.addChildren_(folderNode)
  }

  /**
   * @summary Add children files and folders.
   *
   * @param {FolderNode} folderNode The parent folder node.
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
        const childFolder = FolderNode.add(name, folderNode, this.context)
        await this.addChildren_(childFolder)
      } else if (stat.isFile()) {
        // Since it may start with dot, it must be located before the dot
        // test, otherwise it'll be filtered out.
        if (XmakeParser.isXmakeJson(name)) {
          const json = await this.xmakeParser.parse(absolutePath, {
            meta: true,
            fileName: name
          })
          if (json) { /* TODO */ }
        }

        if (name.startsWith('.')) {
          // Ignore all file names starting with a dot.
          log.trace(`ignore '${name}', dot`)
          continue
        }

        // Split path into parts, to extract extension.
        const parsed = path.parse(name)
        if (parsed.ext.length < 2 || !parsed.ext.startsWith('.')) {
          log.trace(`ignore '${name}', no extension`)
          continue
        }

        const ext = parsed.ext.substring(1)
        assert(ext, 'Mandatory extension')
        const fileExtension = this.fileExtensions[ext]
        if (!fileExtension) {
          log.trace(`ignore '${name}', extension`)
          continue
        }
        if (fileExtension.tool.languages.indexOf(this.language) === -1) {
          log.trace(`ignored '${name}', language`)
          continue
        }
        // As a known extension, this must be a source file.
        const fileNode = FileNode.add(name, folderNode,
          fileExtension, this.context)
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

    this.sourceFolderNodesCache_ = nodes
  }

  get sourceFolderNodes () {
    if (!this.sourceFolderNodesCache_) {
      this.getSrcsObjsTools_()
    }
    return this.sourceFolderNodesCache_
  }

  // --------------------------------------------------------------------------

  set tools (values) {
    const log = this.log
    for (const tool of values) {
      log.trace(`tool '${tool}'`)
    }

    this.toolsCache_ = values
  }

  get tools () {
    if (!this.toolsCache_) {
      this.getSrcsObjsTools_()
    }

    return this.toolsCache_
  }

  // --------------------------------------------------------------------------

  set objs (values) {
    const log = this.log
    for (const obj of values) {
      log.trace(`obj '${obj}'`)
    }

    this.objsCache_ = values
  }

  get objs () {
    if (!this.objsCache_) {
      this.getSrcsObjsTools_()
    }
    return this.objsCache_
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
  getSrcsObjsTools_ () {
    const out = {
      sourceFolderNodes: [],
      objs: [],
      tools: new Set()
    }
    this.getSrcsObjsToolsRecursive_(this, out)

    this.sourceFolderNodes = out.sourceFolderNodes
    this.objs = out.objs

    out.tools.add(this.tool)
    this.tools = [ ...out.tools ].sort()
  }

  getSrcsObjsToolsRecursive_ (node, out) {
    if (node.files.length > 0) {
      out.sourceFolderNodes.push(node)

      for (const file of node.files) {
        out.objs.push(file.relativePath + '.' +
          file.tool.toolchain.objectExtension)
        out.tools.add(file.tool)
      }
    }
    for (const folder of node.folders) {
      this.getSrcsObjsToolsRecursive_(folder, out)
    }
  }

  /**
   * @summary Copy properties from the build configuration to the source tree.
   *
   * @param {XmakeBuildConfiguration} buildConfiguration Reference to the build
   * configuration.
   * @returns {undefined} Nothing.
   *
   * @description
   * Copy properties to the root node and to all folder and file nodes.
   */
  addNodesProperties (buildConfiguration) {
    const log = this.log
    const buildProject = buildConfiguration.buildProject

    this.symbols_.appendFrom(buildConfiguration.symbols)

    if (log.isTrace()) {
      for (const name of XmakeSymbols.properties) {
        const arr = this.symbols_[name]
        if (arr.length) {
          log.trace(`node '${this.name}' ${name} ${arr}`)
        }
      }
    }
    // Make the include paths relative.
    assert(buildConfiguration.buildAbsolutePath)
    this.includes_.appendPosixRelative(
      buildConfiguration.buildAbsolutePath,
      buildConfiguration.includes)

    if (log.isTrace()) {
      for (const name of XmakeIncludes.properties) {
        const arr = this.includes_[name]
        if (arr.length) {
          log.trace(`node '${this.name}' ${name} ${arr}`)
        }
      }
    }

    this.buildRelativePath = path.posix.relative(
      buildConfiguration.buildAbsolutePath,
      buildProject.cwd)

    this.targetArtefact = buildConfiguration.targetArtefact

    this.options = new NodeToolchainOptions(this, {
      log: log,
      toolchain: buildConfiguration.toolchain,
      toolchainOptions: buildConfiguration.toolchainOptions
    })

    // Contribute folders properties. Skip root folder.
    for (const folder of Object.values(buildConfiguration.folders)) {
      if (folder.name !== '') {
        this.addFolderProperties_(folder, buildConfiguration)
      }
    }

    // Contribute files properties.
    for (const file of Object.values(buildConfiguration.files)) {
      this.addFileProperties_(file, buildConfiguration)
    }
  }

  addFolderProperties_ (buildFolder, buildConfiguration) {
    const folderNode = this.findFolderNode_(buildFolder.name)

    this.addNodeProperties_(folderNode, buildFolder, buildConfiguration)
  }

  addFileProperties_ (buildFile, buildConfiguration) {
    const fileNode = this.findFileNode_(buildFile.name)

    this.addNodeProperties_(fileNode, buildFile, buildConfiguration)
  }

  addNodeProperties_ (node, buildObject, buildConfiguration) {
    const log = this.log

    node.symbols_.appendFrom(buildObject.symbols)

    if (log.isTrace()) {
      for (const name of XmakeSymbols.properties) {
        const arr = node.symbols_[name]
        if (arr.length) {
          log.trace(`node '${node.name}' ${name} ${arr}`)
        }
      }
    }

    node.includes_.appendPosixRelative(
      buildConfiguration.buildAbsolutePath,
      buildObject.includes)

    if (log.isTrace()) {
      for (const name of XmakeIncludes.properties) {
        const arr = node.includes_[name]
        if (arr.length) {
          log.trace(`node '${node.name}' ${name} ${arr}`)
        }
      }
    }

    // Append toolchainOptions.
    // For files add only one tool, for folders add all tools.
    node.options.appendFrom(buildObject.toolchainOptions)
  }

  /**
   * @summary Given a folder relative path, find the folder node.
   * @param {*} folderRelativePath A relative path to a folder.
   * @returns {FolderNode} The folder node.
   */
  findFolderNode_ (folderRelativePath) {
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
   * @returns {FileNode} The file node.
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
    if (!this.fullCommandCached_) {
      this.fullCommandCached_ = this.tool.fullCommand(this)
    }
    return this.fullCommandCached_
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.Node = Node
module.exports.FileNode = FileNode
module.exports.FolderNode = FolderNode
module.exports.SourceTree = SourceTree
// module.exports.fileExtensions = fileExtensions

// In ES6, it would be:
// export class FileNode { ... }
// ...
// import { FileNode, FolderNode, SourceTree } from 'utils/source-tree.js'

// ----------------------------------------------------------------------------
