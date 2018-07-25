---
layout: page
lang: en
permalink: /xmake/files/xmake-json/
title: The xmake.json files
author: Liviu Ionescu

date: 2017-10-09 16:46:00 +0300

---

## Overview 

The `xmake.json` file defines the metadata required by the xmake build process.
It can also be named `.xmake.json`.

This file is used in two contexts:
- when located in the project root, or in a test folder, this file 
defines how to build the artefact (executable or library); the 
recommended name is `xmake.json`
- when located in subfolders, it is usually simpler and it defines the build 
details specific to 
the subfolder, for example compiler options and/or symbols; the 
recommended name is `.xmake.json`;

To identify a folder as an xmake project, a full `xmake.json` file, 
which includes the `configurations` property, 
must be present in the project root.

```json
{
  "version": "0.2.0",
  "artefact": {
    "type": "executable",
    "name": "${build.name}",
    "extension": "elf"
  },
  "generator": "make",
  "commands": {
    "build": [ "make" ],
  },
  "addSymbols": [
    "GNU_SOURCE"
  ],
  "targets": {
    "stm32f4-discovery": { ... }
  },
  "toolchains": { ... },
  "profiles": { ... },
  "configurations": { ... }
}
```

Tests are a specific kind of executable projects, and are identified 
by an `xmake.json` in each test folder.

```json
{
  "version": "0.2.0",
  "artefact": {
    "type": "executable",
    "name": "${build.name}",
    "extension": ""
  },
  "generator": "make",
  "commands": {
    "build": [ "make" ],
    "run": [ "./${artefact.fullName}" ]
  },
  "addSymbols": [
    "GNU_SOURCE"
  ],
  "targets": {
    "posix": { ... },
  },
  "toolchains": { ... },
  "profiles": { ... },
  "configurations": { ... }
}
```

### Lower case names

All object names (strictly speaking, JSON keys), must be composed 
from letters, hyphens, or digits. When these names are used to 
create paths, case is not significative and all letters are converted to 
lower case.

### Paths

For portability reasons, all paths used in `xmake.json` files
must follow the POSIX syntax, with `/` separators.

### Macros

In certain places, strings may contain macros, with the following syntax:

```bash
${expression}
```

where _expression_ can be a name (like `version`) or a qualified name
(like `build.name`).

### Add/remove

Definitions are initially contributed by the toolchain, and after them 
are added the configuration specific definitions (properties 
prefixed with `add`).

However some of the definitions may be contradictory; to avoid this, 
it is possible to remove unwanted definitions, by using properties 
prefixed with `remove`.

To minimise the influence of the order of operations, first all 
`addXxxx` properties are appended, then all `removeXxx` properties 
are removed; the detailed logic is:

- start with empty lists of options
- copy toolchain definitions
- append definitions contributed by target/profile(s)/configuration
- remove unwanted definitions as instructed by target/profile(s)/configuration

TODO: decide if `removeXxx` make any sense in target/profile(s). 

## Properties

### Version

Type: string.

This semver string identifies the expected structure of the JSON content.

```json
{
  "version": "0.2.0"
}
```

It is mandatory for all `[.]xmake.json` files. A recent version of the 
xmake tools should be prepared to parse all older version of the
`[.]xmake.json` files. An old version of the xmake tools 
should throw an error when asked to process a newer, incompatible 
version of `[.]xmake.json` file.

Note: versions prefixed with `0` are considered experimental 
and may change at any time, without maintaining compatibility.

### Name

Type: string.

This string defines the build or test name. 

By default, the xmake names are the same as the folder name.

If needed, the names can be redefined in each project or test.

```json
{
  "version": "...",
  "name": "xyz"
}
```

This name can be accessed as `${build.name}`.

### Artefact

Type: object.

It can be used only in project or test `xmake.json` files; using it 
in folder specific metadata files triggers an warning.

The `artefact` object defines the type and name of the output file. 

The `type` property can be one of:

- `executable` (default)
- `staticLib` (default extension is `.a`)
- `sharedLib` (default extension is `.so` for Linux)

The `name` property defaults to the test name. It may include the macros 
`${build.name}`.

The `artefact` object may be defined at top level, or for a given 
target/profile. Each definition is searched hierarchically, bottom-up; 
if present in the profile, it is used, otherwise the parent definition
it is used; if none is defined, a default is applied.

```json
{
  "artefact": {
    "type": "executable",
    "name": "${build.name}",
    "outputPrefix": "",
    "outputSuffix": "",
    "extension": ""
  }
}
```

The artefact name is obtained by concatenating the prefix, the name and the
suffix.

By defining separate prefix/suffix properties, it is possible for some 
configurations to generate artefacts with slightly different names.

For the American users, this property can be also spelled `artifact`.

### Generator

Type: string.

It can be used only in project or test `xmake.json` files; using it 
in folder 
specific metadata files triggers an warning.

This string identifies the generator used to create the project.

```json
{
  "generator": "make"
}
```

Currently only `make` is supported, but generators for `ninja` and Eclipse 
managed projects are planned.

This setting can be overridden using the `--generator` on the command line.

### Commands

Type: object.

It can be used only in project or test `xmake.json` files; using it 
in folder 
specific metadata files triggers an warning.

The `commands` object associates external commands to different actions.

```json
{
  "commands": {
    "build": [ "make" ],
    "run": [ "./${artefact.fullName}" ]
  }
}
```

The actions are identified as object properties; the values are 
arrays of strings with command lines. 

The `build` command is used to start the actual builder, after 
the build files were generated.

The `run` command is used to run a test, after a successful build. 
If the `run` command is missing in a test configuration, the test is
considered _build only_.

### Source folders

Type: array of strings.

This array defines the folders containing source files.
All paths are relative to the current folder.

Definitions are cumulative and can be contributed by
toolchain/target/profile(s)/configuration.

```json
{
  "addSourceFolders": [
    "./src"
  ]
}
```

If a definition is not needed, it can be removed:

```json
{
  "removeSourceFolders": [
    "./lib"
  ]
}
```

If the definitions to be removed do not exist, warnings are issued.

The build process will handle all source folders by recursively identifying
all files with known extensions. On the way, the local `.xmake.json`
files will be inspected and if `excludedSourcePaths` are present, those
folders/files will not be included in the build.

If, for a given configuration, the source folders array ends up empty, 
and the current folder includes a `package.json`, the 
`xpack.directories.src` definition (an array of strings), if present, is used. 
Otherwise, if the `src` folder is present, it is used; if not, the current
folder is used.

When generating the build files, relative paths from the build folder 
to the actual files are created.

### Include folders

Type: array of strings.

This array defines the folders to be passed to the compiler as include 
folders. All paths are relative to the current folder.

Definitions are cumulative and can be contributed by
toolchain/target/profile(s)/configuration.

```json
{
  "addIncludeFolders": [
    "./include/xyz"
  ]
}
```

If a definition is not needed, it can be removed:

```json
{
  "removeIncludeFolders": [
    "./include/abc"
  ]
}
```

If the definitions to be removed do not exist, warnings are issued.

If, for a given configuration, this array ends up empty, and the current 
folder includes a `package.json`, the 
`xpack.directories.include` definition (an array of strings), if present, is used. 
Otherwise, if the `include` folder is present, it is used; if not, the current
folder is used.

When generating the build files, relative paths from the build folder 
to the actual files are created.


### Symbols

Type: array of strings.

This array defines symbols to be passed to the compiler preprocessor. 
Simple names or pairs of names and values are accepted.

```json
{
  "addSymbols": [
    "GNU_SOURCE",
    "NAME=value"
  ]
}
```

Definitions are cumulative and can be contributed by
toolchain/target/profile(s)/configuration.

If a definition is not needed, it can be removed:

```json
{
  "removeSymbols": [
    "GNU_SOURCE"
  ]
}
```

If the definitions to be removed do not exist, warnings are issued.

### Toolchains

Type: object.

The `toolchains` object defines the command line options used for each compiler.

Each toolchain may contribute its own specific definitions to the common 
definitions.

```json
{
  "toolchains": {
    "gcc": {
      "artefact": { ... },
      "excludedSourcePaths": [ ... ],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addDiscoveryFolders": [ ... ],
      "removeDiscoveryFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "options": { ... },
      "tools": { ... }
    },
    "arm-none-eabi-gcc": {
      "parent": "gcc",
      "artefact": { ... },
      "excludedSourcePaths": [ ... ],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addDiscoveryFolders": [ ... ],
      "removeDiscoveryFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "options": { ... },
      "tools": { ... }
    }
  }
}
```

The `excludedPaths` array defines folders and/or files that should 
not be part of the build, for a specific toolchain.

Toolchain names are predefined strings.

TODO: explain where Toolchain names come from.

### Options 

Type: object.

The `options` object defines settings common for all tools.

```json
{
  "options": {
    "addArchitecture": [ "-mcpu=cortex-m3" ],
    "removeArchitecture": [ ... ],
    "addDebugging": [ "-g3" ],
    "removeDebugging": [ ... ],
    "addOptimizations": [ "-O3" ],
    "removeOptimizations": [ ... ],
    "addWarnings": [ "-Wall" ],
    "removeWarnings": [ ... ],
    "addMiscellaneous": [ ... ],
    "removeMiscellaneous": [ ... ]
  }
}
```

### Tools

Type: object.

The `tools` object defines specific settings for one or more toolchain tools. It can be part of a configuration, profile or toolchain.

When applied to a file, only one tool is significative, according 
to the file extension; all other tools are ignored.

```json
{
  "tools": {
    "c": {
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addDiscoveryFolders": [ ... ],
      "removeDiscoveryFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "addDebugging": [ ... ],
      "removeDebugging": [ ... ],
      "addOptimizations": [ ... ],
      "removeOptimizations": [ ... ],
      "addWarnings": [ ... ],
      "removeWarnings": [ ... ],
      "addMiscellaneous": [ ... ],
      "removeMiscellaneous": [ ... ]
    }
  }
}
```

When `tools` is part of a `toolchain` definition, the properties are:

```json
{
  "tools": {
    "c": {
      "commandName": "gcc",
      "options": "-c",
      "deps": "-MMD -MP -MF\"$(@:%.o=%.d)\" -MT\"$(@)\"",
      "outputFlag": "-o",
      "output": "\"$@\"",
      "inputs": "\"$<\"",
      "fileExtensions": {
        "c": {
          "prefix": "C"
        }
      }
    },
  "...": "..."
}
```

Please note that the above definitions are specific to the make syntax. 
If other generators are considered, it is recommended to use a portable 
syntax.

### Targets

Type: object.

The optional `targets` object defines the possible targets, or platforms, 
the artefact is to be build for.

Target names are generally user defined strings. For portable applications
the `posix` name is recommended. 

Each target may contribute its own specific definitions to the common 
definitions.

```json
{
  "targets": {
    "posix": {
      "artefact": { ... },
      "excludedSourcePaths": [ ... ],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addDiscoveryFolders": [ ... ],
      "removeDiscoveryFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ]
    },
    "stm32f4-discovery": {
      "artefact": { ... },
      "excludedSourcePaths": [ ... ],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addDiscoveryFolders": [ ... ],
      "removeDiscoveryFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ]
      }
    }
  }
}
```

The `excludedPaths` array defines folders and/or files that should 
not be part of the build, for a specific target.

### Profiles

Type: object.

The optional `profiles` object defines groups of options, 
typically debug/release.

Profile names are user defined strings.

Each profile may contribute its own specific definitions to the common 
definitions.

```json
{
  "profiles": {
    "debug": {
      "artefact": { ... },
      "excludedSourcePaths": [ ... ],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addDiscoveryFolders": [ ... ],
      "removeDiscoveryFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "options": { ... },
      "tools": { ... }
    },
    "release": {
      "artefact": { ... },
      "excludedSourcePaths": [],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addDiscoveryFolders": [ ... ],
      "removeDiscoveryFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "options": { ... },
      "tools": { ... }
    }
  }
}
```

The `excludedPaths` array defines folders and/or files that should 
not be part of the build, for a specific profile.

## Folder/file specific metadata

The definitions in the top `[.]xmake.json` file apply to all files that enter 
the build.

However it is possible to enter specific definitions for folders, and 
in this case they apply for all files in the folder, or for a specific file.

Several kinds of data can be defined:
- mark that a folder is a source folder
- for source folders, define a list of exclusions (folders and/or files)
- for source folders/files, define possible different compiler settings.

The folder/file settings are not kept in the top file, but are distributed 
in each folder, with file paths local to the folder.

To mark that the current folder is a source folder, the minimum definition is:

```json
{
  "version": "...",
  "sourceFolder": true
}
```

To add exclusions or add/remove compiler settings, the definitions can apply 
to all configurations or to a specific configuration.

```json
{
  "version": "...",
  "sourceFolder": {
    "excludedSourcePaths": [],
    "addIncludeFolders": [ ... ],
    "removeIncludeFolders": [ ... ],
    "addSymbols": [ ... ],
    "removeSymbols": [ ... ],
    "configurations": {
      "xyz": {
        "excludedSourcePaths": [],
        "addIncludeFolders": [],
        "removeIncludeFolders": [],
        "addSymbols": [],
        "removeSymbols": []
      }
     }
  },
  "sourceFiles": {
    "xyzFilePath1": {
      "addIncludeFolders": [],
      "removeIncludeFolders": [],
      "addSymbols": [],
      "removeSymbols": [],
      "configurations": { ... }
    },
    "xyzFilePath2": {
      "addIncludeFolders": [],
      "removeIncludeFolders": [],
      "addSymbols": [],
      "removeSymbols": [],
      "configurations": { ... }
    }
  }
}
```

### Excluded source paths

Type: array of strings.

The `excludedSourcePaths` array defines source folders/files that should 
not be part of the build, for all configurations or for a specific 
configuration.

```json
{
  "version": "...",
  "excludedSourcePaths": [
    "mem1.c",
    "mem3.c",
    "subfolder"
  ]
}
```

Excluded paths are relative to the current folder, and should refer only to 
files/folders in the current folder (in other words, a folder should 
not define exclusion from a child folder).

For large projects it is recommended to define explicit exclusions for 
folders that are known to not include source folders, to minimise search
times during build.

## TODO

- add linker definitions
- add pre/post actions

---

## Auto discovery folders

Type: array of strings.

This array defines the paths to the folders to be _searched for_ 
source and include folders.
this is slightly different from the list of folders _containing_ source 
or include files, and is intended to help maintaining large projects.

For projects created from nicely structured xPacks, which have clear
`src` & `include` folders, manually maintaining the project list of 
source and include folders might not be very difficult, although for 
large projects the size of those lists may be problematic.

Unfortunately there are many libraries that are poorly structured,
with multiple source and include folders all over the hierarchy,
and manually maintaining those lists becomes a challenge.

The auto discovery feature is based on some small additional metadata
(`.xmake.json` files) which tags the folders as source and/or include 
folders, and a 
recursive search for this metadata. Discovered folders are added 
after the explicitly defined folders.

To prevent some folders to be searched, they can be listed in 
`.xmake.ignore`.

By keeping the metadata in the actual source folders, reorganising 
projects and moving
folders around needs no top metadata updates, thus simplifying project
management.

All paths are relative to the current folder. To make things obvious,
it is recommended to prefix the relative paths with `./`.

Definitions are cumulative and can be contributed by
toolchain/target/profile(s)/configuration.

For tests, which are located deeper in the file system hierarchy, 
a typical configuration is:

```json
{
  "addDiscoveryFolders": [
    "../../src",
    "."
  ]
}
```

If a definition is not needed, it can be removed:

```json
{
  "removeDiscoveryFolders": [
    "lib"
  ]
}
```

If the definitions to be removed do not exist, warnings are issued.
