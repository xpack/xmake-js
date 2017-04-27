# xmake-test.json

This file identifies the test with a name and defines the profiles.

Exmaple:

```json
{
  "version": "0.1.0",
  "name": "my-test",
  "description": "The best test",
  "sourceFolders": [
     "../../src",
  ],
  "generator": "make",
  "scripts": {
    "build": "make",
    "execute": "./${executable}"
  },
  "profiles": {
    "debug": {},
    "release": {}
  }
}
```
