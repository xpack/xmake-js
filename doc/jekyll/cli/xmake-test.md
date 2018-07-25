---
layout: page
lang: en
permalink: /xmake/cli/xmake-test/
title: xmake test - Run one or all project tests
author: Liviu Ionescu

date: 2017-10-09 13:06:00 +0300

---

## Synopsis

```console
xmake test [options...] [--config <name>]* [--target <name>]* [--profile <name>]* [--toolchain <name>]* [--depth <n>] [paths...] [-- <build args> [-- <run args>]]
```

Aliases:
- `t`
- `tst`

## Description

This command identifies the available tests, builds them and,
for tests that provide a `commands.run` definition, execute them.

The default folder to search for tests is `test` in the folder
where `xmake` was started, or the `-C folder`.

When started in an xPack root folder (a valid `package.json` file is 
present), the default folder 
is `{{ package.xpack.directories.test | default 'test' }}`.

The search is recursive down to `depth` levels (default 1), and only 
folders that have an `xmake.json` file are retained; the folder where 
the `xmake.json` file is identified will be the test name.

For a given project, all test names must be unique.

If no paths are provided, all identified tests are considered.

Tests are actually separate projects, each with different configurations.

Each configuration creates a subfolder in the current folder, named 
`build/test-${test.name}-${configuration.name}`.

If multiple filters are defined, all
configuration for the named tests are enumerated and any match 
for any of the config/target/profile/toolchain option triggers
a build; in other words, options are logically joined by _or_.

All names must be letters, hyphens, or digits. When used to create 
paths, case is not significative and all letters are converted to lower case.

