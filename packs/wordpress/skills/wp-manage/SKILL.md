---
name: wp-manage
description: "Use when someone asks to read or edit a WordPress/Bricks site — 'draft a blog post', 'update the pricing page', 'tweak the Bricks header template', 'fix the copy on the homepage'. Reads freely and edits autonomously — but only on the client's STAGING site, drafts by default. Not for: publishing to production (a separate approval-gated step), Google Ads/Analytics, or non-WordPress sites."
compatibility: "Claude Code. Part of the wordpress domain pack. execution_mode: staging-autonomous, risk_tier: standard. Requires a per-client STAGING site binding under clients/<client>/. Writes go to staging only; production promotion is out of scope. Live execution runs on the future Hermes runtime (declarative in this phase)."
risk_tier: standard
---

# WordPress / Bricks Manage (staging-autonomous)

Read and edit WordPress/Bricks content **autonomously on staging** — never production.

## When to use
- The user wants to read, draft, or edit posts, pages, or Bricks templates on a client's site.

## Workflow
1. Resolve the client's STAGING `site_ref` from `clients/<client>/` (`staging_site_url` handle — never a raw credential).
2. **Read first** with `wp_list_content` / `wp_get_content` to ground edits in current content.
3. **Edit autonomously against staging** with `wp_create_post` / `wp_update_content` / `wp_update_bricks_template`. New content is created as a **draft** by default. No per-action approval is required — but every write must resolve to the staging target.
4. **Stop at production.** Promoting staging → production is a separate, approval-gated operation outside this pack; never write to a production target here.

## Guardrails
- Writes go to the resolved `staging_site_url` only; never a production URL.
- Create as draft by default; edit Bricks global classes/variables cautiously (they cascade site-wide).
- No credentials in output or logs; operate on the resolved `site_ref` only.

## Success criteria
- Correct content changes on staging, drafts by default, nothing written to production, no credentials exposed.
