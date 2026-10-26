# Scrawl

A sketchbook in your browser. Felt-tip diagrams, flows and wireframes on dotted paper, with no account and no server. It saves on your device.

**Try it:** https://mhfrough.github.io/scrawl/

## What it does

- **Markers, not pencils.** Boxes, circles, diamonds, arrows and lines are drawn as single felt-tip strokes. Box corners cross over like a quick architect's sketch. "Steady", "Loose" and "Wild" set how shaky the hand is.
- **Print-style fills.** *Offset* prints the colour slightly off the outline, like a risograph. *Solid* sits inside it, and *Dots* is a halftone tint.
- **Pen and highlighter.** The pen draws a tapered, pressure-like line. The highlighter is translucent and blends with what's under it.
- **Text.** Handwritten or print lettering in four sizes. Double-click anywhere to write, or double-click a shape to label it.
- **Pictures.** Drag a photo onto the page, paste one, or use the picture button (`I`). Each one is held on with a strip of torn tape, which you can switch off. Big photos are scaled down to 2400px. Pictures are kept in the browser's IndexedDB, travel inside `.scrawl` files, and appear in PNG and SVG exports.
- **Draw again and again.** The tool you pick stays on, so you can draw line after line. Press `Q` (the lock in the rail) to go back to Select after each shape instead.
- **Editing.** Select, multi-select (Shift or drag a box), move, resize, Alt-drag to duplicate, layer order, copy and paste, undo and redo, zoom and pan, snap to the dots.
- **Saving.** Every change autosaves to the browser (`localStorage` for drawings, IndexedDB for pictures). *My drawings* keeps any number of pages with thumbnails.
- **Files.** Save and open `.scrawl` files (plain JSON) and export PNG (1×–3×) or SVG, with or without paper, light or dark. You can also copy a PNG straight to the clipboard.
- **Copy and paste.** Copying a selection (`Ctrl C`, or Copy image on the right-click menu) puts just that selection on the clipboard as a PNG, so it pastes cleanly into an image editor, a chat or a doc. A single picture goes out as itself, at its own size with no paper. Other things are cropped tight, with paper or without as the export sheet is set. Pasted back into Scrawl, they come back as shapes you can still edit.
- **Paper and theme.** Dotted, ruled or plain paper; light, dark or automatic theme. Dark mode flips each colour's lightness so drawings read the same on both.
- **Phones.** Tools move to a bar along the bottom, and pinch zooms.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Markup: rail, title, context bar, dialogs |
| `styles.css` | All styling (light and dark) |
| `scene.js` | Element model, the marker look, hit testing, canvas and SVG renderers, input validation |
| `app.js` | The editor: tools, selection, history, autosave, drawings list, export, shortcuts |
| `icon.svg` | Favicon |
| `assets/fonts/` | Bricolage Grotesque and Shantell Sans (SIL OFL 1.1, licences alongside) |
| `assets/og-image.jpg`, `robots.txt`, `sitemap.xml` | Share card and search engine files |

There are no dependencies and no build step. Both fonts (Bricolage Grotesque and Shantell Sans) are served from `assets/fonts/`. Exported SVGs link to the same fonts on Google Fonts so they render anywhere. The header also shows the repo's star count from the GitHub API (`api.github.com`), refreshed at most every five minutes.

## Run it

Any static server works:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. To publish it, upload the folder to GitHub Pages, Netlify, Cloudflare Pages or any static host.

## Shortcuts

`V` select · `H` hand · `R` box · `O` circle · `D` diamond · `A` arrow · `L` line · `P` pen · `M` highlighter · `T` text · `I` picture · `E` eraser · `Q` keep tool · `1`–`6` marker colours · `Ctrl Z` / `Ctrl Shift Z` undo / redo · `Ctrl D` duplicate · `Ctrl S` save file · `Shift 1` fit everything · `?` all shortcuts

## Limits

- Drawings live in this browser only. Clearing site data deletes them, so use *Save to file* for anything you want to keep.
- `localStorage` holds roughly 5 MB per site, which is thousands of shapes but not unlimited. Scrawl warns you when it's full.
- Pictures are stored in IndexedDB on this device. Saving to a file embeds them, so `.scrawl` files with photos can be large.

## Licence

MIT. See `LICENSE`.

Made by Mohammad Hamza ([@mhfrough](https://github.com/mhfrough)).
