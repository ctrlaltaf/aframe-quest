/* global AFRAME */
import { loadIndex, searchIndex, prettyName, padId } from '../pokeapi.js';

const PAGE_SIZE = 8;

// Search panel: shows the query, a page of matching Pokémon and Prev/Next.
// Listens for `pokedex-key` (from pokedex-keyboard) and emits `pokedex-select`
// with { id } on the scene when a result (or Random) is picked.
AFRAME.registerComponent('pokedex-search', {
  schema: {
    width: { type: 'number', default: 1.1 },
    height: { type: 'number', default: 1.36 },
  },

  init() {
    this.index = [];
    this.matches = [];
    this.query = '';
    this.page = 0;
    this.buildUi();

    this.onKey = (evt) => this.handleKey(evt.detail.key);
    this.el.sceneEl.addEventListener('pokedex-key', this.onKey);

    this.onPress = (evt) => {
      const [kind, arg] = evt.detail.value.split(':');
      if (kind === 'select') this.select(Number(arg));
      else if (kind === 'page') this.setPage(this.page + (arg === 'next' ? 1 : -1));
      else if (kind === 'retry') this.loadIndex();
    };
    this.el.addEventListener('ui-press', this.onPress);

    this.loadIndex();
  },

  buildUi() {
    const { width, height } = this.data;
    const top = height / 2;

    const bg = document.createElement('a-plane');
    bg.setAttribute('width', width);
    bg.setAttribute('height', height);
    bg.setAttribute('material', 'color: #141a2a; shader: flat; opacity: 0.92; transparent: true');
    bg.setAttribute('position', `0 0 -0.01`);
    this.el.appendChild(bg);

    this.titleEl = this.addText('POKEDEX SEARCH', 0, top - 0.07, width, 28, '#ffcb05');
    this.queryEl = this.addText('', 0, top - 0.155, width * 0.9, 30, '#ffffff');

    this.resultEls = [];
    for (let i = 0; i < PAGE_SIZE; i++) {
      const btn = document.createElement('a-entity');
      const col = i % 2;
      const row = Math.floor(i / 2);
      btn.setAttribute('position', `${col === 0 ? -0.25 : 0.25} ${top - 0.255 - row * 0.09} 0`);
      btn.setAttribute('ui-button', { width: 0.48, height: 0.075, wrapCount: 20, color: '#24304d' });
      this.el.appendChild(btn);
      this.resultEls.push(btn);
    }

    const pagerY = top - 0.255 - 4 * 0.09;
    this.prevEl = this.addButton('< PREV', 'page:prev', -0.38, pagerY, 0.24);
    this.nextEl = this.addButton('NEXT >', 'page:next', 0.38, pagerY, 0.24);
    this.statusEl = this.addText('', 0, pagerY, 0.5, 24, '#9aa7c7');
  },

  addText(value, x, y, width, wrapCount, color) {
    const el = document.createElement('a-entity');
    el.setAttribute('position', `${x} ${y} 0`);
    el.setAttribute('text', { value, align: 'center', anchor: 'center', baseline: 'center', width, wrapCount, color });
    this.el.appendChild(el);
    return el;
  },

  addButton(label, value, x, y, width) {
    const el = document.createElement('a-entity');
    el.setAttribute('position', `${x} ${y} 0`);
    el.setAttribute('ui-button', { label, value, width, height: 0.07, wrapCount: 10, color: '#3a4670' });
    this.el.appendChild(el);
    return el;
  },

  async loadIndex() {
    this.setStatus('Loading Pokedex...');
    try {
      this.index = await loadIndex();
      this.refresh();
    } catch (err) {
      console.error(err);
      this.setStatus('Could not reach PokeAPI');
      this.showResults([{ label: 'Retry', value: 'retry:' }]);
    }
  },

  handleKey(key) {
    if (key === 'random') {
      if (this.index.length) this.select(this.index[Math.floor(Math.random() * this.index.length)].id);
      return;
    }
    if (key === 'back') this.query = this.query.slice(0, -1);
    else if (key === 'clear') this.query = '';
    else if (this.query.length < 20) this.query += key;
    this.refresh();
  },

  refresh() {
    this.matches = searchIndex(this.index, this.query);
    this.queryEl.setAttribute('text', 'value', `Search: ${this.query}_`);
    this.setPage(0);
  },

  setPage(page) {
    const pages = Math.max(1, Math.ceil(this.matches.length / PAGE_SIZE));
    this.page = Math.min(Math.max(page, 0), pages - 1);
    const slice = this.matches.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    this.showResults(slice.map((p) => ({ label: `${padId(p.id)} ${prettyName(p.name)}`, value: `select:${p.id}` })));
    this.prevEl.setAttribute('ui-button', 'disabled', this.page === 0);
    this.nextEl.setAttribute('ui-button', 'disabled', this.page >= pages - 1);
    this.setStatus(
      this.matches.length ? `${this.page + 1} / ${pages}  (${this.matches.length})` : 'No matches',
    );
  },

  showResults(items) {
    this.resultEls.forEach((btn, i) => {
      const item = items[i];
      btn.object3D.visible = Boolean(item);
      // Hidden buttons must not catch laser clicks.
      btn.classList.toggle('interactive', Boolean(item));
      if (item) btn.setAttribute('ui-button', { label: item.label, value: item.value });
    });
  },

  setStatus(value) {
    this.statusEl.setAttribute('text', 'value', value);
  },

  select(id) {
    this.el.sceneEl.emit('pokedex-select', { id });
  },

  remove() {
    this.el.sceneEl.removeEventListener('pokedex-key', this.onKey);
    this.el.removeEventListener('ui-press', this.onPress);
  },
});
