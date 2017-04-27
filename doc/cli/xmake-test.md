# xmake-test(1) -- Run one or all project tests

## Synopsis

```
xmake test [options...] [--target <name>]* [--toolchain <name>]* [--profile <name>]* [--depth <n>] [name...] [-- <args>]
```

Aliases:
- `t`
- `tst`

## Description

This command identifies the tests by enumerating all listed folders, down to depth, that have an `xmake-test.json` file.

Each profile creates a subfolder in the CWD, named `build/test-name-target-toolchain-profile`, where `name` is the test name.

Each profile is build and the result is executed.

If multiple names are defined for target/toolchain/profile, a matrix of tests is constructed.

All names must be letters, dash, or digits. When used to create paths, case is not significative and all letters are converted to lowercase.

When started in an xPack root folder (a valid `package.json` file is present), if no explicit folders are given, the default folder is `{{ package.directories.test | default 'test' }}`.


