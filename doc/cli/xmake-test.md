# xmake-test(1) -- Run one or all project tests

## Synopsis

```
xmake test [options...] [--target <name>]* [--profile <name>]* [--toolchain <name>]* [--depth <n>] [name...] [-- <build args> [-- <run args>]]
```

Aliases:
- `t`
- `tst`

## Description

This command identifies the tests by enumerating all listed folders, down 
to `depth`, that have a `xmake.json` file with a `name` definition.

Each configuration creates a subfolder in the CWD, named 
`build/test-name-target-profile-toolchain`, where `name` is the test name.

Each configuration is build and the result is executed.

If multiple names are defined for target/profile/toolchain, a 
matrix of tests is constructed.

All names must be letters, hyphens, or digits. When used to create 
paths, case is not significative and all letters are converted to lowercase.

When started in an xPack root folder (a valid `package.json` file is 
present), if no explicit folder names are given, the default folder 
is `{{ package.directories.test | default 'test' }}`.


