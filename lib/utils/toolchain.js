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

const path = require('path')
const assert = require('assert')
const Util = require('./util.js').Util
const Macros = require('./macros.js').Macros

const CliErrorType = require('@ilg/cli-start-options').CliErrorType

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

// ============================================================================

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
  constructor (name, toolchain, fromTool) {
    assert(Util.isString(name), 'There must be a tool name')
    assert(toolchain instanceof Toolchain, 'There must be a Toolchain')

    if (fromTool) {
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
    if (!this.fullCommandNameCached_) {
      assert(this.toolchain, 'There must be a parent toolchain')

      this.fullCommandNameCached_ = this.toolchain.commandPrefix +
        this.commandName + this.toolchain.commandSuffix
    }
    return this.fullCommandNameCached_
  }

  get fullDescription () {
    if (!this.fullDescriptionCached_) {
      assert(this.toolchain, 'There must be a parent toolchain')

      if (this.toolchain.descriptionPrefix) {
        this.fullDescriptionCached_ = this.toolchain.descriptionPrefix + ' ' +
          this.description
      } else {
        this.fullDescriptionCached_ = this.description
      }
    }
    return this.fullDescriptionCached_
  }

  /**
   * @summary Collect all simple options in an array.
   * @param {DMNode} node Source tree node.
   * @returns {String[]} Array of strings with options.
   *
   * @description
   * Simple options are those that do not need multiple words.
   */
  simpleOptionsArray (node) {
    let optionsArray = []
    const toolOptions = node.options.tools[this.name]
    for (const suffix of this.configurationSuffixes) {
      const options = toolOptions.propertyWithAddAndRemove_(suffix)
      if (options.length) {
        optionsArray = [...optionsArray, ...options]
      }
    }
    return optionsArray
  }

  fullOptions (node) {
    let optionsString = ''

    for (const suffix of this.configurationSuffixes) {
      const toolOptions = node.options.tools[this.name]
      const options = toolOptions.propertyWithAddAndRemove_(suffix)
      if (options.length) {
        optionsString += ' ' + options.join(' ')
      }
    }
    return optionsString.trim()
  }

  toString () {
    return this.name
  }
}

// ============================================================================

class ToolCompiler extends Tool {
  constructor (name, toolchain, fromTool = undefined) {
    super(name, toolchain, fromTool)
  }

  /**
   * @summary Get the full command string.
   *
   * @param {DMNode} node The tree node
   * @returns {String} The full command string.
   */
  fullCommand (node) {
    let fullCommandString = this.fullCommandName

    if (this.options) {
      fullCommandString += ` ${this.options}`
    }

    const fullOptions = this.fullOptions(node)
    if (fullOptions) {
      fullCommandString += ` ${fullOptions}`
    }

    const nodeToolOptions = node.options.tools[node.options.tool.name]
    if (nodeToolOptions.definedSymbols) {
      for (const symbol of nodeToolOptions.definedSymbols) {
        fullCommandString += ` -D${symbol}`
      }
    }

    if (nodeToolOptions.undefinedSymbols) {
      for (const symbol of nodeToolOptions.undefinedSymbols) {
        fullCommandString += ` -U${symbol}`
      }
    }

    // https://gcc.gnu.org/onlinedocs/cpp/Invocation.html
    if (nodeToolOptions.includeFiles) {
      for (const folder of nodeToolOptions.includeFiles) {
        fullCommandString += ` -include '${folder}'`
      }
    }
    if (nodeToolOptions.includeSystemFolders) {
      for (const folder of nodeToolOptions.includeSystemFolders) {
        fullCommandString += ` -isystem '${folder}'`
      }
    }
    if (nodeToolOptions.includeFolders) {
      for (const folder of nodeToolOptions.includeFolders) {
        fullCommandString += ` -I '${folder}'`
      }
    }

    if (this.deps) {
      fullCommandString += ` ${this.deps}`
    }
    if (this.inputs) {
      fullCommandString += ` ${this.inputs}`
    }
    if (this.outputFlag) {
      fullCommandString += ` ${this.outputFlag}`
    }
    if (this.output) {
      fullCommandString += ` ${this.output}`
    }

    const macroValues = {
      'node.relativePathShortName': node.relativePathShortName,
      'node.relativePathShortNameEscaped': node.relativePathShortNameEscaped,
      'node.relativePath': node.relativePath,
      'node.buildRelativePath': node.buildRelativePath,
      'toolchain.objectExtension': this.toolchain.objectExtension
    }
    fullCommandString =
      Macros.substitute(fullCommandString, macroValues)

    return fullCommandString
  }
}

// ============================================================================

class ToolLinker extends Tool {
  constructor (name, toolchain, fromTool = undefined) {
    super(name, toolchain, fromTool)
  }

  fullCommand (node) {
    let fullCommandString = this.fullCommandName

    if (this.options) {
      fullCommandString += ` ${this.options}`
    }

    const fullOptions = this.fullOptions(node)
    if (fullOptions) {
      fullCommandString += ` ${fullOptions}`
    }
    for (const obj of node.objs) {
      fullCommandString += ` '${obj}'`
    }
    if (this.outputFlag) {
      fullCommandString += ` ${this.outputFlag}`
    }
    if (this.output) {
      fullCommandString += ` ${this.output}`
    }

    let macroValues
    // TODO: find a better source for the build.relativePath.
    macroValues = {
      'artefact.fullName': node.targetArtefact.fullName,
      'build.relativePath': node.buildRelativePath
    }
    fullCommandString =
      Macros.substitute(fullCommandString, macroValues)

    return fullCommandString
  }

  fullOptions (node) {
    let optionsString = ''

    for (const suffix of this.configurationSuffixes) {
      const toolOptions = node.options.tools[this.name]
      const options = toolOptions.propertyWithAddAndRemove_(suffix)
      if (options.length) {
        if (suffix === 'Libraries') {
          for (const option of options) {
            optionsString += ' -l' + option
          }
        } else if (suffix === 'LinkerScripts') {
          for (const option of options) {
            optionsString += ` -T '${option}'`
          }
        } else if (suffix === 'LibraryFolders') {
          for (const option of options) {
            let optionPath = option
            if (!path.isAbsolute(option)) {
              optionPath = path.posix.join(node.buildRelativePath, option)
            }
            optionsString += ` -L '${optionPath}'`
          }
        } else {
          optionsString += ' ' + options.join(' ')
        }
      }
    }
    return optionsString.trim()
  }

  /**
   * @summary Collect all simple options in an array.
   * @param {DMNode} node Source tree node.
   * @returns {String[]} Array of strings with options.
   *
   * @description
   * Simple options are those that do not need multiple words.
   */
  simpleOptionsArray (node) {
    let optionsArray = []
    for (const suffix of this.configurationSuffixes) {
      if (['Libraries', 'LinkerScripts', 'LibraryFolders'].includes(suffix)) {
        continue
      }
      const toolOptions = node.options.tools[node.tool.name]
      const options = toolOptions.propertyWithAddAndRemove_(suffix)
      if (options.length) {
        optionsArray = [...optionsArray, ...options]
      }
    }
    return optionsArray
  }
}

class ToolArchiver extends Tool {
  constructor (name, toolchain, fromTool = undefined) {
    super(name, toolchain, fromTool)
  }

  fullCommand (node) {
    let fullCommandString = this.fullCommandName

    // TODO: update, not yet tested
    fullCommandString += ' TODO'

    if (this.options) {
      fullCommandString += ` ${this.options}`
    }
    const options = node.options[this.name]
    if (options) {
      fullCommandString += ` ${options}`
    }
    for (const obj of node.objs) {
      fullCommandString += ` '${obj}'`
    }
    if (this.outputFlag) {
      fullCommandString += ` ${this.outputFlag}`
    }
    if (this.output) {
      fullCommandString += ` ${this.output}`
    }

    let macroValues
    macroValues = {
      'artefact.fullName': node.targetArtefact.fullName
    }
    fullCommandString =
      Macros.substitute(fullCommandString, macroValues)

    return fullCommandString
  }
}

// ============================================================================

class Toolchain {
  /**
   * @summary Create new toolchain objects.
   *
   * @param {String} name Toolchain name.
   * @param {Toolchain} fromToolchain Optional reference to object to copy from.
   *
   * @description
   * Perform a deep clone of the original, taking care of circular references.
   */
  constructor (name, fromToolchain = undefined) {
    assert(Util.isString(name), 'There must be a tool name')
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
          this.addTool(toolName, toolValue)
        }
      }
      if (this.hasOwnProperty('fileExtensions')) {
        for (const fileExtension of Object.values(this.fileExtensions)) {
          // Redo the circular references to parent tools.
          fileExtension.tool = this.tools[fileExtension.toolName]
        }
      }
      this.parent = fromToolchain
    }

    // Store the toolchain name as a property.
    this.name = name
  }

  addTool (name, from) {
    const type = from.type
    let newTool
    if (type === 'compiler' || type === 'assembler') {
      newTool = new ToolCompiler(name, this, from)
    } else if (type === 'linker') {
      newTool = new ToolLinker(name, this, from)
    } else if (type === 'archiver') {
      newTool = new ToolArchiver(name, this, from)
    } else {
      throw new CliErrorType(`Tool '${name}' has unsupported type '${type}'`)
    }
    this.tools[name] = newTool
    return newTool
  }

  propertyWithParent (name) {
    const cachedName = `${name}WithParentCached_`
    if (!this.hasOwnProperty(cachedName)) {
      if (this.hasOwnProperty(name)) {
        this[cachedName] = this[name]
      } else if (this.parent) {
        this[cachedName] = this.parent.propertyWithParent(name)
      } else {
        this[cachedName] = undefined
      }
    }
    return this[cachedName]
  }

  /**
   * @summary Check if this toolchain is an instance of another.
   * @param {Toolchain} toolchain The possible parent toolchain.
   * @returns {boolean} true If an instance of the given toolchain.
   *
   * @description
   * Tries to match the name of the given toolchain with the name of the
   * current toolchain or recursively with the names of the parent
   * toolchains.
   */
  instanceOf (toolchain) {
    if (this.name === toolchain.name) {
      return true
    }
    if (this.parent) {
      return this.parent.instanceOf(toolchain)
    }
    return false
  }

  extensionForFile (fileName) {
    const log = this.log

    // Split path into parts, to extract extension.
    const parsed = path.parse(fileName)
    if (parsed.ext.length < 2 || !parsed.ext.startsWith('.')) {
      log.trace(`ignore '${fileName}', no extension`)
      return
    }

    const ext = parsed.ext.substring(1)
    assert(ext, 'Mandatory extension')
    const fileExtension = this.fileExtensions[ext]
    if (!fileExtension) {
      log.trace(`ignore '${fileName}', extension`)
      return
    }

    return fileExtension
  }

  get fullDescription () {
    if (!this.fullDescriptionCached_) {
      this.fullDescriptionCached_ =
          this.propertyWithParent('descriptionPrefix') + ' ' +
          this.propertyWithParent('description')
    }
    return this.fullDescriptionCached_
  }
  toString () {
    return this.name
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.Toolchain = Toolchain
module.exports.Tool = Tool
module.exports.ToolLinker = ToolLinker
module.exports.ToolCompiler = ToolCompiler

// In ES6, it would be:
// export class Toolchain { ... }
// ...
// import { Toolchain } from '../toolchain.js'

// ----------------------------------------------------------------------------
