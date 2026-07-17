---
type: knowledge
title: "Content Operations Recipes"
description: "Practical goal-to-endpoint recipes an agent runs against a WordPress + Bricks site, emphasizing draft-first changes on staging only."
tags: [wordpress, bricks, rest-api, operations]
timestamp: 2026-07-17
sources: [https://developer.wordpress.org/rest-api/, https://academy.bricksbuilder.io/]
---

# Content Operations Recipes

All operations below assume a **STAGING** environment and **DRAFT** status by default. Do not target production. Do not publish directly — leave content in `draft` (or `pending`) status for human review unless the operator has explicitly authorized publishing.

## Create a Draft Post

- **Goal**: add a new blog post without making it publicly visible.
- **Approach**: `POST /wp-json/wp/v2/posts` against the staging site, authenticated with a scoped Application Password.
- **Key fields**: `title`, `content`, `status: "draft"`, optionally `categories` (array of term IDs), `tags` (array of term IDs), `excerpt`, `slug`. Never set `status: "publish"` unless explicitly instructed.

## Update a Page's Content

- **Goal**: modify existing copy on a standard (Gutenberg) page.
- **Approach**: `POST /wp-json/wp/v2/pages/<id>` (partial update) on staging. First `GET` the page to confirm it is Gutenberg-based (content is HTML in `content.raw`/`content.rendered`), not a Bricks-built page.
- **Key fields**: `content` (full replacement HTML/block markup — REST updates replace the whole field, so fetch-modify-send), `status` left as `draft` if the page is not yet live, or left unchanged if only editing an already-live page's draft revision. Prefer creating/updating a draft/autosave rather than overwriting live `content` directly when the page is already published.

## Edit a Bricks Template or Bricks-Built Page

- **Goal**: change a header/footer/single/archive template or a page whose layout was built in Bricks.
- **Approach**: Bricks content lives in structured post meta (not `post_content`), so it is **not safely editable via the generic REST `content` field**. Prefer the Bricks editor UI, Bricks' own data structures/API surface, or a vetted Bricks-aware integration — never hand-edit the serialized meta blob via a generic `POST /wp/v2/pages` call.
- **Key fields**: identify the template type (`bricks_template` post type) or the target page/post ID first; confirm with a `GET` whether the page uses Bricks (presence of the Bricks content meta key) before attempting any content change; treat direct meta-field writes as high-risk and staging-only, reviewed before promotion.

## Manage Categories and Tags

- **Goal**: create, rename, or assign taxonomy terms.
- **Approach**: `GET/POST /wp-json/wp/v2/categories` and `GET/POST /wp-json/wp/v2/tags` for built-in taxonomies; custom taxonomies follow the same pattern at `/wp-json/wp/v2/<taxonomy-rest-base>` if `show_in_rest` is enabled.
- **Key fields**: `name` (required on create), `slug` (optional, auto-generated if omitted), `parent` (categories only, for hierarchy), `description`. To assign terms to a post, include the taxonomy's REST field (e.g. `categories: [id, id]`) on the post/page create-or-update call.

## Handle Media

- **Goal**: upload an image/file and attach it to a post, or reference existing media.
- **Approach**: `POST /wp-json/wp/v2/media` with the binary file in the request body and a `Content-Disposition` header specifying the filename; the response returns a media `id` and `source_url`. Attach via `featured_media: <id>` on a post/page, or reference `source_url` inside content.
- **Key fields**: `title`, `alt_text` (accessibility — always set when known), `caption`, `post` (optional, to associate the media item with a specific post ID at upload time).

## General Discipline

- Confirm the target host is the staging URL before any write call — never assume; check the base URL explicitly.
- Default every create/update to `status: "draft"` unless the operator's instruction explicitly says publish.
- For Bricks-specific structures, treat "I'm not sure this is safe to touch via generic REST" as a stop condition, not a guess-and-proceed situation.
- Log or report the endpoint, method, and target ID of every write so a human can review before promotion to production.
