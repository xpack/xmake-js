---
layout: page
lang: en
permalink: /xmake/files/xmake-json/
title: The xmake.json files
author: Liviu Ionescu

date: 2017-10-09 16:46:00 +0300

---

Deprecated: see xpbuild-json.md in web-jekyll.git.

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
which includes the `buildConfigurations` property, 
must be present in the project root.

```json
{
  "schemaVersion": "0.2.0",
  "artefact": {
    "type": "executable",
    "name": "${build.name}",
    "extension": ""
  },
  "targetPlatforms": {
    "stm32f4-discovery": { ... }
  },
  "toolchains": { ... },
  "profiles": { ... },
  "folders": {
    "/": {
      "addSymbols": [
        "GNU_SOURCE"
      ]
    }
  }
  "buildConfigurations": { ... }
}
```

Tests are a specific kind of executable projects, and are identified 
by an `xmake.json` in each test folder.

```json
{
  "schemaVersion": "0.2.0",
  "artefact": {
    "type": "executable",
    "name": "${build.name}",
    "extension": ""
  },
  "commands": {
    "run": [ "./${artefact.fullName}" ]
  },
  "addSymbols": [
    "GNU_SOURCE"
  ],
  "targetPlatforms": {
    "posix": { ... },
  },
  "toolchains": { ... },
  "profiles": { ... },
  "buildConfigurations": { ... }
}
```

### Lower case names

All object names (strictly speaking, JSON keys), must be composed 
from letters, hyphens, underscores or digits. When these names are used to 
create paths (like the configuration name), case is not significative 
and all letters are converted to lower case.

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

At the limit, all definitions can be entered in the configuration section;
however there may be many common definitions between build configurations;
to avoid repeating identical definitions, it is possible to define them
either globally, or grouped per toolchain, targetPlatform or profile.

Compiler options are initially contributed by the toolchain, and after them 
are added the configuration specific definitions (properties 
prefixed with `add`).

However some of the definitions may be contradictory; to avoid this, 
it is possible to remove unwanted definitions, by using properties 
prefixed with `remove`.

To minimise the influence of the order of operations, first all 
`addXxxx` properties are appended, then all `removeXxx` properties 
are removed; the detailed logic is:

- start with empty lists of options
- append the top definitions
- append the targetPlatform definitions
- append the toolchain definitions
- append the profile(s) definitions
- append the configuration definitions
- collect all unwanted definitions as instructed by 
top/targetPlatform/toolchain/profile(s)/configuration (order not relevant)
- remove unwanted definitions

Although the order of compiler options should not matter, 
the order of definitions is generally preserved. This might make some 
difference for the list of include folders.

TODO: decide if `removeXxx` make any sense in targetPlatform/profile(s). 


## Properties

### Schema version

Type: string.

This semver string identifies the expected structure of the JSON content.

```json
{
  "schemaVersion": "0.2.0"
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

By default, the xmake project names are the same as the folder name.

If needed, the names can be redefined in each project or test.

```json
{
  "schemaVersion": "...",
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

The `artefact` object may be defined at the top level, or for a given 
group, with each definition being searched hierarchically, bottom-up
(configuration, profiles, toolchain, targetPlatform, project); 
if none is defined, a default is applied (executable, same name as the 
project).

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

The artefact full name is obtained by concatenating the prefix, 
the name and the suffix.

By defining separate prefix/suffix properties, it is possible for some 
configurations to generate artefacts with slightly different names,
for example embedded toolchains may define the extension as `elf`.

For the American users, this property can be also spelled `artifact`.

### Generators

Type: Object.

It can be used only in project or test `xmake.json` files; using it 
in folder specific metadata files triggers an warning.

This object maps build generators to different command lines. 

The "default" property marks the default generator.

```json
{
  "builders": {
    "make": {
      "command": ["make"],
      "default": true
    },
    "ninja": {
      "command": ["ninja"]
      }
    }
  }
}
```

Currently only `make` and `ninja` are supported, but support for Eclipse 
managed projects is planned.

The selection of the generator can be overridden 
using the `--generator` on the command line.

### Commands ???

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
toolchain/targetPlatform/profile(s)/configuration.

```json
{
  "addSourceFolders": [
    "src"
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
all files with known extensions. On the way, 
the `.xmakeignore` files are used to skip some folders/files. 

When generating the build files, relative paths from the build folder 
to the actual files are created.

### Include folders

Type: array of strings.

This array defines the folders to be passed to the compiler as include 
folders. All paths are relative to the current folder.

Definitions are cumulative and can be contributed by
toolchain/targetPlatform/profile(s)/configuration.

```json
{
  "addIncludeFolders": [
    "include/xyz"
  ]
}
```

If a definition is not needed, it can be removed:

```json
{
  "removeIncludeFolders": [
    "include/abc"
  ]
}
```

If the definitions to be removed do not exist, they are silently ignored.

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
toolchain/targetPlatform/profile(s)/configuration.

If a definition is not needed, it can be removed:

```json
{
  "removeSymbols": [
    "GNU_SOURCE"
  ]
}
```

If the definitions to be removed do not exist, they are silently ignored.

### Toolchains

Type: object.

These objects define toolchains. Definitions are hierarchical, with 
child definitions inheriting from parent.


```json
{
  "toolchains": {
    "base": {
      "commandPrefix": "",
      "commandSuffix": "",
      "descriptionPrefix": "",
      "objectExtension": "o",
      "makeObjectsVariable": "OBJS",
  
      "tools": {
      }
    },
    "gcc": {
      "parent": ""base,
      "...": "..."
    }
  }
}
```

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

The `tools` object defines specific settings for one or more toolchain tools. 
It can be part of a configuration, profile or toolchain.

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
      "deps": "-MMD -MP -MF \"$(@:%.o=%.d)\" -MT\"$(@)\"",
      "outputFlag": "-o",
      "output": "\"$@\"",
      "inputs": "\"$<\"",
      "fileExtensions": {
        "c": {
          "prefix": "C"
        }
      }
    },
    "...": { ... }
  }
}
```

Please note that the above definitions are specific to the make syntax. 
If other builders are considered, it is recommended to use a portable 
syntax.

### Targets

Type: object.

The optional `targetPlatforms` object defines the possible targets, or platforms, 
the artefact is to be build for.

Target names are generally user defined strings. For portable applications
the `posix` name is recommended. 

Each targetPlatform may contribute its own specific definitions to the common 
definitions.

```json
{
  "targetPlatforms": {
    "posix": {
      "artefact": { ... },
      "excludedSourcePaths": [ ... ],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "options": { ... },
      "language": "..."
    },
    "stm32f4-discovery": {
      "artefact": { ... },
      "excludedSourcePaths": [ ... ],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "options": { ... },
      "language": "..."
      }
    }
  }
}
```

The `excludedPaths` array defines folders and/or files that should 
not be part of the build, for a specific targetPlatform.

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
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "options": { ... },
      "language": "..."
    },
    "release": {
      "artefact": { ... },
      "excludedSourcePaths": [],
      "addSourceFolders": [ ... ],
      "removeSourceFolders": [ ... ],
      "addIncludeFolders": [ ... ],
      "removeIncludeFolders": [ ... ],
      "addSymbols": [ ... ],
      "removeSymbols": [ ... ],
      "options": { ... },
      "language": "..."
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
  "schemaVersion": "...",
  "sourceFolder": true
}
```

To add exclusions or add/remove compiler settings, the definitions can apply 
to all configurations or to a specific configuration.

```json
{
  "schemaVersion": "...",
  "sourceFolders": {
    "excludedSourcePaths": [],
    "addIncludeFolders": [ ... ],
    "removeIncludeFolders": [ ... ],
    "addSymbols": [ ... ],
    "removeSymbols": [ ... ],
    "buildConfigurations": {
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
      "buildConfigurations": { ... }
    },
    "xyzFilePath2": {
      "addIncludeFolders": [],
      "removeIncludeFolders": [],
      "addSymbols": [],
      "removeSymbols": [],
      "buildConfigurations": { ... }
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
  "schemaVersion": "...",
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
toolchain/targetPlatform/profile(s)/configuration.

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

---

GCC includes

https://gcc.gnu.org/onlinedocs/cpp/Invocation.html
