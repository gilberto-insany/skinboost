# Previous published SkinBoost experience

This is the application source from commit `11f06800a82000977b39e098e1c0b468c93ca7c8`, the production version before the final Figma Home was released. It is intentionally frozen rather than sharing the current Home's CSS or interaction controllers.

- `/` and `/chat`: current application.
- `/wireframe` and `/wireframe/chat`: previous application, built as a separate Vite HTML entry.
- Storybook catalogs keep their existing URLs.

Only integration changes were made to the snapshot: its HTML entry script, chat/home routes, and a separate IndexedDB database (`skinboost-wireframe-conversations`) so trying the archive does not edit current conversations. The same server-side `/api/*` endpoints retain existing consent and safety handling. Original public media, models and source PDFs were unchanged and remain shared at their original URLs. No credentials or historical server configuration are copied.

Build with `npm run build:review`. Vite dev/preview, Vercel and the Sites fallback all serve the archive entry for both wireframe routes. Future Home changes should not be copied into this snapshot.
