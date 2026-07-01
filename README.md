# Saturn Particle System

Interactive React and Three.js Saturn particle scene with MediaPipe hand tracking.

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

## Deploy

Push to `main`. GitHub Actions builds the Vite app and deploys `dist` to GitHub Pages.
