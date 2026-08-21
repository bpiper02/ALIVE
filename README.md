# b.com / ALIVE

A zero-dependency browser MVP that turns cover art and an MP3/WAV segment into destination-specific music promos. Output presets cover Instagram Reels, Stories, 4:5 Feed, square posts, and 3–8 second Spotify Canvas loops.

The app is fully local-first: user media and rendering remain in the browser, and all application fonts are bundled as static assets. See `FONT_INVENTORY.md` for the typography and license inventory.

## Run

Serve this folder with any static server, then open it in a modern browser. For example:

```powershell
python -m http.server 4173
```

Open `http://localhost:4173`. Click **Load the demo** for built-in sample cover art and audio.

## Support-link configuration

Launch settings are centralized in `site-config.js`: the public share URL, contact email, and optional Cloudflare Web Analytics token. The b.com mark is removed on an honor basis after native sharing or copying the public link; the unlock is stored only in `sessionStorage` for the current tab session.

Cloudflare Web Analytics is disabled while `cloudflareWebAnalyticsToken` is blank. In Cloudflare Web Analytics, add the deployed hostname, choose manual JS snippet installation, and paste its 32-character token into `site-config.js`. Do not also enable automatic injection, which would load a duplicate beacon. No custom events or media fields are sent.

Read `CODE_WALKTHROUGH.md` for a plain-English tour through every part of the app.

The production exporter is committed under `exporter-dist/`. If exporter dependencies change, rebuild it with:

```powershell
pnpm install
pnpm run build:exporter
```

## Export

Export first uses WebCodecs plus Mediabunny to create a deterministic, fast-start H.264/AAC MP4. Native encoders are capability-tested against the exact output configuration; the AAC software fallback is a separate lazy-loaded chunk. MediaRecorder remains the compatibility path. Everything runs locally in the browser. The canvas architecture separates analysis, templates, and output dimensions so later segmentation, depth, lyric, and aspect-ratio modules can be added without changing the upload flow.

Uploads are processed locally with strict JPG/PNG/WebP and MP3/WAV validation. File signatures must match both MIME type and extension. Desktop budgets allow up to 24 MiB, 64 MP, and 16,384px per side for artwork, plus 100 MiB, 10 minutes, and 256 MiB of decoded audio. Mobile or low-memory devices use 12 MiB, 32 MP, and 8,192px per side for artwork, plus 40 MiB, 4 minutes, and 96 MiB of decoded audio. Retained artwork is downsampled to at most 12 MP / 4,096px per side on desktop or 6 MP / 3,072px per side on constrained devices. WAV headers are inspected before browser decoding to reject malformed chunks and estimate duration and decoded PCM memory. Invalid or memory-heavy replacements show a friendly error and leave the last valid media intact.
