/* global AFRAME */

// A flat clickable button: a plane with a text label.
// When clicked it emits a bubbling `ui-press` event with { value }, so a parent
// panel can listen once for all of its buttons.
AFRAME.registerComponent('ui-button', {
  schema: {
    label: { type: 'string', default: '' },
    value: { type: 'string', default: '' },
    width: { type: 'number', default: 0.2 },
    height: { type: 'number', default: 0.08 },
    color: { type: 'color', default: '#2b3550' },
    textColor: { type: 'color', default: '#ffffff' },
    wrapCount: { type: 'number', default: 20 },
    disabled: { type: 'boolean', default: false },
  },

  init() {
    this.el.classList.add('interactive');
    this.el.setAttribute('hover-highlight', 'scale: 1.06');
    this.onClick = (evt) => {
      evt.stopPropagation();
      if (this.data.disabled) return;
      this.el.emit('ui-press', { value: this.data.value }, true);
    };
    this.el.addEventListener('click', this.onClick);
  },

  update() {
    const { width, height, color, textColor, label, wrapCount, disabled } = this.data;
    this.el.setAttribute('geometry', { primitive: 'plane', width, height });
    this.el.setAttribute('material', { color, shader: 'flat', opacity: disabled ? 0.35 : 1, transparent: disabled });
    this.el.setAttribute('text', {
      value: label,
      align: 'center',
      anchor: 'center',
      baseline: 'center',
      width: width * 0.95,
      wrapCount,
      color: textColor,
      zOffset: 0.002,
    });
  },

  remove() {
    this.el.removeEventListener('click', this.onClick);
  },
});
