---
name: ui-reference-search
description: "Use when designing UI. Optional: browse saved references."
---

# Browse the saved UI references for inspiration (optional)

## When to Use

Load it when you design or build UI and a look at the owner's saved references could help: a new screen, component, animation or visual identity where the direction is still open. It is a source of inspiration, **not a step you must run**.

Skip it, and say nothing about it, when:

- the task is a small fix, a refactor or a copy change;
- the owner gave a spec, a mock or a design system to follow;
- the `uirefs` MCP server is not connected or does not answer. Do not stop to fix that; carry on without it.

## How

1. **Check the tool is there.** The MCP server is named `uirefs` (tools `search`, `get`, `list_tags`, `guide`). If you never called `guide` in this session and you are only searching, you can skip it: `search` and `get` are self-explanatory. Read `guide` before you save anything (see `ui-reference-ingestion`).
2. **Search with concepts, not frameworks.** Queries are in English and keyword-based. Use what the thing is and what it should feel like: "pricing toggle", "peel off sticker", "single color portfolio", "storage meter". Try 1 to 3 queries at most; `list_tags` shows the vocabulary if you need words. Filter by `type` (`component`, `site`, `animation`, `identity`, `resource`) when you know it. Resources are things to install or download: icon sets, fonts, illustration libraries, texture packs; ask for them by that name.
3. **Look at the top 3 to 5 hits.** `search` returns thumbnails. Ignore weak matches. If nothing is relevant, say so in one line and move on: an empty search is a fine result.
4. **Open only the useful one or two with `get`.** It returns the images, `behavior` (observable facts: timing, easing, states), the `demo_url` and the demo's HTML source. Open the demo when the interaction matters.
5. **Use it as input, not as a template.** Take the idea, the structure or the motion principle. Fit it to the project's design system and to the owner's taste as the project states it (its agent instructions or design docs); reject what clashes. If the project states no taste, do not assume one. Do not paste a demo's markup or styles into the product unless the owner asks you to implement that reference.
6. **Say where the idea came from.** In your design notes or reply, name the references you used (title and id, for example `r_15`) and what you took from each, so the owner can look at them. Keep it to a line each.

## If the owner picks a reference to implement

That is a different job: follow the verification flow in the MCP `guide` (open `demo_url` next to your build at the same viewport, compare the `behavior` facts, report which you checked).

## Saving what you find

If you meet UI worth keeping while you work, you may offer to save it; do not save on your own unless the owner asked. Saving, and getting the demo, is `ui-reference-ingestion`.

## Pitfalls

- Do not let the search drive the design: 1 to 3 queries, then design. More searching is procrastination.
- Hits are in English and by keywords. A sentence like "something that feels playful" finds little; name the object.
- The library is small and personal. Few hits is normal; do not stretch weak matches to justify the search.
