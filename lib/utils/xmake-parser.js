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
const BuildProject = require('./build-configuration.js')
  .BuildProject
const BuildConfiguration = require('./build-configuration.js')
  .BuildConfiguration
const BuildFolder = require('./build-configuration.js').BuildFolder
const BuildFile = require('./build-configuration.js').BuildFile
const BuildSymbols = require('./build-configuration.js').BuildSymbols
const BuildIncludes = require('./build-configuration.js').BuildIncludes
const BuildSources = require('./build-configuration.js').BuildSources
const BuildTargetPlatform =
  require('./build-configuration.js').BuildTargetPlatform
const BuildOptionGroup =
  require('./build-configuration.js').BuildOptionGroup
const BuildToolOptions =
  require('./build-configuration.js').BuildToolOptions
const BuildCommonOptions =
  require('./build-configuration.js').BuildCommonOptions
const BuildToolchainOptions =
  require('./build-configuration.js').BuildToolchainOptions
const BuildToolchainsOptions =
  require('./build-configuration.js').BuildToolchainsOptions
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
   * @param {String} options.fileName The actual file name, no need to identify.
   * @returns {BuildProject} A build context.
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

    const log = this.log
    log.trace(`${this.constructor.name}.parse('${folderAbsolutePath}')`)

    const buildProject = new BuildProject()
    buildProject.options = options
    buildProject.folderAbsolutePath = folderAbsolutePath

    if (!options.meta) {
      assert(options.projectName, 'There must be an options.projectName.')
      buildProject.projectName = options.projectName
    }

    let fileAbsolutePath
    let json

    if (options.fileName) {
      try {
        fileAbsolutePath = path.join(folderAbsolutePath,
          options.fileName)
        json = await JsonCache.parse(fileAbsolutePath)
      } catch (ex2) {
        if (ex2 instanceof SyntaxError) {
          throw ex2
        } else {
          // console.log(ex2)
          throw new Error(
            `Erroneous '${options.fileName}'.`)
        }
      }
    } else {
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
    }
    buildProject.fileAbsolutePath = fileAbsolutePath

    const relativePath = path.relative(this.cwd, fileAbsolutePath)
    log.verbose(`Parsing '${relativePath}'...`)

    if (!json.schemaVersion) {
      throw new Error(
        `Missing schemaVersion in '${relativePath}'.`)
    }

    // Return the actual json.
    buildProject.json = json

    log.trace(`xmake schemaVersion '${json.schemaVersion}'`)
    if (json.schemaVersion.startsWith('0.2.')) {
      await this.parse02x_(buildProject)
    } else {
      throw new Error(
        `Unsupported schemaVersion ${json.schemaVersion} in '${relativePath}'.`)
    }

    // Return the discovered folders.
    buildProject.discovered = {}
    if (options.discovered) {
      buildProject.discovered.sources = new BuildSources(
        options.discovered.addSourceFolders)
      buildProject.discovered.includes = new BuildIncludes(
        options.discovered.addIncludeFolders)
    } else {
      buildProject.discovered.sources = new BuildSources()
      buildProject.discovered.includes = new BuildIncludes()
    }

    return buildProject
  }

  prepareConfiguration (buildConfiguration) {
    // Collect all contributed folders, remove unwanted ones,
    // and update the configurations with the result.
    this.prepareTargetArtefact_(buildConfiguration)
    this.prepareSourceFolders_(buildConfiguration)
    this.prepareRootIncludes_(buildConfiguration)
    this.prepareRootSymbols_(buildConfiguration)
    this.prepareToolchainsOptions_(buildConfiguration)
    this.prepareMisc_(buildConfiguration)
  }

  /**
   * @summary Parse the schema 0.2.x files.
   * @param {BuildProject} buildProject The build context.
   * @returns {undefined} Nothing.
   */
  async parse02x_ (buildProject) {
    const log = this.log
    log.trace(`${this.constructor.name}.parse02x()`)

    const json = buildProject.json

    if (!buildProject.options.meta) {
      if (json.name) {
        if (Util.isValidName(json.name)) {
          buildProject.name = json.name
        } else {
          throw new TypeError(
            `The 'name' property must be an alphanumeric string.`)
        }
      }

      buildProject.generators = {}
      if (json.generators) {
        if (Util.isObject(json.generators)) {
          for (const [name, generator] of
            Object.entries(json.generators)) {
            const generatorName = name.toLowerCase()
            buildProject.generators[generatorName] = {}
            buildProject.generators[generatorName].goals = {}
            if (generator.goals) {
              for (const [goalName, goal] of Object.entries(generator.goals)) {
                buildProject.generators[generatorName].goals[goalName] =
                  Util.validateStringArray(goal)
              }
            }
            if (generator.default) {
              buildProject.generators[generatorName].default = true
            }
          }
        } else {
          throw new TypeError(`The 'generators' property must be an object.`)
        }
      }
      // Add default generators.
      if (!buildProject.generators.make) {
        buildProject.generators.make = {
          goals: {
            '': ['make'],
            'clean': ['make', 'clean']
          }
        }
      }
      if (!buildProject.generators.ninja) {
        buildProject.generators.ninja = {
          goals: {
            '': ['ninja'],
            'clean': ['ninja', '-t', 'clean']
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
            ToolchainCache.add(name, toolchainJson, {
              log: this.log
            })
          }
        } else {
          throw new TypeError(`The 'toolchains' property must be an object.`)
        }
      }

      buildProject.sources = this.parseSourceFolders02x_(json)

      buildProject.targetArtefact = this.parseTargetArtefact02x_(json)

      buildProject.language = this.parseLanguage02x_(json)

      buildProject.folders = this.parseFolders02x_(json,
        buildProject.folderAbsolutePath)
      if (!buildProject.folders['']) {
        // To simplify things, always have a top folder, even empty.
        buildProject.folders[''] = new BuildFolder()
      }
      buildProject.files = this.parseFiles02x_(json,
        buildProject.folderAbsolutePath)

      for (const folder of buildProject.sources.addSourceFolders) {
        this.log.verbose('- source folder ' +
          `'${this.makePathRelative_(folder)}'`)
      }

      const topFolder = buildProject.folders['']
      for (const file of topFolder.includes.addIncludeFiles) {
        this.log.verbose('- include file ' +
          `'${this.makePathRelative_(file)}'`)
      }

      for (const folder of topFolder.includes.addIncludeSystemFolders) {
        this.log.verbose('- include system folder ' +
          `'${this.makePathRelative_(folder)}'`)
      }

      for (const folder of topFolder.includes.addIncludeFolders) {
        this.log.verbose('- include folder ' +
          `'${this.makePathRelative_(folder)}'`)
      }

      if (json.targetPlatforms) {
        if (Util.isObject(json.targetPlatforms)) {
          for (const [name, targetJson] of
            Object.entries(json.targetPlatforms)) {
            const targetPlatform = this.parseBuildTargetPlatforms02x_(name,
              targetJson)

            // Link back to the build context.
            targetPlatform.buildProject = buildProject

            // Contribute to the targetPlatforms object.
            buildProject.targetPlatforms[name] = targetPlatform
          }
        } else {
          throw new TypeError(
            `The 'targetPlatforms' property must be an object.`)
        }
      }

      if (json.optionGroups) {
        if (Util.isObject(json.optionGroups)) {
          for (const [name, optionGroupJson] of
            Object.entries(json.optionGroups)) {
            const optionGroup = this.parseBuildOptionGroup02x_(name,
              optionGroupJson)

            // Link back to the project.
            optionGroup.buildProject = buildProject

            // Contribute to the top object.
            buildProject.optionGroups[name] = optionGroup
          }
        } else {
          throw new TypeError(`The 'optionGroups' property must be an object.`)
        }
      }

      // Must be placed before processing configurations.
      buildProject.exportCompilationDatabase = true
      if (json.hasOwnProperty('exportCompilationDatabase')) {
        if (typeof (json.exportCompilationDatabase) === 'boolean') {
          buildProject.exportCompilationDatabase =
            json.exportCompilationDatabase
        } else {
          throw new TypeError(
            `The 'exportCompilationDatabase' property must be boolean.`)
        }
      }

      if (json.buildConfigurations) {
        if (Util.isObject(json.buildConfigurations)) {
          for (const [name, configJson] of
            Object.entries(json.buildConfigurations)) {
            const buildConfiguration = this.parseBuildConfiguration02x_(
              name.toLowerCase(),
              configJson, buildProject)

            // Contribute to the configurations object.
            buildProject.buildConfigurations[name] = buildConfiguration
          }
        } else {
          throw new TypeError(
            `The 'buildConfigurations' property must be an object.`)
        }
      }
    }
  }

  parseBuildTargetPlatforms02x_ (name, json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseBuildTarget02x_('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildTargetPlatform = new BuildTargetPlatform(name)

    buildTargetPlatform.sources = this.parseSourceFolders02x_(json)
    buildTargetPlatform.includes = this.parseIncludeFolders02x_(json)
    buildTargetPlatform.symbols = this.parseSymbols02x_(json)
    buildTargetPlatform.toolchainsOptions =
      this.parseToolchainsOptions02x_(json)
    buildTargetPlatform.targetArtefact = this.parseTargetArtefact02x_(json)
    buildTargetPlatform.language = this.parseLanguage02x_(json)

    return buildTargetPlatform
  }

  parseBuildOptionGroup02x_ (name, json) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseBuildOptionGroup02x_('${name}')`)

    const buildOptionGroup = new BuildOptionGroup(name)

    buildOptionGroup.sources = this.parseSourceFolders02x_(json)
    buildOptionGroup.includes = this.parseIncludeFolders02x_(json)
    buildOptionGroup.symbols = this.parseSymbols02x_(json)
    buildOptionGroup.toolchainsOptions = this.parseToolchainsOptions02x_(json)
    buildOptionGroup.targetArtefact = this.parseTargetArtefact02x_(json)
    buildOptionGroup.language = this.parseLanguage02x_(json)

    return buildOptionGroup
  }

  /**
   * @summary Parse a named build configuration.
   *
   * @param {String} name The configuration name.
   * @param {Object} json The configuration JSON definition.
   * @param {BuildProject} buildProject The build configuration.
   * @returns {BuildConfiguration} A build configuration.
   */
  parseBuildConfiguration02x_ (name, json, buildProject) {
    const log = this.log
    log.trace(`${this.constructor.name}.parseConfiguration02x('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildConfiguration = new BuildConfiguration(name)

    // Link back to the build context.
    buildConfiguration.buildProject = buildProject

    buildConfiguration.sources = this.parseSourceFolders02x_(json)

    buildConfiguration.targetArtefact = this.parseTargetArtefact02x_(json)

    buildConfiguration.language = this.parseLanguage02x_(json)

    // The global options are also parsed by parseFolders02x_(),
    // since the results are stored as a root folder.
    buildConfiguration.folders = this.parseFolders02x_(json,
      buildProject.folderAbsolutePath)
    if (!buildConfiguration.folders['']) {
      // To simplify things, always have a top folder, even empty.
      buildConfiguration.folders[''] = new BuildFolder()
    }
    buildConfiguration.files = this.parseFiles02x_(json,
      buildProject.folderAbsolutePath)

    if (json.targetPlatform) {
      const targetName = json.targetPlatform
      if (Util.isString(targetName)) {
        if (buildProject.targetPlatforms.hasOwnProperty(targetName)) {
          buildConfiguration.targetPlatform =
            buildProject.targetPlatforms[targetName]
        } else {
          throw new Error(`Missing targetPlatform '${targetName}'` +
            ` for configuration '${name}'.`)
        }
      } else {
        throw new TypeError(`The 'targetPlatform' property must be a string.`)
      }
    } else {
      throw new Error(
        `Missing targetPlatform for configuration '${name}'.`)
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

    // Collect the references of the option groups.
    if (json.optionGroups) {
      const groupNames = Util.validateStringArray(json.optionGroups)
      for (const groupName of groupNames) {
        if (buildProject.optionGroups.hasOwnProperty(groupName)) {
          // Contribute to the optionGroups array.
          buildConfiguration.optionGroups.push(
            buildProject.optionGroups[groupName])
        } else {
          throw new Error(
            `Missing optionGroup '${groupName}' for configuration '${name}'.`)
        }
      }
    }

    buildConfiguration.exportCompilationDatabase =
      buildProject.exportCompilationDatabase
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
   * @returns {BuildSources} An object with the source folders.
   *
   * @description
   */
  parseSourceFolders02x_ (json) {
    // Collect the source folders. Always arrays.
    const sources = new BuildSources(
      this.makePathsAbsolute_(json.addSourceFolders),
      this.makePathsAbsolute_(json.removeSourceFolders)
    )
    return sources
  }

  parseIncludeFolders02x_ (json) {
    // Collect the include folders. Always arrays.
    const includes = new BuildIncludes(
      this.makePathsAbsolute_(json.addIncludeFolders),
      this.makePathsAbsolute_(json.removeIncludeFolders),
      this.makePathsAbsolute_(json.addIncludeSystemFolders),
      this.makePathsAbsolute_(json.removeIncludeSystemFolders),
      this.makePathsAbsolute_(json.addIncludeFiles),
      this.makePathsAbsolute_(json.removeIncludeFiles)
    )
    return includes
  }

  parseSymbols02x_ (json) {
    // Collect the symbols. Always arrays.
    const symbols = new BuildSymbols(
      Util.validateStringArray(json.addSymbols),
      Util.validateStringArray(json.removeSymbols)
    )
    return symbols
  }

  parseTargetArtefact02x_ (json) {
    // Collect the artefact. Possibly undefined.
    let targetArtefact
    if (json.targetArtefact) {
      targetArtefact = new BuildArtefact(json.targetArtefact)
    } else if (json.targetArtifact) {
      // Prefer the british spelling, but also accept the american one.
      targetArtefact = new BuildArtefact(json.targetArtifact)
    }
    return targetArtefact
  }

  parseToolchainsOptions02x_ (json) {
    const log = this.log
    // Collect multiple toolchains options. Possibly empty.
    const toolchainsOptions = new BuildToolchainsOptions()
    if (json.toolchainsOptions) {
      if (Util.isObject(json.toolchainsOptions)) {
        for (const [toolchainName, jsonValue] of
          Object.entries(json.toolchainsOptions)) {
          const toolchain = ToolchainCache.retrieve(toolchainName, {
            log
          })
          toolchainsOptions.add(toolchainName,
            this.parseToolchainOptions02x_(jsonValue, toolchain))
        }
      } else {
        throw new TypeError(
          `The 'toolchainsOptions' property must be an object.`)
      }
    }
    return toolchainsOptions
  }

  parseToolchainOptions02x_ (json, toolchain) {
    // Collect one toolchain options. Possibly empty.
    const toolchainOptions = new BuildToolchainOptions(
      toolchain,
      new BuildCommonOptions(toolchain.configurationSuffixes, json)
    )

    if (json.toolsOptions) {
      if (Util.isObject(json.toolsOptions)) {
        for (const [toolName, jsonValue] of Object.entries(json.toolsOptions)) {
          if (toolchain.tools.hasOwnProperty(toolName)) {
            toolchainOptions.add(toolName, new BuildToolOptions(
              toolchain.tools[toolName],
              jsonValue))
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
    return toolchainOptions
  }

  parseLanguage02x_ (json) {
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
    }
    return language
  }

  parseFolders02x_ (json, folderAbsolutePath) {
    const folders = {}
    if (json.folders) {
      for (const [name, folderJson] of Object.entries(json.folders)) {
        if (path.isAbsolute(name)) {
          throw new Error(`Folder path '${name}' cannot be absolute.`)
        }
        const absolutePath = path.normalize(
          path.join(folderAbsolutePath, name))
        const relativePath = path.posix.relative(folderAbsolutePath,
          absolutePath)

        const buildFolder = new BuildFolder(relativePath,
          this.parseIncludeFolders02x_(folderJson),
          this.parseSymbols02x_(folderJson),
          this.parseToolchainsOptions02x_(folderJson)
        )

        folders[relativePath] = buildFolder
      }
    }

    // The root folder definitions are fetched from the same level,
    // not from an artificial '/' folder.
    folders[''] = new BuildFolder('',
      this.parseIncludeFolders02x_(json),
      this.parseSymbols02x_(json),
      this.parseToolchainsOptions02x_(json)
    )

    return folders
  }

  parseFiles02x_ (json, folderAbsolutePath) {
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

        const buildFile = new BuildFile(relativePath,
          this.parseIncludeFolders02x_(fileJson),
          this.parseSymbols02x_(fileJson),
          this.parseToolchainsOptions02x_(fileJson)
        )
        files[relativePath] = buildFile
      }
    }
    return files
  }

  // --------------------------------------------------------------------------

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
   * Also normalize.
   */
  makePathsAbsolute_ (inputPaths) {
    const absolutePaths = []

    if (inputPaths) {
      if (Array.isArray(inputPaths)) {
        for (const folderPath of inputPaths) {
          if (Util.isString(folderPath)) {
            if (path.isAbsolute(folderPath)) {
              absolutePaths.push(path.normalize(folderPath.trim()))
            } else {
              absolutePaths.push(
                path.normalize(path.join(this.cwd, folderPath.trim())))
            }
          } else {
            throw new TypeError('Must be a string or an array of strings.')
          }
        }
      } else if (Util.isString(inputPaths)) {
        if (path.isAbsolute(inputPaths)) {
          absolutePaths.push(path.normalize(inputPaths.trim()))
        } else {
          absolutePaths.push(
            path.normalize(path.join(this.cwd, inputPaths.trim())))
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

  // --------------------------------------------------------------------------

  /**
   * @summary Prepare artefact properties.
   * @param {BuildConfiguration} buildConfiguration Configuration.
   * @returns {undefined} Nothing.
   */
  prepareTargetArtefact_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareTargetArtefact_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject

    // The order is bottom up, configuration, optionGroup, target and project.
    const artefact = new BuildArtefact(buildConfiguration.targetArtefact)
    // `fillFrom()` ignores undefined input.
    for (const optionGroup of buildConfiguration.optionGroups) {
      artefact.fillFrom(optionGroup.targetArtefact)
    }

    artefact.fillFrom(buildConfiguration.targetPlatform.targetArtefact)
    artefact.fillFrom(buildProject.targetArtefact)

    // After doing our best to get data from the configuration, there still
    // may be some fields not defined, so consider reasonable defaults.
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
      'build.name': buildConfiguration.buildProject.projectName
    }
    artefact.name = Macros.substitute(artefact.name, macroValues)

    log.trace(`targetArtefact: '${artefact}'`)
    buildConfiguration.targetArtefact = artefact
  }

  /**
   * @summary Compute the final source folders.
   *
   * @param {BuildConfiguration} buildConfiguration The build configuration
   * @returns {undefined} Nothing.
   *
   * @description
   * The list of absolute paths to the source folders that will be
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
   * The results is a sorted arrays of strings (absolute paths):
   * - `sourceFolders`
   */
  prepareSourceFolders_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareSourceFolders_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject
    const discovered = buildProject.discovered

    let buildSources = new BuildSources()
    buildSources.append(buildProject.sources)
    buildSources.append(discovered.sources)
    buildSources.append(buildConfiguration.targetPlatform.sources)
    for (const optionGroup of buildConfiguration.optionGroups) {
      buildSources.append(optionGroup.sources)
    }
    buildSources.append(buildConfiguration.sources)

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
    buildConfiguration.sourceFolders = [...sourceFoldersSet].sort()
    log.trace(`sources: ${buildConfiguration.sourceFolders}`)
  }

  /**
   * @summary Compute and override the include folders and files for
   * the root node.
   *
   * @param {BuildConfiguration} buildConfiguration The build configuration
   * @returns {undefined} Nothing
   *
   * @description
   * The lists of absolute paths to include folders that will be used
   * to add properties
   * to the source tree root node.
   *
   * The following are considered:
   * - common folders (top JSON definitions)
   * - discovered folders
   * - configuration folders
   *
   * The results override the arrays of strings (absolute paths):
   * - `includes.addIncludeFolders`
   * - `includes.removeIncludeFolders`
   * - `includes.addIncludeSystemFolders`
   * - `includes.removeIncludeSystemFolders`
   * - `includes.addIncludeFiles`
   * - `includes.removeIncludeFiles`
   */
  prepareRootIncludes_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareRootIncludes_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject
    const discovered = buildProject.discovered

    let buildIncludes = new BuildIncludes()

    buildIncludes.append(buildProject.folders[''].includes)
    buildIncludes.append(discovered.includes)
    buildIncludes.append(buildConfiguration.targetPlatform.includes)
    for (const optionGroup of buildConfiguration.optionGroups) {
      buildIncludes.append(optionGroup.includes)
    }
    buildIncludes.append(buildConfiguration.folders[''].includes)

    log.trace(`includes: ${buildIncludes}`)
    buildConfiguration.includes = buildIncludes
  }

  /**
   * @summary Prepare preprocessor symbols properties for the root node.
   * @param {BuildConfiguration} buildConfiguration Configuration.
   * @returns {undefined} Nothing.
   */
  prepareRootSymbols_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareRootSymbols_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject

    let buildSymbols = new BuildSymbols()

    buildSymbols.append(buildProject.folders[''].symbols)
    buildSymbols.append(buildConfiguration.targetPlatform.symbols)
    for (const optionGroup of buildConfiguration.optionGroups) {
      buildSymbols.append(optionGroup.symbols)
    }
    buildSymbols.append(buildConfiguration.folders[''].symbols)

    log.trace(`symbols: ${buildSymbols}`)
    buildConfiguration.symbols = buildSymbols
  }

  /**
   * @summary Prepare toolchain option properties.
   * @param {BuildConfiguration} buildConfiguration Configuration.
   * @returns {undefined} Nothing.
   *
   * @description
   * The order is:
   * - targetPlatform
   * - optionGroups
   * - global
   * - configuration
   */
  prepareToolchainsOptions_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareToolchainsOptions_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject
    const toolchainOptions =
      new BuildToolchainOptions(buildConfiguration.toolchain)

    toolchainOptions.appendFrom(
      buildConfiguration.targetPlatform.toolchainsOptions)

    for (const optionGroup of buildConfiguration.optionGroups) {
      toolchainOptions.appendFrom(optionGroup.toolchainsOptions)
    }
    toolchainOptions.appendFrom(
      buildProject.folders[''].toolchainsOptions)
    toolchainOptions.appendFrom(
      buildConfiguration.folders[''].toolchainsOptions)

    for (const [toolName, toolOptions] of
      Object.entries(toolchainOptions.tools)) {
      log.trace(`${toolName}: ${toolOptions}`)
    }
    // Override the configuration specific options with all collected options.
    buildConfiguration.toolchainOptions = toolchainOptions

    // TODO: process folder and file toolchain options.
  }

  /**
   * @summary Prepare miscellaneous properties, not fitting elsewhere.
   * @param {BuildConfiguration} buildConfiguration Configuration.
   * @returns {undefined} Nothing.
   */
  prepareMisc_ (buildConfiguration) {
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
    // Override the configuration specific options with all collected options.
    buildConfiguration.language = language

    if (buildConfiguration.targetArtefact.type === 'executable' ||
      buildConfiguration.targetArtefact.type === 'sharedLib') {
      for (const tool of Object.values(buildConfiguration.toolchain.tools)) {
        if (tool.type === 'linker' &&
          tool.languages.indexOf(language) !== -1) {
          buildConfiguration.tool = tool
          break
        }
      }
    } if (buildConfiguration.targetArtefact.type === 'staticLib') {
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
        `'${buildConfiguration.targetArtefact.type}'`)
    }
  }
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
