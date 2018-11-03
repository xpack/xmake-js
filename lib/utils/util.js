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

const path = require('path')
const assert = require('assert')

// ============================================================================

class Util {
  /**
   * @summary Check if string.
   *
   * @static
   * @param {*} x Value to check.
   * @returns {boolean} True if the value is a string.
   */
  static isString (x) {
    return Object.prototype.toString.call(x) === '[object String]'
  }

  /**
   * @summary Check if object (not scalar or array).
   *
   * @static
   * @param {*} x Value to check.
   * @returns {boolean} True if the value is an object.
   */
  static isObject (x) {
    return typeof x === 'object' && !Array.isArray(x)
  }

  /**
   * @summary Convert a duration in ms to seconds if larger than 1000.
   *
   * @static
   * @param {number} n Duration in milliseconds.
   * @returns {String} Value in ms or sec.
   */
  static formatDuration (n) {
    if (n < 1000) {
      return `${n} ms`
    }
    return `${(n / 1000).toFixed(3)} sec`
  }

  /**
   * @summary Validate and trim string array.
   *
   * @param {String|String[]} x String or string array.
   * @returns {String[]} Array of trimmed strings, possibly empty.
   * @throws TypeError if not string or array of strings.
   */
  static validateStringArray (x) {
    const strings = []
    if (x) {
      if (Array.isArray(x)) {
        for (const str of x) {
          if (!Util.isString(str)) {
            throw new TypeError(
              'Must be an array of string or at least a string.')
          }
          strings.push(str.trim())
        }
      } else if (Util.isString(x)) {
        strings.push(x.trim())
      } else {
        throw new TypeError('Must be an array of string or at least a string.')
      }
    }
    return strings
  }

  /**
   * @summary Convert paths to POSIX syntax.
   *
   * @static
   * @param {*} obj String or array of strings representing paths.
   * @returns {Object} String or array of strings.
   */
  static toPosixPath (obj) {
    if (Array.isArray(obj)) {
      const arr = []
      for (const elem of obj) {
        arr.push(this.toPosixPath(elem))
      }
      return arr
    }
    assert(typeof obj === 'string')

    return path.posix.normalize(obj)
  }

  static toPosixRelativePath (fromPath, obj) {
    if (Array.isArray(obj)) {
      const arr = []
      for (const elem of obj) {
        arr.push(path.posix.relative(fromPath, elem))
      }
      return arr
    }
    assert(typeof obj === 'string')

    return path.posix.relative(fromPath, obj)
  }

  static capitalizeFirstLetter (string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
  }

  static escapeSpaces (string) {
    return string.replace(/ /g, '\\ ')
  }

  /**
   * @summary Check if the name is valid.
   *
   * @param {*} x Input object.
   * @returns {boolean} True if the name is a valid string.
   */
  static isValidName (x) {
    if (Object.prototype.toString.call(x) === '[object String]') {
      return false
    }
    // Check if a 'civilized' name. \w is alphanumeric [A-Za-z0-9_]
    if (x.search(/[^\w-]/) !== -1) {
      return false
    }
    return true
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.Util = Util

// In ES6, it would be:
// export class Util { ... }
// ...
// import { Util } from '../utils/util.js'

// ----------------------------------------------------------------------------
