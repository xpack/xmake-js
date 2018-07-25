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
const path = require('path')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readdir')
Promisifier.promisifyInPlace(fs, 'stat')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ============================================================================

class DirCache {
  /**
   * @summary Get the list of files in a folder.
   *
   * @async
   * @param {*} folderAbsolutePath Folder path.
   * @param {bool} withStat Fetch stat() info for each file.
   * @returns {Object[]} Array of objects with a `name` property.
   *
   * @description
   * This function keeps a cache of directories, indexed by paths.
   * In case of errors, an exception may be thrown.
   * The returned names do not include `.` and `..`.
   *
   * Note: the array uses objects instead of strings to provide a place
   * to cache other properties, like dates.
   */
  static async readdir (folderAbsolutePath, withStat = false) {
    const Self = this

    if (!Self.cache) {
      Self.cache = {}
    }

    if (Self.cache.hasOwnProperty(folderAbsolutePath)) {
      return Self.cache[folderAbsolutePath]
    }

    const names = await fsPromises.readdir(folderAbsolutePath)

    // Turn string names into objects with a `name` property.
    const files = []
    for (const name of names) {
      // Not exactly accurate, since it may be a folder too.
      const file = {}
      file.name = name
      if (withStat) {
        const fileAbsolutePath = path.join(folderAbsolutePath, name)
        file.stat = await fsPromises.stat(fileAbsolutePath)
      }
      files.push(file)
    }
    Self.cache[folderAbsolutePath] = files

    return files
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.DirCache = DirCache

// In ES6, it would be:
// export class DirCache { ... }
// ...
// import { DirCache } from '../utils/dir-cache.js'

// ----------------------------------------------------------------------------
