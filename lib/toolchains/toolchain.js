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

// ----------------------------------------------------------------------------

// ============================================================================

class Tool {
  constructor (toolchain, commandName, commandDescription) {
    this.toolchain = toolchain
    this.commandName = commandName
    this.commandDescription = commandDescription

    // Placeholders; defined by the actual toolchain.
    this.options = undefined // string
    this.deps = undefined // string
    this.outputFlag = undefined // string
    this.output = undefined // string
    this.inputs = undefined // string
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
  constructor () {
    this.name = 'base'
    this.commandPrefix = ''
    this.commandSuffix = ''
    this.descriptionPrefix = ''

    this.objectExtension = undefined
    this.makeObjectsVariable = undefined

    this.tools = {}
    this.tools.c = new Tool(this, 'cc', 'C Compiler')
    this.tools.cpp = new Tool(this, 'c++', 'C++ Compiler')
    this.tools.as = new Tool(this, 'as', 'Assembler')
    this.tools.cLinker = new Tool(this, 'ld', 'C Linker')
    this.tools.cppLinker = new Tool(this, 'ld', 'C++ Linker')
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Test class is added as a property of this object.
module.exports.Toolchain = Toolchain

// In ES6, it would be:
// export class Toolchain { ... }
// ...
// import { Toolchain } from '../toolchains/toolchain.js'

// ----------------------------------------------------------------------------
