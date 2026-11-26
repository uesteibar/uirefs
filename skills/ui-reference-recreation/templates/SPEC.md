# Spec: <NAME>

Write this before any code. Every line is something you can check later.

Reference files: `<name>.mp4` (<duration> s, <WxH>, <fps> fps), `<name>-sheet.png` (frames in reading order), `<name>-frame.png` (one still). Extract more frames with ffmpeg; crop and upscale to read small text.

What it is: <one paragraph of measurable facts: layout, colors with hex values, type, sizes in px, text strings, counts>.

Interactions:
- Hover: <...>
- Press and drag: <...>
- Keyboard: <...>
- Touch: <...>
- Timings and easing you can measure: <...>

Not visible in the recording (decide, and write what you chose in `behavior`): <hover or press, trigger, end states>.

Responsive: 320 to 1440 px. At 293x320 the piece must still be usable and nothing may overlap.

Output: `out/<name>.html`, one self-contained file. Time budget: about 40 minutes.
