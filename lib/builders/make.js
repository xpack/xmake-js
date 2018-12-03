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
 * The make builder.
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

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
const CliError = require('@ilg/cli-start-options').CliError
// const CliErrorApplication =
//  require('@ilg/cli-start-options').CliErrorApplication

// const fileTypes = require('../utils/source-tree.js').fileTypes
const Util = require('../utils/util.js').Util
// const DirCache = require('../utils/dir-cache.js').DirCache

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but belong to `promises_`.
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

class MakeBuilder {
  // --------------------------------------------------------------------------

  /**
   * @summary Create a make builder, to be called for each build configuration.
   *
   * @param {Object} context The build context.
   * @param {Object} context.log The logger.
   * @param {Object} context.cwd The absolute CWD path.
   * @param {Object} context.buildProject The build context.
   */
  constructor (context) {
    assert(context, 'There must be a context')

    assert(context.log, 'There must be a context.log.')
    this.log = context.log

    assert(context.cwd, 'There must be a context.cwd.')
    this.cwd = context.cwd

    assert(context.buildProject, 'There must be a context.buildProject.')
    this.buildProject = context.buildProject

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
   * @summary Generate the make files for a build configuration.
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

    // Prefer the POSIX syntax for all folders used in make files.
    buildConfiguration.buildToProjectRelativePosixPath =
      Util.toPosixPath(buildConfiguration.buildToProjectRelativePath)
    buildConfiguration.sourceFoldersPosix =
      Util.toPosixPath(buildConfiguration.sourceFolders)

    // Create a structure of folders that reflect the source folders.
    for (let node of buildConfiguration.sourceFolderNodes) {
      log.verbose(`Creating folder '${node.relativePath}'...`)
      const absPath =
           path.join(buildConfiguration.buildAbsolutePath, node.relativePath)
      await mkdirp(absPath)
    }

    await this.generateMakefile(buildConfiguration)
  }

  /**
   * @summary Generate the top `makefile`.
   *
   * @async
   * @param {XmakeBuildConfiguration} buildConfiguration X
   * @returns {undefined} Nothing.
   *
   * @description
   * Does not have params, but uses the object buildProject &
   * buildConfigContext.
   *
   */
  async generateMakefile (buildConfiguration) {
    const log = this.log
    const buildProject = buildConfiguration.buildProject

    const fileName = 'makefile'

    const relativePath = path.relative(
      buildConfiguration.buildProject.cwd, buildConfiguration.buildAbsolutePath)

    log.verbose('Generating file ' +
      `'${path.join(relativePath, fileName)}'...`)

    const content = await this.liquid.renderFile(fileName + '.liquid', {
      root: buildConfiguration.sourceTree,
      sourceFolders: buildConfiguration.sourceFolderNodes,
      toolchain: buildConfiguration.toolchain,
      artefact: buildConfiguration.targetArtefact,
      artefactName: buildConfiguration.targetArtefact.fullName,
      isVerbose: buildProject.isVerbose,
      pathToCwd: buildConfiguration.buildToProjectRelativePosixPath,
      tab: '\t'
    })

    // For just in case, normally it is created when adding the source folders.
    await mkdirp(buildConfiguration.buildAbsolutePath)

    const outPath = path.resolve(buildConfiguration.buildAbsolutePath, fileName)
    try {
      await fsPromises.writeFile(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.MakeBuilder = MakeBuilder

// In ES6, it would be:
// export class MakeBuilder { ... }
// ...
// import { MakeBuilder } from './builders/make.js'

// ----------------------------------------------------------------------------
