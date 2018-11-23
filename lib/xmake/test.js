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
 * The `xmake test <options> ...` command implementation.
 */

// ----------------------------------------------------------------------------

// const assert = require('assert')
const fs = require('fs')
const path = require('path')
// const spawn = require('child_process').spawn
// const util = require('util')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
const CliCommand = require('@ilg/cli-start-options').CliCommand
const CliOptions = require('@ilg/cli-start-options').CliOptions
const CliHelp = require('@ilg/cli-start-options').CliHelp
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
const CliError = require('@ilg/cli-start-options').CliError

const XmakeParser = require('../../lib/utils/xmake-parser.js').XmakeParser
const JsonCache = require('../../lib/utils/json-cache.js').JsonCache
const Defaults = require('../../lib/utils/defaults.js').Defaults
const ToolchainCache = require('../../lib/utils/toolchain-cache.js')
  .ToolchainCache
const XmakeBuilder = require('../../lib/utils/xmake-builder.js').XmakeBuilder
const Util = require('../../lib/utils/util.js').Util
const Spawn = require('../../lib/utils/spawn.js').Spawn

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readFile')
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'readdir')
// Promisifier.promisifyInPlace(fs, 'mkdir')
// Promisifier.promisifyInPlace(fs, 'writeFile')

// const mkdirpPromise = Promisifier.promisify(require('mkdirp'))

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ----------------------------------------------------------------------------

const defaultDepth = 2
const xmakeJsonFileName = 'xmake.json'

// ============================================================================

/**
 * Inherited from parent.
 * @property {Object} context
 * @property {Object} context.config
 * @property {Object} log
 *
 * Defined in the constructor
 * @property {String} title Title displayed with the help message.
 * @property {Object} optionGroups
 *
 * Defined in doRun().
 * @property {String[]} builderArgs
 * @property {String[]} runnerArgs
 * @property {Object} topProject Parsed project xmake.json.
 */
class Test extends CliCommand {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set help definitions.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    super(context)

    // Title displayed with the help message.
    this.title = 'Build and run project test(s)'
    this.optionGroups = [
      {
        title: 'Test options',
        preOptions: '[<path>...]', // Array of folder paths.
        postOptions: '[-- <build args> [-- <run args>]]', // Extra arguments.
        optionDefs: [
          {
            options: ['-c', '--config'],
            param: 'name',
            msg: 'Configuration name',
            init: (context) => {
              context.config.configNames = []
            },
            action: (context, val) => {
              context.config.configNames.push(val.toLowerCase())
              context.config.hasFilters = true
            },
            isOptional: true,
            isMultiple: true
          },
          {
            options: ['-b', '--builder'],
            param: 'name',
            msg: 'Builder, default \'make\'',
            init: (context) => {
              context.config.builderName = undefined
            },
            action: (context, val) => {
              context.config.builderName = val.toLowerCase()
            },
            isOptional: true
          },
          {
            options: ['--depth'],
            param: 'n',
            msg: `Search depth, default '${defaultDepth}'`,
            init: (context) => {
              context.config.searchDepth = defaultDepth
            },
            action: (context, val) => {
              context.config.searchDepth = val
            },
            isOptional: true
          },
          {
            options: ['-f', '--build-folder'],
            param: 'path',
            msg: `Build folder, default '${Defaults.buildFolderName}'`,
            init: (context) => {
              context.config.buildFolderPath = Defaults.buildFolderName
            },
            action: (context, val) => {
              context.config.buildFolderPath = val
            },
            isOptional: true
          },
          {
            options: ['--no-build'],
            msg: `Do not build the tests, only generate the files`,
            init: (context) => {
              context.config.isNoBuild = false
            },
            action: (context) => {
              context.config.isNoBuild = true
            },
            isOptional: true
          },
          {
            options: ['-n', '--no-run'],
            msg: `Do not run the test(s), perform only the build`,
            init: (context) => {
              context.config.isNoRun = false
            },
            action: (context) => {
              context.config.isNoRun = true
            },
            isOptional: true
          }
        ]
      }
    ]
  }

  doOutputHelpArgsDetails (more) {
    const log = this.context.log
    if (!more.isFirstPass) {
      log.always('where:')
      log.always(`${CliHelp.padRight('  <path>...', more.width)} ` +
        `Folder path(s) to separate tests (optional, multiple)`)
      log.always(`${CliHelp.padRight('  <build args>...', more.width)} ` +
        `Extra arguments for the builder (optional, multiple)`)
      log.always(`${CliHelp.padRight('  <run args>...', more.width)} ` +
        `Extra arguments when running the tests (optional, multiple)`)
    }
  }

  /**
   * @summary Execute the `test` command.
   *
   * @async
   * @param {string[]} args Command line arguments.
   * @returns {number} Return code.
   *
   * @override
   */
  async doRun (args) {
    const log = this.log
    log.trace(`${this.constructor.name}.doRun()`)

    const context = this.context
    const config = context.config

    log.info(this.title)
    const paths = CliOptions.filterOwnArguments(args)
    const otherArgs = CliOptions.filterOtherArguments(args)
    this.builderArgs = CliOptions.filterOwnArguments(otherArgs)
    this.runnerArgs = CliOptions.filterOtherArguments(otherArgs)

    // Validate --depth.
    if (config.searchDepth) {
      if (isNaN(config.searchDepth)) {
        throw new Error(`Invalid value (${config.searchDepth}) ` +
          `for '--depth', must be a number.`)
      }
    }

    const packageAbsolutePath = path.join(config.cwd, 'package.json')
    try {
      // If the application is an xPack, read its package.json.
      context.appPackJson = await JsonCache.parse(packageAbsolutePath)
    } catch (err) {
      context.appPackJson = {}
    }

    if (paths.length === 0) {
      // If no folders given, try to use `directories.test`, if available.
      if (context.appPackJson.directories &&
        context.appPackJson.directories.test) {
        log.trace(`Using package '${context.appPackJson.directories.test}'` +
          ` folder.`)
        paths.push(context.appPackJson.directories.test)
      } else {
        paths.push('test')
      }
    }

    // Identify tests in the given folders.
    const testFolders = await this.identifyTests(paths)
    for (const folder of testFolders) {
      log.debug(`testFolder: '${folder}'`)
    }

    if (testFolders.length) {
      // Perform identified tests, one at a time.
      for (const folder of testFolders) {
        await this.performTestsInFolder(folder)
      }
    } else {
      log.warn('No tests identified.')
    }

    this.outputDoneDuration()
    return CliExitCodes.SUCCESS
  }

  /**
   * @summary Identify tests in an array of paths.
   *
   * @async
   * @param {string[]} paths Array of relative paths.
   * @returns {string[]} Array of paths with xmake.json files.
   */
  async identifyTests (paths) {
    const log = this.log
    const config = this.context.config

    const testFoldersAbsolutePaths = []
    for (const path_ of paths) {
      let p
      if (path.isAbsolute(path_)) {
        p = path_
      } else {
        p = path.resolve(config.cwd, path_)
      }
      log.trace(`inFolder: ' ${p}'`)
      await this.identifyTestFoldersRecursive(p, config.searchDepth,
        testFoldersAbsolutePaths)
    }
    return testFoldersAbsolutePaths
  }

  /**
   * @summary Identify folders containing an xmake.json file.
   *
   * @async
   * @param {string} folderAbsolutePath Folder to search for.
   * @param {number} depth How deep the search can go.
   * @param {string[]} outArray Output array of string absolute paths.
   * @returns {undefined} Nothing.
   *
   * @description
   * The file is checked only if present, the content is not yet
   * validated.
   * Folders starting with a dot cannot be used as test folders,
   * they are usually used for metadata and are skipped.
   */
  async identifyTestFoldersRecursive (folderAbsolutePath, depth, outArray) {
    let folderStat
    try {
      folderStat = await fsPromises.stat(folderAbsolutePath)
    } catch (err) {
      return
    }
    if (!folderStat.isDirectory()) {
      return
    }

    const jsonAbsolutePath = path.resolve(folderAbsolutePath, xmakeJsonFileName)
    try {
      const fileStat = await fsPromises.stat(jsonAbsolutePath)
      if (fileStat.isFile()) {
        outArray.push(folderAbsolutePath)
        return
      }
    } catch (err) {
      // Probably ENOENT if the file was not found.
    }

    if (depth === 0) {
      return
    }

    // No more excuses; recurse on all subfolders.
    const names = await fsPromises.readdir(folderAbsolutePath)
    for (let name of names) {
      if (name.startsWith('.')) {
        // Skip folders that start with a dot.
        continue
      }
      const childAbsolutePath = path.resolve(folderAbsolutePath, name)
      await this.identifyTestFoldersRecursive(childAbsolutePath, depth - 1,
        outArray)
    }
  }

  /**
   * @summary Build and run one or more test configurations.
   *
   * @param {string} folderPath Absolute folder path.
   * @returns {undefined} Nothing.
   */
  async performTestsInFolder (folderPath) {
    const log = this.log
    const context = this.context
    const config = context.config

    const toolchainCache = await ToolchainCache.parseAssets({
      log,
      rootPath: context.rootPath
    })

    const xmakeParser = new XmakeParser({
      log,
      cwd: config.cwd,
      toolchainCache
    })

    this.topProject = await xmakeParser.parse(config.cwd, {
      purpose: 'top'
    })

    const buildContext = await xmakeParser.parse(folderPath, {
      purpose: `test`,
      topProject: this.topProject,
      baseFolderAbsolutePath: folderPath
    })

    const relPath = path.posix.join(path.relative(config.cwd, folderPath),
      'xmake.json')
    if (Object.values(buildContext.buildConfigurations).length === 0) {
      throw new Error(`Missing buildConfigurations in '${relPath}' file.`)
    }

    buildContext.log = log
    buildContext.isVerbose = log.isVerbose()
    buildContext.cwd = config.cwd
    buildContext.config = config
    buildContext.builderArgs = this.builderArgs
    buildContext.xmakeParser = xmakeParser

    const builder = new XmakeBuilder(buildContext)

    const configNames = []
    // If no config name given, default to all of them.
    if (config.configNames.length !== 0) {
      configNames.push(...config.configNames)
    } else {
      configNames.push(...Object.keys(buildContext.buildConfigurations))
    }

    for (const configName of configNames) {
      const buildConfiguration = buildContext.buildConfigurations[configName]
      if (!buildConfiguration) {
        throw new Error(`Missing buildConfiguration '${configName}'` +
          ` in '${relPath}' file.`)
      }
      xmakeParser.prepareConfiguration(buildConfiguration)
      await builder.build(buildConfiguration)

      if (!config.isNoRun) {
        await this.runTest(buildConfiguration)
      }
    }
  }

  async runTest (buildConfiguration) {
    const log = this.log

    const startTime = Date.now()
    const isCross = buildConfiguration.toolchain.propertyWithParent('isCross')
    if (!isCross) {
      log.info()
      const name = buildConfiguration.targetArtefact.fullName
      log.info(`Invoking artefact: '${name}'...`)

      const cmd = name
      log.debug(`spawn: ${cmd}`)

      const spawn = new Spawn()
      const code = await spawn.executeBinaryPromise(
        './' + cmd,
        this.runnerArgs,
        {
          argv0: cmd,
          cwd: buildConfiguration.buildAbsolutePath
        })

      if (code !== 0) {
        throw new CliError(`Test failed, '${cmd}' ` +
          `returned ${code}.`, CliExitCodes.ERROR.CHILD)
      }

      log.verbose()
      const durationString = Util.formatDuration(Date.now() - startTime)
      log.info(`'${name}' completed in ${durationString}.`)
    } else {
      log.info()
      log.info('Running artefacts built with a cross ' +
        'toolchains requires a runner.')
    }
  }
  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Test class is added as a property of this object.
module.exports.Test = Test

// In ES6, it would be:
// export class Test { ... }
// ...
// import { Test } from 'test.js'

// ----------------------------------------------------------------------------
