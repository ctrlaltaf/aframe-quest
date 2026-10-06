/* global AFRAME */

const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl-', 'zxcvbnm'];

// On-screen keyboard for searching in VR. Emits `pokedex-key` on the scene with
// { key } where key is a character, "back", "clear" or "random".
// On desktop it also listens to the physical keyboard.
AFRAME.registerComponent('pokedex-keyboard', {
  schema: {
    keySize: { type: 'number', default: 0.088 },
    gap: { type: 'number', default: 0.012 },
  },

  init() {
    const { keySize, gap } = this.data;
    const pitch = keySize + gap;
    const left = -(10 * pitch - gap) / 2 + keySize / 2;

    ROWS.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        this.addKey(ch.toUpperCase(), ch, left + c * pitch, -r * pitch, keySize);
      });
    });
    // DEL fills the last three slots of the bottom row.
    const delWidth = 3 * pitch - gap;
    this.addKey('DEL', 'back', left + 7 * pitch - keySize / 2 + delWidth / 2, -3 * pitch, delWidth, '#5a3a4a');

    const wide = (10 * pitch - gap - gap) / 2;
    this.addKey('CLEAR', 'clear', -wide / 2 - gap / 2, -4 * pitch, wide, '#5a3a4a');
    this.addKey('RANDOM', 'random', wide / 2 + gap / 2, -4 * pitch, wide, '#3a5a4a');

    this.onPress = (evt) => {
      const value = evt.detail.value;
      if (!value.startsWith('key:')) return;
      evt.stopPropagation();
      this.el.sceneEl.emit('pokedex-key', { key: value.slice(4) });
    };
    this.el.addEventListener('ui-press', this.onPress);

    this.onKeyDown = (evt) => {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      let key = null;
      if (/^[a-z0-9-]$/i.test(evt.key)) key = evt.key.toLowerCase();
      else if (evt.key === 'Backspace') key = 'back';
      else if (evt.key === 'Escape') key = 'clear';
      if (!key) return;
      evt.preventDefault();
      this.el.sceneEl.emit('pokedex-key', { key });
    };
    window.addEventListener('keydown', this.onKeyDown);
  },

  addKey(label, key, x, y, width, color = '#2b3550') {
    const btn = document.createElement('a-entity');
    btn.setAttribute('ui-button', {
      label,
      value: `key:${key}`,
      width,
      height: this.data.keySize,
      color,
      wrapCount: (width * 0.95) / 0.026, // same letter size on every key
    });
    btn.setAttribute('position', `${x} ${y} 0`);
    this.el.appendChild(btn);
  },

  remove() {
    this.el.removeEventListener('ui-press', this.onPress);
    window.removeEventListener('keydown', this.onKeyDown);
  },
});
