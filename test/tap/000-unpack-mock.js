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

/**
 * Unpack the mock.tgz archive.
 */

// ----------------------------------------------------------------------------

// The `[node-tap](http://www.node-tap.org)` framework.
const test = require('tap').test
const path = require('path')
const fs = require('fs')
const tar = require('tar')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'unlink')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ----------------------------------------------------------------------------

// let pack = null
const rootPath = path.dirname(path.dirname(__dirname))
const testPath = path.join(rootPath, 'test')
const mockPath = path.join(testPath, 'mock')

test('unpack mock.tgz',
  async (t) => {
    // console.log(testPath)
    let found = false
    try {
      const stat = await fsPromises.stat(mockPath)
      if (stat.isDirectory()) {
        // t.pass('mock folder already there')
        found = true
      } else {
        // If anything but a folder, remove it, to make place for folder.
        await fsPromises.unlink(mockPath)
      }
    } catch (err) {
      // console.log(err)
    }

    if (!found) {
      // https://www.npmjs.com/package/tar
      await tar.extract(
        {
          cwd: 'test',
          file: 'test/mock.tgz'
        }
      )
      t.pass('mock folder created')
    }
    t.end()
  }
)

// ----------------------------------------------------------------------------
