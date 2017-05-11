# xmake.json

## Overview 

The `xmake.json` file defines the xmake metadata required by the build process.

This file is used in two contexts:
- when located in the project root, or in a test folder, this file 
defines how to build the artifact (executable or library); it must 
have a mandatory `name` field.
- when located in subfolders, it is simpler and it defines build 
details specific to 
the subfolder, usually compiler options and/or symbols.

Note: some sections may not strictly apply to the `xmake.json` file and
should be moved to a more general document about xmake.

## Lowercase names

Generally all names can be composed from letters, digits and dash. 
Case is not significative, and all names are converted to lowercase.

## Paths

All paths use the POSIX syntax, with `/` separators.


## Macros

In certain places, strings may contain macros, with the folloqing syntax:

```
${expression}
```

where _expression_ may be a name or a qualified name, like `test.name`.

## Add/remove

Generally definitions are organised hierarchically 
(top/target/profile/toolchain), with each child
being able to contribute new, more specific definitions, to the parent.

For each level, definitions are kept in an ordered list. The common use case is to 
copy definitions from the parent and add new definitions to the end of the 
list.

If a definition from the parent is definitely not wanted, the child can 
decide not to copy it, using the `removeXxx` properties.

## Build tree

The build tree is constructed of nodes. Nodes refer to folders or files;
the hierarchy follows the file system hierarchy.

Folder nodes may have other folders or file as children.

The build tree is contructed for each build configuration, i.e. for each
target/profile/toolchain.

Each new depth level may contribute additional compiler options to the build,
and files located in bottom levels may be compiled with different definitions
(options, symbols, includes, etc)

## Project or test 

To identify a folder as an xmake project, a full `xmake.json` file, 
which includes the `name` field, is expected in the project root.

Tests are a specific kind of executable projects, and are identified 
by an `xmake.json` in each test folder.

```json
{
  "version": "0.1.0",
  "name": "xyz",
  "artifact": {
    "type": "executable",
    "name": "${build.name}",
    "outputPrefix": "",
    "outputSuffix": "",
    "extension": ""
  },
  "generator": "make",
  "commands": {
    "build": [ "make" ],
    "run": [ "./${artifact.fullName}" ]
  },
  "addSourceFolders": [
    "src"
  ],
  "addSymbols": [
    "GNU_SOURCE"
  ],
  "addIncludeFolders": [
    "include"
  ],
  "targets": {
    "darwin": { ... },
    "stm32f4-discovery": { ... }
  },
  "sourceFolderSettings": { ... },
  "sourceFilesSettings": { ... }
}
```

## Version

Type: string.

This semver string identifies the expected structure of the content.

```json
{
  "version": "0.1.0"
}
```

It is mandatory for all `xmake.json` files. An old version of the xmake tools 
should refuse to process a newer, incompatible version of `xmake.json` file.

## Name

Type: string.

This string defines the build name. It is mandatory for projects and 
for tests.

```json
{
  "name": "xyz"
}
```

## Artifact

Type: object.

It can be used only in project or test `xmake.json` files; using it in folder 
specific metadata files triggers an warning.

The `artifact` object defines the type and name of the output file. 

The `type` property can be one of:

- `executable` (default)
- `staticLib` (default extension is `.a`)
- `sharedLib` (default extension is `.so` for Linux)

The `name` property defaults to the test name. It may include the macros 
`${build.name}` or `${test.name}`. If not present, it defaults to the 
mandatory project or test name.

The `artifact` object may be defined at top level, or for a given 
target/profile. Each definition is searched hierarchically, bottom-up; 
if present in the profile, it is used, otherwise the parent definition
it is used; if none is defined, a default is applied.

```json
{
  "artifact": {
    "type": "executable",
    "name": "${test.name}",
    "outputPrefix": "",
    "outputSuffix": "",
    "extension": ""
  }
}
```

## Generator

Type: string.

It can be used only in project or test `xmake.json` files; using it in folder 
specific metadata files triggers an warning.

This string identifies the generator used to create the project.

```json
{
  "generator": "make"
}
```

Currently only `make` is supported, but generators for Eclipse 
managed projects are planned.

## Commands

Type: object.

It can be used only in project or test `xmake.json` files; using it in folder 
specific metadata files triggers an warning.

The `commands` object associates external commands to different actions.

```json
{
  "commands": {
    "build": [ "make" ],
    "run": [ "./${artifact.fullName}" ]
  }
}
```

The actions are identified as object properties; the values are 
arrays of strings with command lines. 

When serialised, the values are string arrays; when parsed, the 
values may be strings, parsed as multiple words separated by spaces.

The `build` command is used to start the actual builder, after 
the build files were generated.

The `run` command is used to run a test, after a successful build. 
If the `run` command is missing in a test configuration, the test is
considered _build only_.

## Source folders

Type: array of strings.

This array defines the paths to the folders containing source files.
All paths are relative to the current folder.

Source folders can be defined hierarchically (top/target/profile), 
for all configurations or for a specific target/profile.

Definitions are cumulative, each may remove/add entries to the parent array.

For tests, which are located deeper in the hierarchy, a typical situation is:

```json
{
  "addSourceFolders": [
    "../../src",
    "."
  ]
}
```

If a definition from the parent is definitely not wanted, it can be removed:

```json
{
  "removeSourceFolders": [
    "lib"
  ]
}
```

If the definitions to be removed did not exist, warnigs are issued.

For a given build, all source folders are searched for source files, 
possible exclusions from `sourceFolderSettings` are processed, and the 
remaining files enter the build.

If, for a given profile, this array end up empty, and the current 
folder includes a `package.json`, the 
`directories.src` definition (an array of strings), if present, is used. 
Otherwise, if the `src` folder is present, it is used; if not, the current
folder is used.

When serialised, the values are string arrays; when parsed, the values 
may be strings, parsed as multiple words separated by spaces.

## Symbols

Type: array of strings.

This array defines symbols to be passed to the compiler preprocessor. 
Simple names or names and values are accepted.

```json
{
  "addSymbols": [
    "GNU_SOURCE",
    "NAME=value"
  ]
}
```

Definitions are cumulative, each may remove/add entries to the parent array.

If a definition from the parent is definitely not wanted, it can be removed:

```json
{
  "removeSymbols": [
    "GNU_SOURCE"
  ]
}
```

If the definitions to be removed did not exist, warnigs are issued.

When serialised, the values are string arrays; when parsed, the values 
may be strings, parsed as multiple words separated by spaces.

## Include folders

Type: array of strings.

This array defines the folders to be passed to the compiler as include 
folders. All paths are relative to the current folder.

Include folders can be defined hierarchically (top/target/profile), 
for all configurations or for a specific target/profile.

Definitions are cumulative, each may remove/add entries to the parent array.

```json
{
  "addIncludeFolders": [
    "include/xyz"
  ]
}
```

If a definition from the parent is definitely not wanted, it can be removed:

```json
{
  "removeIncludeFolders": [
    "include/abc"
  ]
}
```

If the definitions to be removed did not exist, warnigs are issued.

If, for a given profile, this array end up empty, and the current folder includes a `package.json`, the 
`directories.include` definition (an array of strings), if present, is used. 
Otherwise, if the `include` folder is present, it is used; if not, the current
folder is used.

When generating the build files, relative paths from the build folder 
to the actual files are created.

When serialised, the values are string arrays; when parsed, the values 
may be strings, parsed as multiple words separated by spaces.

## Targets

Type: object.

The `targets` object defines the possible targets, or platforms, the 
artifact is to be build.

Each target may include several profiles.

Each target may contribute its own specific definitions to the common 
definitions.

```json
{
  "targets": {
    "darwin": {
      "artifact": { ... },
      "excludedPaths": [],
      "removeSourceFolders": [],
      "addSourceFolders": [],
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "profiles": { ... },
    },
    "stm32f4-discovery": {
      "crossBuildPlatforms": [
        "darwin", "linux", "windows"
      ],
      "artifact": { ... },
      "excludedPaths": [],
      "removeSourceFolders": [],
      "addSourceFolders": [],
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "profiles": { ... },
      }
    }
  }
}
```

The `excludedPaths` array defines folders and/or files that should 
not be part of the build, for a specific target.

Target names are predefined strings.

TODO: define where target names come from.

## Profiles

Type: object.

The `profiles` object defines the possible slightly different builds, 
typically debug/release.

Each profile may be built with several toolchains.

Each profile may contribute its own specific definitions to the common 
definitions.

```json
{
  "profiles": {
    "debug": {
      "artifact": { ... },
      "excludedPaths": [],
      "removeSourceFolders": [],
      "addSourceFolders": [],
      "removeSymbols": [],
      "addSymbols": [],
      "addIncludeFolders": [],
      "removeIncludeFolders": [],
      "toolchains": {...}
    },
    "release": {
      "artifact": {...},
      "excludedPaths": [],
      "removeSourceFolders": [],
      "addSourceFolders": [],
      "removeSymbols": [],
      "addSymbols": [],
      "addIncludeFolders": [],
      "removeIncludeFolders": [],
      "toolchains": {...}
    }
  }
}
```

The `excludedPaths` array defines folders and/or files that should 
not be part of the build, for a specific target.

Profile names are user defined strings.

## Toolchains

Type: object.

The `toolchains` object defines the command line options used for each compiler.

Each toolchain may contribute its own specific definitions to the common 
definitions.

```json
{
  "toolchains": {
    "gcc": {
      "artifact": { ... },
      "excludedPaths": [],
      "removeSourceFolders": [],
      "addSourceFolders": [],
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "options": {...},
      "tools": {...}
    },
    "arm-none-eabi-gcc": {
      "artifact": { ... },
      "excludedPaths": [],
      "removeSourceFolders": [],
      "addSourceFolders": [],
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "options": {...},
      "tools": {...}
    }
  }
}
```

The `excludedPaths` array defines folders and/or files that should 
not be part of the build, for a specific target.

Toolchain names are predefined strings.

TODO: define where Toolchain names come from.

## Options

Type: object.

The `options` object defines settings common for all tools.

```json
{
  "options": {
    "target": "-mcpu=cortex-m3",
    "debugging": "-g3",
    "optimizations": "-O3",
    "warnings": "-Wall",
    "miscellaneous": ""
  }
}
```

TODO: think of another solution, either a different name (common?) or 
a generic way to define options for all tools or for some tools.

## Tools

Type: object.

The `tools` object defines specific settings for one or more tools. 
When applied to a file, only one tool is significative, according 
to the file extension.


```json
{
  "tools": {
    "c": {
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludes": [],
      "addIncludes": [],
      "removeOptimizations": [],
      "addOptimizations": [],
      "removeWarnings": [],
      "addWarnings": [],
      "removeMiscellaneous": [],
      "addMiscellaneous": []
    }
  }
}
```

When serialised, the values are string arrays; when parsed, the values 
may be strings, parsed as multiple words separated by spaces.

## Folder/file specific metadata

The definitions in the top `xmake.json` file apply to all files that enter 
the build.

However it is possible to enter specific definitions for folders, and 
in this case they apply for all files in the folder, or for a specific file.

Two kinds of data can be defined:
- for source folders, which are the exclusions (folders and/or files)
- the compiler settings for each folder/file.

The folder/file settings are distributed in each folder, with file 
paths local to the folder.

When refering to the build or test root folder, the content is added in 
the `xmake-build.json` or `xmake-test.json`.

```json
{
  "sourceFolderSettings": {
    "excludedPaths": [],
    "removeSymbols": [],
    "addSymbols": [],
    "removeIncludeFolders": [],
    "addIncludeFolders": [],
    "targets": { ... }
  },
  "sourceFilesSettings": {
    "xyzFilePath1": {
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "targets": { ... }
    },
    "xyzFilePath2": {
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "targets": { ... }
    }
  }
}
```

## Excluded paths

Type" array of strings.

The `excludedPaths` array defines folders and/or files that should 
not be part of the build, for all configurations or a specific configuration.

Excluded paths are relative to the current folder, and should refer to 
files/folders in the current folder (in other words, a folder should 
not define exclusion from a child folder).

## TODO

- add linker definitions
- add pre/post actions
