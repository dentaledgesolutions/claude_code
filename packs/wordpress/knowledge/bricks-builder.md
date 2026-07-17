---
type: knowledge
title: "Bricks Builder Fundamentals"
description: "Describes what Bricks is, how its templates, elements, and global styling work, and how it differs from the native Gutenberg block editor."
tags: [wordpress, bricks, page-builder, theme]
timestamp: 2026-07-17
sources: [https://developer.wordpress.org/rest-api/, https://academy.bricksbuilder.io/]
---

# Bricks Builder Fundamentals

## What Bricks Is

- Bricks is a **visual site builder theme** for WordPress — it replaces the default theme/template layer with its own front-end, drag-and-drop visual editor.
- Unlike a plugin bolted onto an existing theme, Bricks *is* the theme: it controls the header, footer, page templates, and archive/single rendering directly.
- Design intent is "design visually, not with code" — non-developers can assemble full page layouts, while developers can still extend it with custom elements, dynamic data, and code execution blocks.

## Templates: Header / Footer / Single / Archive

- Bricks uses reusable **templates** assigned by condition, similar in spirit to WordPress's full-site-editing template hierarchy but managed inside Bricks' own template library:
  - **Header** and **Footer** templates apply site-wide (or per conditional rule set) and wrap page content.
  - **Single** templates control the layout for an individual post/page/CPT entry (e.g. "Single: Post", "Single: Product").
  - **Archive** templates control listing views (category archives, CPT archives, search results).
- Templates can be scoped with conditions (e.g. "apply to all posts in category X," "apply to this specific page"), letting one template serve many entries.
- A page's individual content can either use the "content" template (rendering normal post content) or be entirely built in Bricks with a page-specific layout.

## Elements and Components

- **Elements** are the building blocks placed on a canvas: containers, text, image, buttons, forms, sliders, and framework-agnostic layout primitives (flexbox/grid based containers).
- **Components** (introduced in later Bricks versions) let you group elements into a reusable unit that can be dropped in multiple places and updated from one source — analogous to a symbol/component system in design tools.
- Elements support **dynamic data** tags that pull from post fields, custom fields (including ACF/Meta Box), taxonomy terms, and site settings, so a single template can render different data per entry.

## Global Classes and Variables

- **Global classes** are named, reusable style definitions (similar to a CSS class) that can be applied to any element; editing the class definition updates every element using it site-wide.
- **Global variables** (color, spacing, typography tokens) centralize design values so a brand color or spacing scale can be changed once and cascade everywhere it's referenced.
- This class/variable system is Bricks' mechanism for maintaining visual consistency without hand-writing custom CSS on every element — analogous to a design-token system.

## How Bricks Content Is Stored

- Bricks does not store its layout as Gutenberg block-comment HTML in `post_content`. Instead, the visual structure (elements, nesting, settings, styles) is serialized and stored in **post meta** (commonly under a meta key such as `_bricks_page_content_2`), as a structured/serialized data tree rather than rendered markup.
- Templates themselves are stored as a dedicated post type (`bricks_template`) with their own structured content, independent of the pages/posts that use them.
- Because the canonical representation lives in post meta rather than `post_content`, editing Bricks layouts safely generally requires going through the Bricks editor/API rather than editing raw `post_content` via the standard REST API content field.

## How Bricks Differs from Gutenberg Blocks

- **Storage model**: Gutenberg blocks are HTML-with-comments in `post_content` (portable, readable by any block-aware renderer); Bricks stores a structured settings tree in post meta (renders only through the Bricks front-end engine).
- **Ownership of layout**: Gutenberg is a content editor layered on top of whatever theme is active; Bricks is the theme itself, owning header/footer/template rendering, not just in-content editing.
- **Portability**: Gutenberg content degrades gracefully if a theme is switched (blocks still render as HTML). Bricks-authored layouts are tightly coupled to the Bricks theme/plugin being active — removing Bricks leaves the structured data unrendered.
- **Styling model**: Gutenberg relies on theme.json and block supports for global styling; Bricks relies on its own global classes/variables panel, independent of theme.json conventions.
- **Editing surface for agents**: because of the storage difference, automating "edit this page's content" needs different handling depending on whether the page uses Gutenberg blocks (safe to touch `content` via REST) or a Bricks-built layout (must go through Bricks-aware tooling, not raw `content` field edits).
