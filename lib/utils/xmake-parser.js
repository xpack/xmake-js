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
const XmakeProject = require('./xmake-objects.js')
  .XmakeProject
const XmakeBuildConfiguration = require('./xmake-objects.js')
  .XmakeBuildConfiguration
const XmakeFolder = require('./xmake-objects.js').XmakeFolder
const XmakeFile = require('./xmake-objects.js').XmakeFile
const XmakeSymbols = require('./xmake-objects.js').XmakeSymbols
const XmakeIncludes = require('./xmake-objects.js').XmakeIncludes
const XmakeSources = require('./xmake-objects.js').XmakeSources
const XmakeTargetPlatform = require('./xmake-objects.js').XmakeTargetPlatform
const XmakeOptionGroup = require('./xmake-objects.js').XmakeOptionGroup
const XmakeToolOptions = require('./xmake-objects.js').XmakeToolOptions
const XmakeCommonOptions = require('./xmake-objects.js').XmakeCommonOptions
const XmakeToolchainOptions =
  require('./xmake-objects.js').XmakeToolchainOptions
const XmakeToolchainsOptions =
  require('./xmake-objects.js').XmakeToolchainsOptions
const XmakeArtefact = require('./xmake-objects.js').XmakeArtefact
const Macros = require('./macros.js').Macros
const SourceTree = require('./source-tree.js').SourceTree

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
   * @param {Object} context.toolchainCache A reference to a toolchain cache.
   */
  constructor (context) {
    assert(context, 'There must be a context')

    assert(context.log, 'There must be a context.log.')
    this.log = context.log

    assert(context.cwd, 'There must be a context.cwd.')
    this.cwd = context.cwd

    assert(context.toolchainCache, 'There must be a context.toolchainCache.')
    this.toolchainCache = context.toolchainCache
  }

  /**
   * @summary Parse the xmake.json and prepare the build context.
   *
   * @async
   * @param {String} folderAbsolutePath Folder where the xmake is located.
   * @param {Object} options Optional tweaks; if none, assume main application.
   * @param {String} options.purpose One of `project`, `test`, `meta`.
   * @param {boolean} options.meta True if part of folder metadata.
   * @param {boolean} options.test True if test.
   * @param {Object} options.discovered The discovered folders.
   * @param {String} options.fileName The actual file name, no need to identify.
   * @returns {XmakeProject} A build context.
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

    const buildProject = new XmakeProject()
    buildProject.options = options
    buildProject.folderAbsolutePath = folderAbsolutePath
    buildProject.cwd = this.cwd

    if (!options.baseFolderAbsolutePath) {
      options.baseFolderAbsolutePath = this.cwd
    }

    if (options.purpose === 'project') {
      assert(options.projectName, 'There must be an options.projectName.')
      buildProject.projectName = options.projectName
    }

    if (options.purpose === 'test') {
      assert(options.topProject, 'There must be an options.topProject.')
      buildProject.topProject = options.topProject

      assert(options.baseFolderAbsolutePath,
        'There must be an options.baseFolderAbsolutePath.')

      buildProject.folderRelativePath =
        path.relative(this.cwd, buildProject.folderAbsolutePath)
      const parts = buildProject.folderRelativePath.split(path.sep)
      buildProject.configNamePrefix = parts.join('-').toLowerCase()

      buildProject.projectName = buildProject.configNamePrefix
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
      buildProject.discovered.sources = new XmakeSources({
        addSourceFolders: options.discovered.addSourceFolders
      })
      buildProject.discovered.includes = new XmakeIncludes({
        addIncludeFolders: options.discovered.addIncludeFolders
      })
    } else {
      buildProject.discovered.sources = new XmakeSources()
      buildProject.discovered.includes = new XmakeIncludes()
    }

    return buildProject
  }

  /**
   * @summary Parse the schema 0.2.x files.
   * @param {XmakeProject} buildProject The build context.
   * @returns {undefined} Nothing.
   */
  async parse02x_ (buildProject) {
    const log = this.log
    log.trace(`${this.constructor.name}.parse02x()`)

    const json = buildProject.json

    if (['project', 'top', 'test'].includes(buildProject.options.purpose)) {
      if (json.name) {
        if (Util.isValidName(json.name)) {
          buildProject.name = json.name
        } else {
          throw new TypeError(
            `The 'name' property must be an alphanumeric string.`)
        }
      }

      buildProject.builders = {}
      if (json.builders) {
        if (Util.isObject(json.builders)) {
          for (const [name, builder] of
            Object.entries(json.builders)) {
            const builderName = name.toLowerCase()
            buildProject.builders[builderName] = {}
            buildProject.builders[builderName].command = builder.command
            if (builder.default) {
              buildProject.builders[builderName].default = true
            }
          }
        } else {
          throw new TypeError(`The 'builders' property must be an object.`)
        }
      }
      if (['project', 'top'].includes(buildProject.options.purpose)) {
        // Add default builders.
        if (!buildProject.builders.make) {
          buildProject.builders.make = {
            command: ['make']
          }
        }
        if (!buildProject.builders.ninja) {
          buildProject.builders.ninja = {
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

      buildProject.sources =
        this.parseSourceFolders02x_(json, buildProject)

      buildProject.targetArtefact = this.parseTargetArtefact02x_(json)

      buildProject.language = this.parseLanguage02x_(json)

      buildProject.folders = this.parseFolders02x_(json,
        buildProject.folderAbsolutePath, buildProject)
      if (!buildProject.folders['']) {
        // To simplify things, always have a top folder, even empty.
        buildProject.folders[''] = new XmakeFolder({
          name: ''
        })
      }
      buildProject.files = this.parseFiles02x_(json,
        buildProject.folderAbsolutePath, buildProject)

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
              targetJson, buildProject)

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
              optionGroupJson, buildProject)

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
            if (buildProject.configNamePrefix) {
              if (!name.toLowerCase()
                .startsWith(buildProject.configNamePrefix)) {
                log.warn(`Configuration '${name}' does not start with 
                ` + `'${buildProject.configNamePrefix}', ignored.`)
                continue
              }
            }
            const buildConfiguration = this.parseBuildConfiguration02x_(
              name.toLowerCase(), configJson, buildProject)

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

  parseBuildTargetPlatforms02x_ (name, json, buildProject) {
    assert(buildProject)

    const log = this.log
    log.trace(`${this.constructor.name}.parseBuildTarget02x_('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildTargetPlatform = new XmakeTargetPlatform({
      name,
      sources: this.parseSourceFolders02x_(json, buildProject),
      includes: this.parseIncludeFolders02x_(json, buildProject),
      symbols: this.parsePreprocessorSymbols02x_(json),
      toolchainsOptions: this.parseToolchainsOptions02x_(json),
      targetArtefact: this.parseTargetArtefact02x_(json),
      language: this.parseLanguage02x_(json)
    })

    return buildTargetPlatform
  }

  parseBuildOptionGroup02x_ (name, json, buildProject) {
    assert(buildProject)

    const log = this.log
    log.trace(`${this.constructor.name}.parseBuildOptionGroup02x_('${name}')`)

    const buildOptionGroup = new XmakeOptionGroup({
      name,
      sources: this.parseSourceFolders02x_(json, buildProject),
      includes: this.parseIncludeFolders02x_(json, buildProject),
      symbols: this.parsePreprocessorSymbols02x_(json),
      toolchainsOptions: this.parseToolchainsOptions02x_(json),
      targetArtefact: this.parseTargetArtefact02x_(json),
      language: this.parseLanguage02x_(json)
    })

    return buildOptionGroup
  }

  /**
   * @summary Parse a named build configuration.
   *
   * @param {String} name The configuration name.
   * @param {Object} json The configuration JSON definition.
   * @param {XmakeProject} buildProject The build configuration.
   * @returns {XmakeBuildConfiguration} A build configuration.
   */
  parseBuildConfiguration02x_ (name, json, buildProject) {
    assert(buildProject)

    const log = this.log
    log.trace(`${this.constructor.name}.parseConfiguration02x('${name}')`)

    // TODO: check if names are file system safe (configuration name).
    const buildConfiguration = new XmakeBuildConfiguration(name)

    // Link back to the build context.
    buildConfiguration.buildProject = buildProject

    buildConfiguration.sources = this.parseSourceFolders02x_(json, buildProject)
    buildConfiguration.targetArtefact = this.parseTargetArtefact02x_(json)
    buildConfiguration.language = this.parseLanguage02x_(json)

    // The global options are also parsed by parseFolders02x_(),
    // since the results are stored as a root folder.
    buildConfiguration.folders = this.parseFolders02x_(json,
      buildProject.folderAbsolutePath, buildProject)
    if (!buildConfiguration.folders['']) {
      // To simplify things, always have a top folder, even empty.
      buildConfiguration.folders[''] = new XmakeFolder({
        name: ''
      })
    }
    buildConfiguration.files = this.parseFiles02x_(json,
      buildProject.folderAbsolutePath, buildProject)

    if (json.targetPlatform) {
      const targetName = json.targetPlatform
      if (Util.isString(targetName)) {
        if (buildProject.targetPlatforms.hasOwnProperty(targetName)) {
          buildConfiguration.targetPlatform =
            buildProject.targetPlatforms[targetName]
        } else if (buildProject.topProject &&
          buildProject.topProject.targetPlatforms.hasOwnProperty(targetName)) {
          buildConfiguration.targetPlatform =
            buildProject.topProject.targetPlatforms[targetName]
        } else {
          throw new Error(`Missing targetPlatform '${targetName}'` +
            ` for configuration '${name}'.`)
        }
      } else {
        throw new TypeError(`The 'targetPlatform' property must be a string.`)
      }
    } else {
      // Empty unnamed platform.
      buildConfiguration.targetPlatform = new XmakeTargetPlatform({
        name: ''
      })
    }

    // Collect the configuration toolchain.
    if (json.toolchain) {
      if (Util.isString(json.toolchain)) {
        buildConfiguration.toolchain = this.toolchainCache.retrieve(
          json.toolchain)
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
        } else if (buildProject.topProject &&
          buildProject.topProject.optionGroups.hasOwnProperty(groupName)) {
          buildConfiguration.optionGroups.push(
            buildProject.topProject.optionGroups[groupName])
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
   * @param {XmakeProject} buildProject Reference to project.
   * @returns {XmakeSources} An object with the source folders.
   *
   * @description
   */
  parseSourceFolders02x_ (json, buildProject) {
    assert(buildProject)

    const baseFolderAbsolutePath = buildProject.options.baseFolderAbsolutePath
    // Collect the source folders. Always arrays.
    const sources = new XmakeSources({
      addSourceFolders: this.makePathsAbsolute_(
        json.addSourceFolders, baseFolderAbsolutePath),
      removeSourceFolders: this.makePathsAbsolute_(
        json.removeSourceFolders, baseFolderAbsolutePath)
    })
    return sources
  }

  parseIncludeFolders02x_ (json, buildProject) {
    assert(buildProject)

    const baseFolderAbsolutePath = buildProject.options.baseFolderAbsolutePath
    // Collect the include folders. Always arrays.
    const includes = new XmakeIncludes({
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
        json.removeIncludeFiles, baseFolderAbsolutePath)
    })
    return includes
  }

  parsePreprocessorSymbols02x_ (json) {
    // Collect the symbols. Always arrays.
    const symbols = new XmakeSymbols({
      addSymbols: Util.validateStringArray(json.addPreprocessorSymbols),
      removeSymbols: Util.validateStringArray(json.removePreprocessorSymbols)
    })
    return symbols
  }

  parseTargetArtefact02x_ (json) {
    // Collect the artefact. Possibly undefined.
    let targetArtefact
    if (json.targetArtefact) {
      targetArtefact = new XmakeArtefact(json.targetArtefact)
    } else if (json.targetArtifact) {
      // Prefer the british spelling, but also accept the american one.
      targetArtefact = new XmakeArtefact(json.targetArtifact)
    }
    return targetArtefact
  }

  parseToolchainsOptions02x_ (json) {
    // const log = this.log
    // Collect multiple toolchains options. Possibly empty.
    const toolchainsOptions = new XmakeToolchainsOptions()
    if (json.toolchainsOptions) {
      if (Util.isObject(json.toolchainsOptions)) {
        for (const [toolchainName, jsonValue] of
          Object.entries(json.toolchainsOptions)) {
          const toolchain = this.toolchainCache.retrieve(toolchainName)
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
    const toolchainOptions = new XmakeToolchainOptions({
      toolchain,
      commonOptions: new XmakeCommonOptions({
        suffixes: toolchain.configurationSuffixes,
        ...json
      })
    })

    if (json.toolsOptions) {
      if (Util.isObject(json.toolsOptions)) {
        for (const [toolName, jsonValue] of Object.entries(json.toolsOptions)) {
          if (toolchain.tools.hasOwnProperty(toolName)) {
            toolchainOptions.add(toolName, new XmakeToolOptions({
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

  parseFolders02x_ (json, folderAbsolutePath, buildProject) {
    assert(buildProject)

    const folders = {}

    // The root folder definitions are fetched from the same level,
    // not from an artificial '/' folder, as in Eclipse CDT.
    folders[''] = new XmakeFolder({
      name: '',
      includes: this.parseIncludeFolders02x_(json, buildProject),
      symbols: this.parsePreprocessorSymbols02x_(json),
      toolchainsOptions: this.parseToolchainsOptions02x_(json)
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

        const buildFolder = new XmakeFolder({
          name: relativePath,
          includes: this.parseIncludeFolders02x_(folderJson, buildProject),
          symbols: this.parsePreprocessorSymbols02x_(folderJson),
          toolchainsOptions: this.parseToolchainsOptions02x_(folderJson)
        })

        folders[relativePath] = buildFolder
      }
    }

    return folders
  }

  parseFiles02x_ (json, folderAbsolutePath, buildProject) {
    assert(buildProject)

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

        const buildFile = new XmakeFile({
          name: relativePath,
          includes: this.parseIncludeFolders02x_(fileJson, buildProject),
          symbols: this.parsePreprocessorSymbols02x_(fileJson),
          toolchainsOptions: this.parseToolchainsOptions02x_(fileJson)
        })
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

  // --------------------------------------------------------------------------

  prepareConfiguration (buildConfiguration) {
    // Collect all contributed folders, remove unwanted ones,
    // and update the configurations with the result.
    this.prepareTargetArtefact_(buildConfiguration)
    this.prepareSourceFolders_(buildConfiguration)

    this.prepareFolders_(buildConfiguration)
    this.prepareFiles_(buildConfiguration)

    this.prepareMisc_(buildConfiguration)
  }

  /**
   * @summary Prepare artefact properties.
   * @param {XmakeBuildConfiguration} buildConfiguration Configuration.
   * @returns {undefined} Nothing.
   */
  prepareTargetArtefact_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareTargetArtefact_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject

    // The order is bottom up, configuration, optionGroup, target and project.
    const artefact = new XmakeArtefact(buildConfiguration.targetArtefact)
    // `fillFrom()` ignores undefined input.
    for (const optionGroup of buildConfiguration.optionGroups) {
      artefact.fillFrom(optionGroup.targetArtefact)
    }

    artefact.fillFrom(buildConfiguration.targetPlatform.targetArtefact)
    artefact.fillFrom(buildProject.targetArtefact)

    if (buildProject.topProject) {
      artefact.fillFrom(buildProject.topProject.targetArtefact)
    }

    // After doing our best to get data from the configuration, there still
    // may be some fields not defined, so consider reasonable defaults.
    if (artefact.type) {
      artefact.type = artefact.type.trim()
      if (XmakeArtefact.types.indexOf(artefact.type) === -1) {
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
   * @param {XmakeBuildConfiguration} buildConfiguration The build configuration
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

    let buildSources = new XmakeSources()
    buildSources.appendFrom(buildProject.sources)
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
    buildConfiguration.sourceFolders = [...sourceFoldersSet].sort()
    log.trace(`sources: ${buildConfiguration.sourceFolders}`)
  }

  /**
   * @summary Compute and override the include folders and files for
   * the root node.
   *
   * @param {XmakeBuildConfiguration} buildConfiguration The build configuration
   * @returns {XmakeIncludes} Collected includes.
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
   * The results override the original `includes` property.
   */
  prepareTopIncludes_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareTopIncludes_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject

    let buildIncludes = new XmakeIncludes()

    buildIncludes.appendFrom(buildProject.folders[''].includes)
    if (buildProject.discovered) {
      buildIncludes.appendFrom(buildProject.discovered.includes)
    }
    buildIncludes.appendFrom(buildConfiguration.targetPlatform.includes)
    for (const optionGroup of buildConfiguration.optionGroups) {
      buildIncludes.appendFrom(optionGroup.includes)
    }
    buildIncludes.appendFrom(buildConfiguration.folders[''].includes)

    log.trace(`includes: ${buildIncludes}`)

    return buildIncludes
  }

  /**
   * @summary Prepare preprocessor symbols properties for the root node.
   * @param {XmakeBuildConfiguration} buildConfiguration Configuration.
   * @returns {XmakeSymbols} The collected symbols.
   */
  prepareTopPreprocessorSymbols_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareTopPreprocessorSymbols_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject

    let buildSymbols = new XmakeSymbols()

    buildSymbols.appendFrom(buildProject.folders[''].symbols)
    buildSymbols.appendFrom(buildConfiguration.targetPlatform.symbols)
    for (const optionGroup of buildConfiguration.optionGroups) {
      buildSymbols.appendFrom(optionGroup.symbols)
    }
    buildSymbols.appendFrom(buildConfiguration.folders[''].symbols)

    log.trace(`symbols: ${buildSymbols}`)

    return buildSymbols
  }

  /**
   * @summary Prepare toolchain option properties for a buildConfiguration.
   * @param {XmakeBuildConfiguration} buildConfiguration Configuration.
   * @returns {XmakeToolchainOptions} The collected toolchain options.
   *
   * @description
   * The order is:
   * - targetPlatform
   * - optionGroups
   * - [top project, for tests]
   * - global
   * - configuration
   */
  prepareTopToolchainOptions_ (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.prepareTopToolchainOptions_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject
    const toolchainOptions =
      new XmakeToolchainOptions({
        toolchain: buildConfiguration.toolchain
      })

    toolchainOptions.appendFrom(
      buildConfiguration.targetPlatform.toolchainsOptions)

    for (const optionGroup of buildConfiguration.optionGroups) {
      toolchainOptions.appendFrom(optionGroup.toolchainsOptions)
    }

    if (buildProject.topProject) {
      toolchainOptions.appendFrom(
        buildProject.topProject.folders[''].toolchainsOptions)
    }

    toolchainOptions.appendFrom(
      buildProject.folders[''].toolchainsOptions)
    toolchainOptions.appendFrom(
      buildConfiguration.folders[''].toolchainsOptions)

    if (log.isTrace()) {
      log.trace(`commonOptions: ${toolchainOptions.commonOptions}`)
      for (const [toolName, toolOptions] of
        Object.entries(toolchainOptions.tools)) {
        log.trace(`${toolName}: ${toolOptions}`)
      }
    }

    return toolchainOptions
  }

  prepareFolders_ (buildConfiguration) {
    const log = this.log

    log.trace(`${this.constructor.name}.prepareFolders_(` +
      `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject
    const folders = {}

    const topFolder = new XmakeFolder({
      name: '',
      includes: this.prepareTopIncludes_(buildConfiguration),
      symbols: this.prepareTopPreprocessorSymbols_(buildConfiguration),
      toolchainOptions: this.prepareTopToolchainOptions_(buildConfiguration),
      toolchain: buildConfiguration.toolchain
    })
    folders[''] = topFolder

    // Consider the project folders first.
    for (const [name, folder] of Object.entries(buildProject.folders)) {
      if (name === '') {
        continue
      }
      // Collect options only for one toolchain.
      folders[name] = new XmakeFolder({
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
        folders[name] = new XmakeFolder({
          ...folder,
          toolchain: buildConfiguration.toolchain
        })
      } else {
        folders[name].appendFrom(folder)
      }
    }

    // Override the buildConfiguration property.
    buildConfiguration.folders = folders

    // Add convenience shortcuts.
    buildConfiguration.topFolder = topFolder
    buildConfiguration.includes = buildConfiguration.topFolder.includes
    buildConfiguration.symbols = buildConfiguration.topFolder.symbols
    buildConfiguration.toolchainOptions =
      buildConfiguration.topFolder.toolchainOptions

    if (log.isVerbose()) {
      for (const [folderName, folder] of Object.entries(folders)) {
        log.trace(`'${folderName}' includes: ${folder.includes}`)
        log.trace(`'${folderName}' symbols: ${folder.symbols}`)
        log.trace(`${folder.toolchain.name} ` +
            `commonOptions: ${folder.toolchainOptions.commonOptions}`)
        for (const [toolName, toolOptions] of
          Object.entries(folder.toolchainOptions.tools)) {
          log.trace(`${folder.toolchain.name} ${toolName}: ${toolOptions}`)
        }
      }
    }
  }

  prepareFiles_ (buildConfiguration) {
    const log = this.log

    log.trace(`${this.constructor.name}.prepareFiles_(` +
    `'${buildConfiguration.name}')`)

    const buildProject = buildConfiguration.buildProject
    const files = {}

    // Consider the project files first.
    for (const [name, file] of Object.entries(buildProject.files)) {
      // Collect options only for one toolchain.
      files[name] = new XmakeFile({
        ...file,
        toolchain: buildConfiguration.toolchain
      })
    }

    // Then consider the configuration files too.
    for (const [name, file] of Object.entries(buildConfiguration.files)) {
      if (!files[name]) {
        // Collect options only for one toolchain.
        files[name] = new XmakeFile({
          ...file,
          toolchain: buildConfiguration.toolchain
        })
      } else {
        files[name].appendFrom(file)
      }
    }

    // Override the buildConfiguration property.
    buildConfiguration.files = files

    if (log.isVerbose()) {
      for (const [folderName, file] of Object.entries(files)) {
        log.trace(`'${folderName}' includes: ${file.includes}`)
        log.trace(`'${folderName}' symbols: ${file.symbols}`)
        log.trace(`${file.toolchain.name} ` +
            `commonOptions: ${file.toolchainOptions.commonOptions}`)
        for (const [toolName, toolOptions] of
          Object.entries(file.toolchainOptions.tools)) {
          log.trace(`${file.toolchain.name} ${toolName}: ${toolOptions}`)
        }
      }
    }
  }

  /**
   * @summary Prepare miscellaneous properties, not fitting elsewhere.
   * @param {XmakeBuildConfiguration} buildConfiguration Configuration.
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

  // --------------------------------------------------------------------------

  async createSourceTree (buildConfiguration, buildFolderPath) {
    const log = this.log

    // Preferably set these before creating the source tree.
    buildConfiguration.buildAbsolutePath =
     path.join(this.cwd, buildFolderPath, buildConfiguration.name)

    buildConfiguration.buildToProjectRelativePath =
     path.relative(buildConfiguration.buildAbsolutePath, this.cwd)

    const sourceTree = new SourceTree({
      log,
      cwd: this.cwd,
      fileExtensions: buildConfiguration.toolchain.fileExtensions,
      tool: buildConfiguration.tool,
      toolchain: buildConfiguration.toolchain,
      language: buildConfiguration.language,
      xmakeParser: this
    })

    // TODO: if empty, should we use defaults?
    if (buildConfiguration.sourceFolders.length === 0) {
      throw new Error(`No source folders defined.`)
    }
    await sourceTree.create(buildConfiguration.sourceFolders)

    buildConfiguration.sourceTree = sourceTree
    // Add a shortcut to the top tree node, all other were done
    // in addNodeProperties_().
    buildConfiguration.folders[''].node = sourceTree

    // To compute the relative paths, it needs the `buildAbsolutePath`.
    sourceTree.addNodesProperties(buildConfiguration)

    // Contribute sourceFolderNodes to the build configuration.
    buildConfiguration.sourceFolderNodes = sourceTree.sourceFolderNodes

    // Contribute an array of tools to the build configuration.
    buildConfiguration.tools = sourceTree.tools
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
