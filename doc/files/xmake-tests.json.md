# xmake-tests.json

This file identifies a group of tests.

Exmaple:

```json
{
  "version": "0.1.0",
  "sourceFolders": [
     "../src",
  ],
  "generator": "make",
  "scripts": {
    "build": "make",
    "execute": "./${executable}"
  },
  "profiles": {
    "debug": {},
    "release": {}
  },
  "dependencies": {
    "my-test-framework": "1.2.3"
  }
  "tests": [
    {
      "name": "my-test",
      "description": "The best test",
      "sourceFolders": [
        "my-test"
      ]
   }
  ]
}
```
