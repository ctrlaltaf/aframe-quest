/* global AFRAME, THREE, XRRay */
import { pickPoint } from './pokemon-wander.js';

const FLOOR_SAMPLES = 30; // good hit-test readings before we stop looking
const FLOOR_SEARCH_TIME = 15000; // ms; give up (keep y = 0) after this
const MIN_BELOW_HEAD = 0.8; // metres; ignore hits on tables etc. close to the head

// Holds the Pokémon that walk around the room. Put it at the origin; its
// children walk in its x/z plane and its y is the floor height.
//
// Listens on the scene for:
//   `pokemon-send-out` { pokemon, shiny }: spawns `pokemon` (from getPokemon())
//   `pokemon-recall`: removes them all
// Emits `pokemon-wanderers-changed` { count } on the scene.
//
// In AR it casts a hit test straight down from the headset to find the real
// floor, then stops. If nothing is found the floor stays at y = 0 (on the Quest
// `local-floor` already puts y = 0 roughly on the floor).
AFRAME.registerComponent('pokemon-wanderers', {
  schema: {
    max: { type: 'int', default: 4 }, // oldest is recalled beyond this (models are heavy)
    radius: { type: 'number', default: 3 },
    excludeMin: { type: 'vec2', default: { x: -1.9, y: -2.3 } },
    excludeMax: { type: 'vec2', default: { x: 1.9, y: -0.6 } },
    personalSpace: { type: 'number', default: 0.6 },
  },

  init() {
    this.wanderers = [];
    this.floorY = 0;
    this.hitSource = null;
    this.floorSamples = 0;
    this.searchUntil = 0;
    this.headPos = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();

    const scene = this.el.sceneEl;
    this.onSendOut = (evt) => this.sendOut(evt.detail.pokemon, evt.detail.shiny);
    this.onRecall = () => this.recallAll();
    this.onEnterVR = () => this.startFloorSearch();
    this.onExitVR = () => {
      this.stopFloorSearch();
      this.setFloorHeight(0);
    };
    scene.addEventListener('pokemon-send-out', this.onSendOut);
    scene.addEventListener('pokemon-recall', this.onRecall);
    scene.addEventListener('enter-vr', this.onEnterVR);
    scene.addEventListener('exit-vr', this.onExitVR);
  },

  area() {
    const { radius, excludeMin, excludeMax, personalSpace } = this.data;
    return { radius, center: { x: 0, y: 0 }, excludeMin, excludeMax, personalSpace };
  },

  sendOut(pokemon, shiny) {
    if (!pokemon) return;
    // Real height, kept between "visible" and "not filling the room".
    const size = THREE.MathUtils.clamp(pokemon.height || 0.5, 0.35, 1.0);
    const area = this.area();
    const start = { x: 1.2, z: 0 };
    pickPoint(area, size / 2, start, null, 1, 2.5);

    const el = document.createElement('a-entity');
    el.setAttribute('position', `${start.x} 0 ${start.z}`);
    el.setAttribute('rotation', `0 ${Math.random() * 360} 0`);
    el.setAttribute('pokemon-model', {
      id: pokemon.id,
      shiny,
      size,
      spin: 0,
      artworkUrl: pokemon.artworkUrl,
      cryUrl: pokemon.cryUrl || '',
    });
    el.setAttribute('pokemon-wander', area);
    this.el.appendChild(el);
    this.wanderers.push(el);

    while (this.wanderers.length > this.data.max) this.removeWanderer(this.wanderers.shift());
    this.emitCount();
  },

  recallAll() {
    for (const el of this.wanderers) this.removeWanderer(el);
    this.wanderers = [];
    this.emitCount();
  },

  removeWanderer(el) {
    // Stop a cry that's still playing; removing the entity then disposes the
    // model, its animation mixer and the audio nodes (see pokemon-model.remove).
    el.components.sound?.stopSound();
    el.remove();
  },

  emitCount() {
    this.el.sceneEl.emit('pokemon-wanderers-changed', { count: this.wanderers.length });
  },

  setFloorHeight(y) {
    this.floorY = y;
    this.el.object3D.position.y = y;
  },

  startFloorSearch() {
    const scene = this.el.sceneEl;
    if (!scene.is('ar-mode')) return;
    const session = scene.renderer.xr.getSession();
    if (!session || !session.requestHitTestSource) return;
    this.floorSamples = 0;
    session
      .requestReferenceSpace('viewer')
      .then((space) =>
        session.requestHitTestSource({
          space,
          // Straight down from the headset.
          offsetRay: new XRRay({ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: -1, z: 0, w: 0 }),
        }),
      )
      .then((source) => {
        if (scene.renderer.xr.getSession() !== session) {
          source.cancel(); // left AR while we were waiting
          return;
        }
        this.hitSource = source;
        this.searchUntil = performance.now() + FLOOR_SEARCH_TIME;
      })
      .catch((err) => console.warn('Floor hit test unavailable, using y = 0', err));
  },

  stopFloorSearch() {
    if (this.hitSource) this.hitSource.cancel();
    this.hitSource = null;
  },

  tick() {
    if (!this.hitSource) return;
    const scene = this.el.sceneEl;
    const frame = scene.frame;
    if (!frame) return;
    if (performance.now() > this.searchUntil) {
      this.stopFloorSearch();
      return;
    }

    // getHitTestResults allocates, but this only runs for the first few seconds of AR.
    const results = frame.getHitTestResults(this.hitSource);
    if (!results.length) return;
    const pose = results[0].getPose(scene.renderer.xr.getReferenceSpace());
    if (!pose) return;
    const { position, orientation } = pose.transform;

    // Only accept horizontal surfaces well below the head (not tables or laps).
    this.orientation.set(orientation.x, orientation.y, orientation.z, orientation.w);
    this.up.set(0, 1, 0).applyQuaternion(this.orientation);
    this.headPos.setFromMatrixPosition(scene.camera.matrixWorld);
    if (this.up.y < 0.9 || this.headPos.y - position.y < MIN_BELOW_HEAD) return;

    // Smooth out noise: first reading sets it, later ones nudge it.
    const y = this.floorSamples === 0 ? position.y : this.floorY + (position.y - this.floorY) * 0.2;
    this.setFloorHeight(y);
    if (++this.floorSamples >= FLOOR_SAMPLES) this.stopFloorSearch();
  },

  remove() {
    const scene = this.el.sceneEl;
    scene.removeEventListener('pokemon-send-out', this.onSendOut);
    scene.removeEventListener('pokemon-recall', this.onRecall);
    scene.removeEventListener('enter-vr', this.onEnterVR);
    scene.removeEventListener('exit-vr', this.onExitVR);
    this.stopFloorSearch();
    this.recallAll();
  },
});
