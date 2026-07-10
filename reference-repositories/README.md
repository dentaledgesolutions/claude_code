# Reference Repository Library

External repositories registered as **source material** — methodology, patterns,
candidate skills — never as runtime dependencies.

Rules (enforced by brain-security-guard + reference-repo-audit):
- `install_policy: do-not-install-directly` on every entry, no exceptions.
- Skill/agent adoption from a source goes through scout → audit → adapt → eval.
- `sources/<name>/` holds documentation only (source cards, maps) — no executables.
- Extracted patterns land in `.project-brain/synthesis/` as synthesis-authority content.

Files: `registry.json` (source of truth, schema-validated) · `registry.md`
(generated — run brain-reference-repo-add/refresh to regenerate, don't hand-edit)
· `sources/<name>/source-card.md` per entry.
