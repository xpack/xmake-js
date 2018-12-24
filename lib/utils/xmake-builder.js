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

const assert = require('assert')
const path = require('path')
const fs = require('fs')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

const Util = require('./util.js').Util
const MakeBuilder = require('../builders/make.js').MakeBuilder
const NinjaBuilder = require('../builders/ninja.js').NinjaBuilder
const Spawn = require('./spawn.js').Spawn
const CliError = require('@ilg/cli-start-options').CliError
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have identical names, but placed within `promises_`.
Promisifier.promisifyInPlace(fs, 'writeFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ----------------------------------------------------------------------------

const defaultBuilderName = 'make'

// ============================================================================

class XmakeBuilder {
  /**
   * @summary Construct a generic builder, to be called for each
   * build configuration.
   *
   * @param {Object} args The build context.
   * @param {Object} context.log The logger.
   * @param {Object} context.cwd The absolute CWD path.
   * @param {Object} context.topConfiguration The build context.
   * @param {Object} context.config The command configuration.
   * @param {String[]} context.bulderArgs Optional arguments.
   */
  constructor (args) {
    assert(args, 'There must be an args')
    assert(args.log, 'There must be an args.log.')
    this.log = args.log

    assert(args.cwd, 'There must be an args.cwd.')
    this.cwd = args.cwd

    assert(args.config, 'There must be a args.config.')
    this.config = args.config

    this.builderName = args.builderName

    assert(args.builderArgs, 'There must be a args.builderArgs.')
    this.builderArgs = args.builderArgs

    const log = this.log
    log.trace(`${this.constructor.name}.construct()`)

    this.doCompilationDatabase = false

    if (!this.builderName) {
      this.builderName = defaultBuilderName
    }

    // Instantiate the desired builder.
    if (this.builderName === 'make') {
      this.builder = new MakeBuilder({
        log,
        cwd: this.cwd
      })
      this.doCompilationDatabase = true
    } else if (this.builderName === 'ninja') {
      this.builder = new NinjaBuilder({
        log,
        cwd: this.cwd
      })
      this.doCompilationDatabase = true
    } else {
      throw new Error(`Builder '${this.builderName}' not supported.`)
    }
  }

  async build (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.build('${buildConfiguration.name}')`)

    const startTime = Date.now()

    const builderName = this.builderName
    log.info()
    log.info(`Generating the '${builderName}' files for configuration ` +
      `'${buildConfiguration.name}'...`)

    const topConfiguration = buildConfiguration.topConfiguration
    const xmakeParser = topConfiguration.actual.xmakeParser

    xmakeParser.postProcessConfiguration(buildConfiguration)
    await xmakeParser.createSourceTree(buildConfiguration,
      this.config.buildFolderPath)

    await this.builder.generateFiles(buildConfiguration)

    if (this.doCompilationDatabase &&
      buildConfiguration.exportCompilationDatabase) {
      await this.createCompilationDatabaseJson(buildConfiguration)
    }

    log.verbose()
    const durationString = Util.formatDuration(Date.now() - startTime)
    log.info(`'${builderName}' files generated in ` +
      `${durationString}.`)

    if (!this.config.isNoBuild) {
      await this.runBuilder(buildConfiguration)
    } else {
      log.info('Running builder skipped.')
    }
  }

  /**
   * @summary Create the Compilation Database.
   *
   * @async
   * @param {CFBuildConfiguration} buildConfiguration The build
   * configuration.
   * @returns {undefined} Nothing.
   *
   * @description
   *
   * The file follows the clang/CMake specs:
   * https://clang.llvm.org/docs/JSONCompilationDatabase.html
   * https://cmake.org/cmake/help/latest/variable/CMAKE_EXPORT_COMPILE_COMMANDS.html
   *
   * To be noted that commands do not have the full path.
   * @todo Make command path absolute.
   *
   * Can be disabled via `"exportCompilationDatabase": false` in the project
   * or configuration definitions.
   */
  async createCompilationDatabaseJson (buildConfiguration) {
    const log = this.log
    const fileName = 'compile_commands.json'

    const outPath =
      path.join(buildConfiguration.actual.buildAbsolutePath, fileName)
    const relativePath = path.relative(
      buildConfiguration.topConfiguration.actual.cwd,
      buildConfiguration.actual.buildAbsolutePath
    )

    log.verbose('Generating file ' +
      `'${path.join(relativePath, fileName)}'...`)

    const out = []
    this.getCompileCommandsRecursive_(
      buildConfiguration.actual.sourceTree,
      buildConfiguration.actual.buildAbsolutePath,
      out
    )

    const content = JSON.stringify(out)

    // console.log(out)
    try {
      await fsPromises.writeFile(outPath, content, 'utf8')
    } catch (err) {
      throw new Error(err.message)
    }
  }

  getCompileCommandsRecursive_ (node, buildFolder, out) {
    if (node.files.length > 0) {
      for (const file of node.files) {
        out.push({
          directory: buildFolder,
          command: file.fullCommand,
          file: file.buildRelativePath
        })
      }
    }
    for (const folder of node.folders) {
      this.getCompileCommandsRecursive_(folder, buildFolder, out)
    }
  }

  async runBuilder (buildConfiguration) {
    const log = this.log
    const buildStartTime = Date.now()

    const topConfiguration = buildConfiguration.topConfiguration
    const relativePath = path.posix.relative(
      topConfiguration.actual.cwd,
      buildConfiguration.actual.buildAbsolutePath)

    log.info()
    log.info(`Changing current folder to '${relativePath}'...`)
    // TODO: minimise noise when -q (quiet) or -s (silent).

    let builder
    if (topConfiguration.builders) {
      builder = topConfiguration.builders[this.builderName]
    }
    let builderArray
    if (builder && builder.command) {
      builderArray = builder.command
    } else {
      // Default to a command line with the builder name.
      builderArray = [this.builderName]
    }

    builderArray = [...builderArray, ...this.builderArgs]

    const cmd = builderArray.join(' ')

    log.info()
    log.info(`Invoking builder: '${cmd}'...`)

    log.debug(`spawn: ${cmd}`)

    const spawn = new Spawn()
    const code = await spawn.executeShellPromise(
      cmd,
      {
        cwd: buildConfiguration.actual.buildAbsolutePath
      })

    if (code !== 0) {
      throw new CliError(`Failed, '${cmd}' ` +
          `returned ${code}.`, CliExitCodes.ERROR.CHILD)
    }

    const durationString = Util.formatDuration(Date.now() - buildStartTime)
    log.info(`'${cmd}' completed in ${durationString}.`)
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.XmakeBuilder = XmakeBuilder

// In ES6, it would be:
// export class XmakeBuilder { ... }
// ...
// import { XmakeBuilder } from '../utils/xmake-builder.js'

// ----------------------------------------------------------------------------
