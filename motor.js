'use strict';

// ── Utility ─────────────────────────────────────────────────────────────────
const DEG  = Math.PI / 180;
const SVG_NS = 'http://www.w3.org/2000/svg';
const fmt = n => n.toFixed(3);

function wrap360(a) { return ((a % 360) + 360) % 360; }

// ── Physical constants ───────────────────────────────────────────────────────
const K_TORQUE        = 5400;   // deg/s² per unit torque
const C_DRAG          = 0.65;   // viscous drag coefficient (1/s)
const DRAG_ADV_K      = 0.011;  // drag reduction per degree of advance
const OPEN_LOOP_RATE  = 420;    // electrical deg/s at full throttle (open-loop)
const MAX_VEL         = 9000;   // mechanical deg/s clamp

// ── Simulation state ─────────────────────────────────────────────────────────
const sim = {
  rotorAngle:      0,          // mechanical degrees
  velocity:        0,          // mechanical deg/s
  electricalAngle: 0,          // degrees
  throttle:        0.30,
  polePairs:       2,
  commMode:        'closedLoop',
  signalMode:      'sinusoidal',
  manualAngle:     0,
  advanceAngle:    15,
  running:         true,
  // Sensorless back-EMF zero-cross tracking
  sensorlessStep:  0,
  prevBEMF:        [0, 0, 0],
  // Computed last frame
  torquePU:        0,
};

// ── SVG element references ────────────────────────────────────────────────────
const statorCoilsEl = document.getElementById('statorCoils');
const rotorGroupEl  = document.getElementById('rotorGroup');
const rotorPolesEl  = document.getElementById('rotorPoles');
const fieldLineEl   = document.getElementById('fieldVecLine');
const fieldHeadEl   = document.getElementById('fieldVecHead');

// ── Stator coil slot definitions ─────────────────────────────────────────────
// Three phase pairs.  'angle' = visual math angle (0=right, 90=up, CCW+).
// 'positive' = winding direction convention for opacity coloring.
const COIL_SLOTS = [
  { phase: 'U', angle:  90, pos: true  },
  { phase: 'V', angle: 210, pos: true  },
  { phase: 'W', angle: 330, pos: true  },
  { phase: 'U', angle: 270, pos: false },
  { phase: 'V', angle:  30, pos: false },
  { phase: 'W', angle: 150, pos: false },
];

const PH_COL     = { U: '#ff4455', V: '#3dff88', W: '#4488ff' };
const PH_COL_NEG = { U: '#cc9daa', V: '#9dccb5', W: '#9daabb' };

// Coil arc radii & angular half-span
const CI = 158, CO = 211, CS = 21;   // inner-r, outer-r, half-span (deg)

// ── Build coil arc path template ──────────────────────────────────────────────
// Arc centred at SVG angle 0 (right side).  Each coil uses rotate() to position.
function buildCoilPath() {
  const h = CS * DEG;
  const oS = { x: CO * Math.cos(-h), y: CO * Math.sin(-h) };
  const oE = { x: CO * Math.cos( h), y: CO * Math.sin( h) };
  const iE = { x: CI * Math.cos( h), y: CI * Math.sin( h) };
  const iS = { x: CI * Math.cos(-h), y: CI * Math.sin(-h) };
  // Outer arc clockwise (sweep=1), inner arc counter-clockwise (sweep=0)
  return `M${fmt(oS.x)} ${fmt(oS.y)} A${CO} ${CO} 0 0 1 ${fmt(oE.x)} ${fmt(oE.y)} ` +
         `L${fmt(iE.x)} ${fmt(iE.y)} A${CI} ${CI} 0 0 0 ${fmt(iS.x)} ${fmt(iS.y)} Z`;
}

const COIL_PATH = buildCoilPath();
let coilEls = [];  // { el, phase, pos }

function initStatorCoils() {
  statorCoilsEl.innerHTML = '';
  coilEls = [];
  COIL_SLOTS.forEach(slot => {
    const g = document.createElementNS(SVG_NS, 'g');
    // SVG rotation is CW-positive; visual math angles are CCW-positive → negate
    g.setAttribute('transform', `rotate(${-slot.angle})`);

    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', COIL_PATH);
    p.setAttribute('fill', PH_COL[slot.phase]);
    p.setAttribute('opacity', '0.10');

    g.appendChild(p);
    statorCoilsEl.appendChild(g);
    coilEls.push({ el: p, phase: slot.phase, pos: slot.pos });
  });
}

// ── Rotor pole wedge path ─────────────────────────────────────────────────────
// startDeg / endDeg in SVG angle convention (CW from right).
function wedgePath(startDeg, endDeg, ri, ro) {
  const sa = startDeg * DEG, ea = endDeg * DEG;
  const la = ((endDeg - startDeg) > 180) ? 1 : 0;
  const oS = { x: ro * Math.cos(sa), y: ro * Math.sin(sa) };
  const oE = { x: ro * Math.cos(ea), y: ro * Math.sin(ea) };
  const iE = { x: ri * Math.cos(ea), y: ri * Math.sin(ea) };
  const iS = { x: ri * Math.cos(sa), y: ri * Math.sin(sa) };
  return `M${fmt(oS.x)} ${fmt(oS.y)} A${ro} ${ro} 0 ${la} 1 ${fmt(oE.x)} ${fmt(oE.y)} ` +
         `L${fmt(iE.x)} ${fmt(iE.y)} A${ri} ${ri} 0 ${la} 0 ${fmt(iS.x)} ${fmt(iS.y)} Z`;
}

function buildRotorPoles() {
  rotorPolesEl.innerHTML = '';
  const nPoles  = sim.polePairs * 2;
  const span    = 360 / nPoles;
  const rOuter  = 133;
  const rInner  = 30;
  // Label font size: shrink when many poles to avoid overlap
  const fs      = nPoles <= 4 ? 13 : nPoles <= 8 ? 9 : 7;

  for (let i = 0; i < nPoles; i++) {
    const isN     = (i % 2 === 0);
    // SVG angles (CW from right).  First pole starts at -90° (top) for visual symmetry.
    const sAng    = i * span - 90;
    const eAng    = (i + 1) * span - 90;
    const midAng  = (sAng + eAng) / 2;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', wedgePath(sAng, eAng, rInner, rOuter));
    path.setAttribute('fill', isN ? 'url(#gN)' : 'url(#gS)');

    const midRad = midAng * DEG;
    const lx = 82 * Math.cos(midRad);
    const ly = 82 * Math.sin(midRad) + fs * 0.35; // small baseline nudge
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', fmt(lx));
    label.setAttribute('y', fmt(ly));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('fill', 'rgba(255,255,255,0.65)');
    label.setAttribute('font-size', String(fs));
    label.setAttribute('font-family', 'monospace');
    label.setAttribute('font-weight', 'bold');
    label.textContent = isN ? 'N' : 'S';

    rotorPolesEl.appendChild(path);
    rotorPolesEl.appendChild(label);
  }
}

// ── Signal generation ─────────────────────────────────────────────────────────
// Returns [Vu, Vv, Vw] in the range [-1, 1].
const TRAP_TABLE = [
  [ 1, -1,  0],
  [ 1,  0, -1],
  [ 0,  1, -1],
  [-1,  1,  0],
  [-1,  0,  1],
  [ 0, -1,  1],
];

function getPhaseVoltages(ea) {
  if (sim.signalMode === 'sinusoidal') {
    return [
      Math.sin(ea * DEG),
      Math.sin((ea - 120) * DEG),
      Math.sin((ea - 240) * DEG),
    ];
  }
  // Trapezoidal 6-step
  const sector = Math.floor(wrap360(ea) / 60) % 6;
  return TRAP_TABLE[sector];
}

// ── Commutation update ────────────────────────────────────────────────────────
function updateCommutation(dt) {
  switch (sim.commMode) {

    case 'manual':
      sim.electricalAngle = sim.manualAngle;
      break;

    case 'openLoop':
      sim.electricalAngle = wrap360(
        sim.electricalAngle + OPEN_LOOP_RATE * sim.throttle * dt
      );
      break;

    case 'closedLoop':
      // elecAngle = rotorAngle * polePairs + 90° lead + advance
      sim.electricalAngle = wrap360(
        sim.rotorAngle * sim.polePairs + 90 + sim.advanceAngle
      );
      break;

    case 'sensorless':
      updateSensorless();
      break;
  }
}

// Sensorless: detect zero-crossing on the non-energised (floating) phase back-EMF.
// In 6-step commutation the floating phase cycles through W, V, U (steps 0–5 use index 2,1,0,2,1,0).
const FLOAT_PHASE_IDX   = [2, 1, 0, 2, 1, 0];  // 0=U, 1=V, 2=W
const PHASE_OFFSETS_DEG = [0, 120, 240];         // electrical offsets for U, V, W

function updateSensorless() {
  const step      = sim.sensorlessStep % 6;
  const floatIdx  = FLOAT_PHASE_IDX[step];
  const offset    = PHASE_OFFSETS_DEG[floatIdx];

  // Back-EMF of floating phase (proportional to velocity × sin(rotor electrical angle))
  const bemf      = Math.sin((sim.rotorAngle * sim.polePairs - offset) * DEG) * sim.velocity;
  const prev      = sim.prevBEMF[floatIdx];

  // Zero-crossing detected (sign change) when spinning above a threshold
  if (prev * bemf < 0 && Math.abs(sim.velocity) > 30) {
    sim.sensorlessStep++;
    sim.electricalAngle = wrap360((sim.sensorlessStep % 6) * 60);
  }

  sim.prevBEMF[floatIdx] = bemf;
}

// ── Physics update ────────────────────────────────────────────────────────────
function updatePhysics(dt) {
  // Torque: T = throttle · sin(θ_elec − θ_rotor · pp) · K / pp
  const torqueAngle = (sim.electricalAngle - sim.rotorAngle * sim.polePairs) * DEG;
  const torque      = sim.throttle * Math.sin(torqueAngle) * K_TORQUE / sim.polePairs;

  // Drag: D = velocity · (C_drag − advance · scale)
  //   Positive advance (field weakening) reduces effective drag → allows higher speed.
  const effectiveDrag = Math.max(C_DRAG - sim.advanceAngle * DRAG_ADV_K, 0.005);
  const drag          = sim.velocity * effectiveDrag;

  // Integrate
  const accel    = torque - drag;
  sim.velocity   = Math.max(-MAX_VEL, Math.min(MAX_VEL, sim.velocity + accel * dt));
  sim.rotorAngle = wrap360(sim.rotorAngle + sim.velocity * dt);
  sim.torquePU   = torque / K_TORQUE;
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  const [Vu, Vv, Vw] = getPhaseVoltages(sim.electricalAngle);
  const phases        = { U: Vu, V: Vv, W: Vw };

  // Stator coil opacity & colour
  coilEls.forEach(({ el, phase, pos }) => {
    const v      = phases[phase];
    const local  = pos ? v : -v;
    const op     = Math.max(0.08, Math.abs(local) * 0.88 + 0.08);
    el.setAttribute('opacity', op.toFixed(3));
    el.setAttribute('fill', local >= 0 ? PH_COL[phase] : PH_COL_NEG[phase]);
  });

  // Rotor rotation: visual CCW+ convention → SVG CW+ → negate
  rotorGroupEl.setAttribute('transform', `rotate(${-sim.rotorAngle})`);

  // Field vector direction
  // Convention: electricalAngle=0 → field points "up" (visual 90°).
  // Map: SVG angle = -(electricalAngle + 90)  (converts math→SVG, offset so 0=up)
  const fvRad    = (sim.electricalAngle + 90) * DEG;
  const fvLen    = 72 + sim.throttle * 30;
  const headLen  = fvLen + 17;
  const ex  =  fvLen  * Math.cos(-(fvRad));  // negative because SVG y is down
  const ey  = -fvLen  * Math.sin(-(fvRad));  // wait, let me re-derive carefully

  // Visual angle θ (0=right, 90=up, CCW+) → SVG coords:
  //   svgX =  r · cos(θ)
  //   svgY = -r · sin(θ)   (SVG y-axis points down)
  const theta     = sim.electricalAngle * DEG;  // visual angle of field
  const fx        =  fvLen   * Math.cos(theta);
  const fy        = -fvLen   * Math.sin(theta);
  const hx        =  headLen * Math.cos(theta);
  const hy        = -headLen * Math.sin(theta);
  // Perpendicular unit vector for arrow head base
  const px        = -Math.sin(theta);
  const py        = -Math.cos(theta);
  const hw        = 7;

  fieldLineEl.setAttribute('x2', fx.toFixed(2));
  fieldLineEl.setAttribute('y2', fy.toFixed(2));
  fieldHeadEl.setAttribute('points',
    `${hx.toFixed(2)},${hy.toFixed(2)} ` +
    `${(fx + px * hw).toFixed(2)},${(fy + py * hw).toFixed(2)} ` +
    `${(fx - px * hw).toFixed(2)},${(fy - py * hw).toFixed(2)}`
  );

  // Telemetry readouts (update every frame — strings are cheap)
  const rpm = (sim.velocity / 360 * 60);
  document.getElementById('dSpeed') .textContent = Math.abs(rpm).toFixed(0);
  document.getElementById('dTorque').textContent = sim.torquePU.toFixed(2);
  document.getElementById('dElec')  .textContent = sim.electricalAngle.toFixed(0);
  document.getElementById('dRotor') .textContent = sim.rotorAngle.toFixed(0);

  // Phase voltage bars
  setPhaseBar('phU', Vu);
  setPhaseBar('phV', Vv);
  setPhaseBar('phW', Vw);
}

// Centered bar: positive voltage fills upward from midpoint, negative downward.
const BAR_HALF = 26;  // half of 52px track height
function setPhaseBar(id, v) {
  const el = document.getElementById(id);
  const h  = Math.abs(v) * BAR_HALF;
  if (v >= 0) {
    el.style.height = h + 'px';
    el.style.top    = (BAR_HALF - h) + 'px';
    el.style.bottom = 'auto';
  } else {
    el.style.height = h + 'px';
    el.style.top    = BAR_HALF + 'px';
    el.style.bottom = 'auto';
  }
}

// ── Animation loop ────────────────────────────────────────────────────────────
let lastTs = null;

function loop(ts) {
  if (sim.running) {
    const dt = lastTs !== null
      ? Math.min((ts - lastTs) / 1000, 0.033)   // cap at ~30 ms / frame
      : 0.016;
    lastTs = ts;

    updateCommutation(dt);
    updatePhysics(dt);
  } else {
    lastTs = null;
  }

  render();
  requestAnimationFrame(loop);
}

// ── UI event wiring ───────────────────────────────────────────────────────────
function activateBtn(groupId, attrName, value) {
  document.getElementById(groupId).querySelectorAll('[' + attrName + ']').forEach(b => {
    const isMatch = b.getAttribute(attrName) === value;
    b.classList.toggle('on',   !b.classList.contains('pole-btn') && isMatch);
    b.classList.toggle('on-G',  b.classList.contains('pole-btn') && isMatch);
  });
}

// Commutation mode
document.getElementById('commBtns').addEventListener('click', e => {
  const cm = e.target.dataset.cm;
  if (!cm) return;
  sim.commMode = cm;
  activateBtn('commBtns', 'data-cm', cm);

  // Enable/disable manual angle slider
  const isManual = cm === 'manual';
  const sl = document.getElementById('sManual');
  sl.classList.toggle('muted', !isManual);
});

// Signal mode
document.getElementById('signalBtns').addEventListener('click', e => {
  const sm = e.target.dataset.sm;
  if (!sm) return;
  sim.signalMode = sm;
  activateBtn('signalBtns', 'data-sm', sm);
});

// Pole pairs
document.getElementById('ppBtns').addEventListener('click', e => {
  const pp = parseInt(e.target.dataset.pp, 10);
  if (!pp) return;
  sim.polePairs = pp;
  activateBtn('ppBtns', 'data-pp', String(pp));
  buildRotorPoles();
});

// Throttle
document.getElementById('sThrottle').addEventListener('input', function () {
  sim.throttle = this.value / 100;
  document.getElementById('dThrottle').textContent = this.value + '%';
});

// Manual angle
document.getElementById('sManual').addEventListener('input', function () {
  sim.manualAngle = +this.value;
  document.getElementById('dManual').textContent = this.value + '°';
});

// Advance
document.getElementById('sAdvance').addEventListener('input', function () {
  sim.advanceAngle = +this.value;
  document.getElementById('dAdvance').textContent = this.value + '°';
});

// Run / Pause
document.getElementById('runBtn').addEventListener('click', function () {
  sim.running = !sim.running;
  this.textContent = sim.running ? '⏸ PAUSE' : '▶ RESUME';
  this.classList.toggle('paused', !sim.running);
});

// ── Initialise & start ────────────────────────────────────────────────────────
initStatorCoils();
buildRotorPoles();
requestAnimationFrame(loop);
