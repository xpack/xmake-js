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

// const assert = require('assert')
// const fs = require('fs')
// const path = require('path')
const util = require('util')

// const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
// const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
// const CliError = require('@ilg/cli-start-options').CliError
// const CliErrorApplication =
//  require('@ilg/cli-start-options').CliErrorApplication

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
// Promisifier.promisifyInPlace(fs, 'readFile')
// Promisifier.promisifyInPlace(fs, 'stat')
// Promisifier.promisifyInPlace(fs, 'readdir')
// Promisifier.promisifyInPlace(fs, 'mkdir')
// Promisifier.promisifyInPlace(fs, 'writeFile')

// ----------------------------------------------------------------------------

class CdtOption {
  // --------------------------------------------------------------------------

  constructor (context, buildDefinitions) {
    this.context = context
    this.log = context.log
    this.buildDefinitions = buildDefinitions
  }

  get superObject () {
    if (!this.superObject_) {
      if (this.superClass_) {
        this.superObject_ = this.buildDefinitions.options[this.superClass_]
      }
    }
    return this.superObject_
  }

  get command () {
    if (!this.command_) {
      this.command_ = this.superObject.command
    }
    return this.command_
  }

  get valueType () {
    if (!this.valueType_) {
      this.valueType_ = this.superObject.valueType
    }
    return this.valueType_
  }

  inspect (depth, opts) {
    const local = {}
    for (const key in this) {
      switch (key) {
        case 'context':
        case 'log':
        case 'buildDefinitions':
        case 'superObject_':
          break

        default:
          local[key] = this[key]
      }
    }
    return util.inspect(local, opts)
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.CdtOption = CdtOption

// In ES6, it would be:
// export class FileNode { ... }
// ...
// import { CdtOption } from 'utils/cdt-objs.js'

// ----------------------------------------------------------------------------
