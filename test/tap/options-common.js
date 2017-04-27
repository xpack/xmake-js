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
 * Test common options, like --version, --help, etc.
 */

// ----------------------------------------------------------------------------

// The `[node-tap](http://www.node-tap.org)` framework.
const test = require('tap').test
const path = require('path')

const Common = require('../common.js').Common

const CliApplication = require('@ilg/cli-start-options').CliApplication
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes

// ----------------------------------------------------------------------------

let pack = null
const rootPath = path.dirname(path.dirname(__dirname))

test('setup',
  async (t) => {
    // Read in the package.json, to later compare version.
    pack = await CliApplication.readPackageJson(rootPath)
    t.ok(pack, 'package ok')
    t.ok(pack.version.length > 0, 'version length > 0')
    t.pass(`package ${pack.name}@${pack.version}`)
    t.end()
  })

test('xmake --version (spawn)',
  async (t) => {
    try {
      const { code, stdout, stderr } = await Common.xmakeCli([
        '--version'
      ])
      // Check exit code.
      t.equal(code, CliExitCodes.SUCCESS, 'exit ok')
      // Check if version matches the package.
      // Beware, the stdout string has a new line terminator.
      t.equal(stdout, pack.version + '\n', 'version ok')
      // There should be no error messages.
      t.equal(stderr, '', 'stderr empty')
    } catch (err) {
      t.fail(err.message)
    }
    t.end()
  })

test('xmake -h (spawn)',
  async (t) => {
    try {
      const { code, stdout, stderr } = await Common.xmakeCli([
        '-h'
      ])
      t.equal(code, CliExitCodes.SUCCESS, 'exit ok')
      t.match(stdout, 'Usage: xmake <command>', 'has Usage')

      t.match(stdout, 'The xPack builder command line tool', 'has title')
      t.match(stdout, 'xmake -h|--help', 'has -h|--help')
      t.match(stdout, 'xmake <command> -h|--help', 'has <command> -h|--help')
      t.match(stdout, 'xmake --version', 'has --version')
      t.match(stdout, 'xmake -i|--interactive', 'has -i|--interactive')
      t.match(stdout, 'Set log level (silent|warn|info|verbose|debug|trace)',
        'has log levels')
      t.match(stdout, '-s|--silent', 'has -s|--silent')
      t.match(stdout, 'Bug reports:', 'has Bug reports:')
      // There should be no error messages.
      t.equal(stderr, '', 'stderr empty')
    } catch (err) {
      t.fail(err.message)
    }
    t.end()
  })

test('xmake --help (spawn)',
  async (t) => {
    try {
      const { code, stdout, stderr } = await Common.xmakeCli([
        '--help'
      ])
      t.equal(code, CliExitCodes.SUCCESS, 'exit ok')
      t.match(stdout, 'Usage: xmake <command>', 'has Usage')
      // There should be no error messages.
      t.equal(stderr, '', 'stderr empty')
    } catch (err) {
      t.fail(err.message)
    }
    t.end()
  })

test('xmake -d (spawn)',
  async (t) => {
    try {
      const { code, stdout, stderr } = await Common.xmakeCli([
        '--version',
        '-d'
      ])
      t.equal(code, CliExitCodes.SUCCESS, 'exit ok')
      t.ok(stdout.length > 0, 'has stdout')
      // Matching the whole string also checks that
      // the colour changes are not used.
      t.match(stdout, 'debug: start arg0:', 'has debug')
      // There should be no error messages.
      t.equal(stderr, '', 'stderr empty')
    } catch (err) {
      t.fail(err.message)
    }
    t.end()
  })

// ----------------------------------------------------------------------------
