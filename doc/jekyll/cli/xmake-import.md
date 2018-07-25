---
layout: page
lang: en
permalink: /xmake/cli/xmake-import/
title: xmake build - Import a project from another build system
author: Liviu Ionescu

date: 2017-10-09 13:06:00 +0300

---

Read a configuration from another build system and create the `xmake.json` files.

## Synopsis

```
xmake import
```

Aliases:
- none

## Description

This command enumerates the files in the current folder and tries to identify
a known project description, for example a `.cproject` Eclipse CDT.

Then it parses it and generates one `xmake.json` file in the top folder and 
possibly more other `xmake.json` files in sub-folders.
