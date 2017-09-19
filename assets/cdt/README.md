The JSON files in this folder contain the actual toolchain definitions from Eclipse CDT Neon.3 and from the GNU MCU Ecipse v4, converted from XML to JSON.

The files listed in the index are parsed, in that order.

The commands used to generate them are:

```
cd "/Users/ilg/My Files/MacBookPro Projects/xPack/npm-modules/xmake-js.git/assets/cdt"

gme=/Users/ilg/My\ Files/MacBookPro\ Projects/GNU\ ARM\ Eclipse

../../bin/xmake-dev.js convert \
--file "${gme}/plug-ins.git/ilg.gnumcueclipse.managedbuild.cross/plugin.xml" \
--format cdt-toolchain \
--output gme-cross.json

../../bin/xmake-dev.js convert \
--file "${gme}/plug-ins.git/ilg.gnumcueclipse.managedbuild.cross.arm/plugin.xml" \
--format cdt-toolchain \
--output gme-cross-arm.json

../../bin/xmake-dev.js convert \
--file "${gme}/plug-ins.git/ilg.gnumcueclipse.managedbuild.cross.riscv/plugin.xml" \
--format cdt-toolchain \
--output gme-cross-riscv.json

../../bin/xmake-dev.js convert \
--file "${gme}/src/org.eclipse.cdt.git/build/org.eclipse.cdt.managedbuilder.core/plugin.xml" \
--format cdt-toolchain \
--output cdt-core.json

../../bin/xmake-dev.js convert \
--file "${gme}/src/org.eclipse.cdt.git/build/org.eclipse.cdt.managedbuilder.gnu.ui/plugin.xml" \
--format cdt-toolchain \
--output cdt-gnu-ui.json

../../bin/xmake-dev.js convert \
--file "${gme}/src/org.eclipse.cdt.git/cross/org.eclipse.cdt.build.crossgcc/plugin.xml" \
--format cdt-toolchain \
--output cdt-crossgcc.json

```
