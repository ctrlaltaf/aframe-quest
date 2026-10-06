/* global AFRAME */

// Rotates an entity around its Y axis. Usage: <a-entity spin="speed: 45">
AFRAME.registerComponent('spin', {
  schema: {
    speed: { type: 'number', default: 30 }, // degrees per second
  },

  tick(time, delta) {
    this.el.object3D.rotation.y += AFRAME.THREE.MathUtils.degToRad(this.data.speed) * (delta / 1000);
  },
});
