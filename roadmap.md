# my-notes roadmap

## Done
- [x] GitHub Actions deployment workflow with Wrangler.
- [x] Default seeding disabled for public DB-only deployments.
- [x] Pin/unpin controls replaced with icon buttons.
- [x] Pinned label removed from card headers; icon now carries the state.
- [x] Lazy KV bootstrap from `notes.js` only on a fresh empty namespace.
- [x] Placeholder helpers in manage editor.
- [x] Rename warning cards to important.
- [x] Public-side template placeholder filling.
- [x] Public page storage fallback and load error isolation.
- [x] Public page client-side note normalization and per-card render guard.
- [x] Modal-based copy flow on the public page.
- [x] Pinned cards.
- [x] Collapsible categories.
- [x] Local viewer pinning.
- [x] 10-second undo for edits and deletes.
- [x] Version history in the manage page with restore buttons.
- [x] Two-snapshot history with diff display and snapshot deletion.
- [x] Saved filters and favorite searches.
- [x] Import / export JSON backup.
- [x] Single-file offline HTML export.
- [x] Keyboard shortcuts for search and card navigation.
- [x] Usage counters.
- [x] Recent cards quick-access strip.
- [x] Duplicate card action in the editor.
- [x] Sanitized Markdown rendering for public note blocks.
- [x] Markdown preview toggle in the editor.
- [x] Basic formatting helpers in the editor.
- [x] Public renderer usage summary helper restored.
- [x] Public page stats separator cleaned up; hidden-state label and top version badges added.
- [x] Public page count line restored with safe separators, card usage stats moved to the card footer, and public usage recording restored.
- [x] v2.3.0 source debloat: worker entrypoint split from core routing, note model/history helpers, storage helpers, and HTML shells.
- [x] v2.3.1 public app extraction: stable `public-app.js` entrypoint separated from the public runtime implementation.
- [x] v2.3.2 public app runtime debloat: runtime split into focused context, Markdown, presets, navigation, modal, card rendering, and bootstrap modules.
- [x] v2.4.0 safer Markdown link handling, direct copy for blocks without placeholders, redundant copy-modal empty-state text removal, and copy-toast encoding fix.
- [x] v2.4.1 centralized application version rendering from `package.json` and CI validation to prevent public/manage version drift.
- [x] v2.5.0 selected offline HTML export with a dedicated card-selection modal and server-side filtering.
- [x] v2.5.1 removed the unused Explain on hover editor option and restored collapsible note/ticket/important categories.
- [x] v2.6.0 added persistent public visibility controls, migrated legacy `explain` fields out of stored notes, and kept hidden notes available in the authenticated editor while excluding them from public APIs and exports.

## Next
### v3.0.0
- Multiple note collections under different paths, with the routing and storage changes needed to support them properly.
