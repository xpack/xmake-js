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

const JsonCache = require('./json-cache.js').JsonCache
const Util = require('./util.js').Util

// const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
// Promisifier.promisifyInPlace(fs, 'readFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
// const fsPromises = fs.promises_

// ----------------------------------------------------------------------------

const mockLog = {}
mockLog.verbose = () => {}
mockLog.debug = () => {}
mockLog.trace = () => {}

// ============================================================================

/**
 * @description
 * Static class to manage toolchains.
 */
class ToolchainCache {
  /**
   * @summary Parse JSON and add toolchain definitions to the global cache.
   *
   * @static
   * @async
   * @param {String} absoluteFilePath Absolute path to file to parse.
   * @param {Object} options Optional tweaks.
   * @param {Object} options.log Optional logger object.
   * @returns {Object} The parsed JSON.
   */
  static async parse (absoluteFilePath, options = {}) {
    assert(absoluteFilePath, 'There must be a JSON path')

    const Self = this

    if (!options.log) {
      options.log = mockLog
    }

    options.log.trace(`${this.name}.parse('${absoluteFilePath}')`)

    const json = await JsonCache.parse(absoluteFilePath)

    if (json.hasOwnProperty('toolchains')) {
      for (const [name, toolchainJson] of Object.entries(json.toolchains)) {
        // TODO: normalise toolchainJson by XmakeParser?
        Self.add(name, toolchainJson, options)
      }
    }
    return json
  }

  /**
   * @summary Add the original toolchain definition to the json cache.
   *
   * @static
   * @param {String} name Toolchain name.
   * @param {Object} toolchainJson The toolchain JSON definition
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
  static add (name, toolchainJson, options = {}) {
    assert(name, 'There must be a toolchain name')
    assert(toolchainJson, 'There must be a toolchain JSON')

    const Self = this

    if (!Self.jsonCache) {
      Self.jsonCache = {}
    }

    if (!options.log) {
      options.log = mockLog
    }

    options.log.trace(`${this.name}.add('${name}')`)

    if (Self.jsonCache.hasOwnProperty(name)) {
      options.log.verbose(`Toolchain '${name}' redefined`)
    }
    Self.jsonCache[name] = toolchainJson
  }

  /**
   * @summary Parse a toolchain definition.
   *
   * @static
   * @param {String} name Toolchain name.
   * @param {Object} options Optional tweaks.
   * @param {Object} options.log Optional logger object.
   * @returns {Object} Operational toolchain definition.
   * @throws Error 'Toolchain not defined'
   */
  static retrieve (name, options = {}) {
    assert(name, 'There must be a toolchain name')

    const Self = this

    if (!Self.cache) {
      Self.cache = {}
    }

    if (!options.log) {
      options.log = mockLog
    }

    options.log.trace(`${this.name}.retrieve('${name}')`)

    if (!Self.cache.hasOwnProperty(name)) {
      // If not already in, process.
      if (Self.jsonCache.hasOwnProperty(name)) {
        // Process parent & defaults
        Self.cache[name] = Self.processToolchain_(name, options)
      } else {
        throw new Error(`Toolchain '${name}' not defined.`)
      }
    }
    return Self.cache[name]
  }

  /**
   * @summary Process a toolchain internally.
   *
   * @static
   * @private
   * @param {String} name Toolchain name.
   * @param {Object} options Optional tweaks.
   * @param {Object} options.log Optional logger object.
   * @returns {Toolchain} The new toolchain object.
   *
   * @description
   * Create a new toolchain object, from scratch or from the parent JSON
   * definitions.
   *
   * Set default properties and process children tools.
   */
  static processToolchain_ (name, options) {
    assert(name, 'There must be a toolchain name')
    assert(options, 'There must be some options')

    const Self = this

    options.log.trace(`${this.name}.processToolchain_('${name}')`)

    const toolchainJson = Self.jsonCache[name]
    let newToolchain
    if (toolchainJson.parent) {
      // Recursive call to get a copy of the parent.
      newToolchain = new Toolchain(name, Self.retrieve(toolchainJson.parent,
        options))
    } else {
      newToolchain = new Toolchain(name)
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
      if (toolchainJson.hasOwnProperty(prop.name)) {
        if (Util.isString(toolchainJson[prop.name])) {
          newToolchain[prop.name] = toolchainJson[prop.name]
        } else {
          throw TypeError(`Toolchain '${name}' property '${prop.name}' ` +
            'must be a string'
          )
        }
      }
    }

    // Set toolchain defaults for the missing properties.
    for (const prop of toolchainProps) {
      if (!newToolchain.hasOwnProperty(prop.name)) {
        newToolchain[prop.name] = prop.defaultValue
      }
    }

    if (toolchainJson.hasOwnProperty('tools')) {
      for (const [toolName, toolJson] of Object.entries(toolchainJson.tools)) {
        this.processTool_(toolName, toolJson, newToolchain, options)
      }
    }

    if (newToolchain.hasOwnProperty('tools')) {
      // Construct the list of extensions with links to tools.
      if (!newToolchain.hasOwnProperty('fileExtensions')) {
        newToolchain.fileExtensions = {}
      }
      for (const [, tool] of Object.entries(newToolchain.tools)) {
        if (tool.hasOwnProperty('fileExtensions')) {
          for (const [extension, extensionValue] of
            Object.entries(tool.fileExtensions)) {
            newToolchain.fileExtensions[extension] = extensionValue
            newToolchain.fileExtensions[extension].name = extension
            newToolchain.fileExtensions[extension].tool = tool
          }
        }
      }
    }
    return newToolchain
  }

  /**
   * @summary Process a tool internally.
   *
   * @static
   * @private
   * @param {String} toolName Tool name.
   * @param {Object} toolJson The tool JSON definition.
   * @param {Toolchain} toolchain The toolchain that this tool belongs.
   * @param {Object} options Optional tweaks.
   * @param {Object} options.log Optional logger object.
   * @returns {undefined} Nothing.
   *
   * @description
   * Create a new Tool object in the toolchain object, or update
   * it if already there.
   *
   * Copy only the known properties, and silently ignore all other.
   *
   * Validate the `type` field, throw if unsupported.
   */
  static processTool_ (toolName, toolJson, toolchain, options) {
    assert(toolName, 'There must be a toolName')
    assert(toolJson, 'There must be a toolJson')
    assert(toolchain instanceof Toolchain, 'Must be an instance of Toolchain')

    // const Self = this

    options.log.trace(`${this.name}.processTool_('${toolName}')`)

    if (!toolchain.hasOwnProperty('tools')) {
      toolchain.tools = {}
    }

    const toolProps = [
      'commandName',
      'description',
      'type',
      'languages'
    ]
    let newTool
    if (!toolchain.tools.hasOwnProperty(toolName)) {
      // Tool does not exist, create.
      newTool = new Tool(toolName, toolchain)

      for (const prop of toolProps) {
        if (toolJson[prop]) {
          newTool[prop] = toolJson[prop]
        } else {
          throw new Error(`Tool '${toolName}' has no mandatory '${prop}'.`)
        }
      }
      toolchain.tools[toolName] = newTool
    } else {
      // Tool exists, update tool properties.
      newTool = toolchain.tools[toolName]
      if (toolJson.type && newTool.type !== toolJson.type) {
        throw new Error(`Tool '${toolName}' cannot redefine type`)
      }
      for (const prop of toolProps) {
        if (Util.isString(toolJson[prop])) {
          newTool[prop] = toolJson[prop]
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
    } else if (type === 'archiver') {
      toolTypeProps = [
        'outputFlag',
        'output'
      ]
    } else {
      throw new Error(`Tool '${toolName}' has unsupported type '${type}'`)
    }
    for (const prop of toolTypeProps) {
      if (Util.isString(toolJson[prop])) {
        newTool[prop] = toolJson[prop]
      }
    }

    if (type === 'compiler' || type === 'assembler') {
      // Process file extensions.
      if (!newTool.fileExtensions) {
        newTool.fileExtensions = {}
      }
      if (toolJson.fileExtensions) {
        for (const [extension, extensionValue] of
          Object.entries(toolJson.fileExtensions)) {
          if (!newTool.fileExtensions[extension]) {
            newTool.fileExtensions[extension] = { }
          }
          newTool.fileExtensions[extension].prefix = extensionValue.prefix
        }
      }
    }
  }

  /**
   * @summary Clear cached values.
   *
   * @static
   * @returns {undefined} Nothing.
   *
   * @description
   * Required during testing. Should not be used in the application.
   */
  static clear () {
    const Self = this

    if (Self.cache) {
      delete Self.cache
    }

    if (Self.jsonCache) {
      delete Self.jsonCache
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
