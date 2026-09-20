# SkinBoost design tokens

`source-figma-export.json` is the unmodified variable export supplied for the
SkinBoost design system. Generated CSS lives in `src/tokens/generated` and is
updated with `npm run tokens:build`.

The current export omits the IDs of primitive variables while semantic colors
still reference opaque `VariableID` values. The compiler therefore contains a
strict compatibility bridge for the known `26:11` through `26:89` primitive
sequence. This bridge is temporary: a future Figma export must retain each
variable's `id`, at which point the compiler will prefer those native IDs.

The generated files are not imported by the application yet. They establish a
verified source of truth without changing the approved interface. Migration of
Storybook and application aliases happens in subsequent stages.
