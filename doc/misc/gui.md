# GUI

This page summarizes how the configuration should look like in a GUI 
and is inspired by the Eclipse CDT properties pages.

The properties pages can be grouped in groups, below a `C/C++ xmake` category.

- Configurations
- Profiles
- Targets

## Paths

All paths are relative to the project root folder.

## Source locations

Part of the 'Configurations' group.

The source folders can be defined globally or per configuration.

### Storage

Global paths are defined in a top `addSourceFolders` array, possibly followed
by `excludeSourcePaths`. They apply to all configurations.

```json
{
  "addSourceFolders": [
    "src",
    "other"
  ],
  "excludeSourcePaths": [
    "src/mem1.c"
  ]
}
```

Configuration specific paths are defined in a `addSourceFolders` array,
possibly followed by `removeSourceFolder`, `excludeSourcePaths`.

```json
{
  "...": "...",
  "buildConfigurations": {
    "debug": {
      "addSourceFolders": [
        "extra"
      ],
      "removeSourceFolder": [
        "other"
      ],
      "excludeSourcePaths": [
        "src/mem2.c",
        "extra/file1.c"
      ]
    }
  }
}
```

Exclusions are stored in `excludeSourcePaths`; excluded paths must be
existing folders or files, otherwise warnings are issued during build.

### Widgets

- on top, a combo with the configuration names, plus one named 
_All configurations_
- on the left, a large area with a list of folders (like `src`, `extra`)
- on the right, buttons: Add, Edit, Delete, Up, Down

Behaviour for All:

- Add: add folder at the end
- Delete: remove folder

Behaviour for configurations:

The folders inherited from All are shown first, but marked differently
(greyed or with a distinct icon, or followed by '(All)'), and, when selected, 
the Edit/Up/Down buttons are disabled.

- Add: add folder at the end
- Delete: if the folder is from the configuration, it is removed; if the 
folder is inherited from All, it is added to `removeSourceFolder`

## Include folders

Part of the 'Configurations' group.

The include folders are passed to GCC via `-I <folder>`.

Can be defined globally or per configuration, for the top folder or for
any inner folder or file. 

Can also be contributed by toolchain/targetPlatform/profile(s).

### Storage

Global include folders are defined in a top `addIncludeFolders` array. They 
apply to all folder/files from all configurations.

```json
{
  "...": "...",
   "addIncludeFolders": [
      "include2",
      "extra/include"
    ]
}
```

Global folder specific include paths are defined in a `addIncludeFolders` 
array and possibly by `removeIncludeFolders`. 
They apply to the given folders and below in all configurations.

```json
{
  "...": "...",
  "folders": {
    "extra": {
      "addIncludeFolders": [
        "include2",
        "extra/include"
      ],
      "removeIncludeFolders": [
        "..."
      ]
    }
  }
}
```

Global file specific include paths are defined in a `addIncludeFolders` 
array and possibly by `removeIncludeFolders`. 
They apply to the given file in all configurations.

```json
{
  "...": "...",
  "files": {
    "extra/src/extra1.c": {
      "addIncludeFolders": [
        "include2",
        "extra/include"
      ],
      "removeIncludeFolders": [
        "..."
      ]
    }
  }
}
```

Configuration specific include paths are defined in a `addIncludeFolders`
array, and possibly by `removeIncludeFolders`.

```json
{
  "...": "...",
  "buildConfigurations": {
    "debug": {
      "addIncludeFolders": [
        "other/include"
      ],
      "removeIncludeFolders": [
        "extra/include"
      ]
    }
  }
}
```

Folder specific include paths are defined in a `addIncludeFolders` array,
and possibly by `removeIncludeFolders`. They 
apply to all folder/files in the given configuration. It is possible to set 
paths for each separate tool in the toolchain, or for all at once.

```json
{
  "...": "...",
  "buildConfigurations": {
    "debug": {
      "toolchain": "gcc",
      "folders": {
        "extra": {
          "addIncludeFolders": [
            "other/include"
          ],
          "removeIncludeFolders": [
            "extra/include"
          ],
          "tools": {
            "cCompiler": {
              "addIncludeFolders": [
                "misc1/include"
              ],
              "removeIncludeFolders": [
                "some/include"
              ]
            },
            "cppCompiler": {
              "addIncludeFolders": [
                "misc2/include"
              ],
              "removeIncludeFolders": [
                "some/include"
              ]
            }
          }
        }
      }
    }
  }
}
```

File specific include paths are defined in a `addIncludeFolders` array,
and possibly by `removeIncludeFolders`. 
They apply to the given file in the given configuration.

```json
{
  "...": "...",
  "buildConfigurations": {
    "debug": {
      "toolchain": "gcc",
      "files": {
        "extra/src/extra1.c": {
          "addIncludeFolders": [
            "other/include"
          ],
          "removeIncludeFolders": [
            "extra/include"
          ]
        }
      }
    }
  }
}
```


### Widgets

- on top, a combo with the configuration names, plus one named 
_All configurations_
- on the left, an area with a tree of tools in toolchains
- in the middle, a large area with a list of folders (like `include`, 
`extra/include`)
- on the right, buttons: Add, Edit, Delete, Up, Down

For global include paths, the tree of toolchains include a single entry (All),
and the settings apply to all files in all folders, in all configurations.

- All

For configuration folder paths, the tree of toolchains 
include all tools possible, for the configuration, like:

- GNU GCC
  - Assembler
  - C Compiler
  - C++ Compiler

By default the toolchain entry is not expanded, so the tools are not visible.
It is possible to assign different paths to different tools.

For configuration file paths, the tree of toolchains is simple, 
only the leaf, the associated tool, like

- GNU GCC
  - C++ Compiler

The folders inherited from All are shown first, but marked differently
(greyed or with a distinct icon, or followed by '(All)'), and, when selected, 
the Edit/Up/Down buttons are disabled.

## Include system folders

Same as before, but are stored as `addIncludeSystemFolders` and 
`removeIncludeSystemFolders`, and generate GCC options 
`-isystem <folder>`.

## Include files

Same as before, but are stored as `addIncludeFiles` and 
`removeIncludeFiles`, and generate GCC options 
`-include <folder>`.

## Symbols

Part of the 'Configurations' group.

The preprocessor symbols are passed to GCC via `-D<name>` or
`-D<name>=<value>`.

Can be defined globally or per configuration, for the top folder or for
any inner folder or file. 

Can also be contributed by toolchain/targetPlatform/profile(s).

### Storage

Global symbols are defined in a top `addSymbols` array. They 
apply to all folder/files from all configurations.

```json
{
  "...": "...",
  "addSymbols": [
    "MY_PRJ1a",
    "MY_PRJ1b"
  ],
}
```

Global folder specific symbols are defined in a `addSymbols` 
array and possibly by `removeSymbols`. 
They apply to the given folders and below, in all configurations.

```json
{
  "...": "...",
  "folders": {
    "extra": {
      "addSymbols": [
        "MY_EXTRA_Fa",
        "MY_EXTRA_Fb"
      ],
      "removeSymbols": [
        "MY_PRJ1b"
      ]
    }
  }
}
```

Global file specific symbols are defined in a `addSymbols` 
array and possibly by `removeSymbols`. 
They apply to the given file in all configurations.

```json
{
  "...": "...",
  "files": {
    "extra/src/extra1.c": {
      "addSymbols": [
        "MY_EXTRA_1a",
        "MY_EXTRA_1b"
      ],
      "removeSymbols": [
        "MY_PRJ1b"
      ]
    }
  }
}
```

Configuration specific symbols are defined in a `addSymbols` 
array and possibly by `removeSymbols`.

```json
{
  "...": "...",
  "buildConfigurations": {
    "debug": {
      "addIncludeFolders": [
        "other/include"
      ],
      "removeIncludeFolders": [
        "extra/include"
      ]
    }
  }
}
```

Folder specific symbols are defined in a `addSymbols` array,
and possibly by `removeSymbols`. 
They apply to all folder/files in the given configuration. It is possible 
to set paths for each separate tool in the toolchain, or for all at once.

```json
{
  "...": "...",
  "buildConfigurations": {
    "debug": {
      "toolchain": "gcc",
      "folders": {
        "extra": {
          "addSymbols": [
            "MY_EXTRA_Fa",
            "MY_EXTRA_Fb"
          ],
          "removeSymbols": [
            "MY_PRJ1b"
          ]
          "tools": {
            "cCompiler": {
              "addSymbols": [
                "MY_EXTRA_Fa",
                "MY_EXTRA_Fb"
              ],
              "removeSymbols": [
                "MY_PRJ1b"
              ]
            },
            "cppCompiler": {
              "addSymbols": [
                "MY_EXTRA_Fa",
                "MY_EXTRA_Fb"
              ],
              "removeSymbols": [
                "MY_PRJ1b"
              ]
            }
          }
        }
      }
    }
  }
}
```

File specific symbols are defined in a `addSymbols` array,
possibly followed by `removeSymbols`. 
They apply to the given file in the given configuration.

```json
{
  "...": "...",
  "buildConfigurations": {
    "debug": {
      "toolchain": "gcc",
      "files": {
        "extra/src/extra1.c": {
          "addSymbols": [
            "MY_EXTRA_1a",
            "MY_EXTRA_1b"
          ],
          "removeSymbols": [
            "MY_PRJ1b"
          ]
        }
      }
    }
  }
}
```


### Widgets

- on top, a combo with the configuration names, plus one named 
_All configurations_
- on the left, an area with a tree of tools in toolchains
- in the middle, a large area with a list of names and values
- on the right, buttons: Add, Edit, Delete, Up, Down

For global include paths, the tree of toolchains include a single entry (All),
and the settings apply to all files in all folders, in all configurations.

- All

For configuration folder paths, the tree of toolchains 
include all tools possible, for the configuration, like:

- GNU GCC
  - Assembler
  - C Compiler
  - C++ Compiler

By default the toolchain entry is not expanded, so the tools are not visible.
It is possible to assign different paths to different tools.

For configuration file symbols, the tree of toolchains is simple, 
only one leaf, the associated tool, like

- GNU GCC
  - C++ Compiler

The symbols inherited from All are shown first, but marked differently
(greyed or with a distinct icon, or followed by '(All)'), and, when selected, 
the Edit/Up/Down buttons are disabled.
