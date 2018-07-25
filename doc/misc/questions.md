## profile/toolchain vs toolchain/profile?

If the target is probably the first, what is the best order for the others?

Eclipse assigns a toolchain for each build configuration, but is this really ok?

Apparently the profiles share a common toolchain, and, as such, are variants 
of a given toolchain.

The current recommendation is to use toolchain first, for example 
`posix-gcc-debug`, `darwin-clang-debug`, etc.
