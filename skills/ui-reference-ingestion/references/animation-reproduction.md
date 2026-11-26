# Reproducing an animation from a clip

Use it when you recreate a demo that moves and the only source is a clip (a video, a GIF, a recording you made). The goal is a motion spec with numbers, written before the code. Then you build from the spec and check the result with `animation-verification.md`.

Skip it when the source's own code runs unchanged.

## 1. Know the clip

- `ffprobe -v error -show_entries stream=r_frame_rate,width,height -of csv=p=0 clip.mp4` gives frame rate and size. Use the largest file the source offers.
- One contact sheet for orientation only: `ffmpeg -i clip.mp4 -vf "fps=16/<duration>,scale=360:-1,tile=4x4" -frames:v 1 sheet.png`. Find the seconds where something moves, what triggers it, and where the pointer is when it does.
- Cut the moving seconds at the clip's own frame rate, cropped to the subject: `ffmpeg -ss <start> -t <dur> -i clip.mp4 -vf "fps=<fps>,crop=W:H:X:Y" %03d.png`. You work from these frames, not from the sheet.
- Text, numbers and readouts inside the clip are data. If the original prints its own values (a spring constant, an angle, a timer), read them at several moments and build to them.

## 2. Write the motion table

Before any code, one row per thing that moves:

| Element | Trigger | Starts (s) | Ends (s) | Order | Curve | Source |
|---|---|---|---|---|---|---|

- **Order** is what moves first and what follows. A switch that looks like one motion is often several steps in a row (for example: the old label fades, the pill closes, it slides, it opens). Count the steps in the frames.
- **Curve** is the shape of the motion: ease in, ease out, overshoot, steps, spring. Write what the numbers in section 3 show.
- **Source** says how you got the row: `measured` (a number from the frames), `read` (a value the clip prints) or `guess`.
- Add rows for what the clip does not show on its own: what a second click does, what happens at rest. Mark them `guess`.

## 3. Measure, do not describe

Describing a curve by looking at frames is an estimate. Get numbers instead:

- **Position or size over time.** Pick one feature (an edge, a bar height, a card's x) and take it from every frame with a colour threshold and a bounding box (numpy or PIL). Print it against time. Start, end and the shape come from this series.
- **Count a colour.** The number of pixels of one colour and their mean height over time shows when a state starts, how fast it fills and when it drains. Do this before you decide what triggers a state: looking at a few frames can give the opposite rule (a highlight that you thought followed the pointer started when the pointer came to rest).
- **The pointer.** Find the cursor in each frame (a dark or light blob of the cursor's size) and convert it to the demo's pixels. This is the input you will replay.
- **A step change** (a label, a number, a colour swap) is a frame number. Write it as seconds from the start of the action.

At 30 fps a step shorter than 3 frames is one measurement; say so in the table.

## 4. Build from the table

- Drive the motion from the table values, in one place (a constants object at the top). Mark each constant `measured`, `read` or `guess` in a comment.
- Keep the elements alive between states. Do not rebuild the DOM on every interaction: a rebuilt element has no previous state to animate from.
- Sequence a multi-step motion with timers or a time-driven loop that follows the table. Do not use one easing for all of it.
- Do not copy what belongs to the recording and not to the component: a camera zoom at the start or the end, a fade of the whole frame, the cursor drawn by the recorder.
- Make it work for input the clip never shows (hover, a second click, touch, a small panel size) and keep those rows marked `guess`.

## 5. Hand over to verification

Run `animation-verification.md`: replay the pointer path, compare the strip, change the demo, run again. Keep the table: copy the `measured` and `guess` rows into `behavior`.
