---
name: skill-discovery
description: "Use when: the user wants to identify new skills worth building from repeated manual tasks; asks 'what keeps coming up that we don't have a skill for'; wants to review the skill improvement backlog; or the project has been running long enough that friction patterns have accumulated in the logs. Run periodically — after a few campaign cycles or delivery milestones — not as a step in the main skill-sourcing pipeline."
compatibility: "Claude Code. Read tool required. Works with any project that has logs/ and evals/project-context.json."
---

# Skill Discovery

Surface skill candidates from project logs — tasks done manually enough times that they warrant becoming a reusable skill.

This skill is most valuable after a project has been running for a few weeks or campaign cycles. Logs need to accumulate friction patterns before there's meaningful signal to mine. Running it on an empty project produces nothing useful.

## Quick start

```
User: what skills should we build next?
User: what keeps coming up that we don't have a skill for?
User: analyze the logs and find skill candidates
```

## Workflow

1. **Load context**
   Read `evals/project-context.json` if it exists. Extract `installed_skills` — this is the baseline for everything that follows. Any candidate that already maps to an installed skill gets filtered out.

   If `project-context.json` doesn't exist, note that gap and continue — it just means the cross-reference step (step 4) will be less precise.

2. **Read the logs**
   Read the following files if they exist. Skip any that are missing without error.

   - `logs/decisions.md` — decisions made during delivery; repeated manual choices signal automation candidates
   - `logs/agent-handoffs.md` — notes from agent-to-agent handoffs; failures and workarounds surface here
   - `logs/skill-improvement-backlog.md` — explicit backlog of known gaps; highest-confidence source

   If none of the three files exist or all are empty, stop and tell the user: "No log data found — skill-discovery needs accumulated project activity to work. Come back after a few delivery cycles."

3. **Identify patterns**
   Read each log file and look for tasks that appear repeatedly without a corresponding installed skill.

   **Repetition signals (in decisions.md and agent-handoffs.md):**
   - A task described the same way in 3 or more separate entries
   - Phrases like "manually", "did this by hand", "again", "same process as last time", "repeated"
   - A specific output type (a file format, a report section, a data transformation) that appears across multiple dates

   **Failure signals (in agent-handoffs.md):**
   - "couldn't do", "no skill for", "had to workaround", "escalated manually", "this needs a skill"
   - A step that was supposed to be automated but wasn't

   **Backlog signals (in skill-improvement-backlog.md):**
   - Any entry counts as a signal — these are already identified gaps
   - Note how many times a backlog item was referenced across entries (each reference is evidence of continued friction)

4. **Cross-reference against installed skills**
   For each pattern found, check whether any installed skill plausibly covers it. Use loose matching — "write a caption" maps to `social-copy`; "analyze competitors" maps to `competitive-intel-scraper`. Only surface candidates where no installed skill covers the need.

5. **Score each candidate**
   Score each unfilled pattern on two dimensions:

   **Frequency (1–5):** How many times did this task appear across the logs?
   - 1 = 3 occurrences
   - 3 = 5–7 occurrences
   - 5 = 8+ occurrences or explicitly in backlog

   **Effort saved (1–5):** Rough estimate of time this skill would save per use.
   - 1 = minor convenience (saves a few minutes)
   - 3 = meaningful (saves 15–30 min or reduces errors)
   - 5 = significant (saves 30+ min or replaces a multi-step error-prone process)

   **Priority score = Frequency + Effort saved** (max 10)

   Sort candidates by priority score descending. Surface anything scoring 5 or above.

6. **Write skill candidate briefs**
   For each candidate scoring 5 or above, produce a brief:

   ```markdown
   ## Skill Candidate: [suggested-skill-name]

   **Priority score:** N/10
   **Evidence:** Appeared N times in [log file(s)]; last seen [date if available]
   **Example pattern:** "[direct quote or close paraphrase from log — one example]"

   **What this skill would do:**
   [One paragraph: inputs, the task it automates, outputs]

   **Draft trigger description:**
   "Use when [specific conditions that would cause this skill to fire]..."

   **Draft outline:**
   1. [First step]
   2. [Second step]
   3. [Output]

   **Recommended next step:** skill-scout "[search term]" to check if something exists first
   ```

   Always recommend `skill-scout` before building — check if an external candidate exists before authoring from scratch.

7. **Save candidates if requested**
   If the user asks to save the output, append the candidate briefs to `logs/skill-improvement-backlog.md` under a dated heading. This preserves the candidates for future reference and makes them available to future skill-discovery runs.

## Rules

- Don't surface candidates already covered by an installed skill, even loosely
- Frequency counts come from the logs — don't inflate based on how important a task *sounds*
- If log data is thin (under 15 total entries across all three files), note this: "Low signal — results may not be representative"
- Always recommend `skill-scout` before building — build only when no suitable external skill exists
