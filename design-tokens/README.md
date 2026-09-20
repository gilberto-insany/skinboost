# SkinBoost design tokens

`source-figma-export.json` is the unmodified variable export supplied for the
SkinBoost design system. Generated CSS lives in `src/tokens/generated` and is
updated with `npm run tokens:build`.

`semantic-aliases.json` records all 65 semantic variables in Light and Dark,
transcribed from four user-supplied screenshots listed in its evidence field.
The compiler resolves these 130 references by primitive name, independently of
array order or inferred IDs. Original export values are retained in the manifest
to reject changed references on a future export until reviewed. Missing targets
also fail generation. The screenshots confirm alias names, not native IDs or
primitive hexadecimal values; those colors still come from the original JSON.

The screenshots show collection `02 · Semantic`; the original JSON calls it
`1 · Semantic Colors`. The raw export is preserved, and the manifest documents
both labels. No Figma file was modified. The old order-based ID bridge is removed.

Foundations / Tokens Figma provides Light and Dark review stories in both
catalogs. `src/tokens/functional.css` proposes UI roles scoped to `.ds-review`:
canvas, surface, text, borders, actions, focus and feedback. These are proposed
product mappings, not additional variables exported from Figma. Action colors
use primary 700/white in Light and primary 200/primary 950 in Dark.
Line-height and responsive layout remain review-specific CSS decisions.
The original identity stories remain available as the implementation baseline.
The application does not import the new token styles yet.
