# SeaThrough Web Starter

Bootstrap for the first porting phase of the SeaThrough iOS app to a local-only web app on Cloudflare Workers.

## What this starter includes

- React + TypeScript app shell
- Cloudflare Worker API skeleton
- Local-only favorites store
- Local-only planned dives store
- Smoke-test map tab (supported locations list, geolocation, API health)
- Initial SeaThrough domain models

## What this starter does not include yet

- Google Maps JavaScript map
- Full DiveLocations port
- Forecast engine port
- NOAA / Open-Meteo integration
- Forecast detail parity UI

## Setup

1. Scaffold a fresh Cloudflare React app:
   npm create cloudflare@latest -- seathrough-web --framework=react
2. Copy these files into that repo, replacing existing files where names overlap.
3. Run:
   npm run dev
4. Commit as:
   feat: bootstrap SeaThrough web shell
