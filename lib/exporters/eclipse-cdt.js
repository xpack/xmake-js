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
 * The Eclipse CDT exporter.
 *
 * In addition to Eclipse `.project`, CDT uses `.cproject`.
 * `.project` is simple enough and is generated from a template.
 * `.cproject` is complex and requires a full XML serializer.
 *
 * The XML structure is matched by a set of CdtXyz objects, which
 * hold the desired output data. All these objects inherit from a
 * common XmlElement parent, which performs the serialisation. For
 * this to work, each object implements a `prepareXml()` method to
 * add the element attributes and the children elements.
 */

// ----------------------------------------------------------------------------

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const Macros = require('../utils/macros.js').Macros

const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
const CliError = require('@ilg/cli-start-options').CliError

const Promisifier = require('@ilg/es6-promisifier').Promisifier

// https://www.npmjs.com/package/liquidjs
const Liquid = require('liquidjs')
// https://www.npmjs.com/package/xml-writer
// const XMLWriter = require('xml-writer')
const XMLWriter = require('../utils/hacks/xml-writer')

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but belong to `promises_`.
Promisifier.promisifyInPlace(fs, 'writeFile')

// For easy migration, inspire from the Node 10 experimental API.
// Do not use `fs.promises` yet, to avoid the warning.
const fsPromises = fs.promises_

// ----------------------------------------------------------------------------

// Update it if moved to other location.
const rootAbsolutePath = path.dirname(path.dirname(__dirname))
const templatesAbsolutePath = path.resolve(rootAbsolutePath,
  'assets', 'templates')

// ============================================================================

/**
 * @summary Generate CDT style unique IDs.
 *
 * @description
 * CDT unique IDs are dot separated strings followed by a unique number.
 * Each instance of this class maintains a map of these strings, and for
 * each string it keeps a set of integer values that were already allocated.
 * This guarantees uniqueness for each string base.
 * The unique numbers are random 9 digit integers.
 */
class CdtUids {
  constructor () {
    // Keys are strings, values are sets of used integers.
    this.bases = new Map()
  }

  /**
   * @summary Get a unique ID for a given base.
   *
   * @param {String} base The string base.
   * @returns {String} The base followed by a unique random number.
   */
  uid (base) {
    if (!this.bases.has(base)) {
      // First time use.
      const num = CdtUids.randomNumber()
      this.bases.set(base, new Set([num]))
      return `${base}.${num}`
    }
    const usedNumbers = this.bases.get(base)
    while (true) {
      // Try until an unused number is identified.
      const num = CdtUids.randomNumber()
      if (!usedNumbers.has(num)) {
        usedNumbers.add(num)
        return `${base}.${num}`
      }
    }
  }

  /**
   * @summary Generate a random 9 digit integer.
   *
   * @static
   * @returns {Number} An integer number.
   */
  static randomNumber () {
    const min = 100000000 // 9 digits
    const max = min * 10
    return Math.floor(Math.random() * (max - min)) + min
  }
}

// ============================================================================

/**
 * @summary Parent class to handle XML serialisation.
 */
class XmlElement {
  constructor (elementName) {
    this.private_ = {}
    this.private_.xmlElementName = elementName
    this.private_.xmlAttributes = new Map()
    this.private_.xmlElements = []
  }

  addXmlAttribute (name, value) {
    this.private_.xmlAttributes.set(name, value)
  }

  addXmlElement (element) {
    this.private_.xmlElements.push(element)
  }

  /**
   * @summary Parent method to set the 'prepared' flag.
   * @returns {undefined} Nothing.
   *
   * @description
   * Must be called via `super.prepareXml()` by derived objects.
   */
  prepareXml () {
    this.private_.isXmlPrepared = true
  }

  /**
   * @summary Serialise the current object.
   * @param {XMLWriter} xw XML writer.
   * @returns {undefined} Nothing.
   */
  toXml (xw) {
    assert(xw)
    if (!this.private_.isXmlPrepared) {
      this.prepareXml()
    }
    xw.startElement(this.private_.xmlElementName)
    this.private_.xmlAttributes.forEach((value, name) => {
      xw.writeAttribute(name, value)
    })
    this.private_.xmlElements.forEach((element) => {
      assert(element instanceof XmlElement, `${element} not an XmlElement`)
      element.toXml(xw)
    })
    xw.endElement()
  }
}

/**
 * @typedef {Object} CdtCProject
 * @typedef {CdtStorageModule[]} storageModules
 */

class CdtCProject extends XmlElement {
  constructor () {
    super('cproject')

    this.storageModules = []
  }

  addStorageModule (storageModule) {
    this.storageModules.push(storageModule)
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute(
      'storage_type_id',
      'org.eclipse.cdt.core.XmlProjectDescriptionStorage'
    )

    this.storageModules.forEach((storageModule) => {
      this.addXmlElement(storageModule)
    })
  }
}

class CdtProject extends XmlElement {
  constructor (args) {
    super('project')

    this.id = args.id
    this.name = args.name
    this.projectType = args.projectType
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', this.id)
    this.addXmlAttribute('name', this.name)
    this.addXmlAttribute('projectType', this.projectType)
  }
}

/**
 * @typedef {Object} CdtStorageModule
 * @property {String} moduleId
 */

class CdtStorageModule extends XmlElement {
  constructor (moduleId) {
    super('storageModule')

    this.moduleId = moduleId
  }

  prepareXml () {
    super.prepareXml()
    this.addXmlAttribute('moduleId', this.moduleId)
  }
}

class CdtStorageModuleCoreSettings extends CdtStorageModule {
  constructor (args) {
    super('org.eclipse.cdt.core.settings')

    this.args = args
    if (args.cconfigurations) {
      this.cconfigurations = args.cconfigurations
    } else if (args.extensions) {
      this.id = args.id
      this.name = args.name
      this.buildSystemId = args.buildSystemId
      this.extensions = args.extensions
    }
  }

  prepareXml () {
    super.prepareXml()

    if (this.buildSystemId) {
      this.addXmlAttribute('buildSystemId', this.buildSystemId)
    }
    if (this.id) {
      this.addXmlAttribute('id', this.id)
    }
    if (this.name) {
      this.addXmlAttribute('name', this.name)
    }

    if (this.cconfigurations) {
      this.cconfigurations.forEach((cconfiguration) => {
        this.addXmlElement(cconfiguration)
      })
    }

    if (this.extensions) {
      this.addXmlElement(
        new XmlElement('externalSettings')
      )
      const element = new XmlElement('extensions')
      this.extensions.forEach((extension) => {
        element.addXmlElement(extension)
      })
      this.addXmlElement(element)
    }
  }
}

class CdtStorageModuleBuildSystem extends CdtStorageModule {
  constructor (args) {
    super('cdtBuildSystem')

    if (args.project) {
      this.project = args.project
    } else if (args.configuration) {
      this.configuration = args.configuration
    }
    this.version = args.version || '4.0.0'
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('version', this.version)

    if (this.project) {
      this.addXmlElement(this.project)
    }
    if (this.configuration) {
      this.addXmlElement(this.configuration)
    }
  }
}

class CdtStorageModuleScannerConfiguration extends CdtStorageModule {
  constructor (cconfigurations) {
    super('scannerConfiguration')

    this.cconfigurations = cconfigurations
  }

  prepareXml () {
    super.prepareXml()

    const autodiscovery = new XmlElement('autodiscovery')
    autodiscovery.addXmlAttribute('enabled', 'true')
    autodiscovery.addXmlAttribute('problemReportingEnabled', 'true')
    autodiscovery.addXmlAttribute('selectedProfileId', '')

    this.addXmlElement(autodiscovery)

    this.cconfigurations.forEach((configuration) => {
      configuration.scannerConfigBuildInfos.forEach(
        (scannerConfigBuildInfo) => {
          this.addXmlElement(scannerConfigBuildInfo)
        })
    })
  }
}

/**
 * @typedef {Object} CdtExtension
 * @property {String} id
 * @property {String} point
 */

class CdtExtension extends XmlElement {
  constructor (id, point) {
    super('extension')
    this.id = id
    this.point = point
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', this.id)
    this.addXmlAttribute('point', this.point)
  }
}

/**
  * @typedef {Object} CdtScannerConfigBuildInfo
  * @property {string} toolId
  * @property {String} toolInputId
  */

class CdtScannerConfigBuildInfo extends XmlElement {
  constructor (ccid, toolId, toolInputId) {
    super('scannerConfigBuildInfo')

    this.ccid = ccid
    this.toolId = toolId
    this.toolInputId = toolInputId
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('instanceId',
      `${this.ccid};${this.ccid}.;${this.toolId};${this.toolInputId}`
    )

    const autodiscovery = new XmlElement('autodiscovery')
    autodiscovery.addXmlAttribute('enabled', 'true')
    autodiscovery.addXmlAttribute('problemReportingEnabled', 'true')
    autodiscovery.addXmlAttribute('selectedProfileId', '')

    this.addXmlElement(autodiscovery)
  }
}

/**
 * @typedef {Object} CdtCConfiguration
 * @property {String} id Unique id.
 * @property {String} name The build configuration name.
 * @property {String} parent The configuration parent id (plug-in specific).
 * @property {boolean} isDebug True if a debug configuration.
 * @property {XmakeBuildConfiguration} Reference to the buildConfiguration.
 * @property {String} version The `cdtBuildSystem` version.
 * @property {String} artifactName.
 * @property {String} buildArtefactType A plug-in specific id.
 * @property {String} buildType A plug-in specific id.
 * @property {String} cleanCommand The command to remove a file/folder.
 * @property {String} toolChainSuperId A plug-in toolchain specific id.
 * @property {CdtBuilder} builder
 * @property {CdtFolderInfo[]} folders
 * @property {CdtFileInfo[]} files
 * @property {CdtScannerConfigBuildInfo[]} scannerConfigBuildInfos
 */

class CdtCConfiguration extends XmlElement {
  constructor (id, name, other) {
    super('cconfiguration')
    this.id = id
    this.name = name

    this.version = other.version
    this.artifactName = other.artifactName
    this.buildArtefactType = other.buildArtefactType
    this.buildType = other.buildType
    this.cleanCommand = other.cleanCommand
    this.parent = other.parent

    this.extensions = []

    const configuration = new CdtConfiguration(
      id,
      name,
      {
        cconfiguration: this,
        artifactName: other.artifactName,
        buildArtefactType: other.buildArtefactType,
        buildType: other.buildType,
        cleanCommand: other.cleanCommand,
        description: '',
        parent: other.parent
      }
    )
    this.configuration = configuration

    const cdtBuildSystem = new CdtStorageModuleBuildSystem({
      configuration: configuration
    })
    this.cdtBuildSystem = cdtBuildSystem

    this.scannerConfigBuildInfos = []
  }

  addExtension (extension) {
    this.extensions.push(extension)
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', this.id)

    const configurationDataProvider = new CdtStorageModuleCoreSettings({
      id: this.id,
      name: this.name,
      buildSystemId:
        'org.eclipse.cdt.managedbuilder.core.configurationDataProvider',
      extensions: this.extensions
    })
    this.addXmlElement(configurationDataProvider)

    this.addXmlElement(this.cdtBuildSystem)

    this.addXmlElement(
      new CdtStorageModule('org.eclipse.cdt.core.externalSettings')
    )
  }
}

class CdtConfiguration extends XmlElement {
  constructor (id, name, args) {
    super('configuration')

    this.id = id
    this.name = name
    this.args = args

    this.cconfiguration = args.cconfiguration
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('artifactName', this.args.artifactName)
    this.addXmlAttribute('buildArtefactType', this.args.buildArtefactType)
    this.addXmlAttribute('buildProperties',
      'org.eclipse.cdt.build.core.buildArtefactType=' +
      `${this.args.buildArtefactType},` +
      `org.eclipse.cdt.build.core.buildType=${this.args.buildType}`
    )
    this.addXmlAttribute('cleanCommand', this.args.cleanCommand)
    this.addXmlAttribute('description', this.args.description || '')
    this.addXmlAttribute('id', this.id)
    this.addXmlAttribute('name', this.name)
    this.addXmlAttribute('parent', this.args.parent)

    this.cconfiguration.folders.forEach((folder) => {
      this.addXmlElement(folder)
    })

    this.cconfiguration.files.forEach((file) => {
      this.addXmlElement(file)
    })

    const sourceEntries = new XmlElement('sourceEntries')
    const sourceFolderNodes =
      this.cconfiguration.buildConfiguration.sourceFolderNodes

    sourceFolderNodes.forEach((node) => {
      const entry = new XmlElement('entry')
      entry.addXmlAttribute('flags', 'VALUE_WORKSPACE_PATH|RESOLVED')
      entry.addXmlAttribute('kind', 'sourcePath')
      entry.addXmlAttribute('name', node.relativePath)

      sourceEntries.addXmlElement(entry)
    })

    this.addXmlElement(sourceEntries)
    // TODO: add source entries
  }
}

/**
 * @typedef {Object} CdtFolderInfo
 * @property {String} resourcePath The folder relative path. The top is ''.
 * @property {String} name Apparently always '/'.
 * @property {CdtToolChain} toolChain
 */

class CdtFolderInfo extends XmlElement {
  constructor (args) {
    super('folderInfo')

    this.ccid = args.ccid
    this.resourcePath = args.relativePath
    this.name = '/'
    this.toolChain = args.toolChain
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', `${this.ccid}.${this.resourcePath}`)
    this.addXmlAttribute('name', this.name)
    this.addXmlAttribute('resourcePath', this.resourcePath)

    this.addXmlElement(this.toolChain)
  }
}

class CdtFileInfo extends XmlElement {
  constructor (ccid, relativePath) {
    super('fileInfo')

    this.ccid = ccid
    this.resourcePath = relativePath
    this.name = path.basename(relativePath)
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', `${this.ccid}.${this.resourcePath}`)
    this.addXmlAttribute('name', this.name)
    this.addXmlAttribute('rcbsApplicability', 'disable')
    this.addXmlAttribute('resourcePath', this.resourcePath)
    // TODO:
    this.addXmlAttribute('toolsToInvoke', 'xxxxxxxxxxxxxxxx')
  }
}

/**
 * @typedef {Object} CdtToolChain
 * @property {String} id Unique id.
 * @property {String} name Toolchain description.
 * @property {String} superClass A plug-in specific id.
 * @property {CdtOption[]} array of options.
 * @property {CdtTool[]} array of tools.
 * @property {String} unusedChildren
 * @property {boolean} hasUnusedChildren Getter to tell if `unusedChildren`
 * is defined.
 * @property {CdtTargetPlatform} targetPlatform
 * @property {CdtBuilder} builder (copied from cconfiguration)
 */

class CdtToolChain extends XmlElement {
  constructor (id, name, superClass, unusedChildren) {
    super('toolChain')

    this.id = id
    this.name = name
    this.superClass = superClass

    this.options = []
    this.tools = []

    this.hasUnusedChildren = false
    this.unusedChildren = ''
    if (unusedChildren !== undefined) {
      this.hasUnusedChildren = true
      this.unusedChildren = unusedChildren
    }
    // The top folderInfo also has:
    // targetPlatform
    // builder
  }

  get hasTargetPlatform () {
    return this.targetPlatform !== undefined
  }

  get hasBuilder () {
    return this.builder !== undefined
  }

  addOption (option) {
    this.options.push(option)
  }

  addTool (tool) {
    this.tools.push(tool)
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', this.id)
    this.addXmlAttribute('name', this.name)
    this.addXmlAttribute('superClass', this.superClass)

    if (this.hasUnusedChildren) {
      this.addXmlAttribute('unusedChildren', this.unusedChildren)
    }

    this.options.forEach((option) => {
      this.addXmlElement(option)
    })

    if (this.hasTargetPlatform) {
      this.addXmlElement(this.targetPlatform)
    }

    if (this.hasBuilder) {
      this.addXmlElement(this.builder)
    }

    this.tools.forEach((tool) => {
      this.addXmlElement(tool)
    })
  }
}

/**
 * @typedef {Object} CdtOption
 * @property {String} id Unique id.
 * @property {String} name Description.
 * @property {String} superClass A plug-in specific id.
 * @property {String} valueType The option type ['boolean', 'enumerated',
 * 'string', 'includePath', 'definedSymbols', 'libPaths']
 * @property {boolean} useByScannerDiscovery
 * @property {boolean} hasUseByScannerDiscovery True if `useByScannerDiscovery`
 * is defined.
 * @property {String} value
 * @property {boolean} hasValue True if `value` is defined.
 * @property {boolean} isList True if option includes `listOptionValues`.
 */

class CdtOption extends XmlElement {
  constructor (id, name, superClass, valueType,
    useByScannerDiscovery = undefined) {
    super('option')

    this.id = id
    this.name = name
    this.superClass = superClass
    this.valueType = valueType
    this.useByScannerDiscovery = useByScannerDiscovery

    this.value = undefined
  }

  get hasValue () {
    return this.value !== undefined
  }

  get hasUseByScannerDiscovery () {
    return this.useByScannerDiscovery !== undefined
  }

  get isList () {
    return false
  }

  toLiquid () {
    let str = '<option'
    str += ` id="${this.id}"`
    str += ` name="${this.name}"`
    str += ` superClass="${this.superClass}"`

    if (this.hasUseByScannerDiscovery) {
      const useValue = this.useByScannerDiscovery ? 'true' : 'false'
      str += ` useByScannerDiscovery="${useValue}"`
    }
    if (this.hasValue) {
      str += ` value="${this.value}"`
    }
    str += ` valueType="${this.valueType}"`
    str += '/>'

    return str
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', this.id)
    if (this.name) {
      this.addXmlAttribute('name', this.name)
    }
    this.addXmlAttribute('superClass', this.superClass)

    if (this.hasUseByScannerDiscovery) {
      const useByScannerStr = this.useByScannerDiscovery ? 'true' : 'false'
      this.addXmlAttribute('useByScannerDiscovery', useByScannerStr)
    }
    if (this.hasValue) {
      this.addXmlAttribute('value', this.value)
    }
    this.addXmlAttribute('valueType', this.valueType)
  }
}

class CdtOptionBoolean extends CdtOption {
  constructor (id, name, superClass, value, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'boolean', useByScannerDiscovery)

    this.value = value ? 'true' : 'false'
  }
}

class CdtOptionEnumerated extends CdtOption {
  constructor (id, name, superClass, value, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'enumerated', useByScannerDiscovery)

    this.value = value
  }
}

class CdtOptionString extends CdtOption {
  constructor (id, name, superClass, value, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'string', useByScannerDiscovery)

    this.value = value
  }
}

class CdtOptionListValue extends XmlElement {
  constructor (value, builtIn = undefined) {
    super('listOptionValue')

    this.value = value
    if (builtIn !== undefined) {
      this.builtIn = builtIn
    } else {
      this.builtIn = false
    }
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('builtIn', this.builtIn ? 'true' : 'false')
    this.addXmlAttribute('value', this.value)
  }
}

/**
 * @typedef {Object} CdtOptionWithList
 * @extends CdtOption
 * @property {CdtOptionListValue[]} listOptionValues
 * @property {boolean} isBuiltinEmpty
 * @property {boolean} isValueEmpty
 */

class CdtOptionWithList extends CdtOption {
  constructor (id, name, superClass, valueType,
    useByScannerDiscovery = undefined) {
    super(id, name, superClass, valueType, useByScannerDiscovery)

    this.listOptionValues = [] // Array of CdtOptionListValue
    this.isBuiltinEmpty = false
    this.isValueEmpty = false
  }

  get isList () {
    return true
  }

  addValue (value, builtIn = undefined) {
    this.listOptionValues.push(
      new CdtOptionListValue(value, builtIn)
    )
  }

  toLiquid () {
    let str = '<option'
    str += ` IS_BUILTIN_EMPTY="${this.isBuiltinEmpty ? 'true' : 'false'}"`
    str += ` IS_VALUE_EMPTY="${this.isBuiltinEmpty ? 'true' : 'false'}"`

    str += ` id="${this.id}"`
    str += ` name="${this.name}"`
    str += ` superClass="${this.superClass}"`

    if (this.hasUseByScannerDiscovery) {
      const useValue = this.useByScannerDiscovery ? 'true' : 'false'
      str += ` useByScannerDiscovery="${useValue}"`
    }

    // Most probably not used.
    if (this.hasValue) {
      str += ` value="${this.value}"`
    }

    str += ` valueType="${this.valueType}"`
    str += '>'
    for (const optionValue of this.listOptionValues) {
      str += '<listOptionValue'
      str += ` builtIn="${optionValue.builtIn ? 'true' : 'false'}"`
      str += ` value="${optionValue.value}"`
      str += '/>'
    }
    str += '</option>'

    return str
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('IS_BUILTIN_EMPTY',
      this.isBuiltinEmpty ? 'true' : 'false')
    this.addXmlAttribute('IS_VALUE_EMPTY',
      this.isBuiltinEmpty ? 'true' : 'false')

    this.listOptionValues.forEach((optionValue) => {
      this.addXmlElement(optionValue)
    })
  }
}

class CdtOptionIncludePath extends CdtOptionWithList {
  constructor (id, name, superClass, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'includePath', useByScannerDiscovery)
  }
}

class CdtOptionIncludeFiles extends CdtOptionWithList {
  constructor (id, name, superClass, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'includeFiles', useByScannerDiscovery)
  }
}

class CdtOptionDefinedSymbols extends CdtOptionWithList {
  constructor (id, name, superClass, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'definedSymbols', useByScannerDiscovery)
  }
}

class CdtOptionUndefinedSymbols extends CdtOptionWithList {
  constructor (id, name, superClass, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'undefDefinedSymbols', useByScannerDiscovery)
  }
}

class CdtOptionLibPaths extends CdtOptionWithList {
  constructor (id, name, superClass, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'libPaths', useByScannerDiscovery)
  }
}

class CdtOptionLibs extends CdtOptionWithList {
  constructor (id, name, superClass, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'libs', useByScannerDiscovery)
  }
}

class CdtOptionStringList extends CdtOptionWithList {
  constructor (id, name, superClass, useByScannerDiscovery = undefined) {
    super(id, name, superClass, 'stringList', useByScannerDiscovery)
  }
}

/**
 * @typedef {Object} CdtTargetPlatform
 * @property {String} id Unique id.
 * @property {String} superClass A plug-in specific id.
 * @property {String} archList
 * @property {String} binaryParser A plug-in specific id.
 * @property {boolean} isAbstract
 * @property {String} osList
 */

class CdtTargetPlatform extends XmlElement {
  constructor (id, superClass) {
    super('targetPlatform')

    this.id = id
    this.superClass = superClass

    // Defaults; override if needed.
    this.archList = 'all'
    this.binaryParser = 'org.eclipse.cdt.core.ELF'
    this.isAbstract = false
    this.osList = 'all'
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('archList', this.archList)
    this.addXmlAttribute('binaryParser', this.binaryParser)
    this.addXmlAttribute('id', this.id)
    this.addXmlAttribute('isAbstract', this.isAbstract ? 'true' : 'false')
    this.addXmlAttribute('osList', this.osList)
    this.addXmlAttribute('superClass', this.superClass)
  }
}

/**
 * @typedef {Object} CdtBuilder
 * @property {String} id Unique id.
 * @property {String} name Description.
 * @property {String} superClass A plug-in specific id.
 * @property {String} buildPath
 * @property {boolean} keepEnvironmentInBuildfile
 * @property {boolean} managedBuildOn
 */

class CdtBuilder extends XmlElement {
  constructor (id, superClass, buildPath) {
    super('builder')

    this.id = id
    this.superClass = superClass
    this.buildPath = buildPath

    // Defaults; override if needed.
    this.keepEnvironmentInBuildfile = false
    this.managedBuildOn = true
    this.name = 'Gnu Make Builder'
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('buildPath', this.buildPath)
    this.addXmlAttribute('id', this.id)
    this.addXmlAttribute('keepEnvironmentInBuildfile',
      this.keepEnvironmentInBuildfile ? 'true' : 'false')
    this.addXmlAttribute('managedBuildOn',
      this.managedBuildOn ? 'true' : 'false')
    this.addXmlAttribute('name', this.name)
    this.addXmlAttribute('superClass', this.superClass)
  }
}

/**
 * @typedef {Object} CdtTool
 * @property {String} id Unique id.
 * @property {String} name Description.
 * @property {String} superClass A plug-in specific id.
 * @property {CdtOptions[]} options
 * @property {CdtToolInputType} inputType
 * @property {boolean} hasInputType True if `inputType` is defined.
 */

class CdtTool extends XmlElement {
  constructor (id, name, superClass) {
    super('tool')

    this.id = id
    this.name = name
    this.superClass = superClass

    this.options = []
    this.inputType = undefined
  }

  get hasInputType () {
    return this.inputType !== undefined
  }

  addOption (option) {
    this.options.push(option)
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', this.id)
    this.addXmlAttribute('name', this.name)
    this.addXmlAttribute('superClass', this.superClass)

    this.options.forEach((option) => {
      this.addXmlElement(option)
    })

    if (this.hasInputType) {
      this.addXmlElement(this.inputType)
    }
  }
}

/**
 * @typedef {Object} CdtToolInputType
 * @property {String} id Unique id.
 * @property {String} superClass A plug-in specific id.
 */

class CdtToolInputType extends XmlElement {
  constructor (id, superClass) {
    super('inputType')

    this.id = id
    this.superClass = superClass

    this.additionalInputs = []
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('id', this.id)
    this.addXmlAttribute('superClass', this.superClass)

    this.additionalInputs.forEach((additionalInput) => {
      this.addXmlElement(additionalInput)
    })
  }
}

class CdtAdditionalInput extends XmlElement {
  constructor (kind, paths) {
    super('additionalInput')

    this.kind = kind
    this.paths = paths
  }

  prepareXml () {
    super.prepareXml()

    this.addXmlAttribute('kind', this.kind)
    this.addXmlAttribute('paths', this.paths)
  }
}

// ============================================================================

class EclipseCdtExporter {
  /**
   * @summary Constructor, to set the context.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    assert(context)
    this.context = context
    this.log = context.log
    const log = this.log
    log.trace(`${this.constructor.name}.construct()`)
    assert(context.xmakeParser)

    // https://github.com/harttle/liquidjs#options
    // `strict_variables` makes impossible to test for the presence of
    // properties and requires explicit `hasXXX` getters.
    this.liquid = Liquid({
      root: templatesAbsolutePath,
      extname: '.liquid',
      cache: false,
      greedy: false, // default: true
      strict_filters: true, // default: false
      strict_variables: true, // default: false
      trim_tag_right: true, // default: false
      trim_tag_left: true // default: false
    })
  }

  async export (buildContext) {
    assert(buildContext)

    const log = this.log
    log.trace(`${this.constructor.name}.export()`)

    const context = this.context
    // const config = context.config
    const xmakeParser = context.xmakeParser

    log.verbose()

    // Create the source tree for all configurations.
    for (const buildConfiguration of
      Object.values(buildContext.buildConfigurations)) {
      xmakeParser.prepareConfiguration(buildConfiguration)
      // Eclipse build folders are located in the top folder, without
      // the intermediate `build` folder.
      await xmakeParser.createSourceTree(buildConfiguration,
        '')
    }

    const project = this.prepareDotProject(buildContext)
    await this.renderDotProject(project)

    const cproject = this.prepareDotCProject(buildContext)
    await this.renderDotCProject(project, cproject)
  }

  /**
   * @summary Create and write an Eclipse CDT .project file.
   *
   * @async
   * @param {*} project The CDT .project data.
   * @returns {undefined} Nothing.
   */
  async renderDotProject (project) {
    const log = this.log
    // const context = this.context
    // const config = context.config

    const fileName = '.project'
    log.verbose(`Generating file '${fileName}'...`)

    const content = await this.liquid.renderFile(fileName + '.liquid', {
      project
    })

    const outPath = path.resolve(project.outputFolderAbsolutePath, fileName)
    try {
      await fsPromises.writeFile(outPath, content, 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  /**
   * @summary Create and write an Eclipse CDT .cproject file.
   *
   * @param {Object} project .project definitions.
   * @param {Object} cproject .cproject definitions.
   * @returns {undefined} Nothing.
   */
  async renderDotCProject (project, cproject) {
    const log = this.log

    const fileName = '.cproject'
    log.verbose(`Generating file '${fileName}'...`)

    const xw = new XMLWriter('\t')
    xw.startDocument('1.0', 'UTF-8', false)
    xw.writePI('fileVersion', ' 4.0.0')
    const comment = ' This file was automatically generated by ' +
      `'xmake export', using the '${project.exportFormat}' ` +
      'format (https://github.com/xpack/xmake-js). '
    xw.writeComment(comment)
    cproject.toXml(xw)
    xw.endDocument()

    const outPath = path.resolve(project.outputFolderAbsolutePath, fileName)
    try {
      await fsPromises.writeFile(outPath, xw.toString(), 'utf8')
    } catch (err) {
      throw new CliError(err.message, CliExitCodes.ERROR.OUTPUT)
    }
  }

  prepareDotProject (buildContext) {
    const context = this.context
    const config = context.config

    const project = {
      name: buildContext.projectName,
      language: buildContext.language,
      exportFormat: config.exportFormat,
      outputFolderAbsolutePath: buildContext.folderAbsolutePath
    }

    return project
  }

  prepareDotCProject (buildContext) {
    // config.exportFormat === 'gme-cross-arm')
    const cproject = new CdtCProject()

    this.cdtUids = new CdtUids()
    // TODO
    this.pluginId = 'ilg.gnuarmeclipse.managedbuild.cross'

    const cconfigurations = this.prepareCConfigurations(buildContext)

    // Initialize the array of storage modules.
    cproject.addStorageModule(
      new CdtStorageModuleCoreSettings({
        cconfigurations
      })
    )

    {
      const base = `${this.pluginId}.target.elf` // TODO: update for libs
      const project = new CdtProject({
        id: this.cdtUids.uid(`${buildContext.projectName}.${base}`),
        name: 'Executable', // TODO: update for libs
        projectType: base
      })

      cproject.addStorageModule(
        new CdtStorageModuleBuildSystem({
          project: project
        })
      )
    }

    cproject.addStorageModule(
      new CdtStorageModule('org.eclipse.cdt.core.LanguageSettingsProviders')
    )
    cproject.addStorageModule(
      new CdtStorageModule('org.eclipse.cdt.make.core.buildtargets')
    )

    cproject.addStorageModule(
      new CdtStorageModuleScannerConfiguration(cconfigurations)
    )

    return cproject
  }

  prepareCConfigurations (buildContext) {
    const log = this.log

    // Eclipse CDT `cconfigurations` correspond to build configurations.
    const cconfigurations = []
    for (const [name, buildConfiguration] of
      Object.entries(buildContext.buildConfigurations)) {
      log.trace(`build configuration ${buildConfiguration.name}`)

      const isDebug = buildConfiguration.name.includes('debug')
      // TODO: update for libs
      const baseName = this.pluginId + '.config.elf.' +
        (isDebug ? 'debug' : 'release')

      const cconfiguration =
        new CdtCConfiguration(
          this.cdtUids.uid(`cconfig.${buildConfiguration.name}`),
          name,
          {
            version: '4.0.0',
            artifactName: '$' + '{ProjName}',
            // TODO: update for libs
            buildArtefactType:
              'org.eclipse.cdt.build.core.buildArtefactType.exe',
            buildType: 'org.eclipse.cdt.build.core.buildType.' +
              (isDebug ? 'debug' : 'release'),
            // TODO: update for non GME
            cleanCommand: '$' + '{cross_rm} -rf',
            parent: baseName
          })

      cconfiguration.isDebug = isDebug
      cconfiguration.buildConfiguration = buildConfiguration

      // TODO: update for libs
      cconfiguration.addExtension(new CdtExtension(
        'org.eclipse.cdt.core.ELF',
        'org.eclipse.cdt.core.BinaryParser'
      ))
      cconfiguration.addExtension(new CdtExtension(
        'org.eclipse.cdt.core.GASErrorParser',
        'org.eclipse.cdt.core.ErrorParser'
      ))
      cconfiguration.addExtension(new CdtExtension(
        'org.eclipse.cdt.core.GmakeErrorParser',
        'org.eclipse.cdt.core.ErrorParser'
      ))
      cconfiguration.addExtension(new CdtExtension(
        'org.eclipse.cdt.core.GLDErrorParser',
        'org.eclipse.cdt.core.ErrorParser'
      ))
      cconfiguration.addExtension(new CdtExtension(
        'org.eclipse.cdt.core.CWDLocator',
        'org.eclipse.cdt.core.ErrorParser'
      ))
      cconfiguration.addExtension(new CdtExtension(
        'org.eclipse.cdt.core.GCCErrorParser',
        'org.eclipse.cdt.core.ErrorParser'
      ))

      // TODO: update for other toolchain/artefact
      cconfiguration.toolChainSuperId =
        this.pluginId + '.toolchain.elf.' + (isDebug ? 'debug' : 'release')

      let superId = this.pluginId + '.builder'
      const buildPath = '$' + '{workspace_loc:/' + buildContext.projectName +
        '}/' + cconfiguration.name
      cconfiguration.builder =
        new CdtBuilder(
          this.cdtUids.uid('builder'),
          superId,
          buildPath
        )

      this.prepareCommonOptions(cconfiguration)

      cconfiguration.folders = this.prepareFolders(cconfiguration)
      // TODO: activate when functional
      cconfiguration.files = [] // this.prepareFiles(cconfiguration)

      cconfigurations.push(cconfiguration)
    }
    return cconfigurations
  }

  prepareCommonOptions (cconfiguration) {
    const log = this.log
    const buildConfiguration = cconfiguration.buildConfiguration
    // const sourceTree = buildConfiguration.sourceTree

    // The first step is to find out all simple options of all used tools.
    // A side effect is an array of nodes, either folders or files.
    const nodes = []
    for (const buildFolder of Object.values(buildConfiguration.folders)) {
      const folderNode = buildFolder.node
      folderNode.options.usedTools = {}
      nodes.push(folderNode)

      for (const tool of folderNode.usedTools) {
        folderNode.options.usedTools[tool.name] =
          tool.simpleOptionsArray(folderNode)
        // console.log(tool.name, folderNode.simpleOptions_)
      }
    }

    for (const buildFile of Object.values(buildConfiguration.files)) {
      const fileNode = buildFile.node
      fileNode.options.usedTools = {}
      nodes.push(fileNode)

      fileNode.options.usedTools[fileNode.tool.name] =
        fileNode.tool.simpleOptionsArray(fileNode)

      // console.log(fileNode.tool.name, fileNode.simpleOptions_)
    }

    // Copy the options from the top folder, which corresponds to
    // the node building the artefact.
    const enumeratedCommonOptions = {
      '-mcpu=': {
        name: 'ARM family',
        superClass: '.arm.target.family',
        value: '.arm.target.mcpu.',
        values: {
          'cortex-a12': 'cortex-a12',
          'cortex-a15': 'cortex-a15',
          'cortex-a17': 'cortex-a17',
          'cortex-a32': 'cortex-a32',
          'cortex-a35': 'cortex-a35',
          'cortex-a5': 'cortex-a5',
          'cortex-a53': 'cortex-a53',
          'cortex-a57': 'cortex-a57',
          'cortex-a7': 'cortex-a7',
          'cortex-a72': 'cortex-a72',
          'cortex-a8': 'cortex-a8',
          'cortex-a9': 'cortex-a9',
          'cortex-m0': 'cortex-m0',
          'cortex-m0.small-multiply': 'cortex-m0-small-multiply',
          'cortex-m0plus': 'cortex-m0plus',
          'cortex-m0plus.small-multiply': 'cortex-m0plus-small-multiply',
          'cortex-m1': 'cortex-m1',
          'cortex-m1.small-multiply': 'cortex-m1-small-multiply',
          'cortex-m23': 'cortex-m23',
          'cortex-m3': 'cortex-m3',
          'cortex-m33': 'cortex-m33',
          'cortex-m4': 'cortex-m4',
          'cortex-m7': 'cortex-m7',
          'cortex-r4': 'cortex-r4',
          'cortex-r5': 'cortex-r5',
          'cortex-r7': 'cortex-r7',
          'cortex-r8': 'cortex-r8'
        }
      },
      '-march=': {
        name: 'ARM architecture',
        superClass: '.arm.target.architecture',
        value: '.arm.target.arch.',
        values: {
          'armv6': 'armv6',
          'armv6-m': 'armv6-m',
          'armv7': 'armv7',
          'armv7-a': 'armv7-a',
          'armv7-m': 'armv7-m',
          'armv7-r': 'armv7-r',
          'armv7e-m': 'armv7e-m',
          'armv7ve': 'armv7ve',
          'armv8-a': 'armv8-a'
        }
      },
      '-mfloat-abi=': {
        name: 'Float ABI',
        superClass: '.arm.target.fpu.abi',
        value: '.arm.target.fpu.abi.',
        values: {
          'soft': 'soft',
          'softfp': 'softfp',
          'hard': 'hard'
        }
      },
      '-mfpu=': {
        name: 'FPU Type',
        superClass: '.arm.target.fpu.unit',
        value: '.arm.target.fpu.unit.',
        values: {
          'fp-armv8': 'fparmv8',
          'fpv4-sp-d16': 'fpv4spd16',
          'fpv5-d16': 'fpv5d16',
          'fpv5-sp-d16': 'fpv5spd16',
          'maverick': 'maverick',
          'neon': 'neon',
          'neon-fp16': 'neonfp16',
          'neon-fp-armv8': 'neonfparmv8',
          'neon-vfpv4': 'neonvfpv4',
          'vfp': 'vfp',
          'vfpv3': 'vfpv3',
          'vfpv3-d16': 'vfpv3d16',
          'vfpv3-d16-fp16': 'vfpv3d16fp16',
          'vfpv3-fp16': 'vfpv3fp16',
          'vfpv3xd': 'vfpv3xd',
          'vfpv3xd-fp16': 'vfpv3xdfp16',
          'vfpv4': 'vfpv4',
          'vfpv4-d16': 'vfpv4d16'
        }
      },
      '-O': {
        name: 'Optimization Level',
        superClass: '.optimization.level',
        value: '.optimization.level.',
        values: {
          '0': 'none',
          '1': 'optimize',
          '2': 'more',
          '3': 'most',
          's': 'size',
          'g': 'debug'
        }
      },
      '-g': {
        name: 'Debug level',
        superClass: '.debugging.level',
        value: '.debugging.level.',
        values: {
          '': 'default',
          '1': 'minimal',
          '3': 'max'
        }
      }
    }
    buildConfiguration.enumeratedCommonOptions = enumeratedCommonOptions

    const simpleCommonOptions = {
      '-mthumb': {
        name: 'Instruction set',
        valueType: 'enumerated',
        superClass: '.arm.target.instructionset',
        value: '.option.arm.target.instructionset.thumb'
      },
      '-marm': {
        name: 'Instruction set',
        valueType: 'enumerated',
        superClass: '.arm.target.instructionset',
        value: '.option.arm.target.instructionset.arm'
      },
      '-mthumb-interwork': {
        name: 'Thumb interwork (-mthumb-interwork)',
        valueType: 'boolean',
        superClass: '.arm.target.thumbinterwork'
      },
      '-mlittle-endian': {
        name: 'Little endian (-mlittle-endian)',
        valueType: 'enumerated',
        superClass: '.arm.target.endianness',
        value: '.arm.target.endianness.little'
      },
      '-mbig-endian': {
        name: 'Big endian (-mbig-endian)',
        valueType: 'enumerated',
        superClass: '.arm.target.endianness',
        value: '.arm.target.endianness.big'
      },
      '-munaligned-access': {
        name: 'Enabled (-munaligned-access)',
        valueType: 'enumerated',
        superClass: '.arm.target.unalignedaccess',
        value: '.arm.target.unalignedaccess.enabled'
      },
      '-mno-unaligned-access': {
        name: 'Disabled (-mno-unaligned-access)',
        valueType: 'enumerated',
        superClass: '.arm.target.unalignedaccess',
        value: '.arm.target.unalignedaccess.disabled'
      },
      '-fmessage-length=0': {
        name: 'Message length (-fmessage-length=0)',
        valueType: 'boolean',
        superClass: '.optimization.messagelength'
      },
      '-fsigned-char': {
        name: '\'char\' is signed (-fsigned-char)',
        valueType: 'boolean',
        superClass: '.optimization.signedchar'
      },
      '-ffunction-sections': {
        name: 'Function sections (-ffunction-sections)',
        valueType: 'boolean',
        superClass: '.optimization.functionsections'
      },
      '-fdata-sections': {
        name: 'Data sections (-fdata-sections)',
        valueType: 'boolean',
        superClass: '.optimization.datasections'
      },
      '-fno-common': {
        name: 'No common unitialized (-fno-common)',
        valueType: 'boolean',
        superClass: '.optimization.nocommon'
      },
      '-fno-inline-functions': {
        name: 'Do not inline functions (-fno-inline-functions)',
        valueType: 'boolean',
        superClass: '.optimization.noinlinefunctions'
      },
      '-ffreestanding': {
        name: 'Assume freestanding environment (-ffreestanding)',
        valueType: 'boolean',
        superClass: '.optimization.freestanding'
      },
      '-fno-builtin': {
        name: 'Disable builtin (-fno-builtin)',
        valueType: 'boolean',
        superClass: '.optimization.nobuiltin'
      },
      '-fsingle-precision-constant': {
        name: 'Single precision constants (-fsingle-precision-constant)',
        valueType: 'boolean',
        superClass: '.optimization.spconstant'
      },
      '-fPIC': {
        name: 'Position independent code (-fPIC)',
        valueType: 'boolean',
        superClass: '.optimization.PIC'
      },
      '-flto': {
        name: 'Link-time optimizer (-flto)',
        valueType: 'boolean',
        superClass: '.optimization.lto'
      },
      '-fno-move-loop-invariants': {
        name: 'Disable loop invariant move (-fno-move-loop-invariants)',
        valueType: 'boolean',
        superClass: '.optimization.nomoveloopinvariants'
      },
      '-fsyntax-only': {
        name: 'Check syntax only (-fsyntax-only)',
        valueType: 'boolean',
        superClass: '.warnings.syntaxonly'
      },
      '-pedantic': {
        name: 'Pedantic (-pedantic)',
        valueType: 'boolean',
        superClass: '.warnings.pedantic'
      },
      '-pedantic-errors': {
        name: 'Pedantic warnings as errors (-pedantic-errors)',
        valueType: 'boolean',
        superClass: '.warnings.pedanticerrors'
      },
      '-w': {
        name: 'Inhibit all warnings (-w)',
        valueType: 'boolean',
        superClass: '.warnings.nowarn'
      },
      '-Wall': {
        name: 'Enable all common warnings (-Wall)',
        valueType: 'boolean',
        superClass: '.warnings.allwarn'
      },
      '-Wextra': {
        name: 'Enable extra warnings (-Wextra)',
        valueType: 'boolean',
        superClass: '.warnings.extrawarn'
      },
      '-Wconversion': {
        name: 'Warn on implicit conversions (-Wconversion)',
        valueType: 'boolean',
        superClass: '.warnings.conversion'
      },
      '-Wuninitialized': {
        name: 'Warn on uninitialized variables (-Wuninitialised)',
        valueType: 'boolean',
        superClass: '.warnings.uninitialized'
      },
      '-Wunused': {
        name: 'Warn on various unused elements (-Wunused)',
        valueType: 'boolean',
        superClass: '.warnings.unused'
      },
      '-Wpadded': {
        name: 'Warn on various unused elements (-Wunused)',
        valueType: 'boolean',
        superClass: '.warnings.padded'
      },
      '-Wfloat-equal': {
        name: 'Warn if floats are compared as equal (-Wfloat-equal)',
        valueType: 'boolean',
        superClass: '.warnings.floatequal'
      },
      '-Wshadow': {
        name: 'Warn if shadowed variable (-Wshadow)',
        valueType: 'boolean',
        superClass: '.warnings.shadow'
      },
      '-Wpointer-arith': {
        name: 'Warn if pointer arithmetic (-Wpointer-arith)',
        valueType: 'boolean',
        superClass: '.warnings.pointerarith'
      },
      '-Wlogical-op': {
        name: 'Warn if suspicious logical ops (-Wlogical-op)',
        valueType: 'boolean',
        superClass: '.warnings.logicalop'
      },
      '-Waggregate-return': {
        name: 'Warn if struct is returned (-Wagreggate-return)',
        valueType: 'boolean',
        superClass: '.warnings.agreggatereturn'
      },
      '-Wmissing-declarations': {
        name: 'Warn on undeclared global function (-Wmissing-declaration)',
        valueType: 'boolean',
        superClass: '.warnings.missingdeclaration'
      },
      '-Werror': {
        name: 'Generate errors instead of warnings (-Werror)',
        valueType: 'boolean',
        superClass: '.warnings.toerrors'
      },
      '-p': {
        name: 'Generate prof information (-p)',
        valueType: 'boolean',
        superClass: '.debugging.prof'
      },
      '-pg': {
        name: 'Generate gprof information (-pg)',
        valueType: 'boolean',
        superClass: '.debugging.gprof'
      }
    }

    buildConfiguration.simpleCommonOptions = simpleCommonOptions

    // TODO: adjust for libs.
    const startOptions = buildConfiguration.topFolder.node.options
      .usedTools[buildConfiguration.topFolder.node.tool.name]

    // From the start options keep only those who match the CDT options.
    const filteredOptions = []
    for (const opt of startOptions) {
      if (simpleCommonOptions[opt]) {
        filteredOptions.push(opt)
      } else {
        for (const [prefix, optDef] of
          Object.entries(enumeratedCommonOptions)) {
          if (opt.startsWith(prefix)) {
            const optVal = opt.slice(prefix.length)
            if (optDef.values[optVal]) {
              filteredOptions.push(opt)
              break
            } else {
              throw new Error(`${prefix}${optVal} not yet supported.`)
            }
          }
        }
      }
    }
    // console.log(zzz)

    // From the filtered options, keep only those present in all node options.
    // Check only compilers and linkers.
    const commonOptions = []
    for (const opt of filteredOptions) {
      let isCommon = true
      for (const node of nodes) {
        for (const [toolName, opts] of Object.entries(node.options.usedTools)) {
          if (toolName.endsWith('Compiler') || toolName.endsWith('Linker')) {
            if (!opts.includes(opt)) {
              // Definitely not a common option.
              isCommon = false
              break
            }
          }
        }
        if (!isCommon) {
          // No need to check the other tools.
          break
        }
      }
      // If none of the tools flaged the optiion as not present,
      // is is a common option.
      if (isCommon) {
        commonOptions.push(opt)
      }
    }
    log.trace(`common options ${commonOptions}`)

    buildConfiguration.commonOptions = commonOptions

    // Remove common options from the nodes options.
    // Actually only the top node is known to use these definitions.
    for (const node of nodes) {
      for (const [toolName, opts] of Object.entries(node.options.usedTools)) {
        if (toolName.endsWith('Compiler') || toolName.endsWith('Linker')) {
          node.options.usedTools[toolName] =
            opts.filter((el) => {
              // Nodes will retain only non-common options.
              return !commonOptions.includes(el)
            })
          log.trace(`'${node.relativePath}' ${toolName} ` +
            `${node.options.usedTools[toolName]}`)
        }
      }
    }
  }

  prepareFolders (cconfiguration) {
    const folders = []

    const top = this.prepareTopFolderInfo(cconfiguration)
    folders.push(top)

    if (false) {
      const buildConfiguration = cconfiguration.buildConfiguration
      for (const buildFolder of Object.values(buildConfiguration.folders)) {
        if (buildFolder.name !== '') {
          const folder =
            this.prepareFolderInfo(buildFolder.name, cconfiguration)
          folders.push(folder)
        }
      }
    }
    return folders
  }

  /**
   * @summary Prepare the top folder, which has more options.
   *
   * @param {*} cconfiguration The CDT cconfiguration.
   * @returns {CdtFolderInfo} The top folder info.
   *
   * @description
   * The top folder gets a special treatment.
   */
  prepareTopFolderInfo (cconfiguration) {
    // const log = this.log
    const buildConfiguration = cconfiguration.buildConfiguration
    const node = buildConfiguration.sourceTree

    const toolChainName = node.toolchain.fullDescription
    const toolChain =
      new CdtToolChain(
        this.cdtUids.uid('toolchain'),
        toolChainName,
        cconfiguration.toolChainSuperId
      )

    const folderInfo = new CdtFolderInfo({
      ccid: cconfiguration.id,
      relativePath: '',
      toolChain: toolChain
    })

    const prefix = this.pluginId
    const optionPrefix = prefix + '.option'

    let superId
    let option

    const simpleCommonOptions = buildConfiguration.simpleCommonOptions
    const enumeratedCommonOptions =
      buildConfiguration.enumeratedCommonOptions

    // TODO: process multiple definitions from an
    // enumeration (like -O0 -O1, or -mthumb -marm).

    // ------------------------------------------------------------------------

    superId = optionPrefix + '.toolchain.name'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Toolchain name',
      superId,
      'GNU MCU Eclipse ARM Embedded GCC'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.toolchain.id'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Toolchain ID',
      superId,
      '962691777'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.architecture'
    option = new CdtOptionEnumerated(
      this.cdtUids.uid('option'),
      'Architecture',
      superId,
      superId + '.arm')
    toolChain.options.push(option)

    // ------------------------------------------------------------------------

    const misc = this.prepareCdtOptions(buildConfiguration.commonOptions,
      simpleCommonOptions, enumeratedCommonOptions, prefix, optionPrefix,
      toolChain)
    assert(misc.length === 0)

    // ------------------------------------------------------------------------

    superId = optionPrefix + '.command.prefix'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Prefix',
      superId,
      'arm-none-eabi-'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.command.c'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'C compiler',
      superId,
      'gcc'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.command.cpp'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'C++ compiler',
      superId,
      'g++'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.command.ar'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Archiver',
      superId,
      'ar'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.command.objcopy'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Hex/Bin converter',
      superId,
      'objcopy'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.command.objdump'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Listing generator',
      superId,
      'objdump'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.command.size'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Size command',
      superId,
      'size'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.command.make'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Build command',
      superId,
      'make'
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.command.rm'
    option = new CdtOptionString(
      this.cdtUids.uid('option'),
      'Remove command',
      superId,
      'rm'
    )
    toolChain.options.push(option)

    // ------------------------------------------------------------------------
    // Enable some secondary tools.

    superId = optionPrefix + '.addtools.createflash'
    option = new CdtOptionBoolean(
      this.cdtUids.uid('option'),
      'Create flash image',
      superId,
      true
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.addtools.createlisting'
    option = new CdtOptionBoolean(
      this.cdtUids.uid('option'),
      'Create extended listing',
      superId,
      false
    )
    toolChain.options.push(option)

    superId = optionPrefix + '.addtools.printsize'
    option = new CdtOptionBoolean(
      this.cdtUids.uid('option'),
      'Print size',
      superId,
      true
    )
    toolChain.options.push(option)

    // ------------------------------------------------------------------------

    superId = prefix + '.targetPlatform'
    toolChain.targetPlatform = new CdtTargetPlatform(
      this.cdtUids.uid('platform'),
      superId
    )

    // Copy builder from parent.
    assert(cconfiguration.builder)
    toolChain.builder = cconfiguration.builder

    // ------------------------------------------------------------------------

    const toolchain = cconfiguration.buildConfiguration.toolchain
    let tool

    for (const toolName of
      Object.keys(node.options.usedTools)) {
      switch (toolName) {
        case 'assembler':
          superId = prefix + '.tool.assembler'
          tool = new CdtTool(
            this.cdtUids.uid(`tool.${toolName}`),
            toolchain.tools.assembler.fullDescription,
            superId)

          toolChain.addTool(tool)
          break

        case 'cCompiler':
        case 'cppCompiler':
          tool = this.preapreToolCompiler(toolName, cconfiguration, node)
          toolChain.addTool(tool)
          break

        case 'cLinker':
        case 'cppLinker':
          tool = this.prepareToolLinker(toolName, cconfiguration, node)
          toolChain.addTool(tool)
          break

        case 'archiver':
          superId = prefix + '.tool.archiver'
          tool = new CdtTool(
            this.cdtUids.uid(`tool.${toolName}`),
            toolchain.tools.archiver.fullDescription,
            superId)

          // TODO support libs
          toolChain.addTool(tool)
          break

        default:
          throw new Error(`Unimplemented tool ${toolName}.`)
      }
    }

    // ------------------------------------------------------------------------

    superId = prefix + '.tool.createflash'
    tool = new CdtTool(
      this.cdtUids.uid('tool.createflash'),
      toolchain.descriptionPrefix + ' Create Flash Image',
      superId
    )

    superId = prefix + '.option.createflash.choice'
    option = new CdtOptionEnumerated(
      this.cdtUids.uid('option'),
      'Output file format (-O)',
      superId,
      prefix + '.option.createflash.choice.ihex'
    )
    tool.addOption(option)

    toolChain.addTool(tool)

    // ------------------------------------------------------------------------

    superId = prefix + '.tool.createlisting'
    tool = new CdtTool(
      this.cdtUids.uid('tool.createlisting'),
      toolchain.descriptionPrefix + ' Create Listing',
      superId
    )

    superId = prefix + '.option.createlisting.source'
    option = new CdtOptionBoolean(
      this.cdtUids.uid('option'),
      'Display source (--source|-S)',
      superId,
      true
    )
    tool.addOption(option)

    superId = prefix + '.option.createlisting.allheaders'
    option = new CdtOptionBoolean(
      this.cdtUids.uid('option'),
      'Display all headers (--all-headers|-x)',
      superId,
      true
    )
    tool.addOption(option)

    superId = prefix + '.option.createlisting.linenumbers'
    option = new CdtOptionBoolean(
      this.cdtUids.uid('option'),
      'Display line numbers (--line-numbers|-l)',
      superId,
      true
    )
    tool.addOption(option)

    superId = prefix + '.option.createlisting.wide'
    option = new CdtOptionBoolean(
      this.cdtUids.uid('option'),
      'Wide lines (--wide|-w)',
      superId,
      true
    )
    tool.addOption(option)

    superId = prefix + '.option.createlisting.demangle'
    option = new CdtOptionBoolean(
      this.cdtUids.uid('option'),
      'Demangle names (--demangle|-C)',
      superId,
      true
    )
    tool.addOption(option)

    toolChain.addTool(tool)

    // ------------------------------------------------------------------------

    superId = prefix + '.tool.printsize'
    tool = new CdtTool(
      this.cdtUids.uid('tool.printsize'),
      toolchain.descriptionPrefix + ' Print Size',
      superId
    )

    superId = prefix + '.option.printsize.format'
    option = new CdtOptionEnumerated(
      this.cdtUids.uid('option'),
      'Size format',
      superId
    )
    tool.addOption(option)

    toolChain.addTool(tool)

    // ------------------------------------------------------------------------

    folderInfo.toolChain = toolChain

    return folderInfo
  }

  preapreToolCompiler (toolName, cconfiguration, node) {
    let superId
    const prefix = this.pluginId
    const toolchain = cconfiguration.buildConfiguration.toolchain
    let tool
    let languagePart
    if (toolName === 'cCompiler') {
      languagePart = 'c'
    } else if (toolName === 'cppCompiler') {
      languagePart = 'cpp'
    } else {
      throw new Error(`Compiler ${toolName} unimplemented.`)
    }

    const optionLangPrefix = prefix + '.option.' + languagePart
    let option

    superId = prefix + `.tool.${languagePart}.compiler`
    const toolId = this.cdtUids.uid(`tool.${toolName}`)
    tool = new CdtTool(
      toolId,
      toolchain.tools[toolName].fullDescription,
      superId
    )

    if (node.includeFolders.length > 0) {
      superId = optionLangPrefix + '.compiler.include.paths'
      option = new CdtOptionIncludePath(
        this.cdtUids.uid('option'),
        'Include paths (-I)',
        superId
      )

      node.includeFolders.forEach((value) => {
        option.addValue(`"${value}"`)
      })
      tool.addOption(option)
    }

    if (node.includeSystemFolders.length > 0) {
      superId = optionLangPrefix + '.compiler.include.systempaths'
      option = new CdtOptionIncludePath(
        this.cdtUids.uid('option'),
        'Include system paths (-isystem)',
        superId
      )

      node.includeSystemFolders.forEach((value) => {
        option.addValue(`"${value}"`)
      })
      tool.addOption(option)
    }

    if (node.includeSystemFolders.length > 0) {
      superId = optionLangPrefix + '.compiler.include.systempaths'
      option = new CdtOptionIncludePath(
        this.cdtUids.uid('option'),
        'Include system paths (-isystem)',
        superId
      )

      node.includeSystemFolders.forEach((value) => {
        option.addValue(`"${value}"`)
      })
      tool.addOption(option)
    }

    if (node.includeFiles.length > 0) {
      superId = optionLangPrefix + '.compiler.include.files'
      option = new CdtOptionIncludeFiles(
        this.cdtUids.uid('option'),
        'Include files (-include)',
        superId
      )

      node.includeFiles.forEach((value) => {
        option.addValue(`"${value}"`)
      })
      tool.addOption(option)
    }

    if (node.symbols.length > 0) {
      superId = optionLangPrefix + '.compiler.defs'
      option = new CdtOptionDefinedSymbols(
        this.cdtUids.uid('option'),
        'Defined symbols (-D)',
        superId,
        true
      )

      for (const value of node.symbols) {
        option.addValue(value)
      }
      tool.addOption(option)
    }

    if (node.undefinedSymbols.length > 0) {
      superId = optionLangPrefix + '.compiler.undef'
      option = new CdtOptionUndefinedSymbols(
        this.cdtUids.uid('option'),
        'Undefined symbols (-U)',
        superId,
        true
      )

      for (const value of node.undefinedSymbols) {
        option.addValue(value)
      }
      tool.addOption(option)
    }

    let cdtOptions

    if (toolName === 'cCompiler') {
      cdtOptions = {
        '-ansi': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.ansi'
        },
        '-std=gnu90': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnu90'
        },
        '-std=c99': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.c99'
        },
        '-std=gnu99': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnu99'
        },
        '-std=c11': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.c11'
        },
        '-std=gnu11': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnu11'
        },
        '-nostdinc': {
          name: 'Do not search system directories (-nostdinc)',
          valueType: 'boolean',
          superClass: '.compiler.nostdinc'
        },
        '-Wmissing-prototypes': {
          name: 'Warn if a global function has no prototype ' +
            '(-Wmissing-prototypes)',
          valueType: 'boolean',
          superClass: '.compiler.warning.missingprototypes'
        },
        '-Wstrict-prototypes': {
          name: 'Warn if a function has no arg type (-Wstrict-prototypes)',
          valueType: 'boolean',
          superClass: '.compiler.warning.strictprototypes'
        },
        '-Wbad-function-cast': {
          name: 'Warn if wrong cast  (-Wbad-function-cast)',
          valueType: 'boolean',
          superClass: '.compiler.warning.badfunctioncast'
        },
        '--save-temps': {
          name: 'Save temporary files (--save-temps Use with caution!)',
          valueType: 'boolean',
          superClass: '.compiler.savetemps'
        },
        '-v': {
          name: 'Verbose',
          valueType: 'boolean',
          superClass: '.compiler.verbose'
        }
      }
    } else if (toolName === 'cppCompiler') {
      cdtOptions = {
        '-ansi': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.ansi'
        },
        '-std=gnu++98': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnucpp98'
        },
        '-std=c++11': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.cpp11'
        },
        '-std=c++0x': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.cpp0x'
        },
        '-std=gnu++11': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnucpp11'
        },
        '-std=gnu++0x': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnucpp0x'
        },

        '-std=c++14': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.cpp14'
        },
        '-std=c++1y': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.cpp1y'
        },
        '-std=gnu++14': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnucpp14'
        },
        '-std=gnu++1y': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnucpp1y'
        },
        '-std=c++1z': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.cpp1z'
        },
        '-std=gnu++1z': {
          name: 'Language standard',
          valueType: 'enumerated',
          superClass: '.compiler.std',
          value: '.compiler.std.gnucpp1z'
        },
        '-fabi-version=0': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.0'
        },
        '-fabi-version=1': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.1'
        },
        '-fabi-version=2': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.2'
        },
        '-fabi-version=3': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.3'
        },
        '-fabi-version=4': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.4'
        },
        '-fabi-version=5': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.5'
        },
        '-fabi-version=6': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.6'
        },
        '-fabi-version=7': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.7'
        },
        '-fabi-version=8': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.8'
        },
        '-fabi-version=9': {
          name: 'ABI version',
          valueType: 'enumerated',
          superClass: '.compiler.abiversion',
          value: '.compiler.abiversion.9'
        },
        '-fno-exceptions': {
          name: 'Do not use exceptions (-fno-exceptions)',
          valueType: 'boolean',
          superClass: '.compiler.noexceptions'
        },
        '-fno-rtti': {
          name: 'Do not use RTTI (-fno-rtti)',
          valueType: 'boolean',
          superClass: '.compiler.nortti'
        },
        '-fno-use-cxa-atexit': {
          name: 'Do not use _cxa_atexit() (-fno-use-cxa-atexit)',
          valueType: 'boolean',
          superClass: '.compiler.nousecxaatexit'
        },
        '-fno-threadsafe-statics': {
          name: 'Do not use thread-safe statics (-fno-threadsafe-statics)',
          valueType: 'boolean',
          superClass: '.compiler.nothreadsafestatics'
        },
        '-Wabi': {
          name: 'Warn on ABI violations (-Wabi)',
          valueType: 'boolean',
          superClass: '.compiler.warnabi'
        },
        '-Wctor-dtor-privacy': {
          name: 'Warn on class privacy (-Wctor-dtor-privacy)',
          valueType: 'boolean',
          superClass: '.compiler.warning.ctordtorprivacy'
        },
        '-Wnoexcept': {
          name: 'Warn on no-except expressions (-Wnoexcept)',
          valueType: 'boolean',
          superClass: '.compiler.warning.noexcept'
        },
        '-Wnon-virtual-dtor': {
          name: 'Warn on virtual destructors (-Wnon-virtual-dtor)',
          valueType: 'boolean',
          superClass: '.compiler.warning.nonvirtualdtor'
        },
        '-Wstrict-null-sentinel': {
          name: 'Warn on uncast NULL (-Wstrict-null-sentinel)',
          valueType: 'boolean',
          superClass: '.compiler.warning.strictnullsentinel'
        },
        '-Wsign-promo': {
          name: 'Warn on sign promotion (-Wsign-promo)',
          valueType: 'boolean',
          superClass: '.compiler.warning.signpromo'
        },
        '-Weffc++': {
          name: 'Warn about Effective C++ violations (-Weffc++)',
          valueType: 'boolean',
          superClass: '.compiler.warneffc'
        },
        '-nostdinc': {
          name: 'Do not search system directories (-nostdinc)',
          valueType: 'boolean',
          superClass: '.compiler.nostdinc'
        },
        '-nostdinc++': {
          name: 'Do not search system C++ directories (-nostdinc++)',
          valueType: 'boolean',
          superClass: '.compiler.nostdincpp'
        },
        '--save-temps': {
          name: 'Save temporary files (--save-temps Use with caution!)',
          valueType: 'boolean',
          superClass: '.compiler.savetemps'
        },
        '-v': {
          name: 'Verbose',
          valueType: 'boolean',
          superClass: '.compiler.verbose'
        }
      }
    }

    const opts = node.options.usedTools[toolName]
    const misc = this.prepareCdtOptions(opts, cdtOptions, undefined, prefix,
      optionLangPrefix, tool)

    // console.log(misc)
    if (misc.length > 0) {
      superId = optionLangPrefix + '.compiler.other'
      option = new CdtOptionString(
        this.cdtUids.uid('option'),
        'Other compiler flags',
        superId,
        misc.join(' '),
        false
      )
      tool.addOption(option)
    }

    superId = prefix + `.tool.${languagePart}.compiler.input`
    const toolInputId = this.cdtUids.uid(`tool.${toolName}.input`)
    const inputType = new CdtToolInputType(
      toolInputId,
      superId
    )
    tool.inputType = inputType

    if (node.name === 'tree') {
      cconfiguration.scannerConfigBuildInfos.push(
        new CdtScannerConfigBuildInfo(
          cconfiguration.id,
          toolId,
          toolInputId
        ))
    }

    return tool
  }

  prepareCdtOptions (optsArray, cdtOptions, cdtEnumeratedOptions,
    idPrefix, idLangPrefix, tool) {
    let superId
    let option

    const misc = []
    for (const opt of optsArray) {
      if (cdtOptions[opt]) {
        const optDef = cdtOptions[opt]
        if (optDef.valueType === 'boolean') {
          superId = idLangPrefix + optDef.superClass
          option = new CdtOptionBoolean(
            this.cdtUids.uid('option'),
            optDef.name,
            superId,
            true,
            optDef.useByScannerDiscovery
          )
          tool.addOption(option)
        } else if (optDef.valueType === 'enumerated') {
          superId = idLangPrefix + optDef.superClass
          option = new CdtOptionEnumerated(
            this.cdtUids.uid('option'),
            optDef.name,
            superId,
            idPrefix + optDef.value,
            optDef.useByScannerDiscovery
          )
          tool.addOption(option)
        } else {
          assert(false, `valueType ${optDef.valueType} not implemented`)
        }
      } else if (cdtEnumeratedOptions) {
        for (const [prefix, optDef] of
          Object.entries(cdtEnumeratedOptions)) {
          if (opt.startsWith(prefix)) {
            const optVal = opt.slice(prefix.length)
            if (optDef.values[optVal]) {
              superId = idLangPrefix + optDef.superClass
              option = new CdtOptionEnumerated(
                this.cdtUids.uid('option'),
                optDef.name,
                superId,
                idLangPrefix + optDef.value + optDef.values[optVal],
                optDef.useByScannerDiscovery
              )
              tool.addOption(option)
              break
            } else {
              console.log('not supported')
              throw new Error(`Option value ${opt} not implemented.`)
            }
          }
        }
      } else {
        misc.push(opt)
      }
    }
    return misc
  }

  prepareToolLinker (toolName, cconfiguration, node) {
    let superId
    const prefix = this.pluginId
    const toolchain = cconfiguration.buildConfiguration.toolchain
    let tool
    let languagePart
    if (toolName === 'cLinker') {
      languagePart = 'c'
    } else if (toolName === 'cppLinker') {
      languagePart = 'cpp'
    } else {
      throw new Error(`Linker ${toolName} unimplemented.`)
    }

    let macroValues
    // TODO: find a better source for the build.relativePath.
    macroValues = {
      'artefact.fullName': node.targetArtefact.fullName,
      'build.relativePath': node.buildRelativePath
    }

    const optionLangPrefix = prefix + '.option.' + languagePart
    let option

    superId = prefix + `.tool.${languagePart}.linker`
    tool = new CdtTool(
      this.cdtUids.uid(`tool.${toolName}`),
      toolchain.tools[toolName].fullDescription,
      superId
    )

    const scripts = node.options.tools[toolName]
      .propertyWithAddAndRemove_('LinkerScripts')
    if (scripts.length) {
      superId = optionLangPrefix + '.linker.scriptfile'
      option = new CdtOptionStringList(
        this.cdtUids.uid('option'),
        'Script files (-T)',
        superId
      )

      scripts.forEach((script) => {
        script = Macros.substitute(script, macroValues)
        option.addValue(script)
      })
      tool.addOption(option)
    }

    const libs = node.options.tools[toolName]
      .propertyWithAddAndRemove_('Libraries')
    if (libs.length) {
      superId = optionLangPrefix + '.linker.libs'
      option = new CdtOptionLibs(
        this.cdtUids.uid('option'),
        'Libraries (-l)',
        superId
      )

      libs.forEach((lib) => {
        option.addValue(lib)
      })
      tool.addOption(option)
    }

    const libPaths = node.options.tools[toolName]
      .propertyWithAddAndRemove_('LibraryFolders')
    if (libPaths.length) {
      superId = optionLangPrefix + '.linker.paths'
      option = new CdtOptionLibPaths(
        this.cdtUids.uid('option'),
        'Library search path (-L)',
        superId
      )

      for (let optionPath of libPaths) {
        if (!path.isAbsolute(optionPath)) {
          optionPath = path.posix.join(node.buildRelativePath, optionPath)
        }
        option.addValue(`"${optionPath}"`)
      }
      tool.addOption(option)
    }

    let cdtOptions
    cdtOptions = {
      '-nostartfiles': {
        name: 'Do not use standard start files (-nostartfiles)',
        valueType: 'boolean',
        superClass: '.linker.nostart',
        useByScannerDiscovery: false
      },
      '-nodefaultlibs': {
        name: 'Do not use default libraries (-nodefaultlibs)',
        valueType: 'boolean',
        superClass: '.linker.nodeflibs',
        useByScannerDiscovery: false
      },
      '-nostdlib': {
        name: 'No startup or default libs (-nostdlib)',
        valueType: 'boolean',
        superClass: '.linker.nostdlibs',
        useByScannerDiscovery: false
      },
      '-Xlinker --gc-sections': {
        name: 'Remove unused sections (-Xlinker --gc-sections)',
        valueType: 'boolean',
        superClass: '.linker.gcsections',
        useByScannerDiscovery: false
      },
      '-Wl,--gc-sections': {
        name: 'Remove unused sections (-Xlinker --gc-sections)',
        valueType: 'boolean',
        superClass: '.linker.gcsections',
        useByScannerDiscovery: false
      },
      '-Xlinker --print-gc-sections': {
        name: 'Print removed sections (-Xlinker --print-gc-sections)',
        valueType: 'boolean',
        superClass: '.linker.printgcsections',
        useByScannerDiscovery: false
      },
      '-Wl,--print-gc-sections': {
        name: 'Print removed sections (-Xlinker --print-gc-sections)',
        valueType: 'boolean',
        superClass: '.linker.printgcsections',
        useByScannerDiscovery: false
      },
      '-s': {
        name: 'Omit all symbol information (-s)',
        valueType: 'boolean',
        superClass: '.linker.strip',
        useByScannerDiscovery: false
      },
      '-Xlinker --cref': {
        name: 'Cross reference (-Xlinker --cref)',
        valueType: 'boolean',
        superClass: '.linker.cref',
        useByScannerDiscovery: false
      },
      '-Wl,--cref': {
        name: 'Cross reference (-Xlinker --cref)',
        valueType: 'boolean',
        superClass: '.linker.cref',
        useByScannerDiscovery: false
      },
      '-Wl,--print-map': {
        name: 'Print link map (-Xlinker --print-map)',
        valueType: 'boolean',
        superClass: '.linker.printmap',
        useByScannerDiscovery: false
      },
      '--specs=nano.specs': {
        name: 'Use newlib-nano (--specs=nano.specs)',
        valueType: 'boolean',
        superClass: '.linker.usenewlibnano',
        useByScannerDiscovery: false
      },
      '-u _printf_float': {
        name: 'Use float with nano printf (-u _printf_float)',
        valueType: 'boolean',
        superClass: '.linker.useprintffloat',
        useByScannerDiscovery: false
      },
      '-u _scanf_float': {
        name: 'Use float with nano scanf (-u _scanf_float)',
        valueType: 'boolean',
        superClass: '.linker.usescanffloat',
        useByScannerDiscovery: false
      },
      '-v': {
        name: 'Verbose (-v)',
        valueType: 'boolean',
        superClass: '.linker.verbose',
        useByScannerDiscovery: false
      }
    }

    const opts = node.options.usedTools[toolName]
    const misc = this.prepareCdtOptions(opts, cdtOptions, undefined, prefix,
      optionLangPrefix, tool)

    // console.log(misc)
    if (misc.length > 0) {
      superId = optionLangPrefix + '.linker.other'
      option = new CdtOptionString(
        this.cdtUids.uid('option'),
        'Other linker flags',
        superId,
        misc.join(' '),
        false
      )
      tool.addOption(option)
    }

    let inputType
    superId = prefix + `.tool.${languagePart}.linker.input`
    inputType = new CdtToolInputType(
      this.cdtUids.uid(`tool.${toolName}.input`),
      superId
    )
    inputType.additionalInputs.push(
      new CdtAdditionalInput('additionalinputdependency', '$(USER_OBJS)'))
    inputType.additionalInputs.push(
      new CdtAdditionalInput('additionalinput', '$(LIBS)'))
    tool.inputType = inputType

    return tool
  }

  prepareFolderInfo (buildFolderName, cconfiguration) {
    const buildConfiguration = cconfiguration.buildConfiguration
    const node =
      buildConfiguration.sourceTree.findFolderNode_(buildFolderName)

    const toolChainName = node.toolchain.fullDescription
    const toolChain =
      new CdtToolChain(
        this.cdtUids.uid(cconfiguration.toolChainSuperId),
        toolChainName,
        cconfiguration.toolChainSuperId,
        ''
      )
    const folderInfo = new CdtFolderInfo({
      ccid: cconfiguration.id,
      resourcePath: buildFolderName,
      toolChain: toolChain
    })

    // All other nodes have an `unusedChildren=` attribute (empty).
    toolChain.hasUnusedChildren = true
    toolChain.unusedChildren = ''

    folderInfo.toolChain = toolChain

    return folderInfo
  }

  prepareFiles (cconfiguration) {
    const files = []

    const buildConfiguration = cconfiguration.buildConfiguration

    for (const buildFile of Object.values(buildConfiguration.files)) {
      const file = new CdtFileInfo(cconfiguration.id, buildFile.name)
      files.push(file)
    }
    return files
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The EclipseCdtImporter class is added as a property of this object.
module.exports.EclipseCdtExporter = EclipseCdtExporter

// In ES6, it would be:
// export class EclipseCdtExporter { ... }
// ...
// import { EclipseCdtExporter } from './exporters/eclipse-cdt.js'

// ----------------------------------------------------------------------------
