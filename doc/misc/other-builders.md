# Other builder tools

## [cmake](https://cmake.org/cmake/help/latest/)

CMake is an open-source, cross-platform family of tools designed to build, 
test and package software.

## [meson](http://mesonbuild.com)

Meson is an open source build system meant to be both extremely fast, and, 
even more importantly, as user friendly as possible.

Notes:

- written in Python
- uses ninja
- the syntax is Python-ish
- does lots of things, for large projects
- --buildtype=debug
  - plain (no extra flags)
  - debug 
  - debugoptimized
  - release (full optimization, no debug)
- on purpose non-Turing complete; defining your own functions inside 
meson.build files and generalised loops will not be added to the language.

[video](https://www.youtube.com/watch?v=SCZLnopmYBM)
- "The C++ build system / package manager should be implemented in C++? No." 
- diamond dependencies
- binary dependency fallback to sources
- build definitions are simple and readable

[video](https://www.youtube.com/watch?v=gHdTzdXkhRY)
- documentation means not having to answer the same questions
- move documentation inside the source repo
- until you havee the first major customer, you have nothing
- WrapDB for deps 
- stubbornness & stupidity

[video](https://www.youtube.com/watch?v=KPi0AuVpxLI)
- all build tools suck
- do the common thing by default
- make dependency loops impossible
- no Turing complete
- build parts of a cross build with native tools
- no in-source builds
- custom ninja targets
- common language for all IDEs, in JSON
- sandboxed subprojects

## [bazel](https://docs.bazel.build/versions/master/bazel-overview.html)

Bazel is an open-source build and test tool similar to Make, Maven, and Gradle.

Maintained by Google.

- [Building a C++ Project](https://docs.bazel.build/versions/master/tutorial/cpp.html)

Notes:
- uses Java and Python like syntax
- very, very complicated

## Other

- [ninja](https://ninja-build.org) - a much faster alternative to make
- [SCons](https://github.com/SConsProject/scons) - a Python tool
- [Waf](https://github.com/waf-project/waf) - related to SCons
- [GYP](https://gyp.gsrc.io) - the Chromium builder
