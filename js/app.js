/**
 * js/app.js
 * Main Application Controller:
 * - Dual Theme: Dark Mode (Xanh Tối Gốc) & Light Mode (Sáng Bách Khoa)
 * - Exact Symbolic H(z) Input + Bidirectional Z-Plane Sync
 * - 2D Im-Re Pole-Zero Interaction (Pointer/Touch, Snap, Wheel Zoom, Undo/Redo) + 3D |H(z)| View
 * - Inline Coordinate Editor (Cartesian & Polar) for Poles/Zeros
 * - Real-time Hover Tooltips across Magnitude, Phase/Group Delay, and Time-Domain Charts
 * - Interactive Signal Filtering Controls & Geometric Vector Breakdown
 */

const state = {
  theme: 'dark',
  zeros: [],
  poles: [],
  delay: 0,
  gain: 1.0,
  omega0: Math.PI / 4,
  fsHz: 300,
  rocType: 'causal',
  interactMode: 'drag',
  zViewMode: '2d', // '2d' | '3d'
  view3dYaw: 0.65,
  view3dPitch: 0.56,
  phaseChartMode: 'phase', // 'phase' | 'unwrapped' | 'groupDelay'
  timeChartMode: 'impulse', // 'impulse' | 'step' | 'signal'
  signalOpts: {
    type: 'twoTone',
    w1: 0.12 * Math.PI,
    w2: 0.72 * Math.PI
  },
  conjugatePair: true,
  showVectors: true,
  showOriginRoots: true,
  snapToGrid: false,
  snapHint: null,
  magDb: false,
  fullFreqRange: false,
  numSamples: 64,
  zViewRange: 1.42,
  dragging: null,
  hoveredRoot: null,
  editingRoot: null, // { type, index }
  bCoeffs: [1],
  aCoeffs: [1],
  freqData: null,
  lastTimeData: null,
  undoStack: [],
  redoStack: [],
  lastFrameTime: performance.now(),
  renderMs: 1.0,
  fps: 60
};

const PRESETS = {
  resonator: {
    expr: '0.19 * (1 - z^-2) / (1 - 1.2728*z^-1 + 0.81*z^-2)',
    gain: 0.19,
    delay: 0,
    zeros: [new Complex(1, 0), new Complex(-1, 0)],
    poles: [Complex.fromPolar(0.9, Math.PI / 4), Complex.fromPolar(0.9, -Math.PI / 4)],
    omega0: Math.PI / 4,
    rocType: 'causal'
  },
  notch: {
    expr: '0.93 * (1 - z^-1 + z^-2) / (1 - 0.92*z^-1 + 0.8464*z^-2)',
    gain: 0.93,
    delay: 0,
    zeros: [Complex.fromPolar(1.0, Math.PI / 3), Complex.fromPolar(1.0, -Math.PI / 3)],
    poles: [Complex.fromPolar(0.92, Math.PI / 3), Complex.fromPolar(0.92, -Math.PI / 3)],
    omega0: Math.PI / 3,
    rocType: 'causal'
  },
  lowpass_iir: {
    expr: '0.0976 * (1 + 2*z^-1 + z^-2) / (1 - 1.1085*z^-1 + 0.4096*z^-2)',
    gain: 0.0976,
    delay: 0,
    zeros: [new Complex(-1, 0), new Complex(-1, 0)],
    poles: [Complex.fromPolar(0.64, Math.PI / 6), Complex.fromPolar(0.64, -Math.PI / 6)],
    omega0: Math.PI / 8,
    rocType: 'causal'
  },
  highpass_iir: {
    expr: '0.25 * (1 - 2*z^-1 + z^-2) / (1 + 0.9192*z^-1 + 0.4225*z^-2)',
    gain: 0.25,
    delay: 0,
    zeros: [new Complex(1, 0), new Complex(1, 0)],
    poles: [Complex.fromPolar(0.65, (3 * Math.PI) / 4), Complex.fromPolar(0.65, -(3 * Math.PI) / 4)],
    omega0: (3 * Math.PI) / 4,
    rocType: 'causal'
  },
  moving_avg: {
    expr: '0.25 * (1 + z^-1 + z^-2 + z^-3)',
    gain: 0.25,
    delay: 0,
    zeros: [new Complex(0, 1), new Complex(0, -1), new Complex(-1, 0)],
    poles: [],
    omega0: Math.PI / 2,
    rocType: 'causal'
  },
  allpass: {
    expr: '(0.64 - 0.8*z^-1 + z^-2) / (1 - 0.8*z^-1 + 0.64*z^-2)',
    gain: 0.64,
    delay: 0,
    zeros: [
      Complex.fromPolar(1 / 0.8, Math.PI / 3),
      Complex.fromPolar(1 / 0.8, -Math.PI / 3)
    ],
    poles: [
      Complex.fromPolar(0.8, Math.PI / 3),
      Complex.fromPolar(0.8, -Math.PI / 3)
    ],
    omega0: Math.PI / 3,
    rocType: 'causal'
  },
  comb: {
    expr: '0.5 * (1 - z^-4)',
    gain: 0.5,
    delay: 0,
    zeros: [
      Complex.fromPolar(1, 0),
      Complex.fromPolar(1, Math.PI / 2),
      Complex.fromPolar(1, -Math.PI / 2),
      Complex.fromPolar(1, Math.PI)
    ],
    poles: [],
    omega0: Math.PI / 4,
    rocType: 'causal'
  },
  double_pole: {
    expr: '0.25 / (1 - 0.5*z^-1)^2',
    gain: 0.25,
    delay: 0,
    zeros: [],
    poles: [new Complex(0.5, 0), new Complex(0.5, 0)],
    omega0: Math.PI / 6,
    rocType: 'causal'
  },
  unstable: {
    expr: '0.5 / (1 - 1.7313*z^-1 + 1.1449*z^-2)',
    gain: 0.5,
    delay: 0,
    zeros: [],
    poles: [
      Complex.fromPolar(1.07, Math.PI / 5),
      Complex.fromPolar(1.07, -Math.PI / 5)
    ],
    omega0: Math.PI / 5,
    rocType: 'causal'
  }
};

/* ==================== HISTORY (UNDO / REDO) ==================== */

function captureSnapshot() {
  return {
    zeros: state.zeros.map(z => new Complex(z.re, z.im)),
    poles: state.poles.map(p => new Complex(p.re, p.im)),
    delay: state.delay,
    gain: state.gain,
    rocType: state.rocType
  };
}

function pushUndoHistory() {
  state.undoStack.push(captureSnapshot());
  if (state.undoStack.length > 40) state.undoStack.shift();
  state.redoStack = [];
  updateUndoRedoButtons();
}

function restoreSnapshot(snap) {
  state.zeros = snap.zeros.map(z => new Complex(z.re, z.im));
  state.poles = snap.poles.map(p => new Complex(p.re, p.im));
  state.delay = snap.delay || 0;
  state.gain = snap.gain;
  state.rocType = snap.rocType;
  const rocSel = document.getElementById('rocTypeSelect');
  if (rocSel) rocSel.value = state.rocType;
  state.editingRoot = null;
  syncCoeffsFromRoots(true, false);
  requestRedraw();
}

window.undoAction = function () {
  if (state.undoStack.length === 0) return;
  state.redoStack.push(captureSnapshot());
  const prev = state.undoStack.pop();
  restoreSnapshot(prev);
  updateUndoRedoButtons();
};

window.redoAction = function () {
  if (state.redoStack.length === 0) return;
  state.undoStack.push(captureSnapshot());
  const next = state.redoStack.pop();
  restoreSnapshot(next);
  updateUndoRedoButtons();
};

function updateUndoRedoButtons() {
  const uBtn = document.getElementById('undoBtn');
  const rBtn = document.getElementById('redoBtn');
  if (uBtn) uBtn.disabled = state.undoStack.length === 0;
  if (rBtn) rBtn.disabled = state.redoStack.length === 0;
}

/* ==================== UNIFORM INLINE SVG ICONS ==================== */

const UI_ICONS = {
  checkCircle:
    '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xCircle:
    '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>',
  alertCircle:
    '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
  alertTriangle:
    '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
  bookmark:
    '<svg class="w-3.5 h-3.5 shrink-0 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>',
  target:
    '<svg class="w-3.5 h-3.5 shrink-0 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  edit:
    '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  close:
    '<svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
};

const CIRCUIT_SVGS = {
  lowpass_rc: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch lọc thông thấp RC">
    <circle cx="24" cy="28" r="2.6" stroke="var(--accent-sky)" />
    <text x="24" y="18" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 27,28 H 58 l 3,-5 l 5,10 l 5,-10 l 5,10 l 5,-10 l 3,5 H 174" />
    <text x="71" y="16" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="126" cy="28" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 126,28 V 45 M 116,45 H 136 M 116,51 H 136 M 126,51 V 67" />
    <text x="142" y="51" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <path d="M 126,67 V 72 M 117,72 H 135 M 120.5,75.5 H 131.5 M 123.5,79 H 128.5" />
    <text x="126" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="177" cy="28" r="2.6" stroke="var(--accent-emerald)" />
    <text x="177" y="18" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  lowpass_rlc: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch lọc thông thấp RLC">
    <circle cx="20" cy="28" r="2.6" stroke="var(--accent-sky)" />
    <text x="20" y="18" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 23,28 H 40 l 3,-5 l 5,10 l 5,-10 l 5,10 l 5,-10 l 3,5 H 80 a 5,6 0 0 1 10,0 a 5,6 0 0 1 10,0 a 5,6 0 0 1 10,0 H 178" />
    <text x="53" y="16" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <text x="95" y="15" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">L</text>
    <circle cx="138" cy="28" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 138,28 V 45 M 128,45 H 148 M 128,51 H 148 M 138,51 V 67" />
    <text x="154" y="51" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <path d="M 138,67 V 72 M 129,72 H 147 M 132.5,75.5 H 143.5 M 135.5,79 H 140.5" />
    <text x="138" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="181" cy="28" r="2.6" stroke="var(--accent-emerald)" />
    <text x="181" y="18" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  highpass_cr: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch lọc thông cao CR">
    <circle cx="24" cy="28" r="2.6" stroke="var(--accent-sky)" />
    <text x="24" y="18" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 27,28 H 68 M 68,18 V 38 M 74,18 V 38 M 74,28 H 174" />
    <text x="71" y="13" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <circle cx="126" cy="28" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 126,28 V 37 l 5,3 l -10,5 l 10,5 l -10,5 l 10,5 l -5,3 V 67" />
    <text x="141" y="53" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <path d="M 126,67 V 72 M 117,72 H 135 M 120.5,75.5 H 131.5 M 123.5,79 H 128.5" />
    <text x="126" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="177" cy="28" r="2.6" stroke="var(--accent-emerald)" />
    <text x="177" y="18" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  highpass_rlc: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch lọc thông cao RLC">
    <circle cx="20" cy="28" r="2.6" stroke="var(--accent-sky)" />
    <text x="20" y="18" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 23,28 H 48 M 48,18 V 38 M 54,18 V 38 M 54,28 H 72 l 3,-5 l 5,10 l 5,-10 l 5,10 l 5,-10 l 3,5 H 178" />
    <text x="51" y="13" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <text x="85" y="16" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="134" cy="28" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 134,28 V 36 a 6,4.5 0 0 1 0,9 a 6,4.5 0 0 1 0,9 a 6,4.5 0 0 1 0,9 V 67" />
    <text x="148" y="52" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">L</text>
    <path d="M 134,67 V 72 M 125,72 H 143 M 128.5,75.5 H 139.5 M 131.5,79 H 136.5" />
    <text x="134" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="181" cy="28" r="2.6" stroke="var(--accent-emerald)" />
    <text x="181" y="18" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  bandpass: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch cộng hưởng thông dải RLC">
    <circle cx="20" cy="28" r="2.6" stroke="var(--accent-sky)" />
    <text x="20" y="18" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 23,28 H 38 a 5,6 0 0 1 10,0 a 5,6 0 0 1 10,0 a 5,6 0 0 1 10,0 H 86 M 86,18 V 38 M 92,18 V 38 M 92,28 H 178" />
    <text x="53" y="15" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">L</text>
    <text x="89" y="13" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <circle cx="134" cy="28" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 134,28 V 37 l 5,3 l -10,5 l 10,5 l -10,5 l 10,5 l -5,3 V 67" />
    <text x="149" y="53" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <path d="M 134,67 V 72 M 125,72 H 143 M 128.5,75.5 H 139.5 M 131.5,79 H 136.5" />
    <text x="134" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="181" cy="28" r="2.6" stroke="var(--accent-emerald)" />
    <text x="181" y="18" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  notch: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch chắn dải bẫy cộng hưởng LC nối tiếp">
    <circle cx="22" cy="24" r="2.6" stroke="var(--accent-sky)" />
    <text x="22" y="14" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 25,24 H 46 l 3,-5 l 5,10 l 5,-10 l 5,10 l 5,-10 l 3,5 H 178" />
    <text x="59" y="13" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="122" cy="24" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 122,24 V 31 a 5,3.5 0 0 1 0,7 a 5,3.5 0 0 1 0,7 a 5,3.5 0 0 1 0,7 V 58 M 113,58 H 131 M 113,63 H 131 M 122,63 V 70" />
    <text x="135" y="44" fill="currentColor" stroke="none" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">L</text>
    <text x="136" y="64" fill="currentColor" stroke="none" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <path d="M 122,70 V 74 M 114,74 H 130 M 117,77.5 H 127 M 119.5,81 H 124.5" />
    <text x="122" y="90" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="181" cy="24" r="2.6" stroke="var(--accent-emerald)" />
    <text x="181" y="14" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  allpass: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch dịch pha All-Pass Op-Amp">
    <circle cx="16" cy="48" r="2.5" stroke="var(--accent-sky)" />
    <text x="16" y="38" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 19,48 H 32 M 32,32 V 58" />
    <circle cx="32" cy="48" r="2.2" fill="currentColor" stroke="none" />
    <path d="M 32,32 H 42 l 2.5,-4 l 4,8 l 4,-8 l 4,8 l 4,-8 l 2.5,4 H 86 V 40 H 106" />
    <text x="54.5" y="24" fill="currentColor" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="86" cy="32" r="2.2" fill="currentColor" stroke="none" />
    <path d="M 86,32 V 17 H 112 l 2.5,-3.5 l 4,7 l 4,-7 l 4,7 l 4,-7 l 2.5,3.5 H 162 V 48" />
    <text x="124.5" y="10" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <path d="M 32,58 H 48 M 48,50 V 66 M 53,50 V 66 M 53,58 H 106" />
    <text x="50.5" y="47" fill="currentColor" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <circle cx="76" cy="58" r="2.2" fill="currentColor" stroke="none" />
    <path d="M 76,58 V 62 l 3.5,2 l -7,3 l 7,3 l -7,3 l 7,3 l -3.5,2 V 81 M 69,81 H 83 M 72,84 H 80 M 74.5,87 H 77.5" />
    <text x="86" y="74" fill="currentColor" stroke="none" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <path d="M 106,32 V 64 L 146,48 Z" stroke="var(--accent-sky)" />
    <text x="112" y="43" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">−</text>
    <text x="112" y="60" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">+</text>
    <path d="M 146,48 H 180" />
    <circle cx="162" cy="48" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="183" cy="48" r="2.5" stroke="var(--accent-emerald)" />
    <text x="183" y="38" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  fir_tapped: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch dây trễ FIR Tapped Delay Line">
    <text x="18" y="19" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">x[n]</text>
    <path d="M 10,26 H 50 M 46,23.5 L 50,26 L 46,28.5 M 82,26 H 112 M 108,23.5 L 112,26 L 108,28.5 M 144,26 H 162" />
    <rect x="50" y="16" width="32" height="20" rx="4" stroke="var(--accent-sky)" />
    <text x="66" y="29.5" fill="currentColor" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">z⁻¹</text>
    <rect x="112" y="16" width="32" height="20" rx="4" stroke="var(--accent-sky)" />
    <text x="128" y="29.5" fill="currentColor" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">z⁻¹</text>
    <circle cx="32" cy="26" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="96" cy="26" r="2.2" fill="currentColor" stroke="none" />
    <path d="M 32,26 V 42 M 26,42 H 38 L 32,53 Z M 32,53 V 70 H 87 M 83,67.5 L 87,70 L 83,72.5" />
    <path d="M 96,26 V 42 M 90,42 H 102 L 96,53 Z M 96,53 V 61 M 93.5,57 L 96,61 L 98.5,57" />
    <path d="M 162,26 V 42 M 156,42 H 168 L 162,53 Z M 162,53 V 61 M 159.5,57 L 162,61 L 164.5,57" />
    <text x="43" y="50" fill="var(--text-muted)" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">b₀</text>
    <text x="107" y="50" fill="var(--text-muted)" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">b₁</text>
    <text x="173" y="50" fill="var(--text-muted)" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">b₂</text>
    <circle cx="96" cy="70" r="8.5" stroke="var(--accent-emerald)" />
    <text x="96" y="73.5" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="10.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Σ</text>
    <path d="M 104.5,70 H 153.5 M 149.5,67.5 L 153.5,70 L 149.5,72.5" stroke="var(--accent-emerald)" />
    <circle cx="162" cy="70" r="8.5" stroke="var(--accent-emerald)" />
    <text x="162" y="73.5" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="10.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Σ</text>
    <path d="M 170.5,70 H 196 M 192,67.5 L 196,70 L 192,72.5" stroke="var(--accent-emerald)" />
    <text x="191" y="61" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">y[n]</text>
  </svg>`,

  integrator: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch tích phân Op-Amp đảo pha">
    <circle cx="18" cy="39" r="2.5" stroke="var(--accent-sky)" />
    <text x="18" y="30" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 21,39 H 38 l 3,-5 l 5,10 l 5,-10 l 5,10 l 5,-10 l 3,5 H 100" />
    <text x="51" y="28" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="82" cy="39" r="2.2" fill="currentColor" stroke="none" />
    <path d="M 82,39 V 18 H 116 M 116,10 V 26 M 122,10 V 26 M 122,18 H 160 V 47" />
    <text x="133" y="14" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <path d="M 100,31 V 63 L 142,47 Z" stroke="var(--accent-sky)" />
    <text x="106" y="42" fill="currentColor" stroke="none" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">−</text>
    <text x="106" y="59" fill="currentColor" stroke="none" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">+</text>
    <path d="M 100,56 H 82 V 71 M 74,71 H 90 M 77,74.5 H 87 M 79.5,78 H 84.5" />
    <text x="82" y="88" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <path d="M 142,47 H 180" />
    <circle cx="160" cy="47" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="183" cy="47" r="2.5" stroke="var(--accent-emerald)" />
    <text x="183" y="38" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  lc_osc: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch cộng hưởng LC lý tưởng không suy hao">
    <circle cx="22" cy="28" r="2.6" stroke="var(--accent-sky)" />
    <text x="22" y="18" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 25,28 H 56 a 6,6 0 0 1 12,0 a 6,6 0 0 1 12,0 a 6,6 0 0 1 12,0 a 6,6 0 0 1 12,0 H 178" />
    <text x="80" y="15" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">L</text>
    <circle cx="134" cy="28" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 134,28 V 45 M 124,45 H 144 M 124,51 H 144 M 134,51 V 67" />
    <text x="150" y="51" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <text x="68" y="64" fill="var(--accent-amber)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">R = 0 (Lý tưởng)</text>
    <path d="M 134,67 V 72 M 125,72 H 143 M 128.5,75.5 H 139.5 M 131.5,79 H 136.5" />
    <text x="134" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="181" cy="28" r="2.6" stroke="var(--accent-emerald)" />
    <text x="181" y="18" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  unstable: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch hồi tiếp dương không ổn định">
    <circle cx="18" cy="34" r="2.5" stroke="var(--accent-sky)" />
    <text x="18" y="24" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 21,34 H 46 M 42,31 L 46,34 L 42,37" />
    <circle cx="56" cy="34" r="9.5" stroke="var(--accent-rose)" />
    <text x="56" y="38" fill="var(--accent-rose)" stroke="none" text-anchor="middle" font-size="10.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Σ</text>
    <text x="41" y="28" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">+</text>
    <text x="64" y="53" fill="var(--accent-rose)" stroke="none" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">+</text>
    <path d="M 66,34 H 88" />
    <rect x="88" y="21" width="44" height="26" rx="5" stroke="var(--accent-rose)" />
    <text x="110" y="37" fill="var(--accent-rose)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">A &gt; 1</text>
    <path d="M 132,34 H 180" />
    <circle cx="156" cy="34" r="2.3" fill="var(--accent-rose)" stroke="none" />
    <path d="M 156,34 V 67 H 56 V 44 M 53,48 L 56,44 L 59,48" stroke="var(--accent-rose)" />
    <text x="106" y="82" fill="var(--accent-rose)" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Hồi tiếp dương (R_eff &lt; 0)</text>
    <circle cx="183" cy="34" r="2.5" stroke="var(--accent-emerald)" />
    <text x="183" y="24" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  gain: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch khuếch đại hoặc suy hao thuần">
    <circle cx="24" cy="42" r="2.6" stroke="var(--accent-sky)" />
    <text x="24" y="32" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 27,42 H 78" />
    <path d="M 78,22 V 62 L 132,42 Z" stroke="var(--accent-sky)" />
    <text x="97" y="46" fill="currentColor" stroke="none" text-anchor="middle" font-size="13" font-weight="700" font-family="ui-monospace, Consolas, monospace">K</text>
    <path d="M 132,42 H 178" />
    <circle cx="181" cy="42" r="2.6" stroke="var(--accent-emerald)" />
    <text x="181" y="32" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
    <text x="105" y="80" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="600" font-family="ui-monospace, Consolas, monospace">y[n] = K · x[n]</text>
  </svg>`,

  biquad_general: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch Biquad ghép tầng tổng quát">
    <circle cx="16" cy="46" r="2.5" stroke="var(--accent-sky)" />
    <text x="16" y="36" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 19,46 H 36" />
    <rect x="36" y="24" width="58" height="44" rx="6" stroke="var(--accent-sky)" />
    <text x="65" y="43" fill="currentColor" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Biquad 1</text>
    <text x="65" y="57" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">H₁(s) / RLC</text>
    <path d="M 94,46 H 114 M 110,43 L 114,46 L 110,49" />
    <rect x="114" y="24" width="58" height="44" rx="6" stroke="var(--accent-sky)" />
    <text x="143" y="43" fill="currentColor" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Biquad 2</text>
    <text x="143" y="57" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">H₂(s) / RLC</text>
    <path d="M 172,46 H 190" />
    <circle cx="193" cy="46" r="2.5" stroke="var(--accent-emerald)" />
    <text x="191" y="36" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  lowpass_rl: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch lọc thông thấp RL">
    <circle cx="24" cy="28" r="2.6" stroke="var(--accent-sky)" />
    <text x="24" y="18" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 27,28 H 54 a 5.5,6 0 0 1 11,0 a 5.5,6 0 0 1 11,0 a 5.5,6 0 0 1 11,0 a 5.5,6 0 0 1 11,0 H 174" />
    <text x="76" y="15" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">L</text>
    <circle cx="126" cy="28" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 126,28 V 37 l 5,3 l -10,5 l 10,5 l -10,5 l 10,5 l -5,3 V 67" />
    <text x="141" y="53" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <path d="M 126,67 V 72 M 117,72 H 135 M 120.5,75.5 H 131.5 M 123.5,79 H 128.5" />
    <text x="126" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="177" cy="28" r="2.6" stroke="var(--accent-emerald)" />
    <text x="177" y="18" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  lowpass_sallen_key: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch lọc thông thấp Sallen-Key Op-Amp">
    <circle cx="14" cy="43" r="2.4" stroke="var(--accent-sky)" />
    <text x="14" y="34" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 17,43 H 25 l 2,-4 l 4,8 l 4,-8 l 4,8 l 4,-8 l 2,4 H 64 l 2,-4 l 4,8 l 4,-8 l 4,8 l 4,-8 l 2,4 H 108" />
    <text x="35" y="33" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R₁</text>
    <text x="74" y="33" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R₂</text>
    <circle cx="54" cy="43" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 54,43 V 16 H 96 M 96,9 V 23 M 101,9 V 23 M 101,16 H 164 V 49" />
    <text x="98.5" y="7" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">C₁</text>
    <circle cx="94" cy="43" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 94,43 V 57 M 86,57 H 102 M 86,62 H 102 M 94,62 V 76 M 87,76 H 101 M 90,79 H 98 M 92.5,82 H 95.5" />
    <text x="79" y="63" fill="currentColor" stroke="none" text-anchor="end" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">C₂</text>
    <path d="M 108,34 V 64 L 146,49 Z" stroke="var(--accent-sky)" />
    <text x="114" y="46" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">+</text>
    <text x="114" y="59" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">−</text>
    <path d="M 146,49 H 184" />
    <circle cx="164" cy="49" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 164,49 V 76 H 104 V 56 H 108" stroke="var(--text-muted)" />
    <circle cx="187" cy="49" r="2.4" stroke="var(--accent-emerald)" />
    <text x="187" y="39" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  highpass_rl: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch lọc thông cao RL">
    <circle cx="24" cy="28" r="2.6" stroke="var(--accent-sky)" />
    <text x="24" y="18" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 27,28 H 58 l 3,-5 l 5,10 l 5,-10 l 5,10 l 5,-10 l 3,5 H 174" />
    <text x="71" y="16" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="126" cy="28" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 126,28 V 36 a 6,4.5 0 0 1 0,9 a 6,4.5 0 0 1 0,9 a 6,4.5 0 0 1 0,9 V 67" />
    <text x="140" y="52" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">L</text>
    <path d="M 126,67 V 72 M 117,72 H 135 M 120.5,75.5 H 131.5 M 123.5,79 H 128.5" />
    <text x="126" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="177" cy="28" r="2.6" stroke="var(--accent-emerald)" />
    <text x="177" y="18" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  highpass_sallen_key: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch lọc thông cao Sallen-Key Op-Amp">
    <circle cx="14" cy="43" r="2.4" stroke="var(--accent-sky)" />
    <text x="14" y="34" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 17,43 H 32 M 32,35 V 51 M 37,35 V 51 M 37,43 H 68 M 68,35 V 51 M 73,35 V 51 M 73,43 H 108" />
    <text x="34.5" y="31" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">C₁</text>
    <text x="70.5" y="31" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">C₂</text>
    <circle cx="52" cy="43" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 52,43 V 16 H 88 l 2.5,-4 l 4,8 l 4,-8 l 4,8 l 4,-8 l 2.5,4 H 164 V 49" />
    <text x="100" y="9" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R₁</text>
    <circle cx="94" cy="43" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 94,43 V 50 l 3.5,2 l -7,3.5 l 7,3.5 l -7,3.5 l 7,3.5 l -3.5,2 V 76 M 87,76 H 101 M 90,79 H 98 M 92.5,82 H 95.5" />
    <text x="82" y="64" fill="currentColor" stroke="none" text-anchor="end" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R₂</text>
    <path d="M 108,34 V 64 L 146,49 Z" stroke="var(--accent-sky)" />
    <text x="114" y="46" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">+</text>
    <text x="114" y="59" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">−</text>
    <path d="M 146,49 H 184" />
    <circle cx="164" cy="49" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 164,49 V 76 H 104 V 56 H 108" stroke="var(--text-muted)" />
    <circle cx="187" cy="49" r="2.4" stroke="var(--accent-emerald)" />
    <text x="187" y="39" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  bandpass_parallel: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch cộng hưởng thông dải RLC song song">
    <circle cx="20" cy="26" r="2.6" stroke="var(--accent-sky)" />
    <text x="20" y="16" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 23,26 H 42 l 3,-5 l 5,10 l 5,-10 l 5,10 l 5,-10 l 3,5 H 178" />
    <text x="55" y="14" fill="currentColor" stroke="none" text-anchor="middle" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="122" cy="26" r="2.4" fill="currentColor" stroke="none" />
    <path d="M 102,26 H 142 M 102,26 V 34 a 5.5,4.2 0 0 1 0,8.4 a 5.5,4.2 0 0 1 0,8.4 a 5.5,4.2 0 0 1 0,8.4 V 66 H 142" />
    <text x="90" y="49" fill="currentColor" stroke="none" text-anchor="end" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">L</text>
    <path d="M 142,26 V 43 M 133,43 H 151 M 133,49 H 151 M 142,49 V 66" />
    <text x="157" y="49" fill="currentColor" stroke="none" font-size="10" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <circle cx="122" cy="66" r="2.2" fill="currentColor" stroke="none" />
    <path d="M 122,66 V 72 M 113,72 H 131 M 116.5,75.5 H 127.5 M 119.5,79 H 124.5" />
    <text x="122" y="89" fill="var(--text-muted)" stroke="none" text-anchor="middle" font-size="8.5" font-family="ui-monospace, Consolas, monospace">GND</text>
    <circle cx="181" cy="26" r="2.6" stroke="var(--accent-emerald)" />
    <text x="181" y="16" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  notch_twin_t: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch cầu Twin-T Notch RC">
    <circle cx="14" cy="40" r="2.4" stroke="var(--accent-sky)" />
    <text x="14" y="30" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 17,40 H 28 M 28,18 V 62" />
    <circle cx="28" cy="40" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 28,18 H 42 l 2,-4 l 4,8 l 4,-8 l 4,8 l 4,-8 l 2,4 H 118 l 2,-4 l 4,8 l 4,-8 l 4,8 l 4,-8 l 2,4 H 170 V 62" />
    <text x="52" y="10" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <text x="128" y="10" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="88" cy="18" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 88,18 V 32 M 80,32 H 96 M 80,37 H 96 M 88,37 V 46 M 82,46 H 94 M 84.5,48.5 H 91.5" />
    <text x="100" y="37" fill="currentColor" stroke="none" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">2C</text>
    <path d="M 28,62 H 58 M 58,55 V 69 M 63,55 V 69 M 63,62 H 134 M 134,55 V 69 M 139,55 V 69 M 139,62 H 170" />
    <text x="60.5" y="52" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <text x="136.5" y="52" fill="currentColor" stroke="none" text-anchor="middle" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <circle cx="104" cy="62" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 104,62 V 66 l 3,1.8 l -6,3 l 6,3 l -6,3 l 3,1.8 V 84 M 98,84 H 110 M 100.5,87 H 107.5" />
    <text x="114" y="77" fill="currentColor" stroke="none" font-size="8.5" font-weight="700" font-family="ui-monospace, Consolas, monospace">R/2</text>
    <circle cx="170" cy="40" r="2.1" fill="currentColor" stroke="none" />
    <path d="M 170,40 H 188" />
    <circle cx="191" cy="40" r="2.4" stroke="var(--accent-emerald)" />
    <text x="191" y="30" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`,

  allpass_lattice: `<svg class="w-full h-full" viewBox="0 0 210 92" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Mạch cầu Lattice đối xứng All-Pass">
    <circle cx="18" cy="22" r="2.4" stroke="var(--accent-sky)" />
    <circle cx="18" cy="70" r="2.4" stroke="var(--accent-sky)" />
    <text x="18" y="49" fill="var(--accent-sky)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vin</text>
    <path d="M 21,22 H 76 l 3,-4.5 l 4.5,9 l 4.5,-9 l 4.5,9 l 4.5,-9 l 3,4.5 H 184" />
    <text x="90" y="12" fill="currentColor" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <path d="M 21,70 H 76 l 3,-4.5 l 4.5,9 l 4.5,-9 l 4.5,9 l 4.5,-9 l 3,4.5 H 184" />
    <text x="90" y="86" fill="currentColor" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">R</text>
    <circle cx="44" cy="22" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="44" cy="70" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="156" cy="22" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="156" cy="70" r="2.2" fill="currentColor" stroke="none" />
    <path d="M 44,22 L 73,34.4 M 69.5,41 L 76.5,27.8 M 74,43 L 81,29.8 M 77.5,36.4 L 156,70" />
    <text x="64" y="45" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <path d="M 44,70 L 96,47.7 a 4.5,4.5 0 0 1 8,-3.4 L 122.5,36.4 M 119,29.8 L 126,43 M 123.5,27.8 L 130.5,41 M 127,34.4 L 156,22" />
    <text x="132" y="48" fill="currentColor" stroke="none" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">C</text>
    <circle cx="187" cy="22" r="2.4" stroke="var(--accent-emerald)" />
    <circle cx="187" cy="70" r="2.4" stroke="var(--accent-emerald)" />
    <text x="187" y="49" fill="var(--accent-emerald)" stroke="none" text-anchor="middle" font-size="9" font-weight="700" font-family="ui-monospace, Consolas, monospace">Vout</text>
  </svg>`
};

function escapeHtmlText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setBadgeWithIcon(el, className, iconSvg, text) {
  if (!el) return;
  el.className = className;
  el.innerHTML = `${iconSvg}<span>${escapeHtmlText(text)}</span>`;
}

/* ==================== THEME & LATEX ==================== */

window.setAppTheme = function (theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  const darkBtn = document.getElementById('themeDarkBtn');
  const lightBtn = document.getElementById('themeLightBtn');
  if (darkBtn && lightBtn) {
    if (theme === 'dark') {
      darkBtn.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md studio-pill-active transition';
      lightBtn.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md studio-pill-idle transition';
    } else {
      lightBtn.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md studio-pill-active transition';
      darkBtn.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md studio-pill-idle transition';
    }
  }
  updateAllFormulasAndTables();
  requestRedraw();
};

function renderLatexToElement(elOrId, latexStr, displayMode = false) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;
  if (window.katex) {
    window.katex.render(latexStr, el, {
      throwOnError: false,
      displayMode
    });
  } else {
    el.textContent = latexStr;
  }
}

function renderStaticPageMath() {
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  }
}

/* ==================== Z-PLANE VIEW & COEFFICIENTS SYNC ==================== */

function autoFitZPlaneRange() {
  let maxCoord = 1.05;
  state.zeros.forEach(z => {
    maxCoord = Math.max(maxCoord, Math.abs(z.re), Math.abs(z.im), z.abs());
  });
  state.poles.forEach(p => {
    maxCoord = Math.max(maxCoord, Math.abs(p.re), Math.abs(p.im), p.abs());
  });
  state.zViewRange = Math.max(1.42, Math.min(5.0, maxCoord * 1.28));
}

window.resetZPlaneView = function () {
  autoFitZPlaneRange();
  state.view3dYaw = 0.65;
  state.view3dPitch = 0.56;
  requestRedraw();
};

function triggerZPlaneRecalcFlash() {
  const card = document.getElementById('zPlaneCard');
  if (!card) return;
  card.classList.remove('recalc-flash');
  void card.offsetWidth;
  card.classList.add('recalc-flash');
}

function coeffsToExprString(bCoeffs, aCoeffs) {
  const polyStr = arr => {
    const parts = [];
    for (let i = 0; i < arr.length; i++) {
      const c = Number(arr[i].toFixed(4));
      if (Math.abs(c) < 1e-5 && arr.length > 1) continue;
      const sign = c < 0 ? ' - ' : parts.length > 0 ? ' + ' : '';
      const absC = Math.abs(c);
      const numPart = i === 0 || Math.abs(absC - 1) > 1e-4 ? absC : '';
      const zPart = i === 0 ? '' : i === 1 ? 'z^-1' : `z^-${i}`;
      const sep = numPart !== '' && zPart !== '' ? '*' : '';
      parts.push(`${sign}${numPart}${sep}${zPart}`);
    }
    return parts.length ? parts.join('').trim() : '0';
  };

  const numS = polyStr(bCoeffs);
  const denS = polyStr(aCoeffs);
  if (aCoeffs.length <= 1 && Math.abs(aCoeffs[0] - 1) < 1e-4) {
    return numS;
  }
  return `(${numS}) / (${denS})`;
}

function syncCoeffsFromRoots(updateCoeffsBoxes = true, updateFormulaInputBox = false) {
  const rawB = rootsToPoly(state.zeros);
  const delayZeros = new Array(Math.max(0, state.delay)).fill(0);
  state.bCoeffs = [...delayZeros, ...rawB.map(c => c * state.gain)];
  state.aCoeffs = rootsToPoly(state.poles);

  if (updateCoeffsBoxes) {
    const numEl = document.getElementById('numCoeffsInput');
    const denEl = document.getElementById('denCoeffsInput');
    const gainEl = document.getElementById('gainInput');

    if (numEl) numEl.value = state.bCoeffs.map(v => Number(v.toFixed(4))).join(', ');
    if (denEl) denEl.value = state.aCoeffs.map(v => Number(v.toFixed(4))).join(', ');
    if (gainEl) gainEl.value = Number(state.gain.toFixed(4));
  }
  if (updateFormulaInputBox) {
    const exprEl = document.getElementById('hzFormulaInput');
    if (exprEl) exprEl.value = coeffsToExprString(state.bCoeffs, state.aCoeffs);
  }
  updateAllFormulasAndTables();
}

window.syncFormulaBoxFromDraggedZPlane = function () {
  const exprEl = document.getElementById('hzFormulaInput');
  if (exprEl) {
    exprEl.value = coeffsToExprString(state.bCoeffs, state.aCoeffs);
  }
  const feedbackEl = document.getElementById('exprFeedbackBadge');
  setBadgeWithIcon(
    feedbackEl,
    'inline-flex items-center gap-1 text-[11px] font-medium theme-emerald',
    UI_ICONS.checkCircle,
    'Đã đồng bộ biểu thức H(z) từ đồ thị hiện tại'
  );
};

window.evaluateSymbolicHzInput = function (customExpr) {
  const exprEl = document.getElementById('hzFormulaInput');
  const raw = customExpr !== undefined ? customExpr : exprEl.value;
  if (customExpr !== undefined && exprEl) {
    exprEl.value = customExpr;
  }

  const feedbackEl = document.getElementById('exprFeedbackBadge');
  try {
    pushUndoHistory();
    const { bCoeffs, aCoeffs } = parseTransferFunctionString(raw);
    const delay = getLeadingZeroCount(bCoeffs);
    const firstNonZeroB = bCoeffs.find(v => Math.abs(v) > 1e-10) ?? 1;
    state.delay = delay;
    state.gain = firstNonZeroB;
    state.zeros = findPolynomialRoots(bCoeffs);
    state.poles = findPolynomialRoots(aCoeffs);
    state.bCoeffs = bCoeffs;
    state.aCoeffs = aCoeffs;
    state.editingRoot = null;

    autoFitZPlaneRange();
    triggerZPlaneRecalcFlash();
    markCustomSystemMode();

    document.getElementById('numCoeffsInput').value = bCoeffs.map(v => Number(v.toFixed(4))).join(', ');
    document.getElementById('denCoeffsInput').value = aCoeffs.map(v => Number(v.toFixed(4))).join(', ');
    document.getElementById('gainInput').value = Number(state.gain.toFixed(4));

    setBadgeWithIcon(
      feedbackEl,
      'inline-flex items-center gap-1 text-[11px] font-medium theme-emerald',
      UI_ICONS.checkCircle,
      `Đã tính lại & vẽ Mặt phẳng phức: ${state.zeros.length} Zero, ${state.poles.length} Cực`
    );
    updateAllFormulasAndTables();
    requestRedraw();
  } catch (err) {
    state.undoStack.pop();
    updateUndoRedoButtons();
    setBadgeWithIcon(
      feedbackEl,
      'inline-flex items-center gap-1 text-[11px] font-medium theme-rose',
      UI_ICONS.xCircle,
      `Lỗi: ${err.message}`
    );
  }
};

window.applyCoefficientsFromInput = function () {
  const numStr = document.getElementById('numCoeffsInput').value.trim();
  const denStr = document.getElementById('denCoeffsInput').value.trim();

  const parseArr = str =>
    str
      .split(/[\s,]+/)
      .map(s => parseFloat(s))
      .filter(v => !Number.isNaN(v));

  let b = parseArr(numStr);
  let a = parseArr(denStr);
  if (b.length === 0) b = [1];
  if (a.length === 0) a = [1];

  const a0 = Math.abs(a[0]) < 1e-12 ? 1 : a[0];
  b = b.map(v => v / a0);
  a = a.map(v => v / a0);

  pushUndoHistory();
  state.delay = getLeadingZeroCount(b);
  const firstNonZeroB = b.find(v => Math.abs(v) > 1e-12) ?? 1;
  state.gain = firstNonZeroB;
  document.getElementById('gainInput').value = Number(state.gain.toFixed(4));

  state.zeros = findPolynomialRoots(b);
  state.poles = findPolynomialRoots(a);
  state.bCoeffs = b;
  state.aCoeffs = a;
  state.editingRoot = null;

  autoFitZPlaneRange();
  triggerZPlaneRecalcFlash();
  markCustomSystemMode();

  const exprEl = document.getElementById('hzFormulaInput');
  if (exprEl) exprEl.value = coeffsToExprString(b, a);

  const feedbackEl = document.getElementById('exprFeedbackBadge');
  setBadgeWithIcon(
    feedbackEl,
    'inline-flex items-center gap-1 text-[11px] font-medium theme-emerald',
    UI_ICONS.checkCircle,
    `Đã nạp từ mảng hệ số: ${state.zeros.length} Zero, ${state.poles.length} Cực`
  );

  updateAllFormulasAndTables();
  requestRedraw();
};

/* ==================== ANALYTICAL OUTPUT & TABLES ==================== */

function updateAllFormulasAndTables() {
  const rocInfo = analyzeRocAndStability(state.poles, state.rocType);
  const { rMax, rocLatex, isStable, poleOnUnitCircle } = rocInfo;

  // 1. Stability Badge (Dual-theme contrast safe)
  const badge = document.getElementById('stabilityBadge');
  if (badge) {
    if (poleOnUnitCircle) {
      setBadgeWithIcon(
        badge,
        'inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-amber-500/15 theme-amber border border-amber-500/40',
        UI_ICONS.alertCircle,
        'Biên giới ổn định (Cực nằm trên |z| = 1)'
      );
    } else if (isStable) {
      setBadgeWithIcon(
        badge,
        'inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-emerald-500/15 theme-emerald border border-emerald-500/40',
        UI_ICONS.checkCircle,
        'Hệ thống Ổn định BIBO (ROC chứa |z| = 1)'
      );
    } else {
      setBadgeWithIcon(
        badge,
        'inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-rose-500/15 theme-rose border border-rose-500/40',
        UI_ICONS.alertTriangle,
        'Hệ thống Không ổn định (ROC không chứa |z| = 1)'
      );
    }
  }

  // 2. Top Metrics Cards
  renderLatexToElement('rocSummaryLatex', rocLatex, false);
  renderLatexToElement('maxPoleRadiusLatex', `r_{\\max} = ${rMax.toFixed(3)}`, false);

  // 3. Rational H(z)
  const numPolyZ = buildPolynomialLatex(state.bCoeffs, 'z');
  const denPolyZ = buildPolynomialLatex(state.aCoeffs, 'z');
  const hzRationalLatex =
    state.aCoeffs.length <= 1 && Math.abs(state.aCoeffs[0] - 1) < 1e-4
      ? `H(z) = ${numPolyZ}`
      : `H(z) = \\frac{B(z)}{A(z)} = \\frac{${numPolyZ}}{${denPolyZ}}`;
  renderLatexToElement('latexHzRational', hzRationalLatex, true);

  // 4. Factored Pole-Zero H(z)
  const hzFactoredLatex = buildFactoredLatex(state.zeros, state.poles, state.gain, state.delay);
  renderLatexToElement('latexHzFactored', hzFactoredLatex, true);

  // 5. H(e^{jw})
  const numPolyW = buildPolynomialLatex(state.bCoeffs, 'w');
  const denPolyW = buildPolynomialLatex(state.aCoeffs, 'w');
  const hejwLatex =
    state.aCoeffs.length <= 1 && Math.abs(state.aCoeffs[0] - 1) < 1e-4
      ? `H\\left(e^{j\\omega}\\right) = ${numPolyW}`
      : `H\\left(e^{j\\omega}\\right) = \\frac{${numPolyW}}{${denPolyW}}`;
  renderLatexToElement('latexHejw', hejwLatex, true);

  // 6. Analytical Impulse Response h[n]
  const hnLatex = buildAnalyticalHnLatex(state.bCoeffs, state.aCoeffs, state.poles, state.rocType);
  renderLatexToElement('latexAnalyticalHn', hnLatex, true);

  // 7. Difference Equation y[n]
  const diffEqLatex = buildDifferenceEquationLatex(state.bCoeffs, state.aCoeffs);
  renderLatexToElement('latexDiffEq', diffEqLatex, true);

  // 8. ROC & Stability Conclusion Statement
  const stabilityImplication = isStable
    ? '\\implies \\text{Chứa } |z|=1 \\; (\\text{Ổn định BIBO})'
    : '\\implies \\text{Không chứa } |z|=1 \\; (\\text{Không ổn định})';
  renderLatexToElement(
    'latexRocStatement',
    `\\text{ROC: } ${rocLatex} \\quad ${stabilityImplication}`,
    false
  );

  // 9. Editable Root Coordinate Tables
  renderRootListTables();

  // 10. Smart Auto-Diagnosis & Explanation
  const diag = buildSystemExplanation(
    state.bCoeffs,
    state.aCoeffs,
    state.zeros,
    state.poles,
    state.rocType,
    state.fsHz
  );
  const diagTitleEl = document.getElementById('systemDiagnosisTitle');
  if (diagTitleEl) diagTitleEl.textContent = diag.title;
  const diagListEl = document.getElementById('systemDiagnosisBullets');
  if (diagListEl) {
    diagListEl.innerHTML = diag.bullets.map(b => `<li>${b}</li>`).join('');
  }
  const diagConcEl = document.getElementById('systemConclusionBox');
  if (diagConcEl) {
    diagConcEl.innerHTML =
      `<div><span class="inline-flex items-center gap-1 font-extrabold theme-sky align-middle">${UI_ICONS.bookmark}<span>Kết luận:</span></span> ${diag.conclusion}</div>` +
      `<div class="mt-1"><span class="inline-flex items-center gap-1 font-extrabold theme-emerald align-middle">${UI_ICONS.target}<span>Ứng dụng thực tế:</span></span> ${diag.application}</div>`;
  }

  // 11. Equivalent Analog Circuit & Generalized Formula (with dual-circuit card tabs)
  const circuitBoxEl = document.getElementById('systemCircuitBox');
  if (circuitBoxEl) {
    if (diag.circuit) {
      circuitBoxEl.classList.remove('hidden');
      const variants =
        Array.isArray(diag.circuit.variants) && diag.circuit.variants.length > 0
          ? diag.circuit.variants
          : [diag.circuit];
      const circuitKey = variants.map(v => v.topology).join('|');
      if (state.lastCircuitKey !== circuitKey) {
        state.lastCircuitKey = circuitKey;
        state.circuitVariantIdx = 0;
      }
      if (state.circuitVariantIdx >= variants.length) state.circuitVariantIdx = 0;
      state.currentCircuitVariants = variants;
      renderActiveCircuitVariant();
    } else {
      circuitBoxEl.classList.add('hidden');
    }
  }
}

function renderActiveCircuitVariant() {
  const variants = state.currentCircuitVariants || [];
  if (variants.length === 0) return;
  const idx = Math.min(state.circuitVariantIdx || 0, variants.length - 1);
  const active = variants[idx];

  const tabsEl = document.getElementById('circuitVariantTabs');
  const nameEl = document.getElementById('circuitNameText');
  const svgSlot = document.getElementById('circuitSvgSlot');
  const captionEl = document.getElementById('circuitSvgCaption');
  const noteEl = document.getElementById('circuitNoteText');

  if (tabsEl) {
    if (variants.length > 1) {
      tabsEl.classList.remove('hidden');
      tabsEl.innerHTML = variants
        .map((v, i) => {
          const isSel = i === idx;
          const cls = isSel
            ? 'px-2.5 py-0.5 rounded-md font-bold bg-sky-600 text-white shadow-sm transition cursor-pointer'
            : 'px-2.5 py-0.5 rounded-md font-medium theme-muted hover:text-sky-400 transition cursor-pointer';
          const label = v.shortLabel || `Mạch ${i + 1}`;
          return `<button type="button" role="tab" aria-selected="${isSel}" onclick="selectCircuitVariant(${i})" class="${cls}">${i + 1}. ${label}</button>`;
        })
        .join('');
      if (nameEl) nameEl.classList.add('hidden');
    } else {
      tabsEl.classList.add('hidden');
      tabsEl.innerHTML = '';
      if (nameEl) {
        nameEl.classList.remove('hidden');
        nameEl.textContent = active.name || '';
      }
    }
  } else if (nameEl) {
    nameEl.textContent = active.name || '';
  }

  if (svgSlot) {
    svgSlot.innerHTML = CIRCUIT_SVGS[active.topology] || CIRCUIT_SVGS.biquad_general;
  }
  if (captionEl) {
    captionEl.textContent = active.name || '';
  }
  if (active.formulaLatex) {
    renderLatexToElement('circuitFormulaLatex', active.formulaLatex, true);
  }
  if (noteEl) {
    noteEl.textContent = active.note || '';
  }
}

window.selectCircuitVariant = function (idx) {
  state.circuitVariantIdx = idx;
  renderActiveCircuitVariant();
};

window.copyLatexReport = function () {
  const numPolyZ = buildPolynomialLatex(state.bCoeffs, 'z');
  const denPolyZ = buildPolynomialLatex(state.aCoeffs, 'z');
  const rocInfo = analyzeRocAndStability(state.poles, state.rocType);
  const hnLatex = buildAnalyticalHnLatex(state.bCoeffs, state.aCoeffs, state.poles, state.rocType);
  const diffEqLatex = buildDifferenceEquationLatex(state.bCoeffs, state.aCoeffs);

  const report = [
    '% === KẾT QUẢ PHÂN TÍCH HỆ THỐNG LTI (ĐẠI HỌC BÁCH KHOA - HCMUT) ===',
    `$$H(z) = \\frac{${numPolyZ}}{${denPolyZ}}, \\quad \\text{ROC: } ${rocInfo.rocLatex}$$`,
    `$$${buildFactoredLatex(state.zeros, state.poles, state.gain, state.delay)}$$`,
    `$$${hnLatex}$$`,
    `$$${diffEqLatex}$$`
  ].join('\n\n');

  navigator.clipboard.writeText(report).then(() => {
    const btn = document.getElementById('copyLatexBtn');
    if (btn) {
      const oldHtml = btn.innerHTML;
      btn.innerHTML = `${UI_ICONS.checkCircle}<span>Đã Copy LaTeX!</span>`;
      setTimeout(() => { btn.innerHTML = oldHtml; }, 2000);
    }
  });
};

function renderRootListTables() {
  const renderTable = (arr, type, containerId, accentClass) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (arr.length === 0) {
      container.innerHTML = `<div class="theme-muted italic py-2 text-xs text-center">Không có nghiệm hữu hạn khác 0</div>`;
      return;
    }

    container.innerHTML = '';
    arr.forEach((c, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'sci-input rounded-lg px-3 py-2 text-xs space-y-2';

      const row = document.createElement('div');
      row.className = 'grid grid-cols-12 items-center gap-1.5 min-w-0';

      const colSym = document.createElement('div');
      colSym.className = `col-span-2 font-bold ${accentClass}`;
      const sym = type === 'zero' ? `z_{${idx + 1}}` : `p_{${idx + 1}}`;
      renderLatexToElement(colSym, sym, false);

      const colRect = document.createElement('div');
      colRect.className = 'col-span-4 mono font-medium truncate';
      const sign = c.im >= 0 ? '+' : '-';
      colRect.textContent = `${c.re.toFixed(3)} ${sign} j${Math.abs(c.im).toFixed(3)}`;

      const colPolar = document.createElement('div');
      colPolar.className = 'col-span-4 mono theme-muted text-[11px] truncate';
      const r = c.abs().toFixed(3);
      const deg = ((c.arg() * 180) / Math.PI).toFixed(1);
      colPolar.textContent = `r=${r}, ∠${deg}°`;

      const colActions = document.createElement('div');
      colActions.className = 'col-span-2 flex items-center justify-end gap-1';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'theme-muted hover:text-sky-400 inline-flex items-center justify-center p-1 rounded transition';
      editBtn.innerHTML = UI_ICONS.edit;
      editBtn.title = 'Sửa tọa độ chính xác';
      editBtn.setAttribute('aria-label', 'Sửa tọa độ chính xác');
      editBtn.onclick = () => {
        if (state.editingRoot && state.editingRoot.type === type && state.editingRoot.index === idx) {
          state.editingRoot = null;
        } else {
          state.editingRoot = { type, index: idx };
        }
        renderRootListTables();
      };

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'theme-muted hover:text-rose-500 inline-flex items-center justify-center p-1 rounded transition';
      delBtn.innerHTML = UI_ICONS.close;
      delBtn.title = 'Xóa nghiệm này';
      delBtn.setAttribute('aria-label', 'Xóa nghiệm này');
      delBtn.onclick = () => removeRootAt(type, idx);

      colActions.appendChild(editBtn);
      colActions.appendChild(delBtn);

      row.appendChild(colSym);
      row.appendChild(colRect);
      row.appendChild(colPolar);
      row.appendChild(colActions);
      wrapper.appendChild(row);

      // Inline Coordinate Editor (Polar r, angle° OR Cartesian Re, Im)
      if (state.editingRoot && state.editingRoot.type === type && state.editingRoot.index === idx) {
        const editor = document.createElement('div');
        editor.className = 'pt-2 border-t sci-divider grid grid-cols-2 sm:grid-cols-5 gap-1.5 items-end text-[11px]';

        const makeField = (label, val, step = '0.01') => {
          const box = document.createElement('div');
          const lbl = document.createElement('label');
          lbl.className = 'block theme-muted font-semibold mb-0.5';
          lbl.textContent = label;
          const inp = document.createElement('input');
          inp.type = 'number';
          inp.step = step;
          inp.value = val;
          inp.className = 'w-full sci-subcard border sci-divider rounded px-2 py-1 mono font-semibold focus:outline-none focus:border-sky-500';
          box.appendChild(lbl);
          box.appendChild(inp);
          return { box, inp };
        };

        const reF = makeField('Re', Number(c.re.toFixed(4)));
        const imF = makeField('Im', Number(c.im.toFixed(4)));
        const rF = makeField('Bán kính r', Number(c.abs().toFixed(4)));
        const degF = makeField('Góc (°)', Number(((c.arg() * 180) / Math.PI).toFixed(2)), '1');

        const syncFromCart = () => {
          const nRe = parseFloat(reF.inp.value) || 0;
          const nIm = parseFloat(imF.inp.value) || 0;
          const nc = new Complex(nRe, nIm);
          rF.inp.value = Number(nc.abs().toFixed(4));
          degF.inp.value = Number(((nc.arg() * 180) / Math.PI).toFixed(2));
        };
        const syncFromPolar = () => {
          const nr = parseFloat(rF.inp.value) || 0;
          const ndeg = parseFloat(degF.inp.value) || 0;
          const nc = Complex.fromPolar(nr, (ndeg * Math.PI) / 180);
          reF.inp.value = Number(nc.re.toFixed(4));
          imF.inp.value = Number(nc.im.toFixed(4));
        };

        reF.inp.oninput = syncFromCart;
        imF.inp.oninput = syncFromCart;
        rF.inp.oninput = syncFromPolar;
        degF.inp.oninput = syncFromPolar;

        const applyBtn = document.createElement('button');
        applyBtn.className = 'bg-[#0072bc] hover:bg-sky-500 text-white font-bold py-1.5 px-2 rounded transition';
        applyBtn.textContent = 'Lưu';
        applyBtn.onclick = () => {
          const nRe = parseFloat(reF.inp.value);
          const nIm = parseFloat(imF.inp.value);
          if (Number.isNaN(nRe) || Number.isNaN(nIm)) return;
          applyEditedRoot(type, idx, new Complex(nRe, Math.abs(nIm) < 1e-5 ? 0 : nIm));
        };

        editor.appendChild(reF.box);
        editor.appendChild(imF.box);
        editor.appendChild(rF.box);
        editor.appendChild(degF.box);
        editor.appendChild(applyBtn);
        wrapper.appendChild(editor);
      }

      container.appendChild(wrapper);
    });
  };

  renderTable(state.zeros, 'zero', 'zerosListContainer', 'theme-sky');
  renderTable(state.poles, 'pole', 'polesListContainer', 'theme-rose');
}

function findConjIndex(list, idx) {
  const target = list[idx];
  if (!target || Math.abs(target.im) <= 0.015) return -1;
  return list.findIndex(
    (r, i) =>
      i !== idx &&
      Math.abs(r.re - target.re) < 0.04 &&
      Math.abs(r.im + target.im) < 0.04
  );
}

function applyEditedRoot(type, idx, newVal) {
  const list = type === 'zero' ? state.zeros : state.poles;
  if (!list[idx]) return;
  pushUndoHistory();
  const conjIdx = state.conjugatePair ? findConjIndex(list, idx) : -1;
  list[idx] = newVal;
  if (conjIdx !== -1) {
    if (Math.abs(newVal.im) < 1e-4) {
      // Moved onto real axis -> keep symmetric pair or leave user control
      list[conjIdx] = new Complex(newVal.re, 0);
    } else {
      list[conjIdx] = new Complex(newVal.re, -newVal.im);
    }
  } else if (state.conjugatePair && Math.abs(newVal.im) > 0.015) {
    list.push(new Complex(newVal.re, -newVal.im));
  }
  state.editingRoot = null;
  autoFitZPlaneRange();
  markCustomSystemMode();
  syncCoeffsFromRoots(true, true);
  requestRedraw();
}

window.removeRootAt = function (type, idx) {
  const list = type === 'zero' ? state.zeros : state.poles;
  const target = list[idx];
  if (!target) return;
  pushUndoHistory();
  const conjIdx = state.conjugatePair ? findConjIndex(list, idx) : -1;
  if (conjIdx !== -1) {
    const hi = Math.max(idx, conjIdx);
    const lo = Math.min(idx, conjIdx);
    list.splice(hi, 1);
    list.splice(lo, 1);
  } else {
    list.splice(idx, 1);
  }
  state.editingRoot = null;
  markCustomSystemMode();
  syncCoeffsFromRoots(true, true);
  requestRedraw();
};

window.addManualRoot = function (type) {
  pushUndoHistory();
  const list = type === 'zero' ? state.zeros : state.poles;
  const r = type === 'zero' ? 0.95 : 0.75;
  const angle = 0.35 * Math.PI;
  list.push(Complex.fromPolar(r, angle));
  if (state.conjugatePair) {
    list.push(Complex.fromPolar(r, -angle));
  }
  markCustomSystemMode();
  syncCoeffsFromRoots(true, true);
  requestRedraw();
};

/* ==================== RENDER LOOP & METRICS ==================== */

let redrawQueued = false;
function requestRedraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(timestamp => {
    redrawQueued = false;
    const t0 = performance.now();

    if (state.zViewMode === '3d') {
      draw3DZSurfaceCanvas(state);
    } else {
      drawZPlaneCanvas(state);
    }
    const res = drawFrequencyCharts(state);
    drawImpulseResponseChart(state);

    const t1 = performance.now();
    const renderCost = t1 - t0;
    state.renderMs = state.renderMs * 0.7 + renderCost * 0.3;

    const dt = timestamp - state.lastFrameTime;
    state.lastFrameTime = timestamp;
    const fpsEl = document.getElementById('fpsCounter');
    if (fpsEl) {
      if (state.dragging && dt > 0 && dt < 120) {
        const instFps = Math.min(144, Math.round(1000 / dt));
        state.fps = Math.round(state.fps * 0.75 + instFps * 0.25);
        fpsEl.textContent = `${state.fps} FPS • ${state.renderMs.toFixed(1)} ms`;
      } else {
        fpsEl.textContent = `${state.renderMs.toFixed(1)} ms/frame`;
      }
    }

    if (res) {
      const m = res.metrics;
      const peakLatex =
        res.maxMag > 1e4
          ? '\\infty \\; (\\text{Cực trên } |z|=1)'
          : `${res.maxMag.toFixed(2)} \\; (${res.maxDb.toFixed(1)}\\text{ dB})`;
      renderLatexToElement('peakGainLatex', peakLatex, false);

      // Update Geometric Breakdown at omega_0
      const probeZ = Complex.fromPolar(1.0, state.omega0);
      const dzTerms = state.zeros.map(z => probeZ.sub(z).abs().toFixed(2));
      const dpTerms = state.poles.map(p => probeZ.sub(p).abs().toFixed(2));
      const numProd = dzTerms.length ? dzTerms.join('\\cdot ') : '1';
      const denProd = dpTerms.length ? dpTerms.join('\\cdot ') : '1';
      const geoFormula =
        dpTerms.length > 0
          ? `\\left|H(e^{j\\omega_0})\\right| = ${Math.abs(state.gain).toFixed(2)} \\cdot \\frac{${numProd}}{${denProd}} = ${res.magW0.toFixed(3)} \\; (${res.dbW0.toFixed(1)}\\text{ dB})`
          : `\\left|H(e^{j\\omega_0})\\right| = ${Math.abs(state.gain).toFixed(2)} \\cdot (${numProd}) = ${res.magW0.toFixed(3)} \\; (${res.dbW0.toFixed(1)}\\text{ dB})`;

      renderLatexToElement('vectorGainLatex', geoFormula, false);

      const filterEl = document.getElementById('filterTypeText');
      if (filterEl) {
        filterEl.textContent = m.filterType;
      }

      const phasePropEl = document.getElementById('minPhaseBadge');
      if (phasePropEl) {
        phasePropEl.textContent = m.isMinPhase
          ? '• Pha cực tiểu (Min-Phase)'
          : '';
      }

      const bwEl = document.getElementById('bwSummaryText');
      if (bwEl) {
        const hzSuffix = wRad =>
          state.fsHz > 0 ? ` (${((wRad / (2 * Math.PI)) * state.fsHz).toFixed(1)} Hz)` : '';
        if (m.cutoffOmegas.length >= 2) {
          const bw = m.cutoffOmegas[1] - m.cutoffOmegas[0];
          bwEl.textContent = `BW(-3dB) ≈ ${(bw / Math.PI).toFixed(2)}π${hzSuffix(bw)}`;
        } else if (m.cutoffOmegas.length === 1) {
          bwEl.textContent = `ω_c(-3dB) ≈ ${(m.cutoffOmegas[0] / Math.PI).toFixed(2)}π${hzSuffix(m.cutoffOmegas[0])}`;
        } else {
          bwEl.textContent = `DC=${m.dcGain.toFixed(2)} | Nyq=${m.nyqGain.toFixed(2)}`;
        }
      }
    }
  });
}

/* ==================== POINTER, SNAP, ZOOM & HOVER TOOLTIPS ==================== */

function findNearestRoot(mouseX, mouseY, width, height, thresholdPx = 16) {
  let best = null;
  let bestDist = thresholdPx;
  const maxR = state.zViewRange || 1.42;

  state.poles.forEach((p, idx) => {
    const pt = zToScreen(p.re, p.im, width, height, maxR);
    const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
    if (d < bestDist) {
      bestDist = d;
      best = { type: 'pole', index: idx };
    }
  });

  state.zeros.forEach((z, idx) => {
    const pt = zToScreen(z.re, z.im, width, height, maxR);
    const d = Math.hypot(mouseX - pt.x, mouseY - pt.y);
    if (d < bestDist) {
      bestDist = d;
      best = { type: 'zero', index: idx };
    }
  });

  return best;
}

function applySnapToZ(z, forceSnap) {
  state.snapHint = null;
  let re = z.re;
  let im = z.im;
  const shouldSnap = state.snapToGrid || forceSnap;

  // Snap to real axis
  if (Math.abs(im) < (shouldSnap ? 0.06 : 0.025)) {
    im = 0;
  }
  // Snap to imaginary axis
  if (shouldSnap && Math.abs(re) < 0.05) {
    re = 0;
  }

  let out = new Complex(re, im);
  // Snap to unit circle |z| = 1
  if (shouldSnap && Math.abs(out.abs() - 1.0) < 0.075) {
    out = Complex.fromPolar(1.0, out.arg());
    state.snapHint = 'unitCircle';
  }
  return out;
}

function initInteractions() {
  const zCanvas = document.getElementById('zPlaneCanvas');
  if (!zCanvas) return;

  const getPointerPos = e => {
    const rect = zCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: rect.width,
      height: rect.height
    };
  };

  zCanvas.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    zCanvas.setPointerCapture(e.pointerId);
    const pos = getPointerPos(e);

    if (state.zViewMode === '3d') {
      state.dragging = { type: 'rotate3d', lastX: e.clientX, lastY: e.clientY };
      return;
    }

    const maxR = state.zViewRange || 1.42;
    const rawZ = screenToZ(pos.x, pos.y, pos.width, pos.height, maxR);
    const z = applySnapToZ(rawZ, e.shiftKey);

    if (state.interactMode === 'addPole' || state.interactMode === 'addZero') {
      pushUndoHistory();
      const list = state.interactMode === 'addPole' ? state.poles : state.zeros;
      list.push(z);
      if (state.conjugatePair && Math.abs(z.im) > 0.03) {
        list.push(new Complex(z.re, -z.im));
      }
      setInteractMode('drag');
      markCustomSystemMode();
      syncCoeffsFromRoots(true, true);
      requestRedraw();
      return;
    }

    const hit = findNearestRoot(pos.x, pos.y, pos.width, pos.height);
    if (hit) {
      pushUndoHistory();
      const list = hit.type === 'pole' ? state.poles : state.zeros;
      const conjIndex = state.conjugatePair ? findConjIndex(list, hit.index) : -1;
      state.dragging = { type: hit.type, index: hit.index, conjIndex, moved: false };
    } else if (Math.abs(rawZ.abs() - 1.0) < 0.14) {
      state.dragging = { type: 'omegaProbe' };
      onOmegaSliderChange(rawZ.arg());
    }
  });

  zCanvas.addEventListener('pointermove', e => {
    const pos = getPointerPos(e);

    if (state.dragging && state.dragging.type === 'rotate3d') {
      const dx = e.clientX - state.dragging.lastX;
      const dy = e.clientY - state.dragging.lastY;
      state.dragging.lastX = e.clientX;
      state.dragging.lastY = e.clientY;
      state.view3dYaw += dx * 0.01;
      state.view3dPitch = Math.max(0.15, Math.min(1.45, state.view3dPitch + dy * 0.01));
      requestRedraw();
      return;
    }

    if (state.zViewMode === '3d') return;

    const maxR = state.zViewRange || 1.42;
    const rawZ = screenToZ(pos.x, pos.y, pos.width, pos.height, maxR);

    const sign = rawZ.im >= 0 ? '+' : '-';
    const deg = ((rawZ.arg() * 180) / Math.PI).toFixed(1);
    renderLatexToElement(
      'zCursorLatex',
      `z = ${rawZ.re.toFixed(2)} ${sign} j${Math.abs(rawZ.im).toFixed(2)}, \\; |z| = ${rawZ.abs().toFixed(2)}, \\; \\angle ${deg}^\\circ`,
      false
    );

    if (!state.dragging) {
      const hit = findNearestRoot(pos.x, pos.y, pos.width, pos.height);
      if (
        (hit && !state.hoveredRoot) ||
        (!hit && state.hoveredRoot) ||
        (hit && state.hoveredRoot && (hit.type !== state.hoveredRoot.type || hit.index !== state.hoveredRoot.index))
      ) {
        state.hoveredRoot = hit;
        requestRedraw();
      }
      return;
    }

    if (state.dragging.type === 'omegaProbe') {
      onOmegaSliderChange(rawZ.arg());
      return;
    }

    const bound = maxR * 0.96;
    const snapped = applySnapToZ(rawZ, e.shiftKey);
    const clampedRe = Math.max(-bound, Math.min(bound, snapped.re));
    const clampedIm = Math.max(-bound, Math.min(bound, snapped.im));

    const list = state.dragging.type === 'pole' ? state.poles : state.zeros;
    const idx = state.dragging.index;
    if (list[idx]) {
      state.dragging.moved = true;
      list[idx] = new Complex(clampedRe, clampedIm);
      if (state.dragging.conjIndex !== -1 && list[state.dragging.conjIndex]) {
        list[state.dragging.conjIndex] = new Complex(clampedRe, -clampedIm);
      }
      syncCoeffsFromRoots(true, false);
      requestRedraw();
    }
  });

  const endPointerDrag = () => {
    if (state.dragging && state.dragging.type !== 'omegaProbe' && state.dragging.type !== 'rotate3d') {
      if (!state.dragging.moved) {
        state.undoStack.pop();
        updateUndoRedoButtons();
      } else {
        markCustomSystemMode();
        syncCoeffsFromRoots(true, true);
      }
    }
    state.dragging = null;
    state.snapHint = null;
    requestRedraw();
  };

  zCanvas.addEventListener('pointerup', endPointerDrag);
  zCanvas.addEventListener('pointercancel', endPointerDrag);

  // Mouse Wheel Zoom on Z-Plane
  zCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    state.zViewRange = Math.max(0.8, Math.min(5.0, state.zViewRange * factor));
    requestRedraw();
  }, { passive: false });

  zCanvas.addEventListener('dblclick', e => {
    if (state.zViewMode === '3d') return;
    const pos = getPointerPos(e);
    const maxR = state.zViewRange || 1.42;
    const z = applySnapToZ(screenToZ(pos.x, pos.y, pos.width, pos.height, maxR), e.shiftKey);
    pushUndoHistory();
    const list = e.shiftKey ? state.zeros : state.poles;
    list.push(z);
    if (state.conjugatePair && Math.abs(z.im) > 0.03) {
      list.push(new Complex(z.re, -z.im));
    }
    markCustomSystemMode();
    syncCoeffsFromRoots(true, true);
    requestRedraw();
  });

  zCanvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (state.zViewMode === '3d') return;
    const pos = getPointerPos(e);
    const hit = findNearestRoot(pos.x, pos.y, pos.width, pos.height, 18);
    if (hit) removeRootAt(hit.type, hit.index);
  });

  // Frequency Scrubbing + Hover Tooltips on magCanvas & phaseCanvas
  [
    { id: 'magCanvas', tipId: 'magTooltip', kind: 'mag' },
    { id: 'phaseCanvas', tipId: 'phaseTooltip', kind: 'phase' }
  ].forEach(({ id, tipId, kind }) => {
    const c = document.getElementById(id);
    const tip = document.getElementById(tipId);
    if (!c) return;
    let scrubbing = false;

    const getWAtX = clientX => {
      const rect = c.getBoundingClientRect();
      const x = clientX - rect.left;
      const padLeft = 56, padRight = 24;
      const plotW = Math.max(10, rect.width - padLeft - padRight);
      const frac = Math.max(0, Math.min(1, (x - padLeft) / plotW));
      const wMin = state.fullFreqRange ? -Math.PI : 0;
      return { w: wMin + frac * (Math.PI - wMin), x, yOffset: rect.top, rect };
    };

    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      scrubbing = true;
      onOmegaSliderChange(getWAtX(e.clientX).w);
    });

    c.addEventListener('pointermove', e => {
      const { w, x, rect } = getWAtX(e.clientX);
      const y = e.clientY - rect.top;
      if (scrubbing) onOmegaSliderChange(w);

      if (tip && state.freqData) {
        const { H, groupDelay } = evaluateHzAtOmega(state.bCoeffs, state.aCoeffs, w);
        const wPi = (w / Math.PI).toFixed(2);
        const fHzStr = state.fsHz > 0 ? ` (${((Math.abs(w) / (2 * Math.PI)) * state.fsHz).toFixed(1)} Hz)` : '';
        if (kind === 'mag') {
          const mag = H.abs();
          const db = 20 * Math.log10(Math.max(mag, 1e-6));
          tip.textContent = `ω=${wPi}π${fHzStr} | |H|=${mag.toFixed(3)} (${db.toFixed(1)} dB)`;
        } else if (state.phaseChartMode === 'groupDelay') {
          const gdStr = Number.isFinite(groupDelay) ? `${groupDelay.toFixed(2)} mẫu` : '∞ (Zero/Pole)';
          tip.textContent = `ω=${wPi}π${fHzStr} | τ_g=${gdStr}`;
        } else {
          const deg = ((H.arg() * 180) / Math.PI).toFixed(1);
          tip.textContent = `ω=${wPi}π${fHzStr} | ∠H=${deg}°`;
        }
        tip.style.left = `${Math.min(rect.width - 210, Math.max(12, x))}px`;
        tip.style.top = `${Math.max(30, y)}px`;
        tip.classList.remove('hidden');
      }
    });

    const stopScrub = () => { scrubbing = false; };
    c.addEventListener('pointerup', stopScrub);
    c.addEventListener('pointercancel', stopScrub);
    c.addEventListener('pointerleave', () => {
      scrubbing = false;
      if (tip) tip.classList.add('hidden');
    });
  });

  // Hover Tooltip on Time-Domain Chart (impulseCanvas)
  const impCanvas = document.getElementById('impulseCanvas');
  const impTip = document.getElementById('impulseTooltip');
  if (impCanvas && impTip) {
    impCanvas.addEventListener('pointermove', e => {
      if (!state.lastTimeData) return;
      const rect = impCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const padLeft = 56, padRight = 24;
      const plotW = Math.max(10, rect.width - padLeft - padRight);
      const frac = Math.max(0, Math.min(1, (x - padLeft) / plotW));
      const { nIndices, inSig, outSig } = state.lastTimeData;
      const idx = Math.round(frac * (nIndices.length - 1));
      const n = nIndices[idx];
      if (state.timeChartMode === 'signal') {
        impTip.textContent = `n=${n} | x[n]=${inSig[idx].toFixed(3)} → y[n]=${outSig[idx].toFixed(3)}`;
      } else {
        const lbl = state.timeChartMode === 'step' ? 's' : 'h';
        impTip.textContent = `n=${n} | ${lbl}[${n}]=${outSig[idx].toFixed(4)}`;
      }
      impTip.style.left = `${Math.min(rect.width - 175, Math.max(12, x))}px`;
      impTip.style.top = `${Math.max(30, y)}px`;
      impTip.classList.remove('hidden');
    });
    impCanvas.addEventListener('pointerleave', () => impTip.classList.add('hidden'));
  }

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) window.redoAction();
      else window.undoAction();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      window.redoAction();
    }
  });

  window.addEventListener('resize', () => requestRedraw());
}

/* ==================== UI CONTROLS HANDLERS ==================== */

window.setZViewMode = function (mode) {
  state.zViewMode = mode;
  const b2 = document.getElementById('zView2dBtn');
  const b3 = document.getElementById('zView3dBtn');
  if (b2 && b3) {
    b2.className = mode === '2d'
      ? 'px-2.5 py-1 rounded-md studio-pill-active text-xs transition'
      : 'px-2.5 py-1 rounded-md studio-pill-idle text-xs transition';
    b3.className = mode === '3d'
      ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md studio-pill-active text-xs transition'
      : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-md studio-pill-idle text-xs transition';
  }
  const zCanvas = document.getElementById('zPlaneCanvas');
  if (zCanvas) {
    zCanvas.style.cursor = mode === '3d' ? 'move' : 'grab';
  }
  requestRedraw();
};

window.setInteractMode = function (mode) {
  state.interactMode = mode;
  const btnMap = {
    drag: 'modeDragBtn',
    addPole: 'modeAddPoleBtn',
    addZero: 'modeAddZeroBtn'
  };
  Object.entries(btnMap).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (k === mode) {
      el.className = 'px-2.5 py-1 rounded-md studio-pill-active transition';
    } else {
      const color = k === 'addPole' ? 'theme-rose' : k === 'addZero' ? 'theme-sky' : '';
      el.className = `px-2.5 py-1 rounded-md studio-pill-idle ${color} transition`;
    }
  });
};

window.onConjugateToggle = function (checked) {
  state.conjugatePair = checked;
};

window.onShowVectorsToggle = function (checked) {
  state.showVectors = checked;
  requestRedraw();
};

window.onSnapToggle = function (checked) {
  state.snapToGrid = checked;
};

window.onShowOriginToggle = function (checked) {
  state.showOriginRoots = checked;
  requestRedraw();
};

window.onMagDbToggle = function (checked) {
  state.magDb = checked;
  requestRedraw();
};

window.onFullFreqToggle = function (checked) {
  state.fullFreqRange = checked;
  requestRedraw();
};

window.onNumSamplesChange = function (val) {
  state.numSamples = parseInt(val, 10) || 64;
  requestRedraw();
};

window.onOmegaSliderChange = function (val) {
  state.omega0 = parseFloat(val);
  const slider = document.getElementById('omegaSlider');
  if (slider) slider.value = state.omega0;
  const piMult = (state.omega0 / Math.PI).toFixed(2);
  const deg = ((state.omega0 * 180) / Math.PI).toFixed(1);
  const fHz = state.fsHz > 0 ? ((Math.abs(state.omega0) / (2 * Math.PI)) * state.fsHz).toFixed(1) : null;
  const fText = fHz !== null ? ` \\; | \\; f = ${fHz}\\text{ Hz}` : '';
  renderLatexToElement(
    'omegaValueLatex',
    `\\omega_0 = ${piMult}\\pi\\text{ rad/mẫu } (${deg}^\\circ)${fText}`,
    false
  );
  requestRedraw();
};

window.onFsChange = function (val) {
  const fs = parseFloat(val);
  state.fsHz = !Number.isNaN(fs) && fs > 0 ? fs : 0;
  window.onOmegaSliderChange(state.omega0);
  updateAllFormulasAndTables();
  requestRedraw();
};

/* Live 60 FPS Auto-Sweep Animation for omega_0 */
let sweepRafId = null;
let sweepLastTs = 0;

window.toggleAutoSweep = function () {
  const btn = document.getElementById('sweepToggleBtn');
  if (sweepRafId !== null) {
    cancelAnimationFrame(sweepRafId);
    sweepRafId = null;
    if (btn) {
      btn.className = 'no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-md studio-btn-primary text-[11px] font-semibold shrink-0';
      btn.innerHTML = '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg><span>Quét ω₀</span>';
    }
    return;
  }

  if (btn) {
    btn.className = 'no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold shrink-0 transition';
    btn.innerHTML = '<svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Dừng</span>';
  }
  sweepLastTs = performance.now();
  const step = ts => {
    const dtSec = Math.min(0.05, (ts - sweepLastTs) / 1000);
    sweepLastTs = ts;
    const wMin = state.fullFreqRange ? -Math.PI : 0;
    const wMax = Math.PI;
    let nextW = state.omega0 + dtSec * 0.85;
    if (nextW > wMax) nextW = wMin;
    if (nextW < wMin) nextW = wMin;
    window.onOmegaSliderChange(nextW);
    sweepRafId = requestAnimationFrame(step);
  };
  sweepRafId = requestAnimationFrame(step);
};

window.markCustomSystemMode = function () {
  const sel = document.getElementById('presetSelect');
  if (sel) sel.value = 'custom';
  document.querySelectorAll('.quick-preset-btn').forEach(btn => {
    btn.className = 'quick-preset-btn px-2.5 py-1 rounded-md studio-pill-idle transition';
  });
};

window.onRocTypeChange = function (val) {
  pushUndoHistory();
  state.rocType = val;
  updateAllFormulasAndTables();
  requestRedraw();
};

window.onGainChange = function (val) {
  const g = parseFloat(val);
  if (!Number.isNaN(g) && Math.abs(g) > 1e-6) {
    state.gain = g;
    markCustomSystemMode();
    syncCoeffsFromRoots(true, true);
    requestRedraw();
  }
};

window.normalizePeakGain = function () {
  const rawB = rootsToPoly(state.zeros);
  const delayZeros = new Array(Math.max(0, state.delay)).fill(0);
  const freq = evaluateFrequencyResponse(
    [...delayZeros, ...rawB],
    rootsToPoly(state.poles),
    false,
    512
  );
  let maxM = 0;
  for (let i = 0; i < freq.mags.length; i++) {
    if (freq.mags[i] > maxM) maxM = freq.mags[i];
  }
  if (maxM > 1e-6) {
    pushUndoHistory();
    state.gain = Number((1 / maxM).toFixed(4));
    markCustomSystemMode();
    syncCoeffsFromRoots(true, true);
    requestRedraw();
  }
};

window.clearAllPolesZeros = function () {
  pushUndoHistory();
  state.zeros = [];
  state.poles = [];
  state.delay = 0;
  state.gain = 1.0;
  state.zViewRange = 1.42;
  state.editingRoot = null;
  markCustomSystemMode();
  syncCoeffsFromRoots(true, true);
  requestRedraw();
};

window.setPhaseChartMode = function (mode) {
  state.phaseChartMode = mode;
  const map = {
    phase: 'phaseModeBtn',
    unwrapped: 'unwrappedModeBtn',
    groupDelay: 'groupDelayModeBtn'
  };
  Object.entries(map).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className =
      k === mode
        ? 'px-2.5 py-1 rounded-md studio-pill-active transition'
        : 'px-2.5 py-1 rounded-md studio-pill-idle transition';
  });
  requestRedraw();
};

window.setTimeChartMode = function (mode) {
  state.timeChartMode = mode;
  const map = {
    impulse: 'timeImpulseBtn',
    step: 'timeStepBtn',
    signal: 'timeSignalBtn'
  };
  Object.entries(map).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className =
      k === mode
        ? 'px-2.5 py-1 rounded-md studio-pill-active transition'
        : 'px-2.5 py-1 rounded-md studio-pill-idle transition';
  });
  const sigPanel = document.getElementById('signalGeneratorBar');
  if (sigPanel) {
    if (mode === 'signal') sigPanel.classList.remove('hidden');
    else sigPanel.classList.add('hidden');
  }
  requestRedraw();
};

window.onSignalTypeChange = function (val) {
  state.signalOpts.type = val;
  const w2Wrap = document.getElementById('sigW2Container');
  if (w2Wrap) {
    if (val === 'twoTone') w2Wrap.classList.remove('hidden');
    else w2Wrap.classList.add('hidden');
  }
  requestRedraw();
};

window.onSignalFreqChange = function (which, piMultVal) {
  const rad = parseFloat(piMultVal) * Math.PI;
  if (which === 1) {
    state.signalOpts.w1 = rad;
    const lbl = document.getElementById('sigW1Label');
    if (lbl) lbl.textContent = `${parseFloat(piMultVal).toFixed(2)}π`;
  } else {
    state.signalOpts.w2 = rad;
    const lbl = document.getElementById('sigW2Label');
    if (lbl) lbl.textContent = `${parseFloat(piMultVal).toFixed(2)}π`;
  }
  requestRedraw();
};

window.applyPreset = function (key) {
  if (!PRESETS[key]) return;
  const p = PRESETS[key];
  state.zeros = p.zeros.map(z => new Complex(z.re, z.im));
  state.poles = p.poles.map(pole => new Complex(pole.re, pole.im));
  state.gain = p.gain;
  state.delay = p.delay || 0;
  state.rocType = p.rocType || 'causal';
  state.fsHz = key === 'notch' ? 300 : state.fsHz || 300;
  const fsEl = document.getElementById('fsInput');
  if (fsEl) fsEl.value = state.fsHz;
  state.editingRoot = null;
  const rocSel = document.getElementById('rocTypeSelect');
  if (rocSel) rocSel.value = state.rocType;
  autoFitZPlaneRange();
  triggerZPlaneRecalcFlash();
  onOmegaSliderChange(p.omega0);
  syncCoeffsFromRoots(true, true);
  if (p.expr) {
    const exprEl = document.getElementById('hzFormulaInput');
    if (exprEl) exprEl.value = p.expr;
  }
  const feedbackEl = document.getElementById('exprFeedbackBadge');
  setBadgeWithIcon(
    feedbackEl,
    'inline-flex items-center gap-1 text-[11px] font-medium theme-emerald',
    UI_ICONS.checkCircle,
    'Sẵn sàng tính toán'
  );
  updateUndoRedoButtons();
  requestRedraw();
};

window.selectPresetQuick = function (key) {
  const sel = document.getElementById('presetSelect');
  if (sel) sel.value = key;
  document.querySelectorAll('.quick-preset-btn').forEach(btn => {
    const active = btn.getAttribute('data-preset') === key;
    btn.className = active
      ? 'quick-preset-btn px-2.5 py-1 rounded-md studio-pill-active transition'
      : 'quick-preset-btn px-2.5 py-1 rounded-md studio-pill-idle transition';
  });
  window.applyPreset(key);
};

window.addEventListener('DOMContentLoaded', () => {
  renderStaticPageMath();
  initInteractions();
  setAppTheme('dark');
  selectPresetQuick('resonator');
});
