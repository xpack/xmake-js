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

const fs = require('fs')
// const xml2js = require('xml2js')
// const path = require('path')

// TODO: extract to a separate module
const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
const CliCommand = require('@ilg/cli-start-options').CliCommand
const CliHelp = require('@ilg/cli-start-options').CliHelp
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
// const CliError = require('@ilg/cli-start-options').CliError

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readFile')
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'mkdir')
Promisifier.promisifyInPlace(fs, 'writeFile')

// ----------------------------------------------------------------------------

const defaultDepth = 2

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
    this.title = 'Build and execute project test(s)'
    this.optionGroups = [
      {
        title: 'Test options',
        preOptions: '[<path>...]', // Array of folder paths.
        postOptions: '[-- <args>...]', // Arguments for the test(s).
        optionDefs: [
          {
            options: ['--target'],
            param: 'name',
            msg: 'Target name',
            init: (context) => {
              context.config.targets = []
            },
            action: (context, val) => {
              context.config.targets.push(val)
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
              context.config.toolchains.push(val)
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
              context.config.toolchains.push(val)
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
      log.always(`${CliHelp.padRight('  <args>...', more.width)} ` +
        `Arguments for the test(s) (optional, multiple)`)
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
    // const config = this.context.config

    log.info(this.title)

    this.outputDoneDuration()
    return CliExitCodes.SUCCESS
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
