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
 * The ninja builder.
 */

// ----------------------------------------------------------------------------

// const assert = require('assert')
const fs = require('fs')
const path = require('path')
const assert = require('assert')

// https://www.npmjs.com/package/liquidjs
const Liquid = require('liquidjs')
const mkdirp = require('async-mkdirp')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// const CliError = require('@ilg/cli-start-options').CliError
const CliErrorOutput = require('@ilg/cli-start-options').CliErrorOutput

const Util = require('../utils/util.js').Util

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'writeFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ----------------------------------------------------------------------------

// Update it if moved to other location.
const rootAbsolutePath = path.dirname(path.dirname(__dirname))
const templatesAbsolutePath = path.resolve(rootAbsolutePath,
  'assets', 'templates')

// ============================================================================

class NinjaBuilder {
  // --------------------------------------------------------------------------

  /**
   * @summary Create a ninja builder, to be called for each build configuration.
   *
   * @param {Object} args The build context.
   * @param {Object} args.log The logger.
   * @param {Object} args.cwd The absolute CWD path.
   */
  constructor (args) {
    assert(Util.isObject(args), 'There must be args.')

    assert(args.log, 'There must be a args.log.')
    this.log = args.log

    assert(args.cwd, 'There must be a args.cwd.')
    this.cwd = args.cwd

    const log = this.log
    log.trace(`${this.constructor.name}.construct()`)

    this.liquid = Liquid({
      root: templatesAbsolutePath,
      extname: '.liquid',
      cache: false,
      greedy: false, // default: true
      strict_filters: true, // default: false
      strict_variables: true, // default: false
      trim_right: false // default: false
    })
  }

  /**
   * @summary Generate the ninja file for a build configuration.
   *
   * @param {Object} buildConfiguration The build configuration.
   * @returns {undefined} Nothing.
   *
   * @description
   * Create a structure of folders that reflect the source folders.
   */
  async generateFiles (buildConfiguration) {
    const log = this.log

    log.trace(`${this.constructor.name}.generate('${buildConfiguration.name}')`)

    log.verbose()

    // Prefer the POSIX syntax for all folders used in the ninja files.
    buildConfiguration.actual.buildToProjectRelativePosixPath =
      Util.toPosixPath(buildConfiguration.actual.buildToProjectRelativePath)
    buildConfiguration.actual.sourceFoldersPosix =
      Util.toPosixPath(buildConfiguration.actual.sourceFolders)

    // Create a structure of folders that reflect the source folders.
    for (let node of buildConfiguration.actual.sourceFolderNodes) {
      log.verbose(`Creating folder '${node.relativePath}'...`)
      const absPath = path.join(
        buildConfiguration.actual.buildAbsolutePath,
        node.relativePath
      )
      await mkdirp(absPath)
    }

    await this.generateBuildNinja(buildConfiguration)
  }

  /**
   * @summary Generate the `build.ninja` file.
   *
   * @async
   * @param {CFBuildConfiguration} buildConfiguration .
   * @returns {undefined} Nothing.
   *
   * @description
   *
   *
   */
  async generateBuildNinja (buildConfiguration) {
    const log = this.log
    const topConfiguration = buildConfiguration.topConfiguration

    const fileName = 'build.ninja'

    const relativePath = path.relative(
      topConfiguration.actual.cwd,
      buildConfiguration.actual.buildAbsolutePath
    )

    log.verbose('Generating file ' +
      `'${path.join(relativePath, fileName)}'...`)

    const content = await this.liquid.renderFile(fileName + '.liquid', {
      root: buildConfiguration.actual.sourceTree,
      sourceFolders: buildConfiguration.actual.sourceFolderNodes,
      usedTools: buildConfiguration.actual.usedTools,
      toolchain: buildConfiguration.toolchain,
      artefact: buildConfiguration.actual.targetArtefact,
      artefactName: buildConfiguration.actual.targetArtefact.fullName,
      isVerbose: log.isVerbose(),
      pathToCwd: buildConfiguration.actual.buildToProjectRelativePosixPath,
      tab: '\t'
    })

    // For just in case, normally it is created when adding the source folders.
    log.trace(`mkdir ${buildConfiguration.actual.buildAbsolutePath}`)
    await mkdirp(buildConfiguration.actual.buildAbsolutePath)

    const outPath =
      path.resolve(buildConfiguration.actual.buildAbsolutePath, fileName)
    log.trace(`writing ${outPath}...`)
    try {
      await fsPromises.writeFile(outPath, content, 'utf8')
    } catch (err) {
      throw new CliErrorOutput(err.message)
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.NinjaBuilder = NinjaBuilder

// In ES6, it would be:
// export class NinjaBuilder { ... }
// ...
// import { NinjaBuilder } from './builders/ninja.js'

// ----------------------------------------------------------------------------
