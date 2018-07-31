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
// const XmakeParser = require('./xmake-parser.js').XmakeParser
const JsonCache = require('./json-cache.js').JsonCache
// const IgnorerCache = require('./ignorer-cache.js').IgnorerCache
const Xpack = require('./xpack.js').Xpack

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
   * @summary Discover source and include folders in xPacks.
   *
   * @async
   * @param {String} folderAbsolutePath Absolute path of the folder to search.
   * @param {Object} options Optional tweaks.
   * @param {String} options.parentAbsolutePath Parent folder path.
   * @param {Object} options.log Logger with a warn() function
   * @returns {Object} An object with two properties, for source and includes.
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
  static async discoverPacks (folderAbsolutePath, options = {}) {
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

    if (!options.log) {
      options.log = {}
      options.log.verbose = () => {}
    }

    if (!options.parentAbsolutePath) {
      options.parentAbsolutePath = path.dirname(folderAbsolutePath)
    }

    // Process the top package. Throw if not an xPack.
    await Self.processPackage_(folderAbsolutePath, options, result)

    // Set with folder absolute paths, where `xpm` installed dependent
    // packages.
    const dependenciesSet = new Set()
    await Self.collectDependencies_(folderAbsolutePath, options,
      dependenciesSet)

    // console.log(dependenciesSet)
    for (const depAbsolutePath of dependenciesSet) {
      await Self.processPackage_(depAbsolutePath, options, result)
    }

    // console.log(result)
    Self.cache[folderAbsolutePath] = result

    return result
  }

  static isString (x) {
    return Object.prototype.toString.call(x) === '[object String]'
  }

  static async processPackage_ (folderAbsolutePath, options, result) {
    const Self = this

    const parentAbsolutePath = options.parentAbsolutePath
    const log = options.log

    const packageAbsolutePath = path.join(folderAbsolutePath, 'package.json')
    const packageJson = await JsonCache.parse(packageAbsolutePath)

    // console.log(packageJson)
    if (!Xpack.isXpack(packageJson)) {
      if (packageJson.name) {
        log.verbose(`Package '${packageJson.name}'` +
          'not an xPack, ignored.')
      } else {
        log.verbose('Unnamed package, ignored.')
      }
      return
    }

    // const folderRelativePath = path.relative(parentAbsolutePath,
    //   folderAbsolutePath) || '.'
    log.verbose('Checking package ' +
      `'${packageJson.name}@${packageJson.version}'...`)

    const packageRelativePath = path.relative(parentAbsolutePath,
      packageAbsolutePath)

    if (packageJson.xpack.directories &&
      packageJson.xpack.directories.src) {
      let folders
      if (Array.isArray(packageJson.xpack.directories.src)) {
        folders = packageJson.xpack.directories.src
      } else if (Self.isString(packageJson.xpack.directories.src)) {
        folders = [ packageJson.xpack.directories.src ]
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
            // Collect source folders.
            result.sourceFolders.push(absPath)
            log.verbose(`'${path.relative(parentAbsolutePath, absPath)}' ` +
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
          // Collect source folders.
          result.sourceFolders.push(absPath)
          log.verbose(`'${path.relative(parentAbsolutePath, absPath)}' ` +
          'is a source folder.')
        }
      } catch (ex) {
      }
    }

    if (packageJson.xpack.directories &&
      packageJson.xpack.directories.include) {
      let folders
      if (Array.isArray(packageJson.xpack.directories.include)) {
        folders = packageJson.xpack.directories.include
      } else if (Self.isString(packageJson.xpack.directories.include)) {
        folders = [ packageJson.xpack.directories.include ]
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
            // Collect include folders.
            result.includeFolders.push(absPath)
            log.verbose(`'${path.relative(parentAbsolutePath, absPath)}' ` +
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
          // Collect include folders.
          result.includeFolders.push(absPath)
          log.verbose(`'${path.relative(parentAbsolutePath, absPath)}' ` +
            'is an include folder.')
        }
      } catch (ex) {
      }
    }
  }

  /**
   * @summary Collect dependencies.
   * @param {Object} folderAbsolutePath Absolute path to the main folder.
   * @param {Object} options Optional tweaks.
   * @param {String[]} dependencies Array of absolute paths.
   * @returns {undefined} Nothing.
   *
   * @description
   * Enumerate all folders below `xpacks` and identify package names,
   * then walk through the list of dependencies.
   */
  static async collectDependencies_ (folderAbsolutePath, options,
    dependencies) {
    const Self = this

    // Object to collect the names of the installed packages.
    const installedPackNames = {}

    const packageAbsolutePath = path.join(folderAbsolutePath, 'package.json')
    const packageJson = await JsonCache.parse(packageAbsolutePath)

    const xpacksFolderName = Xpack.getDirectory(packageJson, 'xpacks')
    const xpacksAbsolutePath = path.join(folderAbsolutePath, xpacksFolderName)

    // console.log(xpacksAbsolutePath)
    let entries = []
    try {
      entries = await DirCache.readdir(xpacksAbsolutePath)
    } catch (ex) {
      // Currently I could not identify other reason then ENOENT,
      // the test is for just in case.
      /* istanbul ignore next */
      if (ex.code !== 'ENOENT') {
        /* istanbul ignore next */
        throw ex
      }
      // There is no xpacks folder, but do not quit yet, must
      // check if there are any dependencies and throw errors
      // (in `recurseDependencies_()`).
    }

    // Iterate over the names in the directory, if any.
    for (const entry of entries) {
      if (!entry.stat.isDirectory()) {
        continue
      }
      const installedFolderAbsolutePath = path.join(
        xpacksAbsolutePath, entry.name)
      const installedPackageAbsolutePath = path.join(
        installedFolderAbsolutePath, 'package.json')

      let installedPackageJson
      try {
        installedPackageJson = await JsonCache.parse(
          installedPackageAbsolutePath)
        // console.log(installedPackageJson)
      } catch (ex) {
        if (ex.code === 'ENOENT') {
          // There is no xpacks folder.
          continue
        } else {
          throw ex
        }
      }

      if (!Xpack.isXpack(installedPackageJson)) {
        if (installedPackageJson.name) {
          options.log.verbose(`Package '${installedPackageJson.name}' ` +
            'not an xPack, ignored.')
        } else {
          options.log.verbose('Unnamed package, ignored.')
        }
        continue
      }

      // console.log(depPackageJson.name)
      if (installedPackNames.hasOwnProperty(installedPackageJson.name)) {
        throw new TypeError('Internal error, duplicate package ' +
          `'${installedPackageJson}.name'`)
      }
      // Add the name of the installed xpack.
      installedPackNames[installedPackageJson.name] = {
        json: installedPackageJson,
        folder: installedFolderAbsolutePath
      }
      // console.log(installedPackNames[installedPackageJson.name])
    }

    // Walk through dependencies, starting with top package.
    Self.recurseDependencies_(packageJson, installedPackNames,
      dependencies)
  }

  static recurseDependencies_ (packageJson, installedPackNames,
    dependenciesSet) {
    const Self = this
    const packageName = packageJson.name
    if (installedPackNames.hasOwnProperty(packageName)) {
      // Early tag, to prevent circular references.
      installedPackNames[packageName].wasProcessed = true
    }
    // If there are no dependencies, we're done.
    if (!packageJson.dependencies) {
      return
    }
    // If there are, iterate over them.
    for (const depName of Object.keys(packageJson.dependencies)) {
      // Check if the dependency is in the list of installed packages.
      // console.log(depName)
      if (!installedPackNames.hasOwnProperty(depName)) {
        throw new TypeError('Internal error, missing package ' +
          `'${depName}'`)
      }

      if (!installedPackNames[depName].wasProcessed) {
        // New dependency, add it to the result array.
        dependenciesSet.add(installedPackNames[depName].folder)
        // Recurse, process the dependencies of this dependency.
        Self.recurseDependencies_(installedPackNames[depName].json,
          installedPackNames, dependenciesSet)
      }
    }
  }
}

DiscovererCache.xmakeIgnoreFileName = '.xmakeignore'

// Deprecated!
// DiscovererCache.xmakeIncludeFileName = '.xmake-include'
// DiscovererCache.xmakeSourceFileName = '.xmake-source'

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