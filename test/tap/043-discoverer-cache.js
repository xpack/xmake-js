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
const path = require('path')

const DiscovererCache = require('../../lib/utils/discoverer-cache.js')
  .DiscovererCache

// ----------------------------------------------------------------------------

const testPath = path.dirname(__dirname)
const mockFolder = path.join(testPath, 'mock')
const rootFolder = path.join(mockFolder, 'discoverer-cache')

let warnArray = []
let verboseArray = []
const log = {}
log.warn = (msg = '', ...args) => {
  // console.log('warning: ' + msg, ...args)
  warnArray.push(msg)
}
log.verbose = (msg = '', ...args) => {
  // console.log(msg, ...args)
  verboseArray.push(msg)
}
log.clear = () => {
  warnArray = []
  verboseArray = []
}

test('discoverer no packs',
  async (t) => {
    // console.log(mockFolder)
    const discover1AbsoluteFilePath = path.join(rootFolder, 'no-packs')
    const result1 = await DiscovererCache.discover(discover1AbsoluteFilePath,
      discover1AbsoluteFilePath, [ 'build' ], log)
    // console.log(result1)
    t.equal(result1.sourceFolders.length, 3, 'has 3 source folders')
    t.equal(result1.includeFolders.length, 3, 'has 3 include folders')
    // console.log(warnArray.length)
    t.equal(warnArray.length, 0, 'has 0 warnings')
    // console.log(verboseArray.length)
    t.equal(verboseArray.length, 18, 'has 18 verbose')

    const result2 = await DiscovererCache.discover(discover1AbsoluteFilePath,
      rootFolder)
    t.same(result1, result2, 'same object')

    t.end()
  })

test('discoverer no log',
  async (t) => {
    // console.log(mockFolder)
    // Do it again, without logger.
    const discoverAbsoluteFilePath = path.join(rootFolder, 'no-packs')
    const result = await DiscovererCache.discover(discoverAbsoluteFilePath,
      discoverAbsoluteFilePath)

    t.equal(result.sourceFolders.length, 3, 'has 3 source folders')
    t.equal(result.includeFolders.length, 3, 'has 3 include folders')

    t.end()
  })

test('discoverer no folder',
  async (t) => {
    try {
      // Try to discover a folder name that does not exist.
      const discoverAbsoluteFilePath = path.join(mockFolder, '__none__')
      await DiscovererCache.discover(discoverAbsoluteFilePath,
        discoverAbsoluteFilePath)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.equal(ex.code, 'ENOENT', 'throws ENOENT')
    }
    t.end()
  })

// ----------------------------------------------------------------------------

test('discoverer packs no folder',
  async (t) => {
    // Clear cache.
    DiscovererCache.cache = undefined

    try {
      // Try to discover a folder name that does not exist.
      const discoverAbsoluteFilePath = path.join(mockFolder, '__none__')
      await DiscovererCache.discoverPacks(discoverAbsoluteFilePath,
        discoverAbsoluteFilePath)
      t.fail('did not throw')
    } catch (ex) {
      // console.log(ex)
      t.equal(ex.code, 'ENOENT', 'throws ENOENT')
    }
    t.end()
  })

test('discoverer packs no xpack',
  async (t) => {
    // Try to discover a package that is not an xPack.
    log.clear()
    const discoverAbsoluteFilePath = path.join(rootFolder, 'no-xpack')
    const result = await DiscovererCache.discoverPacks(
      discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
    t.equal(result.sourceFolders.length, 0, 'has no source folders')
    t.equal(result.includeFolders.length, 0, 'has no include folders')
    // console.log(verboseArray)
    t.equal(verboseArray.length, 1, 'has 1 verbose')

    t.end()
  })

test('discoverer packs src bad type',
  async (t) => {
    // Try to discover a package that has non-string src.
    try {
      log.clear()
      const discoverAbsoluteFilePath = path.join(rootFolder, 'src-type')
      await DiscovererCache.discoverPacks(
        discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        // console.log(ex)
        t.match(ex.message, 'xpack.directories.src must be a string',
          'throws TypeError')
      } else {
        t.fail(ex.message)
      }
    }
    t.end()
  })

test('discoverer packs src array bad type',
  async (t) => {
    // Try to discover a package that has non-string src.
    try {
      log.clear()
      const discoverAbsoluteFilePath = path.join(rootFolder, 'src-array-type')
      await DiscovererCache.discoverPacks(
        discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        // console.log(ex)
        t.match(ex.message, 'xpack.directories.src must be a string',
          'throws TypeError')
      } else {
        t.fail(ex.message)
      }
    }
    t.end()
  })

test('discoverer packs include bad type',
  async (t) => {
    // Try to discover a package that has non-string include.
    try {
      log.clear()
      const discoverAbsoluteFilePath = path.join(rootFolder, 'include-type')
      await DiscovererCache.discoverPacks(
        discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        // console.log(ex)
        t.match(ex.message, 'xpack.directories.include must be a string',
          'throws TypeError')
      } else {
        t.fail(ex.message)
      }
    }
    t.end()
  })

test('discoverer packs include array bad type',
  async (t) => {
    // Try to discover a package that has non-string include.
    try {
      log.clear()
      const discoverAbsoluteFilePath = path.join(rootFolder,
        'include-array-type')
      await DiscovererCache.discoverPacks(
        discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        // console.log(ex)
        t.match(ex.message, 'xpack.directories.include must be a string',
          'throws TypeError')
      } else {
        t.fail(ex.message)
      }
    }
    t.end()
  })

test('discoverer packs src missing',
  async (t) => {
    // Try to discover a package that has a non-existing src.
    try {
      log.clear()
      const discoverAbsoluteFilePath = path.join(rootFolder, 'src-missing')
      await DiscovererCache.discoverPacks(
        discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        // console.log(ex)
        t.match(ex.message, 'folder \'./src\' not found',
          'throws TypeError')
      } else {
        t.fail(ex.message)
      }
    }
    t.end()
  })

test('discoverer packs include missing',
  async (t) => {
    // Try to discover a package that has a non-existing include.
    try {
      log.clear()
      const discoverAbsoluteFilePath = path.join(rootFolder, 'include-missing')
      await DiscovererCache.discoverPacks(
        discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        // console.log(ex)
        t.match(ex.message, 'folder \'./include\' not found',
          'throws TypeError')
      } else {
        t.fail(ex.message)
      }
    }
    t.end()
  })

test('discoverer packs src file',
  async (t) => {
    // Try to discover a package that has wrong src.
    try {
      log.clear()
      const discoverAbsoluteFilePath = path.join(rootFolder, 'src-file')
      await DiscovererCache.discoverPacks(
        discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        // console.log(ex)
        t.match(ex.message, '\'./src\' not a folder',
          'throws TypeError')
      } else {
        t.fail(ex.message)
      }
    }
    t.end()
  })

test('discoverer packs include file',
  async (t) => {
    // Try to discover a package that has wrong include.
    try {
      log.clear()
      const discoverAbsoluteFilePath = path.join(rootFolder, 'include-file')
      await DiscovererCache.discoverPacks(
        discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
      t.fail('did not throw')
    } catch (ex) {
      if (ex instanceof TypeError) {
        // console.log(ex)
        t.match(ex.message, '\'./include\' not a folder',
          'throws TypeError')
      } else {
        t.fail(ex.message)
      }
    }
    t.end()
  })

test('discoverer packs dirs arrays',
  async (t) => {
    // Try to discover a package that has arrays for dirs.
    log.clear()
    const discoverAbsoluteFilePath = path.join(rootFolder, 'dirs-array')
    const result1 = await DiscovererCache.discoverPacks(
      discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
    // console.log(result)
    t.equal(result1.sourceFolders.length, 2, 'has 2 source folders')
    t.equal(result1.includeFolders.length, 2, 'has 2 include folders')
    // console.log(verboseArray)
    t.equal(verboseArray.length, 5, 'has 5 verbose')

    const result2 = await DiscovererCache.discoverPacks(
      discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
    t.same(result1, result2, 'same object')

    t.end()
  })

test('discoverer packs dirs strs',
  async (t) => {
    // Try to discover a package that has single strings for dirs.
    log.clear()
    const discoverAbsoluteFilePath = path.join(rootFolder, 'dirs-str')
    const result = await DiscovererCache.discoverPacks(
      discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
    // console.log(result)
    t.equal(result.sourceFolders.length, 1, 'has 1 source folders')
    t.equal(result.includeFolders.length, 1, 'has 1 include folders')
    // console.log(verboseArray)
    t.equal(verboseArray.length, 3, 'has 3 verbose')

    t.end()
  })

test('discoverer packs dirs defaults',
  async (t) => {
    // Try to discover a package that has default dirs.
    log.clear()
    const discoverAbsoluteFilePath = path.join(rootFolder, 'dirs-default')
    const result = await DiscovererCache.discoverPacks(
      discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
    // console.log(result)
    t.equal(result.sourceFolders.length, 1, 'has 1 source folders')
    t.equal(result.includeFolders.length, 1, 'has 1 include folders')
    // console.log(verboseArray)
    t.equal(verboseArray.length, 3, 'has 3 verbose')

    t.end()
  })

test('discoverer packs dirs no defaults',
  async (t) => {
    // Try to discover a package that has default dirs.
    log.clear()
    const discoverAbsoluteFilePath = path.join(rootFolder, 'dirs-no-default')
    const result = await DiscovererCache.discoverPacks(
      discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
    // console.log(result)
    t.equal(result.sourceFolders.length, 0, 'has 0 source folders')
    t.equal(result.includeFolders.length, 0, 'has 0 include folders')
    // console.log(verboseArray)
    t.equal(verboseArray.length, 1, 'has 1 verbose')

    t.end()
  })

test('discoverer packs dirs file defaults',
  async (t) => {
    // Try to discover a package that has default dirs.
    log.clear()
    const discoverAbsoluteFilePath = path.join(rootFolder, 'dirs-file-default')
    const result = await DiscovererCache.discoverPacks(
      discoverAbsoluteFilePath, discoverAbsoluteFilePath, log)
    // console.log(result)
    t.equal(result.sourceFolders.length, 0, 'has 0 source folders')
    t.equal(result.includeFolders.length, 0, 'has 0 include folders')
    // console.log(verboseArray)
    t.equal(verboseArray.length, 1, 'has 1 verbose')

    t.end()
  })

// ----------------------------------------------------------------------------
