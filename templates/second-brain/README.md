# Second Brain Template

Source template for a project brain capsule. Installed into a target project as
`.project-brain/` (Phase 2 self-install; install.sh --with-second-brain from Phase 5).

Install recipe:
1. Copy `project-brain/` → `<target>/.project-brain/`
2. Copy `BRAIN.md`, `MEMORY.md`, `README.md` → `<target>/.project-brain/`
3. Copy `brain-profile.json` → `<target>/.project-brain/context/brain-profile.json`
4. Fill `{{PROJECT_NAME}}` / `{{CREATED_AT}}` placeholders and profile identity fields
5. Run `node scripts/brain/brain-verify.js --target <target>/.project-brain`

Managed by the brain-kernel scripts in `scripts/brain/`. Source of truth is Markdown + Git.
