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
 * The mEclipse CDT importer.
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
    log.info(`Eclipse project '${this.eclipseProject.name}'`)

    log.info()
    this.eclipseCproject = await this.parseCproject()

    const tree = new CdtTree(context)
    log.info('CDT configurations:')
    this.eclipseCproject.cconfiguration.forEach((cconfiguration) => {
      const configuration = cconfiguration.configuration
      const cname = configuration.name
      log.info(`- '${cname}'`)

      if (configuration.sourceEntries) {
        configuration.sourceEntries.forEach((sourceEntry) => {
          if (sourceEntry.excluding) {
            log.verbose(`  + '${sourceEntry.name}' (${sourceEntry.excluding})`)
          } else {
            log.verbose(`  + '${sourceEntry.name}'`)
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

    const eclipseProject = {}
    eclipseProject.managedBuildNature = false
    eclipseProject.cnature = false

    for (const elem in projectJson.projectDescription) {
      switch (elem) {
        case 'name':
        case 'comment':
          if (projectJson.projectDescription[elem].length > 1) {
            log.warn(`projectDescription[elem].length > 1 ` +
              `(${projectJson.projectDescription[elem].length})`)
          }
          eclipseProject[elem] = projectJson.projectDescription[elem][0]
          break

        case 'natures':
          if (projectJson.projectDescription.natures[0].nature) {
            eclipseProject.natures = []
            projectJson.projectDescription.natures[0].nature.forEach((val) => {
              eclipseProject.natures.push(val)
              log.trace(`nature: ${val}`)

              switch (val) {
                case 'org.eclipse.cdt.managedbuilder.core.managedBuildNature':
                  eclipseProject.managedBuildNature = true
                  break

                case 'org.eclipse.cdt.core.cnature':
                  eclipseProject.cnature = true
                  break

                case 'org.eclipse.cdt.core.ccnature':
                  eclipseProject.ccnature = true
                  break

                default:
                // Ignore all other
              }
            })
          }
          break

        case 'projects':
        case 'buildSpec':
          // Ignored for now.
          break

        default:
          log.warn(`<projectDescription> element '${elem}' ignored`)
      }
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
    const eclipseCproject = {}

    if (!cprojectJson.cproject) {
      throw new CliError(`The CDT .cproject file might be damaged,` +
        ` missing mandatory <cproject> element.`,
        CliExitCodes.ERROR.APPLICATION)
    }

    for (let elem in cprojectJson.cproject) {
      switch (elem) {
        case 'storageModule':
          cprojectJson.cproject.storageModule.forEach((storageModule) => {
            const o = this.parseTopStorageModule(storageModule)
            for (const prop in o) {
              if (eclipseCproject[prop]) {
                throw new CliError(`property '${prop}' redefined`,
                  CliExitCodes.ERROR.APPLICATION)
              } else {
                eclipseCproject[prop] = o[prop]
              }
            }
          })
          break

        case '$':
          break

        default:
          log.warn(`<cproject> element '${elem}' ignored`)
      }
    }

    log.trace(util.inspect(eclipseCproject, false, null))
    return eclipseCproject
  }

  parseTopStorageModule (storageModule) {
    const log = this.log
    const obj = {}

    for (const attr in storageModule.$) {
      switch (attr) {
        case 'moduleId':
          switch (storageModule.$.moduleId) {
            case 'org.eclipse.cdt.core.settings':
              if (storageModule.cconfiguration) {
                obj.cconfiguration = []
                storageModule.cconfiguration.forEach((cconfiguration) => {
                  obj.cconfiguration.push(
                    this.parseCconfiguration(cconfiguration))
                })
              }
              break

            case 'cdtBuildSystem':
              // If necessary, project.id, project.projectType.
              break

            case 'org.eclipse.cdt.core.LanguageSettingsProviders':
            case 'refreshScope':
            case 'scannerConfiguration':
            case 'org.eclipse.cdt.make.core.buildtargets':
            case 'org.eclipse.cdt.internal.ui.text.commentOwnerProjectMappings':
              // Intentionally ignored.
              break

            default:
              log.warn(`storageModule '${storageModule.$.moduleId}' ignored`)
          }
          break

        case 'version':
        case 'versionNumber':
          break

        default:
          log.warn(`<storageModule> attribute '${attr}' ignored`)
      }
    }

    return obj
  }

  parseCconfiguration (cconfiguration) {
    const log = this.log
    const cc = {}

    for (const elem in cconfiguration) {
      switch (elem) {
        case 'storageModule':
          cconfiguration.storageModule.forEach((storageModule) => {
            switch (storageModule.$.moduleId) {
              case `cdtBuildSystem`:
                if (storageModule.configuration) {
                  cc.configuration =
                    this.parseConfiguration(storageModule.configuration[0])
                }
                break

              case 'org.eclipse.cdt.core.settings':
                // TODO: get externalSettings
                break

              case 'ilg.gnuarmeclipse.managedbuild.packs':
                // TODO: parse packs options.
                break

              case 'org.eclipse.cdt.core.externalSettings':
                // Intentionally ignored.
                break

              default:
                log.warn(`<cconfiguration><storageModule moduleId=` +
                  `'${storageModule.$.moduleId}'> ignored`)
            }
          })
          break

        case '$':
          break

        default:
          log.warn(`<cconfiguration> element '${elem}' ignored`)
      }
    }

    return cc
  }

  parseConfiguration (configuration) {
    const log = this.log
    const obj = {}

    for (const attr in configuration.$) {
      switch (attr) {
        case 'name':
        case 'parent':
        case 'artifactName':
        case 'artifactExtension':
        case 'postannouncebuildStep':
        case 'postbuildStep':
        case 'preannouncebuildStep':
        case 'prebuildStep':
        case 'id':
          obj[attr] = configuration.$[attr]
          break

        case 'buildArtefactType':
          switch (configuration.$.buildArtefactType) {
            case 'org.eclipse.cdt.build.core.buildArtefactType.exe':
              obj.artefactType = 'executable'
              break

            case 'org.eclipse.cdt.build.core.buildArtefactType.staticLib':
              obj.artefactType = 'staticLib'
              break

            case 'org.eclipse.cdt.build.core.buildArtefactType.sharedLib':
              obj.artefactType = 'sharedLib'
              break

            default:
              log.warn('Unsupported artefact type ' +
                `'${configuration.$.buildArtefactType}'`)
          }
          break

        case 'cleanCommand':
        case 'description':
        case 'buildProperties':
        case 'errorParsers':
          // Ignored
          break

        default:
          log.warn(`<configuration> attribute '${attr}' ignored`)
      }
    }

    for (const elem in configuration) {
      switch (elem) {
        case 'folderInfo':
          obj.folderInfo = []
          configuration.folderInfo.forEach((folderInfo) => {
            obj.folderInfo.push(this.parseFolderInfo(folderInfo))
          })
          break

        case 'fileInfo':
          obj.fileInfo = []
          configuration.fileInfo.forEach((fileInfo) => {
            obj.fileInfo.push(this.parseFileInfo(fileInfo))
          })
          break

        case 'sourceEntries':
          if (configuration.sourceEntries.length > 1) {
            log.warn(`configuration.sourceEntries.length > 1 ` +
              `(${configuration.sourceEntries.length})`)
          }
          obj.sourceEntries =
            this.parseSourceEntry(configuration.sourceEntries[0])
          break

        case '$':
          break

        default:
          log.warn(`<configuration> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(c))
    return obj
  }

  parseSourceEntry (sourceEntries) {
    const log = this.log

    for (const attr in sourceEntries.$) {
      switch (attr) {
        default:
          log.warn(`<sourceEntries> attribute '${attr}' ignored`)
      }
    }

    const entries = []

    for (const elem in sourceEntries) {
      switch (elem) {
        case 'entry':
          sourceEntries.entry.forEach((entry) => {
            const o = {}
            for (const attr in entry.$) {
              switch (attr) {
                case 'flags':
                case 'kind':
                case 'name':
                case 'excluding':
                  o[attr] = entry.$[attr]
                  break

                default:
                  log.warn(`<entry> attribute '${attr}' ignored`)
              }
            }

            entries.push(o)
          })

          break

        default:
          log.warn(`<sourceEntries> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(entries))
    return entries
  }

  parseFolderInfo (folderInfo) {
    const log = this.log
    const obj = {}

    for (const attr in folderInfo.$) {
      switch (attr) {
        case 'name':
        case 'resourcePath':
        case 'id':
          obj[attr] = folderInfo.$[attr]
          break

        default:
          log.warn(`<folderInfo> attribute '${attr}' ignored`)
      }
    }

    for (const elem in folderInfo) {
      switch (elem) {
        case 'toolChain':
          if (folderInfo.toolChain.length > 1) {
            log.warn(`folderInfo.toolChain.length > 1 ` +
              `(${folderInfo.toolChain.length})`)
          }

          obj.toolChain = this.parseToolChain(folderInfo.toolChain[0])
          break

        case '$':
          break

        default:
          log.warn(`<folderInfo> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseFileInfo (fileInfo) {
    const log = this.log
    const obj = {}

    for (const attr in fileInfo.$) {
      switch (attr) {
        case 'name':
        case 'resourcePath':
        case 'toolsToInvoke':
        case 'id':
          obj[attr] = fileInfo.$[attr]
          break

        case 'rcbsApplicability':
          obj.rcbsApplicability = (fileInfo.$.rcbsApplicability === 'true')
          break

        default:
          log.warn(`<fileInfo> attribute '${attr}' ignored`)
      }
    }

    for (const elem in fileInfo) {
      switch (elem) {
        case 'tool':
          obj.tools = []
          fileInfo.tool.forEach((tool) => {
            obj.tools.push(this.parseTool(tool))
          })
          break

        case '$':
          break

        default:
          log.warn(`<fileInfo> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseToolChain (toolChain) {
    const log = this.log
    const obj = {}

    for (const attr in toolChain.$) {
      switch (attr) {
        case 'name':
        case 'superClass':
        case 'id':
          obj[attr] = toolChain.$[attr]
          break

        case 'unusedChildren':
          if (toolChain.$.unusedChildren) {
            log.warn(`<toolChain> attribute '${attr}' ignored`)
          }
          break

        case 'errorParsers':
          break

        default:
          log.warn(`<toolChain> attribute '${attr}' ignored`)
      }
    }

    for (const elem in toolChain) {
      switch (elem) {
        case 'builder':
          if (toolChain.builder.length > 1) {
            log.warn(`toolChain.builder.length > 1 ` +
              `(${toolChain.builder.length})`)
          }

          obj.builder = this.parseBuilder(toolChain.builder[0])
          break

        case 'targetPlatform':
          if (toolChain.targetPlatform.length > 1) {
            log.warn(`toolChain.targetPlatform.length > 1 ` +
              `(${toolChain.targetPlatform.length})`)
          }

          obj.targetPlatform =
            this.parseTargetPlatform(toolChain.targetPlatform[0])
          break

        case 'option':
          obj.option = []
          toolChain.option.forEach((option) => {
            obj.option.push(this.parseOption(option))
          })
          break

        case 'tool':
          obj.tools = []
          toolChain.tool.forEach((tool) => {
            obj.tools.push(this.parseTool(tool))
          })
          break

        case '$':
          break

        default:
          log.warn(`<toolChain> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseBuilder (builder) {
    const log = this.log
    const obj = {}

    for (const attr in builder.$) {
      switch (attr) {
        case 'name':
        case 'buildPath':
        case 'superClass':
        case 'id':
          obj[attr] = builder.$[attr]
          break

        case 'managedBuildOn':
          obj[attr] = (builder.$[attr] === 'true')
          break

        case 'errorParsers':
        case 'keepEnvironmentInBuildfile':
          break

        default:
          log.warn(`<builder> attribute '${attr}' ignored`)
      }
    }

    for (const elem in builder) {
      switch (elem) {
        case 'outputEntries':
        case '$':
          break

        default:
          log.warn(`<builder> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseTargetPlatform (targetPlatform) {
    const log = this.log
    const obj = {}

    for (const attr in targetPlatform.$) {
      switch (attr) {
        case 'name':
        case 'superClass':
        case 'archList':
        case 'osList':
        case 'id':
          obj[attr] = targetPlatform.$[attr]
          break

        case 'binaryParser':
        case 'isAbstract':
          break

        default:
          log.warn(`<targetPlatform> attribute '${attr}' ignored`)
      }
    }

    for (const elem in targetPlatform) {
      switch (elem) {
        case '$':
          break

        default:
          log.warn(`<targetPlatform> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseTool (tool) {
    const log = this.log
    const obj = {}

    for (const attr in tool.$) {
      switch (attr) {
        case 'name':
        case 'superClass':
        case 'command':
        case 'commandLinePattern':
        case 'outputPrefix':
        case 'id':
          obj[attr] = tool.$[attr]
          break

        case 'customBuildStep':
          obj[attr] = (tool.$[attr] === 'true')
          break

        case 'errorParsers':
          break

        default:
          log.warn(`<tool> attribute '${attr}' ignored`)
      }
    }

    for (const elem in tool) {
      switch (elem) {
        case 'option':
          obj.option = []
          tool.option.forEach((option) => {
            obj.option.push(this.parseOption(option))
          })
          break

        case 'inputType':
          if (tool.inputType.length > 1) {
            log.warn(`tool.inputType.length > 1 ` +
              `(${tool.inputType.length})`)
          }

          obj.inputType =
            this.parseInputType(tool.inputType[0])
          break

        case 'outputType':
          if (tool.outputType.length > 1) {
            log.warn(`tool.outputType.length > 1 ` +
              `(${tool.outputType.length})`)
          }

          obj.outputType =
            this.parseOutputType(tool.outputType[0])
          break

        case '$':
          break

        default:
          log.warn(`<tool> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseOption (option) {
    const log = this.log
    const obj = {}

    for (const attr in option.$) {
      switch (attr) {
        case 'name':
        case 'superClass':
        case 'value':
        case 'valueType':
        case 'defaultValue':
        case 'id':
          obj[attr] = option.$[attr]
          break

        case 'useByScannerDiscovery':
          break

        default:
          log.warn(`<option> attribute '${attr}' ignored`)
      }
    }

    for (const elem in option) {
      switch (elem) {
        case 'listOptionValue':
          obj.listOptionValue = []
          option.listOptionValue.forEach((listOptionValue) => {
            obj.listOptionValue.push(this.parseListOptionValue(listOptionValue))
          })
          break

        case '$':
          break

        default:
          log.warn(`<option> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseListOptionValue (listOptionValue) {
    const log = this.log
    const obj = {}

    for (const attr in listOptionValue.$) {
      switch (attr) {
        case 'builtIn':
          obj[attr] = (listOptionValue.$[attr] === 'true')
          break

        case 'value':
          obj[attr] = listOptionValue.$[attr]
          break

        default:
          log.warn(`<listOptionValue> attribute '${attr}' ignored`)
      }
    }

    for (const elem in listOptionValue) {
      switch (elem) {
        case '$':
          break

        default:
          log.warn(`<listOptionValue> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseInputType (inputType) {
    const log = this.log
    const obj = {}

    for (const attr in inputType.$) {
      switch (attr) {
        case 'superClass':
        case 'name':
        case 'id':
          obj[attr] = inputType.$[attr]
          break

        default:
          log.warn(`<inputType> attribute '${attr}' ignored`)
      }
    }

    for (const elem in inputType) {
      switch (elem) {
        case 'additionalInput':
          obj.additionalInput = []
          inputType.additionalInput.forEach((additionalInput) => {
            obj.additionalInput.push(this.parseAdditionalInput(additionalInput))
          })
          break

        case '$':
          break

        default:
          log.warn(`<inputType> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseOutputType (outputType) {
    const log = this.log
    const obj = {}

    for (const attr in outputType.$) {
      switch (attr) {
        case 'superClass':
        case 'outputPrefix':
        case 'name':
        case 'id':
          obj[attr] = outputType.$[attr]
          break

        default:
          log.warn(`<outputType> attribute '${attr}' ignored`)
      }
    }

    for (const elem in outputType) {
      switch (elem) {
        case '$':
          break

        default:
          log.warn(`<outputType> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
  }

  parseAdditionalInput (additionalInput) {
    const log = this.log
    const obj = {}

    for (const attr in additionalInput.$) {
      switch (attr) {
        case 'kind':
        case 'paths':
          obj[attr] = additionalInput.$[attr]
          break

        default:
          log.warn(`<additionalInput> attribute '${attr}' ignored`)
      }
    }

    for (const elem in additionalInput) {
      switch (elem) {
        case '$':
          break

        default:
          log.warn(`<additionalInput> element '${elem}' ignored`)
      }
    }

    // log.trace(util.inspect(obj))
    return obj
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
