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
 * Test the discoverer cache.
 */

// ----------------------------------------------------------------------------

// The `[node-tap](http://www.node-tap.org)` framework.
const test = require('tap').test

const Xpack = require('../../lib/utils/xpack.js').Xpack

// ----------------------------------------------------------------------------

// const testPath = path.dirname(__dirname)
// const mockFolder = path.join(testPath, 'mock')
// const rootFolder = path.join(mockFolder, 'xmake-parser')

const context = {}
context.config = {}
context.config.cwd = ''

test('xpack isXpack',
  async (t) => {
    let json
    json = {}
    t.false(Xpack.isXpack(json), 'has no name')
    json.name = ['a']
    t.false(Xpack.isXpack(json), 'has no string name')
    json.name = 'n1'
    t.false(Xpack.isXpack(json), 'has no version')
    json.version = ['1.2.3']
    t.false(Xpack.isXpack(json), 'has no string version')
    json.version = '1.2.3'
    t.false(Xpack.isXpack(json), 'has no xpack')
    json.xpack = {}
    t.true(Xpack.isXpack(json), 'is xpack')

    t.end()
  })

test('xpack getDirectory',
  async (t) => {
    let json
    json = {}
    t.equal(Xpack.getDirectory(json, 'build'), './build', 'has no xpack')
    json.xpack = {}
    t.equal(Xpack.getDirectory(json, 'build'), './build',
      'has no xpack.directories')
    json.xpack.directories = {}
    t.equal(Xpack.getDirectory(json, 'build'), './build', 'has no build')
    try {
      json.xpack.directories.build = {}
      Xpack.getDirectory(json, 'build')
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        t.pass('throws has no string build')
      } else {
        t.fail(`throws ${ex}`)
      }
    }
    json.xpack.directories.build = './build2'
    t.equal(Xpack.getDirectory(json, 'build'), './build2', 'has build2')

    t.equal(Xpack.getDirectory(json, 'src'), './src', 'has no src')
    t.equal(Xpack.getDirectory(json, 'include'), './include', 'has no include')
    try {
      json.xpack.directories.src = {}
      Xpack.getDirectory(json, 'src')
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        t.pass('throws has no string src')
      } else {
        t.fail(`throws ${ex}`)
      }
    }
    try {
      json.xpack.directories.include = {}
      Xpack.getDirectory(json, 'include')
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        t.pass('throws has no string include')
      } else {
        t.fail(`throws ${ex}`)
      }
    }

    let dir
    json.xpack.directories.src = './src1'
    dir = Xpack.getDirectory(json, 'src')
    t.true(Array.isArray(dir), 'dir is array')
    t.equal(dir.length, 1, 'dir has 1 element')
    t.equal(dir[0], './src1', 'element is src1')

    json.xpack.directories.src = ['./src1', './src2']
    dir = Xpack.getDirectory(json, 'src')
    t.true(Array.isArray(dir), 'dir is array')
    t.equal(dir.length, 2, 'dir has 2 elements')
    t.equal(dir[0], './src1', 'element is src1')
    t.equal(dir[1], './src2', 'element is src2')

    json.xpack.directories.include = './include1'
    dir = Xpack.getDirectory(json, 'include')
    t.true(Array.isArray(dir), 'include is array')
    t.equal(dir.length, 1, 'dir has 1 element')
    t.equal(dir[0], './include1', 'element is include1')

    json.xpack.directories.include = ['./include1', './include2']
    dir = Xpack.getDirectory(json, 'include')
    t.true(Array.isArray(dir), 'dir is array')
    t.equal(dir.length, 2, 'dir has 2 elements')
    t.equal(dir[0], './include1', 'element is include1')
    t.equal(dir[1], './include2', 'element is include2')

    t.end()
  })

// ----------------------------------------------------------------------------
