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
 * @property {String} cwd Current project absolute path.
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
  constructor (buildFolder) {
    assert(Util.isObject(buildFolder))
    assert(Util.isString(buildFolder.name), 'There must be a string name.')
    this.name = buildFolder.name

    // Make copies, do not use the originals.
    this.includes = new BuildIncludes(buildFolder.includes)
    this.symbols = new BuildSymbols(buildFolder.symbols)

    if (buildFolder.toolchain) {
      // When building for a specific buildConfiguration, restrict to
      // a single toolchain.
      this.toolchain = buildFolder.toolchain
      this.toolchainOptions =
        new BuildToolchainOptions({
          ...buildFolder.toolchainOptions,
          toolchain: buildFolder.toolchain
        })
    } else {
      this.toolchainsOptions =
        new BuildToolchainsOptions(buildFolder.toolchainsOptions)
    }
  }

  clear () {
    this.includes = new BuildIncludes()
    this.symbols = new BuildSymbols()

    if (this.toolchain) {
      this.toolchainOptions = new BuildToolchainOptions({
        toolchain: this.toolchain
      })
    } else {
      this.toolchainsOptions = new BuildToolchainsOptions()
    }
  }

  appendFrom (buildFolder) {
    assert(buildFolder instanceof BuildFolder)

    this.includes.appendFrom(buildFolder.includes)
    this.symbols.appendFrom(buildFolder.symbols)

    if (this.toolchainOptions) {
      if (buildFolder.toolchainOptions) {
        this.toolchainOptions.appendFrom(buildFolder.toolchainOptions)
      } else {
        this.toolchainOptions.appendFrom(buildFolder.toolchainsOptions)
      }
    } else {
      this.toolchainsOptions.appendFrom(buildFolder.toolchainsOptions)
    }
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
  constructor (buildFile) {
    assert(Util.isObject(buildFile))
    assert(Util.isString(buildFile.name), 'There must be a string name.')
    this.name = buildFile.name

    // Make copies, do not use the originals.
    this.includes = new BuildIncludes(buildFile.includes)
    this.symbols = new BuildSymbols(buildFile.symbols)

    if (buildFile.toolchain) {
      // When building for a specific buildConfiguration, restrict to
      // a single toolchain.
      this.toolchain = buildFile.toolchain
      this.toolchainOptions = new BuildToolchainOptions({
        ...buildFile.toolchainOptions,
        toolchain: buildFile.toolchain
      })
    } else {
      this.toolchainsOptions =
        new BuildToolchainsOptions(buildFile.toolchainsOptions)
    }
  }

  clear () {
    this.includes = new BuildIncludes()
    this.symbols = new BuildSymbols()

    if (this.toolchain) {
      this.toolchainOptions = new BuildToolchainOptions({
        toolchain: this.toolchain
      })
    } else {
      this.toolchainsOptions = new BuildToolchainsOptions()
    }
  }

  appendFrom (buildFile) {
    assert(buildFile instanceof BuildFile)

    this.includes.appendFrom(buildFile.includes)
    this.symbols.appendFrom(buildFile.symbols)

    if (this.toolchainOptions) {
      if (buildFile.toolchainOptions) {
        this.toolchainOptions.appendFrom(buildFile.toolchainOptions)
      } else {
        this.toolchainOptions.appendFrom(buildFile.toolchainsOptions)
      }
    } else {
      this.toolchainsOptions.appendFrom(buildFile.toolchainsOptions)
    }
  }
}

// ============================================================================

/**
 * @summary Utility functions, used in various classes.
 */
class Base {
  copyArrays_ (from, names) {
    for (const name of names) {
      if (from[name] && from[name].length !== 0) {
        // Make a copy, do not use original.
        this[name] = [...from[name]]
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
 * @typedef {Object} BuildSources
 * @property {String[]} addSourceFolders Array of absolute paths to
 *  source folders.
 * @property {String[]} removeSourceFolders Array of absolute paths to
 *  source folders.
 */

class BuildSources extends Base {
  constructor (sources = {}) {
    super()
    this.copyArrays_(sources, BuildSources.properties)
  }

  appendFrom (sources) {
    assert(sources instanceof BuildSources)
    this.appendArrays_(sources, BuildSources.properties)
  }

  toString () {
    const addSourceFolders = this.collectArray_('addSourceFolders')
    const removeSourceFolders = this.collectArray_('removeSourceFolders')
    let str = ''
    str += `add '${addSourceFolders}' remove '${removeSourceFolders}'`

    return str
  }
}

BuildSources.properties = [
  'addSourceFolders',
  'removeSourceFolders'
]

// ============================================================================

/**
 * @typedef {Object} BuildSymbols
 * @property {String[]} addSymbols Array of symbols to add, or undefined.
 * @property {String[]} removeSymbols Array of symbols to remove, or undefined.
 */

class BuildSymbols extends Base {
  constructor (symbols = {}) {
    super()
    this.copyArrays_(symbols, BuildSymbols.properties)
  }

  appendFrom (symbols) {
    assert(symbols instanceof BuildSymbols)
    this.appendArrays_(symbols, BuildSymbols.properties)
  }

  toString () {
    const addSymbols = this.collectArray_('addSymbols')
    const removeSymbols = this.collectArray_('removeSymbols')
    let str = ''
    str += `add '${addSymbols}' remove '${removeSymbols}'`

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

class BuildIncludes extends Base {
  constructor (includes = {}) {
    super()
    this.copyArrays_(includes, BuildIncludes.properties)
  }

  appendFrom (includes) {
    assert(includes instanceof BuildIncludes)
    this.appendArrays_(includes, BuildIncludes.properties)
  }

  appendPosixRelative (fromPath, includes) {
    assert(includes instanceof BuildIncludes)

    for (const name of BuildIncludes.properties) {
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

BuildArtefact.types = [
  'executable',
  'staticLib',
  'sharedLib'
]

// ============================================================================

class BuildTargetPlatform {
  constructor (targetPlatform) {
    assert(Util.isObject(targetPlatform))
    assert(Util.isString(targetPlatform.name), 'There must be a string name.')
    this.name = targetPlatform.name

    // Make copies, do not use the originals.
    this.sources = new BuildSources(targetPlatform.sources)
    this.includes = new BuildIncludes(targetPlatform.includes)
    this.symbols = new BuildSymbols(targetPlatform.symbols)
    this.toolchainsOptions =
      new BuildToolchainsOptions(targetPlatform.toolchainsOptions)
    this.targetArtefact = new BuildArtefact(targetPlatform.targetArtefact)
    this.language = targetPlatform.language
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
  constructor (optionGroup) {
    assert(Util.isObject(optionGroup))
    assert(Util.isString(optionGroup.name), 'There must be a string name.')
    this.name = optionGroup.name

    this.sources = new BuildSources(optionGroup.sources)
    this.includes = new BuildIncludes(optionGroup.includes)
    this.symbols = new BuildSymbols(optionGroup.symbols)
    this.toolchainsOptions =
      new BuildToolchainsOptions(optionGroup.toolchainsOptions)
    this.targetArtefact = new BuildArtefact(optionGroup.targetArtefact)
    this.language = optionGroup.language
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
  constructor (commonOptions) {
    assert(commonOptions)
    assert(Array.isArray(commonOptions.suffixes),
      'There must be an array of suffixes.')
    this.suffixes = commonOptions.suffixes

    for (const suffix of this.suffixes) {
      for (const prefix of ['add', 'remove']) {
        const property = prefix + suffix
        if (commonOptions[property] && commonOptions[property].length !== 0) {
          // Make a copy.
          this[property] = [...commonOptions[property]]
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

class BuildToolOptions extends BuildCommonOptions {
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
  constructor (toolchainOptions) {
    assert(toolchainOptions.toolchain instanceof Toolchain,
      'There must be a toolchain.')
    this.toolchain = toolchainOptions.toolchain

    // Keep the common options separate for now, will be merged
    // later when building the source tree.
    this.commonOptions = new BuildCommonOptions({
      suffixes: this.toolchain.configurationSuffixes,
      // The source options may be undefined.
      ...toolchainOptions.commonOptions
    })

    this.tools = {}
    if (toolchainOptions.tools) {
      assert(Util.isObject(toolchainOptions.tools))
      // Enumerate the toolchain tools, not the source tools,
      // to guarantee all tools are present.
      for (const toolName of Object.keys(this.toolchain.tools)) {
        this.tools[toolName] = new BuildToolOptions({
          tool: this.toolchain.tools[toolName],
          // The source tool may be undefined.
          ...toolchainOptions.tools[toolName]
        })
      }
    }
  }

  add (toolName, toolOptions) {
    assert(Util.isString(toolName))
    assert(toolOptions instanceof BuildToolOptions)
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
              new BuildToolOptions({
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
 * @typedef {Object} BuildToolchainsOptions
 * @property {Object} toolchains Object with BuildToolchainOptions properties,
 * by name.
 *
 * @description
 * Maintains a map of toolchain options, corresponding to the
 * `toolchainOptions` configuration object.
 *
 * When called with the `toolchain` property, it maintaines a single entry,
 * which collects definitions from all available toolchains.
 */

class BuildToolchainsOptions {
  constructor (toolchainsOptions = {}) {
    this.clear()
    if (toolchainsOptions.toolchains) {
      if (!toolchainsOptions.toolchain) {
        // Copy all toolchains.
        for (const [toolchainName, toolchainOptions] of
          Object.entries(toolchainsOptions.toolchains)) {
          this.toolchains[toolchainName] =
            new BuildToolchainOptions(toolchainOptions)
        }
      } else {
        // Create a single toolchain from all other.
        const toolchainName = toolchainsOptions.toolchain.name
        this.toolchains[toolchainName] = new BuildToolchainOptions({
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
    assert(toolchainOptions instanceof BuildToolchainOptions)
    this.toolchains[toolchainName] = toolchainOptions
  }

  appendFrom (toolchainsOptions) {
    assert(toolchainsOptions instanceof BuildToolchainsOptions)

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
