# reverse-brand

CLI che trasforma un sito pubblico di un brand in una guida di stile **non ufficiale**, misurata e ricostruita con design token.

```
reverse-brand <url> [--images none|api|manual] [--provider fal|openai] [--import] [--headed]
```

Requisiti: Node 20+, Google Chrome installato (in mancanza usa il Chromium di Playwright), `ffmpeg` e `ffprobe` nel PATH.

```
git clone https://github.com/JobAcademysrl/reverse_design && cd reverse_design
npm install
node bin/reverse-brand.js https://example.com --images none
node verify.js out/example.com
```

## Fasi

1. **Capture** (`src/capture.js`, `src/extract-page.js`): Playwright con `--disable-gpu`, home + 3–5 pagine chiave scelte per punteggio dei link (`src/score-links.js`), 1440×900 e un passaggio 390×844 della home. Ogni pagina viene scrollata, poi l'estrattore legge gli stili calcolati di ogni elemento visibile (colori normalizzati in hex con un canvas 1px). Cookie e consenso sono esclusi.
2. **Analyse** (`src/analyse.js`): dedup di header/footer ripetuti, ruoli tipografici con `clamp()`, ruoli colore con OKLCH e quote d'uso, griglia di spaziatura, radii, contenitore, colonne, breakpoint, ritmo chiaro/scuro, bottoni, card, nav, input, immagini, voce (5 citazioni, 3 regole).
3. **Tokens** (`src/tokens.js`): `tokens.css` e `tokens.json` (W3C design tokens, OKLCH accanto all'hex).
4. **Guida** (`src/guide.js`, `src/styles.js`): 13 pagine, art direction presa dai token. `brand-guide.html` (≤150 KB, senza immagini) e `brand-guide-hero.html` (immagini WebP incorporate una volta, ≤4 MB).
5. **Immagini** (`src/prompts.js`, `src/images.js`, `src/providers/`): `prompts.json` con 9 slot. `none` usa i gradienti; `manual` stampa i prompt e `--import` legge `out/<host>/images/<slot>.png`; `api` usa l'adattatore del provider, legge la chiave da `.env`, salva l'id del job prima del polling, scarica in streaming e registra il costo per immagine. Per rivedere a mano i prompt, metti `"locked": true` in `prompts.json`.
6. **Slide** (`src/slides.js`): 8 × 1080×1350 Instagram e 4 × 1600×900 X.
7. **Video** (`src/video.js`): 1920×1080 a 60 fps reali, 11 scene, animazioni in pausa e posizionate a `i/fps`, x264 CRF 14, yuv420p, TV range, BT.709, faststart. `--stills` scrive solo un fotogramma per scena.
8. **Verify** (`verify.js`, `src/verify-lib.js`) e screenshot di ogni sezione in `screenshots/`.
9. **Log**: `run-log.md`.

## Controlli anti-bot

Il CLI non aggira mai bot check o CAPTCHA. Se la cattura headless trova una verifica si ferma e propone:

- `--headed`: si apre il browser e completi tu la verifica;
- lo snippet `out/<host>/devtools-snippet.js` (anche con `--snippet`): incollalo nella console DevTools sul sito, scarica `snapshot.json` e poi `reverse-brand <url> --snapshot snapshot.json`.

## Regole

Tutto è marcato "Unofficial analysis" con la nota "Not affiliated with or endorsed by …". Loghi, file dei font e immagini del brand non vengono copiati: il logo diventa un segnaposto tratteggiato con misure e colore. Le immagini AI nascono solo da prompt testuali e portano l'etichetta "AI-generated image".

Output in `out/<host>/` (ignorato da git).
