# A-Frame Quest Template

A starter [A-Frame](https://aframe.io) 1.8 project for the Meta Quest 3. It supports VR, AR/passthrough (mixed reality), Touch controllers and hand tracking. It uses [Vite](https://vite.dev) for hot reload and builds.

## What's in the scene: a Pokédex

- **Search panel (left).** Type with the on-screen keyboard (laser + trigger) or your computer keyboard. Search by name (`char`) or number (`25`). Pick from the results and page through them with Prev/Next. **Random** picks any Pokémon. Backspace deletes and Escape clears.
- **The Pokémon (center).** An animated 3D model on a slowly turning pedestal, with its name, number and types. **Shiny** swaps to the shiny model. **Cry** (or clicking the Pokémon) plays its cry as positional sound. If a Pokémon has no 3D model, its official artwork is shown instead.
- **Send out / Recall all.** **Send out** puts the current Pokémon on the floor, where it wanders around you. It walks to random spots, keeps clear of the panels, idles, and sometimes cries. Up to 4 can be out at once (the oldest goes back first). **Recall all** removes them. Click a wandering Pokémon to hear its cry.
- **Scene (background).** The **Scene** button under the Pokémon cycles through Pokémon-themed backgrounds: Classic, Route 1, Viridian Forest, Mt. Moon, Lavender Town and Battle Stadium. Each one has its own sky, floor, fog, lighting and scenery. Your choice is remembered next time.
- **Stats panel (right).** Height, weight, abilities, the Pokédex description and the six base stats as bars.
- AR (passthrough) hides the background scene (and turns off its fog and coloured lighting) so the Pokédex appears in your room. Wandering Pokémon use a hit test to find your real floor, or stay at the headset's floor level (y = 0) if none is found.

Data comes live from [PokéAPI](https://pokeapi.co). 3D models come from the fan-made [Pokémon 3D API](https://github.com/Pokemon-3D-api/assets). The models are Nintendo / Game Freak / The Pokémon Company property, used here for a non-commercial class demo.

Code:
- `src/pokeapi.js` — fetches and caches Pokémon data and builds model URLs.
- `src/components/pokedex-search.js`, `pokedex-keyboard.js` — the search panel.
- `src/components/pokemon-model.js` — model loading, size normalizing, animation (`playClip`, `hasClip`) and cry (`playCry`). Frees the model's GPU memory when it's removed or replaced.
- `src/components/pokemon-wander.js` — makes a `pokemon-model` walk around: pick a point in the area, turn, walk (walk/run clip if the model has one), idle, maybe cry, repeat. The area (radius, the box kept clear for the panels, personal space), speeds and a `headingOffset` are all in its schema.
- `src/components/pokemon-wanderers.js` — the `#wanderers` container: spawns and recalls wandering Pokémon, caps how many are out, and finds the real floor height in AR.
- `src/components/pokedex-detail.js` — name/types header, stats panel, and the Shiny/Cry/Send out/Recall all buttons.
- `src/components/pokedex-environment.js` — the background scenes. Each scene is a small data entry (sky colours, floor, fog, lights) plus a `build()` that adds scenery made from simple shapes. Add your own by copying one. Scenery is drawn with `InstancedMesh`, so a forest of 150 trees costs only a few draw calls.
- `src/dispose.js` — frees a three.js object's GPU memory (used when models and scenes are replaced).
- `src/components/ui-button.js` — the clickable button used everywhere.
- The template's original example components (`spin`, `hover-highlight`, `click-recolor`, `xr-mode-label`) are still in `src/components/`.

## Setup

You need Node 20 or newer. If you use nvm, run `nvm use` (the version is in `.nvmrc`).

```bash
npm install
npm run dev
```

Vite prints a `Local` and a `Network` URL, both `https://`. The dev server uses a self-signed certificate, so your browser will show a warning the first time. Click **Advanced → Proceed**.

On desktop you can click things with the mouse and drag to look around (WASD movement is off because the keyboard types searches). To test XR without a headset, install Meta's [Immersive Web Emulator](https://chromewebstore.google.com/detail/immersive-web-emulator/cgffilbpcibhmcfbgggfhfolhkfbhmik) Chrome extension.

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
