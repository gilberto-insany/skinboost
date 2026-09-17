# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## SkinBoost direction — 15 September 2026
User requested an HTML prototype, not an image. Primary references: Nolla home and skincare. Supporting references: Oura, MyHealthPrac, Superpower, Institute of Health, Luminous Labs, Sofi and four supplied screenshots. Main action is a prompt to understand skin context, optional photo. Keep clean minimal functional layout, generous typography, editorial skin photos, bento grid, product/how-it-works, simulated before/after and clearly fictional persona stories. Include background video driven by scrolling and an actual 3D bottle section inspired by Sofi. Follow SkinBoost v2 product/copy sources. This is a conceptual demo with no real AI diagnosis, purchases, customer claims or clinical evidence. Keep user input local and ephemeral.

## Wireframe media direction — 17 September 2026
User clarified: restore product images and the 3D bottle; only imagery of people must be placeholders. Keep editorial faces, skin video and before/after as labeled neutral placeholders. Restore product photography in bento, catalog and product modal, plus the original scroll-driven Three.js bottle. Photo attachment shows filename only. Preserve high-fidelity hierarchy, spacing and interactions.
