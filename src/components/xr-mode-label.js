/* global AFRAME */

// Updates this entity's text to show whether you're on desktop, in VR or in AR (passthrough).
AFRAME.registerComponent('xr-mode-label', {
  init() {
    this.scene = this.el.sceneEl;
    this.updateLabel = this.updateLabel.bind(this);
    this.scene.addEventListener('enter-vr', this.updateLabel);
    this.scene.addEventListener('exit-vr', this.updateLabel);
  },

  updateLabel() {
    let mode = 'Desktop mode';
    if (this.scene.is('ar-mode')) mode = 'AR mode (passthrough)';
    else if (this.scene.is('vr-mode')) mode = 'VR mode';
    this.el.setAttribute('text', 'value', mode);
  },

  remove() {
    this.scene.removeEventListener('enter-vr', this.updateLabel);
    this.scene.removeEventListener('exit-vr', this.updateLabel);
  },
});
