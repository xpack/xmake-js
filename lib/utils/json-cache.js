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
// const path = require('path')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ============================================================================

class JsonCache {
  /**
   * @summary Get the content of a JSON file.
   *
   * @async
   * @param {String} fileAbsolutePath Absolute path to JSON file.
   * @returns {Object} A JSON object.
   * @throws ENOENT: no such file or directory, open
   * @throws SyntaxError
   *
   * @description
   * This function keeps a cache of JSON objects, indexed by paths.
   *
   * The returned objects are the exact JSON objects, as parsed
   * by `JSON.parse()`. The caller should not modify it, by all means,
   * otherwise the cache consistency is compromised.
   *
   * The input JSON files are expected to have UTF-8 encodings.
   */
  static async parse (fileAbsolutePath) {
    const Self = this

    if (!Self.cache) {
      Self.cache = {}
    }

    if (Self.cache.hasOwnProperty(fileAbsolutePath)) {
      return Self.cache[fileAbsolutePath]
    }

    const fileString = await fsPromises.readFile(fileAbsolutePath, {
      encoding: 'utf8'
    })
    assert(fileString !== null)
    const json = JSON.parse(fileString)
    Self.cache[fileAbsolutePath] = json

    return json
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.JsonCache = JsonCache

// In ES6, it would be:
// export class JsonCache { ... }
// ...
// import { JsonCache } from '../utils/json-cache.js'

// ----------------------------------------------------------------------------
