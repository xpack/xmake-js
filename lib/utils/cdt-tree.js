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

const path = require('path')

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
    // Map of configurations for each node.
    // this.configurations = {}

    // ------------------------------------------------------------------------
    // These properties will be computed and cached.

    this.absolutePath_ = undefined // string
    this.relativePath_ = undefined // string
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
   */
  constructor (context, parent, name) {
    super(context, parent, name)

    const log = this.log
    log.trace(`${this.constructor.name}.construct(${name})`)

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

class CdtTree extends Node {
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

  addFolder (folderPath) {
    return this.addNodeRecursive(this, folderPath, false)
  }

  addFile (filePath) {
    return this.addNodeRecursive(this, filePath, true)
  }

  addNodeRecursive (parent, path_, isFile) {
    // const log = this.log
    const context = this.context

    // Extract the first part and the rest.
    const parts = path.normalize(path_).split(path.sep, 2)

    if (parts.length === 1) {
      if (isFile) {
        const childFile = new FileNode(context, parent, parts[0])
        return childFile
      } else {
        const childFolder = new FolderNode(context, parent, parts[0])
        return childFolder
      }
    } else {
      const childFolder = new FolderNode(context, parent, parts[0])
      return this.addNodeRecursive(childFolder, parts[1], isFile)
    }
  }

  // --------------------------------------------------------------------------
}

// ----------------------------------------------------------------------------
// Node.js specific export definitions.

// By default, `module.exports = {}`.
// The classes are added as properties of this object.
module.exports.FileNode = FileNode
module.exports.FolderNode = FolderNode
module.exports.CdtTree = CdtTree

// In ES6, it would be:
// export class FileNode { ... }
// ...
// import { FileNode, FolderNode, CdtTree } from 'utils/cdt-tree.js'

// ----------------------------------------------------------------------------
