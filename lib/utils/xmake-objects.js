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
 * Classes to store the data parsed from xmake.json.
 * The purpose is to decouple the JSON configuration from the internal
 * data model, in order to accommodate multiple schema versions.
 *
 * Most objects include lots of empty arrays, providing default value
 * to properties.
 *
 * TODO: rename BuildZZZ -> XmakeZZZ
 */

// ----------------------------------------------------------------------------

const assert = require('assert')

const Util = require('./util.js').Util
const Toolchain = require('./toolchain.js').Toolchain
const Tool = require('./toolchain.js').Tool

// ============================================================================

/**
 * @typedef {Object} XmakeProject
 * @property {Object} json The original xmake.json.
 * @property {String} name Optional name; may be undefined.
 * @property {XmakeBuildConfiguration[]} buildConfigurations Array of build
 *  configurations (for main and tests).
 * @property {Object[]} builders Array of builders.
 * @property {String} builderName The builder name.
 * @property {Object} builder The chosen builder.
 * @property {String} projectName The project name.
 * @property {XmakeSources} sources Object with absolute paths to
 *  source folders.
 * @property {XmakeArtefact} artefact Artefact.
 * @property {String} language A string defining the language ['c', 'c++'].
 * @property {Object} folders Object with XmakeFolder properties.
 * @property {Object} files Object with XmakeFile properties.
 * @property {Object} targetPlatforms Object with target platforms properties.
 * @property {Object} optionGroups Object with groups properties.
 * @property {String} cwd Current project absolute path.
 */

class XmakeProject {
  constructor () {
    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.json = {}

    // The object with buildConfigurations is mandatory.
    this.buildConfigurations = {}

    this.targetPlatforms = {}
    this.optionGroups = {}

    this.sources = undefined

    // Map of names to array of strings.
    this.commands = {}
  }
}

// ============================================================================

/**
 * @typedef {Object} XmakeBuildConfiguration
 * @property {String} name The configuration name.
 * @property {XmakeArtefact} artefact
 * @property {XmakeSources} sourceFolders Object with absolute paths to
 *  source folders.
 * @property {XmakeIncludes} includes Object with absolute paths to
 *
 * @todo Add more properties.
 */

class XmakeBuildConfiguration {
  constructor (name) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    this.clear()
  }

  clear () {
    this.targetPlatform = undefined
    this.toolchain = undefined
    this.optionGroups = []
  }
}

// ============================================================================

/**
 * @typedef {Object} XmakeFolder
 * @property {String} name The folder relative path (POSIX).
 * @property {XmakeIncludes} includes The include folders and files.
 * @property {XmakeSymbols} symbols The symbols.
 * @property {XmakeToolchainsOptions} toolchainsOptions The toolchains options.
 * @property {Node} node A reference to the source tree node, placed here
 * later, while constructing the source tree.
 */

class XmakeFolder {
  constructor (xmakeFolder) {
    assert(Util.isObject(xmakeFolder))
    assert(Util.isString(xmakeFolder.name), 'There must be a string name.')
    this.name = xmakeFolder.name

    if (xmakeFolder.doMoveAll) {
      this.includes = xmakeFolder.includes
      xmakeFolder.includes = undefined
      this.symbols = xmakeFolder.symbols
      xmakeFolder.symbols = undefined
    } else {
      // Make copies, do not use the originals.
      this.includes = new XmakeIncludes(xmakeFolder.includes)
      this.symbols = new XmakeSymbols(xmakeFolder.symbols)
    }

    if (xmakeFolder.toolchain) {
      // When building for a specific buildConfiguration, restrict to
      // a single toolchain.
      this.toolchain = xmakeFolder.toolchain
      if (xmakeFolder.doMoveAll) {
        this.toolchainOptions =
          new XmakeToolchainOptions({
            ...xmakeFolder.toolchainOptions,
            toolchain: xmakeFolder.toolchain,
            doMoveAll: true
          })
        xmakeFolder.toolchainOptions = undefined
      } else {
        this.toolchainOptions =
          new XmakeToolchainOptions({
            ...xmakeFolder.toolchainOptions,
            toolchain: xmakeFolder.toolchain
          })
      }
    } else {
      this.toolchainsOptions =
        new XmakeToolchainsOptions(xmakeFolder.toolchainsOptions)
    }
  }

  clear () {
    this.includes = new XmakeIncludes()
    this.symbols = new XmakeSymbols()

    if (this.toolchain) {
      this.toolchainOptions = new XmakeToolchainOptions({
        toolchain: this.toolchain
      })
    } else {
      this.toolchainsOptions = new XmakeToolchainsOptions()
    }
  }

  appendFrom (xmakeFolder) {
    assert(xmakeFolder instanceof XmakeFolder)

    this.includes.appendFrom(xmakeFolder.includes)
    this.symbols.appendFrom(xmakeFolder.symbols)

    if (this.toolchainOptions) {
      if (xmakeFolder.toolchainOptions) {
        this.toolchainOptions.appendFrom(xmakeFolder.toolchainOptions)
      } else {
        this.toolchainOptions.appendFrom(xmakeFolder.toolchainsOptions)
      }
    } else {
      this.toolchainsOptions.appendFrom(xmakeFolder.toolchainsOptions)
    }
  }
}

// ============================================================================

/**
 * @typedef {Object} XmakeFile
 * @property {String} name The file relative path (POSIX).
 * @property {XmakeIncludes} includes The include folders and files.
 * @property {XmakeSymbols} symbols The symbols.
 * @property {XmakeToolchainsOptions} toolchainsOptions The toolchains options.
 * @property {Node} node A reference to the source tree node, placed here
 * later, while constructing the source tree.
 */

class XmakeFile {
  constructor (xmakeFile) {
    assert(Util.isObject(xmakeFile))
    assert(Util.isString(xmakeFile.name), 'There must be a string name.')
    this.name = xmakeFile.name

    if (xmakeFile.doMoveAll) {
      this.includes = xmakeFile.includes
      xmakeFile.includes = undefined
      this.symbols = xmakeFile.symbols
      xmakeFile.symbols = undefined
    } else {
      // Make copies, do not use the originals.
      this.includes = new XmakeIncludes(xmakeFile.includes)
      this.symbols = new XmakeSymbols(xmakeFile.symbols)
    }

    if (xmakeFile.toolchain) {
      // When building for a specific buildConfiguration, restrict to
      // a single toolchain.
      this.toolchain = xmakeFile.toolchain
      if (xmakeFile.doMoveAll) {
        this.toolchainOptions = new XmakeToolchainOptions({
          ...xmakeFile.toolchainOptions,
          toolchain: xmakeFile.toolchain,
          doMoveAll: true
        })
        xmakeFile.toolchainOptions = undefined
      } else {
        this.toolchainOptions = new XmakeToolchainOptions({
          ...xmakeFile.toolchainOptions,
          toolchain: xmakeFile.toolchain
        })
      }
    } else {
      this.toolchainsOptions =
        new XmakeToolchainsOptions(xmakeFile.toolchainsOptions)
    }
  }

  clear () {
    this.includes = new XmakeIncludes()
    this.symbols = new XmakeSymbols()

    if (this.toolchain) {
      this.toolchainOptions = new XmakeToolchainOptions({
        toolchain: this.toolchain
      })
    } else {
      this.toolchainsOptions = new XmakeToolchainsOptions()
    }
  }

  appendFrom (xmakeFile) {
    assert(xmakeFile instanceof XmakeFile)

    this.includes.appendFrom(xmakeFile.includes)
    this.symbols.appendFrom(xmakeFile.symbols)

    if (this.toolchainOptions) {
      if (xmakeFile.toolchainOptions) {
        this.toolchainOptions.appendFrom(xmakeFile.toolchainOptions)
      } else {
        this.toolchainOptions.appendFrom(xmakeFile.toolchainsOptions)
      }
    } else {
      this.toolchainsOptions.appendFrom(xmakeFile.toolchainsOptions)
    }
  }
}

// ============================================================================

/**
 * @summary Utility functions, used in various classes.
 */
class Base {
  constructor () {
    this.cache_ = {}
  }

  copyArrays_ (from, names) {
    for (const name of names) {
      if (from[name] && from[name].length !== 0) {
        // Make a copy, do not use original.
        if (from.doMoveAll) {
          this[name] = from[name]
          from[name] = undefined
        } else {
          this[name] = [...from[name]]
        }
      } else {
        this[name] = []
      }
    }
  }

  appendArrays_ (from, names) {
    for (const name of names) {
      if (from[name] && from[name].length !== 0) {
        this[name] = [...this[name], ...from[name]]
      }
    }
  }

  collectArray_ (propertyName) {
    let str = ''
    for (const value of this[propertyName]) {
      if (str.length) {
        str += ' '
      }
      str += value
    }

    return str
  }
}

// ============================================================================

/**
 * @typedef {Object} XmakeSources
 * @property {String[]} addSourceFolders Array of absolute paths to
 *  source folders.
 * @property {String[]} removeSourceFolders Array of absolute paths to
 *  source folders.
 */

class XmakeSources extends Base {
  constructor (sources = {}) {
    super()
    this.copyArrays_(sources, XmakeSources.properties)
  }

  appendFrom (sources) {
    assert(sources instanceof XmakeSources)
    this.appendArrays_(sources, XmakeSources.properties)
  }

  toString () {
    const addSourceFolders = this.collectArray_('addSourceFolders')
    const removeSourceFolders = this.collectArray_('removeSourceFolders')
    let str = ''
    str += `add '${addSourceFolders}' remove '${removeSourceFolders}'`

    return str
  }
}

XmakeSources.properties = [
  'addSourceFolders',
  'removeSourceFolders'
]

// ============================================================================

/**
 * @typedef {Object} XmakeSymbols
 * @property {String[]} addSymbols Array of symbols to add, or undefined.
 * @property {String[]} removeSymbols Array of symbols to remove, or undefined.
 */

class XmakeSymbols extends Base {
  constructor (symbols = {}) {
    super()
    this.copyArrays_(symbols, XmakeSymbols.properties)
  }

  appendFrom (symbols) {
    assert(symbols instanceof XmakeSymbols)
    this.appendArrays_(symbols, XmakeSymbols.properties)
  }

  toString () {
    const addSymbols = this.collectArray_('addSymbols')
    const removeSymbols = this.collectArray_('removeSymbols')
    let str = ''
    str += `add '${addSymbols}' remove '${removeSymbols}'`

    return str
  }
}

XmakeSymbols.properties = [
  'addSymbols',
  'removeSymbols'
]

// ============================================================================

/**
 * @typedef {Object} XmakeIncludes
 * @property {String[]} addIncludeFolders Array of absolute paths to
 *  include folders.
 * @property {String[]} removeIncludeFolders Array of absolute paths to
 *  include folders.
 * @property {String[]} addIncludeSystemFolders Array of absolute paths to
 *  include system folders.
 * @property {String[]} removeIncludeSystemFolders Array of absolute paths to
 *  include system folders.
 * @property {String[]} addIncludeFiles Array of absolute paths to
 *  include files.
 * @property {String[]} removeIncludeFiles Array of absolute paths to
 *  include files.
 */

class XmakeIncludes extends Base {
  constructor (includes = {}) {
    super()
    this.copyArrays_(includes, XmakeIncludes.properties)
  }

  appendFrom (includes) {
    assert(includes instanceof XmakeIncludes)
    this.appendArrays_(includes, XmakeIncludes.properties)
  }

  appendPosixRelative (fromPath, includes) {
    assert(includes instanceof XmakeIncludes)

    for (const name of XmakeIncludes.properties) {
      if (includes[name] && includes[name].length !== 0) {
        this[name] = this[name].concat(
          Util.toPosixRelativePath(fromPath, includes[name]))
      }
    }
  }

  toString () {
    const addIncludeFolders = this.collectArray_('addIncludeFolders')
    const removeIncludeFolders = this.collectArray_('removeIncludeFolders')
    const addIncludeSystemFolders =
      this.collectArray_('addIncludeSystemFolders')
    const removeIncludeSystemFolders =
      this.collectArray_('removeIncludeSystemFolders')
    const addIncludeFiles = this.collectArray_('addIncludeFiles')
    const removeIncludeFiles = this.collectArray_('removeIncludeFiles')
    let str = ''
    str += `IncludeFolders:`
    str += ` add '${addIncludeFolders}'`
    str += ` remove '${removeIncludeFolders}'`
    str += ` IncludeSystemFolders:`
    str += ` add '${addIncludeSystemFolders}'`
    str += ` remove '${removeIncludeSystemFolders}'`
    str += ` IncludeFiles:`
    str += ` add '${addIncludeFiles}'`
    str += ` remove '${removeIncludeFiles}'`

    return str
  }
}

XmakeIncludes.properties = [
  'addIncludeFolders', 'removeIncludeFolders',
  'addIncludeSystemFolders', 'removeIncludeSystemFolders',
  'addIncludeFiles', 'removeIncludeFiles'
]

// ============================================================================

/**
 * @typedef {Object} XmakeArtefact
 * @property {String} type The artefact type, one of
 *  [ 'executable', 'staticLib', 'sharedLib' ]
 * @property {String} name The artefact name.
 * @property {String} outputPrefix The artefact prefix.
 * @property {String} outputSuffix The artefact suffix.
 * @property {String} extension The artefact extension, without dot.
 * @property {String} fullName The artefact name with prefix, suffix
 *  and extension, ready to use as a file name.
 */

class XmakeArtefact {
  constructor (artefact = undefined) {
    this.fillFrom(artefact)

    this.fullNameWithExtension_ = undefined
  }

  /**
   * @summary Fill-in missing fields.
   *
   * @param {Object} artefact Source object to copy from.
   * @returns {undefined} Nothing.
   */
  fillFrom (artefact) {
    if (artefact) {
      if (!this.type) {
        this.type = artefact.type
      }
      if (!this.name) {
        this.name = artefact.name
      }
      // The explicit test is used to avoid overriding empty strings.
      if (this.outputPrefix === undefined) {
        this.outputPrefix = artefact.outputPrefix
      }
      if (this.outputSuffix === undefined) {
        this.outputSuffix = artefact.outputSuffix
      }
      if (this.extension === undefined) {
        this.extension = artefact.extension
      }
    }
  }

  get fullName () {
    if (!this.fullNameWithExtension_) {
      this.fullNameWithExtension_ =
        (this.outputPrefix || '') +
        this.name +
        (this.outputSuffix || '')
      if (this.extension && this.extension.length > 0) {
        this.fullNameWithExtension_ += '.' + this.extension
      }
    }
    return this.fullNameWithExtension_
  }

  toString () {
    const str = `${this.type} ` +
      `[${this.outputPrefix}]${this.name}[${this.outputPrefix}].` +
      `${this.extension}`
    return str
  }
}

XmakeArtefact.types = [
  'executable',
  'staticLib',
  'sharedLib'
]

// ============================================================================

class XmakeTargetPlatform {
  constructor (targetPlatform) {
    assert(Util.isObject(targetPlatform))
    assert(Util.isString(targetPlatform.name), 'There must be a string name.')
    this.name = targetPlatform.name

    if (targetPlatform.doMoveAll) {
      // Use the originals.
      this.sources = targetPlatform.sources
      targetPlatform.sources = undefined
      this.includes = targetPlatform.includes
      targetPlatform.includes = undefined
      this.symbols = targetPlatform.symbols
      targetPlatform.symbols = undefined
      this.toolchainsOptions = targetPlatform.toolchainsOptions
      targetPlatform.toolchainsOptions = undefined
      this.targetArtefact = targetPlatform.targetArtefact
      targetPlatform.targetArtefact = undefined
    } else {
      // Make copies, do not use the originals.
      this.sources = new XmakeSources(targetPlatform.sources)
      this.includes = new XmakeIncludes(targetPlatform.includes)
      this.symbols = new XmakeSymbols(targetPlatform.symbols)
      this.toolchainsOptions =
        new XmakeToolchainsOptions(targetPlatform.toolchainsOptions)
      this.targetArtefact = new XmakeArtefact(targetPlatform.targetArtefact)
    }
    this.language = targetPlatform.language
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.sources = new XmakeSources()
    this.includes = new XmakeIncludes()
    this.symbols = new XmakeSymbols()
    this.toolchainsOptions = new XmakeToolchainsOptions()
    this.targetArtefact = new XmakeArtefact()
    this.language = undefined
  }
}

// ============================================================================

class XmakeOptionGroup {
  constructor (optionGroup) {
    assert(Util.isObject(optionGroup))
    assert(Util.isString(optionGroup.name), 'There must be a string name.')
    this.name = optionGroup.name

    if (optionGroup.doMoveAll) {
      this.sources = optionGroup.sources
      optionGroup.source = undefined
      this.includes = optionGroup.includes
      optionGroup.includes = undefined
      this.symbols = optionGroup.symbols
      optionGroup.symbols = undefined
      this.toolchainsOptions = optionGroup.toolchainsOptions
      optionGroup.toolchainsOptions = undefined
      this.targetArtefact = optionGroup.targetArtefact
      optionGroup.targetArtefact = undefined
    } else {
      this.sources = new XmakeSources(optionGroup.sources)
      this.includes = new XmakeIncludes(optionGroup.includes)
      this.symbols = new XmakeSymbols(optionGroup.symbols)
      this.toolchainsOptions =
        new XmakeToolchainsOptions(optionGroup.toolchainsOptions)
      this.targetArtefact = new XmakeArtefact(optionGroup.targetArtefact)
    }
    this.language = optionGroup.language
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.sources = new XmakeSources()
    this.includes = new XmakeIncludes()
    this.symbols = new XmakeSymbols()
    this.toolchainsOptions = new XmakeToolchainsOptions()
    this.targetArtefact = new XmakeArtefact()
    this.language = undefined
  }
}

// ============================================================================

/**
 * @typedef {Object} XmakeCommonOptions
 * @property {String[]} suffixes Array of property suffixes.
 *
 * @description
 * The constructor adds `addSuffix` and `removeSuffix` properties for all
 * available suffixes, as empty arrays.
 *
 * If available, the constructor also concatenates corresponding properties
 * from the input object, which might be a json or another XmakeToolOptions.
 */

class XmakeCommonOptions {
  constructor (commonOptions) {
    assert(commonOptions)
    assert(Array.isArray(commonOptions.suffixes),
      'There must be an array of suffixes.')
    this.suffixes = commonOptions.suffixes

    for (const suffix of this.suffixes) {
      for (const prefix of ['add', 'remove']) {
        const property = prefix + suffix
        if (commonOptions[property] && commonOptions[property].length !== 0) {
          if (commonOptions.doMoveAll) {
            this[property] = commonOptions[property]
            commonOptions[property] = undefined
          } else {
            // Make a copy.
            this[property] = [...commonOptions[property]]
          }
        } else {
          this[property] = []
        }
      }
    }
  }

  clear () {
    for (const suffix of this.suffixes) {
      for (const prefix of ['add', 'remove']) {
        const property = prefix + suffix
        this[property] = []
      }
    }
  }

  appendFrom (from) {
    if (from) {
      for (const suffix of this.suffixes) {
        for (const prefix of ['add', 'remove']) {
          const property = prefix + suffix
          if (from[property] && from[property].length !== 0) {
            // Concatenate new to existing (actually create a new array).
            this[property] = [...this[property], ...from[property]]
          }
        }
      }
    }
  }

  /**
   * @summary Check if any of the properties is not empty.
   *
   * @returns {boolean} True if the node has content.
   */
  hasContent () {
    for (const suffix of this.suffixes) {
      for (const prefix of ['add', 'remove']) {
        const property = prefix + suffix
        if (this[property] && this[property].length !== 0) {
          return true
        }
      }
    }
    return false
  }

  toString () {
    const addOptions = this.collectArrayFromPrefix_('add')
    const removeOptions = this.collectArrayFromPrefix_('remove')
    let str = ''
    str += `add '${addOptions}' remove '${removeOptions}'`

    return str
  }

  collectArrayFromPrefix_ (prefix) {
    let str = ''
    if (this.suffixes) {
      for (const suffix of this.suffixes) {
        const options = this[prefix + suffix] || ''
        for (const option of options) {
          if (str.length) {
            str += ' '
          }
          str += option
        }
      }
    }
    return str
  }
}

// ============================================================================

class XmakeToolOptions extends XmakeCommonOptions {
  constructor (toolOptions) {
    assert(toolOptions)
    assert(toolOptions.tool instanceof Tool, 'There must be a Tool.')
    super({
      suffixes: toolOptions.tool.configurationSuffixes,
      ...toolOptions
    })

    this.tool = toolOptions.tool
  }
}

// ============================================================================

/**
 * @typedef {Object} XmakeToolchainOptions
 * @property {XmakeCommonOptions} commonOptions Object with options common
 * to all tools.
 * @property {Object} tools Object with XmakeToolOptions properties, by name.
 * @property {Toolchain} toolchain Reference to the toolchain.
 *
 * @description
 * Maintains a map of tool options, corresponding to the
 * `toolOptions` configuration object.
 */

class XmakeToolchainOptions {
  constructor (toolchainOptions) {
    assert(toolchainOptions.toolchain instanceof Toolchain,
      'There must be a toolchain.')
    this.toolchain = toolchainOptions.toolchain

    // Keep the common options separate for now, will be merged
    // later when building the source tree.
    this.commonOptions = new XmakeCommonOptions({
      suffixes: this.toolchain.configurationSuffixes,
      // The source options may be undefined.
      ...toolchainOptions.commonOptions,
      doMoveAll: toolchainOptions.doMoveAll
    })

    this.tools = {}
    if (toolchainOptions.tools) {
      assert(Util.isObject(toolchainOptions.tools))
      // Enumerate the toolchain tools, not the source tools,
      // to guarantee all tools are present.
      for (const toolName of Object.keys(this.toolchain.tools)) {
        this.tools[toolName] = new XmakeToolOptions({
          tool: this.toolchain.tools[toolName],
          // The source tool may be undefined.
          ...toolchainOptions.tools[toolName],
          doMoveAll: toolchainOptions.doMoveAll
        })
      }
    }
  }

  add (toolName, toolOptions) {
    assert(Util.isString(toolName))
    assert(toolOptions instanceof XmakeToolOptions)
    this.tools[toolName] = toolOptions
  }

  /**
   * @summary Collect options from all toolchains that match.
   * @param {Objectns} options Toolchain(s) options.
   * @returns {undefined} Nothing.
   *
   * @description
   * From the possibly multiple toolchains available,
   * identify only those related to the current toolchain (same or parent).
   * Append options to the specific arrays, for each separate tool.
   */
  appendFrom (options) {
    // The input can be either a multi ToolchainsOptions or a single
    // ToolchainOption.
    if (options.toolchains) {
      // The multi-toolchains case.
      for (const toolchainOptions of
        Object.values(options.toolchains)) {
        this.appendFrom(toolchainOptions)
      }
    } else {
      // The single toolchain case.
      assert(this.toolchain, 'There must be a toolchain.')
      if (this.toolchain.instanceOf(options.toolchain)) {
        // Keep the common options separate for now, will be merged
        // later when building the source tree.
        this.commonOptions.appendFrom(options.commonOptions)

        // Enumerate the current toolchain tools, not the source tools.
        for (const toolName of Object.keys(this.toolchain.tools)) {
          if (!this.tools.hasOwnProperty(toolName)) {
            this.tools[toolName] =
              new XmakeToolOptions({
                tool: this.toolchain.tools[toolName]
              })
          }
          if (options.tools.hasOwnProperty(toolName)) {
            this.tools[toolName].appendFrom(options.tools[toolName])
          }
        }
      }
    }
  }

  toString () {
    let str = ''
    for (const [toolName, toolOptions] of Object.entries(this.tools)) {
      if (str.length) {
        str += ', '
      }
      str += `${toolName}: ${toolOptions}`
    }
    return str
  }
}

// ============================================================================

/**
 * @typedef {Object} XmakeToolchainsOptions
 * @property {Object} toolchains Object with XmakeToolchainOptions properties,
 * by name.
 *
 * @description
 * Maintains a map of toolchain options, corresponding to the
 * `toolchainOptions` configuration object.
 *
 * When called with the `toolchain` property, it maintaines a single entry,
 * which collects definitions from all available toolchains.
 */

class XmakeToolchainsOptions {
  constructor (toolchainsOptions = {}) {
    this.clear()
    if (toolchainsOptions.toolchains) {
      if (!toolchainsOptions.toolchain) {
        // Copy all toolchains.
        for (const [toolchainName, toolchainOptions] of
          Object.entries(toolchainsOptions.toolchains)) {
          this.toolchains[toolchainName] =
            new XmakeToolchainOptions(toolchainOptions)
        }
      } else {
        // Create a single toolchain from all other.
        const toolchainName = toolchainsOptions.toolchain.name
        this.toolchains[toolchainName] = new XmakeToolchainOptions({
          toolchain: toolchainsOptions.toolchain
        })
        // Must set the toolchain member before, it is used in `appendFrom()`.
        this.toolchain = toolchainsOptions.toolchain
        this.toolchains[toolchainName].appendFrom(toolchainsOptions)
      }
    }
  }

  clear () {
    this.toolchains = {}
  }

  add (toolchainName, toolchainOptions) {
    assert(Util.isString(toolchainName))
    assert(toolchainOptions instanceof XmakeToolchainOptions)
    this.toolchains[toolchainName] = toolchainOptions
  }

  appendFrom (toolchainsOptions) {
    assert(toolchainsOptions instanceof XmakeToolchainsOptions)

    if (!this.toolchains) {
      for (const [toolchainName, toolchainOptions] of
        Object.entries(toolchainsOptions.toolchains)) {
        this.toolchains[toolchainName].appendFrom(toolchainOptions)
      }
    } else {
      const toolchainName = this.toolchain.name
      this.toolchains[toolchainName].appendFrom(toolchainsOptions)
    }
  }
}

// ============================================================================

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.XmakeProject = XmakeProject
module.exports.XmakeBuildConfiguration = XmakeBuildConfiguration
module.exports.XmakeFolder = XmakeFolder
module.exports.XmakeFile = XmakeFile
module.exports.XmakeSymbols = XmakeSymbols
module.exports.XmakeIncludes = XmakeIncludes
module.exports.XmakeSources = XmakeSources
module.exports.XmakeArtefact = XmakeArtefact
module.exports.XmakeTargetPlatform = XmakeTargetPlatform
module.exports.XmakeOptionGroup = XmakeOptionGroup
module.exports.XmakeToolOptions = XmakeToolOptions
module.exports.XmakeCommonOptions = XmakeCommonOptions
module.exports.XmakeToolchainOptions = XmakeToolchainOptions
module.exports.XmakeToolchainsOptions = XmakeToolchainsOptions

// In ES6, it would be:
// export class FileNode { ... }
// ...
// import { XmakeBuildConfiguration } from 'utils/xmake-objects.js'

// ----------------------------------------------------------------------------
