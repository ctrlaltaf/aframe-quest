/* global AFRAME, THREE */
import { modelUrl } from '../pokeapi.js';

// Shows one Pokémon as an animated 3D model (from the community Pokémon 3D API),
// standing on this entity's origin. If no model exists, shows the 2D artwork
// instead. Also owns the Pokémon's cry as positional sound.
//
// Emits `pokemon-model-status` with { status: 'loading' | 'loaded' | 'fallback' }.
//
// Kept self-contained so you can spawn several later and make them walk around:
// see playClip() and the `clips` list.
AFRAME.registerComponent('pokemon-model', {
  schema: {
    id: { type: 'int', default: 0 },
    shiny: { type: 'boolean', default: false },
    size: { type: 'number', default: 0.7 }, // largest dimension in metres
    spin: { type: 'number', default: 15 }, // degrees per second, 0 = still
    artworkUrl: { type: 'string', default: '' },
    cryUrl: { type: 'string', default: '' },
  },

  init() {
    this.mixer = null;
    this.clips = [];
    this.currentAction = null;
    this.loadToken = 0;

    // Spinning turntable that holds the model.
    this.pivot = document.createElement('a-entity');
    this.el.appendChild(this.pivot);

    // 2D fallback, outside the pivot so it always faces forward.
    this.fallbackEl = document.createElement('a-image');
    this.fallbackEl.setAttribute('visible', false);
    this.fallbackEl.setAttribute('material', 'transparent: true; alphaTest: 0.5');
    this.el.appendChild(this.fallbackEl);

    // Invisible hit box so clicking the Pokémon plays its cry
    // (cheaper and more reliable than raycasting an animated mesh).
    this.hitBox = document.createElement('a-entity');
    this.hitBox.classList.add('interactive');
    this.hitBox.setAttribute('geometry', 'primitive: cylinder; radius: 0.35; height: 0.8');
    this.hitBox.setAttribute('material', 'visible: false');
    this.hitBox.setAttribute('position', '0 0.4 0');
    this.hitBox.addEventListener('click', () => this.playCry());
    this.el.appendChild(this.hitBox);

    this.el.setAttribute('sound', { positional: true, volume: 1, refDistance: 1, poolSize: 1 });
  },

  update(oldData) {
    const data = this.data;
    if (data.id !== oldData.id || data.shiny !== oldData.shiny) this.loadModel();
    if (data.cryUrl !== oldData.cryUrl && data.cryUrl) {
      this.el.setAttribute('sound', 'src', `url(${data.cryUrl})`);
    }
    if (data.size !== oldData.size) {
      this.hitBox.setAttribute('geometry', { radius: data.size / 2, height: data.size * 1.15 });
      this.hitBox.setAttribute('position', `0 ${(data.size * 1.15) / 2} 0`);
    }
  },

  loadModel() {
    const token = ++this.loadToken;
    this.clearModel();
    if (!this.data.id) return;

    this.el.emit('pokemon-model-status', { status: 'loading' });

    const modelEl = document.createElement('a-entity');
    modelEl.addEventListener('model-loaded', (evt) => {
      if (token !== this.loadToken) return;
      this.onModelLoaded(modelEl, evt.detail.model);
    });
    modelEl.addEventListener('model-error', () => {
      if (token !== this.loadToken) return;
      this.showFallback();
    });
    modelEl.setAttribute('gltf-model', `url(${modelUrl(this.data.id, this.data.shiny)})`);
    this.pivot.appendChild(modelEl);
    this.modelEl = modelEl;
  },

  clearModel() {
    if (this.mixer) this.mixer.stopAllAction();
    this.mixer = null;
    this.clips = [];
    this.currentAction = null;
    if (this.modelEl) this.modelEl.remove();
    this.modelEl = null;
    this.fallbackEl.setAttribute('visible', false);
  },

  onModelLoaded(modelEl, model) {
    // Scale to `size` and stand the model on the origin, centred.
    const holder = modelEl.object3D;
    holder.scale.setScalar(1);
    holder.position.set(0, 0, 0);
    holder.updateMatrixWorld(true);
    // precise = true measures the posed (skinned) vertices; the loose box is often far too big.
    const box = new THREE.Box3().setFromObject(model, true);
    box.applyMatrix4(holder.matrixWorld.clone().invert());
    const dims = box.getSize(new THREE.Vector3());
    const largest = Math.max(dims.x, dims.y, dims.z) || 1;
    const scale = this.data.size / largest;
    const center = box.getCenter(new THREE.Vector3());
    holder.scale.setScalar(scale);
    holder.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

    this.clips = model.animations || [];
    if (this.clips.length) {
      this.mixer = new THREE.AnimationMixer(model);
      this.playClip(/wait|idle|loop/i);
    }
    this.el.emit('pokemon-model-status', { status: 'loaded', clips: this.clips.map((c) => c.name) });
  },

  showFallback() {
    this.clearModel();
    const { artworkUrl, size } = this.data;
    if (artworkUrl) {
      this.fallbackEl.setAttribute('src', artworkUrl);
      this.fallbackEl.setAttribute('width', size);
      this.fallbackEl.setAttribute('height', size);
      this.fallbackEl.setAttribute('position', `0 ${size / 2} 0`);
      this.fallbackEl.setAttribute('visible', true);
    }
    this.el.emit('pokemon-model-status', { status: 'fallback' });
  },

  // Plays the first clip whose name matches `pattern` (or the first clip).
  // Returns false if the model has no animations. Useful later for walk/run.
  playClip(pattern, fade = 0.3) {
    if (!this.mixer || !this.clips.length) return false;
    const clip = this.clips.find((c) => pattern.test(c.name)) || this.clips[0];
    const action = this.mixer.clipAction(clip);
    if (action === this.currentAction) return true;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (this.currentAction) action.crossFadeFrom(this.currentAction, fade, false);
    this.currentAction = action;
    return true;
  },

  playCry() {
    const sound = this.el.components.sound;
    if (!sound || !this.data.cryUrl) return;
    sound.stopSound();
    sound.playSound();
  },

  tick(time, delta) {
    const dt = Math.min(delta, 100) / 1000;
    if (this.mixer) this.mixer.update(dt);
    if (this.data.spin) this.pivot.object3D.rotation.y += THREE.MathUtils.degToRad(this.data.spin) * dt;
  },

  remove() {
    this.clearModel();
  },
});
