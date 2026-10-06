/* global AFRAME, THREE */

const WALK_CLIP = /walk|run/i;
const IDLE_CLIP = /wait|idle|loop/i;
const ARRIVE_DISTANCE = 0.05; // metres
const WALK_ANGLE = Math.PI / 3; // only walk forward when facing within 60° of the target
const PICK_TRIES = 20;

// Wraps an angle to -PI..PI.
function wrapAngle(a) {
  return a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
}

// --- Walking area -----------------------------------------------------------
// An area is { radius, center: {x, y}, excludeMin: {x, y}, excludeMax: {x, y},
// personalSpace } in the parent's x/z plane (vec2 `y` means z). Points must be
// inside the circle, outside the exclusion box (the panels and pedestal) and
// outside the player's personal space. `margin` is roughly the Pokémon's
// radius, so its body doesn't poke into a forbidden zone.

function pointAllowed(area, margin, x, z) {
  const dx = x - area.center.x;
  const dz = z - area.center.y;
  const dist = Math.hypot(dx, dz);
  if (dist > area.radius - margin || dist < area.personalSpace + margin) return false;
  const inBox =
    x > area.excludeMin.x - margin && x < area.excludeMax.x + margin &&
    z > area.excludeMin.y - margin && z < area.excludeMax.y + margin;
  return !inBox;
}

// True if the straight path a -> b stays out of the exclusion box and personal space.
// (Both ends are inside the circle, which is convex, so the path is too.)
function pathAllowed(area, margin, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;

  // Segment vs. personal-space circle: distance from the centre to the segment.
  const lengthSq = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((area.center.x - ax) * dx + (area.center.y - az) * dz) / lengthSq));
  const cx = ax + dx * t - area.center.x;
  const cz = az + dz * t - area.center.y;
  if (Math.hypot(cx, cz) < area.personalSpace + margin) return false;

  // Segment vs. exclusion box (slab test).
  let tMin = 0;
  let tMax = 1;
  const slabs = [
    [ax, dx, area.excludeMin.x - margin, area.excludeMax.x + margin],
    [az, dz, area.excludeMin.y - margin, area.excludeMax.y + margin],
  ];
  for (const [start, dir, min, max] of slabs) {
    if (Math.abs(dir) < 1e-9) {
      if (start < min || start > max) return true; // parallel and outside this slab
      continue;
    }
    let t1 = (min - start) / dir;
    let t2 = (max - start) / dir;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return true; // misses the box
  }
  return false;
}

// Picks a random allowed point and writes it to `out` ({ x, z }). If `from` is
// given, the straight path from it must be allowed too. Distances are measured
// from the area's centre. Returns false if no point was found.
export function pickPoint(area, margin, out, from = null, minDist = 0, maxDist = area.radius) {
  for (let i = 0; i < PICK_TRIES; i++) {
    // sqrt for an even spread over the ring, not bunched in the middle
    const r = Math.sqrt(minDist * minDist + Math.random() * (maxDist * maxDist - minDist * minDist));
    const angle = Math.random() * Math.PI * 2;
    const x = area.center.x + Math.sin(angle) * r;
    const z = area.center.y + Math.cos(angle) * r;
    if (!pointAllowed(area, margin, x, z)) continue;
    if (from && !pathAllowed(area, margin, from.x, from.z, x, z)) continue;
    out.x = x;
    out.z = z;
    return true;
  }
  return false;
}

// Makes a `pokemon-model` entity walk around: pick a random point in the area,
// turn to face it, walk there, idle for a few seconds (sometimes crying), repeat.
// Plays a walk/run clip while moving if the model has one; models without one
// keep their idle animation and just glide.
//
// Moves in its parent's x/z plane at the parent's height, so put wanderers in a
// container that sits on the floor (see `pokemon-wanderers`).
// Usage: <a-entity pokemon-model="id: 25; spin: 0" pokemon-wander>
AFRAME.registerComponent('pokemon-wander', {
  schema: {
    radius: { type: 'number', default: 3 },
    center: { type: 'vec2', default: { x: 0, y: 0 } },
    // Box (x/z) kept clear for the panels and pedestal in front of the player.
    excludeMin: { type: 'vec2', default: { x: -1.9, y: -2.3 } },
    excludeMax: { type: 'vec2', default: { x: 1.9, y: -0.6 } },
    personalSpace: { type: 'number', default: 0.6 }, // stay this far from the player
    speed: { type: 'number', default: 0 }, // metres per second, 0 = based on size
    turnSpeed: { type: 'number', default: 220 }, // degrees per second
    idleMin: { type: 'number', default: 2 }, // seconds
    idleMax: { type: 'number', default: 5 },
    cryChance: { type: 'number', default: 0.3 }, // chance to cry after arriving
    headingOffset: { type: 'number', default: 0 }, // degrees, if a model doesn't face +Z
  },

  init() {
    this.state = 'idle';
    this.target = { x: 0, z: 0 };
    this.from = { x: 0, z: 0 };
    this.idleLeft = 0.5 + Math.random(); // stand still briefly after appearing

    // The model loads after we start, so re-apply the clip once it's there.
    this.onModelStatus = (evt) => {
      if (evt.detail.status === 'loaded') this.applyClip();
    };
    this.el.addEventListener('pokemon-model-status', this.onModelStatus);
  },

  model() {
    return this.el.components['pokemon-model'];
  },

  // Half the model's size, used as its body radius when checking the area.
  margin() {
    return (this.model()?.data.size ?? 0.5) / 2;
  },

  walkSpeed() {
    if (this.data.speed > 0) return this.data.speed;
    const size = this.model()?.data.size ?? 0.5;
    return THREE.MathUtils.clamp(size * 0.7, 0.15, 0.6);
  },

  applyClip() {
    const model = this.model();
    if (!model) return;
    if (this.state === 'walk' && model.hasClip(WALK_CLIP)) model.playClip(WALK_CLIP);
    else model.playClip(IDLE_CLIP);
  },

  startWalk() {
    const pos = this.el.object3D.position;
    this.from.x = pos.x;
    this.from.z = pos.z;
    if (!pickPoint(this.data, this.margin(), this.target, this.from)) {
      this.startIdle(false); // boxed in for now: try again later
      return;
    }
    this.state = 'walk';
    this.applyClip();
  },

  startIdle(mayCry = true) {
    const { idleMin, idleMax, cryChance } = this.data;
    this.state = 'idle';
    this.idleLeft = idleMin + Math.random() * Math.max(0, idleMax - idleMin);
    this.applyClip();
    if (mayCry && Math.random() < cryChance && THREE.AudioContext.getContext().state === 'running') {
      this.model()?.playCry();
    }
  },

  tick(time, delta) {
    const dt = Math.min(delta, 100) / 1000;

    if (this.state === 'idle') {
      this.idleLeft -= dt;
      if (this.idleLeft <= 0) this.startWalk();
      return;
    }

    const obj = this.el.object3D;
    const dx = this.target.x - obj.position.x;
    const dz = this.target.z - obj.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < ARRIVE_DISTANCE) {
      this.startIdle();
      return;
    }

    // Turn towards the target (models face +Z) at a limited rate, the short way round.
    const desired = Math.atan2(dx, dz) + THREE.MathUtils.degToRad(this.data.headingOffset);
    const maxTurn = THREE.MathUtils.degToRad(this.data.turnSpeed) * dt;
    const turn = THREE.MathUtils.clamp(wrapAngle(desired - obj.rotation.y), -maxTurn, maxTurn);
    obj.rotation.y = wrapAngle(obj.rotation.y + turn);

    // Walk along the checked straight path, slower while still turning.
    const facingError = Math.abs(wrapAngle(desired - obj.rotation.y));
    if (facingError < WALK_ANGLE) {
      const step = Math.min(dist, this.walkSpeed() * Math.cos(facingError) * dt);
      obj.position.x += (dx / dist) * step;
      obj.position.z += (dz / dist) * step;
    }
  },

  remove() {
    this.el.removeEventListener('pokemon-model-status', this.onModelStatus);
  },
});
