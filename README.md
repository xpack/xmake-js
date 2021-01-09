[![npm (scoped)](https://img.shields.io/npm/v/xmake.svg)](https://www.npmjs.com/package/xmake) 
[![license](https://img.shields.io/github/license/xpack/xmake-js.svg)](https://github.com/xpack/xmake-js/blob/master/LICENSE)
[![Standard](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com/)
[![Travis](https://img.shields.io/travis/xpack/xmake-js.svg?label=linux)](https://travis-ci.org/xpack/xmake-js)
[![AppVeyor](https://ci.appveyor.com/api/projects/status/q3qssksnuwhd1ifp?svg=true)](https://ci.appveyor.com/project/ilg-ul/xmake-js)

## The xPack builder command line tool.

A Node.js CLI application to build xPacks.

## xPacks overview

**xPacks** are general purpose software **C/C++ packages**, intended to 
enhance code **sharing** and **reusing** during the development of 
C/C++ libraries and applications, much the same as **npm modules** 
do so nicely in the JavaScript ecosystem.

## Purpose

The main purpose of the `xmake` tool is to build xPacks, but it
can be used outside xPacks as well. The approach 
is similar to `cmake`, just that instead of using a proprietary 
scripting language (with a syntax not exactly easy to parse, or 
even to read), it uses a JSON file, which can be easily processed 
by any 3rd party tools.

Functionally, `xmake` can be seen as a combination of `cmake+make`. 
The initial version actually generates the `make` files, and call 
`make`. Future versions will also import/export Eclipse CDT configurations.

## Prerequisites

If this is your first encounter with `npm`, you need to install the 
[Node.js](https://nodejs.org/) JavaScript run-time. The process is 
straightforward and does not pollute the system locations significantly; 
there are two `node` versions, LTS (Long Term Service) and Current; 
generally it is safer to use LTS, especially on Windows.
Download the package suitable for your platform and install it as usual.
The result is a binary program called `node` that can be used to execute 
JavaScript code from the terminal, and a link called `npm`, pointing to 
the `npm-cli.js` script, which is part of the node module that implements 
the npm functionality. 

Although not mandatory for `xmake`, on Windows, it is recommended to 
also install the [Git for Windows](https://git-scm.com/download/win) package.

## Easy install

The recommended use case is to refer `xmake` in the `devDependencies` 
section of an xPack, and the rest is handled automatically.

For manual use, the command line module is available as 
[`xmake`](https://www.npmjs.com/package/xmake) from the public repository; 
with `npm` already available, installing `xmake` is quite easy:

```console
$ sudo npm install --global xmake
```

or 

```console
$ npm install --global xmake
```

if `npm` was configured to use a local folder, as explained in the 
[xpm](https://www.npmjs.com/package/xpm) page.

On **Windows**, global packages are installed in the user home folder, and 
do not require administrative right anyway.

The development repository is available from the GitHub 
[xpack/xmake-js](https://github.com/xpack/xmake-js) project.

To remove `xmake`, the command is similar:

```console
$ npm uninstall --global xmake
```

(On **macOS**/**GNU/Linux**, if installed in a system folder, 
`sudo` is required).

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

npm xmake@0.3.8 '/Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git'
Home page: <https://github.com/xpack/xmake-js>
Bug reports: <https://github.com/xpack/xmake-js/issues>
```

```console
$ xmake build --help

xmake - build project configuration(s)
Usage: xmake build [options...] [--config <name>]* [--build-folder <path>]
                   [-- <build args>]
where:
  <build args>...        Extra arguments for the builder (optional, multiple)

Build options:
  --config <name>        Configuration name (optional, multiple)
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

npm xmake@0.3.8 '/Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git'
Home page: <https://github.com/xpack/xmake-js>
Bug reports: <https://github.com/xpack/xmake-js/issues>
```

A typical build run is via `xpm run`:

```console
$ xpm run build
xPack manager - run package specific script

Changing current folder to '/Users/ilg/tmp/xp'...
Invoking 'xmake build -- all'...

xmake - build project configuration(s)

Generating the the 'make' files for configuration 'hifive1-gcc-debug'...
'make' files generated in 89 ms.

Changing current folder to 'build/hifive1-gcc-debug'...

Invoking builder: 'make all'...
[riscv-none-embed-gcc]: src/newlib-syscalls.c
[riscv-none-embed-g++]: src/initialize-hardware.cpp
[riscv-none-embed-g++]: src/interrupts-handlers.cpp
[riscv-none-embed-g++]: src/led.cpp
[riscv-none-embed-g++]: src/main.cpp
[riscv-none-embed-g++]: src/sysclock.cpp
[riscv-none-embed-gcc]: xpacks/micro-os-plus-c-libs/src/_sbrk.c
[riscv-none-embed-g++]: xpacks/micro-os-plus-c-libs/src/c-syscalls-empty.cpp
[riscv-none-embed-gcc]: xpacks/micro-os-plus-c-libs/src/stdlib/assert.c
[riscv-none-embed-gcc]: xpacks/micro-os-plus-c-libs/src/stdlib/exit.c
[riscv-none-embed-gcc]: xpacks/micro-os-plus-c-libs/src/stdlib/init-fini.c
[riscv-none-embed-g++]: xpacks/micro-os-plus-c-libs/src/stdlib/atexit.cpp
[riscv-none-embed-g++]: xpacks/micro-os-plus-cpp-libs/src/cxx.cpp
[riscv-none-embed-g++]: xpacks/micro-os-plus-diag-trace/src/trace.cpp
[riscv-none-embed-g++]: xpacks/micro-os-plus-riscv-arch/src/arch-functions.cpp
[riscv-none-embed-g++]: xpacks/micro-os-plus-riscv-arch/src/traps.cpp
[riscv-none-embed-gcc]: xpacks/micro-os-plus-riscv-arch/src/reset-entry.S
[riscv-none-embed-gcc]: xpacks/micro-os-plus-riscv-arch/src/trap-entry.S
[riscv-none-embed-g++]: xpacks/micro-os-plus-startup/src/startup.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/device-functions.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/plic-functions.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/arty/e31/device-interrupts.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/arty/e51/device-interrupts.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/fe310/device-interrupts.cpp
[riscv-none-embed-g++]: xpacks/sifive-hifive1-board/src/board-functions.cpp
[riscv-none-embed-g++]: xpacks/sifive-hifive1-board/src/trace-uart.cpp
[riscv-none-embed-g++]: xp.elf
'make all' completed in 5.862 sec.

Generating the the 'make' files for configuration 'hifive1-gcc-release'...
'make' files generated in 58 ms.

Changing current folder to 'build/hifive1-gcc-release'...

Invoking builder: 'make all'...
[riscv-none-embed-gcc]: src/newlib-syscalls.c
[riscv-none-embed-g++]: src/initialize-hardware.cpp
[riscv-none-embed-g++]: src/interrupts-handlers.cpp
[riscv-none-embed-g++]: src/led.cpp
[riscv-none-embed-g++]: src/main.cpp
[riscv-none-embed-g++]: src/sysclock.cpp
[riscv-none-embed-gcc]: xpacks/micro-os-plus-c-libs/src/_sbrk.c
[riscv-none-embed-g++]: xpacks/micro-os-plus-c-libs/src/c-syscalls-empty.cpp
[riscv-none-embed-gcc]: xpacks/micro-os-plus-c-libs/src/stdlib/assert.c
[riscv-none-embed-gcc]: xpacks/micro-os-plus-c-libs/src/stdlib/exit.c
[riscv-none-embed-gcc]: xpacks/micro-os-plus-c-libs/src/stdlib/init-fini.c
[riscv-none-embed-g++]: xpacks/micro-os-plus-c-libs/src/stdlib/atexit.cpp
[riscv-none-embed-g++]: xpacks/micro-os-plus-cpp-libs/src/cxx.cpp
[riscv-none-embed-g++]: xpacks/micro-os-plus-diag-trace/src/trace.cpp
[riscv-none-embed-g++]: xpacks/micro-os-plus-riscv-arch/src/arch-functions.cpp
[riscv-none-embed-g++]: xpacks/micro-os-plus-riscv-arch/src/traps.cpp
[riscv-none-embed-gcc]: xpacks/micro-os-plus-riscv-arch/src/reset-entry.S
[riscv-none-embed-gcc]: xpacks/micro-os-plus-riscv-arch/src/trap-entry.S
[riscv-none-embed-g++]: xpacks/micro-os-plus-startup/src/startup.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/device-functions.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/plic-functions.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/arty/e31/device-interrupts.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/arty/e51/device-interrupts.cpp
[riscv-none-embed-g++]: xpacks/sifive-devices/src/fe310/device-interrupts.cpp
[riscv-none-embed-g++]: xpacks/sifive-hifive1-board/src/board-functions.cpp
[riscv-none-embed-g++]: xpacks/sifive-hifive1-board/src/trace-uart.cpp
[riscv-none-embed-g++]: xp.elf
'make all' completed in 5.412 sec.

'xmake build' completed in 11.494 sec.

'xpm run build' completed in 12.075 sec.
$
```

## Metadata

`xmake` consumes `xmake.json` directly and generates `make` files. 

TODO: add a link to the JSON definition.

## Developer info

### Git repo

```console
$ git clone https://github.com/xpack/xmake-js.git xmake-js.git
$ cd xmake-js.git
$ npm install
$ sudo npm link 
$ ls -l /usr/local/lib/node_modules/
```

A link to the development folder should be present in the system 
`node_modules` folder, and also a link to the `xmake` executable 
should be available system wide.

### Tests

The tests use the [`node-tap`](http://www.node-tap.org) framework 
(_A Test-Anything-Protocol library for Node.js_, written by Isaac Schlueter).

As for any `npm` package, the standard way to run the project tests is 
via `npm test`:

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
$ npm run tap test/tap/010-options-common.js

> xmake@0.3.8 tap /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
> tap --reporter=spec --timeout 300 --no-color "test/tap/010-options-common.js"


test/tap/010-options-common.js
  setup
    ✓ package ok
    ✓ version length > 0
    ✓ package xmake@0.3.8

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

Coverage tests are a good indication on how much of the source files 
is exercised by the tests. Ideally all source files should be covered 
100%, for all 4 criteria (statements, branches, functions, lines).

To run the coverage tests, use `npm run test-coverage`:

```console
$ npm run test-coverage

> xmake@0.3.8 tap /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
> tap --reporter=spec --timeout 300 --no-color "test/tap/010-options-common.js"


test/tap/010-options-common.js
  setup
    ✓ package ok
    ✓ version length > 0
    ✓ package xmake@0.3.8

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
ilg-mbp:xmake-js.git ilg$
ilg-mbp:xmake-js.git ilg$
ilg-mbp:xmake-js.git ilg$ npm run test-coverage

> xmake@0.3.8 test-coverage /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
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
All files       |    11.97 |     1.02 |    13.33 |    11.97 |                |
 bin            |      100 |      100 |      100 |      100 |                |
  xmake.js      |      100 |      100 |      100 |      100 |                |
 lib            |      100 |      100 |      100 |      100 |                |
  main.js       |      100 |      100 |      100 |      100 |                |
 lib/generators |     9.91 |        0 |        0 |     9.91 |                |
  make.js       |     9.91 |        0 |        0 |     9.91 |... 298,299,303 |
 lib/utils      |     5.34 |        0 |        0 |     5.34 |                |
  artefact.js   |     8.33 |        0 |        0 |     8.33 |... 50,52,53,56 |
  build-tree.js |     5.15 |        0 |        0 |     5.15 |... 539,541,542 |
 lib/xmake      |    14.02 |     2.41 |    26.92 |    14.02 |                |
  test.js       |    14.02 |     2.41 |    26.92 |    14.02 |... 580,581,585 |
----------------|----------|----------|----------|----------|----------------|
```

### Continuous Integration (CI)

The continuous integration tests are performed via 
[Travis CI](https://travis-ci.org/xpack/xmake-js) (for POSIX) and 
[AppVeyor](https://ci.appveyor.com/project/ilg-ul/xmake-js) (for Windows).

To speed up things, the `node_modules` folder is cached between builds.

### Standard compliance

The module uses ECMAScript 6 class definitions.

As style, it uses the [JavaScript Standard Style](https://standardjs.com/), 
automatically checked at each commit via Travis CI.

Known and accepted exceptions:

- `// eslint-disable-line no-template-curly-in-string, max-len` to allow 
macro substitutions for `command.run`

To manually fix compliance with the style guide (where possible):

```console
$ npm run fix

> xmake@0.3.8 fix /Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git
> standard --fix
```

### Documentation metadata

The documentation metadata follows the [JSdoc](http://usejsdoc.org) tags.

To enforce checking at file level, add the following comments right after 
the `use strict`:

```js
'use strict'
/* eslint valid-jsdoc: "error" */
/* eslint max-len: [ "error", 80, { "ignoreUrls": true } ] */
```

Note: be sure C style comments are used, C++ styles are not parsed by 
[ESLint](http://eslint.org).

### How to publish

* commit all changes
* `npm run test` (`fix` included)
* update `CHANGELOG.md`; commit with a message like _CHANGELOG: prepare v0.1.2_
* `npm version patch`
* push all changes to GitHub; this should trigger CI
* wait for CI tests to complete
* `npm publish`

## License

The original content is released under the 
[MIT License](https://opensource.org/licenses/MIT), with all rights reserved to 
[Liviu Ionescu](https://github.com/ilg-ul).

## Note

The `xmake` tool is currently under development and should not be used in 
production environments.
