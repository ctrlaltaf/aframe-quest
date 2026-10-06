/* global AFRAME, THREE */
import { getPokemon, padId } from '../pokeapi.js';

const TYPE_COLORS = {
  normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c',
  grass: '#7ac74c', ice: '#96d9d6', fighting: '#c22e28', poison: '#a33ea1',
  ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
  rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746',
  steel: '#b7b7ce', fairy: '#d685ad',
};

const STAT_LABELS = {
  hp: 'HP', attack: 'Attack', defense: 'Defense',
  'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', speed: 'Speed',
};

const BAR_LEFT = -0.1;
const BAR_WIDTH = 0.6;

function statColor(value) {
  if (value < 50) return '#f34444';
  if (value < 80) return '#ff7f0f';
  if (value < 100) return '#ffdd57';
  if (value < 120) return '#a0e515';
  return '#23cd5e';
}

function text(el, value, opts = {}) {
  el.setAttribute('text', {
    value, align: 'left', anchor: 'center', baseline: 'center', color: '#ffffff', width: 1, wrapCount: 40, ...opts,
  });
  return el;
}

function child(parent, position) {
  const el = document.createElement('a-entity');
  el.setAttribute('position', position);
  parent.appendChild(el);
  return el;
}

// Stats panel for the selected Pokémon. Also fills in the name/type header and
// drives the `pokemon-model` entity. Listens for `pokedex-select` with { id }.
AFRAME.registerComponent('pokedex-detail', {
  schema: {
    model: { type: 'selector', default: '#pokemon' },
    header: { type: 'selector', default: '#pokemon-header' },
    controls: { type: 'selector', default: '#pokemon-controls' },
    startId: { type: 'int', default: 25 },
    width: { type: 'number', default: 1.1 },
    height: { type: 'number', default: 1.36 },
  },

  init() {
    this.requestId = 0;
    this.current = null;
    this.shiny = false;

    this.buildPanel();
    this.buildHeader();
    this.buildControls();

    this.onSelect = (evt) => this.show(evt.detail.id);
    this.el.sceneEl.addEventListener('pokedex-select', this.onSelect);

    this.onModelStatus = (evt) => {
      const messages = { loading: 'Loading 3D model...', loaded: '', fallback: 'No 3D model - showing artwork' };
      this.statusEl.setAttribute('text', 'value', messages[evt.detail.status] ?? '');
    };
    this.data.model.addEventListener('pokemon-model-status', this.onModelStatus);

    this.onControl = (evt) => {
      if (evt.detail.value === 'shiny') this.toggleShiny();
      else if (evt.detail.value === 'cry') this.modelComponent()?.playCry();
    };
    this.data.controls.addEventListener('ui-press', this.onControl);

    // Browsers keep audio muted until the user interacts with the page.
    this.unlockAudio = () => {
      const ctx = THREE.AudioContext.getContext();
      if (ctx.state === 'suspended') ctx.resume();
    };
    window.addEventListener('pointerdown', this.unlockAudio);
    window.addEventListener('keydown', this.unlockAudio);
    this.el.sceneEl.addEventListener('enter-vr', this.unlockAudio);

    this.show(this.data.startId);
  },

  buildPanel() {
    const { width, height } = this.data;
    const top = height / 2;
    const left = -width / 2 + 0.05;

    const bg = document.createElement('a-plane');
    bg.setAttribute('width', width);
    bg.setAttribute('height', height);
    bg.setAttribute('material', 'color: #141a2a; shader: flat; opacity: 0.92; transparent: true');
    bg.setAttribute('position', '0 0 -0.01');
    this.el.appendChild(bg);

    text(child(this.el, `0 ${top - 0.07} 0`), 'STATS', { align: 'center', color: '#ffcb05', wrapCount: 28 });
    this.infoEl = text(child(this.el, `${left} ${top - 0.2} 0`), '', {
      width: width - 0.1, anchor: 'left', wrapCount: 38, baseline: 'center',
    });
    this.flavorEl = text(child(this.el, `${left} ${top - 0.36} 0`), '', {
      width: width - 0.1, anchor: 'left', baseline: 'top', wrapCount: 46, color: '#c9d3ee',
    });

    this.statRows = Object.keys(STAT_LABELS).map((key, i) => {
      const y = -0.1 - i * 0.075;
      const label = text(child(this.el, `${left} ${y} 0`), STAT_LABELS[key], { anchor: 'left', width: 0.9, wrapCount: 36 });
      const value = text(child(this.el, `${BAR_LEFT - 0.03} ${y} 0`), '', { align: 'right', anchor: 'right', width: 0.9, wrapCount: 36 });
      const track = document.createElement('a-plane');
      track.setAttribute('width', BAR_WIDTH);
      track.setAttribute('height', 0.035);
      track.setAttribute('material', 'color: #2a3350; shader: flat');
      track.setAttribute('position', `${BAR_LEFT + BAR_WIDTH / 2} ${y} -0.002`);
      this.el.appendChild(track);
      const bar = document.createElement('a-plane');
      bar.setAttribute('height', 0.035);
      bar.setAttribute('material', 'shader: flat');
      this.el.appendChild(bar);
      return { key, label, value, bar, y };
    });
    this.totalEl = text(child(this.el, `${left} ${-0.1 - 6 * 0.075 - 0.02} 0`), '', { width: 0.9, anchor: 'left', wrapCount: 36, color: '#ffcb05' });
  },

  buildHeader() {
    const header = this.data.header;
    this.nameEl = text(child(header, '0 0.12 0'), '', { align: 'center', wrapCount: 18, width: 1.2 });
    this.typesEl = child(header, '0 0.02 0');
    this.statusEl = text(child(header, '0 -0.07 0'), '', { align: 'center', wrapCount: 40, width: 1, color: '#9aa7c7' });
  },

  buildControls() {
    const controls = this.data.controls;
    this.shinyBtn = child(controls, '-0.14 0 0');
    this.shinyBtn.setAttribute('ui-button', { label: 'SHINY: OFF', value: 'shiny', width: 0.25, height: 0.07, wrapCount: 12, color: '#3a4670' });
    const cryBtn = child(controls, '0.14 0 0');
    cryBtn.setAttribute('ui-button', { label: 'CRY', value: 'cry', width: 0.25, height: 0.07, wrapCount: 12, color: '#3a4670' });
  },

  modelComponent() {
    return this.data.model.components['pokemon-model'];
  },

  async show(id) {
    const request = ++this.requestId;
    this.nameEl.setAttribute('text', 'value', `Loading ${padId(id)}...`);
    let poke;
    try {
      poke = await getPokemon(id);
    } catch (err) {
      console.error(err);
      if (request === this.requestId) this.nameEl.setAttribute('text', 'value', `Could not load ${padId(id)}`);
      return;
    }
    if (request !== this.requestId) return; // a newer selection won
    this.current = poke;

    this.nameEl.setAttribute('text', 'value', `${padId(poke.id)}  ${poke.name}`);
    this.renderTypes(poke.types);
    this.renderStats(poke);

    this.data.model.setAttribute('pokemon-model', {
      id: poke.id,
      shiny: this.shiny,
      artworkUrl: poke.artworkUrl,
      cryUrl: poke.cryUrl || '',
    });
    if (THREE.AudioContext.getContext().state === 'running') this.modelComponent()?.playCry();
  },

  renderTypes(types) {
    this.typesEl.innerHTML = '';
    const w = 0.22;
    const gap = 0.03;
    types.forEach((type, i) => {
      const chip = document.createElement('a-entity');
      const x = (i - (types.length - 1) / 2) * (w + gap);
      chip.setAttribute('position', `${x} 0 0`);
      chip.setAttribute('geometry', { primitive: 'plane', width: w, height: 0.06 });
      chip.setAttribute('material', { color: TYPE_COLORS[type] || '#777777', shader: 'flat' });
      text(chip, type.toUpperCase(), { align: 'center', width: w, wrapCount: 11, zOffset: 0.002 });
      this.typesEl.appendChild(chip);
    });
  },

  renderStats(poke) {
    this.infoEl.setAttribute(
      'text',
      'value',
      `Height: ${poke.height} m    Weight: ${poke.weight} kg\nAbilities: ${poke.abilities.join(', ')}`,
    );
    this.flavorEl.setAttribute('text', 'value', poke.flavorText);

    let total = 0;
    for (const row of this.statRows) {
      const value = poke.stats.find((s) => s.name === row.key)?.value ?? 0;
      total += value;
      const w = Math.max(0.005, (Math.min(value, 255) / 255) * BAR_WIDTH);
      row.value.setAttribute('text', 'value', String(value));
      row.bar.setAttribute('width', w);
      row.bar.setAttribute('position', `${BAR_LEFT + w / 2} ${row.y} 0`);
      row.bar.setAttribute('material', 'color', statColor(value));
    }
    this.totalEl.setAttribute('text', 'value', `Total: ${total}`);
  },

  toggleShiny() {
    this.shiny = !this.shiny;
    this.shinyBtn.setAttribute('ui-button', 'label', `SHINY: ${this.shiny ? 'ON' : 'OFF'}`);
    if (this.current) this.data.model.setAttribute('pokemon-model', 'shiny', this.shiny);
  },

  remove() {
    this.el.sceneEl.removeEventListener('pokedex-select', this.onSelect);
    this.data.model.removeEventListener('pokemon-model-status', this.onModelStatus);
    this.data.controls.removeEventListener('ui-press', this.onControl);
    window.removeEventListener('pointerdown', this.unlockAudio);
    window.removeEventListener('keydown', this.unlockAudio);
    this.el.sceneEl.removeEventListener('enter-vr', this.unlockAudio);
  },
});
