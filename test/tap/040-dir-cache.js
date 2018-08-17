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
    const names1 = await DirCache.readdir(mockFolder)
    names1.sort((a, b) => { return a.name > b.name })
    // console.log(names1)
    t.equal(names1.length, 3, 'has 3 names')
    t.equal(names1[0].name, 'file1', 'has file1')
    t.equal(names1[2].name, 'folder1', 'has folder1')

    // Ask again for the same folder.
    const names2 = await DirCache.readdir(mockFolder)
    t.same(names2, names1, 'same object')

    // Minimal test without stats.
    const mockSubFolder = path.join(mockFolder, 'folder1')
    const names3 = await DirCache.readdir(mockSubFolder)
    // console.log(names3)
    t.equal(names3.length, 1, 'has 1 names')
    t.equal(names3[0].name, 'file', 'has file')

    t.end()
  })

test('dir cache no folder',
  async (t) => {
    try {
      // Make a folder name that does not exist.
      await DirCache.readdir(mockFolder + '___')
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.equal(ex.code, 'ENOENT', 'throws ENOENT')
    }
    t.end()
  })

// ----------------------------------------------------------------------------
