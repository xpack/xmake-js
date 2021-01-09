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
 * The `xmake import <options> ...` command implementation.
 */

// ----------------------------------------------------------------------------

const CliCommand = require('@ilg/cli-start-options').CliCommand
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
// const CliError = require('@ilg/cli-start-options').CliError
const EclipseCdtImporter =
  require('../importers/eclipse-cdt.js').EclipseCdtImporter

// ============================================================================

class Import extends CliCommand {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set help definitions.
   *
   * @param {Object} args The generic arguments object.
   */
  constructor (args) {
    super(args)

    // Title displayed with the help message.
    this.title = 'Import build configurations'
    this.optionGroups = [
      {
        title: 'Import options',
        optionDefs: [
          {
            options: ['--format'],
            param: 'name',
            msg: 'Project format',
            init: (context) => {
              context.config.inputFormat = 'cdt'
            },
            action: (context, val) => {
              context.config.inputFormat = val.toLowerCase()
            },
            isOptional: true,
            values: ['cdt']
          }
        ]
      }
    ]
  }

  /**
   * @summary Execute the `import` command.
   *
   * @param {string[]} argv Command line arguments.
   * @returns {number} Return code.
   *
   * @override
   */
  async doRun (argv) {
    const log = this.log
    log.trace(`${this.constructor.name}.doRun()`)
    const context = this.context
    const config = context.config

    log.info(this.title)

    let importer
    if (config.inputFormat === 'cdt') {
      importer = new EclipseCdtImporter(context)
    }
    const tree = await importer.import()
    if (tree) {
      // Serialise xmake.json file(s).
    }

    this.outputDoneDuration()
    return CliExitCodes.SUCCESS
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Import class is added as a property of this object.
module.exports.Import = Import

// In ES6, it would be:
// export class Import { ... }
// ...
// import { Import } from 'import.js'

// ----------------------------------------------------------------------------
