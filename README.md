[![npm (scoped)](https://img.shields.io/npm/v/xmake.svg)](https://www.npmjs.com/package/xmake) 
[![license](https://img.shields.io/github/license/xpack/xmake-js.svg)](https://github.com/xpack/xmake-js/blob/master/LICENSE)
[![Standard](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com/)
[![Travis](https://img.shields.io/travis/xpack/xmake-js.svg?label=linux)](https://travis-ci.org/xpack/xmake-js)
[![AppVeyor](https://ci.appveyor.com/api/projects/status/q3qssksnuwhd1ifp?svg=true)](https://ci.appveyor.com/project/ilg-ul/xmake-js)

## The xPack builder command line tool.

A Node.js CLI application to build xPacks.

## xPacks overview

**xPacks** are general purpose software C/C++ packages, intended to enhance code sharing and reusing during the development of C/C++ libraries and applications, much the same as **npm modules** do so nicely in the JavaScript ecosystem.

## Purpose

The main purpose of the `xmake` tool is to build xPacks. It can be seen as a combination of cMake+make. The initial version will actually generate the make files, and call make.

## Prerequisites

If this is your first encounter with `npm`, you need to install the [node.js](https://nodejs.org/) JavScript run-time. The process is straighforward and does not polute the system locations significantly; just pick the current version, download the package suitable for your platform and install it as usual. The result is a binary program called `node` that can be used to execute JavaScript code from the terminal, and a link called `npm`, pointing to the `npm-cli.js` script, which is part of the node module that implements the npm functionality. On Windows, it is recommended to first install the [Git for Windows](https://git-scm.com/download/win) package.

## Easy install

The module is available as [**xmake**](https://www.npmjs.com/package/xmake) from the public repository; with `npm` already available, installing `xmake` is quite easy:

```bash
$ sudo npm install xmake --global
```

On Windows, global packages are installed in the user home folder, and do not require `sudo`.

The module provides the `xmake` executable, which is a possible reason to install it globally.

The development repository is available from the GitHub [xpack/xmake-js](https://github.com/xpack/xmake-js) project.

To remove `xmake`, the command is similar:

```bash
$ sudo npm uninstall xmake --global
```

(On Windows `sudo` is not required`).

## User info

To get an initial glimpse on the program, ask for help:

```
$ xmake --help

The xPack builder command line tool
Usage: xmake <command> [<subcommand>...] [<options> ...] [<args>...]

where <command> is one of:
  build, test

Common options:
  --loglevel <level>     Set log level (silent|warn|info|verbose|debug|trace) 
  -s|--silent            Disable all messages (--loglevel silent) 
  -q|--quiet             Mostly quiet (--loglevel warn) 
  -v|--verbose           Informative verbose (--loglevel info) 
  -vv                    Very verbose (--loglevel verbose, or -v -v) 
  -d|--debug             Debug messages (--loglevel debug) 
  -dd|--trace            Trace messages (--loglevel trace) 
  -C <folder>            Set current folder 

xmake -h|--help            Quick help
xmake <command> -h|--help  Quick help on command

xmake --version            Show version 
xmake -i|--interactive     Enter interactive mode 

npm xmake@0.1.0 '/Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git'
Home page: <https://github.com/xpack/xmake-js>
Bug reports: <https://github.com/xpack/xmake-js/issues>
```

TBD

## Developer info

### Git repo

```bash
$ git clone https://github.com/xpack/xmake-js.git xmake-js.git
$ cd xmake-js.git
$ npm install
$ sudo npm link 
$ ls -l /usr/local/lib/node_modules/
```

A link to the development folder should be present in the system `node_modules` folder, and also a link to the `xmake` executable should be available system wide.

### Tests

The tests use the [`node-tap`](http://www.node-tap.org) framework (_A Test-Anything-Protocol library for Node.js_, written by Isaac Schlueter).

As for any `npm` package, the standard way to run the project tests is via `npm test`:

```bash
$ cd xmake-js.git
$ npm install
$ npm test
```

A typical test result looks like:

```
$ npm run test
...
```

To run a specific test with more verbose output, use `npm run tap`:

```
$ npm run tap test/tap/...
```

### Coverage tests

Coverage tests are a good indication on how much of the source files is exercised by the tests. Ideally all source files should be covered 100%, for all 4 criteria (statements, branches, functions, lines).

To run the coverage tests, use `npm run test-coverage`:

```
$ npm run test-coverage
...
```

### Continuous Integration (CI)

The continuous integration tests are performed via [Travis CI](https://travis-ci.org/xpack/xmake-js) and [AppVeyor](https://ci.appveyor.com/project/ilg-ul/xmake-js).

### Standard compliance

The module uses ECMAScript 6 class definitions.

As style, it uses the [JavaScript Standard Style](https://standardjs.com/), automatically checked at each commit via Travis CI.

Known and accepted exceptions:

- none.

To manually fix compliance with the style guide (where possible):

```
$ npm run fix

> xmake@0.1.10 fix /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
> standard --fix

```

### Documentation metadata

The documentation metadata follows the [JSdoc](http://usejsdoc.org) tags.

To enforce checking at file level, add the following comments right after the `use strict`:

```
'use strict'
/* eslint valid-jsdoc: "error" */
/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */
```

Note: be sure C style comments are used, C++ styles are not parsed by [ESLint](http://eslint.org).

## License

The original content is released under the MIT License, with
all rights reserved to Liviu Ionescu.

## Note

The `xmake` tool will be available soon.

