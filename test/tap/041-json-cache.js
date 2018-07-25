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
 * Test the JSON cache.
 */

// ----------------------------------------------------------------------------

// The `[node-tap](http://www.node-tap.org)` framework.
const test = require('tap').test
const path = require('path')

const JsonCache = require('../../lib/utils/json-cache.js').JsonCache

// ----------------------------------------------------------------------------

const testPath = path.dirname(__dirname)
const mockFolder = path.join(testPath, 'mock', 'json-cache')

test('json cache',
  async (t) => {
    // console.log(mockFolder)
    const json1AbsoluteFilePath = path.join(mockFolder, 'file1.json')
    const json1a = await JsonCache.parse(json1AbsoluteFilePath)

    // console.log(names)
    t.equal(json1a.name, 'file1', 'is file1')

    // Ask again for the same file.
    const json1b = await JsonCache.parse(json1AbsoluteFilePath)
    t.same(json1b, json1a, 'same object1')

    // Ask for a different file. Content must be different.
    const json2AbsoluteFilePath = path.join(mockFolder, 'folder1', 'file2.json')
    const json2a = await JsonCache.parse(json2AbsoluteFilePath)

    // console.log(names)
    t.equal(json2a.name, 'file2', 'is file2')

    const json2b = await JsonCache.parse(json2AbsoluteFilePath)
    t.same(json2b, json2a, 'same object2')

    t.end()
  })

test('json cache no file',
  async (t) => {
    try {
      // Make a folder name that does not exist.
      const jsonAbsoluteFilePath = path.join(mockFolder, 'none.json')
      await JsonCache.parse(jsonAbsoluteFilePath)
      t.fail('did not throw')
    } catch (err) {
      // console.log(err)
      t.equal(err.code, 'ENOENT', 'throws ENOENT')
    }
    t.end()
  })

// ----------------------------------------------------------------------------
