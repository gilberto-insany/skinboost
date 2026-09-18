# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## SkinBoost direction — 15 September 2026
User requested an HTML prototype, not an image. Primary references: Nolla home and skincare. Supporting references: Oura, MyHealthPrac, Superpower, Institute of Health, Luminous Labs, Sofi and four supplied screenshots. Main action is a prompt to understand skin context, optional photo. Keep clean minimal functional layout, generous typography, editorial skin photos, bento grid, product/how-it-works, simulated before/after and clearly fictional persona stories. Include background video driven by scrolling and an actual 3D bottle section inspired by Sofi. Follow SkinBoost v2 product/copy sources. This is a conceptual demo with no real AI diagnosis, purchases, customer claims or clinical evidence. Keep user input local and ephemeral.

## Wireframe media direction — 17 September 2026
User clarified: restore product images and the 3D bottle; only imagery of people must be placeholders. Keep editorial faces, skin video and before/after as labeled neutral placeholders. Restore product photography in bento, catalog and product modal, plus the original scroll-driven Three.js bottle. Photo attachment shows filename only. Preserve high-fidelity hierarchy, spacing and interactions.

## Product 3D direction — 18 September 2026
Replace the procedural bottle with the lightweight Comfort 50 ml Blender asset. Use a light ivory section with dark green type, green translucent acrylic cap, and an actual scroll-linked turn and cap removal. Keep the cap separate and reverse the motion when scrolling back. Do not render a video for this interaction. Preserve the rest of the page and respect reduced motion.
Use the supplied `assets/branding/logo_colored.svg` artwork on the packaging instead of font approximations. The hollow acrylic cap has a 1 mm wall: transmission thickness is in local meters, before the model's scale of 20, to avoid magnifying the pump.

## Conversational flow — 18 September 2026
The landing prompt opens a dedicated /chat experience inspired by Nolla and GPT-style conversations. Collect context progressively, allow answer corrections, require review, then show an illustrative proposal. Keep state transitions in src/chat/conversation.js separate from DOM rendering. This remains a local ephemeral demonstration without real AI or clinical recommendations. Preserve product imagery and 3D; people remain placeholders. Do not reintroduce the unused React scaffold or archived media into public/. Run npm test, npm run build and npm run format:check after changes.

## Context bento — 18 September 2026
Remove the fingerprint icon. Use six context phrases that fall sequentially and stack at the bottom when the card enters view. Keep every phrase legible and use a static settled stack for reduced motion.

## Story portraits — 18 September 2026
User requested a person photo in the stories card. Exception to the people-placeholder rule: use local AI-generated fictional portraits for Lucas, Marina and Denise, synchronized with the carousel, with visible fictional/AI attribution. Other people imagery remains placeholders.

## Footer direction — 18 September 2026
Use a SkinBoost text wordmark spanning the full content grid and one shallow full-bleed editorial image placeholder. References: large New Studio wordmark and Carolyn Lee footer with image area. Preserve the sage/ivory brand palette and existing footer navigation.
