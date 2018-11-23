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
 * Classes to manage the build configurations.
 *
 */

// ----------------------------------------------------------------------------

const assert = require('assert')

const Util = require('./util.js').Util
const Toolchain = require('./toolchain.js').Toolchain
const Tool = require('./toolchain.js').Tool

// ============================================================================

/**
 * @typedef {Object} BuildProject
 * @property {Object} json The original xmake.json.
 * @property {String} name Optional name; may be undefined.
 * @property {BuildConfiguration[]} buildConfigurations Array of build
 *  configurations (for main and tests).
 * @property {Object[]} builders Array of builders.
 * @property {String} builderName The builder name.
 * @property {Object} builder The chosen builder.
 * @property {String} projectName The project name.
 * @property {BuildSources} sources Object with absolute paths to
 *  source folders.
 * @property {BuildArtefact} artefact Artefact.
 * @property {String} language A string defining the language ['c', 'c++'].
 * @property {Object} folders Object with BuildFolder properties.
 * @property {Object} files Object with BuildFile properties.
 * @property {Object} targetPlatforms Object with target platforms properties.
 * @property {Object} optionGroups Object with groups properties.
 */

class BuildProject {
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
 * @typedef {Object} BuildConfiguration
 * @property {String} name The configuration name.
 * @property {BuildArtefact} artefact
 * @property {BuildSources} sourceFolders Object with absolute paths to
 *  source folders.
 * @property {BuildIncludes} includes Object with absolute paths to
 *
 * @todo Add more properties.
 */

class BuildConfiguration {
  constructor (name) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.targetPlatform = undefined
    this.toolchain = undefined
    this.optionGroups = []
  }
}

// ============================================================================

/**
 * @typedef {Object} BuildFolder
 * @property {String} name The folder relative path (POSIX).
 * @property {BuildIncludes} includes The include folders and files.
 * @property {BuildSymbols} symbols The symbols.
 * @property {BuildToolchainsOptions} toolchainsOptions The toolchains options.
 */

class BuildFolder {
  constructor (name, includes, symbols, toolchainsOptions) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    this.includes = includes || new BuildIncludes()
    this.symbols = symbols || new BuildSources()
    this.toolchainsOptions = toolchainsOptions || new BuildToolchainsOptions()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties will be set from configuration files.

    this.includes = new BuildIncludes()
    this.symbols = new BuildSources()
    this.toolchainsOptions = new BuildToolchainsOptions()
  }
}

// ============================================================================

/**
 * @typedef {Object} BuildFile
 * @property {String} name The file relative path (POSIX).
 * @property {BuildIncludes} includes The include folders and files.
 * @property {BuildSymbols} symbols The symbols.
 * @property {BuildToolchainsOptions} toolchainsOptions The toolchains options.
 */

class BuildFile {
  constructor (name, includes, symbols, toolchainsOptions) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    this.includes = includes || new BuildIncludes()
    this.symbols = symbols || new BuildSources()
    this.toolchainsOptions = toolchainsOptions || new BuildToolchainsOptions()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties will be set from configuration files.

    this.includes = new BuildIncludes()
    this.symbols = new BuildSources()
    this.toolchainsOptions = new BuildToolchainsOptions()
  }
}

// ============================================================================

/**
 * @typedef {Object} BuildSources
 * @property {String[]} addSourceFolders Array of absolute paths to
 *  source folders.
 * @property {String[]} removeSourceFolders Array of absolute paths to
 *  source folders.
 */

class BuildSources {
  constructor (addSourceFolders, removeSourceFolders) {
    this.addSourceFolders = addSourceFolders || []
    this.removeSourceFolders = removeSourceFolders || []
  }

  append (sources) {
    assert(sources instanceof BuildSources)
    if (sources.addSourceFolders.length) {
      this.addSourceFolders = this.addSourceFolders.concat(
        sources.addSourceFolders)
    }
    if (sources.removeSourceFolders.length) {
      this.removeSourceFolders = this.removeSourceFolders.concat(
        sources.removeSourceFolders)
    }
  }

  toString () {
    const addSourceFolders = this.collect_('addSourceFolders')
    const removeSourceFolders = this.collect_('removeSourceFolders')
    let str = ''
    str += `add '${addSourceFolders}' remove '${removeSourceFolders}'`

    return str
  }

  collect_ (property) {
    let str = ''
    for (const value of this[property]) {
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
 * @typedef {Object} BuildSymbols
 * @property {String[]} addSymbols Array of symbols to add, or undefined.
 * @property {String[]} removeSymbols Array of symbols to remove, or undefined.
 */

class BuildSymbols {
  constructor (addSymbols, removeSymbols) {
    this.addSymbols = addSymbols || []
    this.removeSymbols = removeSymbols || []
  }

  append (symbols) {
    assert(symbols instanceof BuildSymbols)

    for (const name of BuildSymbols.properties) {
      if (symbols[name].length) {
        this[name] = this[name].concat(symbols[name])
      }
    }
  }

  toString () {
    const addSymbols = this.collect_('addSymbols')
    const removeSymbols = this.collect_('removeSymbols')
    let str = ''
    str += `add '${addSymbols}' remove '${removeSymbols}'`

    return str
  }

  collect_ (property) {
    let str = ''
    for (const value of this[property]) {
      if (str.length) {
        str += ' '
      }
      str += value
    }

    return str
  }
}

BuildSymbols.properties = [
  'addSymbols',
  'removeSymbols'
]

// ============================================================================

/**
 * @typedef {Object} BuildIncludes
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

class BuildIncludes {
  constructor (addIncludeFolders, removeIncludeFolders,
    addIncludeSystemFolders, removeIncludeSystemFolders,
    addIncludeFiles, removeIncludeFiles) {
    this.addIncludeFolders = addIncludeFolders || []
    this.removeIncludeFolders = removeIncludeFolders || []
    this.addIncludeSystemFolders = addIncludeSystemFolders || []
    this.removeIncludeSystemFolders = removeIncludeSystemFolders || []
    this.addIncludeFiles = addIncludeFiles || []
    this.removeIncludeFiles = removeIncludeFiles || []
  }

  append (includes) {
    assert(includes instanceof BuildIncludes)

    for (const name of BuildIncludes.properties) {
      if (includes[name].length) {
        this[name] = this[name].concat(includes[name])
      }
    }
  }

  appendPosixRelative (fromPath, includes) {
    assert(includes instanceof BuildIncludes)

    for (const name of BuildIncludes.properties) {
      if (includes[name].length) {
        this[name] = this[name].concat(
          Util.toPosixRelativePath(fromPath, includes[name]))
      }
    }
  }

  toString () {
    const addIncludeFolders = this.collect_('addIncludeFolders')
    const removeIncludeFolders = this.collect_('removeIncludeFolders')
    const addIncludeSystemFolders = this.collect_('addIncludeSystemFolders')
    const removeIncludeSystemFolders =
      this.collect_('removeIncludeSystemFolders')
    const addIncludeFiles = this.collect_('addIncludeFiles')
    const removeIncludeFiles = this.collect_('removeIncludeFiles')
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

  collect_ (property) {
    let str = ''
    for (const value of this[property]) {
      if (str.length) {
        str += ' '
      }
      str += value
    }

    return str
  }
}

BuildIncludes.properties = [
  'addIncludeFolders', 'removeIncludeFolders',
  'addIncludeSystemFolders', 'removeIncludeSystemFolders',
  'addIncludeFiles', 'removeIncludeFiles'
]

// ============================================================================

/**
 * @typedef {Object} BuildArtefact
 * @property {String} type The artefact type, one of
 *  [ 'executable', 'staticLib', 'sharedLib' ]
 * @property {String} name The artefact name.
 * @property {String} outputPrefix The artefact prefix.
 * @property {String} outputSuffix The artefact suffix.
 * @property {String} extension The artefact extension, without dot.
 * @property {String} fullName The artefact name with prefix, suffix
 *  and extension, ready to use as a file name.
 */

class BuildArtefact {
  constructor (from = undefined) {
    this.fillFrom(from)

    this.fullNameWithExtension_ = undefined
  }

  fillFrom (from) {
    if (from) {
      if (!this.type) {
        this.type = from.type
      }
      if (!this.name) {
        this.name = from.name
      }
      // The explicit test is used to avoid overriding empty strings.
      if (this.outputPrefix === undefined) {
        this.outputPrefix = from.outputPrefix
      }
      if (this.outputSuffix === undefined) {
        this.outputSuffix = from.outputSuffix
      }
      if (this.extension === undefined) {
        this.extension = from.extension
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

BuildArtefact.types = [
  'executable',
  'staticLib',
  'sharedLib'
]

// ============================================================================

class BuildTargetPlatform {
  constructor (name) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.sources = new BuildSources()
    this.includes = new BuildIncludes()
    this.symbols = new BuildSymbols()
    this.toolchainsOptions = new BuildToolchainsOptions()
    this.targetArtefact = new BuildArtefact()
    this.language = undefined
  }
}

// ============================================================================

class BuildOptionGroup {
  constructor (name) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.sources = new BuildSources()
    this.includes = new BuildIncludes()
    this.symbols = new BuildSymbols()
    this.toolchainsOptions = new BuildToolchainsOptions()
    this.targetArtefact = new BuildArtefact()
    this.language = undefined
  }
}

// ============================================================================

/**
 * @typedef {Object} BuildCommonOptions
 * @property {String[]} suffixes Array of property suffixes.
 *
 * @description
 * The constructor adds `addSuffix` and `removeSuffix` properties for all
 * available suffixes, as empty arrays.
 *
 * If available, the constructor also concatenates corresponding properties
 * from the input object, which might be a json or another BuildToolOptions.
 */

class BuildCommonOptions {
  constructor (suffixes, from) {
    assert(Array.isArray(suffixes), 'There must be an array of suffixes.')
    this.suffixes = suffixes

    this.clear()
    this.appendFrom(from)
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
            this[property] = this[property].concat(from[property])
          }
        }
      }
    }
  }

  toString () {
    const addOptions = this.collect_('add')
    const removeOptions = this.collect_('remove')
    let str = ''
    str += `add '${addOptions}' remove '${removeOptions}'`

    return str
  }

  collect_ (prefix) {
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

class BuildToolOptions extends BuildCommonOptions {
  constructor (tool, from) {
    assert(tool instanceof Tool, 'There must be a Tool.')
    super(tool.configurationSuffixes, from)

    this.tool = tool
  }
}

// ============================================================================

/**
 * @typedef {Object} BuildToolchainOptions
 * @property {BuildCommonOptions} commonOptions Object with options common
 * to all tools.
 * @property {Object} tools Object with BuildToolOptions properties, by name.
 * @property {Toolchain} toolchain Reference to the toolchain.
 *
 * @description
 * Maintains a map of tool options, corresponding to the
 * `toolOptions` configuration object.
 */

class BuildToolchainOptions {
  constructor (toolchain, commonOptions) {
    assert(toolchain instanceof Toolchain, 'There must be a toolchain.')
    this.toolchain = toolchain

    this.commonOptions = commonOptions ||
      new BuildCommonOptions(toolchain.configurationSuffixes)
    this.tools = {}
  }

  add (toolName, toolOptions) {
    assert(Util.isString(toolName))
    assert(toolOptions instanceof BuildToolOptions)
    this.tools[toolName] = toolOptions
  }

  /**
   * @summary Collect options from all toolchains that match.
   * @param {BuildToolchainsOptions} toolchainsOptions Multi toolchain options.
   * @returns {undefined} Nothing.
   *
   * @description
   * From the possibly multiple toolchains available,
   * identify only those related to the current toolchain (same or parent).
   * Append options to the specific arrays, for each separate tool.
   */
  appendFrom (toolchainsOptions) {
    assert(toolchainsOptions instanceof BuildToolchainsOptions)

    for (const toolchainOptions of
      Object.values(toolchainsOptions.toolchains)) {
      if (this.toolchain.instanceOf(toolchainOptions.toolchain)) {
        for (const toolName of Object.keys(this.toolchain.tools)) {
          if (!this.tools.hasOwnProperty(toolName)) {
            this.tools[toolName] =
              new BuildToolOptions(this.toolchain.tools[toolName])
          }
          this.tools[toolName].appendFrom(toolchainOptions.commonOptions)
          if (toolchainOptions.tools.hasOwnProperty(toolName)) {
            this.tools[toolName].appendFrom(toolchainOptions.tools[toolName])
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
 * @typedef {Object} BuildToolchainsOptions
 * @property {Object} toolchains Object with BuildToolchainOptions properties,
 * by name.
 *
 * @description
 * Maintains a map of toolchain options, corresponding to the
 * `toolchainOptions` configuration object.
 */

class BuildToolchainsOptions {
  constructor () {
    this.clear()
  }

  clear () {
    this.toolchains = {}
  }

  add (toolchainName, toolchainOptions) {
    assert(Util.isString(toolchainName))
    assert(toolchainOptions instanceof BuildToolchainOptions)
    this.toolchains[toolchainName] = toolchainOptions
  }
}

// ============================================================================

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.BuildProject = BuildProject
module.exports.BuildConfiguration = BuildConfiguration
module.exports.BuildFolder = BuildFolder
module.exports.BuildFile = BuildFile
module.exports.BuildSymbols = BuildSymbols
module.exports.BuildIncludes = BuildIncludes
module.exports.BuildSources = BuildSources
module.exports.BuildArtefact = BuildArtefact
module.exports.BuildTargetPlatform = BuildTargetPlatform
module.exports.BuildOptionGroup = BuildOptionGroup
module.exports.BuildToolOptions = BuildToolOptions
module.exports.BuildCommonOptions = BuildCommonOptions
module.exports.BuildToolchainOptions = BuildToolchainOptions
module.exports.BuildToolchainsOptions = BuildToolchainsOptions

// In ES6, it would be:
// export class FileNode { ... }
// ...
// import { BuildConfiguration } from 'utils/build-configuration.js'

// ----------------------------------------------------------------------------
