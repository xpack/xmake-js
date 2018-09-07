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
 * .options.optimizations
 * .options.warnings
 * .options.miscellaneous
 *
 * All the above are getters, that cache results
 *
 * The input definitions are:
 * .removeSymbols
 * .addSymbols
 * .removeIncludes
 * .addIncludes
 * .options.removeOptimizations
 * .options.addOptimizations
 * .options.removeWarnings
 * .options.addWarnings
 * .options.removeMiscellaneous
 * .options.addMiscellaneous
 *
 * The link between file types and tools is defined by `fileExtensions`.
 */

// ----------------------------------------------------------------------------

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
// const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
// const CliError = require('@ilg/cli-start-options').CliError
// const CliErrorApplication =
//  require('@ilg/cli-start-options').CliErrorApplication
const DirCache = require('./dir-cache.js').DirCache
const Util = require('./util.js').Util
const BuildOptions = require('./build-configuration.js').BuildOptions
const Macros = require('./macros.js').Macros
const IgnorerCache = require('./ignorer-cache.js').IgnorerCache
const XmakeParser = require('./xmake-parser.js').XmakeParser

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
// Promisifier.promisifyInPlace(fs, 'readFile')
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'readdir')
// Promisifier.promisifyInPlace(fs, 'mkdir')
// Promisifier.promisifyInPlace(fs, 'writeFile')

// ============================================================================

class NodeOptions {
  constructor (node, context) {
    assert(node instanceof Node, 'There must be a Node.')
    this.node = node

    assert(context, 'There must be a context.')
    assert(context.log, 'There must be a context.log.')
    this.log = context.log

    this.copyFrom(context.from)
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files,
    // for folders or files.

    this.addArchitecture = undefined
    this.removeArchitecture = undefined

    this.addDebugging = undefined
    this.removeDebugging = undefined

    this.addOptimizations = undefined
    this.removeOptimizations = undefined

    this.addWarnings = undefined
    this.removeWarnings = undefined

    this.addMiscellaneous = undefined
    this.removeMiscellaneous = undefined

    // ------------------------------------------------------------------------
    // These properties will be computed and cached.

    this.architectureCache_ = undefined
    this.debuggingCache_ = undefined
    this.optimizationsCache_ = undefined
    this.warningsCache_ = undefined
    this.miscellaneousCache_ = undefined

    this.allStringCache_ = undefined
  }

  copyFrom (from) {
    this.clear()
    if (from instanceof BuildOptions) {
      for (const property of BuildOptions.properties) {
        this[property] = from[property]
      }
    }
  }

  propertyWithParent_ (name) {
    const cachedName = `${name}WithParentCached_`
    if (!this[cachedName]) {
      if (!this[name]) {
        // Start with an empty array, or inherit from parent.
        if (!this.node.parent) {
          this[cachedName] = []
        } else {
          this[cachedName] = this.node.parent.options.propertyWithParent_(name)
        }
      } else {
        // Create a new array.
        this[cachedName] = []
        if (this.node.parent) {
          // Inherit parent array.
          this[cachedName] =
            this[cachedName].concat(
              this.node.parent.options.propertyWithParent_(name))
        }
        // Contribute the current definitions.
        this[cachedName] = this[cachedName].concat(this[name])
      }
    }
    return this[cachedName]
  }

  propertyWithAddAndRemove_ (name) {
    const namedCache = `${name}Cached_`
    const capitalisedName = Util.capitalizeFirstLetter(name)
    const addName = `add${capitalisedName}`
    const removeName = `remove${capitalisedName}`

    if (!this[namedCache]) {
      if (!this[addName] && !this[removeName]) {
        // Start with an empty array, or inherit from parent.
        if (!this.node.parent) {
          this[namedCache] = []
        } else {
          this[namedCache] =
            this.node.parent.options.propertyWithAddAndRemove_(name)
        }
      } else {
        const arr = this.propertyWithParent_(addName)
        if (arr.length) {
          this.log.trace(
            `node '${this.node.name}' add '${name}' ${arr}`)
        }
        // Create a set with all properties to be added.
        const properties = new Set(arr)

        // Remove unwanted properties from the set.
        for (const toRemove of this.propertyWithParent_(removeName)) {
          properties.delete(toRemove)
          this.log.trace(
            `node '${this.node.name}' remove '${name}' ${toRemove}`)
        }

        // Use the spread operator to transform a set into an Array.
        this[namedCache] = [ ...properties ]
      }
    }
    return this[namedCache]
  }

  get all () {
    if (!this.allStringCache_) {
      this.allStringCache_ = ''

      if (this.architecture.length) {
        this.allStringCache_ += ' ' + this.architecture.join(' ')
      }
      if (this.debugging.length) {
        this.allStringCache_ += ' ' + this.debugging.join(' ')
      }
      if (this.optimizations.length) {
        this.allStringCache_ += ' ' + this.optimizations.join(' ')
      }
      if (this.warnings.length) {
        this.allStringCache_ += ' ' + this.warnings.join(' ')
      }
      if (this.miscellaneous.length) {
        this.allStringCache_ += ' ' + this.miscellaneous.join(' ')
      }
      this.allStringCache_ = this.allStringCache_.trim()
    }
    return this.allStringCache_
  }

  get architecture () {
    return this.propertyWithAddAndRemove_('architecture')
  }

  get debugging () {
    return this.propertyWithAddAndRemove_('debugging')
  }

  get optimizations () {
    return this.propertyWithAddAndRemove_('optimizations')
  }

  get warnings () {
    return this.propertyWithAddAndRemove_('warnings')
  }

  get miscellaneous () {
    return this.propertyWithAddAndRemove_('miscellaneous')
  }

  toString () {
    return this.all
  }
}

// ============================================================================

/**
 * @typedef {Object} Node
 *
 * @property {String} name The file or folder name.
 * @property {Folder|SourceTree} parent The parent folder or the tree root.
 * @property {NodeOptions} options The tool options.
 * @property {String} absolutePath The node absolute path.
 * @property {String} relativePath The node path, relative to the project root.
 * @property {String[]} symbols Array of symbols.
 * @property {String[]} includeFolders Array of paths.
 *
 * @property {String[]} addSymbols Array of symbols or undefined.
 * @property {String[]} removeSymbols Array of symbols or undefined.
 * @property {String[]} addIncludeFolders Array of paths or undefined.
 * @property {String[]} removeIncludeFolders Array of paths or undefined.
 */

class Node {
  // --------------------------------------------------------------------------

  constructor (name, parent, context) {
    // Checked by derived classes.
    this.context = context
    this.log = context.log

    this.name = name
    this.parent = parent

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files,
    // for root, folders or files.

    this.addSymbols = undefined // string[]
    this.removeSymbols = undefined // string[]

    this.addIncludeFolders = undefined // string[]
    this.removeIncludeFolders = undefined // string[]

    this.options = new NodeOptions(this, {
      log: this.log,
      from: null
    })

    // ------------------------------------------------------------------------
    // These properties will be computed and cached.

    this.absolutePathCached_ = undefined // string
    this.relativePathCached_ = undefined // string

    this.addSymbolsWithParentCached_ = undefined // []
    this.removeSymbolsWithParentCached_ = undefined // []
    this.symbolsCached_ = undefined // string[]

    this.addIncludeFoldersWithParentCached_ = undefined // []
    this.removeIncludeFoldersWithParentCached_ = undefined // []
    this.includeFoldersCached_ = undefined // string[]

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

  propertyWithParent_ (name) {
    const cachedName = `${name}WithParentCached_`
    if (!this[cachedName]) {
      if (!this[name]) {
        // Start with an empty array, or inherit from parent.
        if (!this.parent) {
          this[cachedName] = []
        } else {
          this[cachedName] = this.parent.propertyWithParent_(name)
        }
      } else {
        // Create a new array.
        this[cachedName] = []
        if (this.parent) {
          // Inherit parent array.
          this[cachedName] =
            this[cachedName].concat(
              this.parent.propertyWithParent_(name))
        }
        // Contribute the current definitions.
        this[cachedName] = this[cachedName].concat(this[name])
      }
    }
    return this[cachedName]
  }

  propertyWithAddAndRemove_ (name) {
    const log = this.log

    const namedCache = `${name}Cached_`
    const capitalisedName = Util.capitalizeFirstLetter(name)
    const addName = `add${capitalisedName}`
    const removeName = `remove${capitalisedName}`

    if (!this[namedCache]) {
      if (!this[addName] && !this[removeName]) {
        // Start with an empty array, or inherit from parent.
        if (!this.parent) {
          this[namedCache] = []
        } else {
          this[namedCache] = this.parent.propertyWithAddAndRemove_(name)
        }
      } else {
        const arr = this.propertyWithParent_(addName)
        if (arr.length) {
          log.trace(
            `node '${this.name}' add '${name}' ${arr}`)
        }
        // Create a set with all properties to be added.
        const properties = new Set(arr)

        // Remove unwanted properties from the set.
        for (const toRemove of this.propertyWithParent_(removeName)) {
          properties.delete(toRemove)
          log.trace(`node '${this.name}' remove '${name}' ${toRemove}`)
        }

        // Use the spread operator to transform a set into an Array.
        this[namedCache] = [ ...properties ]
      }
    }
    return this[namedCache]
  }

  // --------------------------------------------------------------------------

  get symbols () {
    return this.propertyWithAddAndRemove_('symbols')
  }

  get includeFolders () {
    return this.propertyWithAddAndRemove_('includeFolders')
  }

  // --------------------------------------------------------------------------

  toString () {
    if (!this.allStringCached_) {
      this.allStringCached_ = this.relativePath

      if (this.options) {
        this.allStringCached_ += ' ' + this.options
      }
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
    assert(context, 'There must be a context.')
    assert(context.log, 'There must be a context.log.')
    assert(context.cwd, 'There must be a context.cwd.')
    assert(parent instanceof FolderNode,
      'The parent must be a folder.')
    assert(Util.isString(name), 'There must be a string name.')
    assert(fileExtension, 'There must be a file extension.')
    super(name, parent, context)

    const log = this.log
    log.trace(`${this.constructor.name}.construct('${name}')`)

    this.fileExtension = fileExtension
    this.tool = fileExtension.tool
    this.shortName = name.substr(0, name.length - fileExtension.name.length - 1)

    parent.files.push(this)
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
   * @returns {String} The full command string.
   */
  get fullCommand () {
    if (!this.fullCommandString_) {
      this.fullCommandString_ = this.tool.fullCommandName

      if (this.tool.options) {
        this.fullCommandString_ += ` ${this.tool.options}`
      }
      if (this.options) {
        this.fullCommandString_ += ` ${this.options}`
      }
      if (this.symbols) {
        for (const symbol of this.symbols) {
          this.fullCommandString_ += ` -D${symbol}`
        }
      }
      if (this.includeFolders) {
        for (const folder of this.includeFolders) {
          this.fullCommandString_ += ` -I'${folder}'`
        }
      }
      if (this.tool.deps) {
        this.fullCommandString_ += ` ${this.tool.deps}`
      }
      if (this.tool.inputs) {
        this.fullCommandString_ += ` ${this.tool.inputs}`
      }
      if (this.tool.outputFlag) {
        this.fullCommandString_ += ` ${this.tool.outputFlag}`
      }
      if (this.tool.output) {
        this.fullCommandString_ += ` ${this.tool.output}`
      }

      const macroValues = {
        'node.relativePathShortName': this.relativePathShortName,
        'node.relativePathShortNameEscaped': this.relativePathShortNameEscaped,
        'node.relativePath': this.relativePath,
        'node.buildRelativePath': this.buildRelativePath,
        'toolchain.objectExtension': this.tool.toolchain.objectExtension
      }
      this.fullCommandString_ =
        Macros.substitute(this.fullCommandString_, macroValues)
    }
    return this.fullCommandString_
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
    assert(context, 'There must be a context')
    assert(context.log, 'There must be a context.log.')
    assert(context.cwd, 'There must be a context.cwd.')
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

    if (parent) {
      parent.folders.push(this)
    }
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
    assert(context, 'There must be a context.')
    assert(context.log, 'There must be a context.log.')
    assert(context.cwd, 'There must be a context.cwd.')
    assert(context.fileExtensions, 'There must be a context.fileExtensions.')
    assert(context.tool, 'There must be a context.tool.')
    assert(context.language, 'There must be a context.language.')
    super('tree', null, context)

    this.cwd = context.cwd
    this.fileExtensions = context.fileExtensions

    const log = this.log
    log.trace(`${this.constructor.name}.constructor()`)

    this.absolutePathCached_ = context.cwd
    this.tool = context.tool
    this.language = context.language

    this.folders = []
    this.files = []
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
   * @param {Node} parent The parent folder node.
   * @returns {undefined} Nothing.
   */
  async addFolder (sourceFolderAbsolutePath, parent) {
    assert(parent, 'There must be a parent.')

    const log = this.log
    log.trace(
      `${this.constructor.name}.addFolder('${sourceFolderAbsolutePath}')`)

    const context = this.context

    // Make relative and extract the first part and the rest.
    const parts = path.relative(this.cwd, sourceFolderAbsolutePath)
      .split(path.sep, 2)

    // log.trace(`parts: ${parts}`)
    const childFolder = new FolderNode(parts[0], parent, context)

    if (parts.length === 1) {
      // log.trace(`recurse ${childFolder.relativePath}`)

      // Recursively iterate files and folders below this folder.
      const absolutePath = childFolder.absolutePath
      const names = await DirCache.readdir(absolutePath)

      let toIgnore
      const toIgnoreFileName = XmakeParser.dotXmakeIgnoreFileName
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
        if (name.startsWith('.')) {
          // Ignore all names starting with a dot.
          log.trace(`ignored '${name}'`)
          continue
        }
        if (toIgnore && toIgnore.indexOf(name) !== -1) {
          // Ignore all names present in the `.xmakeignore`
          log.trace(`ignored '${name}'`)
          continue
        }
        if (stat.isDirectory()) {
          // Recurse
          await this.addFolder(name, childFolder)
        } else if (stat.isFile()) {
          // Split path into parts, to extract extension.
          const parsed = path.parse(name)
          if (!parsed.ext.startsWith('.')) {
            log.trace(`ignored '${name}'`)
            continue
          }
          // TODO: use the toolchain list, passed via the context
          const ext = parsed.ext.split('.')[1]
          if (ext) {
            const fileExtension = this.fileExtensions[ext]
            if (!fileExtension) {
              log.trace(`ignored '${name}'`)
              continue
            }
            if (fileExtension.tool.languages.indexOf(this.language) === -1) {
              log.trace(`ignored '${name}', language`)
              continue
            }
            // As a known extension, this must be a source file.
            const fileNode = new FileNode(name, childFolder,
              fileExtension, context)
            log.debug(`source file: '${fileNode.relativePath}' ` +
              `${fileExtension.tool.fullCommandName}`)
          } else {
            log.trace(`ignored '${name}'`)
          }
        }
      }
    }

    if (parts.length > 1) {
      await this.addFolder(parts[1], childFolder)
    }
  }

  set sourceFolderNodes (value) {
    const log = this.log
    for (const node of value) {
      log.trace(`src node '${node}'`)
    }

    this.sourceFolderNodesCache_ = value
  }

  get sourceFolderNodes () {
    if (!this.sourceFolderNodesCache_) {
      this.getAll_()
    }
    return this.sourceFolderNodesCache_
  }

  set tools (value) {
    const log = this.log
    for (const tool of value) {
      log.trace(`tool '${tool}'`)
    }

    this.toolsCache_ = value
  }

  get tools () {
    if (!this.toolsCache_) {
      this.getAll_()
    }

    return this.toolsCache_
  }

  set objs (value) {
    const log = this.log
    for (const obj of value) {
      log.trace(`obj '${obj}'`)
    }

    this.objsCache_ = value
  }

  get objs () {
    if (!this.objsCache_) {
      this.getAll_()
    }
    return this.objsCache_
  }

  getAll_ () {
    const out = {
      sourceFolderNodes: [],
      objs: [],
      tools: new Set()
    }
    this.getAllRecursive_(this, out)

    this.sourceFolderNodes = out.sourceFolderNodes
    this.objs = out.objs

    out.tools.add(this.tool)
    this.tools = [ ...out.tools ].sort()
  }

  getAllRecursive_ (node, out) {
    if (node.files.length > 0) {
      out.sourceFolderNodes.push(node)

      for (const file of node.files) {
        out.objs.push(file.relativePathShortName + '.' +
          file.tool.toolchain.objectExtension)
        out.tools.add(file.tool)
      }
    }
    for (const folder of node.folders) {
      this.getAllRecursive_(folder, out)
    }
  }

  makePosixPathsRelative_ (fromPath, inputPaths) {
    const relativePaths = []
    for (const inputPath of inputPaths) {
      relativePaths.push(path.posix.relative(fromPath, inputPath))
    }
    return relativePaths
  }

  addRootProperties (buildConfiguration) {
    this.log.trace(`node '${this.name}' ` +
      `add ${buildConfiguration.addSymbols}`)
    this.addSymbols = buildConfiguration.addSymbols
    this.log.trace(`node '${this.name}' ` +
      `remove ${buildConfiguration.removeSymbols}`)
    this.removeSymbols = buildConfiguration.removeSymbols

    // Make the include paths relative.
    const addIncludeRelativePaths = this.makePosixPathsRelative_(
      buildConfiguration.buildAbsolutePath,
      buildConfiguration.addIncludeFolders
    )
    this.log.trace(`node '${this.name}' ` +
      `add 'includeFolders' ${addIncludeRelativePaths}`)
    this.addIncludeFolders = addIncludeRelativePaths
    const removeIncludeRelativePaths = this.makePosixPathsRelative_(
      buildConfiguration.buildAbsolutePath,
      buildConfiguration.removeIncludeFolders
    )
    this.log.trace(`node '${this.name}' ` +
      `remove 'includeFolders' ${removeIncludeRelativePaths}`)
    this.removeIncludeFolders = removeIncludeRelativePaths

    this.buildRelativePath = path.posix.relative(
      buildConfiguration.buildAbsolutePath,
      buildConfiguration.buildContext.cwd)

    this.artefact = buildConfiguration.artefact

    this.options = new NodeOptions(this, {
      log: this.log,
      from: buildConfiguration.options
    })
  }

  /**
   * @summary Get the full command string.
   * @returns {String} The full command string.
   */
  get fullCommand () {
    if (!this.fullCommandString_) {
      this.fullCommandString_ = this.tool.fullCommandName

      if (this.tool.options) {
        this.fullCommandString_ += ` ${this.tool.options}`
      }
      if (this.options) {
        this.fullCommandString_ += ` ${this.options}`
      }
      for (const obj of this.objs) {
        this.fullCommandString_ += ` '${obj}'`
      }
      if (this.tool.outputFlag) {
        this.fullCommandString_ += ` ${this.tool.outputFlag}`
      }
      if (this.tool.output) {
        this.fullCommandString_ += ` ${this.tool.output}`
      }

      const macroValues = {
        'artefact.fullName': `${this.artefact.fullName}`
      }
      this.fullCommandString_ =
        Macros.substitute(this.fullCommandString_, macroValues)
    }
    return this.fullCommandString_
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.FileNode = FileNode
module.exports.FolderNode = FolderNode
module.exports.SourceTree = SourceTree
// module.exports.fileExtensions = fileExtensions

// In ES6, it would be:
// export class FileNode { ... }
// ...
// import { FileNode, FolderNode, SourceTree } from 'utils/source-tree.js'

// ----------------------------------------------------------------------------
