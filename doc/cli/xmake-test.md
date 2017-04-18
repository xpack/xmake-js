# xmake-test(1) -- Run one or all project tests

## Synopsis

```
xmake test [<name> ...] [--target <name>]* [--toolchain <name>]* [--profile <name>]* [-- <args>]
```

Aliases:
- `t`
- `tst`

## Description

### When started in xPack root

The command enumerates all subfolders in {{ xPackRoot }}/{{ package.directories.test | default 'test' }} that have an `xtest.json` and runs either all tests or only the named tests.

Each profile creates a subfolder named `build/test-name-target-toolchain-profile`.

If multiple names are defined for target/toolchain/profile, a matrix of tests is constructed.

All names must be letters & digits only.
