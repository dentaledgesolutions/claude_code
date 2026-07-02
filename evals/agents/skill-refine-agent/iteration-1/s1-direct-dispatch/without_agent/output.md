# Baseline Response: "Refine skill-adapt — trigger accuracy is too low"

**Mode:** General capabilities only (no skill-refine-agent dispatch)

---

## What I Would Do

### Step 1: Read the current eval report

The first file to read is `skills/skill-adapt/SKILL-EVAL.md`. This tells me which specific scenarios are failing trigger checks and what the current trigger accuracy number is, along with any analyst observations about why triggers misfired.

**Finding from SKILL-EVAL.md:**
- Trigger Accuracy: 87% (just above the 85% threshold, but the prompt signals it is still a problem)
- Scenario 5 (semantic-rewrite-skill): triggered only 2/3 reps — "rewrite" is not present in the description, so the model infers it inconsistently. This is the primary flaky trigger.
- Scenario 3 (edge-case-after-audit-pass): trigger fired correctly, but checklist/output scored low — not a trigger accuracy issue per se, but a workflow completeness gap.

### Step 2: Read the description in SKILL.md

The current description frontmatter in `skills/skill-adapt/SKILL.md` reads:

> "Adapts a security-audited skill to match a specific project's patterns, terminology, workflow gates, and installed skill ecosystem. Use when adapting a skill for a project, customizing a skill, modifying a skill to fit a project's workflow, after skill-audit returns PASS, or when synthesizing multiple candidate skills into one project-native skill."

**Problem identified:** The word "rewriting" and "rewrite" do not appear anywhere in the description. When a user says "rewrite skill-audit for this project," the model has to infer that skill-adapt handles this — it has no explicit signal. That inference is unreliable (2/3 success rate in testing).

### Step 3: Determine the correct lever

Low trigger accuracy maps to **Lever A** in the autoresearch framework: the `description:` frontmatter is the routing surface the model reads to decide whether to activate a skill. If a trigger phrase is absent, the model cannot reliably dispatch.

I would not touch Lever B (workflow steps), Lever C (examples), Lever D (reference/what-not-to-do), or Lever E (scripts) — those affect what happens after the skill fires, not whether it fires.

### Step 4: Propose the description edit

**Before:**
```
...modifying a skill to fit a project's workflow, after skill-audit returns PASS...
```

**After:**
```
...modifying a skill to fit a project's workflow, rewriting a skill to match project conventions, after skill-audit returns PASS...
```

This adds "rewriting a skill to match project conventions" as an explicit trigger phrase directly in the description's "Use when" list. The phrase mirrors the exact language used in scenario 5's test prompt: "Rewrite skill-audit for this project's conventions."

I would also check whether any negative examples are needed. If "rewrite" should sometimes route to a different skill (e.g., a write-a-skill-from-scratch skill), I would add a negative clarifier: "Do not trigger for requests to write a new skill from scratch — this skill only adapts existing audited skills." But since no such conflict exists in the installed skill set, this is not needed.

### Step 5: Apply the edit and verify character count

The description must stay within 1024 characters (Agent Skills spec limit). After the addition, the description is approximately 390 characters — well within limits.

**Edit location:** `skills/skill-adapt/SKILL.md`, frontmatter `description:` field.

### Step 6: Check for other missing trigger phrases

While I have the description open, I would scan for other verbs a user might use that are semantically equivalent to "adapt":
- "port a skill" — not present; add "porting a skill to this project" if scenarios show this is a real trigger
- "configure a skill" — borderline; "customizing a skill" already covers it
- "tailor a skill" — not present but low frequency; skip for now

For this refinement I would only add the confirmed-flaky phrase ("rewriting") and stop — adding too many phrases increases description length and risks trigger overlap with other skills.

### Step 7: Sync to runtime

After editing SKILL.md:
```bash
cp -r skills/skill-adapt ~/.claude/skills/
```

This makes the change immediately live in Claude Code without restarting.

### Step 8: Manually re-test the trigger

I would run 3 reps of the failing scenario manually:
- "Rewrite skill-audit to match our project conventions" → expect trigger
- "Rewrite the skill-scout skill for this project" → expect trigger
- "Rewrite my React component for mobile" → expect NO trigger (adversarial)

All three should now route correctly given the explicit "rewriting a skill to match project conventions" phrase (which excludes "React component" because it is not a skill).

### Step 9: Note what I would NOT do

Without the autoresearch loop's scoring infrastructure, I cannot:
- Run the full 9-scenario eval suite programmatically
- Compute a new trigger_accuracy number with confidence intervals
- Automatically revert if the change made things worse

I would record the manual test results in a comment in SKILL-REFINE-LOG.md and flag that a full skill-eval re-run is needed to confirm the metric improvement.

---

## Files I Would Look At

1. `skills/skill-adapt/SKILL-EVAL.md` — identifies failing scenarios and trigger accuracy breakdown
2. `skills/skill-adapt/SKILL.md` — the `description:` frontmatter is the mutation target (Lever A)
3. `skills/skill-adapt/REFERENCE.md` — validation checklist and allowed-vs-forbidden changes table
4. `skills/skill-adapt/SKILL-REFINE-LOG.md` — prior iteration history, to avoid re-attempting changes that were already tried and reverted

## Changes I Would Make

**Single edit to `skills/skill-adapt/SKILL.md` description:**

Add `"rewriting a skill to match project conventions,"` to the trigger phrase list in the `description:` frontmatter. This directly addresses the flaky trigger in scenario 5 by making the routing decision deterministic rather than inferred.

No other files need to change for a trigger accuracy fix. REFERENCE.md, workflow steps, and scripts are all out of scope for Lever A.

---

## Limitations of This Approach (Without Agent)

- No automated eval re-run: I cannot produce a new trigger_accuracy metric with statistical confidence
- No rollback mechanism: if the new phrase causes trigger overlap with another skill, I would only discover it through manual testing or user reports
- No iteration loop: the autoresearch loop would try Lever A, score, keep or revert, then try Lever C for the secondary issue (scenario 3 provenance gap) — I can describe both fixes but cannot run the scoring loop
- Risk of missing the secondary issue: scenario 3's low score is a checklist/output gap, not a trigger gap, but it drags down eval_pass_rate — a complete refinement would address both, but without the loop I might declare success after the trigger fix and miss the provenance field issue in REFERENCE.md
