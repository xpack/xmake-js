# Generators

`xmake` itself is not intended to take over existing build systems, instead
it allows to use them in an automated way.

The _generators_ are separate classes used to accommodate different 
build systems. They create the specific files required by the build
systems to perform the complete build.

## make

`make` is the de facto POSIX build tool, and GNU `make` is available on all 
relevant platforms.

Due to historical reasons, `make` does not directly support names 
containing spaces. However, with some precautions, this limitation can
be partly overcome.

A known functional model for generating `make` files is used by Eclipse CDT, 
and the `xmake` model was inspired by it, although with some changes.

In this model, the entire build process is a sequence of separate 
file builds, grouped by folders.

The input to the build is a list of source folders. These folders are 
recursively searched for source files, and all folders containing 
source folders are collected in another list of active subfolders.

The build starts by recreating all the active subfolders in the `build`
location, and generating a `subfolder.mk` make fragment, with 
rules to build all files in that folder. These folders are also
used to store the object (`.o`) and dependency (`.d`) files.

In the top build folders, a `makefile` is generated, which includes
all fragments, and than defines the rules to build the final artefact.

## ninja

`ninja` is a new build tool, renowned for very fast builds.

Adding support for `ninja` is planned for a future version.

## GNU MCU Eclipse

For compatibility with the current build plug-ins available in Eclipse,
the `.project` and `.cprojects` files specific to GNU MCU Eclipse projects 
can be generated.

Adding support for GNU MCU Eclipse is planned for a future version.

## Native build

Having all information about the files that enter the build, 
it is possible for `xmake` to directly perform
the build itself, without generating specific files and calling a 
separate builder.

Adding support for native builds is planned for a future version.
