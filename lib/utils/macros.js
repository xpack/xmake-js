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

const CliErrorType = require('@ilg/cli-start-options').CliErrorType

// ============================================================================

class Macros {
  static substitute (value, macroValues) {
    while (true) {
      const beginIndex = value.indexOf('${')
      if (beginIndex === -1) {
        break
      }
      const endIndex = value.indexOf('}', beginIndex)
      if (endIndex === -1) {
        break
      }
      const macroName = value.substring(beginIndex + 2, endIndex).trim()
      if (macroName.length === 0) {
        throw new CliErrorType(`Empty macro in '${value}'.`)
      }
      if (!macroValues.hasOwnProperty(macroName)) {
        throw new CliErrorType(`Unknown macro '${macroName}' in '${value}'.`)
      }
      value = value.substring(0, beginIndex) + macroValues[macroName] +
        value.substring(endIndex + 1)
    }
    return value
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.Macros = Macros

// In ES6, it would be:
// export class Macros { ... }
// ...
// import { Macros } from '../utils/macros.js'

// ----------------------------------------------------------------------------
