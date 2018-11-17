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
   * @summary Construct a toolchain case object.
   *
   * @param {Object} options Optional tweaks.
   * @param {Object} options.log Optional logger object.
   */
  constructor (options = {}) {
    if (options.log) {
      this.log = options.log
    } else {
      this.log = mockLog
    }
  }

  /**
   * @summary Parse JSON and add toolchain definitions to the global cache.
   *
   * @async
   * @param {String} absoluteFilePath Absolute path to file to parse.
   * @returns {Object} The parsed JSON.
   */
  async parse (absoluteFilePath) {
    assert(absoluteFilePath, 'There must be a JSON path')

    const log = this.log
    log.trace(`${this.constructor.name}.parse('${absoluteFilePath}')`)

    const json = await JsonCache.parse(absoluteFilePath)

    if (json.hasOwnProperty('toolchains')) {
      for (const [name, toolchainJson] of Object.entries(json.toolchains)) {
        // TODO: normalise toolchainJson by XmakeParser?
        this.add(name, toolchainJson)
      }
    }
    return json
  }

  /**
   * @summary Add the original toolchain definition to the json cache.
   *
   * @param {String} name Toolchain name.
   * @param {Object} toolchainJson The toolchain JSON definition
   * @return {undefined} Nothing.
   *
   * @description
   * This function contributes entries to a cache of definitions as entered
   * by the user.
   * It will be lazy parsed into another cache of operational definitions,
   * with parents substituted and defaults resolved.
   */
  add (name, toolchainJson) {
    assert(name, 'There must be a toolchain name')
    assert(toolchainJson, 'There must be a toolchain JSON')

    const log = this.log

    if (!this.jsonCache) {
      this.jsonCache = {}
    }

    log.trace(`${this.constructor.name}.add('${name}')`)

    if (this.jsonCache.hasOwnProperty(name)) {
      log.verbose(`Toolchain '${name}' redefined`)
    }
    this.jsonCache[name] = toolchainJson
  }

  /**
   * @summary Parse a toolchain definition.
   *
   * @param {String} name Toolchain name.
   * @returns {Object} Operational toolchain definition.
   * @throws Error 'Toolchain not defined'
   */
  retrieve (name) {
    assert(name, 'There must be a toolchain name')

    const log = this.log

    if (!this.cache) {
      this.cache = {}
    }

    log.trace(`${this.constructor.name}.retrieve('${name}')`)

    if (!this.cache.hasOwnProperty(name)) {
      // If not already in, process.
      if (this.jsonCache.hasOwnProperty(name)) {
        // Process parent & defaults
        this.cache[name] = this.processToolchain_(name)
      } else {
        throw new Error(`Toolchain '${name}' not defined.`)
      }
    }
    return this.cache[name]
  }

  /**
   * @summary Process a toolchain internally.
   *
   * @private
   * @param {String} name Toolchain name.
   * @returns {Toolchain} The new toolchain object.
   *
   * @description
   * Create a new toolchain object, from scratch or from the parent JSON
   * definitions.
   *
   * Set default properties and process children tools.
   */
  processToolchain_ (name) {
    assert(name, 'There must be a toolchain name')

    const log = this.log

    log.trace(`${this.constructor.name}.processToolchain_('${name}')`)

    const toolchainJson = this.jsonCache[name]
    let newToolchain
    if (toolchainJson.parent) {
      // Recursive call to get a copy of the parent.
      newToolchain = new Toolchain(name, this.retrieve(toolchainJson.parent))
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
      },
      {
        name: 'configurationSuffixes',
        defaultValue: []
      },
      {
        name: 'isCross',
        type: 'boolean'
      }
    ]
    for (const prop of toolchainProps) {
      if (toolchainJson.hasOwnProperty(prop.name)) {
        if (prop.hasOwnProperty('defaultValue')) {
          if (Util.isString(prop.defaultValue)) {
            if (Util.isString(toolchainJson[prop.name])) {
              newToolchain[prop.name] = toolchainJson[prop.name]
            } else {
              throw TypeError(`Toolchain '${name}' property '${prop.name}' ` +
                'must be a string'
              )
            }
          } else if (Array.isArray(prop.defaultValue)) {
            newToolchain[prop.name] =
              Util.validateStringArray(toolchainJson[prop.name])
          }
        } else if (prop.hasOwnProperty('type')) {
          if (prop.type === 'boolean') {
            if (Util.isBoolean(toolchainJson[prop.name])) {
              newToolchain[prop.name] = toolchainJson[prop.name]
            } else {
              throw TypeError(`Toolchain '${name}' property '${prop.name}' ` +
                'must be a boolean'
              )
            }
          }
        }
      }
    }

    // Set toolchain defaults for the missing properties.
    for (const prop of toolchainProps) {
      if (prop.hasOwnProperty('defaultValue')) {
        if (!newToolchain.hasOwnProperty(prop.name)) {
          newToolchain[prop.name] = prop.defaultValue
        }
      }
    }

    if (toolchainJson.hasOwnProperty('tools')) {
      for (const [toolName, toolJson] of Object.entries(toolchainJson.tools)) {
        this.processTool_(toolName, toolJson, newToolchain)
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
   * @private
   * @param {String} toolName Tool name.
   * @param {Object} toolJson The tool JSON definition.
   * @param {Toolchain} toolchain The toolchain that this tool belongs.
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
  processTool_ (toolName, toolJson, toolchain) {
    assert(toolName, 'There must be a toolName')
    assert(toolJson, 'There must be a toolJson')
    assert(toolchain instanceof Toolchain, 'Must be an instance of Toolchain')

    const log = this.log

    log.trace(`${this.constructor.name}.processTool_('${toolName}') ` +
      `of '${toolchain.name}'`)

    if (!toolchain.hasOwnProperty('tools')) {
      toolchain.tools = {}
    }

    const toolProps = [
      'commandName',
      'description',
      'type',
      'prefix',
      'languages',
      'configurationSuffixes'
    ]
    let newTool
    if (!toolchain.tools.hasOwnProperty(toolName)) {
      // Tool does not exist, create.
      for (const prop of toolProps) {
        if (!toolJson[prop]) {
          throw new Error(`Tool '${toolName}' has no mandatory '${prop}'.`)
        }
      }

      newTool = toolchain.addTool(toolName, toolJson)
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
   * @returns {undefined} Nothing.
   *
   * @description
   * Required during testing. Should not be used in the application.
   */
  clear () {
    if (this.cache) {
      delete this.cache
    }

    if (this.jsonCache) {
      delete this.jsonCache
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
