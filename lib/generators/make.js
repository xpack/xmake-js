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
 * The make generator.
 */

// ----------------------------------------------------------------------------

// const assert = require('assert')
const fs = require('fs')
const path = require('path')

// https://www.npmjs.com/package/liquidjs
const Liquid = require('liquidjs')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
const CliError = require('@ilg/cli-start-options').CliError
// const CliErrorApplication =
//  require('@ilg/cli-start-options').CliErrorApplication
const fileTypes = require('../utils/build-tree.js').fileTypes

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
// Promisifier.promisifyInPlace(fs, 'readFile')
// Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'readdir')
// Promisifier.promisifyInPlace(fs, 'mkdir')
Promisifier.promisifyInPlace(fs, 'writeFile')

const mkdirpPromise = Promisifier.promisify(require('mkdirp'))

// ============================================================================

class MakeGenerator {
  // --------------------------------------------------------------------------

  static expandCompilerCommandLine (tool, profile, node) {
    return tool.fullCommandName + ' ' + tool.options + ' ' +
      profile.options.target + ' ' + profile.options.debugging + ' ' +
      node.symbols.join(' ') + ' ' + node.includes.join(' ') + ' ' +
      node.options.toString() + ' ' + tool.deps + ' ' + tool.outputFlag +
      profile.outputPrefix + tool.output + profile.OutputSuffix +
      tool.input
  }

  /**
   * @summary Constructor, to set the context.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    this.context = context
    this.log = context.log
    const log = this.log
    log.trace(`${this.constructor.name}.construct()`)

    const templatesPath = path.resolve(context.rootPath, 'assets', 'templates')
    this.liquid = Liquid({
      root: templatesPath,
      extname: '.liquid',
      cache: false,
      strict_filters: true,       // default: false
      strict_variables: true,     // default: false
      trim_right: false           // default: false
    })
  }

  async generate (buildContext, buildConfigContext) {
    const log = this.log
    // const context = this.context
    // const config = context.config
    log.trace(`${this.constructor.name}.generate()`)

    this.buildConfigContext = buildConfigContext
    this.buildContext = buildContext

    log.verbose()

    for (let node of buildContext.sourceFolderNodes) {
      log.verbose(`Creating folder '${node.relativePath}'...`)
      const absPath =
        path.resolve(buildConfigContext.buildAbsolutePath, node.relativePath)
      await mkdirpPromise(absPath)
    }

    log.verbose()
    await this.generateMakefile()
    await this.generateObjects()
    await this.generateVariables()

    for (let folder of buildContext.sourceFolders) {
      await this.generateSubdirScan(folder)
    }
    for (let node of buildContext.sourceFolderNodes) {
      await this.generateSources(node)
    }
  }

  async generateMakefile () {
    const log = this.log
    const buildContext = this.buildContext
    const buildConfigContext = this.buildConfigContext

    const fileName = 'makefile'
    if (!log.isVerbose()) {
      log.info('Generating make files...')
    }
    log.verbose('Generating file ' +
      `'${buildConfigContext.buildRelativePath}/${fileName}'...`)

    const content = await this.liquid.renderFile(fileName + '.liquid', {
      pathToCwd: buildConfigContext.buildToProjectRelativePath,
      artefactName: buildConfigContext.artefact.fullName,
      sourceFolders: buildContext.sourceFolders,
      tools: buildConfigContext.tools,
      options: buildConfigContext.options,
      isVerbose: buildContext.isVerbose,
      fileTypes: Object.values(fileTypes),
      tab: '\t'
    })
    const outPath = path.resolve(buildConfigContext.buildAbsolutePath, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateObjects () {
    const log = this.log
    // const buildContext = this.buildContext
    const buildConfigContext = this.buildConfigContext

    const fileName = 'objects.mk'
    log.verbose('Generating file ' +
      `'${buildConfigContext.buildRelativePath}/${fileName}'...`)

    const content = await this.liquid.renderFile(fileName + '.liquid', {
      tab: '\t'
    })
    const outPath = path.resolve(buildConfigContext.buildAbsolutePath, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateVariables () {
    const log = this.log
    const buildContext = this.buildContext
    const buildConfigContext = this.buildConfigContext

    const fileName = 'variables.mk'
    log.verbose('Generating file ' +
      `'${buildConfigContext.buildRelativePath}/${fileName}'...`)

    const content = await this.liquid.renderFile(fileName + '.liquid', {
      sourceFolders: buildContext.sourceFolders,
      fileTypes: Object.values(fileTypes),
      tab: '\t'
    })
    const outPath = path.resolve(buildConfigContext.buildAbsolutePath, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateSources (node) {
    const log = this.log
    const buildContext = this.buildContext
    const buildConfigContext = this.buildConfigContext

    const fileName = 'sources.mk'
    log.verbose('Generating file ' +
      `'${path.join(buildConfigContext.buildRelativePath,
        node.relativePath, fileName)}'...`)

    const content = await this.liquid.renderFile(fileName + '.liquid', {
      pathToCwd: buildConfigContext.buildToProjectRelativePath,
      folder: node.relativePath,
      fileNodes: node.files,
      isVerbose: buildContext.isVerbose,
      tab: '\t'
    })
    const outPath =
      path.resolve(buildConfigContext.buildAbsolutePath,
        node.relativePath, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateSubdir_ (folder, files) {
    const log = this.log
    const buildContext = this.buildContext
    const buildConfigContext = this.buildConfigContext

    const fileName = 'subdir.mk'
    log.verbose('Generating file ' +
      `'${path.join(buildConfigContext.buildRelativePath, folder, fileName)}'` +
      '...')

    const content = await this.liquid.renderFile(fileName + '.liquid', {
      pathToCwd: buildConfigContext.buildToProjectRelativePath,
      folder: folder,
      options: buildConfigContext.options,
      includeOptions: buildConfigContext.includeOptions,
      files: files,
      isVerbose: buildContext.isVerbose,
      tab: '\t'
    })
    const outPath =
      path.resolve(buildConfigContext.buildAbsolutePath, folder, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateSubdirScan (folder) {
    // const log = this.log
    // const context = this.context
    const config = this.context.config

    const files = {}
    files.c = []
    files.cpp = []
    files.as = []

    const absPath = path.resolve(config.cwd, folder)
    const names = await fs.readdirPromise(absPath)
    for (let name of names) {
      if (name.endsWith('.c')) {
        files.c.push(name.substr(0, name.length - '.c'.length))
      } else if (name.endsWith('.cpp')) {
        files.cpp.push(name.substr(0, name.length - '.cpp'.length))
      } else if (name.endsWith('.S')) {
        files.as.push(name.substr(0, name.length - '.S'.length))
      }
    }

    await this.generateSubdir_(folder, files)
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The MakeGenerator class is added as a property of this object.
module.exports.MakeGenerator = MakeGenerator

// In ES6, it would be:
// export class MakeGenerator { ... }
// ...
// import { MakeGenerator } from './generators/make.js'

// ----------------------------------------------------------------------------
