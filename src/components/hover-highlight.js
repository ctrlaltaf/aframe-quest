/* global AFRAME */

// Scales an entity up while a laser pointer or the mouse is over it.
// The entity also needs the "interactive" class so the raycasters can hit it.
AFRAME.registerComponent('hover-highlight', {
  schema: {
    scale: { type: 'number', default: 1.15 },
  },

  init() {
    this.originalScale = this.el.object3D.scale.clone();
    this.onEnter = () => this.el.object3D.scale.copy(this.originalScale).multiplyScalar(this.data.scale);
    this.onLeave = () => this.el.object3D.scale.copy(this.originalScale);
    this.el.addEventListener('mouseenter', this.onEnter);
    this.el.addEventListener('mouseleave', this.onLeave);
  },

  remove() {
    this.el.removeEventListener('mouseenter', this.onEnter);
    this.el.removeEventListener('mouseleave', this.onLeave);
  },
});
