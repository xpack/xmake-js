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

const IgnorerCache = require('../../lib/utils/ignorer-cache.js').IgnorerCache

// ----------------------------------------------------------------------------

const testPath = path.dirname(__dirname)
const mockFolder = path.join(testPath, 'mock', 'ignorer-cache')

let logArray = []
const warn = function (str) {
  logArray.push(str)
}

const log = {}
log.warn = warn

test('json ignorer',
  async (t) => {
    // console.log(mockFolder)
    const ignore1AbsoluteFilePath = path.join(mockFolder, '.xmakeignore')
    const names1a = await IgnorerCache.read(ignore1AbsoluteFilePath, log)
    t.equal(logArray.length, 5, 'ignored 5 lines')

    // console.log(names1a)
    t.equal(names1a.length, 2, 'has 2 names')
    t.equal(names1a[0], 'one', 'first is one')
    t.equal(names1a[1], 'seven', 'second is seven')
    // console.log(logArray)

    // Ask again for the same file.
    const names1b = await IgnorerCache.read(ignore1AbsoluteFilePath, log)
    t.same(names1b, names1a, 'same object1')

    // Ask for a different file. Content must be different.
    const ignore2AbsoluteFilePath = path.join(mockFolder, 'folder1',
      '.xmakeignore')
    // Intentionally do not use a logger, for coverage reasons.
    const names2a = await IgnorerCache.read(ignore2AbsoluteFilePath)

    // console.log(names2a)
    t.equal(names2a.length, 2, 'has 2 names')
    t.equal(names2a[0], 'aaa', 'first is aaa')
    t.equal(names2a[1], 'bbb', 'second is bbb')

    const names2b = await IgnorerCache.read(ignore2AbsoluteFilePath)
    t.same(names2b, names2a, 'same object2')

    t.end()
  })

test('json ignorer no file',
  async (t) => {
    const jsonAbsoluteFilePath = path.join(mockFolder, 'none.json')
    try {
      // Make a folder name that does not exist.
      await IgnorerCache.read(jsonAbsoluteFilePath)
      t.fail('did not throw')
    } catch (err) {
      // console.log(err)
      t.equal(err.code, 'ENOENT', 'throws ENOENT')
    }
    t.end()
  })

// ----------------------------------------------------------------------------
