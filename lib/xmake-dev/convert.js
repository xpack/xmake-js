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
 * The `xmake-dev convert <options> ...` command implementation.
 */

// ----------------------------------------------------------------------------

const fs = require('fs')
const xml2js = require('xml2js')
const path = require('path')
// const mkdirp = require('async-mkdirp')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

const CliCommand = require('@ilg/cli-start-options').CliCommand
const CliError = require('@ilg/cli-start-options').CliError
const CliErrorInput = require('@ilg/cli-start-options').CliErrorInput
const CliErrorOutput = require('@ilg/cli-start-options').CliErrorOutput
const CliErrorType = require('@ilg/cli-start-options').CliErrorType

const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readFile')
Promisifier.promisifyInPlace(fs, 'writeFile')
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'mkdir')

// ============================================================================

class Convert extends CliCommand {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set help definitions.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    super(context)

    // Title displayed with the help message.
    this.title = 'Convert configurations'
    this.optionGroups = [
      {
        title: 'Convert options',
        optionDefs: [
          {
            options: ['--file'],
            action: (context, val) => {
              context.config.inputPath = val
            },
            init: (context) => {
              context.config.inputPath = undefined
            },
            msg: 'Input file',
            param: 'file',
            isMandatory: true
          },
          {
            options: ['--output'],
            action: (context, val) => {
              context.config.outputPath = val
            },
            init: (context) => {
              context.config.outputPath = undefined
            },
            msg: 'Output file',
            param: 'file',
            isMandatory: true
          },
          {
            options: ['--format'],
            param: 'name',
            msg: 'Input format',
            init: (context) => {
              context.config.inputFormat = 'cdt-toolchain'
            },
            action: (context, val) => {
              context.config.inputFormat = val.toLowerCase()
            },
            isOptional: true,
            values: ['cdt-toolchain']
          }
        ]
      }
    ]
  }

  /**
   * @summary Execute the `convert` command.
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

    const inputAbsolutePath = this.makePathAbsolute(config.inputPath)
    log.info(`Reading '${inputAbsolutePath}'...`)
    let inputData
    try {
      inputData = await fs.readFilePromise(inputAbsolutePath, 'utf8')
    } catch (err) {
      throw new CliErrorInput(err.message)
    }

    this.inputFileName = path.basename(config.inputPath)

    log.info('Parsing XML...')

    const parser = new xml2js.Parser()
    parser.parseStringPromise = Promisifier.promisify(parser.parseString)

    const parsedInput = await parser.parseStringPromise(
      inputData.toString())

    log.info('Converting to JSON...')

    const output = this.createRoot(parsedInput)
    this.addGenerator(output)

    const jsonOutput = JSON.stringify(output, null, '\t')

    const outputAbsolutePath = this.makePathAbsolute(config.outputPath)
    const folderPath = path.dirname(outputAbsolutePath)

    log.info(`Writing '${outputAbsolutePath}'...`)
    try {
      if (!await fs.statPromise(folderPath)) {
        await fs.mkdirPromise(folderPath)
      }
      await fs.writeFilePromise(outputAbsolutePath, jsonOutput, 'utf8')
    } catch (err) {
      throw new CliErrorOutput(err.message)
    }

    this.outputDoneDuration()
    return CliExitCodes.SUCCESS
  }

  createRoot (input) {
    if (!(input.plugin || input.plugin.extension)) {
      throw new CliError(`The Eclipse plugin.xml file might be damaged,` +
        ` missing mandatory <plugin><>extension element.`)
    }
    const obj = {}

    obj.buildDefinitions = []
    input.plugin.extension.forEach((extension) => {
      if (extension.$.point ===
        'org.eclipse.cdt.managedbuilder.core.buildDefinitions') {
        obj.buildDefinitions.push(this.processXmlElement(extension))
        // obj.buildDefinitions.push(extension)
      }
    })
    return obj
  }

  processXmlElement (element) {
    // const log = this.log

    switch (typeof element) {
      case 'string':
      case 'boolean':
      case 'number':
        return element
    }
    if (Array.isArray(element)) {
      const arr = []
      element.forEach((elem) => {
        arr.push(this.processXmlElement(elem))
      })
      return arr
    } else {
      const obj = {}

      if (element.$) {
        for (const attr in element.$) {
          switch (attr) {
            case 'tip':
              break

            default:
              obj[attr] = element.$[attr]
          }
        }
      }

      for (const elem in element) {
        switch (elem) {
          case '$':
            break

          case 'enablement':
            break

          case 'managedBuildRevision':
            if (element[elem].length > 1) {
              throw new CliErrorType(`Element <${elem}>` +
                ` is actually an array.`)
            }
            if (obj[elem]) {
              throw new CliError(`Element <${elem}>` +
                ` already contributed as attribute.`)
            } else {
              obj[elem] = this.processXmlElement(element[elem][0])
            }
            break

          default:
            if (obj[elem]) {
              throw new CliError(`Element <${elem}>` +
                ` already contributed as attribute.`)
            } else {
              obj[elem] = this.processXmlElement(element[elem])
            }
        }
      }

      return obj
    }
  }
  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Convert class is added as a property of this object.
module.exports.Convert = Convert

// In ES6, it would be:
// export class Convert { ... }
// ...
// import { Convert } from 'convert.js'

// ----------------------------------------------------------------------------
