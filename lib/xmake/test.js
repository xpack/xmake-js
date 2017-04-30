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
 * The `xpm test <options> ...` command implementation.
 */

// ----------------------------------------------------------------------------

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn

// TODO: extract to a separate module
const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
const CliCommand = require('@ilg/cli-start-options').CliCommand
const CliOptions = require('@ilg/cli-start-options').CliOptions
const CliHelp = require('@ilg/cli-start-options').CliHelp
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
const CliApplication = require('@ilg/cli-start-options').CliApplication
const CliError = require('@ilg/cli-start-options').CliError
const CliErrorApplication =
  require('@ilg/cli-start-options').CliErrorApplication

const MakeGenerator = require('../../lib/generators/make.js').MakeGenerator

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readFile')
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'readdir')
// Promisifier.promisifyInPlace(fs, 'mkdir')
// Promisifier.promisifyInPlace(fs, 'writeFile')

// const mkdirpPromise = Promisifier.promisify(require('mkdirp'))

// ----------------------------------------------------------------------------

const defaultDepth = 2
const xmakeTestJsonFileName = 'xmake-test.json'
const buildFolderName = 'build'

// ============================================================================

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
            options: ['--target'],
            param: 'name',
            msg: 'Target name',
            init: (context) => {
              context.config.targets = []
            },
            action: (context, val) => {
              context.config.targets.push(val.toLower())
            },
            isOptional: true,
            isMultiple: true
          },
          {
            options: ['--toolchain'],
            param: 'name',
            msg: 'Toolchain name',
            init: (context) => {
              context.config.toolchains = []
            },
            action: (context, val) => {
              context.config.toolchains.push(val.toLowerCase())
            },
            isOptional: true,
            isMultiple: true
          },
          {
            options: ['--profile'],
            param: 'name',
            msg: 'Profile name',
            init: (context) => {
              context.config.toolchains = []
            },
            action: (context, val) => {
              context.config.toolchains.push(val.toLowerCase())
            },
            isOptional: true,
            isMultiple: true
          },
          {
            options: ['--depth'],
            param: 'n',
            msg: `Search depth, default ${defaultDepth}`,
            init: (context) => {
              context.config.searchDepth = defaultDepth
            },
            action: (context, val) => {
              context.config.searchDepth = val
            },
            isOptional: true
          },
          {
            options: ['--build-folder'],
            param: 'path',
            msg: `Build folder, default ${buildFolderName}`,
            init: (context) => {
              context.config.buildFolderPath = buildFolderName
            },
            action: (context, val) => {
              context.config.buildFolderPath = val
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
      log.always(`${CliHelp.padRight('  <name>...', more.width)} ` +
        `Folder path(s) (optional, multiple)`)
      log.always(`${CliHelp.padRight('  <build args>...', more.width)} ` +
        `Extra arguments for the builder (optional, multiple)`)
      log.always(`${CliHelp.padRight('  <run args>...', more.width)} ` +
        `Extra arguments when running the test (optional, multiple)`)
    }
  }

  /**
   * @summary Execute the `test` command.
   *
   * @param {string[]} args Command line arguments.
   * @returns {number} Return code.
   *
   * @override
   */
  async doRun (args) {
    const log = this.log
    log.trace(`${this.constructor.name}.doRun()`)
    // const context = this.context
    const config = this.context.config

    log.info(this.title)
    const paths = CliOptions.filterOwnArguments(args)
    const otherArgs = CliOptions.filterOtherArguments(args)
    this.builderArgs = CliOptions.filterOwnArguments(otherArgs)
    this.runnerArgs = CliOptions.filterOtherArguments(otherArgs)

    // Validate --depth.
    if (config.searchDepth) {
      if (isNaN(config.searchDepth)) {
        log.error(`Invalid value (${config.searchDepth}) ` +
          `for '--depth', must be number.`)
        return CliExitCodes.ERROR.APPLICATION
      }
    }

    if (paths.length === 0) {
      try {
        // If no folders given, try to use `directories.test`, if available.
        const json = await CliApplication.readPackageJson(config.cwd)
        if (json.directories && json.directories.test) {
          log.trace(`Using package '${json.directories.test}' folder.`)
          paths.push(json.directories.test)
        } else {
          paths.push('test')
        }
      } catch (err) {
      }
    }

    const testFolders = await this.listTests(paths)
    for (const folder of testFolders) {
      log.debug(`testFolder: '${folder}'`)
    }

    if (testFolders.length) {
      for (const folder of testFolders) {
        await this.runTest(folder)
      }
    } else {
      log.warn('No tests identified.')
    }

    this.outputDoneDuration()
    return CliExitCodes.SUCCESS
  }

  async listTests (paths) {
    const log = this.log
    const config = this.context.config

    const testFolders = []
    for (const path_ of paths) {
      let p
      if (path.isAbsolute(path_)) {
        p = path_
      } else {
        p = path.resolve(config.cwd, path_)
      }
      log.trace(`inFolder: ' ${p}'`)
      await this.findTest(p, config.searchDepth, testFolders)
    }
    return testFolders
  }

  async findTest (folderPath, depth, outArray) {
    let folderStat
    try {
      folderStat = await fs.statPromise(folderPath)
    } catch (err) {
      return
    }
    if (!folderStat.isDirectory()) {
      return
    }

    const jsonPath = path.resolve(folderPath, xmakeTestJsonFileName)
    try {
      const fileStat = await fs.statPromise(jsonPath)
      if (fileStat.isFile()) {
        outArray.push(folderPath)
        return
      }
    } catch (err) {
      // Probably ENOENT if the file was not found.
    }

    if (depth === 0) {
      return
    }

    // No more excuses; recurse.
    const names = await fs.readdirPromise(folderPath)
    for (let name of names) {
      if (name.startsWith('.')) {
        continue
      }
      const childPath = path.resolve(folderPath, name)
      await this.findTest(childPath, depth - 1, outArray)
    }
  }

  /**
   * @summary Run a test for all its profiles.
   *
   * @param {string} folderPath Absolute folder path.
   * @returns {undefined} Nothing.
   */
  async runTest (folderPath) {
    const log = this.log
    const context = this.context
    const config = context.config

    const jsonPath = path.resolve(folderPath, xmakeTestJsonFileName)
    const fileContent = await fs.readFilePromise(jsonPath)
    assert(fileContent !== null)
    const testJson = JSON.parse(fileContent.toString())
    this.testJson = testJson

    if (testJson.generator) {
      if (testJson.generator === 'make') {
        this.generator = new MakeGenerator(context)
      } else {
        throw new CliErrorApplication(
          `Unsupported generator '${testJson.generator}'.`)
      }
    }

    let profiles = ['default']
    let testName = path.basename(folderPath).toLowerCase()
    if (testJson.version === '0.1.0') {
      if (testJson.name) {
        testName = testJson.name.toLowerCase()
      }
      if (testJson.profiles) {
        profiles = Object.keys(testJson.profiles)
      }
    }
    profiles.forEach((profile, index, array) => {
      array[index] = profile.toLowerCase()
      log.debug('profile: ' + array[index])
    })

    let targets
    if (config.targets.length !== 0) {
      targets = config.targets
    } else {
      targets = ['darwin'] // TODO: get a default
    }

    let toolchains
    if (config.toolchains.length !== 0) {
      toolchains = config.toolchains
    } else {
      toolchains = ['gcc'] // TODO: get a default
    }

    const cwdLength = config.cwd.length + 1

    assert(testJson.sourceFolders, 'sourceFolders')
    const testRelativeSourceFolders = testJson.sourceFolders
    const sourceFolders = []
    testRelativeSourceFolders.forEach((folder) => {
      const absPath = path.resolve(folderPath, folder)
      sourceFolders.push(absPath.slice(cwdLength))
    })

    assert(testJson.includeFolders, 'includeFolders')
    const testRelativeIncludeFolders = testJson.includeFolders
    const includeFolders = []
    testRelativeIncludeFolders.forEach((folder) => {
      const absPath = path.resolve(folderPath, folder)
      includeFolders.push(absPath.slice(cwdLength))
    })

    this.testContext = {}
    this.testContext.json = testJson
    this.testContext.sourceFolders = sourceFolders
    this.testContext.includeFolders = includeFolders
    this.testContext.isVerbose = log.isVerbose()

    for (let target of targets) {
      for (let toolchain of toolchains) {
        for (let profile of profiles) {
          await this.runProfile(testName, target, toolchain, profile)
        }
      }
    }
  }

  /**
   * @summary Build and run a test.
   *
   * @param {string} testName Test name.
   * @param {string} target Target ID.
   * @param {string} toolchain Toolchain ID.
   * @param {string} profile Profile ID.
   *
   * @returns {undefined} Nothing
   */
  async runProfile (testName, target, toolchain, profile) {
    const log = this.log
    const context = this.context
    const config = context.config
    const testContext = this.testContext

    log.info()
    log.info(`Starting test '${testName}', target '${target}', ` +
      `toolchain '${toolchain}', profile '${profile}'...`)

    const profileContext = {}
    this.profileContext = profileContext

    profileContext.testName = testName
    profileContext.target = target
    profileContext.toolchain = toolchain
    profileContext.profile = profile

    profileContext.tools = {}
    profileContext.options = {}

    if (path.isAbsolute(config.buildFolderPath)) {
      config.buildRelativePath =
        path.relative(config.buildFolderPath, config.cwd)
    } else {
      config.buildRelativePath = config.buildFolderPath
    }
    const profileBuildRelativePath = path.join(config.buildRelativePath,
      `test-${testName}-${target}-${toolchain}-${profile}`)
    const profileBuildAbsolutePath =
      path.resolve(config.cwd, profileBuildRelativePath)
    profileContext.profileToCwdRelativePath =
      path.relative(profileBuildAbsolutePath, config.cwd)

    profileContext.profileBuildRelativePath = profileBuildRelativePath
    profileContext.profileBuildAbsolutePath = profileBuildAbsolutePath

    log.verbose()
    let srcStr = ''
    testContext.sourceFolders.forEach((folder) => {
      if (srcStr) {
        srcStr += ', '
      }
      srcStr += `'${folder}'`
    })

    log.verbose(`Source folders: ${srcStr}`)

    let incStr = ''
    let includeOptions = ''
    testContext.includeFolders.forEach((folder) => {
      if (incStr) {
        incStr += ', '
        includeOptions += ' '
      }
      incStr += `'${folder}'`
      includeOptions +=
        `-I"${profileContext.profileToCwdRelativePath}/${folder}"`
    })

    log.verbose(`Include folders: ${incStr}`)
    profileContext.includeOptions = includeOptions

    const json = testContext.json

    let cTool = json.toolchains[toolchain].c
    cTool += ' ' + json.profiles[profile].toolchains[toolchain].common
    cTool += ' ' + json.profiles[profile].toolchains[toolchain].c
    log.verbose('Tool C: ' + cTool)
    profileContext.tools.c = json.toolchains[toolchain].c
    profileContext.options.c =
      json.profiles[profile].toolchains[toolchain].common + ' ' +
      json.profiles[profile].toolchains[toolchain].c

    let cppTool = json.toolchains[toolchain].cpp
    cppTool += ' ' + json.profiles[profile].toolchains[toolchain].common
    cppTool += ' ' + json.profiles[profile].toolchains[toolchain].cpp
    log.verbose('Tool C++: ' + cppTool)
    profileContext.tools.cpp = json.toolchains[toolchain].cpp
    profileContext.options.cpp =
      json.profiles[profile].toolchains[toolchain].common + ' ' +
      json.profiles[profile].toolchains[toolchain].cpp

    // Generate files specific to the generator.
    await this.generator.generate(testContext, profileContext)

    if (json.commands && json.commands.build) {
      log.verbose()
      log.info(`Changing current folder to ` +
        `'${profileContext.relativeBuildPath}'...`)
      // TODO: minimise noise when -q (quiet) or -s (silent).
      const spawnPromise = (command, args = [], options = {}) => {
        return new Promise((resolve, reject) => {
          options.stdio = 'inherit'
          const child = spawn(command, args, options)

          child.on('error', (err) => {
            reject(err)
          })
          child.on('close', (code) => {
            resolve(code)
          })
        })
      }

      log.info()
      log.info(`Invoking builder: '${json.commands.build}'...`)
      const builder = Array.isArray(json.commands.build)
        ? json.commands.build : json.commands.build.split(' ')
      const builderCmd = builder[0]
      const builderArgs = builder.slice(1).concat(this.builderArgs)
      log.debug(`spawn: ${builderCmd} ${builderArgs.join(' ')}`)
      const code = await spawnPromise(builderCmd, builderArgs, {
        cwd: profileContext.absoluteBuildPath
      })
      if (code !== 0) {
        throw new CliError(`Failed, '${json.commands.build}' ` +
          `returned ${code}.`, CliExitCodes.ERROR.CHILD)
      }

      log.info()
      log.info(`Invoking artefact: '${testName}'...`)
      if (json.commands.run) {
        const runner = Array.isArray(json.commands.run)
          ? json.commands.run : json.commands.run.split(' ')
        if (runner[0].includes('${artefactName}')) { // eslint-disable-line no-template-curly-in-string, max-len
          runner[0] = runner[0].replace('${artefactName}', testName) // eslint-disable-line no-template-curly-in-string, max-len
        }

        const runnerCmd = runner[0]
        const runnerArgs = runner.slice(1).concat(this.runnerArgs)
        log.debug(`spawn: ${runnerCmd} ${runnerArgs.join(' ')}`)
        const code = await spawnPromise(runnerCmd, runnerArgs, {
          cwd: profileContext.absoluteBuildPath
        })
        if (code !== 0) {
          throw new CliError(`Failed, '${json.commands.run}' ` +
            `returned ${code}.`, CliExitCodes.ERROR.CHILD)
        }

        log.info()
        log.info(`Test '${testName}', target '${target}', toolchain ` +
          `'${toolchain}', profile '${profile}' completed successfuly.`)
      }
    } else {
      log.warn('Builder not defined.')
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
