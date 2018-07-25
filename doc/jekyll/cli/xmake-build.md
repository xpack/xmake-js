---
layout: page
lang: en
permalink: /xmake/cli/xmake-build/
title: xmake build - Build one or more configurations
author: Liviu Ionescu

date: 2017-10-09 13:06:00 +0300

---

Generate the build folders and build.

## Synopsis

```
xmake build [--config <name>]* [--target <name>]* [--profile <name>]* [--toolchain <name>]* [-- <args>]
```

Aliases:
- `b`
- `bild`

## Description

This command expects an `xmake.json` file in the current folder (or the `-C folder`), to define the 
build configurations.

A **build configuration** is a set of definitions that
the build system uses to create a single artefact. 

Within a project, configurations are identified by unique names. 

For each configuration, `xmake build` creates a subfolder in the CWD, 
named `build/<name>`.

If multiple filters are defined, all
configuration are enumerated and any match 
for any of the config/target/profile/toolchain option triggers
a build; in other words, options are logically joined by _or_.

After generating the build folders, the native builder (like `make`) 
is invoked with the extra arguments.

All names must be letters, hyphens, or digits. When used to 
create paths, all letters are converted to lower case.

## Examples

```
$ cd xyz-xpack.git
$ xmake build -- clean all
```

When executed, this command creates subfolders like `darwin-clang-debug` and 
`darwin-clang-release` and `make` is invoked in each folder
to run the actual build. 
