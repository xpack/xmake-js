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

```console
$ sudo npm install xmake --global
```

On Windows, global packages are installed in the user home folder, and do not require `sudo`.

The module provides the `xmake` executable, which is a possible reason to install it globally.

The development repository is available from the GitHub [xpack/xmake-js](https://github.com/xpack/xmake-js) project.

To remove `xmake`, the command is similar:

```console
$ sudo npm uninstall xmake --global
```

(On Windows `sudo` is not required`).

## User info

To get an initial glimpse on the program, ask for help:

```console
$ xmake --help

The xPack builder command line tool
Usage: xmake <command> [<subcommand>...] [<options> ...] [<args>...]

where <command> is one of:
  build, import, test

Common options:
  --loglevel <level>       Set log level (silent|warn|info|verbose|debug|trace) 
  -s|--silent              Disable all messages (--loglevel silent) 
  -q|--quiet               Mostly quiet, warnings and errors (--loglevel warn) 
  --informative            Informative (--loglevel info) 
  -v|--verbose             Verbose (--loglevel verbose) 
  -d|--debug               Debug messages (--loglevel debug) 
  -dd|--trace              Trace messages (--loglevel trace, -d -d) 
  -C <folder>              Set current folder 

xmake -h|--help            Quick help 
xmake <command> -h|--help  Quick help on command 
xmake --version            Show version 
xmake -i|--interactive     Enter interactive mode 

npm xmake@0.2.0 '/Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git'
Home page: <https://github.com/xpack/xmake-js>
Bug reports: <https://github.com/xpack/xmake-js/issues>
```

```console
$ xmake build --help

Build one or all project configurations
Usage: xmake build [options...] [--target <name>]* [--profile <name>]*
                   [--toolchain <name>]* [--build-folder <path>]
                   [-- <build args>]
where:
  <build args>...        Extra arguments for the builder (optional, multiple)

Build options:
  --target <name>        Target name (optional, multiple)
  --profile <name>       Profile name (optional, multiple)
  --toolchain <name>     Toolchain name (optional, multiple)
  --build-folder <path>  Build folder, default build (optional)

Common options:
  --loglevel <level>     Set log level (silent|warn|info|verbose|debug|trace) 
  -s|--silent            Disable all messages (--loglevel silent) 
  -q|--quiet             Mostly quiet, warnings and errors (--loglevel warn) 
  --informative          Informative (--loglevel info) 
  -v|--verbose           Verbose (--loglevel verbose) 
  -d|--debug             Debug messages (--loglevel debug) 
  -dd|--trace            Trace messages (--loglevel trace, -d -d) 
  -C <folder>            Set current folder 

xmake -h|--help          Quick help 
xmake --version          Show version 
xmake -i|--interactive   Enter interactive mode 

npm xmake@0.2.0 '/Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git'
Home page: <https://github.com/xpack/xmake-js>
Bug reports: <https://github.com/xpack/xmake-js/issues>
```

## Developer info

### Git repo

```console
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

```console
$ cd xmake-js.git
$ npm install
$ npm test
```

A typical test result looks like:

```console
$ npm run test

> xmake@0.3.4 test /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
> standard && npm run test-tap -s

test/tap/010-options-common.js ...................... 24/24
test/tap/020-module-invocation.js ..................... 9/9
test/tap/030-interactive.js ......................... 12/12
test/tap/040-cmd-test.js ............................ 24/24
total ............................................... 69/69

  69 passing (3s)

  ok
```

To run a specific test with more verbose output, use `npm run tap`:

```console
$ $ npm run tap test/tap/010-options-common.js

> xmake@0.3.4 tap /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
> tap --reporter=spec --timeout 300 --no-color "test/tap/010-options-common.js"

test/tap/010-options-common.js
  setup
    ✓ package ok
    ✓ version length > 0
    ✓ package xmake@0.3.4

  xmake --version (spawn)
    ✓ exit ok
    ✓ version ok
    ✓ stderr empty

  xmake -h (spawn)
    ✓ exit ok
    ✓ has Usage
    ✓ has title
    ✓ has -h|--help
    ✓ has <command> -h|--help
    ✓ has --version
    ✓ has -i|--interactive
    ✓ has log levels
    ✓ has -s|--silent
    ✓ has Bug reports:
    ✓ stderr empty

  xmake --help (spawn)
    ✓ exit ok
    ✓ has Usage
    ✓ stderr empty

  xmake -d (spawn)
    ✓ exit ok
    ✓ has stdout
    ✓ has debug
    ✓ stderr empty


  24 passing (1s)
```

### Coverage tests

Coverage tests are a good indication on how much of the source files is exercised by the tests. Ideally all source files should be covered 100%, for all 4 criteria (statements, branches, functions, lines).

To run the coverage tests, use `npm run test-coverage`:

```console
$npm run test-coverage

> xmake@0.3.4 test-coverage /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
> tap --coverage --reporter=classic --timeout 600 --no-color "test/tap/*.js"

test/tap/010-options-common.js ...................... 24/24
test/tap/020-module-invocation.js ..................... 9/9
test/tap/030-interactive.js ......................... 12/12
test/tap/040-cmd-test.js ............................ 24/24
total ............................................... 69/69

  69 passing (8s)

  ok
----------------|----------|----------|----------|----------|----------------|
File            |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
----------------|----------|----------|----------|----------|----------------|
All files       |    12.01 |     1.03 |    13.33 |    12.01 |                |
 bin            |      100 |      100 |      100 |      100 |                |
  xmake.js      |      100 |      100 |      100 |      100 |                |
 lib            |      100 |      100 |      100 |      100 |                |
  main.js       |      100 |      100 |      100 |      100 |                |
 lib/generators |     9.91 |        0 |        0 |     9.91 |                |
  make.js       |     9.91 |        0 |        0 |     9.91 |... 298,299,303 |
 lib/utils      |     5.39 |        0 |        0 |     5.39 |                |
  artefact.js   |     8.33 |        0 |        0 |     8.33 |... 50,52,53,56 |
  build-tree.js |     5.21 |        0 |        0 |     5.21 |... 535,537,538 |
 lib/xmake      |    14.02 |     2.41 |    26.92 |    14.02 |                |
  test.js       |    14.02 |     2.41 |    26.92 |    14.02 |... 580,581,585 |
----------------|----------|----------|----------|----------|----------------|
```

### Continuous Integration (CI)

The continuous integration tests are performed via [Travis CI](https://travis-ci.org/xpack/xmake-js) (for POSIX) and [AppVeyor](https://ci.appveyor.com/project/ilg-ul/xmake-js) (for Windows).

To speed up things, the `node_modules` folder is cached between builds.

### Standard compliance

The module uses ECMAScript 6 class definitions.

As style, it uses the [JavaScript Standard Style](https://standardjs.com/), automatically checked at each commit via Travis CI.

Known and accepted exceptions:

- '// eslint-disable-line no-template-curly-in-string, max-len' to allow macro substitutions for `command.run`

To manually fix compliance with the style guide (where possible):

```console
$ npm run fix

> xmake@0.1.10 fix /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
> standard --fix
```

### Documentation metadata

The documentation metadata follows the [JSdoc](http://usejsdoc.org) tags.

To enforce checking at file level, add the following comments right after the `use strict`:

```js
'use strict'
/* eslint valid-jsdoc: "error" */
/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */
```

Note: be sure C style comments are used, C++ styles are not parsed by [ESLint](http://eslint.org).

## License

The original content is released under the MIT License, with
all rights reserved to Liviu Ionescu.

## Note

The `xmake` tool is currently under development, and the specifications may change.

