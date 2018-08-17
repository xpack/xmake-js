/*
 * This file is part of the xPack distribution
 *   (http://xpack.github.io).
 * Copyright (c) 2018 Liviu Ionescu.
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

const path = require('path')

const assert = require('assert')
// const fs = require('fs')

// const Promisifier = require('@ilg/es6-promisifier').Promisifier

const JsonCache = require('./json-cache.js').JsonCache
const ToolchainCache = require('./toolchain-cache.js').ToolchainCache
const Util = require('./util.js').Util
const BuildContext = require('./build-configuration.js')
  .BuildContext
const BuildConfiguration = require('./build-configuration.js')
  .BuildConfiguration
const BuildTarget = require('./build-configuration.js').BuildTarget
const BuildProfile = require('./build-configuration.js').BuildProfile
const BuildOptions = require('./build-configuration.js').BuildOptions
const BuildArtefact = require('./build-configuration.js').BuildArtefact
const Macros = require('./macros.js').Macros

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have identical names, but placed within `promises_`.
// Promisifier.promisifyInPlace(fs, 'readFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
// const fsPromises = fs.promises_

// ============================================================================

/**
 *
 * @description
 *
 * The order of preferences:
 * - configuration
 * - profiles(s)
 * - toolchain
 * - target
 * - top (project)
 */
class XmakeParser {
  static isXmakeJson (name) {
    assert(name, 'There must be a name.')

    const Self = this

    if (name === Self.xmakeJsonFileName || name === Self.dotXmakeJsonFileName) {
      return true
    }
    return false
  }

  /**
   * @summary Create a parser instance to be used for all xmake.json files.
   *
   * @param {Object} context The parser context.
   * @param {Object} context.log The logger.
   * @param {Object} context.cwd The absolute CWD path.
   */
  constructor (context) {
    assert(context, 'There must be a context')

    assert(context.log, 'There must be a context.log.')
    this.log = context.log

    assert(context.cwd, 'There must be a context.cwd.')
    this.cwd = context.cwd
  }

  /**
   * @summary Parse the xmake.json and prepare the build context.
   *
   * @async
   * @param {String} folderAbsolutePath Folder where the xmake is located.
   * @param {Object} options Optional tweaks; if none, assume main application.
   * @param {boolean} options.meta True if part of folder metadata.
   * @param {boolean} options.test True if test.
   * @param {Object} options.discovered The discovered folders.
   * @returns {BuildContext} A build context.
   * @throws SyntaxError
   * @throws Error ENOENT: no such file or directory, open ...
   * @throws Error ...
   *
   * @description
   * Multi-version, must accommodate all previous official versions.
   *
   */
  async parse (folderAbsolutePath, options = {}) {
    assert(folderAbsolutePath, 'There must be a folder path')

    assert(options.projectName, 'There must be an options.projectName.')

    const log = this.log
    log.trace(`${this.constructor.name}.parse('${folderAbsolutePath}')`)

    this.buildContext = new BuildContext({
      log
    })
    this.buildContext.projectName = options.projectName

    let fileAbsolutePath
    let json

    try {
      fileAbsolutePath = path.join(folderAbsolutePath,
        XmakeParser.xmakeJsonFileName)
      json = await JsonCache.parse(fileAbsolutePath)
    } catch (ex) {
      // console.log(ex)
      if (ex instanceof SyntaxError) {
        throw ex
      } else {
        try {
          fileAbsolutePath = path.join(folderAbsolutePath,
            XmakeParser.dotXmakeJsonFileName)
          json = await JsonCache.parse(fileAbsolutePath)
        } catch (ex2) {
          if (ex2 instanceof SyntaxError) {
            throw ex2
          } else {
            // console.log(ex2)
            throw new Error(
              `Missing mandatory 'xmake.json' file.`)
          }
        }
      }
    }

    const relativePath = path.relative(this.cwd, fileAbsolutePath)
    log.verbose(`Parsing '${relativePath}'...`)

    if (!json.schemaVersion) {
      throw new Error(
        `Missing schemaVersion in '${relativePath}'.`)
    }

    // Return the actual json.
    this.buildContext.json = json

    log.trace(`xmake schemaVersion '${json.schemaVersion}'`)
    if (json.schemaVersion.startsWith('0.2.')) {
      await this.parse02x_()
    } else {
      throw new Error(
        `Unsupported schemaVersion ${json.schemaVersion} in '${relativePath}'.`)
    }

    // Return the discovered folders.
    this.buildContext.discovered = options.discovered

    if (this.buildContext.buildConfigurations) {
      // Collect all contributed folders, remove unwanted ones,
      // and update the configurations with the result.
      for (const buildConfiguration of this.buildContext.buildConfigurations) {
        this.prepareArtefact_(buildConfiguration)
        this.prepareSourceFolders_(buildConfiguration)
        this.prepareIncludeFolders_(buildConfiguration)
        this.prepareSymbols_(buildConfiguration)
        this.prepareOptions_(buildConfiguration)
        this.prepareMisc_(buildConfiguration)
      }
    }

    return this.buildContext
  }

  /**
   * @summary Parse the schema 0.2.x files.
   * @returns {undefined} Nothing.
   */
  async parse02x_ () {
    const log = this.log
    log.trace(`${this.constructor.name}.parse02x()`)

    const buildContext = this.buildContext
    const json = buildContext.json

    if (json.name) {
      if (Util.isString(json.name)) {
        buildContext.name = json.name
      } else {
        throw new TypeError(`The 'name' property must be a string.`)
      }
    } else {
    }

    if (json.generator) {
      if (Util.isString(json.generator)) {
        buildContext.generatorName = json.generator
      } else {
        throw new TypeError(`The 'generator' property must be a string.`)
      }
    }

    if (json.commands) {
      if (Util.isObject(json.commands)) {
        for (const [name, value] of Object.entries(json.commands)) {
          this.buildContext.commands[name] = Util.validateStringArray(value)
        }
      } else {
        throw new TypeError(`The 'commands' property must be an object.`)
      }
    }

    this.parseCommon02x_(buildContext, json)

    for (const folder of buildContext.addSourceFolders) {
      this.log.verbose('- add source folder ' +
        `'${this.makePathRelative_(folder)}'`)
    }

    for (const folder of buildContext.addIncludeFolders) {
      this.log.verbose('- add include folder ' +
        `'${this.makePathRelative_(folder)}'`)
    }

    if (json.toolchains) {
      if (Util.isObject(json.toolchains)) {
        for (const [name, toolchainJson] of Object.entries(json.toolchains)) {
          // For this version the internal toolchain definition is exactly the
          // same as the JSON definition; for other versions, additional
          // transformations might be needed.
          ToolchainCache.add(name, toolchainJson, {
            log: this.log
          })
        }
      } else {
        throw new TypeError(`The 'toolchains' property must be an object.`)
      }
    }

    if (json.targets) {
      if (Util.isObject(json.targets)) {
        for (const [name, targetJson] of Object.entries(json.targets)) {
          const target = this.parseBuildTarget02x_(name,
            targetJson)

          // Link back to the build context.
          target.buildContext = this.buildContext

          // Contribute to the targets object.
          this.buildContext.buildTargets[name] = target
        }
      } else {
        throw new TypeError(`The 'targets' property must be an object.`)
      }
    }

    if (json.profiles) {
      if (Util.isObject(json.profiles)) {
        for (const [name, profileJson] of Object.entries(json.profiles)) {
          const profile = this.parseBuildProfile02x_(name,
            profileJson)

          // Link back to the build context.
          profile.buildContext = this.buildContext

          // Contribute to the targets object.
          this.buildContext.buildProfiles[name] = profile
        }
      } else {
        throw new TypeError(`The 'profiles' property must be an object.`)
      }
    }

    if (json.configurations) {
      if (Util.isObject(json.configurations)) {
        for (const [name, configJson] of Object.entries(json.configurations)) {
          const buildConfiguration = this.parseConfiguration02x_(name,
            configJson, this.buildContext)

          // Contribute to the configurations array.
          this.buildContext.buildConfigurations.push(buildConfiguration)
        }
      } else {
        throw new TypeError(`The 'configurations' property must be an object.`)
      }
    }
  }

  parseCommon02x_ (dest, json) {
    // Collect the artefact. Possibly undefined.
    if (json.artefact) {
      dest.artefact = new BuildArtefact(json.artefact)
    } else if (json.artifact) {
      // Prefer the british spelling, but also accept the american one.
      dest.artefact = new BuildArtefact(json.artifact)
    }

    // Collect the source folders. Always arrays.
    dest.addSourceFolders = this.makePathsAbsolute_(
      json.addSourceFolders
    )
    dest.removeSourceFolders = this.makePathsAbsolute_(
      json.removeSourceFolders
    )

    // Collect the include folders. Always arrays.
    dest.addIncludeFolders = this.makePathsAbsolute_(
      json.addIncludeFolders
    )
    dest.removeIncludeFolders = this.makePathsAbsolute_(
      json.removeIncludeFolders
    )

    // Collect the symbols. Always arrays.
    dest.addSymbols = Util.validateStringArray(
      json.addSymbols)
    dest.removeSymbols = Util.validateStringArray(
      json.removeSymbols)

    // Collect toolchain options.
    if (json.options) {
      if (Util.isObject(json.options)) {
        dest.options = this.parseBuildOptions02x_(json.options)
      } else {
        throw new TypeError(`The 'options' property must be an object.`)
      }
    }

    if (json.language) {
      if (Util.isString(json.language)) {
        const language = json.language.trim().toLowerCase()
        if (language === 'c' || language === 'c++') {
          dest.language = language
        } else {
          throw new TypeError(`Unsupported 'language: ${language}' property.`)
        }
      } else {
        throw new TypeError(`The 'language' property must be a string.`)
      }
    }
  }

  parseBuildTarget02x_ (name, json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseBuildTarget02x_('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildTarget = new BuildTarget(name, {
      log
    })

    this.parseCommon02x_(buildTarget, json)

    return buildTarget
  }

  parseBuildProfile02x_ (name, json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseBuildProfile02x_('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildProfile = new BuildProfile(name, {
      log
    })

    this.parseCommon02x_(buildProfile, json)

    return buildProfile
  }

  parseBuildOptions02x_ (json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseBuildOptions02x_()`)

    const buildOptions = new BuildOptions()

    for (const prop of BuildOptions.properties) {
      buildOptions[prop] = Util.validateStringArray(json[prop])
    }
    return buildOptions
  }

  /**
   * @summary Parse a named build configuration.
   *
   * @param {String} name The configuration name.
   * @param {Object} json The configuration JSON definition.
   * @param {BuildContext} buildContext The build configuration.
   * @returns {BuildConfiguration} A build configuration.
   */
  parseConfiguration02x_ (name, json, buildContext) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseConfiguration02x('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildConfiguration = new BuildConfiguration(name, {
      log
    })

    // Link back to the build context.
    buildConfiguration.buildContext = buildContext

    this.parseCommon02x_(buildConfiguration, json)

    if (json.target) {
      const targetName = json.target
      if (Util.isString(targetName)) {
        if (buildContext.buildTargets.hasOwnProperty(targetName)) {
          buildConfiguration.target = buildContext.buildTargets[targetName]
        } else {
          throw new Error(
            `Missing target '${targetName}' for configuration '${name}'.`)
        }
      } else {
        throw new TypeError(`The 'target' property must be a string.`)
      }
    } else {
      throw new Error(
        `Missing target for configuration '${name}'.`)
    }

    // Collect the configuration toolchain.
    if (json.toolchain) {
      if (Util.isString(json.toolchain)) {
        buildConfiguration.toolchain = ToolchainCache.retrieve(
          json.toolchain, {
            log
          })
      } else {
        throw new TypeError(`The 'toolchain' property must be a string.`)
      }
    } else {
      throw new Error(
        `Missing toolchain for configuration '${name}'.`)
    }

    if (json.profiles) {
      const profileNames = Util.validateStringArray(json.profiles)
      for (const profileName of profileNames) {
        if (buildContext.buildProfiles.hasOwnProperty(profileName)) {
          // Contribute to the profiles array.
          buildConfiguration.profiles.push(
            buildContext.buildProfiles[profileName])
        } else {
          throw new Error(
            `Missing profile '${profileName}' for configuration '${name}'.`)
        }
      }
    } else {
      throw new Error(
        `Missing  for configuration '${name}'.`)
    }

    return buildConfiguration
  }

  /**
   * @summary Make array of absolute paths.
   *
   * @param {String|String[]} inputPaths Path or array of paths.
   * @returns {String[]} Array of absolute paths, possibly empty.
   * @throws TypeError If the input is not a string or an array of strings.
   *
   * @description
   * Process a path or an array of path, trim them and, if needed,
   * prefix them with the current path, to make them absolute.
   */
  makePathsAbsolute_ (inputPaths) {
    const absolutePaths = []

    if (inputPaths) {
      if (Array.isArray(inputPaths)) {
        for (const folderPath of inputPaths) {
          if (Util.isString(folderPath)) {
            if (path.isAbsolute(folderPath)) {
              absolutePaths.push(folderPath.trim())
            } else {
              absolutePaths.push(path.join(this.cwd, folderPath.trim()))
            }
          } else {
            throw new TypeError('Must be a string or an array of strings.')
          }
        }
      } else if (Util.isString(inputPaths)) {
        if (path.isAbsolute(inputPaths)) {
          absolutePaths.push(inputPaths.trim())
        } else {
          absolutePaths.push(path.join(this.cwd, inputPaths.trim()))
        }
      } else {
        throw new TypeError('Must be a string or an array of strings.')
      }
    }
    // If there is no input, it still returns an empty array.
    return absolutePaths
  }

  makePathRelative_ (inputPath) {
    return path.relative(this.cwd, inputPath.trim())
  }

  prepareArtefact_ (buildConfiguration) {
    const log = this.log
    const buildContext = buildConfiguration.buildContext

    const artefact = new BuildArtefact(buildConfiguration.artefact)
    // `fillFrom()` ignores undefined input.
    if (buildConfiguration.profiles) {
      for (const profile of buildConfiguration.profiles) {
        artefact.fillFrom(profile.artefact)
      }
    }
    artefact.fillFrom(buildConfiguration.toolchain.artefact)
    artefact.fillFrom(buildConfiguration.target.artefact)
    artefact.fillFrom(buildContext.artefact)

    if (artefact.type) {
      artefact.type = artefact.type.trim()
      if (BuildArtefact.types.indexOf(artefact.type) === -1) {
        throw new TypeError(
          `Artefact type '${artefact.type}' not supported.`)
      }
    } else {
      artefact.type = 'executable'
    }
    if (!artefact.name) {
      artefact.name = '$' + '{project.name}'
    }
    if (!artefact.outputPrefix) {
      artefact.outputPrefix = ''
    }
    if (!artefact.outputSuffix) {
      artefact.outputSuffix = ''
    }
    if (!artefact.extension) {
      artefact.extension = ''
    }

    const macroValues = {
      'project.name': buildConfiguration.buildContext.projectName
    }
    artefact.name = Macros.substitute(artefact.name, macroValues)

    log.trace(`artefact: '${artefact}'`)
    buildConfiguration.artefact = artefact
  }

  /**
   * @summary Compute and final source folders.
   *
   * @param {BuildConfiguration} buildConfiguration The build configuration
   * @returns {undefined} Nothing
   *
   * @description
   * The list of source folders will be used to create the source tree.
   *
   * The general rule is:
   * - all `add` folders are collected,
   * - all `remove` folders are collected
   * - duplicates are ignored and removals are processed.
   *
   * The following are considered:
   * - common folders (top JSON definitions)
   * - discovered folders
   * - target folders
   * - profile folders
   * - configuration folders
   *
   * The results is a sorted arrays of strings:
   * - `sourceFolders`
   */
  prepareSourceFolders_ (buildConfiguration) {
    const buildContext = buildConfiguration.buildContext
    const discovered = buildContext.discovered

    let folders

    // All are guaranteed to be arrays, possibly empty.
    folders = []
    if (buildContext.addSourceFolders !== 0) {
      folders = folders.concat(buildContext.addSourceFolders)
    }
    if (discovered.addSourceFolders.length !== 0) {
      folders = folders.concat(discovered.addSourceFolders)
    }
    if (buildConfiguration.target.addSourceFolders.length !== 0) {
      folders = folders.concat(buildConfiguration.target.addSourceFolders)
    }
    for (const profile of buildConfiguration.profiles) {
      if (profile.addSourceFolders.length !== 0) {
        folders = folders.concat(profile.addSourceFolders)
      }
    }
    if (buildConfiguration.addSourceFolders.length !== 0) {
      folders = folders.concat(buildConfiguration.addSourceFolders)
    }

    // TODO: add toolchain.

    // Create a set with all source folders to add.
    const sourceFolders = new Set(folders)

    // All are guaranteed to be arrays, possibly empty.
    folders = []
    if (buildContext.removeSourceFolders.length !== 0) {
      folders = folders.concat(buildContext.removeSourceFolders)
    }
    if (buildConfiguration.target.removeSourceFolders.length !== 0) {
      folders = folders.concat(buildConfiguration.target.removeSourceFolders)
    }
    for (const profile of buildConfiguration.profiles) {
      if (profile.removeSourceFolders.length !== 0) {
        folders = folders.concat(profile.removeSourceFolders)
      }
    }
    if (buildConfiguration.removeSourceFolders.length !== 0) {
      folders = folders.concat(buildConfiguration.removeSourceFolders)
    }

    // Delete the source folders to remove.
    for (const folder of folders) {
      sourceFolders.delete(folder)
    }
    // Use the spread operator to transform the set into an Array, and sort.
    buildConfiguration.sourceFolders = [...sourceFolders].sort()
  }

  /**
   * @summary Compute and override the include folders.
   *
   * @param {BuildConfiguration} buildConfiguration The build configuration
   * @returns {undefined} Nothing
   *
   * @description
   * The lists of include folders will be used to add properties
   * to the source tree root node.
   *
   * The following are considered:
   * - common folders (top JSON definitions)
   * - discovered folders
   * - configuration folders
   *
   * The results override the arrays of strings:
   * - `addIncludeFolders`
   * - `removeIncludeFolders`
   */
  prepareIncludeFolders_ (buildConfiguration) {
    const buildContext = buildConfiguration.buildContext
    const discovered = buildContext.discovered

    let folders

    // All three are guaranteed to be arrays.
    folders = []
    if (buildContext.addIncludeFolders !== 0) {
      folders = folders.concat(buildContext.addIncludeFolders)
    }
    if (discovered.addIncludeFolders.length !== 0) {
      folders = folders.concat(discovered.addIncludeFolders)
    }
    if (buildConfiguration.target.addIncludeFolders.length !== 0) {
      folders = folders.concat(buildConfiguration.target.addIncludeFolders)
    }
    for (const profile of buildConfiguration.profiles) {
      if (profile.addIncludeFolders.length !== 0) {
        folders = folders.concat(profile.addIncludeFolders)
      }
    }
    if (buildConfiguration.addIncludeFolders.length !== 0) {
      folders = folders.concat(buildConfiguration.addIncludeFolders)
    }

    // TODO: add toolchain.

    buildConfiguration.addIncludeFolders = folders

    // All are guaranteed to be arrays, possibly empty.
    folders = []
    if (buildContext.removeIncludeFolders.length !== 0) {
      folders = folders.concat(buildContext.removeIncludeFolders)
    }
    if (buildConfiguration.target.removeIncludeFolders.length !== 0) {
      folders = folders.concat(buildConfiguration.target.removeIncludeFolders)
    }
    for (const profile of buildConfiguration.profiles) {
      if (profile.removeIncludeFolders.length !== 0) {
        folders = folders.concat(profile.removeIncludeFolders)
      }
    }
    if (buildConfiguration.removeIncludeFolders.length !== 0) {
      folders = folders.concat(buildConfiguration.removeIncludeFolders)
    }

    buildConfiguration.removeIncludeFolders = folders
  }

  prepareSymbols_ (buildConfiguration) {
    const buildContext = buildConfiguration.buildContext

    let symbols

    symbols = []
    if (buildContext.addSymbols && buildContext.addSymbols.length !== 0) {
      symbols = symbols.concat(buildContext.addSymbols)
    }
    if (buildConfiguration.target.addSymbols &&
      buildConfiguration.target.addSymbols.length !== 0) {
      symbols = symbols.concat(buildConfiguration.target.addSymbols)
    }
    for (const profile of buildConfiguration.profiles) {
      if (profile.addSymbols && profile.addSymbols.length !== 0) {
        symbols = symbols.concat(profile.addSymbols)
      }
    }
    if (buildConfiguration.addSymbols &&
      buildConfiguration.addSymbols.length !== 0) {
      symbols = symbols.concat(buildConfiguration.addSymbols)
    }
    buildConfiguration.addSymbols = symbols

    symbols = []
    if (buildContext.removeSymbols) {
      symbols = symbols.concat(buildContext.removeSymbols)
    }
    if (buildConfiguration.target.removeSymbols) {
      symbols = symbols.concat(buildConfiguration.target.removeSymbols)
    }
    for (const profile of buildConfiguration.profiles) {
      if (profile.removeSymbols) {
        symbols = symbols.concat(profile.removeSymbols)
      }
    }
    if (buildConfiguration.removeSymbols) {
      symbols = symbols.concat(buildConfiguration.removeSymbols)
    }
    buildConfiguration.removeSymbols = symbols
  }

  prepareOptions_ (buildConfiguration) {
    const log = this.log
    const buildOptions = new BuildOptions()

    buildOptions.appendFrom(buildConfiguration.target.options)
    for (const profile of buildConfiguration.profiles) {
      buildOptions.appendFrom(profile.options)
    }
    buildOptions.appendFrom(buildConfiguration.options)

    log.trace(`options: ${buildOptions}`)
    // Override the configuration specific options with all collected options.
    buildConfiguration.options = buildOptions
  }

  prepareMisc_ (buildConfiguration) {
    const log = this.log
    let language = buildConfiguration.language
    if (!language) {
      for (const profile of buildConfiguration.profiles) {
        language = profile.language
        if (language) {
          break
        }
      }
    }
    if (!language) {
      language = buildConfiguration.target.language
    }
    if (!language) {
      language = 'c++'
    }
    log.trace(`language: ${language}`)
    // Override the configuration specific options with all collected options.
    buildConfiguration.language = language

    if (buildConfiguration.artefact.type === 'executable' ||
      buildConfiguration.artefact.type === 'sharedLib') {
      for (const tool of Object.values(buildConfiguration.toolchain.tools)) {
        if (tool.type === 'linker' &&
          tool.languages.indexOf(language) !== -1) {
          buildConfiguration.tool = tool
          break
        }
      }
    } if (buildConfiguration.artefact.type === 'staticLib') {
      for (const tool of Object.values(buildConfiguration.toolchain.tools)) {
        if (tool.type === 'archiver' &&
          tool.languages.indexOf(language) !== -1) {
          buildConfiguration.tool = tool
          break
        }
      }
    }
    if (!buildConfiguration.tool) {
      throw new Error('Cannot set tool to build artefact ' +
        `'${buildConfiguration.artefact.type}'`)
    }
  }
}

// ----------------------------------------------------------------------------

// Define file names as properties of the class.
XmakeParser.xmakeJsonFileName = 'xmake.json'
XmakeParser.dotXmakeJsonFileName = '.xmake.json'

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.XmakeParser = XmakeParser

// In ES6, it would be:
// export class XmakeParser { ... }
// ...
// import { XmakeParser } from '../utils/xmake-parser.js'

// ----------------------------------------------------------------------------
