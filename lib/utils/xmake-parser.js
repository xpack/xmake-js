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

const path = require('path')

// const assert = require('assert')
// const fs = require('fs')

// const Promisifier = require('@ilg/es6-promisifier').Promisifier

const CliErrorApplication =
  require('@ilg/cli-start-options').CliErrorApplication

const JsonCache = require('../../lib/utils/json-cache.js').JsonCache

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have identical names, but placed within `promises_`.
// Promisifier.promisifyInPlace(fs, 'readFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
// const fsPromises = fs.promises_

// ============================================================================

class XmakeParser {
  constructor (context) {
    this.context = context
  }

  static isXmakeJson (name) {
    const Self = this
    if (name === Self.xmakeJsonFileName || name === Self.dotXmakeJsonFileName) {
      return true
    }
    return false
  }

  /**
   * @typedef {Object} XmakeContext
   * @property {Object} json The parsed xmake.json.
   * @property {Object[]} configurations Array of configurations (for main
   *  and tests)
   */

  /**
   * @summary Parse the xmake.json and prepare the context.
   *
   * @async
   * @param {String} folderAbsolutePath Folder where the xmake is located.
   * @param {Object} options Tweaks; if none, assume main application.
   * @param {boolean} options.meta True if part of folder metadata.
   * @param {boolean} options.test True if test.
   * @returns {XmakeContext} xmakeContext
   * @throws SyntaxError
   * @throws Error ENOENT: no such file or directory, open ...
   *
   * @description
   * Multi-version, must accommodate all previous official versions.
   *
   */
  async parse (folderAbsolutePath, options = {}) {
    const context = this.context
    const config = context.config

    let fileAbsolutePath
    let json

    try {
      fileAbsolutePath = path.join(folderAbsolutePath,
        XmakeParser.xmakeJsonFileName)
      json = await JsonCache.parse(fileAbsolutePath)
    } catch (ex) {
      // console.log(ex)
      if (ex instanceof SyntaxError) {
        throw ex
      } else {
        try {
          fileAbsolutePath = path.join(folderAbsolutePath,
            XmakeParser.dotXmakeJsonFileName)
          json = await JsonCache.parse(fileAbsolutePath)
        } catch (ex2) {
          if (ex2 instanceof SyntaxError) {
            throw ex2
          } else {
            // console.log(ex2)
            throw new CliErrorApplication(
              `Missing mandatory 'xmake.json' file.`)
          }
        }
      }
    }

    const relativePath = path.relative(config.cwd, fileAbsolutePath)
    this.xmakeContext = {}
    this.xmakeContext.json = json

    if (!json.version) {
      throw new CliErrorApplication(
        `Missing version in '${relativePath}'.`)
    }

    if (json.version.startsWith('0.1.')) {
      throw new CliErrorApplication(
        `Experimental version 0.1 no longer supported in '${relativePath}'.`)
    } else if (json.version.startsWith('0.2.')) {
      await this.parse02x()
    } else {
      throw new CliErrorApplication(
        `Unsupported version ${json.version} in '${relativePath}'.`)
    }
    return this.xmakeContext
  }

  async parse02x () {
  }
}

// ----------------------------------------------------------------------------

// Define file names as properties of the class.
XmakeParser.xmakeJsonFileName = 'xmake.json'
XmakeParser.dotXmakeJsonFileName = '.xmake.json'

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.XmakeParser = XmakeParser

// In ES6, it would be:
// export class XmakeParser { ... }
// ...
// import { XmakeParser } from '../utils/xmake-parser.js'

// ----------------------------------------------------------------------------
