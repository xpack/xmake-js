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

const JsonCache = require('./json-cache.js').JsonCache
const Util = require('./util.js').Util
const CFTopConfiguration = require('./cf-objects.js').CFTopConfiguration
const CFBuildConfiguration = require('./cf-objects.js')
  .CFBuildConfiguration
const CFFolder = require('./cf-objects.js').CFFolder
const CFFile = require('./cf-objects.js').CFFile
const CFSymbols = require('./cf-objects.js').CFSymbols
const CFIncludes = require('./cf-objects.js').CFIncludes
const CFSources = require('./cf-objects.js').CFSources
const CFTargetPlatform = require('./cf-objects.js').CFTargetPlatform
const CFOptionGroup = require('./cf-objects.js').CFOptionGroup
const CFTool = require('./cf-objects.js').CFTool
const CFCommon = require('./cf-objects.js').CFCommon
const CFToolchain = require('./cf-objects.js').CFToolchain
const CFToolchains = require('./cf-objects.js').CFToolchains
const CFArtefact = require('./cf-objects.js').CFArtefact
const Macros = require('./macros.js').Macros
const DMTree = require('./dm-objects.js').DMTree

// ============================================================================

/**
 *
 * @description
 *
 * The order of preferences:
 * - configuration
 * - group(s)
 * - targetPlatform
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
   * @param {Object} args Generic arguments.
   * @param {Object} context.log The logger.
   * @param {Object} context.cwd The absolute CWD path.
   * @param {Object} context.toolchainCache A reference to a toolchain cache.
   */
  constructor (args) {
    assert(Util.isObject(args), 'There must be args')

    assert(args.log, 'There must be an args.log.')
    this.log = args.log

    assert(args.cwd, 'There must be an args.cwd.')
    this.cwd = args.cwd

    assert(args.toolchainCache, 'There must be an args.toolchainCache.')
    this.toolchainCache = args.toolchainCache
  }

  /**
   * @summary Parse the xmake.json and prepare the build context.
   *
   * @async
   * @param {Object} args Generic arguments.
   * @param {String} args.folderAbsolutePath Folder where the xmake is located.
   * @param {String} args.purpose One of `project`, `test`, `meta`.
   * @param {Object} args.discovered The discovered folders.
   * @param {String} args.fileName The actual file name, no need to identify.
   * @param {String} args.baseFolderAbsolutePath For tests, the folder
   * where the project is located.
   * @returns {CFTopConfiguration} A top configuration.
   * @throws SyntaxError
   * @throws Error ENOENT: no such file or directory, open ...
   * @throws Error ...
   *
   * @description
   * Multi-version, must accommodate all previous official versions.
   *
   */
  async parse (args) {
    assert(Util.isObject(args))
    assert(Util.isString(args.folderAbsolutePath),
      'There must be a string folder path')

    const log = this.log
    log.trace(`${this.constructor.name}.parse()`)

    const topConfiguration = new CFTopConfiguration({
      log
    })
    topConfiguration.actual.args = args

    topConfiguration.actual.cwd = this.cwd
    topConfiguration.actual.folderAbsolutePath = args.folderAbsolutePath
    topConfiguration.actual.folderRelativePath =
      path.relative(this.cwd, topConfiguration.actual.folderAbsolutePath)
    topConfiguration.actual.xmakeParser = this

    if (!args.baseFolderAbsolutePath) {
      args.baseFolderAbsolutePath = this.cwd
    }

    if (args.purpose === 'project') {
      assert(args.projectName, 'There must be an options.projectName.')
      topConfiguration.actual.name = args.projectName
    }

    if (args.purpose === 'test') {
      assert(args.topProject, 'There must be an options.topProject.')
      topConfiguration.topProject = args.topProject

      assert(args.baseFolderAbsolutePath,
        'There must be an options.baseFolderAbsolutePath.')

      const parts = topConfiguration.actual.folderRelativePath.split(path.sep)
      topConfiguration.configNamePrefix = parts.join('-').toLowerCase()

      topConfiguration.actual.name = topConfiguration.configNamePrefix
    }

    let fileAbsolutePath
    let json

    if (args.fileName) {
      try {
        fileAbsolutePath = path.join(args.folderAbsolutePath, args.fileName)
        json = await JsonCache.parse(fileAbsolutePath)
      } catch (ex) {
        if (ex instanceof SyntaxError) {
          throw ex
        } else {
          // console.log(ex2)
          throw new Error(
            `Erroneous '${args.fileName}'.`)
        }
      }
    } else {
      try {
        // Try the un-dotted name.
        fileAbsolutePath = path.join(args.folderAbsolutePath,
          XmakeParser.xmakeJsonFileName)
        json = await JsonCache.parse(fileAbsolutePath)
      } catch (ex) {
        // console.log(ex)
        if (ex instanceof SyntaxError) {
          throw ex
        } else {
          try {
            // Try the dotted name.
            fileAbsolutePath = path.join(args.folderAbsolutePath,
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
    }
    topConfiguration.actual.fileAbsolutePath = fileAbsolutePath

    const relativePath = path.relative(this.cwd, fileAbsolutePath)
    log.verbose(`Parsing '${relativePath}'...`)

    if (!json.schemaVersion) {
      throw new Error(
        `Missing schemaVersion in '${relativePath}'.`)
    }

    // Return the actual json.
    topConfiguration.json = json

    log.trace(`xmake schemaVersion '${json.schemaVersion}'`)
    if (json.schemaVersion.startsWith('0.2.')) {
      this.versionedParser = new XmakeParser02x({
        ...this
      })
    } else {
      throw new Error(
        `Unsupported schemaVersion ${json.schemaVersion} in '${relativePath}'.`)
    }
    await this.versionedParser.parse(topConfiguration)

    // Return the discovered folders.
    topConfiguration.discovered = {}
    if (args.discovered) {
      topConfiguration.discovered.sources = new CFSources({
        log,
        addSourceFolders: args.discovered.addSourceFolders
      })
      topConfiguration.discovered.includes = new CFIncludes({
        log,
        addIncludeFolders: args.discovered.addIncludeFolders
      })
    } else {
      topConfiguration.discovered.sources = new CFSources({
        log
      })
      topConfiguration.discovered.includes = new CFIncludes({
        log
      })
    }

    return topConfiguration
  }

  // --------------------------------------------------------------------------

  postProcessConfiguration (buildConfiguration) {
    return this.versionedParser.postProcessConfiguration(buildConfiguration)
  }

  // --------------------------------------------------------------------------

  async createSourceTree (buildConfiguration, buildFolderPath) {
    const log = this.log
    log.trace(`${this.constructor.name}.createSourceTree(` +
      `'${buildConfiguration.name}')`)

    // Preferably set these before creating the source tree.
    buildConfiguration.actual.buildAbsolutePath =
       path.join(this.cwd, buildFolderPath, buildConfiguration.actual.name)

    buildConfiguration.actual.buildToProjectRelativePath =
       path.relative(buildConfiguration.actual.buildAbsolutePath, this.cwd)

    const sourceTree = new DMTree({
      log,
      cwd: this.cwd,
      tool: buildConfiguration.actual.tool, // Artefact tool.
      toolchain: buildConfiguration.toolchain,
      language: buildConfiguration.actual.language,
      xmakeParser: this
    })

    // TODO: if empty, should we use defaults?
    if (buildConfiguration.actual.sourceFolders.length === 0) {
      throw new Error(`No source folders defined.`)
    }
    await sourceTree.create(buildConfiguration.actual.sourceFolders)

    buildConfiguration.actual.sourceTree = sourceTree
    // Add a shortcut to the top tree node; all other will be done
    // in addNodeProperties().
    buildConfiguration.actual.folders[''].node = sourceTree

    // To compute the relative paths, it needs the `buildAbsolutePath`.
    sourceTree.addNodesProperties(buildConfiguration)

    // Contribute sourceFolderNodes to the build configuration.
    buildConfiguration.actual.sourceFolderNodes = sourceTree.sourceFolderNodes

    // Contribute an array of used tools to the build configuration.
    buildConfiguration.actual.usedTools = sourceTree.usedTools
  }

  // --------------------------------------------------------------------------

  /**
   * @summary Make array of absolute paths.
   *
   * @param {String|String[]} inputPaths Path or array of paths.
   * @param {String} baseFolderAbsolutePath path to test folder.
   * @returns {String[]} New array of absolute paths, possibly empty.
   * @throws TypeError If the input is not a string or an array of strings.
   *
   * @description
   * Process a path or an array of path, trim them and, if needed,
   * prefix them with the current path, to make them absolute.
   * Also normalize.
   */
  makePathsAbsolute_ (inputPaths, baseFolderAbsolutePath) {
    assert(baseFolderAbsolutePath)
    const absolutePaths = []

    if (inputPaths) {
      if (Array.isArray(inputPaths)) {
        for (const folderPath of inputPaths) {
          if (Util.isString(folderPath)) {
            if (path.isAbsolute(folderPath)) {
              absolutePaths.push(path.normalize(folderPath.trim()))
            } else {
              absolutePaths.push(path.normalize(
                path.join(baseFolderAbsolutePath, folderPath.trim())))
            }
          } else {
            throw new TypeError('Must be a string or an array of strings.')
          }
        }
      } else if (Util.isString(inputPaths)) {
        if (path.isAbsolute(inputPaths)) {
          absolutePaths.push(path.normalize(inputPaths.trim()))
        } else {
          absolutePaths.push(path.normalize(
            path.join(baseFolderAbsolutePath, inputPaths.trim())))
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
}

// ============================================================================

class XmakeParser02x extends XmakeParser {
  /**
   * @summary Parse files following the 0.2.x schema.
   * @param {CFTopConfiguration} topConfiguration The top configuration.
   * @returns {undefined} Nothing.
   */
  async parse (topConfiguration) {
    assert(topConfiguration instanceof CFTopConfiguration,
      'There must be a topConfiguration.')

    const log = this.log
    log.trace(`${this.constructor.name}.parse()`)

    const json = topConfiguration.json

    if (['project', 'top', 'test'].includes(
      topConfiguration.actual.args.purpose)) {
      if (json.name) {
        if (Util.isValidName(json.name)) {
          topConfiguration.name = json.name
        } else {
          throw new TypeError(
            `The 'name' property must be an alphanumeric string.`)
        }
      }

      topConfiguration.builders = {}
      if (json.builders) {
        if (Util.isObject(json.builders)) {
          for (const [name, builder] of
            Object.entries(json.builders)) {
            const builderName = name.toLowerCase()
            topConfiguration.builders[builderName] = {}
            topConfiguration.builders[builderName].command = builder.command
            if (builder.default) {
              topConfiguration.builders[builderName].default = true
            }
          }
        } else {
          throw new TypeError(`The 'builders' property must be an object.`)
        }
      }
      if (['project', 'top'].includes(topConfiguration.actual.args.purpose)) {
        // Add default builders.
        if (!topConfiguration.builders.make) {
          topConfiguration.builders.make = {
            command: ['make']
          }
        }
        if (!topConfiguration.builders.ninja) {
          topConfiguration.builders.ninja = {
            command: ['ninja']
          }
        }
      }

      // Must be processed before properties that add toolchain related
      // options, like configurations, targetPlatforms, folders, files.
      if (json.toolchains) {
        if (Util.isObject(json.toolchains)) {
          for (const [name, toolchainJson] of Object.entries(json.toolchains)) {
            // For this version the internal toolchain definition is exactly the
            // same as the JSON definition; for other versions, additional
            // transformations might be needed.
            this.toolchainCache.add(name, toolchainJson)
          }
        } else {
          throw new TypeError(`The 'toolchains' property must be an object.`)
        }
      }

      topConfiguration.targetArtefact = this.parseTargetArtefact_(json)

      topConfiguration.language = this.parseLanguage_(json)

      topConfiguration.sources =
        this.parseSourceFolders_(json, topConfiguration)

      topConfiguration.folders = this.parseFolders_(
        json,
        topConfiguration.actual.folderAbsolutePath,
        topConfiguration
      )
      if (!topConfiguration.folders['']) {
        // To simplify things, always have a top folder, even empty.
        topConfiguration.folders[''] = new CFFolder({
          log,
          name: ''
        })
      }

      topConfiguration.files = this.parseFiles_(
        json,
        topConfiguration.actual.folderAbsolutePath,
        topConfiguration
      )

      for (const folder of topConfiguration.sources.addSourceFolders) {
        this.log.verbose('- source folder ' +
          `'${this.makePathRelative_(folder)}'`)
      }

      if (json.targetPlatforms) {
        if (Util.isObject(json.targetPlatforms)) {
          for (const [name, targetJson] of
            Object.entries(json.targetPlatforms)) {
            const targetPlatform = this.parseTargetPlatforms_(name,
              targetJson, topConfiguration)

            // Link back to the project.
            targetPlatform.topConfiguration = topConfiguration

            // Contribute to the targetPlatforms object.
            topConfiguration.targetPlatforms[name] = targetPlatform
          }
        } else {
          throw new TypeError(
            `The 'targetPlatforms' property must be an object.`)
        }
      }

      // Must be placed before processing configurations.
      if (json.optionGroups) {
        if (Util.isObject(json.optionGroups)) {
          for (const [name, optionGroupJson] of
            Object.entries(json.optionGroups)) {
            const optionGroup = this.parseOptionGroup_(name,
              optionGroupJson, topConfiguration)

            // Link back to the project.
            optionGroup.topConfiguration = topConfiguration

            // Contribute to the top object.
            topConfiguration.optionGroups[name] = optionGroup
          }
        } else {
          throw new TypeError(`The 'optionGroups' property must be an object.`)
        }
      }

      // Must be placed before processing configurations.
      topConfiguration.exportCompilationDatabase = true
      if (json.hasOwnProperty('exportCompilationDatabase')) {
        if (typeof (json.exportCompilationDatabase) === 'boolean') {
          topConfiguration.exportCompilationDatabase =
            json.exportCompilationDatabase
        } else {
          throw new TypeError(
            `The 'exportCompilationDatabase' property must be boolean.`)
        }
      }

      // Must be placed after processing option groups.
      if (json.buildConfigurations) {
        if (Util.isObject(json.buildConfigurations)) {
          for (const [name, configJson] of
            Object.entries(json.buildConfigurations)) {
            if (topConfiguration.configNamePrefix) {
              if (!name.toLowerCase()
                .startsWith(topConfiguration.configNamePrefix)) {
                log.warn(`Configuration '${name}' does not start with 
                ` + `'${topConfiguration.configNamePrefix}', ignored.`)
                continue
              }
            }
            const buildConfiguration = this.parseBuildConfiguration_(
              name,
              configJson,
              topConfiguration
            )

            // Contribute to the configurations object.
            topConfiguration.buildConfigurations[name] = buildConfiguration
          }
        } else {
          throw new TypeError(
            `The 'buildConfigurations' property must be an object.`)
        }
      }
    }
  }

  parseTargetPlatforms_ (name, json, topConfiguration) {
    assert(topConfiguration)

    const log = this.log
    log.trace(`${this.constructor.name}.parseTargetPlatforms_('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildTargetPlatform = new CFTargetPlatform({
      log,
      name,
      targetArtefact: this.parseTargetArtefact_(json),
      sources: this.parseSourceFolders_(json, topConfiguration),
      includes: this.parseIncludes_(json, topConfiguration),
      symbols: this.parseSymbols_(json),
      toolchainsOptions: this.parseToolchainsOptions_(json),
      doMoveAll: true
    })

    return buildTargetPlatform
  }

  parseOptionGroup_ (name, json, topConfiguration) {
    assert(topConfiguration)

    const log = this.log
    log.trace(`${this.constructor.name}.parseOptionGroup_('${name}')`)

    const buildOptionGroup = new CFOptionGroup({
      log,
      name,
      sources: this.parseSourceFolders_(json, topConfiguration),
      includes: this.parseIncludes_(json, topConfiguration),
      symbols: this.parseSymbols_(json),
      toolchainsOptions: this.parseToolchainsOptions_(json),
      targetArtefact: this.parseTargetArtefact_(json),
      language: this.parseLanguage_(json),
      doMoveAll: true
    })

    return buildOptionGroup
  }

  /**
   * @summary Parse a named build configuration.
   *
   * @param {String} name The configuration name.
   * @param {Object} json The configuration JSON definition.
   * @param {CFTopConfiguration} topConfiguration The build configuration.
   * @returns {CFBuildConfiguration} A build configuration.
   */
  parseBuildConfiguration_ (name, json, topConfiguration) {
    assert(topConfiguration)

    const log = this.log
    log.trace(`${this.constructor.name}.parseBuildConfiguration_('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildConfiguration = new CFBuildConfiguration({
      name,
      log
    })

    // Link back to the project.
    buildConfiguration.topConfiguration = topConfiguration

    buildConfiguration.sources =
      this.parseSourceFolders_(json, topConfiguration)
    buildConfiguration.targetArtefact = this.parseTargetArtefact_(json)
    buildConfiguration.language = this.parseLanguage_(json)

    // The global options are also parsed by parseFolders(),
    // since the results are stored as a root folder.
    buildConfiguration.folders = this.parseFolders_(
      json,
      topConfiguration.actual.folderAbsolutePath,
      topConfiguration
    )
    if (!buildConfiguration.folders['']) {
      // To simplify things, always have a top folder, even empty.
      buildConfiguration.folders[''] = new CFFolder({
        log,
        name: ''
      })
    }
    buildConfiguration.files = this.parseFiles_(
      json,
      topConfiguration.actual.folderAbsolutePath,
      topConfiguration
    )

    if (json.targetPlatform) {
      const targetName = json.targetPlatform
      if (Util.isString(targetName)) {
        if (topConfiguration.targetPlatforms.hasOwnProperty(targetName)) {
          buildConfiguration.targetPlatform =
            topConfiguration.targetPlatforms[targetName]
        } else if (topConfiguration.topProject && topConfiguration
          .topProject.targetPlatforms.hasOwnProperty(targetName)) {
          buildConfiguration.targetPlatform =
            topConfiguration.topProject.targetPlatforms[targetName]
        } else {
          throw new Error(`Missing targetPlatform '${targetName}'` +
            ` for configuration '${name}'.`)
        }
      } else {
        throw new TypeError(`The 'targetPlatform' property must be a string.`)
      }
    } else {
      // Empty unnamed platform.
      buildConfiguration.targetPlatform = new CFTargetPlatform({
        log,
        name: ''
      })
    }

    // Collect the configuration toolchain.
    if (json.toolchain) {
      if (Util.isString(json.toolchain)) {
        buildConfiguration.toolchain =
          this.toolchainCache.retrieve(json.toolchain)
      } else {
        throw new TypeError(`The 'toolchain' property must be a string.`)
      }
    } else {
      throw new Error(
        `Missing toolchain for configuration '${name}'.`)
    }

    // Collect the references of the option groups.
    if (json.optionGroups) {
      const groupNames = Util.validateStringArray(json.optionGroups)
      for (const groupName of groupNames) {
        if (topConfiguration.optionGroups.hasOwnProperty(groupName)) {
          // Contribute to the optionGroups array.
          buildConfiguration.optionGroups.push(
            topConfiguration.optionGroups[groupName])
        } else if (topConfiguration.topProject &&
          topConfiguration.topProject.optionGroups.hasOwnProperty(groupName)) {
          buildConfiguration.optionGroups.push(
            topConfiguration.topProject.optionGroups[groupName])
        } else {
          throw new Error(
            `Missing optionGroup '${groupName}' for configuration '${name}'.`)
        }
      }
    }

    buildConfiguration.exportCompilationDatabase =
      topConfiguration.exportCompilationDatabase
    if (json.hasOwnProperty('exportCompilationDatabase')) {
      if (typeof (json.exportCompilationDatabase) === 'boolean') {
        buildConfiguration.exportCompilationDatabase =
          json.exportCompilationDatabase
      } else {
        throw new TypeError(
          `The 'exportCompilationDatabase' property must be boolean.`)
      }
    }

    return buildConfiguration
  }

  // --------------------------------------------------------------------------

  /**
   * @summary Parse source folders properties.
   *
   * @param {Object} json Input JSON object.
   * @param {CFTopConfiguration} topConfiguration Reference to project.
   * @returns {CFSources} An object with the source folders.
   *
   * @description
   */
  parseSourceFolders_ (json, topConfiguration) {
    assert(topConfiguration)

    const log = this.log
    log.trace(`${this.constructor.name}.parseSourceFolders_()`)

    const baseFolderAbsolutePath =
      topConfiguration.actual.args.baseFolderAbsolutePath
    // Collect the source folders. Always arrays of absolute paths,
    // possibly empty.
    const sources = new CFSources({
      log,
      addSourceFolders: this.makePathsAbsolute_(
        json.addSourceFolders, baseFolderAbsolutePath),
      removeSourceFolders: this.makePathsAbsolute_(
        json.removeSourceFolders, baseFolderAbsolutePath),
      doMoveAll: true
    })

    if (sources.hasContent()) {
      log.trace(sources)
    }
    return sources
  }

  parseIncludes_ (json, topConfiguration) {
    assert(topConfiguration)
    const log = this.log
    log.trace(`${this.constructor.name}.parseIncludes_()`)

    const baseFolderAbsolutePath =
      topConfiguration.actual.args.baseFolderAbsolutePath
    // Collect the include folders. Always arrays of absolute paths,
    // possibly empty.
    const includes = new CFIncludes({
      log,
      addIncludeFolders: this.makePathsAbsolute_(
        json.addIncludeFolders, baseFolderAbsolutePath),
      removeIncludeFolders: this.makePathsAbsolute_(
        json.removeIncludeFolders, baseFolderAbsolutePath),
      addIncludeSystemFolders: this.makePathsAbsolute_(
        json.addIncludeSystemFolders, baseFolderAbsolutePath),
      removeIncludeSystemFolders: this.makePathsAbsolute_(
        json.removeIncludeSystemFolders, baseFolderAbsolutePath),
      addIncludeFiles: this.makePathsAbsolute_(
        json.addIncludeFiles, baseFolderAbsolutePath),
      removeIncludeFiles: this.makePathsAbsolute_(
        json.removeIncludeFiles, baseFolderAbsolutePath),
      doMoveAll: true
    })

    if (includes.hasContent()) {
      log.trace(includes)
    }
    return includes
  }

  parseSymbols_ (json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseSymbols_()`)

    // Collect the preprocessor symbols. Always arrays, possibly empty.
    const symbols = new CFSymbols({
      log,
      addDefinedSymbols: Util.validateStringArray(json.addDefinedSymbols),
      removeDefinedSymbols: Util.validateStringArray(json.removeDefinedSymbols),
      addUndefinedSymbols: Util.validateStringArray(json.addUndefinedSymbols),
      removeUndefinedSymbols:
        Util.validateStringArray(json.removeUndefinedSymbols),
      doMoveAll: true
    })

    if (symbols.hasContent()) {
      log.trace(symbols)
    }
    return symbols
  }

  parseTargetArtefact_ (json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseTargetArtefact_()`)

    // Collect the artefact. Possibly undefined.
    let targetArtefact
    if (json.targetArtefact) {
      targetArtefact = new CFArtefact(json.targetArtefact)
    } else if (json.targetArtifact) {
      // Prefer the british spelling, but also accept the american one.
      targetArtefact = new CFArtefact(json.targetArtifact)
    }

    if (targetArtefact) {
      log.trace(targetArtefact)
    }
    return targetArtefact
  }

  parseToolchainsOptions_ (json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseToolchainsOptions_()`)

    // Collect multiple toolchains options. Possibly empty.
    const toolchainsOptions = new CFToolchains({
      log
    })
    if (json.toolchainsOptions) {
      if (Util.isObject(json.toolchainsOptions)) {
        for (const [toolchainName, jsonValue] of
          Object.entries(json.toolchainsOptions)) {
          const toolchain = this.toolchainCache.retrieve(toolchainName)
          toolchainsOptions.add(toolchainName,
            this.parseToolchainOptions_(jsonValue, toolchain))
        }
      } else {
        throw new TypeError(
          `The 'toolchainsOptions' property must be an object.`)
      }
    }

    return toolchainsOptions
  }

  parseToolchainOptions_ (json, toolchain) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseToolchainOptions_(` +
      `'${toolchain.name}')`)

    // One toolchain options. All tools must be present, but will be empty.
    const toolchainOptions = new CFToolchain({
      log,
      toolchain,
      common: new CFCommon({
        log,
        suffixes: toolchain.configurationSuffixes,
        ...json
      }),
      doMoveAll: true
    })

    if (json.toolsOptions) {
      if (Util.isObject(json.toolsOptions)) {
        for (const [toolName, jsonValue] of Object.entries(json.toolsOptions)) {
          if (toolchain.tools.hasOwnProperty(toolName)) {
            toolchainOptions.tools[toolName].appendFrom(new CFTool({
              log,
              tool: toolchain.tools[toolName],
              ...jsonValue
            }))
          } else {
            throw new TypeError(`Toolchain '${toolchain.name}'` +
              `has not tool '${toolName}'.`)
          }
        }
      } else {
        throw new TypeError(
          `The 'toolsOptions' property must be an object.`)
      }
    }

    log.trace(toolchainOptions)
    return toolchainOptions
  }

  parseLanguage_ (json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseLanguage_()`)

    // Collect the language. Defaults to C++.
    let language = 'c++'
    if (json.language) {
      if (Util.isString(json.language)) {
        const lang = json.language.trim().toLowerCase()
        if (lang === 'c' || lang === 'c++') {
          language = lang
        } else {
          throw new TypeError(`Unsupported 'language: ${language}' property.`)
        }
      } else {
        throw new TypeError(`The 'language' property must be a string.`)
      }

      log.trace(language)
    }

    return language
  }

  parseFolders_ (json, folderAbsolutePath, topConfiguration) {
    assert(topConfiguration instanceof CFTopConfiguration)

    const log = this.log
    log.trace(`${this.constructor.name}.parseFolders_()`)

    const folders = {}

    // The root folder definitions are fetched from the same level,
    // not from an artificial '/' folder, as in Eclipse CDT.
    folders[''] = new CFFolder({
      log,
      name: '',
      includes: this.parseIncludes_(json, topConfiguration),
      symbols: this.parseSymbols_(json),
      toolchainsOptions: this.parseToolchainsOptions_(json),
      doMoveAll: true
    })

    if (json.folders) {
      for (const [name, folderJson] of Object.entries(json.folders)) {
        if (path.isAbsolute(name)) {
          throw new Error(`Folder path '${name}' cannot be absolute.`)
        }
        const absolutePath = path.normalize(
          path.join(folderAbsolutePath, name))
        const relativePath = path.posix.relative(folderAbsolutePath,
          absolutePath)

        const buildFolder = new CFFolder({
          log,
          name: relativePath,
          includes: this.parseIncludes_(folderJson, topConfiguration),
          symbols: this.parseSymbols_(folderJson),
          toolchainsOptions: this.parseToolchainsOptions_(folderJson),
          doMoveAll: true
        })

        folders[relativePath] = buildFolder
      }

      log.trace(Object.keys(folders))
    }

    return folders
  }

  parseFiles_ (json, folderAbsolutePath, topConfiguration) {
    assert(topConfiguration)

    const log = this.log
    log.trace(`${this.constructor.name}.parseFiles_()`)

    const files = {}

    if (json.files) {
      for (const [name, fileJson] of Object.entries(json.files)) {
        if (path.isAbsolute(name)) {
          throw new Error(`File path '${name}' cannot be absolute.`)
        }
        const absolutePath = path.normalize(
          path.join(folderAbsolutePath, name))
        const relativePath = path.posix.relative(folderAbsolutePath,
          absolutePath)

        const buildFile = new CFFile({
          log,
          name: relativePath,
          includes: this.parseIncludes_(fileJson, topConfiguration),
          symbols: this.parseSymbols_(fileJson),
          toolchainsOptions: this.parseToolchainsOptions_(fileJson),
          doMoveAll: true
        })
        files[relativePath] = buildFile
      }

      log.trace(Object.keys(files))
    }

    return files
  }

  // --------------------------------------------------------------------------
  // The above was the easy part. Now we must post process the original
  // input and make sense of it. This means mainly collecting related
  // definitions from different locations.

  postProcessConfiguration (buildConfiguration) {
    // Collect all contributed folders, remove unwanted ones,
    // and store the results in the configuration.

    buildConfiguration.actual.targetArtefact =
      this.postProcessTargetArtefact_(buildConfiguration)

    buildConfiguration.actual.sourceFolders =
      this.postProcessSourceFolders_(buildConfiguration)

    buildConfiguration.actual.folders =
      this.postProcessFolders_(buildConfiguration)

    // Add convenience shortcuts.
    buildConfiguration.actual.topFolder =
      buildConfiguration.actual.folders['']
    buildConfiguration.actual.toolchainOptions =
          buildConfiguration.actual.topFolder.toolchainOptions

    buildConfiguration.actual.files =
      this.postProcessFiles_(buildConfiguration)

    // Return multiple values.
    let result = this.postProcessMisc_(buildConfiguration)
    buildConfiguration.actual.language = result.language
    buildConfiguration.actual.tool = result.tool
  }

  /**
   * @summary Prepare artefact properties.
   * @param {CFBuildConfiguration} buildConfiguration Configuration.
   * @returns {CFArtefact} The updated artefact.
   *
   * @description
   * The order is bottom up:
   * - configuration
   * - optionGroup(s)
   * - target
   * - project.
   *
   * With each level up, only undefined values are set.
   */
  postProcessTargetArtefact_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.postProcessTargetArtefact_(` +
      `'${buildConfiguration.name}')`)

    const topConfiguration = buildConfiguration.topConfiguration

    const artefact = new CFArtefact(buildConfiguration.targetArtefact)
    // Notice: `fillFrom()` ignores undefined input.
    for (const optionGroup of buildConfiguration.optionGroups) {
      artefact.fillFrom(optionGroup.targetArtefact)
    }

    artefact.fillFrom(buildConfiguration.targetPlatform.targetArtefact)
    artefact.fillFrom(topConfiguration.targetArtefact)

    if (topConfiguration.topProject) {
      artefact.fillFrom(topConfiguration.topProject.targetArtefact)
    }

    // After doing our best to get data from the configuration, there still
    // may be some fields not defined, so consider reasonable defaults.
    if (artefact.type) {
      artefact.type = artefact.type.trim()
      if (CFArtefact.types.indexOf(artefact.type) === -1) {
        throw new TypeError(
          `Artefact type '${artefact.type}' not supported.`)
      }
    } else {
      artefact.type = 'executable'
    }
    if (!artefact.name) {
      artefact.name = '$' + '{build.name}'
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
      'build.name': buildConfiguration.topConfiguration.actual.name
    }
    artefact.name = Macros.substitute(artefact.name, macroValues)

    log.trace(`targetArtefact: '${artefact}'`)
    return artefact
  }

  /**
   * @summary Compute the final source folders.
   *
   * @param {CFBuildConfiguration} buildConfiguration The build
   * configuration.
   * @returns {String[]} Array of absolute paths.
   *
   * @description
   * Compute the list of absolute paths to the source folders that will be
   * used to create the source tree.
   *
   * The general rule is:
   * - all `add` folders are collected,
   * - all `remove` folders are collected
   * - duplicates are ignored and removals are processed.
   *
   * The following are considered:
   * - common folders (top JSON definitions)
   * - discovered folders
   * - targetPlatform folders
   * - optionGroup(s) folders
   * - configuration folders
   *
   * There are no source folders in folders/files/toolchainOptions.
   *
   * The results is a sorted arrays of strings (absolute paths).
   */
  postProcessSourceFolders_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.postProcessSourceFolders_(` +
      `'${buildConfiguration.name}')`)

    const topConfiguration = buildConfiguration.topConfiguration
    const discovered = topConfiguration.discovered

    let buildSources = new CFSources({
      log
    })

    buildSources.appendFrom(topConfiguration.sources)
    buildSources.appendFrom(discovered.sources)

    buildSources.appendFrom(buildConfiguration.targetPlatform.sources)
    for (const optionGroup of buildConfiguration.optionGroups) {
      buildSources.appendFrom(optionGroup.sources)
    }

    buildSources.appendFrom(buildConfiguration.sources)

    // Create a set with all source folders to add.
    const sourceFoldersSet = new Set(buildSources.addSourceFolders)

    // Delete the source folders to remove.
    for (const folder of buildSources.removeSourceFolders) {
      if (sourceFoldersSet.has(folder)) {
        sourceFoldersSet.delete(folder)
      } else {
        log.warning(`Source folder '${folder}' to remove not used.`)
      }
    }
    // Use the spread operator to transform the set into an Array, and sort.
    const sourceFolders = [...sourceFoldersSet].sort()
    log.trace(`sources: '${sourceFolders}'`)

    return sourceFolders
  }

  /**
   * @summary Compute the include folders and files for the root node.
   *
   * @param {CFBuildConfiguration} buildConfiguration The build
   * configuration.
   * @param {String} toolName The tool name
   * @returns {CFIncludes} Collected includes.
   *
   * @description
   * Compute the lists of absolute paths to include folders that will be used
   * to add properties to the source tree root node.
   *
   * The following are considered:
   * - targetPlatform
   * - global (top)
   * - discovered
   * - optionGroup(s)
   * - configuration
   *
   * Called from `prepareTopToolchainOptions_()`.
   */
  postProcessTopIncludes_ (buildConfiguration, toolName) {
    const log = this.log
    log.trace(`${this.constructor.name}.postProcessTopIncludes_(` +
      `'${buildConfiguration.name}', '${toolName}')`)

    const topConfiguration = buildConfiguration.topConfiguration

    let buildIncludes = new CFIncludes({
      log
    })

    buildIncludes.appendFrom(
      buildConfiguration.targetPlatform,
      buildConfiguration.toolchain,
      toolName
    )

    buildIncludes.appendFrom(
      topConfiguration.folders[''],
      buildConfiguration.toolchain,
      toolName
    )

    if (topConfiguration.discovered) {
      buildIncludes.appendFrom(topConfiguration.discovered.includes)
    }

    for (const optionGroup of buildConfiguration.optionGroups) {
      buildIncludes.appendFrom(
        optionGroup,
        buildConfiguration.toolchain,
        toolName
      )
    }

    buildIncludes.appendFrom(
      buildConfiguration.folders[''],
      buildConfiguration.toolchain,
      toolName
    )

    log.trace(`${buildIncludes}`)

    return buildIncludes
  }

  /**
   * @summary Prepare preprocessor symbols properties for the root node.
   * @param {CFBuildConfiguration} buildConfiguration Configuration.
   * @param {String} toolName The tool name
   * @returns {CFSymbols} The collected symbols.
   *
   * @description
   * Compute the lists of preprocessor symbols that will be used
   * to add properties to the source tree root node.
   *
   * The following are considered:
   * - targetPlatform
   * - global (top)
   * - optionGroup(s)
   * - configuration
   *
   * Called from `prepareTopToolchainOptions_()`.
   */
  postProcessTopSymbols_ (buildConfiguration, toolName) {
    const log = this.log
    log.trace(`${this.constructor.name}.postProcessTopSymbols_(` +
      `'${buildConfiguration.name}', '${toolName}')`)

    const topConfiguration = buildConfiguration.topConfiguration

    let buildSymbols = new CFSymbols({
      log
    })

    buildSymbols.appendFrom(
      buildConfiguration.targetPlatform,
      buildConfiguration.toolchain,
      toolName
    )

    buildSymbols.appendFrom(
      topConfiguration.folders[''],
      buildConfiguration.toolchain,
      toolName
    )

    for (const optionGroup of buildConfiguration.optionGroups) {
      buildSymbols.appendFrom(
        optionGroup,
        buildConfiguration.toolchain,
        toolName
      )
    }

    buildSymbols.appendFrom(
      buildConfiguration.folders[''],
      buildConfiguration.toolchain,
      toolName
    )

    log.trace(`${buildSymbols}`)

    return buildSymbols
  }

  /**
   * @summary Collect toolchain option properties for a buildConfiguration.
   * @param {CFBuildConfiguration} buildConfiguration The build onfiguration.
   * @returns {CFToolchain} The collected toolchain options.
   *
   * @description
   * The order is:
   * - targetPlatform
   * - [parent project, for tests]
   * - global (top)
   * - optionGroup(s)
   * - configuration
   *
   * Called from `prepareFolders_()`.
   */
  postProcessTopToolchainOptions_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.postProcessTopToolchainOptions_(` +
      `'${buildConfiguration.name}')`)

    const topConfiguration = buildConfiguration.topConfiguration

    // Start with an empty object, append later.
    const toolchainOptions = new CFToolchain({
      log,
      toolchain: buildConfiguration.toolchain
    })

    // The top toolchain is a bit tricky, since it must keep the common
    // options separate from the tool options (to simplify exporters),
    // but collect all includes and symbols per each compiler.

    // Collect options. Keep common separately from tool options, to
    // simplify exporters. Includes & symbols are left empty for now.
    toolchainOptions.appendOptionsFrom(
      buildConfiguration.targetPlatform.toolchainsOptions)

    if (topConfiguration.topProject) {
      toolchainOptions.appendOptionsFrom(
        topConfiguration.topProject.folders[''].toolchainsOptions)
    }

    toolchainOptions.appendOptionsFrom(
      topConfiguration.folders[''].toolchainsOptions)

    for (const optionGroup of buildConfiguration.optionGroups) {
      toolchainOptions.appendOptionsFrom(optionGroup.toolchainsOptions)
    }

    toolchainOptions.appendOptionsFrom(
      buildConfiguration.folders[''].toolchainsOptions)

    for (const [toolName, toolDef] of Object.entries(toolchainOptions.tools)) {
      if (toolDef.tool.hasSymbols) {
        toolDef.symbols =
            this.postProcessTopSymbols_(buildConfiguration, toolName)
      }
      if (toolDef.tool.hasIncludes) {
        toolDef.includes =
            this.postProcessTopIncludes_(buildConfiguration, toolName)
      }
    }

    if (log.isTrace()) {
      log.trace(`${toolchainOptions}`)
    }

    return toolchainOptions
  }

  /**
   * @summary Collect the folder definitions.
   * @param {CFBuildConfiguration} buildConfiguration The build
   * configuration.
   * @returns {XmakeFolders[]} The new array of folders.
   *
   * Consider the project definitions first, than the configuration definitions.
   */
  postProcessFolders_ (buildConfiguration) {
    const log = this.log

    log.trace(`${this.constructor.name}.postProcessFolders_(` +
      `'${buildConfiguration.name}')`)

    const topConfiguration = buildConfiguration.topConfiguration
    const folders = {}

    const topFolder = new CFFolder({
      log,
      name: '',
      toolchainOptions:
        this.postProcessTopToolchainOptions_(buildConfiguration),
      toolchain: buildConfiguration.toolchain,
      doMoveAll: true
    })
    folders[''] = topFolder

    // Consider the project folders first.
    for (const [name, folder] of Object.entries(topConfiguration.folders)) {
      if (name === '') {
        continue
      }
      // Collect options only for one toolchain.
      folders[name] = new CFFolder({
        log,
        ...folder,
        toolchain: buildConfiguration.toolchain
      })
    }

    // Then consider the configuration folders too.
    for (const [name, folder] of Object.entries(buildConfiguration.folders)) {
      if (name === '') {
        continue
      }
      if (!folders[name]) {
        // Collect options only for one toolchain.
        folders[name] = new CFFolder({
          log,
          ...folder,
          toolchain: buildConfiguration.toolchain
        })
      } else {
        folders[name].appendFrom(folder)
      }
    }

    if (log.isVerbose()) {
      for (const [folderName, folder] of Object.entries(folders)) {
        log.trace(`'${folderName}' ${folder.toolchainOptions}`)
      }
    }

    return folders
  }

  /**
   * @summary Collect the file definitions.
   * @param {CFBuildConfiguration} buildConfiguration The build
   * configuration.
   * @returns {XmakeFiles[]} The new array of files.
   *
   * Consider the project definitions first, than the configuration definitions.
   */
  postProcessFiles_ (buildConfiguration) {
    const log = this.log

    log.trace(`${this.constructor.name}.postProcessFiles_(` +
    `'${buildConfiguration.name}')`)

    const topConfiguration = buildConfiguration.topConfiguration
    const files = {}

    // Consider the project files first.
    for (const [name, file] of Object.entries(topConfiguration.files)) {
      // Collect options only for one toolchain.
      files[name] = new CFFile({
        log,
        ...file,
        toolchain: buildConfiguration.toolchain
      })
    }

    // Then consider the configuration files too.
    for (const [name, file] of Object.entries(buildConfiguration.files)) {
      if (!files[name]) {
        // Collect options only for one toolchain.
        files[name] = new CFFile({
          log,
          ...file,
          toolchain: buildConfiguration.toolchain
        })
      } else {
        files[name].appendFrom(file)
      }
    }

    if (log.isVerbose()) {
      for (const [folderName, file] of Object.entries(files)) {
        log.trace(`'${folderName}' ${file.includes}`)
        log.trace(`'${folderName}' ${file.symbols}`)
        log.trace(`'${folderName}' ${file.toolchainOptions}`)
      }
    }

    return files
  }

  /**
   * @summary Prepare miscellaneous properties, not fitting elsewhere.
   * @param {CFBuildConfiguration} buildConfiguration The build
   * configuration.
   * @returns {Object} Object with language and tool properties.
   */
  postProcessMisc_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareMisc_(` +
      `'${buildConfiguration.name}')`)

    let language = buildConfiguration.language
    if (!language) {
      for (const optionGroup of buildConfiguration.optionGroups) {
        language = optionGroup.language
        if (language) {
          break
        }
      }
    }
    if (!language) {
      language = buildConfiguration.targetPlatform.language
    }
    if (!language) {
      language = 'c++'
    }
    log.trace(`language: ${language}`)

    assert(buildConfiguration.actual.targetArtefact)
    let tool
    const type = buildConfiguration.actual.targetArtefact.type
    if (type === 'executable' || type === 'sharedLib') {
      for (const tl of
        Object.values(buildConfiguration.toolchain.tools)) {
        if (tl.type === 'linker' &&
          tl.languages.indexOf(language) !== -1) {
          tool = tl
          break
        }
      }
    } else if (type === 'staticLib') {
      for (const tl of
        Object.values(buildConfiguration.toolchain.tools)) {
        if (tl.type === 'archiver' &&
          tl.languages.indexOf(language) !== -1) {
          tool = tl
          break
        }
      }
    }
    if (!tool) {
      throw new Error('Cannot set tool to build artefact ' +
        `'${buildConfiguration.targetArtefact.type}'`)
    }

    return {
      language,
      tool
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------

// Define file names as properties of the class.
XmakeParser.xmakeJsonFileName = 'xmake.json'
XmakeParser.dotXmakeJsonFileName = '.xmake.json'
XmakeParser.dotXmakeIgnoreFileName = '.xmakeignore'

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
