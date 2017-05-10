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

// https://www.npmjs.com/package/shopify-liquid
const Liquid = require('shopify-liquid')

// TODO: extract to a separate module
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

    const templatesPath = path.resolve(context.rootPath, 'assets/templates')
    this.engine = Liquid({
      root: templatesPath,
      extname: '.liquid',
      cache: false,
      strict_filters: true,       // default: false
      strict_variables: true,     // default: false
      trim_right: true            // default: false
    })
  }

  async generate (testContext, profileContext) {
    const log = this.log
    const context = this.context
    const config = context.config
    log.trace(`${this.constructor.name}.generate()`)

    this.profileContext = profileContext
    this.testContext = testContext

    log.verbose()

    profileContext.relativeBuildPath = profileContext.profileBuildRelativePath
    profileContext.absoluteBuildPath =
      path.resolve(config.cwd, profileContext.profileBuildRelativePath)

    for (let node of testContext.sourceFolderNodes) {
      log.verbose(`Creating folder '${node.relativePath}'...`)
      const absPath =
        path.resolve(profileContext.absoluteBuildPath, node.relativePath)
      await mkdirpPromise(absPath)
    }

    log.verbose()
    await this.generateMakefile()
    await this.generateObjects()
    await this.generateVariables()

    for (let folder of testContext.sourceFolders) {
      await this.generateSubdirScan(folder)
    }
    for (let node of testContext.sourceFolderNodes) {
      await this.generateSources(node)
    }
  }

  async generateMakefile () {
    const log = this.log
    const testContext = this.testContext
    const profileContext = this.profileContext

    const fileName = 'makefile'
    if (!log.isVerbose()) {
      log.info('Generating make files...')
    }
    log.verbose('Generating file ' +
      `'${profileContext.relativeBuildPath}/${fileName}'...`)

    const content = await this.engine.renderFile(fileName + '.liquid', {
      pathToCwd: profileContext.profileToCwdRelativePath,
      artifactName: profileContext.artifact.fullName,
      sourceFolders: testContext.sourceFolders,
      tools: profileContext.tools,
      isVerbose: testContext.isVerbose,
      fileTypes: Object.values(fileTypes),
      tab: '\t'
    })
    const outPath = path.resolve(profileContext.absoluteBuildPath, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateObjects () {
    const log = this.log
    // const testContext = this.testContext
    const profileContext = this.profileContext

    const fileName = 'objects.mk'
    log.verbose('Generating file ' +
      `'${profileContext.relativeBuildPath}/${fileName}'...`)

    const content = await this.engine.renderFile(fileName + '.liquid', {
      tab: '\t'
    })
    const outPath = path.resolve(profileContext.absoluteBuildPath, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateVariables () {
    const log = this.log
    const testContext = this.testContext
    const profileContext = this.profileContext

    const fileName = 'variables.mk'
    log.verbose('Generating file ' +
      `'${profileContext.relativeBuildPath}/${fileName}'...`)

    const content = await this.engine.renderFile(fileName + '.liquid', {
      sourceFolders: testContext.sourceFolders,
      fileTypes: Object.values(fileTypes),
      tab: '\t'
    })
    const outPath = path.resolve(profileContext.absoluteBuildPath, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateSources (node) {
    const log = this.log
    const testContext = this.testContext
    const profileContext = this.profileContext

    const fileName = 'sources.mk'
    log.verbose('Generating file ' +
      `'${path.join(profileContext.relativeBuildPath,
        node.relativePath, fileName)}'...`)

    const content = await this.engine.renderFile(fileName + '.liquid', {
      pathToCwd: profileContext.profileToCwdRelativePath,
      folder: node.relativePath,
      fileNodes: node.files,
      isVerbose: testContext.isVerbose,
      tab: '\t'
    })
    const outPath =
      path.resolve(profileContext.absoluteBuildPath,
        node.relativePath, fileName)
    try {
      await fs.writeFilePromise(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  async generateSubdir_ (folder, cFileNames, cppFileNames) {
    const log = this.log
    const testContext = this.testContext
    const profileContext = this.profileContext

    const fileName = 'subdir.mk'
    log.verbose('Generating file ' +
      `'${path.join(profileContext.relativeBuildPath, folder, fileName)}'...`)

    const content = await this.engine.renderFile(fileName + '.liquid', {
      pathToCwd: profileContext.profileToCwdRelativePath,
      folder: folder,
      cOptions: profileContext.options.c,
      cppOptions: profileContext.options.cpp,
      includeOptions: profileContext.includeOptions,
      cFiles: cFileNames,
      cppFiles: cppFileNames,
      isVerbose: testContext.isVerbose,
      tab: '\t'
    })
    const outPath =
      path.resolve(profileContext.absoluteBuildPath, folder, fileName)
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

    const absPath = path.resolve(config.cwd, folder)
    const cFileNames = []
    const cppFileNames = []

    const names = await fs.readdirPromise(absPath)
    for (let name of names) {
      if (name.endsWith('.c')) {
        cFileNames.push(name.substr(0, name.length - '.c'.length))
      } else if (name.endsWith('.cpp')) {
        cppFileNames.push(name.substr(0, name.length - '.cpp'.length))
      }
    }

    await this.generateSubdir_(folder, cFileNames, cppFileNames)
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Test class is added as a property of this object.
module.exports.MakeGenerator = MakeGenerator

// In ES6, it would be:
// export class MakeGenerator { ... }
// ...
// import { MakeGenerator } from './generators/make.js'

// ----------------------------------------------------------------------------
