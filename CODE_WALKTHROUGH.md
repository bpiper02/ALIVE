# b.com / ALIVE — code walkthrough

This app is intentionally small: plain HTML, CSS, and browser JavaScript. There is no framework, server, database, or upload API. Your cover and song stay in the browser.

## The core files

- `index.html` describes what exists: upload boxes, duration buttons, timeline, templates, preview canvas, and export controls.
- `styles.css` decides how the website UI looks. It does not draw the exported video.
- `app.js` validates and loads files, draws every video frame, and coordinates previews and exports.
- `audio-analysis.worker.js` performs amplitude, bass-energy, and transient analysis away from the main UI thread.
- `exporter-dist/` contains the modular browser-only WebCodecs/Mediabunny exporter and compatibility fallback.
- `README.md` explains how to run the project.

## The full data flow

```text
image file ──> Image object ─────────────────────┐
destination ─> dimensions + safe zones ─────────┼─> draw canvas frame ─> preview
audio file ─> AudioBuffer ─> amplitude data ────┘                  └─> recorder ─> video
```

The `state` object near the top of `app.js` is the app's short-term memory. It stores the loaded cover, decoded audio, selected start time, selected duration, active template, analysis values, and playback state.

## Loading the cover

`loadCover(file)` validates the selected local image, decodes it into a browser `Image`, and stores either that decoded image or a proportional, locally downsampled canvas in `state.cover`. The app does not permanently force it into a square.

`PRESETS` is the upstream boundary for output geometry. Each destination defines its physical pixel dimensions, allowed durations, safe areas, and special behavior. `updatePreset()` changes the real canvas dimensions and preview shape before a template draws.

This matters because destination and aspect ratio are related but not identical. Reel and Story are both 9:16, but reserve different interface-safe areas. Spotify Canvas is also 9:16, but uses 3/5/8-second visual loops and omits template branding.

There are two different image-fitting ideas in the code:

- `fitCover(...)` uses `Math.max(...)`. The image fills the entire target and excess edges are cropped. This is good for the blurred background.
- `coverContained(...)` uses `Math.min(...)`. The whole cover remains visible inside a maximum width and height. This is correct for the main artwork.

The original prototype assumed one 9:16 destination and later tried forcing source artwork into a square. The current architecture keeps the source intact and resolves layout against the chosen output preset instead.

## Loading and analyzing audio

`loadAudio(file)` reads the file into memory and asks `AudioContext.decodeAudioData(...)` to turn MP3/WAV bytes into raw samples.

Before either loader decodes user media, the upload guard checks an explicit extension/MIME/signature allowlist. Artwork headers are inspected for dimensions before decode. Desktop accepts at most 24 MiB, 64 MP, and 16,384px on either side; constrained devices accept 12 MiB, 32 MP, and 8,192px. Retained artwork is proportionally downsampled to at most 12 MP / 4,096px per side on desktop or 6 MP / 3,072px per side on constrained devices.

Audio is capped at 100 MiB / 10 minutes / 256 MiB decoded PCM on desktop and 40 MiB / 4 minutes / 96 MiB decoded PCM on constrained devices. WAV RIFF, format, and data chunks are inspected before `AudioContext` decoding, allowing declared duration and decoded-memory estimates to reject large, long, malformed, or unusual files early. MP3 duration is checked through a temporary local metadata object before decode, then every successfully decoded file is checked again against its actual `AudioBuffer`. Corrupt replacements never discard the last valid cover or song, load-version tokens prevent stale asynchronous replacements from winning, and all temporary metadata/image object URLs are revoked. These checks are entirely browser-side; no media is transmitted.

`analyze()` looks at 20 small windows per second. For every window it calculates RMS amplitude, a low-pass bass-energy envelope, and a transient/onset value:

```text
square every sample -> average the squares -> square root
```

That produces three synchronized signals stored in `state.analysis`. Breathe follows low-frequency energy, while Echo and Offset follow recent transient changes. This is still lighter than full spectral beat tracking, but avoids making sustained vocals or pads trigger every effect continuously.

## Segment and duration selection

`state.start` is where the clip begins in the song. `state.duration` comes from the active preset: social outputs offer 15/30/60 seconds, while Spotify Canvas offers 3/5/8 seconds.

`updateTimeline()` keeps the range slider, timestamps, selection overlay, and export label synchronized. `syncDurationOptions()` disables choices longer than the uploaded song.

The waveform is another small canvas. `drawWave()` draws one bar per amplitude value, while `drawSelection()` paints the chosen time range over it.

## How frames become motion

The visible/exported `<canvas>` changes between 1080 × 1920, 1080 × 1350, and 1080 × 1080 depending on the destination. `draw(t)` receives elapsed time in seconds and calls one template function:

- `drawFloat(t)` moves a fitted cover using slow sine waves. Sine waves are useful here because they produce smooth motion between -1 and 1 without sudden direction changes.
- `drawPulse(t)` contains three curated modes. Breathe combines bass-driven scale, bloom, and exposure; Echo creates soft delayed artwork impressions on transients; Offset briefly displaces broad image bands. Strength and color mode come from `state.pulse`, while `extractPalette()` derives a vivid default accent from the uploaded artwork.
- `drawInternet(t)` uses one borderless media surface with two responsive arrangements: square/4:5 outputs place large artwork beside a compact information column, while vertical outputs stack large artwork over the controls. It reads editable title, artist, detail, status, and accent values from `state.copy`; its progress bar is `elapsed time / duration`.
- `prepareVinylArt()` is a user-controlled square-crop stage for any uploaded aspect ratio. Fill Disc covers the circle cleanly; Fit / Pad preserves the whole source over a blurred fill. Zoom plus X/Y focal controls modify this intermediate square without touching the original upload. `drawVinyl(t)` masks the result into one large circle, rotates the entire artwork surface, and overlays grooves, a center hole, lighting, and artwork-derived background color.
- `drawSlides(t)` derives each card from the uploaded artwork's real aspect ratio, then repeats identical, tightly framed cards on one centered vertical track. It travels exactly one card spacing over the clip, making the export loop cleanly without random rotation, uneven margins, or accidental cropping.
- `drawTape(t)` builds a smoked translucent cassette from canvas primitives. It uses a larger artwork label, shell highlights, screws, an accent-colored tape path, asymmetric rotating reels, and changing reel radii to show tape transferring from one side to the other. Its label uses `coverContained()` so square, portrait, and landscape artwork stays proportional and fully visible instead of being forced into a crop.

`state.motionSpeed` is shared by Float, Vinyl, Slides, and Tape. The deliberately separated choices are 0.35×, 1×, 2.5×, and 5×. Slides moves three card positions per clip at Normal speed, making its differences immediately visible. Pulse deliberately ignores this setting because it follows the analyzed audio, and Internet remains locked to real playback progress.

The template functions use a half-resolution logical coordinate system: 540 pixels wide and half the selected output height. `draw()` scales that coordinate system by two, producing the full-resolution destination file. This makes layout numbers easier to reason about while supporting multiple aspect ratios.

`requestAnimationFrame(...)` calls the current template repeatedly during preview and export. At 30 recorded frames per second, fifteen seconds contains roughly 450 separately drawn images.

## Preview audio

`play()` creates an `AudioBufferSourceNode`, starts it at `state.start`, and limits playback to `state.duration`. At the same time, an animation loop calculates elapsed time and calls `draw(t)`. Both use the same start moment, which keeps them synchronized closely enough for this MVP.

## On-device audio analysis worker

Decoding remains in the browser through `AudioContext`, but the expensive sample-by-sample analysis runs in `audio-analysis.worker.js`, a browser Web Worker served with the static app. ALIVE copies channel one in bounded 262,144-frame chunks, transfers one chunk at a time, and waits for the worker to acknowledge it before allocating the next. The UI thread yields between chunks, while the worker preserves its filter and frame state across chunk boundaries and returns only the compact analysis result. This avoids a single full-song PCM copy and keeps long-track memory and UI stalls bounded. Nothing is uploaded or sent to an external service.

The worker intentionally preserves the original 20 Hz analysis resolution and formulas for overall amplitude, 180 Hz low-pass bass energy, and transient strength. Twenty readings per second is already a compact resolution while remaining responsive enough for restrained beat-driven motion. It reports percentage progress to the upload tile. Replacing a song terminates the current worker and rejects its pending job before starting the new one, preventing stale results and retained song buffers.

## Export

`exporter.js` is separate from the drawing engine. Its primary path checks the exact H.264 and 48 kHz AAC-LC configurations with `VideoEncoder.isConfigSupported()` and `AudioEncoder.isConfigSupported()`. It asks the existing `draw(t)` function for frames at explicit 1/30-second timestamps. Mediabunny applies encoder backpressure, muxes the encoded tracks into a fast-start MP4, and releases its internal frame resources after submission. Spotify Canvas skips audio entirely.

When native AAC is unavailable but H.264 works, a separate `@mediabunny/aac-encoder` chunk is loaded on demand. It never loads for browsers with native AAC support. The output stays in browser memory and is downloaded through a short-lived object URL.

If WebCodecs H.264 is unavailable or the primary encoder fails, the compatibility path combines two streams:

1. `canvas.captureStream(30)` supplies video frames.
2. `AudioContext.createMediaStreamDestination()` supplies the selected audio.

`MediaRecorder` encodes the combined stream. The app probes canonical AVC/AAC MP4 strings first, then VP9 WebM and VP8 WebM, and reads `recorder.mimeType` to determine the real file extension. WebM is labeled TikTok/YouTube compatible and potentially incompatible with Instagram. Recorded chunks are joined into a `Blob`, converted to a temporary local URL, and downloaded.

The WebCodecs path is deterministic and may run faster than real time. Only the MediaRecorder compatibility path must render in real time.

## Browser resource lifecycle

ALIVE treats each preview, export, uploaded file, and derived artwork canvas as an owned browser resource. Starting new work first disposes of the old work: preview and export animation frames are cancelled, audio sources are stopped and disconnected, AudioContexts are closed, captured MediaStream tracks are stopped, and MediaRecorder callbacks are detached. Temporary download and file-inspection object URLs are revoked as soon as their consumers finish.

When artwork changes, the obsolete decoded image or generated canvas is released and the cached square vinyl canvas is resized to zero before being replaced. When audio changes, references to the prior decoded AudioBuffer and analysis arrays are removed so the browser can reclaim them. The same cleanup runs when the page is genuinely unloaded; back/forward-cache navigation is left intact so browser restoration still works.

These actions do not force garbage collection—the browser controls that—but they remove ALIVE's references and stop active producers, preventing repeated uploads, previews, and exports from accumulating live resources.

Upload and metadata reads also have per-replacement abort controllers. A newer selection immediately revokes the previous metadata/image URL and detaches its event handlers; stale decode results are discarded without replacing the last completed media. Decoded audio is committed only after its analysis worker finishes successfully. Preview AudioContexts are tracked until their asynchronous `close()` settles, and navigation into the back/forward cache stops playback and active work while preserving the completed cover and song for restoration.

## UI event wiring

The bottom of `app.js` connects actions to functions:

- file input changes call `loadCover()` or `loadAudio()`;
- the timeline slider calls `updateTimeline()`;
- template buttons change `state.template` and redraw;
- Internet copy inputs update `state.copy` and redraw the export canvas immediately;
- duration buttons change `state.duration` and redraw;
- Preview calls `play()`;
- Export calls `exportVideo()`;
- drag-and-drop handlers route dropped files to the same loading functions.

The built-in demo creates an SVG cover and a tiny WAV file in memory. It exercises the exact same loading path as real user files, which makes it useful as a smoke test.

`makeGeneratedCover()` is the fallback for musicians without artwork. It draws a real 1200 × 1200 cover from six culturally recognizable directions: Minimal, Anti-Design, Y2K Chrome, Vintage Print, Rave Flyer, and Editorial. Title, artist, background, accent, text color, font, and title size remain editable across all six. The font choices intentionally map to familiar social-video categories—condensed anti-design, classic sans, typewriter, serif, impact, handwritten, and the app's house fonts. The resulting canvas becomes `state.cover`, so every motion template and destination treats it exactly like uploaded artwork.

## Good next learning exercises

1. Add title and artist text fields and replace `UNTITLED RELEASE` / `YOUR NAME` in `drawInternet()`.
2. Change Pulse's `.075` multiplier and amplitude threshold `.28`, then compare the feel.
3. Add a fourth duration while tracing every place that reads `state.duration`.
4. Split the three drawing functions into a `templates/` folder once the app adopts JavaScript modules.
5. Replace the RMS-only analysis with onset detection so Pulse reacts to transients rather than general loudness.
