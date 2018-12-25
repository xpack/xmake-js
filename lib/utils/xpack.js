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

const CliErrorType = require('@ilg/cli-start-options').CliErrorType

// ============================================================================

class Xpack {
  /**
   * @summary Test if a variable is string.
   *
   * @param {*} x Variable.
   * @return {boolean} true if the variable is string.
   */
  static isString (x) {
    return Object.prototype.toString.call(x) === '[object String]'
  }

  /**
   * @summary Get the named directory.
   *
   * @static
   * @param {Object} packageJson The xPack JSON.
   * @param {String} name The directory name.
   * @return {Object} String or array of strings.
   * @throws TypeError
   *
   * @description
   * Validate the entry and return it.
   * String entries: `xpacks`, `build`, `test`.
   * String array entries: `src`, `include`.
   */
  static getDirectory (packageJson, name) {
    const Self = this
    let dirName = `./${name}`
    if (packageJson.xpack && packageJson.xpack.directories &&
      packageJson.xpack.directories[name]) {
      dirName = packageJson.xpack.directories[name]

      // src & include must be arrays.
      if (name === 'src' || name === 'include') {
        if (Array.isArray(dirName)) {
          // Array is fine.
        } else if (Self.isString(dirName)) {
          dirName = [ dirName ]
        } else {
          throw new CliErrorType(
            `xpack.directories.${name} must be a string ` +
            'or an array of strings')
        }
      } else {
        if (Self.isString(dirName)) {
          // String is fine.
        } else {
          throw new CliErrorType(
            `xpack.directories.${name} must be a string`)
        }
      }
    }
    return dirName
  }

  /**
   * @summary Check if a JSON is from an xPack.
   *
   * @static
   * @param {Object} packageJson The xPack JSON.
   * @returns {boolean} True is an xPack.
   *
   * @description
   * Check `name` and `version`, as required by `npm`,
   * and `xpack` as required by `xpm`.
   */
  static isXpack (packageJson) {
    const Self = this

    // `npm` requirements, name & version.
    if (!packageJson.name) {
      return false
    }
    if (!Self.isString(packageJson.name)) {
      return false
    }
    if (!packageJson.version) {
      return false
    }
    if (!Self.isString(packageJson.version)) {
      return false
    }
    // `xpm` additional requirements.
    if (!packageJson.xpack) {
      return false
    }
    // If all requirements are met, it must be an xPack.
    return true
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.Xpack = Xpack

// In ES6, it would be:
// export class Xpack { ... }
// ...
// import { Xpack } from '../utils/xpack.js'

// ----------------------------------------------------------------------------
