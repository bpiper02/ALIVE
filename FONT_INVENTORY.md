# ALIVE font inventory

ALIVE bundles every font it uses. The application does not request fonts from Google Fonts or any other network service.

| ALIVE family | Bundled typeface | Used for | Replaces |
| --- | --- | --- | --- |
| `Inter` | Inter variable | Main UI, headings, buttons, template display copy | Existing Google-hosted Inter and generic Arial fallback |
| `DM Mono` | DM Mono Regular + Medium | Utility UI, labels, metadata, template technical copy | Existing Google-hosted DM Mono and generic monospace fallback |
| `Alive Condensed` | Archivo Narrow variable | Cover Maker anti-design/condensed option | Arial Narrow |
| `Alive Serif` | Libre Baskerville variable | Cover Maker serif option | Georgia |
| `Alive Impact` | Anton Regular | Cover Maker impact option | Impact |
| `Alive Script` | Pacifico Regular | Cover Maker handwritten option | Brush Script MT |

The previous `Arial` classic-sans and `Courier New` typewriter choices are represented by the already-bundled Inter and DM Mono families. Their existing Cover Maker choices remain present, while both now resolve to deterministic local faces.

All six bundled typefaces are distributed under the SIL Open Font License 1.1. The exact license text and copyright notice shipped with each family are retained beside its font files under `assets/fonts/<family>/OFL.txt`.

Before ALIVE draws a generated cover, starts preview playback, or begins export, `app.js` loads and checks every required face through the Font Loading API. The buttons stay unavailable until that check succeeds, preventing canvas text from being captured with a device fallback.
