# LegoSearch

LegoSearch is a local web tool for checking LEGO prices across Taiwan marketplaces:

- Shopee
- MOMO
- PChome
- Coupang Taiwan

The app uses marketplace connectors where a reliable machine-readable source is available and keeps a direct marketplace search link when a site blocks automated parsing.

## Requirements

- Node.js 22 or newer

## Run

```powershell
npm start
```

Open:

```text
http://localhost:5178
```

## Windows Shortcuts

Double-click these files from the project root:

```text
start-legosearch.bat   Start LegoSearch and open the browser
stop-legosearch.bat    Stop LegoSearch
status-legosearch.bat  Show whether LegoSearch is running
```

The same controls are available from the terminal:

```powershell
node tools/legoctl.mjs open
node tools/legoctl.mjs stop
node tools/legoctl.mjs status
node tools/legoctl.mjs restart
```

## Scripts

```powershell
npm test
npm run check
```

## Version And Release

This project follows Semantic Versioning. Choose the appropriate increment, then build the portable Windows release:

```powershell
npm run version:patch
npm run version:minor
npm run version:major
npm run release:win
```

The release flow creates `dist/LegoSearch_vX.Y.Z/` and `dist/LegoSearch_vX.Y.Z.zip`, plus `dist/lego-search-source.zip`. Previous releases move to `dist/archive/`.

## Project Shape

```text
src/domain/                 Search query, marketplace catalog, aggregation behavior
src/infrastructure/         Marketplace connector implementations
src/http/                   HTTP app and server entry point
public/                     Browser UI
tools/legoctl.mjs           Local start / stop controller
tests/                      Node test suite
docs/agents/                Matt Pocock skill configuration
```

## Notes

PChome currently has the strongest connector because its search endpoint returns structured product data. Shopee, MOMO, and Coupang can block or change automated access, so LegoSearch keeps their search links in the result set until a stable API or explicit integration is added.
