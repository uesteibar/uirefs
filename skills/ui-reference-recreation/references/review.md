# Reviewing a recreated demo

Do this yourself, in a visible browser tab (`Page.bringToFront`). A hidden tab pauses animations and makes a good demo look frozen.

1. **Serve** the output with a small static server that adds the target's sandbox headers (for uirefs: the `/demo` Content-Security-Policy, see the library's `guide`). Use a free port on 127.0.0.1 and stop the server when done.
2. **List the real controls** and their centre points from the DOM, for example `querySelectorAll('button,[role=radio],[role=slider],input')` with `getBoundingClientRect`. A click at a guessed coordinate does nothing and looks like a bug.
3. **Drive it with real input** through CDP `Input.dispatchMouseEvent` (move, press, move in steps, release), `Input.dispatchKeyEvent` and `mouseWheel`.
4. **Compare with the reference.** For a piece that moves, a still is not enough: compare frame by frame.
   - Cut the animated seconds of the clip at its own frame rate (`ffmpeg -ss <start> -t <dur> -i clip.mp4 -vf fps=<fps>,crop=... %03d.png`).
   - Replay the same input in the demo while recording its frames with their times, and take the demo frame shown at each clip frame time.
   - Put the clip on the top row and the demo on the bottom row, the same moments left to right (start, a quarter, half, three quarters, end of each transition), and look at the strip. When it differs, change the demo and run it again.
   - If `ui-reference-ingestion` is installed, `references/animation-verification.md` there has the full procedure and `templates/frame-compare.mjs` does these steps.
   - Say what you compared this way and what you did not.
   For a static piece, compare with the reference still and note what differs; do not fix style by feel.
5. **Check sizes:** the full width, and once the small panel size (about 293x320) inside the app after saving: open `#/r/<id>`, scroll the iframe into view (`scrollIntoView({block:'center'})`), screenshot it.
6. **Wheel and arrow keys** too, when the original scrolls or slides.
7. A typo found in `behavior` after saving: read the stored field, replace the span and send the whole field with `update`.
