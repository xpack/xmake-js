
## CDT

- Common
  - Target Processor
  - Optimizations
  - Warnings
  - Debugging

- AS
  - Preprocessor
  - Includes
  - Warnings
  - Miscellaneous

`-x assembler-with-cpp `
`${COMMAND} ${cross_toolchain_flags} ${FLAGS} -c ${OUTPUT_FLAG} ${OUTPUT_PREFIX}${OUTPUT} ${INPUTS}`


- C & C++ Compiler
  - Preprocessor
  - Includes
  - Optimizations
  - Warnings
  - Miscellaneous

`${COMMAND} ${cross_toolchain_flags} ${FLAGS} -c ${OUTPUT_FLAG} ${OUTPUT_PREFIX}${OUTPUT} ${INPUTS}`

---

{command} -c | {command} -x assembler-with-cpp -c

{targetPlatform} {debugging} (per profile)
{symbols} {includes} {optimizations} {warnings} {miscellaneous} (per node)
{deps} (per tool)
{outputFlag} {outputPrefix}{output}{outputSuffix} (per profile/tool/profile)
{input} (per tool)

---

depends on (toolchain, tool, profile, node)

{{ toolchain.commandPrefix }}{{ tool.commandName }}{{ toolchain.commandSuffix }} {{ tool.options }}
{{ profile.options.targetPlatform }} {{ profile.options.debugging }}
{{ node.symbols }} {{ node.includes }} {{ node.options.optimizations }} {{ node.options.warnings }} {{ node.options.miscellaneous }}
{{ tool.deps }}
{{ tool.outputFlag }} {{ profile.outputPrefix }}{{ tool.output }}{{ profile.outputSuffix }}
{{ tool.input }}

profile.options (up to toolchain)

node definitions:
- parent (up to tool)
- remove
- add

