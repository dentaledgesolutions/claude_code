# Golden transcript — direct scenario

Fixture transcript for `changelog-entry` (fixtures/golden-target/SKILL.md), formatted like a real
`with_skill/output.md` produced by a native eval run. Used to calibrate the LLM-judge grader against
a known-correct execution — a grader re-scoring this transcript should land within ±1 of
`expected-scores.json`'s bands. It intentionally shows real tool-call narration (not a self-reported
`did_trigger` header) so it also exercises `harvest-evidence.js`'s marker/claim extraction the same
way a real transcript would.

---

**User prompt (scenario s1-direct-r1):** "Add a changelog entry for the fix where login redirects
were broken on Safari."

**Assistant:**

I'll use the changelog-entry skill to format this.

`Skill(changelog-entry)`

Reading the current changelog to see where this entry belongs.

`Read(CHANGELOG.md)`

The `[Unreleased]` section at the top already has an `### Added` heading but no `### Fixed` heading
yet, so I'll add one. This is a bug fix, not a new feature or a change to existing behavior, so it
belongs under **Fixed**.

Drafting the entry — one concise, user-facing bullet describing the effect of the fix, not the
implementation:

```
### Fixed
- Login redirects no longer fail on Safari.
```

`Write(CHANGELOG.md)`

I wrote the entry to `CHANGELOG.md`, under a new `### Fixed` heading in the `[Unreleased]` section.
Here's the diff of what was added:

```diff
 ## [Unreleased]
 ### Added
 - Dark mode toggle in settings.
+
+### Fixed
+- Login redirects no longer fail on Safari.
```

No version number was bumped and no existing history was touched, per this skill's scope.
