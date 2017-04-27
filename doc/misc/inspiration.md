# Inspiration

## [cmake(1)](https://cmake.org/cmake/help/v3.8/manual/cmake.1.html)

### Generator mode

To generate a build system for a native tool, `cmake` is usually started in an empty folder, pointing back to the sources:

```bash
$ cmake [<options>] <path-to-source>
```

`cmake` can also be started from any folder, pointing to an existing build folder:

```bash
$ cmake [<options>] <path-to-existing-build>
```

### Build tool mode

To build an already-generated project binary tree:

```bash
$ cmake --build <dir> [<options>...] [-- <build-tool-options>...]
```

### Command-line tool mode

This was probably intended as a portable solution for scripts running on non-POSIX platforms, where tools like `touch` are not available.

```bash
$ cmake -E <command> [<options>...]
```
