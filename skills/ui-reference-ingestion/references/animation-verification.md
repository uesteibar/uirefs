# Verifying an animated demo, frame by frame

Use it for any demo that moves (a transition, a gesture, a scroll effect, a loop, an interaction with motion) when a clip of the original exists: a video, a GIF, or a recording you made. A screenshot at rest and a clean console pass demos that move wrong.

Skip it for a fully static piece, and for a demo that is the source's own code running unchanged (then check that it plays and stop).

## 1. Know the clip

- `ffprobe -v error -show_entries stream=r_frame_rate,width,height -of csv=p=0 clip.mp4` gives frame rate and size. Use the largest file the source offers.
- One contact sheet for orientation only: `ffmpeg -i clip.mp4 -vf "fps=16/<duration>,scale=360:-1,tile=4x4" -frames:v 1 sheet.png`. Find the seconds where something moves, what triggers it, and where the pointer is when it does.

## 2. Write down what the user does

Turn the recording into timed input for the demo: pointer moves (with the path and how long each takes), presses, wheel, keys. Read pointer positions from several clip frames and convert them to the demo's viewport pixels. The format is in the header of `templates/frame-compare.mjs`:

```json
[{"t":0,"type":"move","x":500,"y":350},
 {"t":300,"type":"move","x":800,"y":520,"ms":700},
 {"t":1200,"type":"click","x":300,"y":300}]
```

## 3. Run the comparison

```
mkdir cmptool && cd cmptool && npm init -y >/dev/null && npm install playwright && npx playwright install chromium
cp <skill dir>/templates/frame-compare.mjs .
node frame-compare.mjs --demo ../demo.html --clip ../clip.mp4 --actions ../actions.json --out cmp \
  --start 4.2 --dur 2 --crop 700:560:496:240 --demo-crop 250:130:500:440 --viewport 1000x700 --frames 8
```

`--start` is the moment in the clip where the action begins. `--crop` cuts the clip to the subject (ffmpeg `W:H:X:Y`); `--demo-crop` does the same for the demo (`X:Y:W:H`, CSS pixels). Add `--webgl` for canvas or WebGL scenes. `CHROME=/path/to/chromium` uses an installed browser. ffmpeg must be on `PATH`.

It plays the actions with real input in a sandboxed iframe, records the page with the browser's own frame times, and writes `cmp/strip.png`: the clip on the top row, the demo on the bottom row, the same moments left to right. `cmp/report.json` lists the demo frame chosen for each tile and any page errors.

## 4. Read the strip, change the demo, run again

Look at each tile pair for:

- **When**: does the move start and end at the same tile?
- **Shape**: ease in or out, overshoot, steps, what moves first, what follows.
- **Place and size** at each moment, and what stays still.
- **State changes** (colour, text, a feature appearing): at which tile.

For a fast transition, narrow `--start` and `--dur` and pick moments with `--at 0.10,0.13,0.17,0.20,...` (seconds from `--start`). Fix what differs and run again. Stop when the rows agree, or when the difference is understood and written down.

## 5. Numbers, when the eye is not enough

Pick one feature (an eye, a bar height, a card's x) and measure it on both sides: in the clip frames (`<out>/orig/*.png`: a colour threshold and a bounding box with numpy or PIL) and in the demo frames (`<out>/demo/*.png`, or `getBoundingClientRect()` during the run). Print both series against time. What to match: where it starts and stops, the gain between input and output, and the size at rest and at the extreme.

## 6. Limits

- The time resolution is the clip's frame rate (often 30 fps). You verify the shape and the timing of the motion within a frame or two, not exact spring constants. If you fit an easing or a spring, say it was fitted by eye.
- The two timelines are aligned on the moment the action starts. Input latency can move the demo by a frame or two: shift it with `--offset` (ms) and say so.
- A clip shows what its author did, not every state. What triggers a state you saw once is a guess: write it as a guess.
- The recording of the demo runs in real time. A heavy page (WebGL) may drop frames: `max_demo_age_ms` in `report.json` is how old the chosen demo frame was; large values at moments of motion mean the strip is not reliable there.

## 7. Record it

- Save `strip.png` as an image of the reference (`role: state`, caption "clip above, demo below, moments at 0.0 s, 0.3 s, ...").
- In `behavior`, list the transitions you compared frame by frame ("opening, 0 to 0.5 s: shape and timing match within one frame"), the differences that remain, and what you did not compare (touch, a second click, error states, the real easing).
- Tag the reference `recreated` when you wrote the demo.
