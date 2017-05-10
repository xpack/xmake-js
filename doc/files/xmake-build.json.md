# xmake-build.json

This file defines the build configurations.

## Top 

```json
{
  "version": "0.1.0",
  "name": "xyz",
  "sourceFolders": [
    "src"
  ],
  "includeFolders": [
    "include"
  ],
  "generator": "make",
  "commands": {
    "build": "make",
    "run": "./${artifact.fullName}"
  },
  "artifact": {
    "type": "executable",
    "name": "${build.name}",
    "outputPrefix": "",
    "outputSuffix": "",
    "extension": ""
  },
  "targets": {
    "darwin": { ... },
    "stm32f4-discovery": { ... }
  },
  "sourceFolderSettings": { ... },
  "sourceFilesSettings": { ... }
}
```

The `sourceFolderSettings` and `sourceFilesSettings` are from `xmake.json`, to avoid using multiple files.

The `command.run` definition is used for tests.

## Artifact

The `artifact` object defines the type and name of the output file. 

The `type` property can be
- `executable` (default)
- `staticLib`
- `sharedLib`

The `name` property defaults to the test name.

The `artifact` object may be defined at top level, or for a given profile. Each definition is searched hierarchically; if present in the profile, it is used, otherwise it the top definition is present, it is used; if none is defined, a default is used.

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

## Targets

The `targets` object:

```json
{
  "targets": {
    "darwin": {
      "addSourceFolders": [],
      "addSymbols": [],
      "addIncludeFolders": [],
      "artifact": { ... },
      "profiles": { ... },
    },
    "stm32f4-discovery": {
      "crossBuildPlatforms": [
        "darwin", "linux", "windows"
      ],
      "addSourceFolders": [],
      "addSymbols": [],
      "addIncludeFolders": [],
      "artifact": { ... },
      "profiles": { ... },
      }
    }
  }
}
```

## Profiles

The `profiles` object ...

```json
{
  "profiles": {
    "debug": {
      "artifact": { ... },
      "addSourceFolders": [],
      "addSymbols": [],
      "addIncludeFolders": [],
      "toolchains": {...}
    },
    "release": {
      "artifact": {...},
      "addSourceFolders": [],
      "addSymbols": [],
      "addIncludeFolders": [],
      "toolchains": {...}
    }
  }
}
```

## Toolchains

The `toolchains` object:

```json
{
  "toolchains": {
    "gcc": {
      "artifact": { ... },
      "addSourceFolders": [],
      "addSymbols": [],
      "addIncludeFolders": [],
      "options": {...},
      "tools": {...}
    },
    "arm-none-eabi-gcc": {
      "artifact": { ... },
      "addSourceFolders": [],
      "addSymbols": [],
      "addIncludeFolders": [],
      "options": {...},
      "tools": {...}
    }
  }
}
```

## Options

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

TODO: think of another solution, either a different name (common?) or a generic way to define for all tools or for some tools.

## Tools

The `tools` object defines specific settings for one or more tools.

When serialised, the values are string arrays; when parsed, the values may be strings, parsed as multiple words separated by spaces.

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

