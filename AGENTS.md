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

## Composer review — 18 September 2026
Leandro approved implementation in `composer-experience` and publication to the separate Vercel review project. Keep the latest landing, Comfort GLB, portrait exception and footer from main. The active `/chat` adapter is `src/chat/composer.js`; `src/experience.js` mounts the same components in the app and both Storybooks. Pure composer state is exported through `src/chat/conversation.js`, with catalogue/selection rules in `src/routine.js`.
Use progressive clickable questions, editable context, optional removable filename-only photo, explained product cards, inspectable source/limits, transparent illustrative price comparison, user-reviewed selection, demo checkout and revisitable session check-in. Preserve drafts on file errors and edits. No photo diagnosis, skin-age score, invented studies, real payment or promised conversion uplift. Prices and comparisons are explicitly fictional until real product data is supplied. Do not send user content or images to analytics.
Maintain independently deployable wireframe and proposed high-fidelity Storybooks from the same components; high fidelity uses the existing brandbook foundations and remains marked as proposed. Publish review routes `/chat`, `/guia.html`, `/brandbook.html`, `/storybook/wireframe/` and `/storybook/alta-fidelidade/`. Run `npm run build:review`, `npm test`, `npm run format:check` and the mobile/desktop journey QA before publishing. Fetch/rebase again before pushing because work is concurrent; never force-push main.

## Continuous chat and real AI — 18 September 2026
Leandro rejected the quiz/wizard presentation and approved the continuous chat visual. Keep a large answer area, visible accumulated user/assistant messages, persistent composer, one contextual question at a time and optional reply suggestions. Acne, oiliness and general skincare must start useful conversations. Product cards, sources, price graphics, context edits and demo checkout belong inside the same thread. Do not return to full-page questionnaire stages.
Use `src/chat/thread-state.js` for conversation state and deterministic Storybook fixtures. The live chat uses server-only OpenAI routes under `api/` with `OPENAI_API_KEY` stored as a sensitive Vercel variable; never put credentials in source, browser bundles, reports or logs. The user authorized real chat and illustrative photo generation. Photo processing requires an explicit consent control; generated edits must preserve identity and be visibly labeled illustrations, never predictions of clinical outcomes or proof of a product's efficacy.
Leandro additionally requested multiple saved sessions like Nolla: list them in the desktop sidebar and a mobile history menu, support new/open/delete conversations, and persist locally in the browser. Clearly disclose that this preview has no account-based cross-device synchronization. Keep delete controls and make provider processing distinct from local retention. This supersedes the earlier filename-only/local-memory-only direction for the new chat while preserving conceptual catalog/pricing/checkout boundaries.

## Voice and applied workshop principles — 18 September 2026
Leandro requested progressive speech transcription in the composer, saved continuously as an editable draft and sent only by an explicit action. Ask for microphone consent, show recording/connecting/stopping states, let the user conclude or cancel, and stop microphone tracks on cancellation, navigation, backgrounding or typing. Keep the main OpenAI key server-only; short-lived WebRTC credentials may exist only in browser memory. Persist transcript text locally, never audio recordings. Clearly separate initial-connection expiry, client recording duration and server quota.
Apply the relevant principles from the workshop `/roteiro` individually. Use “Explorar outra opção” to start a separate conversation from existing answers, preserving the original and requiring fresh photo consent. Retain context provenance, editable facts, visible changes, saved summaries, inspectable sources, honest comparisons, actionable AI-error notice and local feedback. Stream response text progressively, allow stopping and retrying without losing drafts, and preserve reading position when the user scrolls up. Inherited cards in a new alternative are read-only. Keep the entire experience inside the continuous chat and document coverage in `docs/roteiro-chat-audit.md`.
