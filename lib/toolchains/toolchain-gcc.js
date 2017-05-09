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

const Toolchain = require('./toolchains/toolchain.js').Toolchain

// ============================================================================

class ToolchainGcc extends Toolchain {
  constructor () {
    super()

    this.name = 'gcc'
    this.commandPrefix = ''
    this.commandSuffix = ''
    this.descriptionPrefix = 'GNU'

    this.objectExtension = 'o'
    this.makeObjectsVariable = 'OBJS'

    this.tools.c.commandName = 'gcc'
    this.tools.c.options = '-c'
    this.tools.c.deps = '-MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)"'
    this.tools.c.outputFlag = '-o'
    this.tools.c.output = '"$@"'
    this.tools.c.inputs = '"$<"'

    this.tools.cpp.commandName = 'g++'
    this.tools.cpp.options = '-c'
    this.tools.cpp.deps = '-MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)"'
    this.tools.cpp.outputFlag = '-o'
    this.tools.cpp.output = '"$@"'
    this.tools.cpp.inputs = '"$<"'

    this.tools.as.commandName = 'gcc'
    this.tools.as.options = '-x assembler-with-cpp -c'
    this.tools.as.deps = '-MMD -MP -MF"$(@:%.o=%.d)" -MT"$(@)"'
    this.tools.as.outputFlag = '-o'
    this.tools.as.output = '"$@"'
    this.tools.as.inputs = '"$<"'

    this.tools.cLinker.commandName = 'gcc'
    this.tools.cLinker.outputFlag = '-o'
    this.tools.cLinker.output = '"$@"'

    this.tools.cppLinker.commandName = 'g++'
    this.tools.cppLinker.outputFlag = '-o'
    this.tools.cppLinker.output = '"$@"'
  }
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Test class is added as a property of this object.
module.exports.ToolchainGcc = ToolchainGcc

// In ES6, it would be:
// export class Toolchain { ... }
// ...
// import { ToolchainGcc } from '../toolchains/toolchain-gcc.js'

// ----------------------------------------------------------------------------
