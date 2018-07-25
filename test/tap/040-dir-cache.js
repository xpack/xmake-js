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
 * Test the directory cache.
 */

// ----------------------------------------------------------------------------

// The `[node-tap](http://www.node-tap.org)` framework.
const test = require('tap').test
const path = require('path')

const DirCache = require('../../lib/utils/dir-cache.js').DirCache

// ----------------------------------------------------------------------------

const testPath = path.dirname(__dirname)
const mockFolder = path.join(testPath, 'mock', 'dir-cache')

test('dir cache',
  async (t) => {
    // console.log(mockFolder)
    const names = await DirCache.readdir(mockFolder)
    names.sort((a, b) => { return a.name > b.name })
    // console.log(names)
    t.equal(names.length, 3, 'has 3 names')
    t.equal(names[0].name, 'file1', 'has file1')
    t.equal(names[2].name, 'folder1', 'has folder1')

    // Ask again for the same folder.
    const names2 = await DirCache.readdir(mockFolder)
    t.same(names2, names, 'same object')
    t.end()
  })

test('dir cache no folder',
  async (t) => {
    try {
      // Make a folder name that does not exist.
      await DirCache.readdir(mockFolder + '___')
      t.fail('did not throw')
    } catch (err) {
      // console.log(err)
      t.equal(err.code, 'ENOENT', 'throws ENOENT')
    }
    t.end()
  })

// ----------------------------------------------------------------------------
