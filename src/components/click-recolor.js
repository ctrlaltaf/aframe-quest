/* global AFRAME */

// Gives an entity a random color when clicked (mouse click or controller trigger).
AFRAME.registerComponent('click-recolor', {
  init() {
    this.onClick = () => {
      const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`;
      this.el.setAttribute('material', 'color', color);
    };
    this.el.addEventListener('click', this.onClick);
  },

  remove() {
    this.el.removeEventListener('click', this.onClick);
  },
});
