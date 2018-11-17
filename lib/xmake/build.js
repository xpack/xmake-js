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
 * The `xmake build <options> ...` command implementation.
 */

// ----------------------------------------------------------------------------

// const assert = require('assert')
const path = require('path')

const CliCommand = require('@ilg/cli-start-options').CliCommand
const CliOptions = require('@ilg/cli-start-options').CliOptions
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
const CliHelp = require('@ilg/cli-start-options').CliHelp

const ToolchainCache = require('../../lib/utils/toolchain-cache.js')
  .ToolchainCache

const XmakeParser = require('../../lib/utils/xmake-parser.js').XmakeParser
const XmakeBuilder = require('../../lib/utils/xmake-builder.js').XmakeBuilder
const DiscovererCache = require('../../lib/utils/discoverer-cache.js')
  .DiscovererCache
const JsonCache = require('../../lib/utils/json-cache.js').JsonCache
const Defaults = require('../../lib/utils/defaults.js').Defaults

// ============================================================================

class Build extends CliCommand {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set help definitions.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    super(context)

    // Title displayed with the help message.
    this.title = 'xmake - build project configuration(s)'
    this.optionGroups = [
      {
        title: 'Build options',
        postOptions: '[-- <build args>]', // Extra arguments.
        optionDefs: [
          {
            options: ['-c', '--config'],
            param: 'name',
            msg: 'Configuration name',
            init: (context) => {
              context.config.configNames = []
            },
            action: (context, val) => {
              context.config.configNames.push(val.toLowerCase())
              context.config.hasFilters = true
            },
            isOptional: true,
            isMultiple: true
          },
          {
            options: ['-g', '--generator'],
            param: 'name',
            msg: 'Generator, default make',
            init: (context) => {
              context.config.generator = undefined
            },
            action: (context, val) => {
              context.config.generator = val.toLowerCase()
            },
            isOptional: true
          },
          {
            options: ['-f', '--build-folder'],
            param: 'path',
            msg: `Build folder, default ${Defaults.buildFolderName}`,
            init: (context) => {
              context.config.buildFolderPath = Defaults.buildFolderName
            },
            action: (context, val) => {
              context.config.buildFolderPath = val
            },
            isOptional: true
          },
          {
            options: ['-n', '--dry-run'],
            msg: 'Prepare, but do not run the build',
            init: (context) => {
              context.config.isDryRun = false
            },
            action: (context) => {
              context.config.isDryRun = true
            },
            isOptional: true
          }
        ]
      }
    ]
  }

  doOutputHelpArgsDetails (more) {
    const log = this.context.log
    if (!more.isFirstPass) {
      log.always('where:')
      log.always(`${CliHelp.padRight('  <build args>...', more.width)} ` +
        `Extra arguments for the builder (optional, multiple)`)
    }
  }

  /**
   * @summary Execute the `build` command.
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
    const otherArgs = CliOptions.filterOtherArguments(args)
    // this.builderArgs = CliOptions.filterOwnArguments(otherArgs)

    const toolchainCache = new ToolchainCache({
      log
    })

    const internalToolchainsPath = path.resolve(context.rootPath, 'assets',
      'toolchains.json')
    // Parse the internal toolchains defs.
    await toolchainCache.parse(internalToolchainsPath)

    log.verbose()

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

    const xmakeParser = new XmakeParser({
      log,
      cwd: config.cwd,
      toolchainCache
    })

    const buildContext = await xmakeParser.parse(config.cwd, {
      purpose: `project`,
      discovered,
      projectName
    })

    if (Object.values(buildContext.buildConfigurations).length === 0) {
      throw new Error(`Missing buildConfigurations in 'xmake.json' file.`)
    }

    buildContext.log = log
    buildContext.isVerbose = log.isVerbose()
    buildContext.cwd = config.cwd
    buildContext.config = config
    buildContext.builderArgs = otherArgs
    buildContext.xmakeParser = xmakeParser

    const builder = new XmakeBuilder(buildContext)

    // If no config name given, default to the first one.
    if (config.configNames.length === 0) {
      config.configNames.push(
        Object.keys(buildContext.buildConfigurations)[0])
    }
    for (const configName of config.configNames) {
      const buildConfiguration = buildContext.buildConfigurations[configName]
      if (!buildConfiguration) {
        throw new Error(`Missing buildConfiguration ${configName}` +
          ` in 'xmake.json' file.`)
      }
      xmakeParser.prepareConfiguration(buildConfiguration)
      await builder.build(buildConfiguration)
    }

    this.outputDoneDuration()
    return CliExitCodes.SUCCESS
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Build class is added as a property of this object.
module.exports.Build = Build

// In ES6, it would be:
// export class Build { ... }
// ...
// import { Build } from 'build.js'

// ----------------------------------------------------------------------------
