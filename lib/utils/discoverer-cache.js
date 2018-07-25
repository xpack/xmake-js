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

const fs = require('fs')
// const assert = require('assert')
const path = require('path')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

const DirCache = require('./dir-cache.js').DirCache
const XmakeParser = require('./xmake-parser.js').XmakeParser
const JsonCache = require('./json-cache.js').JsonCache
const IgnorerCache = require('./ignorer-cache.js').IgnorerCache

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'stat')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ============================================================================

class DiscovererCache {
  /**
   * @deprecated
   *
   * @summary Discover source and include folders.
   *
   * @async
   * @param {String} folderAbsolutePath Absolute path of the folder to search.
   * @param {String} rootAbsolutePath Project root folder path.
   * @param {String[]} staticIgnoredNames Array of known names to ignore.
   * @param {Object} log Logger with a warn() function
   * @returns {Object} An with two properties, for source and includes.
   * @throws Error 'ENOENT: no such file'
   *
   * @description
   * This function keeps a cache of discovered folders, indexed by paths.
   *
   * The returned object has two properties, `sourceFolders` and
   * `includeFolders`, each with arrays of string with folder absolute paths.
   * The caller should not modify it, by all means,
   * otherwise the cache consistency is compromised.
   */
  static async discover (folderAbsolutePath, rootAbsolutePath,
    staticIgnoredNames = [],
    log = undefined) {
    const Self = this

    if (!Self.cache) {
      Self.cache = {}
    }

    if (Self.cache.hasOwnProperty(folderAbsolutePath)) {
      return Self.cache[folderAbsolutePath]
    }

    if (!log) {
      log = {}
      log.warn = () => {}
      log.verbose = () => {}
    }

    const result = {}
    result.sourceFolders = []
    result.includeFolders = []
    await Self.recursiveDiscover_(folderAbsolutePath, rootAbsolutePath,
      staticIgnoredNames, log, result)
    // console.log(result)
    Self.cache[folderAbsolutePath] = result

    return result
  }

  /**
   * @summary Recursively descend the folder.
   *
   * @private
   * @param {Script} folderAbsolutePath Absolute path of the folder to search.
   * @param {Object} rootAbsolutePath Project root folder path.
   * @param {String[]} staticIgnoredNames Array of known names to ignore.
   * @param {Object} log Logger object.
   * @param {Object} result Object to collect the results.
   * @returns {undefined} Nothing.
   */
  static async recursiveDiscover_ (folderAbsolutePath, rootAbsolutePath,
    staticIgnoredNames, log, result) {
    const Self = this

    // console.log(folderAbsolutePath)
    let relPath = path.relative(rootAbsolutePath, folderAbsolutePath)
    log.verbose(`Checking '${relPath}'...`)

    const entries = await DirCache.readdir(folderAbsolutePath, true)
    // console.log(entries.length)

    let ignoredNames = []
    for (const entry of entries) {
      if (entry.stat.isFile() && entry.name === Self.xmakeIgnoreFileName) {
        // If an ignore file is present, read it to filter further accesses.
        const entryAbsolutePath = path.join(folderAbsolutePath, entry.name)
        ignoredNames = await IgnorerCache.read(entryAbsolutePath, log)
      }
    }

    for (const entry of entries) {
      let toIgnore = false
      for (const ignoredName of ignoredNames) {
        if (entry.name === ignoredName) {
          toIgnore = true
          break
        }
      }
      for (const ignoredName of staticIgnoredNames) {
        if (entry.name === ignoredName) {
          toIgnore = true
          break
        }
      }
      if (toIgnore) {
        // Filter out names.
        continue
      }

      if (entry.stat.isDirectory()) {
        // Ignore folders starting with dot.
        if (entry.name.startsWith('.')) {
          continue
        }
        const entryAbsolutePath = path.join(folderAbsolutePath, entry.name)
        await Self.recursiveDiscover_(entryAbsolutePath, rootAbsolutePath,
          staticIgnoredNames, log, result)
      } else /* if (entry.stat.isFile()) coverage */ {
        if (entry.name === Self.xmakeIncludeFileName) {
          result.includeFolders.push(folderAbsolutePath)
          log.verbose('Is an include folder.')
        } else if (entry.name === Self.xmakeSourceFileName) {
          result.sourceFolders.push(folderAbsolutePath)
          log.verbose('Is a source folder.')
        } else if (XmakeParser.isXmakeJson(entry.name)) {
          const jsonAbsolutePath = path.join(folderAbsolutePath, entry.name)
          // console.log(jsonAbsolutePath)
          const json = await JsonCache.parse(jsonAbsolutePath)
          // console.log(json)
          // Ignore version for now.
          if (json.includeFolder) {
            result.includeFolders.push(folderAbsolutePath)
            log.verbose('Is an include folder.')
          }
          if (json.sourceFolder) {
            result.sourceFolders.push(folderAbsolutePath)
            log.verbose('Is a source folder.')
          }
        }
      }
    }
  }

  /**
   * @summary Discover source and include folders in xPacks.
   *
   * @async
   * @param {String} folderAbsolutePath Absolute path of the folder to search.
   * @param {String} rootAbsolutePath Project root folder path.
   * @param {Object} log Logger with a warn() function
   * @returns {Object} An with two properties, for source and includes.
   * @throws Error 'ENOENT: no such file'
   * @throws SyntaxError
   * @throws TypeError
   *
   * @description
   * This function keeps a cache of discovered folders, indexed by paths.
   *
   * The returned object has two properties, `sourceFolders` and
   * `includeFolders`, each with arrays of string with folder absolute paths.
   * The caller should not modify it, by all means,
   * otherwise the cache consistency is compromised.
   */
  static async discoverPacks (folderAbsolutePath, rootAbsolutePath,
    log = undefined) {
    const Self = this

    if (!Self.cache) {
      Self.cache = {}
    }
    if (Self.cache.hasOwnProperty(folderAbsolutePath)) {
      return Self.cache[folderAbsolutePath]
    }

    const result = {}
    result.sourceFolders = []
    result.includeFolders = []

    if (!log) {
      log = {}
      log.verbose = () => {}
    }

    await Self.processPackage_(folderAbsolutePath, rootAbsolutePath,
      log, result)

    // console.log(result)
    Self.cache[folderAbsolutePath] = result

    return result
  }

  static isString (x) {
    return Object.prototype.toString.call(x) === '[object String]'
  }

  static async processPackage_ (folderAbsolutePath, rootAbsolutePath, log,
    result) {
    const Self = this

    const folderRelativePath = path.relative(rootAbsolutePath,
      folderAbsolutePath) || '.'
    log.verbose(`Checking '${folderRelativePath}'...`)

    const packageAbsolutePath = path.join(folderAbsolutePath, 'package.json')
    const packageJson = await JsonCache.parse(packageAbsolutePath)

    // console.log(packageJson)
    if (!packageJson.xpacks) {
      return
    }
    const packageRelativePath = path.relative(rootAbsolutePath,
      packageAbsolutePath)

    if (packageJson.xpacks.directories &&
      packageJson.xpacks.directories.src) {
      let folders
      if (Array.isArray(packageJson.xpacks.directories.src)) {
        folders = packageJson.xpacks.directories.src
      } else if (Self.isString(packageJson.xpacks.directories.src)) {
        folders = [ packageJson.xpacks.directories.src ]
      } else {
        throw new TypeError(`${packageRelativePath}: ` +
          'xpack.directories.src must be a string ' +
          'or an array of strings')
      }

      for (const relPath of folders) {
        if (Self.isString(relPath)) {
          const absPath = path.join(folderAbsolutePath, relPath)
          let stat
          try {
            // console.log(absPath)
            stat = await fsPromises.stat(absPath)
          } catch (ex) {
            // console.log(ex)
            throw new TypeError(`${packageRelativePath}: ` +
            `folder '${relPath}' not found`)
          }
          // console.log(stat)
          if (stat.isDirectory()) {
            result.sourceFolders.push(absPath)
            log.verbose(`'${path.relative(rootAbsolutePath, absPath)}' ` +
              'is a source folder.')
          } else {
            throw new TypeError(`${packageRelativePath}: ` +
              `'${relPath}' not a folder`)
          }
        } else {
          throw new TypeError(`${packageRelativePath}: ` +
          'xpack.directories.src must be a string ' +
          'or an array of strings')
        }
      }
    } else {
      const absPath = path.join(folderAbsolutePath, 'src')
      try {
        const stat = await fsPromises.stat(absPath)
        if (stat.isDirectory()) {
          result.sourceFolders.push(absPath)
          log.verbose(`'${path.relative(rootAbsolutePath, absPath)}' ` +
          'is a source folder.')
        }
      } catch (ex) {
      }
    }

    if (packageJson.xpacks.directories &&
      packageJson.xpacks.directories.include) {
      let folders
      if (Array.isArray(packageJson.xpacks.directories.include)) {
        folders = packageJson.xpacks.directories.include
      } else if (Self.isString(packageJson.xpacks.directories.include)) {
        folders = [ packageJson.xpacks.directories.include ]
      } else {
        throw new TypeError(`${packageRelativePath}: ` +
          'xpack.directories.include must be a string ' +
          'or an array of strings')
      }

      for (const relPath of folders) {
        if (Self.isString(relPath)) {
          const absPath = path.join(folderAbsolutePath, relPath)
          let stat
          try {
            stat = await fsPromises.stat(absPath)
          } catch (ex) {
            throw new TypeError(`${packageRelativePath}: ` +
            `folder '${relPath}' not found`)
          }
          if (stat.isDirectory()) {
            result.includeFolders.push(absPath)
            log.verbose(`'${path.relative(rootAbsolutePath, absPath)}' ` +
              'is an include folder.')
          } else {
            throw new TypeError(`${packageRelativePath}: ` +
              `'${relPath}' not a folder`)
          }
        } else {
          throw new TypeError(`${packageRelativePath}: ` +
          'xpack.directories.include must be a string ' +
          'or an array of strings')
        }
      }
    } else {
      const absPath = path.join(folderAbsolutePath, 'include')
      try {
        const stat = await fsPromises.stat(absPath)
        if (stat.isDirectory()) {
          result.includeFolders.push(absPath)
          log.verbose(`'${path.relative(rootAbsolutePath, absPath)}' ` +
            'is an include folder.')
        }
      } catch (ex) {
      }
    }
  }
}

DiscovererCache.xmakeIgnoreFileName = '.xmakeignore'
DiscovererCache.xmakeIncludeFileName = '.xmake-include'
DiscovererCache.xmakeSourceFileName = '.xmake-source'

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.DiscovererCache = DiscovererCache

// In ES6, it would be:
// export class DiscovererCache { ... }
// ...
// import { DiscovererCache } from '../utils/discoverer-cache.js'

// ----------------------------------------------------------------------------
