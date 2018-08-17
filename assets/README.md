## toolchain.json

### White spaces

There is small trick to be noted, related to supporting names with spaces.

The general idea is to pass escaped names to make, and quoted names to 
command lines.

The trick is the way to pass the output file name to the dependency file. 
The compiler provides `-MT` option. The escaped name must be passed as is,
which means also quoted.

However the default is fine, and -MT can be omitted.
