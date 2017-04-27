# xmake-build.json

This file defines the build profiles.

Exmaple:

```json
{
  "version": "0.1.0",
  "sourceFolders": {
    "src"
  },
  "generator": "make",
  "scripts": {
    "build": "make"
  },
  "profiles": {
    "debug": {},
    "release": {}
  }
}
```
