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

/**
 * @typedef {Object} FileExtensions
 *
 * @description
 * Map of FileExtension objects, by extension name (like `cpp`).
 */

/**
 * @typedef {Object} FileExtension
 *
 * @param {String} name The extension name (like `cpp`)
 * @param {String} prefix The (upper case) string used as prefix when creating
 * internal variables.
 * @param {Tool} tool The tool associated with this extension.
 */

/**
 * @typedef {Object} Tool
 *
 * @param {String} name The tool name.
 * @param {String} commandName The command name used by the tool, like `gcc`.
 * @param {String} description The tool short description, shown by the builder.
 * @param {String} type The tool type; [ `compiler`, `linker` ] only.
 * @param {Toolchain} toolchain The parent toolchain.
 * @param {string} fullCommandName Accessor function to concatenate the
 * command name.
 * @param {FileExtensions} fileExtensions Map of file extensions.
 */

/**
  * @typedef {Object} ToolCompiler; derived from Tool.
  *
  * @param {String} options
  * @param {String} deps
  * @param {String} outputFlag
  * @param {String} output
  * @param {String} inputs
  */

/**
  * @typedef {Object} ToolLinker; derived from Tool.
  *
  * @param {String} outputFlag
  * @param {String} output
  */

/**
  * @description
  *
  * Object to store a tool, as seen in the templates.
  */
class Tool {
  /**
   * @summary Create new tool objects.
   *
   * @param {String} name The tool name.
   * @param {Toolchain} toolchain The parent toolchain.
   * @param {Tool} fromTool Optional reference to object to copy from.
   */
  constructor (name, toolchain, fromTool = undefined) {
    assert(name, 'There must be a tool name')
    assert(toolchain instanceof Toolchain, 'There must be a Toolchain')

    if (fromTool) {
      assert(fromTool instanceof Tool, 'original must be Tool')

      // console.log(original)
      const clone = JSON.parse(JSON.stringify(fromTool, (key, value) => {
        if (key === 'toolchain' || key === 'tool') {
          // Remove circular references to keep stringify() happy.
          return undefined
        }
        return value
      }))
      Object.assign(this, clone)

      if (this.hasOwnProperty('fileExtensions')) {
        for (const fileExtension of Object.values(this.fileExtensions)) {
          // Add the references to the parent tool.
          fileExtension.tool = this
        }
      }
    }
    // Store the parent toolchain.
    this.toolchain = toolchain

    // Store the tool name as a property.
    this.name = name
  }

  /**
   * @summary Full command name getter.
   *
   * @returns {String} The concatenated command name.
   *
   * @description
   * Caches the value under a private member.
   *
   * On the first call, create the full name by using the parent prefix/suffix.
   */
  get fullCommandName () {
    if (!this.fullCommandName_) {
      assert(this.toolchain, 'There must be a parent toolchain')

      this.fullCommandName_ = this.toolchain.commandPrefix +
        this.commandName + this.toolchain.commandSuffix
    }
    return this.fullCommandName_
  }

  get fullDescription () {
    if (!this.fullDescription_) {
      assert(this.toolchain, 'There must be a parent toolchain')

      if (this.toolchain.descriptionPrefix) {
        this.fullDescription_ = this.toolchain.descriptionPrefix + ' ' +
          this.description
      } else {
        this.fullDescription_ = this.description
      }
    }
    return this.fullDescription_
  }

  toString () {
    return this.name
  }
}

// ============================================================================

class Toolchain {
  /**
   * @summary Create new toolchain objects.
   *
   * @param {String} name Toolchain name.
   * @param {Toolchain} fromToolchain Optional reference to object to copy from.
   */
  constructor (name, fromToolchain = undefined) {
    if (fromToolchain) {
      assert(fromToolchain instanceof Toolchain, 'original must be Toolchain')

      // console.log(original)
      const clone = JSON.parse(JSON.stringify(fromToolchain, (key, value) => {
        if (key === 'toolchain' || key === 'tools' || key === 'tool') {
          // Remove circular references to keep stringify() happy.
          return undefined
        }
        return value
      }))
      Object.assign(this, clone)

      this.tools = {}
      if (fromToolchain.hasOwnProperty('tools')) {
        // Redo the tools.
        for (const [toolName, toolValue] of
          Object.entries(fromToolchain.tools)) {
          this.tools[toolName] = new Tool(toolName, this, toolValue)
        }
      }
      if (this.hasOwnProperty('fileExtensions')) {
        for (const fileExtension of Object.values(this.fileExtensions)) {
          // Redo the circular references to parent tools.
          fileExtension.tool = this.tools[fileExtension.toolName]
        }
      }
    }

    // Store the toolchain name as a property.
    this.name = name
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
