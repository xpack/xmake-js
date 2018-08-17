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
// const fs = require('fs')
// const path = require('path')

// const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
// const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
// const CliError = require('@ilg/cli-start-options').CliError
// const CliErrorApplication =
//  require('@ilg/cli-start-options').CliErrorApplication
// const DirCache = require('./dir-cache.js').DirCache
const Util = require('./util.js').Util

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
// Promisifier.promisifyInPlace(fs, 'readFile')
// Promisifier.promisifyInPlace(fs, 'stat')
// Promisifier.promisifyInPlace(fs, 'readdir')
// Promisifier.promisifyInPlace(fs, 'mkdir')
// Promisifier.promisifyInPlace(fs, 'writeFile')

// ============================================================================

/**
 * @typedef {Object} BuildContext
 * @property {Object} json The original xmake.json.
 * @property {BuildConfiguration[]} buildConfigurations Array of build
 *  configurations (for main and tests).
 * @property {String} generatorName The generator name.
 * @property {String} projectName The project name.
 * @property {String[]} addSourceFolders Array of absolute paths to
 *  source folders.
 * @property {String[]} removeSourceFolders Array of absolute paths to
 *  source folders.
 * @property {String[]} addIncludeFolders Array of absolute paths to
 *  include folders.
 * @property {String[]} removeIncludeFolders Array of absolute paths to
 *  include folders.
 * @property {Object} commands Object with string arrays properties.
 * @property {String[]} addSymbols Array of symbols to add, or undefined.
 * @property {String[]} removeSymbols Array of symbols to remove, or undefined.
 */

class BuildContext {
  constructor (options) {
    assert(options.log, 'There must be an options.log.')
    this.log = options.log

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.json = {}

    // The array of configurations is mandatory.
    this.buildConfigurations = []

    this.buildTargets = {}
    this.buildProfiles = {}

    this.addSourceFolders = undefined
    this.removeSourceFolders = undefined

    this.addIncludeFolders = undefined
    this.removeIncludeFolders = undefined

    // Map of names to array of strings.
    this.commands = {}
  }
}

// ============================================================================

/**
 * @typedef {Object} BuildConfiguration
 * @property {String} name The configuration name.
 * @property {String[]} sourceFolders Array of absolute paths to
 * source folders.
 * @property {String[]} includeFolders Array of absolute paths to
 * include folders.
 * @property {String[]} addSymbols Array of symbols to add, or undefined.
 * @property {String[]} removeSymbols Array of symbols to remove, or undefined.
 * @property {FolderNode[]} sourceFolderNodes Array of folder nodes in the
 * source tree.
 * @property {String[]} addSourceFolders Array of absolute paths to
 *  source folders.
 * @property {String[]} removeSourceFolders Array of absolute paths to
 *  source folders.
 * @property {String[]} addIncludeFolders Array of absolute paths to
 *  include folders.
 * @property {String[]} removeIncludeFolders Array of absolute paths to
 *  include folders.
 */

class BuildConfiguration {
  constructor (name, options) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    assert(options.log, 'There must be an options.log.')
    this.log = options.log

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.addSymbols = undefined
    this.removeSymbols = undefined

    this.addIncludeFolders = undefined
    this.removeIncludeFolders = undefined

    this.target = undefined
    this.toolchain = undefined
    this.profiles = []

    // ------------------------------------------------------------------------
    // These properties will be computed and cached.

    this.addSymbolsAllCache_ = undefined
    this.removeSymbolsAllCache_ = undefined
  }

  get addSymbolsAll () {
    if (!this.addSymbolsAllCache_) {
      // Choose safe path, with new arrays for each node.
      // TODO: add toolchain, target, profile
      this.addSymbolsAllCache_ = []
      if (this.addSymbols) {
        this.addSymbolsAllCache_ =
          this.addSymbolsAllCache_.concat(this.addSymbols)
      }
    }
    return this.addSymbolsAllCache_
  }

  get removeSymbolsAll () {
    if (!this.removeSymbolsAllCache_) {
      // Choose safe path, with new arrays for each node.
      // TODO: add toolchain, target, profile
      this.removeSymbolsAllCache_ = []
      if (this.removeSymbols) {
        this.removeSymbols =
          this.removeSymbols.concat(this.removeSymbols)
      }
    }
    return this.removeSymbolsAllCache_
  }
}

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
 *  and extension.
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
      `${this.outputPrefix}|${this.name}|${this.outputPrefix}|` +
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

class BuildTarget {
  constructor (name, options) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    assert(options.log, 'There must be an options.log.')
    this.log = options.log

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.addSymbols = undefined
    this.removeSymbols = undefined

    this.addIncludeFolders = undefined
    this.removeIncludeFolders = undefined
  }
}

// ============================================================================

class BuildProfile {
  constructor (name, options) {
    assert(Util.isString(name), 'There must be a string name.')
    this.name = name

    assert(options.log, 'There must be an options.log.')
    this.log = options.log

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.addSymbols = undefined
    this.removeSymbols = undefined

    this.addIncludeFolders = undefined
    this.removeIncludeFolders = undefined
  }
}

// ============================================================================

class BuildOptions {
  constructor () {
    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files.

    this.addArchitecture = []
    this.removeArchitecture = []

    this.addDebugging = []
    this.removeDebugging = []

    this.addOptimizations = []
    this.removeOptimizations = []

    this.addWarnings = []
    this.removeWarnings = []

    this.addMiscellaneous = []
    this.removeMiscellaneous = []
  }

  appendFrom (from) {
    if (from) {
      for (const property of BuildOptions.properties) {
        if (from[property] && from[property].length !== 0) {
          // Subsequent, concatenate.
          this[property] = this[property].concat(from[property])
        }
      }
    }
  }

  toString () {
    let str = ''
    str += 'add'
    str += ` '${this.addArchitecture}`
    str += ` ${this.addDebugging}`
    str += ` ${this.addOptimizations}`
    str += ` ${this.addWarnings}`
    str += ` ${this.addMiscellaneous}'`
    str += ' remove'
    str += ` '${this.removeArchitecture}`
    str += ` ${this.removeDebugging}`
    str += ` ${this.removeOptimizations}`
    str += ` ${this.removeWarnings}`
    str += ` ${this.removeMiscellaneous}'`

    return str
  }
}

BuildOptions.properties = [
  'addArchitecture',
  'removeArchitecture',
  'addDebugging',
  'removeDebugging',
  'addOptimizations',
  'removeOptimizations',
  'addWarnings',
  'removeWarnings',
  'addMiscellaneous',
  'removeMiscellaneous'
]

// ============================================================================

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.BuildContext = BuildContext
module.exports.BuildConfiguration = BuildConfiguration
module.exports.BuildArtefact = BuildArtefact
module.exports.BuildTarget = BuildTarget
module.exports.BuildProfile = BuildProfile
module.exports.BuildOptions = BuildOptions

// In ES6, it would be:
// export class FileNode { ... }
// ...
// import { BuildConfiguration } from 'utils/build-configuration.js'

// ----------------------------------------------------------------------------
