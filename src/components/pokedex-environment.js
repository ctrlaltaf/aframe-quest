/* global AFRAME, THREE */
import { disposeObject } from '../dispose.js';

const SKY_RADIUS = 60;
const FLOOR_RADIUS = 40;
const PROPS_MIN_R = 4.5; // keep scenery clear of the panels and the wandering area
const NO_FOG = [1000, 2000];
const STORAGE_KEY = 'pokedex-scene';

// Small seeded random number generator, so every scene looks the same each time.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random spots on a ring around the player: [{ x, z, scale, angle }].
function scatter(rand, count, minR, maxR, minScale = 1, maxScale = 1) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(minR * minR + rand() * (maxR * maxR - minR * minR));
    const a = rand() * Math.PI * 2;
    spots.push({
      x: Math.sin(a) * r,
      z: Math.cos(a) * r,
      scale: minScale + rand() * (maxScale - minScale),
      angle: rand() * Math.PI * 2,
    });
  }
  return spots;
}

// One InstancedMesh (a single draw call) with a copy of `geometry` at each spot.
// `place(spot, dummy, i)` can adjust the dummy's position/rotation/scale.
function instanced(geometry, material, spots, place = null, colors = null) {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  spots.forEach((spot, i) => {
    dummy.position.set(spot.x, spot.y ?? 0, spot.z);
    dummy.rotation.set(0, spot.angle ?? 0, 0);
    dummy.scale.setScalar(spot.scale ?? 1);
    if (place) place(spot, dummy, i);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (colors) mesh.setColorAt(i, color.set(colors[i % colors.length]));
  });
  mesh.computeBoundingSphere();
  return mesh;
}

// Geometry whose base sits at y = 0, so scaling makes it taller rather than sink.
function standing(geometry, height, lift = 0) {
  return geometry.translate(0, height / 2 + lift, 0);
}

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

// --- Scenery pieces ---------------------------------------------------------

function roundTrees(group, spots, leaves = '#3f8f3a') {
  group.add(instanced(standing(new THREE.CylinderGeometry(0.12, 0.17, 1.2, 6), 1.2), lambert('#6b4a2b'), spots));
  group.add(instanced(new THREE.IcosahedronGeometry(0.9, 0).translate(0, 1.8, 0), lambert(leaves, { flatShading: true }), spots));
}

function pineTrees(group, spots) {
  group.add(instanced(standing(new THREE.CylinderGeometry(0.1, 0.15, 1, 6), 1), lambert('#4a3320'), spots));
  const cones = new THREE.ConeGeometry(0.95, 1.8, 7).translate(0, 1.6, 0);
  const tops = new THREE.ConeGeometry(0.65, 1.4, 7).translate(0, 2.6, 0);
  const material = lambert('#1f5a32', { flatShading: true });
  group.add(instanced(cones, material, spots));
  group.add(instanced(tops, material, spots));
}

// Clumps of tall grass (where wild Pokémon hide).
function tallGrass(group, rand, patches, minR, maxR, color = '#2f7d32') {
  const blades = [];
  for (const patch of scatter(rand, patches, minR, maxR)) {
    for (let i = 0; i < 9; i++) {
      blades.push({
        x: patch.x + (rand() - 0.5) * 1.2,
        z: patch.z + (rand() - 0.5) * 1.2,
        scale: 0.7 + rand() * 0.6,
        angle: rand() * Math.PI,
      });
    }
  }
  group.add(instanced(standing(new THREE.ConeGeometry(0.09, 0.55, 4), 0.55), lambert(color, { flatShading: true }), blades));
}

function flowers(group, rand, count, minR, maxR) {
  const spots = scatter(rand, count, minR, maxR, 0.8, 1.3);
  const colors = ['#ff5a5a', '#ffd84d', '#ffffff', '#ff8fd0'];
  group.add(instanced(new THREE.SphereGeometry(0.07, 6, 4).translate(0, 0.12, 0), lambert('#ffffff'), spots, null, colors));
}

function clouds(group, rand, count) {
  const puffs = [];
  for (const c of scatter(rand, count, 18, 34)) {
    const y = 14 + rand() * 6;
    for (let i = 0; i < 5; i++) {
      puffs.push({ x: c.x + (rand() - 0.5) * 5, y: y + rand() * 1.2, z: c.z + (rand() - 0.5) * 3, scale: 1.4 + rand() * 1.4 });
    }
  }
  const material = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  group.add(instanced(new THREE.SphereGeometry(1, 8, 6), material, puffs, (s, d) => d.scale.y *= 0.55));
}

function rocks(group, spots, color = '#6d6660') {
  group.add(instanced(new THREE.DodecahedronGeometry(0.5, 0), lambert(color, { flatShading: true }), spots, (s, d) => {
    d.scale.y *= 0.65;
    d.position.y = 0.15 * s.scale;
  }));
}

// --- Scenes -----------------------------------------------------------------
// Each scene: name (VR font has no accents), sky [top, horizon], floor colour,
// fog [near, far] (fades to the horizon colour), light settings and build().

const SCENES = [
  {
    name: 'CLASSIC',
    sky: ['#1d2433', '#1d2433'],
    floor: '#3a4256',
    fog: NO_FOG,
    ambient: ['#ffffff', 0.6],
    sun: ['#ffffff', 1.2],
    build() {},
  },
  {
    name: 'ROUTE 1',
    sky: ['#3f9bff', '#d6efff'],
    floor: '#78c25a',
    fog: [18, 50],
    ambient: ['#ffffff', 0.7],
    sun: ['#fff4dc', 1.3],
    build(group, rand) {
      roundTrees(group, scatter(rand, 40, 9, 26, 0.9, 1.6));
      tallGrass(group, rand, 14, PROPS_MIN_R, 10);
      flowers(group, rand, 90, PROPS_MIN_R, 14);
      clouds(group, rand, 9);
    },
  },
  {
    name: 'VIRIDIAN FOREST',
    sky: ['#0f2a1a', '#3f6b48'],
    floor: '#2f5a2a',
    fog: [6, 24],
    ambient: ['#cfe8c8', 0.45],
    sun: ['#e9ffd6', 0.9],
    build(group, rand) {
      pineTrees(group, scatter(rand, 150, 5.5, 26, 1.1, 2.2));
      roundTrees(group, scatter(rand, 25, 6, 20, 1, 1.7), '#2d6b2a');
      tallGrass(group, rand, 22, PROPS_MIN_R, 12, '#2a6a2b');
    },
  },
  {
    name: 'MT. MOON',
    sky: ['#09070b', '#241d24'],
    floor: '#5a4e45',
    fog: [5, 22],
    ambient: ['#c8c0d8', 0.65],
    sun: ['#b8c8ff', 0.7],
    build(group, rand) {
      rocks(group, scatter(rand, 45, PROPS_MIN_R, 18, 0.6, 2.2));
      group.add(instanced(
        standing(new THREE.ConeGeometry(0.4, 1, 6), 1),
        lambert('#5c5048', { flatShading: true }),
        scatter(rand, 60, 5, 20),
        (s, d) => d.scale.set(1, 1 + rand() * 3, 1),
      ));
      // Glowing Moon Stones
      group.add(instanced(
        standing(new THREE.OctahedronGeometry(0.22, 0), 0.44),
        lambert('#9fe4ff', { emissive: '#4fb8ff', emissiveIntensity: 0.9, flatShading: true }),
        scatter(rand, 16, PROPS_MIN_R, 12, 0.8, 1.6),
        (s, d) => d.scale.y *= 1.7,
      ));
    },
  },
  {
    name: 'LAVENDER TOWN',
    sky: ['#120a24', '#4b2a6b'],
    floor: '#3a3346',
    fog: [8, 42],
    ambient: ['#d8c8ff', 0.5],
    sun: ['#c9b6ff', 0.6],
    build(group, rand) {
      // Gravestones in loose rows
      const graves = [];
      for (let row = 0; row < 4; row++) {
        const r = 5 + row * 1.6;
        for (let i = 0; i < 14 + row * 4; i++) {
          const a = (i / (14 + row * 4)) * Math.PI * 2 + rand() * 0.15;
          graves.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, angle: a + Math.PI + (rand() - 0.5) * 0.3, scale: 0.8 + rand() * 0.4 });
        }
      }
      group.add(instanced(standing(new THREE.BoxGeometry(0.5, 0.75, 0.12), 0.75), lambert('#8d88a0'), graves, (s, d) => {
        d.rotation.z = (rand() - 0.5) * 0.15;
      }));
      // A tall tower on the horizon
      const tower = new THREE.Group();
      const stone = lambert('#5d4a7a', { flatShading: true });
      [[6, 7, 0], [4.8, 6, 7], [3.6, 5, 13]].forEach(([w, h, y]) => {
        tower.add(new THREE.Mesh(standing(new THREE.BoxGeometry(w, h, w), h, y), stone));
      });
      tower.add(new THREE.Mesh(standing(new THREE.ConeGeometry(3, 4, 4), 4, 18).rotateY(Math.PI / 4), lambert('#3b2c55', { flatShading: true })));
      tower.position.set(9, 0, -26);
      group.add(tower);
      // Floating ghost lights; they drift round slowly (see tick)
      const wisps = instanced(
        new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshBasicMaterial({ color: '#c49bff', fog: false }),
        scatter(rand, 16, PROPS_MIN_R, 10).map((s) => ({ ...s, y: 1 + rand() * 1.8 })),
      );
      group.add(wisps);
      return { drift: wisps };
    },
  },
  {
    name: 'BATTLE STADIUM',
    sky: ['#2f86e8', '#cfe9ff'],
    floor: '#3f8a3a',
    fog: [25, 60],
    ambient: ['#ffffff', 0.75],
    sun: ['#ffffff', 1.3],
    build(group, rand) {
      // Battle field with a Poké Ball in the middle, centred on the player
      const field = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 16).rotateX(-Math.PI / 2).translate(0, 0.005, 0),
        new THREE.MeshLambertMaterial({ map: fieldTexture() }),
      );
      group.add(field);
      // Tiered stands all the way round, with a crowd
      const tiers = ['#c0392b', '#ecf0f1', '#2c3e50', '#c0392b'];
      tiers.forEach((color, i) => {
        const r = 13 + i * 1.6;
        const h = 1.2 + i * 1.3;
        const ring = new THREE.Mesh(standing(new THREE.CylinderGeometry(r, r, h, 48, 1, true), h), lambert(color, { side: THREE.BackSide }));
        group.add(ring);
      });
      const crowd = [];
      for (let i = 0; i < 420; i++) {
        const tier = i % 3;
        const a = rand() * Math.PI * 2;
        const r = 13.4 + tier * 1.6 + 0.4;
        crowd.push({ x: Math.sin(a) * r, y: 1.2 + tier * 1.3, z: Math.cos(a) * r, angle: a });
      }
      const fans = ['#ffcb05', '#3d7dca', '#ff5a5a', '#ffffff', '#7ac74c', '#f95587'];
      group.add(instanced(standing(new THREE.BoxGeometry(0.3, 0.45, 0.25), 0.45), lambert('#ffffff'), crowd, null, fans));
      // Floodlights
      const corners = [[-15, -15], [15, -15], [-15, 15], [15, 15]].map(([x, z]) => ({ x, z }));
      group.add(instanced(standing(new THREE.CylinderGeometry(0.15, 0.2, 11, 6), 11), lambert('#9aa3b5'), corners));
      group.add(instanced(
        new THREE.BoxGeometry(1.6, 0.9, 0.3).translate(0, 11.3, 0),
        new THREE.MeshBasicMaterial({ color: '#fffbe6', fog: false }),
        corners,
        (s, d) => d.lookAt(0, 0, 0),
      ));
    },
  },
];

// Battle field markings drawn on a canvas (10 m x 16 m, 64 px per metre).
function fieldTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#5aa84a' : '#4f9a40';
    ctx.fillRect(0, i * 128, 640, 128);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, 600, 984);
  ctx.beginPath();
  ctx.moveTo(20, 512);
  ctx.lineTo(620, 512);
  ctx.stroke();
  // Poké Ball
  const cx = 320;
  const cy = 512;
  const r = 110;
  ctx.fillStyle = '#e3350d';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#222222';
  ctx.fillRect(cx - r, cy - 9, r * 2, 18);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#222222';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Vertical sky gradient from the horizon colour up to the top colour.
function skyTexture(top, horizon) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.5, horizon);
  gradient.addColorStop(1, horizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Pokémon-themed backgrounds: sky, floor, fog, lighting and scenery. Adds a
// SCENE button to `controls` that cycles through them, and remembers the choice.
// Put `hide-on-enter-ar` on the same entity so AR shows your real room; fog and
// lighting go back to neutral in AR too.
//
// Usage: <a-entity pokedex-environment hide-on-enter-ar>
AFRAME.registerComponent('pokedex-environment', {
  schema: {
    controls: { type: 'selector', default: '#pokemon-controls' },
    ambient: { type: 'selector', default: '#ambient-light' },
    sun: { type: 'selector', default: '#sun-light' },
  },

  init() {
    this.index = 0;
    this.group = null;
    this.drift = null;

    // Fog stays on all the time (just pushed far away when not wanted), so
    // switching scenes doesn't make three.js recompile every shader.
    this.fog = new THREE.Fog('#000000', NO_FOG[0], NO_FOG[1]);
    this.el.sceneEl.object3D.fog = this.fog;

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_RADIUS, 32, 16),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false }),
    );
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(FLOOR_RADIUS, 48).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial(),
    );
    this.el.object3D.add(this.sky, this.floor);

    this.button = document.createElement('a-entity');
    this.button.setAttribute('position', '0 -0.18 0');
    this.button.setAttribute('ui-button', { value: 'scene', width: 0.53, height: 0.07, wrapCount: 26, color: '#2d6a4f' });
    this.onPress = (evt) => {
      if (evt.detail.value === 'scene') this.setScene(this.index + 1);
    };
    this.button.addEventListener('ui-press', this.onPress);
    this.data.controls.appendChild(this.button);

    this.onEnterVR = () => {
      if (this.el.sceneEl.is('ar-mode')) this.applyAtmosphere(SCENES[0], true);
    };
    this.onExitVR = () => this.applyAtmosphere(SCENES[this.index]);
    this.el.sceneEl.addEventListener('enter-vr', this.onEnterVR);
    this.el.sceneEl.addEventListener('exit-vr', this.onExitVR);

    let saved = 0;
    try {
      saved = SCENES.findIndex((s) => s.name === localStorage.getItem(STORAGE_KEY));
    } catch {
      // storage blocked: start with the first scene
    }
    this.setScene(Math.max(0, saved));
  },

  setScene(index) {
    this.index = ((index % SCENES.length) + SCENES.length) % SCENES.length;
    const scene = SCENES[this.index];

    // Replace the scenery and free the old one's GPU memory.
    if (this.group) {
      this.el.object3D.remove(this.group);
      disposeObject(this.group);
    }
    this.group = new THREE.Group();
    const extras = scene.build(this.group, seededRandom(this.index + 1)) || {};
    this.drift = extras.drift || null;
    this.el.object3D.add(this.group);

    if (this.sky.material.map) this.sky.material.map.dispose();
    this.sky.material.map = skyTexture(scene.sky[0], scene.sky[1]);
    this.sky.material.needsUpdate = true;
    this.floor.material.color.set(scene.floor);

    this.applyAtmosphere(scene, this.el.sceneEl.is('ar-mode'));
    this.button.setAttribute('ui-button', 'label', `SCENE: ${scene.name}  >`);
    try {
      localStorage.setItem(STORAGE_KEY, scene.name);
    } catch {
      // not saved; fine
    }
    this.el.emit('pokedex-scene-changed', { name: scene.name });
  },

  // Fog and lights. In AR we use neutral settings so Pokémon look natural in the room.
  applyAtmosphere(scene, ar = false) {
    const [near, far] = ar ? NO_FOG : scene.fog;
    this.fog.color.set(scene.sky[1]);
    this.fog.near = near;
    this.fog.far = far;
    const neutral = SCENES[0];
    const { ambient, sun } = ar ? neutral : scene;
    this.data.ambient?.setAttribute('light', { color: ambient[0], intensity: ambient[1] });
    this.data.sun?.setAttribute('light', { color: sun[0], intensity: sun[1] });
  },

  tick(time, delta) {
    if (!this.drift) return;
    this.drift.rotation.y += 0.05 * (Math.min(delta, 100) / 1000);
    this.drift.position.y = Math.sin(time / 1500) * 0.15;
  },

  remove() {
    this.el.sceneEl.removeEventListener('enter-vr', this.onEnterVR);
    this.el.sceneEl.removeEventListener('exit-vr', this.onExitVR);
    this.button.removeEventListener('ui-press', this.onPress);
    this.button.remove();
    if (this.el.sceneEl.object3D.fog === this.fog) this.el.sceneEl.object3D.fog = null;
    disposeObject(this.el.object3D);
  },
});
