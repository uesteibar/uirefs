---
name: ui-reference-recreation
description: "Use when rebuilding a gated UI piece from its public preview."
version: 2.1.0
author: uesteibar
license: MIT
---

# Recreate a UI piece from its public preview

## When to Use

Use it when you need a working, self-contained HTML demo of a component, interaction or animation and the real code is out of reach: paid or gated code, or a source that is only a video or screenshots. The result is an approximation written from frames, not a copy. It does not depend on any library; to save the result in the uirefs library, hand it to `ui-reference-ingestion`.

## Decide first

- Look for the real code before anything else (registry file, a "copy code" URL in the JS chunks, an open-source repo): see `ui-reference-ingestion`. Recreate only what stays gated.
- Check the target library for the same source and title first. Sites that sell one catalogue under two names are one source.
- Pick pieces a small HTML file can carry: CSS, SVG, canvas, spring physics. Raymarched or rigged 3D scenes and photographic scenes do not converge. Save those as an animation with the preview clip and a description that says why there is no demo.
- A site that bot-blocks your browser (security checkpoint, HTTP 429) is access control: do not evade it. Take code from a public repo, render the piece yourself for images, and say so in the description.

## Rules for the demo

- One self-contained HTML file. It is shown in an iframe with this header (replace it with the target's real policy; for uirefs, take it from the library's `guide`): `Content-Security-Policy: sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; media-src data: blob:; connect-src 'none'; form-action 'none'`. So: no local files, no cookies or `localStorage`, no access to `parent`. Inline scripts and styles, data: images and https libraries or fonts are allowed. Prefer plain HTML, CSS, JS and canvas; no image files.
- It is interactive and looks like the reference, not a static picture. It fills its window and works from 320 to 1440 px wide.
- Write the code from the frames. Do not fetch the original's code.
- Measure before coding (timing, easing, sizes, colours); do not judge from one still.

## Procedure

1. **Get the preview.** Gallery cards loop a public mp4. Grep the page HTML for `.mp4`; the CDN host is often another domain. Download with `curl -A 'Mozilla/5.0'`, then check the file really is video (`file`, `ffprobe`): a network filter can answer 200 with an HTML block page. If TLS verification fails for the host, stop and report. Turn it off for that host only when the user says to, and then check the file again.
2. **Reference pack**, one scratch directory per piece (not a git repo; absolute paths in notes): `<name>.mp4`, a contact sheet `ffmpeg -i <name>.mp4 -vf "fps=12/<duration>,scale=480:-1,tile=3x4" -frames:v 1 <name>-sheet.png`, one or two stills (`-ss 1 -frames:v 1`), and a zoomed crop of the interesting seconds. The sheet is for orientation; for motion you will also need frames at the clip's own frame rate (step 5).
3. **Spec**, written down before coding (`templates/SPEC.md`): what it is in measurable facts; what happens on every interaction; the responsive range 320 to 1440 px and the small panel size (about 293x320); the output path. Decide a time budget (about 40 minutes per piece): polishing pixels never ends, so past the budget take what exists.
4. **Build** the demo from the spec.
5. **Review it yourself.** Serve the output with a static server that sends the target's sandbox headers, open it in a visible tab, drive it with real input and compare with the reference. For anything that moves, compare frame by frame. Recipe and checks: `references/review.md`.
6. **Hand off.** Give the demo, the preview clip, the reference sheet and the comparison strip to the library flow. Tag it `recreated`. The description says it is a recreation from the public preview and why (code paid or gated). `behavior` holds what you saw, plus one sentence for every text, number or name you had to invent and a list of the paths you did not trigger (touch, error states, second click).
7. **Clean up.** Stop the static server.

## Pitfalls

- A demo that looks right at 780 px can overlap at 293x320. Open it once at the real panel size in the app.
- A demo that looks right at rest can move wrong; one still proves nothing about motion.
- Use absolute paths in notes and scripts, and check where a file landed.
- Do not describe a behavior you did not trigger.
