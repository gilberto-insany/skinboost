# SkinBoost design tokens

`source-figma-export.json` is the unmodified variable export supplied for the
SkinBoost design system. Generated CSS lives in `src/tokens/generated` and is
updated with `npm run tokens:build`.

The current export omits the IDs of primitive variables while semantic colors
still reference opaque `VariableID` values. The compiler therefore contains a
strict compatibility bridge for the known `26:11` through `26:89` primitive
sequence. This bridge is temporary: a future Figma export must retain each
variable's `id`, at which point the compiler will prefer those native IDs.

The legacy ID sequence is inferred, not verified against native Figma IDs.
The compiler rejects reordered primitive names, but that guard does not prove
the inferred mapping is correct. Confirm the mapping with an ID-bearing export
before migrating application styles.

Foundations / Tokens Figma provides Light and Dark review stories in both
catalogs. `src/tokens/functional.css` proposes UI roles scoped to `.ds-review`:
canvas, surface, text, borders, actions, focus and feedback. These are proposed
product mappings, not additional variables exported from Figma. Action colors
use primary 700/white in Light and primary 200/primary 950 in Dark.
Line-height and responsive layout remain review-specific CSS decisions.
The original identity stories remain available as the implementation baseline.
The application does not import the new token styles yet.
