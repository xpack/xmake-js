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

const fs = require('fs')
const assert = require('assert')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ----------------------------------------------------------------------------

const mockLog = {}
mockLog.warn = () => {}
// mockLog.debug = () => {}
// mockLog.trace = () => {}

// ============================================================================

class IgnorerCache {
  /**
   * @summary Get the content of a `.xmakeignore` file.
   *
   * @static
   * @async
   * @param {String} fileAbsolutePath Absolute path to ignore file.
   * @param {Object} options Optional tweaks.
   * @param {Object} options.log Logger with a warn() function
   * @returns {String[]} An array of names.
   * @throws ENOENT: no such file
   *
   * @description
   * This function keeps a cache of ignorer arrays, indexed by paths.
   *
   * The returned objects are arrays of string with file/folder names.
   * The caller should not modify it, by all means,
   * otherwise the cache consistency is compromised.
   */
  static async read (fileAbsolutePath, options = {}) {
    assert(fileAbsolutePath, 'There must be a file path')
    const Self = this

    if (!Self.cache) {
      Self.cache = {}
    }

    if (Self.cache.hasOwnProperty(fileAbsolutePath)) {
      return Self.cache[fileAbsolutePath]
    }

    if (!options.log) {
      options.log = mockLog
    }

    const log = options.log

    const fileString = await fsPromises.readFile(fileAbsolutePath, {
      encoding: 'utf8'
    })
    assert(fileString !== null)

    const ignorerLines = fileString.split(/\r?\n/)

    const ignoredNames = []
    for (const line of ignorerLines) {
      const str = line.trim()
      // Ignore empty lines and comments.
      if (str.length === 0 || str.startsWith('#')) {
        continue
      }
      // Only plain file names are supported, no sub-folders or generics.
      // TODO: identify Windows back-slash paths.
      if (str.match(/[*?![\]/]/)) {
        log.warn(`'${str}' not a file name in '${fileAbsolutePath}'`)
        continue
      }
      ignoredNames.push(str)
    }

    Self.cache[fileAbsolutePath] = ignoredNames

    return ignoredNames
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.IgnorerCache = IgnorerCache

// In ES6, it would be:
// export class IgnorerCache { ... }
// ...
// import { IgnorerCache } from '../utils/ignorer-cache.js'

// ----------------------------------------------------------------------------
