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

const assert = require('assert')

// ----------------------------------------------------------------------------

// ============================================================================

class Tool {
  constructor (name, toolchain, original = undefined) {
    if (original) {
      assert(original instanceof Tool, 'original must be Tool')

      // console.log(original)
      const clone = JSON.parse(JSON.stringify(original, (key, value) => {
        if (key === 'toolchain' || key === 'tool') {
          // Remove circular references to keep stringify() happy.
          return undefined
        }
        return value
      }))
      Object.assign(this, clone)

      if (this.hasOwnProperty('fileExtensions')) {
        for (const fileExtension of Object.values(this.fileExtensions)) {
          // Redo the circular references to tool.
          fileExtension.tool = this
        }
      }
    }
    this.toolchain = toolchain
    this.toolName = name
  }

  get fullCommandName () {
    if (!this.fullCommandName_) {
      this.fullCommandName_ = this.toolchain.commandPrefix +
        this.commandName + this.toolchain.commandSuffix
    }
    return this.fullCommandName_
  }
}

// ============================================================================

class Toolchain {
  constructor (name, original = undefined) {
    if (original) {
      assert(original instanceof Toolchain, 'original must be Toolchain')

      // console.log(original)
      const clone = JSON.parse(JSON.stringify(original, (key, value) => {
        if (key === 'toolchain' || key === 'tools' || key === 'tool') {
          // Remove circular references to keep stringify() happy.
          return undefined
        }
        return value
      }))
      Object.assign(this, clone)

      this.tools = {}
      if (original.hasOwnProperty('tools')) {
        // Redo the tools.
        for (const [toolName, toolValue] of Object.entries(original.tools)) {
          this.tools[toolName] = new Tool(toolName, this, toolValue)
        }
      }
      if (this.hasOwnProperty('fileExtensions')) {
        for (const fileExtension of Object.values(this.fileExtensions)) {
          // Redo the circular references to parent tool.
          fileExtension.tool = this.tools[fileExtension.toolName]
        }
      }
    }

    this['toolchainName'] = name
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.Toolchain = Toolchain
module.exports.Tool = Tool

// In ES6, it would be:
// export class Toolchain { ... }
// ...
// import { Toolchain } from '../toolchain.js'

// ----------------------------------------------------------------------------
