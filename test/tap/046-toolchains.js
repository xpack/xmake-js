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
 * Test the toolchain classes.
 */

// ----------------------------------------------------------------------------

// The `[node-tap](http://www.node-tap.org)` framework.
const test = require('tap').test
const path = require('path')

// const JsonCache = require('../../lib/utils/json-cache.js').JsonCache
const ToolchainCache = require('../../lib/utils/toolchain-cache.js')
  .ToolchainCache

// ----------------------------------------------------------------------------

const testPath = path.dirname(__dirname)
const mockFolder = path.join(testPath, 'mock')
const rootFolder = path.join(mockFolder, 'toolchains-cache')

const toolchainsPath = path.join(path.dirname(testPath), 'assets',
  'toolchains.json')

let warnArray = []
let verboseArray = []
let debugArray = []
let traceArray = []
const log = {}
log.warn = (msg = '', ...args) => {
  // console.log('warning: ' + msg, ...args)
  warnArray.push(msg)
}
log.verbose = (msg = '', ...args) => {
  // console.log(msg, ...args)
  verboseArray.push(msg)
}
log.debug = (msg = '', ...args) => {
  // console.log(msg, ...args)
  debugArray.push(msg)
}
log.trace = (msg = '', ...args) => {
  // console.log(msg, ...args)
  traceArray.push(msg)
}
log.clear = () => {
  warnArray = []
  verboseArray = []
  debugArray = []
  traceArray = []
}

const options = { log }

test('toolchains',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(toolchainsPath, options)

    const tc = ToolchainCache.retrieve('arm-none-eabi-gcc', options)
    // console.log(t1, traceArray)
    t.equal(Object.keys(tc.tools).length, 5, 'has 5 tools')
    t.equal(Object.keys(tc.fileExtensions).length, 8, 'has 8 file extensions')
    t.equal(tc.tools.cCompiler.fullCommandName, 'arm-none-eabi-gcc',
      'has fullCommandName')
    // Ask the same property again (for cache coverage).
    t.equal(tc.tools.cCompiler.fullCommandName, 'arm-none-eabi-gcc',
      'has fullCommandName again')

    const tc2 = ToolchainCache.retrieve('arm-none-eabi-gcc', options)
    t.same(tc, tc2, 'is same')

    await ToolchainCache.parse(path.join(rootFolder,
      'no-toolchains.json'), options)
    t.pass('no toolchains')

    t.end()
  })

test('toolchains no log',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(toolchainsPath)

    const tc = ToolchainCache.retrieve('arm-none-eabi-gcc')
    // console.log(t1, traceArray)
    t.equal(Object.keys(tc.tools).length, 5, 'has 5 tools')
    t.equal(Object.keys(tc.fileExtensions).length, 8, 'has 8 file extensions')
    t.equal(tc.tools.cCompiler.fullCommandName, 'arm-none-eabi-gcc',
      'has fullCommandName')
    // Ask the same property again (for cache coverage).
    t.equal(tc.tools.cCompiler.fullCommandName, 'arm-none-eabi-gcc',
      'has fullCommandName again')
    t.end()
  })

test('toolchains redefined',
  async (t) => {
    ToolchainCache.clear()
    log.clear()

    await ToolchainCache.parse(toolchainsPath, options)
    await ToolchainCache.parse(path.join(rootFolder,
      'toolchain-redefined.json'), options)

    const tc = ToolchainCache.retrieve('base', options)
    // console.log(tc)
    // console.log(debugArray)
    t.equal(tc.objectExtension, 'oo', 'has redefined')
    t.equal(debugArray.length, 1, 'has 1 debug')
    t.match(debugArray[0], 'Toolchain \'base\' redefined', 'has redefined')

    t.end()
  })

test('toolchains no tools',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'toolchain-clone-no-tools.json'), options)

    const tc = ToolchainCache.retrieve('b2', options)
    // console.log(tc)
    t.equal(Object.keys(tc.tools).length, 0, 'has 0 tools')
    t.equal(Object.keys(tc.fileExtensions).length, 0, 'has 0 file extensions')

    t.end()
  })

test('toolchains no tool command',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'tool-no-command.json'), options)

    try {
      ToolchainCache.retrieve('b1', options)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.match(ex.message, 'has no mandatory \'commandName\'',
        'throws has no command')
    }

    t.end()
  })

test('toolchains no tool description',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'tool-no-description.json'), options)

    try {
      ToolchainCache.retrieve('b1', options)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.match(ex.message, 'has no mandatory \'description\'',
        'throws has no description')
    }

    t.end()
  })

test('toolchains no tool type',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'tool-no-type.json'), options)

    try {
      ToolchainCache.retrieve('b1', options)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.match(ex.message, 'has no mandatory \'type\'', 'throws has no type')
    }

    t.end()
  })

test('toolchains tool type redefined',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'tool-type-redefined.json'), options)

    try {
      ToolchainCache.retrieve('b2', options)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.match(ex.message, 'cannot redefine type', 'throws cannot redefine type')
    }

    t.end()
  })

test('toolchains tool type xx',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'tool-type-xx.json'), options)

    try {
      ToolchainCache.retrieve('b1', options)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.match(ex.message, 'has unsupported type', 'throws unsupported type')
    }

    t.end()
  })

test('toolchains toolchain no string',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'toolchain-no-string.json'), options)

    try {
      ToolchainCache.retrieve('b1', options)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.match(ex.message, 'must be a string', 'throws must be a string')
    }

    t.end()
  })

test('toolchains toolchain no parent',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'toolchain-no-parent.json'), options)

    try {
      ToolchainCache.retrieve('b2', options)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.match(ex.message, 'not defined', 'throws not defined')
    }

    t.end()
  })

test('toolchains tool extension inherit',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'tool-extension-inherit.json'), options)

    const tc = ToolchainCache.retrieve('b2', options)
    // console.log(tc)
    t.equal(Object.keys(tc.tools).length, 1, 'has 1 tool')
    t.equal(Object.keys(tc.fileExtensions).length, 1, 'has 1 file extensions')
    t.equal(tc.tools.t1.commandName, 'cb', 'has cb commandName')
    t.equal(tc.tools.t1.description, 'da', 'has da description')

    t.end()
  })

test('toolchains tool extension extend',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'tool-extension-extend.json'), options)

    const tc = ToolchainCache.retrieve('b2', options)
    // console.log(tc)
    t.equal(Object.keys(tc.tools).length, 1, 'has 1 tool')
    t.equal(Object.keys(tc.fileExtensions).length, 2, 'has 2 file extensions')
    t.equal(tc.tools.t1.fileExtensions.c.prefix, 'C', 'has C prefix')
    t.equal(tc.tools.t1.fileExtensions.cc.prefix, 'CC', 'has CC prefix')

    t.end()
  })

test('toolchains tool extension redefine',
  async (t) => {
    ToolchainCache.clear()
    await ToolchainCache.parse(path.join(rootFolder,
      'tool-extension-redefine.json'), options)

    const tc = ToolchainCache.retrieve('b2', options)
    // console.log(tc)
    t.equal(Object.keys(tc.tools).length, 1, 'has 1 tool')
    t.equal(Object.keys(tc.fileExtensions).length, 1, 'has 1 file extensions')
    t.equal(tc.tools.t1.fileExtensions.c.prefix, 'C2', 'has C2 prefix')

    t.end()
  })

// ----------------------------------------------------------------------------
