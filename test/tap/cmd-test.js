/*
 * This file is part of the xPack distribution
 *   (http://xpack.github.io).
 * Copyright (c) 2017 Liviu Ionescu.
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
 * Test `xmake convert`.
 */

// ----------------------------------------------------------------------------

// const path = require('path')
// const os = require('os')
const fs = require('fs')

// The `[node-tap](http://www.node-tap.org)` framework.
const test = require('tap').test

const Common = require('../common.js').Common
const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliExitCodes } from 'cli-start-options'
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'chmod')

// ----------------------------------------------------------------------------

/**
 * Test if help content includes convert options.
 */
test('xmake test -h',
  async (t) => {
    try {
      const { code, stdout, stderr } = await Common.xmakeCli([
        'test',
        '-h'
      ])
      // Check exit code.
      t.equal(code, CliExitCodes.SUCCESS, 'exit code')
      const outLines = stdout.split(/\r?\n/)
      t.ok(outLines.length > 9, 'has enough output')
      if (outLines.length > 9) {
        // console.log(outLines)
        t.equal(outLines[1], 'Build and execute project test(s)',
          'has title')
        t.equal(outLines[2], 'Usage: xmake test [<path>...] [options...] ' +
          '[--target <name>]*', 'has Usage')
        t.match(outLines[5], 'where:', 'has where')
        t.match(outLines[6], '  <name>...', 'has <name>')
        t.match(outLines[7], '  <args>...', 'has <args>')
      }
      // There should be no error messages.
      t.equal(stderr, '', 'stderr empty')
    } catch (err) {
      t.fail(err.message)
    }
    t.end()
  })

/**
 * Test if partial command recognised and expanded.
 */
test('xmake te -h',
  async (t) => {
    try {
      const { code, stdout, stderr } = await Common.xmakeCli([
        'te',
        '-h'
      ])
      // Check exit code.
      t.equal(code, 0, 'exit code')
      const outLines = stdout.split(/\r?\n/)
      t.ok(outLines.length > 9, 'has enough output')
      if (outLines.length > 9) {
        // console.log(outLines)
        t.equal(outLines[1], 'Build and execute project test(s)',
          'has title')
        t.equal(outLines[2], 'Usage: xmake test [<path>...] [options...] ' +
          '[--target <name>]*', 'has Usage')
      }
      // There should be no error messages.
      t.equal(stderr, '', 'stderr empty')
    } catch (err) {
      t.fail(err.message)
    }
    t.end()
  })

test('xmake t -h',
  async (t) => {
    try {
      const { code, stdout, stderr } = await Common.xmakeCli([
        't',
        '-h'
      ])
      // Check exit code.
      t.equal(code, 0, 'exit code')
      const outLines = stdout.split(/\r?\n/)
      t.ok(outLines.length > 9, 'has enough output')
      if (outLines.length > 9) {
        // console.log(outLines)
        t.equal(outLines[1], 'Build and execute project test(s)',
          'has title')
        t.equal(outLines[2], 'Usage: xmake test [<path>...] [options...] ' +
          '[--target <name>]*', 'has Usage')
      }
      // There should be no error messages.
      t.equal(stderr, '', 'stderr empty')
    } catch (err) {
      t.fail(err.message)
    }
    t.end()
  })

test('xmake ts -h',
  async (t) => {
    try {
      const { code, stdout, stderr } = await Common.xmakeCli([
        'ts',
        '-h'
      ])
      // Check exit code.
      t.equal(code, 0, 'exit code')
      const outLines = stdout.split(/\r?\n/)
      t.ok(outLines.length > 9, 'has enough output')
      if (outLines.length > 9) {
        // console.log(outLines)
        t.equal(outLines[1], 'Build and execute project test(s)',
          'has title')
        t.equal(outLines[2], 'Usage: xmake test [<path>...] [options...] ' +
          '[--target <name>]*', 'has Usage')
      }
      // There should be no error messages.
      t.equal(stderr, '', 'stderr empty')
    } catch (err) {
      t.fail(err.message)
    }
    t.end()
  })

// ----------------------------------------------------------------------------
