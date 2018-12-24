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
 * Most objects include lots of empty arrays, providing default values
 * to properties.
 *
 * TODO: rename XmakeZZZ -> ConfigZZZ (or InputZZZ)
 */

// ----------------------------------------------------------------------------

const assert = require('assert')

const Util = require('./util.js').Util
const Toolchain = require('./toolchain.js').Toolchain
const Tool = require('./toolchain.js').Tool

// ============================================================================

/**
 * @typedef {Object} CFTopConfiguration
 * @property {Object} json The original xmake.json.
 * @property {Object} discovered Object with discovered paths.
 * @property {String} name Optional project name from xmake.json;
 * may be undefined.
 * @property {Object} builders Map of builders, by name.
 * @property {Object} buildConfigurations Map of build
 *  configurations (for main and tests).
 * @property {CFArtefact} targetArtefact Artefact.
 * @property {String} language A string defining the language ['c', 'c++'].
 * @property {Object} folders Object with CFFolder properties.
 * @property {Object} files Object with CFFile properties.
 * @property {Object} targetPlatforms Object with target platforms properties.
 * @property {Object} optionGroups Object with groups properties.
 * @property {boolean} exportCompilationDatabase
 * @property {CFSources} sources Object with absolute paths to
 *  source folders.
 *
 * @property {Object} actual Collection of actual properties.
 * @property {String} actual.cwd Current project absolute path.
 * @property {String} actual.folderAbsolutePath The location of the xmake.json.
 * @property {String} actual.folderRelativePath The location of the xmake.json,
 * relative to cwd.
 * @property {String} actual.projectName The project name (externally set
 * for projects, calculated from relative path for tests).
 * @property {String} actual.configNamePrefix For tests, a name calculated from
 * the relative path, used to test if configuration names start properly;
 * undefined otherwise.
 * @property {CFTopConfiguration} actual.topProject For tests, the top project.
 * @property {String} actual.fileAbsolutePath The actual xmake.json path.
 */

class CFTopConfiguration {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')
    this.clear()

    assert(args.log, 'There must be a logger')
    this.log = args.log

    const log = this.log
    log.trace(`${this.constructor.name}.constructor()`)
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.json = {}

    // The object with buildConfigurations is mandatory.
    this.buildConfigurations = {}

    this.folders = {}
    this.files = {}

    this.targetPlatforms = {}
    this.optionGroups = {}
    this.builders = {}

    // Here will be stored the post processed properties.
    this.actual = {}
  }
}

// ============================================================================

/**
 * @typedef {Object} CFBuildConfiguration
 * @property {String} name The configuration name.
 * @property {CFArtefact} artefact
 * @property {Object} actual Collection of actual properties.
 * @property {CFSources} actual.sourceFolders Object with absolute paths to
 *  source folders.
 *
 * @todo Add more properties.
 */

class CFBuildConfiguration {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')

    this.clear()

    assert(Util.isString(args.name), 'There must be a string args.name.')
    this.name = args.name

    assert(args.log, 'There must be a logger')
    this.log = args.log

    const log = this.log
    log.trace(`${this.constructor.name}.constructor('${args.name}')`)

    // TODO: filter chars not accepted by the file system.
    this.actual.name = args.name.toLowerCase()
  }

  clear () {
    this.targetPlatform = undefined
    this.toolchain = undefined
    this.optionGroups = []

    // Here will be stored the post processed objects.
    this.actual = {}
  }
}

// ============================================================================

/**
 * @typedef {Object} CFFolder
 * @property {String} name The folder relative path (POSIX).
 * @property {CFIncludes} includes The include folders and files.
 * @property {CFSymbols} symbols The symbols.
 * @property {CFToolchains} toolchainsOptions The toolchains options.
 * @property {CFToolchain} toolchainOptions The toolchain options
 * (for build configurations).
 * @property {Toolchain} toolchain The toolchain definitions
 * (for build configurations).
 * @property {Node} node A reference to the source tree node, placed here
 * later, while constructing the source tree.
 */

class CFFolder {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')

    assert(Util.isString(args.name), 'There must be a string name.')
    this.name = args.name

    assert(args.log, 'There must be a logger')
    this.log = args.log

    const log = this.log
    log.trace(`${this.constructor.name}.constructor('${args.name}')`)

    if (args.toolchain) {
      // When building for a specific buildConfiguration, restrict to
      // a single toolchain.
      this.toolchain = args.toolchain
      this.toolchainOptions = new CFToolchain({
        log,
        ...args.toolchainOptions,
        toolchain: args.toolchain,
        doMoveAll: args.doMoveAll
      })
    } else {
      this.toolchainsOptions =
        new CFToolchains({
          log,
          ...args.toolchainsOptions
        })
    }
    if (!args.doMoveAll) {
      this.includes = new CFIncludes({
        log,
        ...args.includes
      })
      this.symbols = new CFSymbols({
        log,
        ...args.symbols
      })
    } else {
      this.includes = args.includes
      this.symbols = args.symbols
    }

    if (args.doMoveAll) {
      if (args.toolchain) {
        args.toolchainOptions = undefined
      } else {
        args.toolchainsOptions = undefined
      }
      args.includes = undefined
      args.symbols = undefined
    }
  }

  clear () {
    this.toolchainsOptions.clear()
  }

  appendFrom (xmakeFolder) {
    assert(xmakeFolder instanceof CFFolder)

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
 * @typedef {Object} CFFile
 * @property {String} name The file relative path (POSIX).
 * @property {CFIncludes} includes The include folders and files.
 * @property {CFSymbols} symbols The symbols.
 * @property {CFToolchains} toolchainsOptions The toolchains options.
 * @property {Node} node A reference to the source tree node, placed here
 * later, while constructing the source tree.
 */

class CFFile {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')

    assert(Util.isString(args.name), 'There must be a string name.')
    this.name = args.name

    assert(args.log, 'There must be a logger')
    this.log = args.log

    const log = this.log
    log.trace(`${this.constructor.name}.constructor('${args.name}')`)

    if (args.doMoveAll) {
      this.includes = args.includes
      this.symbols = args.symbols
    } else {
      // Make copies, do not use the originals.
      this.includes = new CFIncludes({
        log,
        ...args.includes
      })
      this.symbols = new CFSymbols({
        log,
        ...args.symbols
      })
    }

    if (args.toolchain) {
      // When building for a specific buildConfiguration, restrict to
      // a single toolchain.
      assert(args.toolchain instanceof Toolchain)
      this.toolchain = args.toolchain

      this.tool = args.tool

      this.toolchainOptions = new CFToolchain({
        log,
        ...args.toolchainOptions,
        toolchain: args.toolchain,
        tool: args.tool,
        doMoveAll: args.doMoveAll
      })
    } else {
      this.toolchainsOptions =
        new CFToolchains({
          log,
          ...args.toolchainsOptions
        })
    }
    if (args.doMoveAll) {
      args.includes = undefined
      args.symbols = undefined
      args.toolchainOptions = undefined
    }
  }

  clear () {
    this.includes.clear()
    this.symbols.clear()
    this.toolchainOptions.clear()
  }

  appendFrom (xmakeFile) {
    assert(xmakeFile instanceof CFFile)

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
class CFArrays {
  constructor (suffixes) {
    assert(suffixes)
    this.suffixes = suffixes
    this.cache_ = {}
  }

  clear () {
    for (const suffix of this.suffixes) {
      for (const prefix of ['add', 'remove']) {
        const propertyName = prefix + suffix
        this[propertyName] = []
      }
    }
  }

  /**
   * @summary Copy/move arrays of properties with the given suffixes.
   * @param {Object} from Source object.
   * @param {String[]} propertiesSuffixes Array of suffixes.
   * @returns {undefined} Nothing.
   *
   * @description
   * Prepend add/remove to the given suffixes and copy/move the arrays
   * to the local object.
   * Missing arrays are always initialised as empty.
   *
   * The move semantic is similar to C++, it means copying the reference
   * and clearing the source reference.
   */
  initializeArrays_ (from) {
    assert(from)

    for (const suffix of this.suffixes) {
      for (const prefix of ['add', 'remove']) {
        const propertyName = prefix + suffix
        if (from[propertyName] && from[propertyName].length !== 0) {
          // Make a copy, do not use original.
          if (from.doMoveAll) {
            // Reuse the source reference.
            this[propertyName] = from[propertyName]
            // Clear the source reference.
            from[propertyName] = undefined
          } else {
            this[propertyName] = [...from[propertyName]]
          }
        } else {
          this[propertyName] = []
        }
      }
    }
  }

  appendArrays_ (from) {
    assert(from)

    for (const suffix of this.suffixes) {
      for (const prefix of ['add', 'remove']) {
        const propertyName = prefix + suffix
        if (from[propertyName] && from[propertyName].length !== 0) {
          this[propertyName] = [...this[propertyName], ...from[propertyName]]
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
        const propertyName = prefix + suffix
        if (this[propertyName] && this[propertyName].length !== 0) {
          return true
        }
      }
    }
    return false
  }

  toString () {
    let str = ''
    for (const suffix of this.suffixes) {
      const addValues = this['add' + suffix]
      const removeValues = this['remove' + suffix]
      if (addValues.length || removeValues.length) {
        if (str.length) {
          str += ', '
        }
        str += `${suffix}:`
        if (addValues.length) {
          str += ` add '${addValues}'`
        }
        if (removeValues.length) {
          str += ` remove '${removeValues}'`
        }
      }
    }
    return str
  }
}

// ============================================================================

/**
 * @typedef {Object} CFSources
 * @property {String[]} addSourceFolders Array of absolute paths to
 *  source folders.
 * @property {String[]} removeSourceFolders Array of absolute paths to
 *  source folders.
 */

class CFSources extends CFArrays {
  constructor (args = {}) {
    super(CFSources.propertiesSuffixes)

    assert(Util.isObject(args), 'There must be args.')

    assert(args.log, 'There must be a logger')
    this.log = args.log

    // const log = this.log
    // log.trace(`${this.constructor.name}.constructor()`)

    this.initializeArrays_(args)
  }

  appendFrom (from) {
    if (from instanceof CFSources) {
      this.appendArrays_(from)
    } else if (from.sources instanceof CFSources) {
      this.appendArrays_(from.sources)
    } else {
      this.appendArrays_(from)
    }
  }
}

CFSources.propertiesSuffixes = [
  'SourceFolders'
]

// ============================================================================

/**
 * @typedef {Object} CFSymbols
 * @property {String[]} addDefinedSymbols Array of defined symbols to add.
 * @property {String[]} removeDefinedSymbols Array of defined symbols to remove.
 * @property {String[]} addUndefinedSymbols Array of undefined symbols to add.
 * @property {String[]} removeUndefinedSymbols Array of undefined symbols
 * to remove.
 */

class CFSymbols extends CFArrays {
  constructor (args = {}) {
    super(CFSymbols.propertiesSuffixes)

    assert(Util.isObject(args), 'There must be args.')

    assert(args.log, 'There must be a logger')
    this.log = args.log

    // const log = this.log
    // log.trace(`${this.constructor.name}.constructor()`)

    this.initializeArrays_(args)
  }

  /**
   * @summary Append symbols from different sources.
   * @param {CFSymbols|CFToolchains} from Source object.
   * @param {Toolchain} toolchain Optional toolchain.
   * @param {String} toolName Optional tool name.
   * @returns {undefined} Nothing.
   *
   * @description
   * In addition to the obvious case when it appends values from another
   * CFSymbols, it also accepts more complicated objects
   * which have a `symbols` property.
   * In this case, if the object also has a `toolchainOptions` property
   * and the `toolchain` parameter is defined, it also appends
   * symbols from all toolchains that match.
   */
  appendFrom (from, toolchain, toolName) {
    if (from instanceof CFSymbols) {
      this.appendArrays_(from)
    } else {
      if (from.symbols instanceof CFSymbols) {
        this.appendArrays_(from.symbols)
      }
      if (from.toolchainsOptions instanceof CFToolchains &&
        toolchain instanceof Toolchain) {
        for (const toolchainOptions of
          Object.values(from.toolchainsOptions.toolchains)) {
          if (toolchain.instanceOf(
            toolchainOptions.toolchain)) {
            this.appendFrom(toolchainOptions.common.symbols)
            if (toolName && toolchainOptions.tools[toolName]) {
              this.appendFrom(toolchainOptions.tools[toolName].symbols)
            }
          }
        }
      }
    }
  }
}

CFSymbols.propertiesSuffixes = [
  'DefinedSymbols',
  'UndefinedSymbols'
]

// ============================================================================

/**
 * @typedef {Object} CFIncludes
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

class CFIncludes extends CFArrays {
  constructor (args = {}) {
    super(CFIncludes.propertiesSuffixes)

    assert(Util.isObject(args), 'There must be args.')

    assert(args.log, 'There must be a logger')
    this.log = args.log

    // const log = this.log
    // log.trace(`${this.constructor.name}.constructor()`)

    this.initializeArrays_(args)
  }

  appendFrom (from, toolchain, toolName) {
    if (from instanceof CFIncludes) {
      this.appendArrays_(from)
    } else {
      if (from.includes instanceof CFIncludes) {
        this.appendArrays_(from.includes)
      }
      if (from.toolchainsOptions instanceof CFToolchains &&
        toolchain instanceof Toolchain) {
        for (const toolchainOptions of
          Object.values(from.toolchainsOptions.toolchains)) {
          if (toolchain.instanceOf(
            toolchainOptions.toolchain)) {
            this.appendFrom(toolchainOptions.common.includes)
            if (toolName && toolchainOptions.tools[toolName]) {
              this.appendFrom(toolchainOptions.tools[toolName].includes)
            }
          }
        }
      }
    }
  }

  appendPosixRelative (fromPath, includes) {
    assert(includes instanceof CFIncludes)

    for (const suffix of this.suffixes) {
      for (const prefix of ['add', 'remove']) {
        const propertyName = prefix + suffix
        if (includes[propertyName] && includes[propertyName].length !== 0) {
          this[propertyName] = [
            ...this[propertyName],
            ...Util.toPosixRelativePath(fromPath, includes[propertyName])
          ]
        }
      }
    }
  }
}

CFIncludes.propertiesSuffixes = [
  'IncludeFolders',
  'IncludeSystemFolders',
  'IncludeFiles'
]

// ============================================================================

/**
 * @typedef {Object} CFArtefact
 * @property {String} type The artefact type, one of
 *  [ 'executable', 'staticLib', 'sharedLib' ]
 * @property {String} name The artefact name.
 * @property {String} outputPrefix The artefact prefix.
 * @property {String} outputSuffix The artefact suffix.
 * @property {String} extension The artefact extension, without dot.
 * @property {String} fullName The artefact name with prefix, suffix
 *  and extension, ready to use as a file name.
 */

class CFArtefact {
  constructor (artefact = undefined) {
    this.clear()
    this.fillFrom(artefact)

    this.fullNameWithExtension_ = undefined
  }

  clear () {
    this.type = undefined
    this.name = undefined
    this.outputPrefix = undefined
    this.outputSuffix = undefined
    this.extension = undefined
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

CFArtefact.types = [
  'executable',
  'staticLib',
  'sharedLib'
]

// ============================================================================

class CFOptionGroup {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')

    assert(args.log, 'There must be a logger')
    this.log = args.log
    const log = this.log

    assert(Util.isString(args.name), 'There must be a string name.')
    this.name = args.name

    if (args.doMoveAll) {
      // Use the originals.
      this.targetArtefact = args.targetArtefact
      args.targetArtefact = undefined

      this.sources = args.sources
      args.source = undefined

      this.includes = args.includes
      args.includes = undefined

      this.symbols = args.symbols
      args.symbols = undefined

      this.toolchainsOptions = args.toolchainsOptions
      args.toolchainsOptions = undefined
    } else {
      // Make copies, do not use the originals.
      this.targetArtefact = new CFArtefact(args.targetArtefact)

      this.sources = new CFSources({
        log,
        ...args.sources
      })
      this.includes = new CFIncludes({
        log,
        ...args.includes
      })
      this.symbols = new CFSymbols({
        log,
        ...args.symbols
      })

      this.toolchainsOptions = new CFToolchains({
        log,
        ...args.toolchainsOptions
      })
    }
  }

  clear () {
    this.sources.clear()
    this.includes.clear()
    this.symbols.clear()
    this.toolchainsOptions.clear()
    this.targetArtefact.clear()
  }
}

// ============================================================================

class CFTargetPlatform extends CFOptionGroup {
  // For now reuse the group defs. Possibly add more, like CMSIS, XSVD, etc.
}

// ============================================================================

/**
 * @typedef {Object} XmakeOptions Definitions specific to toolchain tools.
 * @property {String[]} suffixes Array of property suffixes common to all
 * toolchain tools (from the toolchain definition).
 *
 * @description
 * The constructor adds `addSuffix` and `removeSuffix` properties for all
 * available suffixes, as empty arrays.
 *
 * If available, the constructor also concatenates corresponding properties
 * from the input object, which might be a json or another CFTool.
 */

class XmakeOptions extends CFArrays {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')
    assert(Array.isArray(args.suffixes),
      'There must be an array of suffixes.')
    super(args.suffixes)

    // Copy/move arrays from args.
    this.initializeArrays_(args, this.suffixes)
  }

  appendFrom (from) {
    super.appendArrays_(from)
  }
}

// ============================================================================

/**
 * @typedef {Object} CFCommon Definitions common to all toolchain tools.
 * @property {String[]} suffixes Array of property suffixes common to all
 * toolchain tools (from the toolchain definition).
 *
 * @description
 * The constructor adds `addSuffix` and `removeSuffix` properties for all
 * available suffixes, as empty arrays.
 *
 * If available, the constructor also concatenates corresponding properties
 * from the input object, which might be a json or another CFTool.
 */

class CFCommon {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')

    assert(args.log, 'There must be a logger')
    this.log = args.log
    const log = this.log

    if (args.symbols) {
      this.symbols = new CFSymbols({
        log,
        ...args.symbols,
        doMoveAll: args.doMoveAll
      })
    } else {
      this.symbols = new CFSymbols({
        log,
        ...args
      })
    }

    if (args.includes) {
      this.includes = new CFIncludes({
        log,
        ...args.includes,
        doMoveAll: args.doMoveAll
      })
    } else {
      this.includes = new CFIncludes({
        log,
        ...args
      })
    }

    if (args.options) {
      this.options = new XmakeOptions({
        log,
        suffixes: args.options.suffixes,
        ...args.options,
        doMoveAll: args.doMoveAll
      })
    } else {
      assert(Array.isArray(args.suffixes),
        'There must be an array of suffixes.')

      this.options = new XmakeOptions({
        log,
        suffixes: args.suffixes,
        ...args
      })
    }

    if (args.doMoveAll) {
      args.symbols = undefined
      args.includes = undefined
      args.options = undefined
    }
  }

  clear () {
    this.symbols.clear()
    this.includes.clear()
    this.options.clear()
  }

  appendFrom (from) {
    assert(from)
    this.symbols.appendFrom(from.symbols)
    this.includes.appendFrom(from.includes)
    this.options.appendFrom(from.options)
  }

  appendOptionsFrom (from) {
    assert(from)
    this.options.appendFrom(from.options)
  }

  hasContent () {
    return (this.symbols.hasContent() || this.includes.hasContent() ||
      this.options.hasContent())
  }

  toString () {
    let str = ''
    if (this.symbols.hasContent()) {
      str += this.symbols
    }
    if (this.includes.hasContent()) {
      if (str.length) {
        str += '; '
      }
      str += this.includes
    }
    if (this.options.hasContent()) {
      if (str.length) {
        str += '; '
      }
      str += this.options
    }
    return str
  }
}

// ============================================================================

class CFTool extends CFCommon {
  constructor (args) {
    super({
      suffixes: args.tool.configurationSuffixes,
      ...args // doMoveAll & log are propagated here.
    })

    assert(args.tool instanceof Tool, 'There must be a Tool.')
    this.tool = args.tool

    const log = this.log
    log.trace(`${this.constructor.name}.constructor('${this.tool.name}')`)
  }

  appendFrom (from) {
    assert(from)
    assert(from.tool.name === this.tool.name)
    super.appendFrom(from)
  }

  appendIncludesAndSymbolsFrom (from) {
    assert(from)
    this.symbols.appendFrom(from.symbols)
    this.includes.appendFrom(from.includes)
  }
}

// ============================================================================

/**
 * @typedef {Object} CFToolchain
 * @property {CFCommon} common Object with definitions common
 * to all tools.
 * @property {Object} tools Map with CFTool properties, by name.
 * @property {Toolchain} toolchain Reference to the toolchain definition.
 *
 * @description
 * Maintains a map of tool options, corresponding to the
 * `toolOptions` configuration object.
 */

class CFToolchain {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')

    assert(args.log, 'There must be a logger')
    this.log = args.log

    const log = this.log
    log.trace(`${this.constructor.name}.constructor()`)

    assert(args.toolchain instanceof Toolchain,
      'There must be a toolchain.')
    this.toolchain = args.toolchain

    this.common = new CFCommon({
      log,
      suffixes: this.toolchain.configurationSuffixes,
      // The source options may be undefined.
      ...args.common,
      doMoveAll: args.doMoveAll
    })

    this.tools = {}
    if (args.tools) {
      assert(Util.isObject(args.tools))
      if (!args.tool) {
        // Enumerate the toolchain tools, not the source tools,
        // to guarantee all tools are present.
        for (const toolName of Object.keys(this.toolchain.tools)) {
          this.tools[toolName] = new CFTool({
            log,
            tool: this.toolchain.tools[toolName],
            // The source tool may be undefined.
            ...args.tools[toolName],
            doMoveAll: args.doMoveAll
          })
        }
      } else {
        this.tool = args.tool
        this.tools[args.tool.name] = new CFTool({
          log,
          tool: args.tool,
          // The source tool may be undefined.
          ...args.tools[args.tool.name],
          doMoveAll: args.doMoveAll
        })
      }
    } else {
      // Initialise all tools as empty, will append to them later.
      if (!args.tool) {
        // Enumerate the toolchain tools, not the source tools,
        // to guarantee all tools are present.
        for (const [toolName, tool] of Object.entries(this.toolchain.tools)) {
          this.tools[toolName] = new CFTool({
            log,
            tool
          })
        }
      } else {
        this.tool = args.tool
        this.tools[args.toolName] = new CFTool({
          log,
          tool: args.tool,
          doMoveAll: args.doMoveAll
        })
      }
    }
  }

  /**
   * @summary Collect options from all toolchains that match.
   * @param {Objects} from Toolchain(s) options.
   * @returns {undefined} Nothing.
   *
   * @description
   * From the possibly multiple toolchains available,
   * identify only those related to the current toolchain (same or parent).
   * Append options to the specific arrays, for each separate tool.
   */
  appendFrom (from) {
    const log = this.log

    // The input can be either a multi CFToolchains or a single
    // CFToolchain.
    if (from.toolchains) {
      // The multi-toolchains case.
      for (const toolchainOptions of Object.values(from.toolchains)) {
        this.appendFrom(toolchainOptions)
      }
    } else {
      // The single toolchain case.
      assert(this.toolchain, 'There must be a toolchain.')
      if (this.toolchain.instanceOf(from.toolchain)) {
        this.common.appendFrom(from.common)

        // Enumerate the local toolchain tools, not the source tools.
        for (const toolName of Object.keys(this.toolchain.tools)) {
          if (!this.tools.hasOwnProperty(toolName)) {
            // Needed because the tool may not exist, the constructor
            // does not create all
            this.tools[toolName] = new CFTool({
              log,
              tool: this.toolchain.tools[toolName]
            })
          }
          // Now it is guaranteed that the tool exists, we can append to it.
          if (from.tools.hasOwnProperty(toolName)) {
            this.tools[toolName].appendFrom(from.tools[toolName])
          }
        }
      }
    }
  }

  appendOptionsFrom (from) {
    // The input can be either a multi CFToolchains or a single
    // CFToolchain.
    if (from.toolchains) {
      // The multi-toolchains case.
      for (const toolchainOptions of Object.values(from.toolchains)) {
        this.appendOptionsFrom(toolchainOptions)
      }
    } else {
      // The single toolchain case.
      assert(this.toolchain, 'There must be a toolchain.')
      if (this.toolchain.instanceOf(from.toolchain)) {
        this.common.appendOptionsFrom(from.common)

        // Enumerate the local toolchain tools, not the source tools.
        for (const toolName of Object.keys(this.toolchain.tools)) {
          assert(this.tools[toolName])
          // Now it is guaranteed that the tool exists, we can append to it.
          if (from.tools.hasOwnProperty(toolName)) {
            this.tools[toolName].appendOptionsFrom(from.tools[toolName])
          }
        }
      }
    }
  }

  toString () {
    let str = ''
    if (this.common.hasContent()) {
      str += `\n- common={${this.common}}`
    }
    for (const [toolName, toolOptions] of Object.entries(this.tools)) {
      if (toolOptions.hasContent()) {
        if (str.length) {
          str += `\n`
        }
        str += `- ${toolName}={${toolOptions}}`
      }
    }
    return `${this.toolchain.name}${str}`
  }
}

// ============================================================================

/**
 * @typedef {Object} CFToolchains
 * @property {Object} toolchains Object with CFToolchain properties,
 * by name.
 *
 * @description
 * Maintains a map of toolchain options, corresponding to the
 * `toolchainOptions` configuration object.
 *
 * The initial use case is to create it empty, and add toolchainOptions.
 *
 * The second use case is when options are collected, and the copy
 * constructor is used.
 *
 * Normally it maintains multiple toolchains.
 *
 * When called with the `toolchain` property (like when used for a
 * specific buildConfiguration, i.e. the toolchain is known), it
 * maintains a single entry for the toolchain,
 * which collects definitions from all available toolchains.
 */

class CFToolchains {
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')

    this.clear()

    assert(args.log, 'There must be a logger')
    this.log = args.log

    const log = this.log
    log.trace(`${this.constructor.name}.constructor()`)

    if (args.toolchains) {
      if (!args.toolchain) {
        // Copy all toolchains.
        for (const [toolchainName, toolchainOptions] of
          Object.entries(args.toolchains)) {
          this.toolchains[toolchainName] = new CFToolchain({
            log,
            ...toolchainOptions
          })
        }
      } else {
        // Create a single toolchain from all other.
        const toolchainName = args.toolchain.name
        this.toolchains[toolchainName] = new CFToolchain({
          log,
          toolchain: args.toolchain
        })
        // Must set the toolchain member before, it is used in `appendFrom()`.
        this.toolchain = args.toolchain
        this.toolchains[toolchainName].appendFrom(args)
      }
    }
  }

  clear () {
    this.toolchains = {}
  }

  add (toolchainName, toolchainOptions) {
    assert(Util.isString(toolchainName))
    assert(toolchainOptions instanceof CFToolchain)
    this.toolchains[toolchainName] = toolchainOptions
  }

  appendFrom (from) {
    assert(from instanceof CFToolchains)

    if (!this.toolchain) {
      // Append multiple toolchains separately.
      for (const [toolchainName, toolchainOptions] of
        Object.entries(from.toolchains)) {
        this.toolchains[toolchainName].appendFrom(toolchainOptions)
      }
    } else {
      // Append only for a specific toolchain.
      const toolchainName = this.toolchain.name
      this.toolchains[toolchainName].appendFrom(from)
    }
  }
}

// ============================================================================

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.CFTopConfiguration = CFTopConfiguration
module.exports.CFBuildConfiguration = CFBuildConfiguration
module.exports.CFFolder = CFFolder
module.exports.CFFile = CFFile
module.exports.CFArrays = CFArrays
module.exports.CFSymbols = CFSymbols
module.exports.CFIncludes = CFIncludes
module.exports.CFSources = CFSources
module.exports.CFArtefact = CFArtefact
module.exports.CFTargetPlatform = CFTargetPlatform
module.exports.CFOptionGroup = CFOptionGroup
module.exports.CFTool = CFTool
module.exports.CFCommon = CFCommon
module.exports.CFToolchain = CFToolchain
module.exports.CFToolchains = CFToolchains

// In ES6, it would be:
// export class CFBuildConfiguration { ... }
// ...
// import { CFBuildConfiguration } from 'utils/cf-objects.js'

// ----------------------------------------------------------------------------
