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
 * The Eclipse CDT importer.
 */

// ----------------------------------------------------------------------------

// const assert = require('assert')
const fs = require('fs')
const path = require('path')
const xml2js = require('xml2js')
const util = require('util')

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
const CliError = require('@ilg/cli-start-options').CliError

const CdtTree = require('../utils/cdt-tree.js').CdtTree

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
Promisifier.promisifyInPlace(fs, 'readFile')

// ============================================================================

class EclipseCdtImporter {
  /**
   * @summary Constructor, to set the context.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    this.context = context
    this.log = context.log
    const log = this.log
    log.trace(`${this.constructor.name}.construct()`)
  }

  async import () {
    const log = this.log
    const context = this.context
    // const config = context.config

    log.info()
    this.eclipseProject = await this.parseProject()
    log.info(`Eclipse project '${this.eclipseProject.name[0]}'`)

    log.info()
    this.eclipseCproject = await this.parseCproject()

    const cconfigurations = []
    this.eclipseCproject.storageModule.forEach((topStorageModule) => {
      if (topStorageModule.moduleId === 'org.eclipse.cdt.core.settings') {
        topStorageModule.cconfiguration.forEach((cconfiguration) => {
          cconfigurations.push(cconfiguration)
        })
      }
    })

    cconfigurations.forEach((cconfiguration) => {
      cconfiguration.storageModule.forEach((storageModule) => {
        if (storageModule.moduleId === 'cdtBuildSystem') {
          cconfiguration.configuration = storageModule.configuration[0]
        }
      })
    })

    const tree = new CdtTree(context)
    log.info('CDT configurations:')

    cconfigurations.forEach((cconfiguration) => {
      const configuration = cconfiguration.configuration
      const cname = configuration.name
      log.info(`- '${cname}'`)

      if (configuration.sourceEntries) {
        configuration.sourceEntries[0].entry.forEach((entry) => {
          if (entry.excluding) {
            log.verbose(`  + '${entry.name}' (${entry.excluding})`)
          } else {
            log.verbose(`  + '${entry.name}'`)
          }
        })
      }
      if (configuration.folderInfo) {
        configuration.folderInfo.forEach((folderInfo) => {
          log.verbose(`  - '${folderInfo.resourcePath}'`)
          if (folderInfo.resourcePath.length > 0) {
            tree.addFolder(folderInfo.resourcePath)
          }
        })
      }
      if (configuration.fileInfo) {
        configuration.fileInfo.forEach((fileInfo) => {
          log.verbose(`  - '${fileInfo.resourcePath}'`)

          if (fileInfo.resourcePath.length > 0) {
            tree.addFile(fileInfo.resourcePath)
          }
        })
      }
    })

    // log.verbose(util.inspect(tree, false, null))

    // TODO: build tree
    return tree
  }

  async parseProject () {
    const log = this.log
    const context = this.context
    const config = context.config

    const projectPath = path.resolve(config.cwd, '.project')
    log.verbose('Reading .project...')
    let projectData
    try {
      projectData = await fs.readFilePromise(projectPath)
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.INPUT)
    }
    let parser = new xml2js.Parser()
    Promisifier.promisifyInPlace(parser, 'parseString')

    const projectJson = await parser.parseStringPromise(projectData)

    if (!projectJson.projectDescription) {
      throw new CliError(`The Eclipse .project file might be damaged,` +
        ` missing mandatory <projectDescription> element.`,
        CliExitCodes.ERROR.APPLICATION)
    }

    const eclipseProject =
      this.processXmlElement(projectJson.projectDescription)

    eclipseProject.managedBuildNature = false
    eclipseProject.cnature = false
    eclipseProject.ccnature = false

    if (eclipseProject.natures) {
      const arr = eclipseProject.natures[0].nature
      arr.forEach((nature) => {
        switch (nature) {
          case 'org.eclipse.cdt.managedbuilder.core.managedBuildNature':
            eclipseProject.managedBuildNature = true
            break

          case 'org.eclipse.cdt.core.ccnature':
            eclipseProject.ccnature = true
            break

          case 'org.eclipse.cdt.core.cnature':
            eclipseProject.cnature = true
            break

          default:
          // Ignore the rest.
        }
      })
    }

    if (!eclipseProject.cnature || !eclipseProject.managedBuildNature) {
      throw new CliError(`The Eclipse project '${eclipseProject.name}'` +
        ` is not a managed C project.`,
        CliExitCodes.ERROR.APPLICATION)
    }

    log.trace(util.inspect(eclipseProject, false, null))
    return eclipseProject
  }

  async parseCproject () {
    const log = this.log
    const context = this.context
    const config = context.config

    const cprojectPath = path.resolve(config.cwd, '.cproject')
    log.verbose('Reading .cproject...')
    let cprojectData
    try {
      cprojectData = await fs.readFilePromise(cprojectPath)
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.INPUT)
    }
    let parser = new xml2js.Parser()
    Promisifier.promisifyInPlace(parser, 'parseString')

    const cprojectJson = await parser.parseStringPromise(cprojectData)

    // Raw conversion done; extract useful information.
    let eclipseCproject = {}

    if (!cprojectJson.cproject) {
      throw new CliError(`The CDT .cproject file might be damaged,` +
        ` missing mandatory <cproject> element.`,
        CliExitCodes.ERROR.APPLICATION)
    }

    eclipseCproject = this.processXmlElement(cprojectJson.cproject)

    log.trace(util.inspect(eclipseCproject, false, null))
    return eclipseCproject
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
            default:
              obj[attr] = element.$[attr]
          }
        }
      }

      for (const elem in element) {
        switch (elem) {
          case '$':
            break

          default:
            if (obj[elem]) {
              throw new CliError(`Element <${elem}>` +
                ` already contributed as attribute.`,
                CliExitCodes.ERROR.APPLICATION)
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
// The EclipseCdtImporter class is added as a property of this object.
module.exports.EclipseCdtImporter = EclipseCdtImporter

// In ES6, it would be:
// export class EclipseCdtImporter { ... }
// ...
// import { EclipseCdtImporter } from './importers/eclipse-cdt.js'

// ----------------------------------------------------------------------------
