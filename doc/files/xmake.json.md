
The `xmake.json` file defines the build metadata for the current folder and/or a group of files.

Two kinds of data is defined:
- which are the source folders and exclusions
- the compiler settings for each folder/file.

The folder/file settings are distributed in each folder, with file paths local to the folder and excluded paths similarly.

When refering to the build or test root folder, the content is added in the `xmake-build.json` or `xmake-test.json`.

```json
{
  "version": "0.1.0",
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

Symbols/includes defined at folder level apply to all targets/profiles/toolchains.

The `excludedPaths` array defines folders and/or files that should not be part of the build, for all configurations or a specific configuration.

The `targets` object defines specific settings for several targets.

```json
{
  "targets": {
    "darwin": {
      "excludedPaths": [],
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "profiles": { ... }
    }
  }
}
```

The `profiles` object defines specific settings for several profiles.

```json
{
  "profiles": {
    "debug": {
      "excludedPaths": [],
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "toolchains": { ... }
    },
    "release": {
      "excludedPaths": [],
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "toolchains": { ... }
    }
  }
}
```

The `toolchains` object defines specific settings for one or more toolchains.

```json
{
  "toolchains": {
    "gcc": {
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "tools": { ... }
    },
    "arm-none-eabi-gcc": {
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
      "tools": { ... }
    }
  }
}
```

The `tools` object defines specific settings for one or more tools. When applied to a file, only one tool is significative, according to the file extension.

When serialised, the values are string arrays; when parsed, the values may be strings, parsed as multiple words separated by spaces.

```json
{
  "tools": {
    "c": {
      "removeSymbols": [],
      "addSymbols": [],
      "removeIncludeFolders": [],
      "addIncludeFolders": [],
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

Nodes are ordered according to the folder hierarchy. Options for a given category are composed from:

- parent options, as an array
- options from removeXxx are filtered out
- options from addXxxx are added at the end

For a given node, a property is searched in the hierarchy of toolchains, for example if `addOptimizations` is defined in `arm-none-eabi-gcc`, it is used, otherwise, if present in `gcc`, it is used from there, and so on.
