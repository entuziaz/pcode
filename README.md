# pCode: Nigeria Addressing MVP

This repo is an MVP for a shared, open postcode/address system that ecommerce teams can integrate.
Repository: [https://github.com/entuziaz/pcode](https://github.com/entuziaz/pcode)

## Scope (Current vs Planned)

- Product name: `pCode`
- Current implementation scope: `Lagos State` only (pilot phase)
- Planned scope: all Nigerian states as street/postcode datasets become available and are validated

## What This MVP Includes

- Canonical local dataset layer generated from your scraped LASG LGA files (Lagos pilot data).
- Clean API service with required endpoints:
  - `GET /search?query=...`
  - `GET /postcode/:code/streets`
  - `POST /reverse-geocode`
- Basic embeddable address plugin demo page.

## Developer Docs

- Start here: [Developer Docs](./docs/developers/README.md)
- API details: [API Reference](./docs/developers/api-reference.md)
- Integration steps: [Integration Guide](./docs/developers/integration-guide.md)
- In-app HTML docs:
  - `http://localhost:3000/docs`
  - `http://localhost:3000/docs/api-reference.html`
  - `http://localhost:3000/docs/integration-guide.html`

## Project Structure

- `scripts/build-dataset.js`: compiles and normalizes raw text files into canonical JSON.
- `data/raw/LASG`: raw Lagos source files used by dataset build.
- `data/canonical-addresses.lagos.json`: generated dataset used by API and plugin.
- `src/dataset.js`: dataset loading, normalization, search, postcode lookup, reverse-geocode guess.
- `src/server.js`: HTTP server + API routes + static demo hosting.
- `index.js`: legacy prototype script (kept for reference, not used by MVP server).
- `public/plugin/address-plugin.js`: embeddable plugin script.
- `public/demo/index.html`: demo page using the plugin.
- `public/demo/styles.css`: demo/plugin styling.
- `public/docs/*`: in-app HTML developer documentation pages.
- `docs/developers/*`: canonical markdown developer docs source.

## Data Model (Canonical Record)

Each address record includes:

- `street`: canonical street label
- `postcode`: exact postcode when known (`null` in current scraped dataset)
- `postcodePrefix`: 3-digit fallback prefix (MVP mapping)
- `area`: ward/area
- `lga`: local government area
- `state`: state (currently `Lagos` in this pilot)
- `geo`: approximate coordinates (`lga_centroid` in MVP)
- `searchTokens`: normalized tokens for partial-match search
- `source`: traceability back to original file + raw line

## Run It

```bash
npm run build:dataset
npm start
```

Open:

- Demo UI: `http://localhost:3000/demo/index.html`
- Health: `http://localhost:3000/health`

## Beginner Setup (From GitHub to Running)

Follow these exact steps if you are new to Node.js projects.

1. Install required tools:
- `git` (for cloning)
- Node.js `18+` (Node `20+` recommended)

2. Verify installs in your terminal:

```bash
git --version
node --version
npm --version
```

3. Clone the project:

```bash
git clone https://github.com/entuziaz/pcode.git
cd pcode
```

4. Install dependencies:

```bash
npm install
```

5. Build the local canonical dataset:

```bash
npm run build:dataset
```

6. Start the API and demo server:

```bash
npm start
```

7. Open in browser:
- `http://localhost:3000/demo/index.html`
- `http://localhost:3000/health`

## Beginner Troubleshooting

- `npm: command not found`:
  Install Node.js from [nodejs.org](https://nodejs.org/) and reopen terminal.
- `Dataset missing ... canonical-addresses.lagos.json`:
  Run `npm run build:dataset` before `npm start`.
- `EADDRINUSE` or `port already in use`:
  Start on another port:
  ```bash
  PORT=3010 npm start
  ```
  Then open `http://localhost:3010/demo/index.html`.

## API Examples

```bash
curl "http://localhost:3000/search?query=awolowo"
curl "http://localhost:3000/postcode/100/streets"
curl -X POST "http://localhost:3000/reverse-geocode" \
  -H "Content-Type: application/json" \
  -d '{"lat":6.5244,"lng":3.3792}'
```

## Deploy on Render (Free)

This project is ready for Render and includes a blueprint file: `render.yaml`.

1. Push your latest code to GitHub:
```bash
git add .
git commit -m "Prepare Render deployment"
git push origin master
```

2. In Render:
- Open [Render Dashboard](https://dashboard.render.com/)
- Click `New` -> `Blueprint`
- Connect your GitHub repo: `entuziaz/pcode`
- Render will detect `render.yaml` automatically
- Click `Apply`

3. Wait for deploy to finish, then open:
- `https://<your-render-service>.onrender.com/health`
- `https://<your-render-service>.onrender.com/demo/index.html`

Notes:
- Build step runs `npm run build:dataset`, so dataset is generated during deploy.
- Free Render services sleep when idle; first request after idle may be slow.

## Notes for Team Demo

- This MVP is intentionally transparent: it marks geolocation guesses as centroid-based.
- It already supports partial search (`Awolowo` finds names like `Chief Obafemi Awolowo Way`).
- Two of the scraped source files were empty, so some LGAs have no extracted records yet.
- Next quality upgrade is replacing centroid geo with per-street geocoded points and validated postcodes.
- Expansion path: onboard other states by adding their source files, running normalization, and generating additional canonical datasets.

## Credits

- Project inspiration:
  [An Open Source Project Nigeria Needs. Hint: Location! Location!! Location!!!](https://oonwoye.com/postcode/)
