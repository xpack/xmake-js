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
 * The `xmake export <options> ...` command implementation.
 */

// ----------------------------------------------------------------------------

// const fs = require('fs')
// const xml2js = require('xml2js')
const path = require('path')

// const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
const CliCommand = require('@ilg/cli-start-options').CliCommand
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
// const CliError = require('@ilg/cli-start-options').CliError

const ToolchainCache = require('../../lib/utils/toolchain-cache.js')
  .ToolchainCache
const XmakeParser = require('../../lib/utils/xmake-parser.js').XmakeParser
const JsonCache = require('../../lib/utils/json-cache.js').JsonCache
const DiscovererCache = require('../../lib/utils/discoverer-cache.js')
  .DiscovererCache

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
// Promisifier.promisifyInPlace(fs, 'readFile')
// Promisifier.promisifyInPlace(fs, 'writeFile')
// Promisifier.promisifyInPlace(fs, 'stat')
// Promisifier.promisifyInPlace(fs, 'mkdir')

// ============================================================================

class Export extends CliCommand {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set help definitions.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    super(context)

    // Title displayed with the help message.
    this.title = 'Export build configurations'
    this.optionGroups = [
      {
        title: 'Export options',
        optionDefs: [
          {
            options: ['--format'],
            param: 'name',
            msg: 'Project format',
            init: (context) => {
              context.config.exportFormat = undefined
            },
            action: (context, val) => {
              context.config.exportFormat = val.toLowerCase()
            },
            isMandatory: true,
            values: ['gme-cross-arm', 'gme-cross-riscv']
          }
        ]
      }
    ]
  }

  /**
   * @summary Execute the `export` command.
   *
   * @param {string[]} args Command line arguments.
   * @returns {number} Return code.
   *
   * @override
   */
  async doRun (args) {
    const log = this.log
    log.trace(`${this.constructor.name}.doRun()`)
    const context = this.context
    const config = context.config

    log.info(this.title)

    log.verbose()

    const toolchainCache = await ToolchainCache.parseAssets({
      log,
      rootPath: context.rootPath
    })

    const xmakeParser = new XmakeParser({
      log,
      cwd: config.cwd,
      toolchainCache
    })
    context.xmakeParser = xmakeParser

    const packageAbsolutePath = path.join(config.cwd, 'package.json')
    let projectName
    try {
      const packageJson = await JsonCache.parse(packageAbsolutePath)
      projectName = packageJson.name
    } catch (ex) {
      projectName = path.basename(config.cwd)
    }

    const discovered = await DiscovererCache.discoverPacks(config.cwd, {
      log
    })

    const buildContext = await xmakeParser.parse({
      folderAbsolutePath: config.cwd,
      purpose: `project`,
      discovered,
      projectName
    })

    if (Object.values(buildContext.buildConfigurations).length === 0) {
      throw new Error(`Missing buildConfigurations in 'xmake.json' file.`)
    }

    if (log.isVerbose()) {
      log.verbose()

      log.verbose('Configurations:')
      for (const [name, configuration] of
        Object.entries(buildContext.buildConfigurations)) {
        let xtra = configuration.language
        xtra += ', ' + configuration.toolchain.name
        if (configuration.targetPlatform) {
          xtra += ', ' + configuration.targetPlatform.name
        }
        log.verbose(`- ${name} (${xtra})`)
      }
    }

    let exporter
    if (['gme-cross-arm'].includes(config.exportFormat)) {
      const EclipseCdtExporter = require('../exporters/eclipse-cdt.js')
        .EclipseCdtExporter
      exporter = new EclipseCdtExporter(context)
    } else {
      throw new Error(`Export format '${config.exportFormat}' ` +
        `not yet implemented.`)
    }
    // Plan: parse xmake.json, identify configurations, prepare them, export.
    // Don't forget that in Eclipse there is no extra build folder.
    await exporter.export(buildContext)

    this.outputDoneDuration()
    return CliExitCodes.SUCCESS
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Import class is added as a property of this object.
module.exports.Export = Export

// In ES6, it would be:
// export class Export { ... }
// ...
// import { Export } from 'export.js'

// ----------------------------------------------------------------------------
