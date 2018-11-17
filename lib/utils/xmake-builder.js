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

// const CliErrorApplication =
//  require('@ilg/cli-start-options').CliErrorApplication

// const JsonCache = require('../../lib/utils/json-cache.js').JsonCache
const Util = require('./util.js').Util
const MakeGenerator = require('../generators/make.js').MakeGenerator
const NinjaGenerator = require('../generators/ninja.js').NinjaGenerator
const SourceTree = require('./source-tree.js').SourceTree
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

const defaultGeneratorName = 'make'

// ============================================================================

class XmakeBuilder {
  /**
   * @summary Construct a generic builder, to be called for each
   * build configuration.
   *
   * @param {Object} context The build context.
   * @param {Object} context.log The logger.
   * @param {Object} context.cwd The absolute CWD path.
   * @param {Object} context.buildProject The build context.
   * @param {Object} context.config The command configuration.
   * @param {String[]} context.bulderArgs Optional arguments.
   */
  constructor (context) {
    assert(context, 'There must be a context')
    this.buildProject = context

    assert(context.log, 'There must be a logger.')
    this.log = context.log

    assert(context.cwd, 'There must be a context.cwd.')
    this.cwd = context.cwd

    assert(context.config, 'There must be a context.config.')
    this.config = context.config

    assert(context.builderArgs, 'There must be a context.builderArgs.')
    this.builderArgs = context.builderArgs

    assert(context.xmakeParser, 'There must be a context.xmakeParser.')
    this.xmakeParser = context.xmakeParser

    const log = this.log
    log.trace(`${this.constructor.name}.construct()`)

    this.doCompilationDatabase = false

    if (this.config.generator) {
      this.generatorName = this.config.generator
    } else {
      for (const [name, generator] of
        Object.entries(this.buildProject.generators)) {
        if (generator.default) {
          this.generatorName = name.toLowerCase()
          break
        }
      }
    }

    if (!this.generatorName) {
      this.generatorName = defaultGeneratorName
    }

    // Instantiate the desired generator.
    if (this.generatorName === 'make') {
      this.generator = new MakeGenerator({
        log,
        cwd: this.cwd,
        buildProject: this.buildProject
      })
      this.doCompilationDatabase = true
    } else if (this.generatorName === 'ninja') {
      this.generator = new NinjaGenerator({
        log,
        cwd: this.cwd,
        buildProject: this.buildProject
      })
      this.doCompilationDatabase = true
    } else {
      throw new Error(`Generator '${this.generatorName}' not supported.`)
    }
  }

  async build (buildConfiguration) {
    const log = this.log
    log.trace(`${this.constructor.name}.build('${buildConfiguration.name}')`)

    const startTime = Date.now()

    const generatorName = this.generatorName
    log.info()
    log.info(`Generating the '${generatorName}' files for configuration ` +
      `'${buildConfiguration.name}'...`)

    // Preferably set these before creating the source tree.
    buildConfiguration.buildAbsolutePath =
      path.join(this.cwd, this.config.buildFolderPath, buildConfiguration.name)

    buildConfiguration.buildToProjectRelativePath =
      path.relative(buildConfiguration.buildAbsolutePath, this.cwd)

    const sourceTree = new SourceTree({
      log,
      cwd: this.cwd,
      fileExtensions: buildConfiguration.toolchain.fileExtensions,
      tool: buildConfiguration.tool,
      toolchain: buildConfiguration.toolchain,
      language: buildConfiguration.language,
      xmakeParser: this.xmakeParser
    })

    // TODO: if empty, should we use defaults?
    if (buildConfiguration.sourceFolders.length === 0) {
      throw new Error(`No source folders defined.`)
    }
    await sourceTree.create(buildConfiguration.sourceFolders)

    buildConfiguration.sourceTree = sourceTree

    // To compute the relative paths, it needs the `buildAbsolutePath`.
    sourceTree.addNodesProperties(buildConfiguration)

    // Contribute sourceFolderNodes to the build configuration.
    buildConfiguration.sourceFolderNodes = sourceTree.sourceFolderNodes

    // Contribute an array of tools to the build configuration.
    buildConfiguration.tools = sourceTree.tools

    await this.generator.generate(buildConfiguration)

    if (this.doCompilationDatabase &&
      buildConfiguration.exportCompilationDatabase) {
      await this.createCompilationDatabaseJson(buildConfiguration)
    }

    log.verbose()
    const durationString = Util.formatDuration(Date.now() - startTime)
    log.info(`'${generatorName}' files generated in ` +
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
   * @param {BuildConfiguration} buildConfiguration The build configuration.
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

    const outPath = path.join(buildConfiguration.buildAbsolutePath, fileName)
    const relativePath = path.relative(
      buildConfiguration.buildProject.cwd, buildConfiguration.buildAbsolutePath)

    log.verbose('Generating file ' +
      `'${path.join(relativePath, fileName)}'...`)

    const out = []
    this.getCompileCommandsRecursive_(buildConfiguration.sourceTree,
      buildConfiguration.buildAbsolutePath, out)

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

    const relativePath = path.posix.relative(
      buildConfiguration.buildProject.cwd, buildConfiguration.buildAbsolutePath)

    log.info()
    log.info(`Changing current folder to '${relativePath}'...`)
    // TODO: minimise noise when -q (quiet) or -s (silent).

    let generator
    if (buildConfiguration.buildProject.generators) {
      generator = buildConfiguration.buildProject
        .generators[this.generatorName]
    }
    let builderArray
    if (generator && generator.command) {
      builderArray = generator.command
    } else {
      // Default to a command line with the generator name.
      builderArray = [this.generatorName]
    }

    builderArray = builderArray.concat(this.builderArgs)

    const cmd = builderArray.join(' ')

    log.info()
    log.info(`Invoking builder: '${cmd}'...`)

    log.debug(`spawn: ${cmd}`)

    const spawn = new Spawn()
    const code = await spawn.executeShellPromise(
      cmd,
      {
        cwd: buildConfiguration.buildAbsolutePath
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
