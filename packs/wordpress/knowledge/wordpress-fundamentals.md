---
type: knowledge
title: "WordPress Core Model"
description: "Explains WordPress's core content model — posts, pages, custom post types, taxonomies, the block editor, users/roles, and the REST API as the programmatic surface."
tags: [wordpress, bricks, cms, rest-api]
timestamp: 2026-07-17
sources: [https://developer.wordpress.org/rest-api/, https://academy.bricksbuilder.io/]
---

# WordPress Core Model

## Posts vs Pages

- **Posts** are time-oriented content (blog entries): chronological, associated with categories and tags, appear in feeds/archives.
- **Pages** are structural, hierarchical content (About, Contact, Services): no built-in categories/tags, can have parent/child relationships, typically used for a site's static skeleton.
- Both are stored in the same `wp_posts` database table, distinguished by `post_type` (`post` vs `page`).

## Custom Post Types (CPTs)

- Developers (or plugins/themes) can register additional content types beyond posts/pages — e.g. `product`, `testimonial`, `event`, `team_member`.
- Each CPT can declare its own supports (title, editor, thumbnail, custom fields), its own taxonomies, and whether it's exposed to the REST API (`show_in_rest`).
- CPTs let a site model domain-specific content without overloading the generic post/page structure.

## Taxonomies

- A taxonomy is a way of grouping content. WordPress ships with two built-in taxonomies: **categories** (hierarchical, one primary grouping) and **tags** (flat, free-form).
- Custom taxonomies can be registered and attached to any post type (e.g. a `genre` taxonomy for a `book` CPT).
- Taxonomy terms are stored separately from posts and linked via a relationship table, so the same term can apply to many posts.

## The Block Editor (Gutenberg)

- The default WordPress editor, built from composable **blocks** (paragraph, heading, image, columns, etc.).
- Content is saved as HTML annotated with HTML comments that encode block metadata (`<!-- wp:paragraph -->...<!-- /wp:paragraph -->`), stored in `post_content`.
- Themes can extend the editor with custom blocks, block patterns (predefined block layouts), and block-based full-site editing (FSE) templates.
- This is the native authoring surface for standard WordPress themes — distinct from how a builder theme like Bricks stores its content (see `bricks-builder.md`).

## Users, Roles, and Capabilities

- WordPress ships default roles: **Administrator**, **Editor**, **Author**, **Contributor**, **Subscriber**, each bundling a set of **capabilities** (e.g. `edit_posts`, `publish_pages`, `manage_options`).
- Capabilities — not roles — are what code should check; roles are just named capability bundles and can be customized per site.
- Least-privilege matters for any agent or automation account: prefer an Editor/Author-scoped application password over an Administrator account when the task only needs content-editing capabilities.

## The REST API as the Programmatic Surface

- WordPress exposes a built-in REST API under `/wp-json/wp/v2/...` covering posts, pages, media, categories, tags, users, comments, and (when enabled) custom post types/taxonomies.
- Common endpoints: `GET/POST /wp-json/wp/v2/posts`, `GET/POST /wp-json/wp/v2/pages`, `POST /wp-json/wp/v2/media`, `GET/POST /wp-json/wp/v2/categories`, `GET/POST /wp-json/wp/v2/tags`.
- Authentication for write operations typically uses **Application Passwords** (built into core since WP 5.6) or OAuth-style plugins — never the user's main login password embedded in scripts or config.
- The REST API is the primary integration point for any external agent or tool that needs to read or modify WordPress content programmatically, rather than scripting the wp-admin UI.
