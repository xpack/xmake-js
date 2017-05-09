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

// ============================================================================

class Artifact {
  constructor (configArtifact) {
    // [ 'executable', 'staticLib', 'sharedLib' ]
    this.type = configArtifact.type

    this.name = configArtifact.name

    this.outputPrefix = configArtifact.outputPrefix || ''
    this.outputSuffix = configArtifact.outputSuffix || ''
    this.extension = configArtifact.extension || '' // without dot

    this.fullNameWithExtension_ = undefined
  }

  get fullName () {
    if (!this.fullNameWithExtension_) {
      this.fullNameWithExtension_ =
        this.outputPrefix + this.name + this.outputSuffix
      if (this.extension.length > 0) {
        this.fullNameWithExtension_ += '.' + this.extension
      }
    }
    return this.fullNameWithExtension_
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Test class is added as a property of this object.
module.exports.Artifact = Artifact

// In ES6, it would be:
// export class Artifact { ... }
// ...
// import { Artifact } from '../utils/artifact.js'

// ----------------------------------------------------------------------------
