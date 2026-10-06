# A-Frame Quest Template

A starter [A-Frame](https://aframe.io) 1.8 project for the Meta Quest 3. It supports VR, AR/passthrough (mixed reality), Touch controllers and hand tracking. It uses [Vite](https://vite.dev) for hot reload and builds.

## What's in the scene

- **VR and AR buttons.** AR uses the Quest 3 passthrough cameras, and the sky and floor hide automatically so you see your room.
- **Touch controllers.** Each controller has a laser pointer, and the trigger clicks.
- **Hand tracking.** Put the controllers down and pinch to grab the yellow cube.
- **Example components** in `src/components/`:
  - `spin`: rotates an object.
  - `hover-highlight`: scales an object up while you point at it.
  - `click-recolor`: gives an object a random color when you click it.
  - `xr-mode-label`: shows whether you're on desktop, in VR or in AR.

## Setup

You need Node 20 or newer. If you use nvm, run `nvm use` (the version is in `.nvmrc`).

```bash
npm install
npm run dev
```

Vite prints a `Local` and a `Network` URL, both `https://`. The dev server uses a self-signed certificate, so your browser will show a warning the first time. Click **Advanced → Proceed**.

On desktop you can click things with the mouse and move with WASD. To test XR without a headset, install Meta's [Immersive Web Emulator](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik) Chrome extension.

## Testing on the Quest 3 during development

WebXR only works over HTTPS. That's why the dev server uses HTTPS.

**Option A: same Wi-Fi (easiest)**
1. Put your computer and the Quest on the same network. Some school or guest networks block device-to-device traffic, so if this doesn't connect, use option B.
2. Run `npm run dev` and note the `Network` URL, for example `https://192.168.1.20:5173`.
3. In the Quest Browser, open that URL and accept the certificate warning.
4. Tap **VR** or **AR**.

**Option B: USB cable**
1. Turn on developer mode on the Quest and install `adb`, for example with `brew install android-platform-tools`.
2. Run `adb reverse tcp:5173 tcp:5173`.
3. In the Quest Browser, open `https://localhost:5173`.

To see `console.log` output and errors from the headset, connect over USB and open `chrome://inspect` in desktop Chrome.

## Deploying to GitHub Pages (a permanent URL for the Quest)

A workflow in `.github/workflows/deploy.yml` builds and publishes the site every time you push to `main`.

1. Create a repo on GitHub and push this project to its `main` branch.
2. On GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Wait for the **Actions** tab to show a green run.
4. On the Quest, open `https://<your-username>.github.io/<repo-name>/`. Bookmark it so you don't have to type it again.

GitHub Pages is HTTPS, so you won't get a certificate warning. Because of `base: './'` in `vite.config.js`, the site works under any repo name.

## Adding your own content

- **3D models, textures and audio** go in `public/assets/`. Reference them with relative paths, like `src="assets/thing.glb"`, with no leading slash. A leading slash breaks the paths on GitHub Pages.
- **New components** go in a new file in `src/components/`. Import that file in `src/main.js`.
- **Clickable objects** need `class="interactive"` so the controller lasers and the mouse can hit them. Listen for the `click`, `mouseenter` and `mouseleave` events.
- **Hand-grabbable objects** need the `grabbable` attribute.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the HTTPS dev server on your LAN, with hot reload. |
| `npm run build` | Builds the production site into `dist/`. |
| `npm run preview` | Serves the built `dist/` folder over HTTPS to test it. |
