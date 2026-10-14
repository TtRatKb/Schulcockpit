# Schulcockpit — Codex Instructions

Schulcockpit is a German-language teacher workflow app for planning, materials, assessments, reflection, and PPTX/Kahoot exports. It is a static GitHub Pages application with HTML, CSS, vanilla JavaScript, JSZip, and versioned scripts; no npm build or backend.

## Invariants
- Preserve all existing functionality, user data, migrations, backups, and imported plans. Back up before risky migrations.
- Keep planned lessons (Soll) distinct from taught lessons (Ist). Do not rewrite completed lessons or fixed assessments; preview changes to detailed future lessons.
- Store large plans, catalogs, and file blobs in IndexedDB, not a monolithic localStorage state. Confirm writes before reporting success or deleting legacy data.
- Keep teaching files local, out of Git. Match materials by archive/path; unassigned does not mean missing or printable. Avoid duplicate printing.
- Preserve PPTX master layouts, notes, XML/ZIP compatibility, and classroom workflows.
- Make focused changes; read handoffs only as needed. Repository code may supersede old handoffs.

## Delivery workflow
For each successful coding task: work on a branch, run applicable syntax, migration, regression, export, and browser tests; fix failures; commit and push; open a PR; merge only after all available required checks pass, permissions allow it, and no conflicts or data-loss risks remain. Never bypass branch protection. Prefer automatic merge when supported; otherwise merge only when verified safe. Confirm the change exists on the default branch. Previews are **not** GitHub deployments; report blockers.
