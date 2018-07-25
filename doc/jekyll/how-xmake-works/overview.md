---
layout: page
lang: en
permalink: /xmake/how-xmake-works/
title: How xmake works
author: Liviu Ionescu

date: 2017-10-09 12:10:00 +0300

---

There is a certain degree of excitement when dealing with build systems,
since they are usually poorly understood, so the only explanation why they
work must be linked to some kind of... magic.

The reality is more prosaic; at the very limit, build systems do nothing
more than identify source files and compile them, given some options.

## Source folders

The very first configuration element of a build system is a list of 
source folders; these folders are recursively searched and source files are
identified; based on each file extension, the proper tool is used
to process the file (for example `.c` files are compiled with `gcc` 
and `.cpp` files with `g++`).

After all source files are compiled, the artefact (an executable or a library)
can be created (for example using a linker or an archiver).

## Include folders

Well structured projects keep the public headers in separate folders, and
these folders must be known by the compiler to properly resolve the `#include`
statements.

Build systems must also manage lists of include folders; most of the time
the include folders are kept in a global list and used by all source files,
but there are cases when the include folders must be different for different
source files, and the build system must accommodate for this.

## Preprocessor definitions

Most preprocessor definitions are stored in header files, and included
during compilation, but there are some cases when the definitions are
used to select major configuration options (like `DEBUG`), and must be
be passed to the compiler as command line options.

Build systems must manage lists of such preprocessor definitions; 
most of the time the
preprocessor definitions are kept in a global list and used by all source 
files,
but there are cases when the preprocessor definition must be different 
for different
source files, and the build system must accommodate for this.

## Compiler options

Modern compilers are quite complicated, and, for getting the expected
results, they sometimes require lots of compiler options. Some are
mandatory and must be used by all source files (like the `-march` or
`-mcpu` for cross compiling); there are also cases when the compiler
options must be different for different
source files, and the build system must accommodate for this.

## Build configurations

To accommodate building multiple artefacts, it is possible to define 
multiple build configurations. Each configuration results in an artefact 
build and possibly tested.

The concept is inspired from Eclipse CDT.

## Profiles

At the limit, each configuration can define all options it needs, but
most times this means duplicating definitions common to all configurations.

Sometimes it is more convenient to avoid this 
by grouping the common definitions and applying the group as a whole.

These groups of options are named _profiles_. The common use of profiles
is to define options specific to debug/release configurations.

Profiles are optional. One or several profiles can be applied to a 
configuration.

## Toolchains

TBD

## Build tree

For each build configuration, a build tree is constructed.
Nodes refer to folders or files;
the build tree hierarchy follows the file system hierarchy.

Folder nodes may have other folders or file as children.

Each new depth level may contribute additional compiler options to the build,
and files located deeper in the hierarchy may be compiled with different 
definitions (options, symbols, includes, etc).

## xPack goodies

Although `xmake` can very well be used in standalone traditional projects,
organising the project as a collection of xPacks has the advantage 
of simplifying configuration and allowing further automations.

In practical terms, projects need no longer to manually configure the 
full lists of source/include folders, since they are automatically 
discovered, from the additional metadata available in `package.json`
for the main package and dependent packages.

The logic behind this mechanism is:

- check if there is a `package.json` file in the current folder
- add the `xpack.directories.src` to the source folders and 
`xpack.directories.include` to the include folders
- compute the list of direct dependencies
- for each dependent package, add the `xpack.directories.src` 
to the source folders and 
`xpack.directories.include` to the include folders

---


