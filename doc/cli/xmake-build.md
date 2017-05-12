# xmake-build(1) -- Build one or more configurations

Generate the build folders and build.

## Synopsis

```
xmake build [--target <name>]* [--profile <name>]* [--toolchain <name>]* [-- <args>]
```

Aliases:
- `b`
- `bild`

## Description

This command expects an `xmake.json` file in the CWD, to define the 
build configurations.

A build configuration is a triplet (target, profile, toolchain).

For each configuration, `xmake build` creates a subfolder in the CWD, 
named `build/target-profile-toolchain`.

If multiple names are defined for target/profile/toolchain, a 
matrix of configurations is constructed.

All names must be letters, dashes, or digits. When used to 
create paths, all letters are converted to lowercase.

After generating the build folders, the native builder (like `make`) 
is invoked with the extra arguments.

## Examples

```
$ cd xyz-xpack.git
$ xmake build -- clean all
```

When executed, this command creates subfolders like `darwin-debug-clang` and 
`darwin-release-clang` and `make` is invoked in each folder
to run the actual build. 
