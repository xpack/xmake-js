# xmake-build(1) -- Build one or more configurations

Generate the build folders and build.

## Synopsis

```
xmake build [--target <name>]* [--toolchain <name>]* [--profile <name>]* [-- <args>]
```

Aliases:
- `b`
- `bild`

## Description

This command expects an `xmake-build.json` file in the CWD, to define the build configurations.

A build configuration is a triplet (target, toolchain, profile).

For each configuration, `xmake build` creates a subfolder in the CWD, named `build/target-toolchain-profile`.

If multiple names are defined for target/toolchain/profile, a matrix of configurations is constructed.

All names must be letters, dash, or digits. When used to create paths, all letters are converted to lowercase.

After generating the build folders, the native builder (like `make`) is invoked with the extra arguments.

## Examples

```
$ cd xyz-xpack.git
$ xmake build -- all
```

When executed, it creates subfolders like `darwin-clang-debug` and `darwin-clang-release` and `make` is invoked to run the actual build. 
