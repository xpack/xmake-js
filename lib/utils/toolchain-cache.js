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

// const fs = require('fs')
const assert = require('assert')
// const path = require('path')

const Toolchain = require('./toolchain.js').Toolchain
const Tool = require('./toolchain.js').Tool

// const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
// Promisifier.promisifyInPlace(fs, 'readFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
// const fsPromises = fs.promises_

// ============================================================================

class ToolchainCache {
  /**
   * @summary Add the original toolchain definition to the cache.
   *
   * @param {String} name Toolchain name.
   * @param {Object} toolchain The toolchain input definition
   * @param {Object} options Optional tweaks.
   * @param {Object} options.log Optional logger object.
   * @return {undefined} Nothing.
   *
   * @description
   * This function contributes entries to a cache of definitions as entered
   * by the user.
   * It will be lazy parsed into another cache of operational definitions,
   * with parents substituted and defaults resolved.
   */
  static add (name, toolchain, options = {}) {
    const Self = this

    if (!Self.inputCache) {
      Self.inputCache = {}
    }

    if (!options.log) {
      options.log = {}
      options.log.debug = () => {}
      options.log.trace = () => {}
    }

    if (Self.inputCache.hasOwnProperty(name)) {
      options.log.debug(`Toolchain '${name}' redefined`)
    }
    Self.inputCache[name] = toolchain
    options.log.trace(`Toolchain '${name}' cached`)
  }

  /**
   * @summary Parse a toolchain definition.
   *
   * @param {*} name Toolchain name.
   * @param {Object} options Optional tweaks.
   * @param {Object} options.log Optional logger object.
   * @returns {Object} Operational toolchain definition.
   * @throws Error 'Toolchain not defined'
   */
  static retrieve (name, options = {}) {
    const Self = this

    if (!Self.cache) {
      Self.cache = {}
    }

    if (!options.log) {
      options.log = {}
      options.log.debug = () => {}
      options.log.trace = () => {}
    }

    if (!Self.cache.hasOwnProperty(name)) {
      // If not already in, process.
      if (Self.inputCache.hasOwnProperty(name)) {
        // Process parent & defaults
        Self.cache[name] = Self.processToolchain_(name, options)
      } else {
        throw new Error(`Toolchain '${name}' not defined.`)
      }
    }
    return Self.cache[name]
  }

  static processToolchain_ (name, options) {
    const Self = this

    options.log.trace(`processToolchain_('${name}')`)

    const inputToolchain = Self.inputCache[name]
    let toolchain
    if (inputToolchain.parent) {
      // Recursive call to get a copy of the parent.
      toolchain = new Toolchain(name, Self.retrieve(inputToolchain.parent,
        options))
    } else {
      toolchain = new Toolchain(name)
    }

    const toolchainProps = [
      {
        name: 'commandPrefix',
        defaultValue: ''
      },
      {
        name: 'commandSuffix',
        defaultValue: ''
      },
      {
        name: 'descriptionPrefix',
        defaultValue: ''
      },
      {
        name: 'objectExtension',
        defaultValue: 'o'
      },
      {
        name: 'makeObjectsVariable',
        defaultValue: 'OBJS'
      }
    ]
    for (const prop of toolchainProps) {
      if (inputToolchain.hasOwnProperty(prop.name)) {
        if (Self.isString(inputToolchain[prop.name])) {
          toolchain[prop.name] = inputToolchain[prop.name]
        } else {
          throw TypeError(`Toolchain '${name}' property '${prop.name}' ` +
            'must be a string'
          )
        }
      }
    }

    // Set toolchain defaults for the missing properties.
    for (const prop of toolchainProps) {
      if (!toolchain.hasOwnProperty(prop.name)) {
        toolchain[prop.name] = prop.defaultValue
      }
    }

    if (inputToolchain.hasOwnProperty('tools')) {
      for (const [toolName, tool] of Object.entries(inputToolchain.tools)) {
        this.processTool_(toolName, tool, toolchain)
      }
    }

    if (toolchain.hasOwnProperty('tools')) {
      // Construct the list of extensions with links to tools.
      if (!toolchain.hasOwnProperty('fileExtensions')) {
        toolchain.fileExtensions = {}
      }
      for (const [toolName, toolValue] of Object.entries(toolchain.tools)) {
        if (toolValue.hasOwnProperty('fileExtensions')) {
          for (const [extension, extensionValue] of
            Object.entries(toolValue.fileExtensions)) {
            toolchain.fileExtensions[extension] = extensionValue
            toolchain.fileExtensions[extension].toolName = toolName
            toolchain.fileExtensions[extension].tool = toolValue
          }
        }
      }
    }
    return toolchain
  }

  static processTool_ (toolName, tool, toolchain) {
    const Self = this

    assert(toolchain instanceof Toolchain, 'Must be an instance of Toolchain')

    if (!toolchain.hasOwnProperty('tools')) {
      toolchain.tools = {}
    }

    const toolProps = [
      'commandName',
      'description',
      'type'
    ]
    let newTool
    if (!toolchain.tools.hasOwnProperty(toolName)) {
      // Tool does not exist, create.
      newTool = new Tool(toolName, toolchain)

      for (const prop of toolProps) {
        if (tool[prop]) {
          newTool[prop] = tool[prop]
        } else {
          throw new Error(`Tool '${toolName}' has no mandatory '${prop}'.`)
        }
      }
      toolchain.tools[toolName] = newTool
    } else {
      // Tool exists, update tool properties.
      newTool = toolchain.tools[toolName]
      if (tool.type && newTool.type !== tool.type) {
        throw new Error(`Tool '${toolName}' cannot redefine type`)
      }
      for (const prop of toolProps) {
        if (Self.isString(tool[prop])) {
          newTool[prop] = tool[prop]
        }
      }
    }

    let toolTypeProps = []
    const type = newTool.type
    if (type === 'compiler' || type === 'assembler') {
      toolTypeProps = [
        'options',
        'deps',
        'outputFlag',
        'output',
        'inputs'
      ]
    } else if (type === 'linker') {
      toolTypeProps = [
        'outputFlag',
        'output'
      ]
    } else {
      throw new Error(`Tool '${toolName}' has unsupported type '${type}'`)
    }
    for (const prop of toolTypeProps) {
      if (Self.isString(tool[prop])) {
        newTool[prop] = tool[prop]
      }
    }

    if (type === 'compiler' || type === 'assembler') {
      if (!newTool.fileExtensions) {
        newTool.fileExtensions = {}
      }
      if (tool.fileExtensions) {
        for (const [extension, extensionValue] of
          Object.entries(tool.fileExtensions)) {
          if (!newTool.fileExtensions[extension]) {
            newTool.fileExtensions[extension] = { }
          }
          newTool.fileExtensions[extension].prefix = extensionValue.prefix
        }
      }
    }
  }

  /**
   * @summary Test if a variable is string.
   *
   * @param {*} x Variable.
   * @return {boolean} true if the variable is string.
   */
  static isString (x) {
    return Object.prototype.toString.call(x) === '[object String]'
  }

  static clear () {
    const Self = this

    if (Self.cache) {
      delete Self.cache
    }

    if (Self.inputCache) {
      delete Self.inputCache
    }
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The class is added as a property of this object.
module.exports.ToolchainCache = ToolchainCache

// In ES6, it would be:
// export class ToolchainCache { ... }
// ...
// import { ToolchainCache } from '../utils/toolchain-cache.js'

// ----------------------------------------------------------------------------
