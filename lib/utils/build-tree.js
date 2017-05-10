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
 * Classes to manage the build tree.
 *
 * The build tree is a tree of folder nodes, with file nodes as leaves.
 * It maps 1:1 to the filesystem folders and files.
 * The root node corresponds to the package root; all input paths
 * are relative to it.
 *
 * Each node may have computed toolchain definitions:
 * .symbols
 * .includes
 * .options.optimizations
 * .options.warnings
 * .options.miscellaneous
 *
 * All the above are getters, that cache results
 *
 * The input definitions are:
 * .removeSymbols
 * .addSymbols
 * .removeIncludes
 * .addIncludes
 * .options.removeOptimizations
 * .options.addOptimizations
 * .options.removeWarnings
 * .options.addWarnings
 * .options.removeMiscellaneous
 * .options.addMiscellaneous
 *
 * The link between file types and tools is defined by `fileTypes`.
 */

// ----------------------------------------------------------------------------

// const assert = require('assert')
const fs = require('fs')
const path = require('path')

// TODO: extract to a separate module
const Promisifier = require('@ilg/es6-promisifier').Promisifier

// ES6: `import { CliCommand, CliExitCodes, CliError } from 'cli-start-options'
// const CliExitCodes = require('@ilg/cli-start-options').CliExitCodes
// const CliError = require('@ilg/cli-start-options').CliError
// const CliErrorApplication =
//  require('@ilg/cli-start-options').CliErrorApplication

// ----------------------------------------------------------------------------

// Promisify functions from the Node.js callbacks library.
// New functions have similar names, but suffixed with `Promise`.
// Promisifier.promisifyInPlace(fs, 'readFile')
Promisifier.promisifyInPlace(fs, 'stat')
Promisifier.promisifyInPlace(fs, 'readdir')
// Promisifier.promisifyInPlace(fs, 'mkdir')
// Promisifier.promisifyInPlace(fs, 'writeFile')

// ----------------------------------------------------------------------------

/**
 * @typedef FileType
 */

const fileTypes = {
  '.c': { tool: 'c', prefix: 'C', ext: 'c' },
  '.cpp': { tool: 'cpp', prefix: 'CPP', ext: 'cpp' },
  '.C': { tool: 'cpp', prefix: 'C_UPPER', ext: 'C' },
  '.c++': { tool: 'cpp', prefix: 'C++', ext: 'c++' },
  '.cxx': { tool: 'cpp', prefix: 'CXX', ext: 'cxx' },
  '.S': { tool: 'as', prefix: 'S_UPPER', ext: 'S' },
  '.asm': { tool: 'as', prefix: 'ASM', ext: 'asm' }
}

// ============================================================================

class NodeOptions {
  constructor (node) {
    this.node = node
    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files,
    // for folders or files.

    this.removeOptimizations_ = undefined // string[]
    this.addOptimizations_ = undefined // string[]

    this.removeWarnings_ = undefined // string[]
    this.addWarnings_ = undefined // string[]

    this.removeMiscellaneous_ = undefined // string[]
    this.removeMiscellaneous_ = undefined // string[]

    // ------------------------------------------------------------------------
    // These properties will be computed and cached.

    this.optimizations_ = undefined
    this.warnings_ = undefined
    this.miscellaneous_ = undefined
  }

  get optimizations () {
    if (!this.optimizations_) {
      this.optimizations_ = []
      const parentOptions =
        this.node.parent ? this.node.parent.optimizations : []
      if (parentOptions.length > 0) {
        if (this.removeOptimizations_) {
          // If removables, filter parent includes.
          for (const option of parentOptions) {
            let found = false
            for (const toRemove of this.removeOptimizations_) {
              // Removables are strings and match by common comparison.
              if (option === toRemove) {
                found = true
                break
              }
            }
            if (!found) {
              this.optimizations_.push(option)
            }
          }
        } else {
          // If no removables, copy parent entirely.
          for (const option of parentOptions) {
            this.optimizations_.push(option)
          }
        }
      }
      if (this.addOptimizations_) {
        for (const symbol of this.addOptimizations_) {
          this.optimizations_.push(symbol)
        }
      }
    }
    return this.optimizations_
  }

  get warnings () {
    if (!this.warnings_) {
      this.warnings_ = []
      const parentOptions =
        this.node.parent ? this.node.parent.warnings : []
      if (parentOptions.length > 0) {
        if (this.removeWarnings_) {
          // If removables, filter parent includes.
          for (const option of parentOptions) {
            let found = false
            for (const toRemove of this.removeWarnings_) {
              // Removables are strings and match by common comparison.
              if (option === toRemove) {
                found = true
                break
              }
            }
            if (!found) {
              this.warnings_.push(option)
            }
          }
        } else {
          // If no removables, copy parent entirely.
          for (const option of parentOptions) {
            this.warnings_.push(option)
          }
        }
      }
      if (this.addWarnings_) {
        for (const symbol of this.addWarnings_) {
          this.warnings_.push(symbol)
        }
      }
    }
    return this.warnings_
  }

  get miscellaneous () {
    if (!this.miscellaneous_) {
      this.miscellaneous_ = []
      const parentOptions =
        this.node.parent ? this.node.parent.miscellaneous : []
      if (parentOptions.length > 0) {
        if (this.removeMiscellaneous_) {
          // If removables, filter parent includes.
          for (const option of parentOptions) {
            let found = false
            for (const toRemove of this.removeMiscellaneous_) {
              // Removables are strings and match by common comparison.
              if (option === toRemove) {
                found = true
                break
              }
            }
            if (!found) {
              this.miscellaneous_.push(option)
            }
          }
        } else {
          // If no removables, copy parent entirely.
          for (const option of parentOptions) {
            this.miscellaneous_.push(option)
          }
        }
      }
      if (this.addMiscellaneous_) {
        for (const symbol of this.addMiscellaneous_) {
          this.miscellaneous_.push(symbol)
        }
      }
    }
    return this.miscellaneous_
  }
}

// ============================================================================

class Node {
  // --------------------------------------------------------------------------

  constructor (context, parent, name) {
    this.context = context
    this.log = context.log

    this.name = name
    this.parent = parent

    this.clear()
  }

  clear () {
    // ------------------------------------------------------------------------
    // These properties might be set from configuration files,
    // for folders or files.

    this.removeSymbols_ = undefined // string[]
    this.addSymbols_ = undefined // string[]

    this.removeIncludes_ = undefined // string[]
    this.addIncludes_ = undefined // string[]

    this.options = new NodeOptions(this)

    // ------------------------------------------------------------------------
    // These properties will be computed and cached.

    this.absolutePath_ = undefined // string
    this.relativePath_ = undefined // string

    this.symbols_ = undefined // string[]
    this.includes_ = undefined // string[]

    this.allString = undefined // string
  }

  get absolutePath () {
    if (!this.absolutePath_) {
      this.absolutePath_ =
        path.resolve(this.parent.absolutePath, this.name)
    }
    return this.absolutePath_
  }

  get relativePath () {
    if (!this.relativePath_) {
      this.relativePath_ =
        path.join(this.parent.relativePath, this.name)
    }
    return this.relativePath_
  }

  get symbols () {
    if (!this.symbols_) {
      this.symbols_ = []
      const parentSymbols = this.parent.symbols
      if (parentSymbols.length > 0) {
        if (this.removeSymbols_) {
          // If removables, filter parent symbols.
          for (const symbol of parentSymbols) {
            let found = false
            for (const toRemove of this.removeSymbols_) {
              // Removables should be names only, but also match
              // existing name=value definitions.
              if ((symbol === toRemove) ||
                symbol.startsWith(toRemove + '=')) {
                found = true
                break
              }
            }
            if (!found) {
              this.symbols_.push(symbol)
            }
          }
        } else {
          // If no removables, copy parent entirely.
          for (const symbol of parentSymbols) {
            this.symbols_.push(symbol)
          }
        }
      }
      if (this.addSymbols_) {
        for (const symbol of this.addSymbols_) {
          this.symbols_.push(symbol)
        }
      }
    }
    return this.symbols_
  }

  get includes () {
    if (!this.includes_) {
      this.includes_ = []
      const parentIncludes = this.parent.includes
      if (parentIncludes.length > 0) {
        if (this.removeIncludes_) {
          // If removables, filter parent includes.
          for (const include of parentIncludes) {
            let found = false
            for (const toRemove of this.removeIncludes_) {
              // Removables are strings and match by common comparison.
              if (include === toRemove) {
                found = true
                break
              }
            }
            if (!found) {
              this.includes_.push(include)
            }
          }
        } else {
          // If no removables, copy parent entirely.
          for (const include of parentIncludes) {
            this.includes_.push(include)
          }
        }
      }
      if (this.addIncludes_) {
        for (const symbol of this.addIncludes_) {
          this.symbols_.push(symbol)
        }
      }
    }
    return this.includes_
  }

  toString () {
    if (!this.allString_) {
      const options =
        this.optimizations.concat(this.warnings, this.miscellaneous)
      this.allString_ = options.join(' ')
    }
    return this.allString_
  }
}

// ============================================================================

class FileNode extends Node {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set the context.
   *
   * @param {Object} context Reference to a context.
   * @param {FolderNode|SourceTree|null} parent Reference to parent node.
   * @param {string} name File name, as in the file system.
   * @param {FileType} fileType Reference to structure defining the file type.
   */
  constructor (context, parent, name, fileType) {
    super(context, parent, name)

    const log = this.log
    log.trace(`${this.constructor.name}.construct(${name})`)

    this.fileType = fileType
    this.shortName = name.substr(0, name.length - fileType.ext.length - 1)

    parent.files.push(this)
  }

  // --------------------------------------------------------------------------
}

// ============================================================================

class FolderNode extends Node {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set the context.
   *
   * @param {Object} context Reference to a context.
   * @param {FolderNode|SourceTree} parent Reference to parent node.
   * @param {string} name Folder name, as in the file system.
   */
  constructor (context, parent, name) {
    super(context, parent, name)

    const log = this.log
    log.trace(`${this.constructor.name}.construct(${name})`)

    this.folders = []
    this.files = []

    if (parent) {
      parent.folders.push(this)
    }
  }

  // --------------------------------------------------------------------------
}

// ============================================================================

class SourceTree extends Node {
  // --------------------------------------------------------------------------

  /**
   * @summary Constructor, to set the context.
   *
   * @param {Object} context Reference to a context.
   */
  constructor (context) {
    super(context, null, 'tree')

    const log = this.log
    log.trace(`${this.constructor.name}.constructor()`)

    this.absolutePath_ = context.config.cwd

    this.folders = []
    this.files = []
  }

  // override
  get absolutePath () {
    return this.absolutePath_
  }

  // override
  get relativePath () {
    return ''
  }

  async create (sourceFolders) {
    const log = this.log
    log.trace(`${this.constructor.name}.create()`)

    for (const folder of sourceFolders) {
      await this.addFolder(this, folder)
    }
  }

  async addFolder (parent, folder) {
    const log = this.log
    const context = this.context

    // Extract the first part and the rest.
    const parts = path.normalize(folder).split(path.sep, 2)

    // log.trace(`parts: ${parts}`)
    const childFolder = new FolderNode(context, parent, parts[0])

    if (parts.length === 1) {
      // log.trace(`recurse ${childFolder.relativePath}`)

      // Recursively iterate files and folders below this folder.
      const absolutePath = childFolder.absolutePath
      const names = await fs.readdirPromise(absolutePath)
      for (let name of names) {
        // log.trace(name)
        const stat = await fs.statPromise(path.resolve(absolutePath, name))
        if (stat.isDirectory()) {
          // Recurse
          await this.addFolder(childFolder, name)
        } else if (stat.isFile()) {
          // Split path into parts, to extract extension.
          const parsed = path.parse(name)
          const fileType = fileTypes[parsed.ext]
          if (fileType) {
            // As a known extension, this must be a source file.
            const fileNode = new FileNode(context, childFolder, name, fileType)
            log.debug(`source file: ${fileNode.relativePath}`)
          } else {
            log.trace(name)
          }
        }
      }
    }

    if (parts.length > 1) {
      await this.addFolder(childFolder, parts[1])
    }
  }

  getSourceFolders (out) {
    return this.getSourceFoldersRecursive(this, out)
  }

  getSourceFoldersRecursive (node, out) {
    if (node.folders) {
      if (node.files.length > 0) {
        out.push(node)
      }
      for (const folder of node.folders) {
        this.getSourceFoldersRecursive(folder, out)
      }
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The Test class is added as a property of this object.
module.exports.FileNode = FileNode
module.exports.FolderNode = FolderNode
module.exports.SourceTree = SourceTree
module.exports.fileTypes = fileTypes

// In ES6, it would be:
// export class FileNode { ... }
// ...
// import { FileNode, FolderNode, SourceTree } from 'utils/build-tree.js'

// ----------------------------------------------------------------------------
