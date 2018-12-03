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

/**
 * The Xmake main module.
 *
 * It is re-exported publicly by `index.js`.
 *
 * To import classes from this module into Node.js applications, use:
 *
 * ```javascript
 * const Xmake = require('xmake').Xmake
 * ```
 */

// ----------------------------------------------------------------------------

const path = require('path')

// ES6: `import { CliApplication, CliOptions } from 'cli-start-options'
const CliApplication = require('@ilg/cli-start-options').CliApplication
const CliOptions = require('@ilg/cli-start-options').CliOptions

// ============================================================================

// export
class Xmake extends CliApplication {
  // --------------------------------------------------------------------------

  /**
   * @summary Initialise the application class object.
   *
   * @returns {undefined} Nothing.
   *
   * @description
   * Initialise the options manager with application
   * specific commands and common options.
   *
   * @override
   */
  static doInitialise () {
    const Self = this

    // ------------------------------------------------------------------------
    // Mandatory, must be set here, not in the library, since it takes
    // the shortcut of using `__dirname` of the main file.
    Self.rootPath = path.dirname(__dirname)

    // Enable -i|--interactive
    Self.hasInteractiveMode = true

    // ------------------------------------------------------------------------
    // Initialise the tree of known commands.
    // Paths should be relative to the package root.
    CliOptions.addCommand(['build', 'b', 'bild'], 'lib/xmake/build.js')
    CliOptions.addCommand(['test', 't', 'tst'], 'lib/xmake/test.js')
    CliOptions.addCommand(['import'], 'lib/xmake/import.js')
    CliOptions.addCommand(['export'], 'lib/xmake/export.js')

    // The common options were already initialised by the caller,
    // and are ok, no need to redefine them.
  }

  // --------------------------------------------------------------------------

  // Constructor: use parent definition.
  // main(): use parent definition
  // help(): use parent definition.

  // (isn't object oriented code reuse great?)
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Xmake class is added as a property to this object.

module.exports.Xmake = Xmake
module.exports.Main = Xmake

// In ES6, it would be:
// export class Xmake { ... }
// ...
// import { Xmake } from 'xmake.js'

// ----------------------------------------------------------------------------
