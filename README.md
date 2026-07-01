# Saturn Particle System

Interactive React and Three.js Saturn particle scene with MediaPipe hand tracking.

The MediaPipe wasm files and hand tracking model are served from this app under
`public/mediapipe`, so the deployed app does not need to fetch the hand model from
Google Storage or the wasm runtime from a CDN.

## Local Development

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:3000/`.

For same-Wi-Fi visual testing from a phone:

```powershell
npm run dev:lan
```

Open the computer's LAN IP on port `3000`. Full camera gesture tracking on mobile works best from the deployed HTTPS site because mobile browsers restrict camera access on insecure network origins.

For phone testing on a local network, use an HTTPS origin. A plain `http://<LAN-IP>:3000`
page may render the Saturn scene but most mobile browsers will block or degrade camera
APIs outside HTTPS.

## Deploy

Push to `main`. GitHub Actions builds the Vite app and deploys `dist` to GitHub Pages.
