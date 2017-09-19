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

const assert = require('assert')
const fs = require('fs')
// const xml2js = require('xml2js')
const path = require('path')
const util = require('util')
const spawn = require('child_process').spawn

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
const CliApplication = require('@ilg/cli-start-options').CliApplication
const CliCommand = require('@ilg/cli-start-options').CliCommand
const CliOptions = require('@ilg/cli-start-options').CliOptions
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
const CliError = require('@ilg/cli-start-options').CliError
const CliHelp = require('@ilg/cli-start-options').CliHelp
const CliErrorApplication =
require('@ilg/cli-start-options').CliErrorApplication

const MakeGenerator = require('../../lib/generators/make.js').MakeGenerator
const SourceTree = require('../../lib/utils/build-tree.js').SourceTree
const Artefact = require('../../lib/utils/artefact.js').Artefact

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readFile')
Promisifier.promisifyInPlace(fs, 'writeFile')
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'mkdir')
Promisifier.promisifyInPlace(fs, 'readdir')

// ----------------------------------------------------------------------------

const buildFolderName = 'build'
const xmakeJsonFileName = 'xmake.json'

// ============================================================================

class Build extends CliCommand {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set help definitions.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    super(context)

    // Title displayed with the help message.
    this.title = 'Build one or all project configurations'
    this.optionGroups = [
      {
        title: 'Build options',
        postOptions: '[-- <build args>]', // Extra arguments.
        optionDefs: [
          {
            options: ['--target'],
            param: 'name',
            msg: 'Target name',
            init: (context) => {
              context.config.targets = []
            },
            action: (context, val) => {
              context.config.targets.push(val.toLowerCase())
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
      log.always(`${CliHelp.padRight('  <build args>...', more.width)} ` +
        `Extra arguments for the builder (optional, multiple)`)
    }
  }

  /**
   * @summary Execute the `build` command.
   *
   * @param {string[]} args Command line arguments.
   * @returns {number} Return code.
   *
   * @override
   */
  async doRun (args) {
    const log = this.log
    log.trace(`${this.constructor.name}.doRun()`)

    const context = this.context
    const config = this.context.config

    log.info(this.title)
    // const paths = CliOptions.filterOwnArguments(args)
    const otherArgs = CliOptions.filterOtherArguments(args)
    this.builderArgs = CliOptions.filterOwnArguments(otherArgs)

    try {
      // If the application is an xPack, read its package.json.
      context.appPackJson = await CliApplication.readPackageJson(config.cwd)
    } catch (err) {
      context.appPackJson = {}
    }

    const fileContent = await fs.readFilePromise(xmakeJsonFileName)
    assert(fileContent !== null)
    const xmakeJson = JSON.parse(fileContent.toString())
    this.xmakeJson = xmakeJson

    if (xmakeJson.generator) {
      if (xmakeJson.generator === 'make') {
        this.generator = new MakeGenerator(context)
      } else {
        throw new CliErrorApplication(
          `Unsupported generator '${xmakeJson.generator}'.`)
      }
    }

    let buildName
    let targets
    if (xmakeJson.version === '0.1.0') {
      if (xmakeJson.name) {
        buildName = xmakeJson.name.toLowerCase()
      }
      if (xmakeJson.targets) {
        targets = xmakeJson.targets
      }

      // TODO: use the structured toolchains definitions.
      if (!xmakeJson.toolchains) {
        xmakeJson.toolchains = {}
      }

      if (!xmakeJson.toolchains['riscv64-elf-gcc']) {
        xmakeJson.toolchains['riscv64-elf-gcc'] = {}
      }

      xmakeJson.toolchains['riscv64-elf-gcc'].as = 'riscv64-unknown-elf-gcc'
      xmakeJson.toolchains['riscv64-elf-gcc'].c = 'riscv64-unknown-elf-gcc'
      xmakeJson.toolchains['riscv64-elf-gcc'].cpp = 'riscv64-unknown-elf-g++'
      xmakeJson.toolchains['riscv64-elf-gcc'].ld = 'riscv64-unknown-elf-g++'
    } else {
      throw new CliErrorApplication(
        `Unsupported xmake.version '${xmakeJson.version}'.`)
    }

    assert(buildName, 'Missing project name')
    assert(targets, 'Missing targets')

    const cwdLength = config.cwd.length + 1
    let absPath

    // Top source folders, relative to the project.
    const topSourceFolders = []
    absPath = path.resolve(config.cwd, 'src')
    topSourceFolders.push(absPath.slice(cwdLength))

    const includeFolders = []
    absPath = path.resolve(config.cwd, 'include')
    includeFolders.push(absPath.slice(cwdLength))

    absPath = path.resolve(config.cwd, 'xpacks')
    const names = await fs.readdirPromise(absPath)

    for (const xpack of names) {
      if (xpack.startsWith('.')) {
        continue
      }
      absPath = path.resolve(config.cwd, 'xpacks', xpack, 'src')
      topSourceFolders.push(absPath.slice(cwdLength))

      absPath = path.resolve(config.cwd, 'xpacks', xpack, 'include')
      includeFolders.push(absPath.slice(cwdLength))
    }

    const sourceTree = new SourceTree(context)
    await sourceTree.create(topSourceFolders)

    const sourceFolderNodes = []
    const sourceFolders = []
    sourceTree.getSourceFolders(sourceFolderNodes)
    for (const node of sourceFolderNodes) {
      log.debug(`source folders: ${node.relativePath}`)
      sourceFolders.push(node.relativePath)
    }

    if (path.isAbsolute(config.buildFolderPath)) {
      config.buildRelativePath =
        path.relative(config.buildFolderPath, config.cwd)
    } else {
      config.buildRelativePath = config.buildFolderPath
    }

    this.buildContext = {}
    this.buildContext.json = xmakeJson
    this.buildContext.topSourceFolders = topSourceFolders
    this.buildContext.sourceFolders = sourceFolders
    this.buildContext.sourceFolderNodes = sourceFolderNodes
    this.buildContext.includeFolders = includeFolders
    this.buildContext.isVerbose = log.isVerbose()

    for (const [targetName, target] of Object.entries(targets)) {
      for (const [profileName, profile] of Object.entries(target.profiles)) {
        for (const toolchainName of Object.keys(profile.toolchains)) {
          await this.buildConfiguration(buildName, targetName, profileName,
            toolchainName)
        }
      }
    }

    this.outputDoneDuration()
    return CliExitCodes.SUCCESS
  }

  async buildConfiguration (buildName, targetName, profileName, toolchainName) {
    const log = this.log
    const context = this.context
    const config = context.config
    const buildContext = this.buildContext

    const startTime = Date.now()

    log.info()
    log.info(`Generating the build files for '${buildName}', ` +
      `target '${targetName}', ` +
      `profile '${profileName}', toolchain '${toolchainName}'...`)

    const buildConfigContext = {}
    this.buildConfigContext = buildConfigContext

    buildConfigContext.buildName = buildName
    buildConfigContext.targetName = targetName
    buildConfigContext.profileName = profileName
    buildConfigContext.toolchainName = toolchainName

    buildConfigContext.tools = {}
    buildConfigContext.options = {}

    const buildConfigRelativePath = path.join(config.buildRelativePath,
      `${buildName}-${targetName}-${profileName}-${toolchainName}`)
    const buildConfigAbsolutePath =
      path.resolve(config.cwd, buildConfigRelativePath)

    buildConfigContext.buildToProjectRelativePath =
      path.relative(buildConfigAbsolutePath, config.cwd)
    buildConfigContext.buildRelativePath = buildConfigRelativePath
    buildConfigContext.buildAbsolutePath = buildConfigAbsolutePath

    const json = this.buildContext.json
    const buildConfigArtefact = {}
    buildConfigArtefact.type = json.artefact.type || 'executable'
    buildConfigArtefact.name = json.artefact.name || buildName
    buildConfigArtefact.extension = json.artefact.extension || ''
    buildConfigArtefact.outputPrefix = json.artefact.outputPrefix || ''
    buildConfigArtefact.outputSuffix = json.artefact.outputSuffix || ''

    if (buildConfigArtefact.name.includes('${build.name}')) {  // eslint-disable-line no-template-curly-in-string, max-len
      buildConfigArtefact.name = buildConfigArtefact.name
        .replace('${build.name}', buildName) // eslint-disable-line no-template-curly-in-string, max-len
    }

    buildConfigContext.artefact = new Artefact(buildConfigArtefact)
    log.trace(util.inspect(buildConfigContext.artefact))

    log.verbose()
    let srcStr = ''
    buildContext.sourceFolders.forEach((folder) => {
      if (srcStr) {
        srcStr += ', '
      }
      srcStr += `'${folder}'`
    })

    log.verbose(`Source folders: ${srcStr}`)

    let incStr = ''
    let includeOptions = ''
    buildContext.includeFolders.forEach((folder) => {
      if (incStr) {
        incStr += ', '
        includeOptions += ' '
      }
      incStr += `'${folder}'`
      includeOptions +=
        `-I"${buildConfigContext.buildToProjectRelativePath}/${folder}"`
    })

    log.verbose(`Include folders: ${incStr}`)
    buildConfigContext.includeOptions = includeOptions

    const toolchain = json.targets[targetName].profiles[profileName]
      .toolchains[toolchainName]

    let cTool = toolchain.options.target.concat(toolchain.options.debugging,
      toolchain.options.optimizations, toolchain.tools.c.addOptimizations,
      toolchain.options.warnings, toolchain.tools.c.addWarnings,
      toolchain.options.miscellaneous, toolchain.tools.c.addMiscellaneous)
    buildConfigContext.tools.c = json.toolchains[toolchainName].c
    buildConfigContext.options.c = cTool.join(' ')
    log.verbose(`Tool C: ${buildConfigContext.options.c}`)

    let cppTool = toolchain.options.target.concat(toolchain.options.debugging,
      toolchain.options.optimizations, toolchain.tools.cpp.addOptimizations,
      toolchain.options.warnings, toolchain.tools.cpp.addWarnings,
      toolchain.options.miscellaneous, toolchain.tools.cpp.addMiscellaneous)
    buildConfigContext.tools.cpp = json.toolchains[toolchainName].cpp
    buildConfigContext.options.cpp = cppTool.join(' ')
    log.verbose(`Tool C++: ${buildConfigContext.options.cpp}`)

    let asTool = toolchain.options.target.concat(toolchain.options.debugging,
      toolchain.options.optimizations, toolchain.tools.as.addOptimizations,
      toolchain.options.warnings, toolchain.tools.as.addWarnings,
      toolchain.options.miscellaneous, toolchain.tools.as.addMiscellaneous)
    buildConfigContext.tools.as = json.toolchains[toolchainName].as
    buildConfigContext.options.as = asTool.join(' ')
    log.verbose(`Tool AS: ${buildConfigContext.options.as}`)

    let cppLinkerTool = toolchain.options.target.concat(
      toolchain.options.debugging, toolchain.options.optimizations,
      toolchain.tools.cppLinker.addOptimizations, toolchain.options.warnings,
      toolchain.tools.cppLinker.addWarnings, toolchain.options.miscellaneous,
      toolchain.tools.cppLinker.addMiscellaneous)
    buildConfigContext.tools.cppLinker = json.toolchains[toolchainName]
      .cppLinker
    buildConfigContext.options.cppLinker = cppLinkerTool.join(' ')
    log.verbose(`Tool C++ Linker: ${buildConfigContext.options.cppLinker}`)

    // Generate files specific to the generator.
    await this.generator.generate(buildContext, buildConfigContext)

    log.verbose()
    log.info(`Build files generated in ${Date.now() - startTime} ms.`)

    if (json.commands && json.commands.build) {
      const buildStartTime = Date.now()

      log.info()
      log.info(`Changing current folder to ` +
        `'${buildConfigContext.buildRelativePath}'...`)
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
        cwd: buildConfigContext.buildAbsolutePath
      })
      if (code !== 0) {
        throw new CliError(`Failed, '${json.commands.build}' ` +
          `returned ${code}.`, CliExitCodes.ERROR.CHILD)
      }
      log.info(`Build completed in ${Date.now() - buildStartTime} ms.`)
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Build class is added as a property of this object.
module.exports.Build = Build

// In ES6, it would be:
// export class Build { ... }
// ...
// import { Build } from 'build.js'

// ----------------------------------------------------------------------------
