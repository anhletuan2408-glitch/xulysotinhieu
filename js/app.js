/**
 * js/app.js
 * Main Application Controller:
 * - Dual Theme Toggle: Dark Mode (Xanh Tối Gốc - Default) & Light Mode (Sáng Bách Khoa)
 * - Direct Symbolic H(z) Expression Input & Recalculate-to-Z-Plane workflow
 * - Auto-fit Z-Plane view range on every recalculation
 * - Complete Analytical Output (H(z), Poles/Zeros, ROC, Closed-Form h[n], y[n], H(e^{jw}))
 */

const state = {
  theme: 'dark', // 'dark' (Xanh Tối Gốc) | 'light' (Sáng Bách Khoa)
  zeros: [],
  poles: [],
  gain: 1.0,
  omega0: Math.PI / 4,
  rocType: 'causal',
  interactMode: 'drag',
  phaseChartMode: 'phase',
  timeChartMode: 'impulse',
  conjugatePair: true,
  showVectors: true,
  magDb: false,
  fullFreqRange: false,
  numSamples: 64,
  zViewRange: 1.42,
  dragging: null,
  hoveredRoot: null,
  bCoeffs: [1],
  aCoeffs: [1],
  freqData: null,
  lastFrameTime: performance.now(),
  fps: 60
};

const PRESETS = {
  resonator: {
    expr: '0.19 * (1 - z^-2) / (1 - 1.2728*z^-1 + 0.81*z^-2)',
    gain: 0.19,
    zeros: [new Complex(1, 0), new Complex(-1, 0)],
    poles: [Complex.fromPolar(0.9, Math.PI / 4), Complex.fromPolar(0.9, -Math.PI / 4)],
    omega0: Math.PI / 4,
    rocType: 'causal'
  },
  notch: {
    expr: '0.93 * (1 - z^-1 + z^-2) / (1 - 0.92*z^-1 + 0.8464*z^-2)',
    gain: 0.93,
    zeros: [Complex.fromPolar(1.0, Math.PI / 3), Complex.fromPolar(1.0, -Math.PI / 3)],
    poles: [Complex.fromPolar(0.92, Math.PI / 3), Complex.fromPolar(0.92, -Math.PI / 3)],
    omega0: Math.PI / 3,
    rocType: 'causal'
  },
  lowpass_iir: {
    expr: '0.0976 * (1 + 2*z^-1 + z^-2) / (1 - 1.1085*z^-1 + 0.4096*z^-2)',
    gain: 0.0976,
    zeros: [new Complex(-1, 0), new Complex(-1, 0)],
    poles: [Complex.fromPolar(0.64, Math.PI / 6), Complex.fromPolar(0.64, -Math.PI / 6)],
    omega0: Math.PI / 8,
    rocType: 'causal'
  },
  highpass_iir: {
    expr: '0.25 * (1 - 2*z^-1 + z^-2) / (1 + 0.9192*z^-1 + 0.4225*z^-2)',
    gain: 0.25,
    zeros: [new Complex(1, 0), new Complex(1, 0)],
    poles: [Complex.fromPolar(0.65, (3 * Math.PI) / 4), Complex.fromPolar(0.65, -(3 * Math.PI) / 4)],
    omega0: (3 * Math.PI) / 4,
    rocType: 'causal'
  },
  moving_avg: {
    expr: '0.25 * (1 + z^-1 + z^-2 + z^-3)',
    gain: 0.25,
    zeros: [new Complex(0, 1), new Complex(0, -1), new Complex(-1, 0)],
    poles: [],
    omega0: Math.PI / 2,
    rocType: 'causal'
  },
  allpass: {
    expr: '(0.64 - 0.8*z^-1 + z^-2) / (1 - 0.8*z^-1 + 0.64*z^-2)',
    gain: 0.64,
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
    zeros: [
      Complex.fromPolar(1, Math.PI / 4),
      Complex.fromPolar(1, -Math.PI / 4),
      Complex.fromPolar(1, (3 * Math.PI) / 4),
      Complex.fromPolar(1, -(3 * Math.PI) / 4)
    ],
    poles: [],
    omega0: Math.PI / 4,
    rocType: 'causal'
  },
  unstable: {
    expr: '0.5 / (1 - 1.7313*z^-1 + 1.1449*z^-2)',
    gain: 0.5,
    zeros: [],
    poles: [
      Complex.fromPolar(1.07, Math.PI / 5),
      Complex.fromPolar(1.07, -Math.PI / 5)
    ],
    omega0: Math.PI / 5,
    rocType: 'causal'
  }
};

/**
 * Toggle between Dark Mode (Xanh Tối Gốc) and Light Mode (Sáng Bách Khoa)
 */
window.setAppTheme = function (theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  const darkBtn = document.getElementById('themeDarkBtn');
  const lightBtn = document.getElementById('themeLightBtn');
  if (darkBtn && lightBtn) {
    if (theme === 'dark') {
      darkBtn.className = 'px-3 py-1 rounded-md bg-sky-500 text-white font-bold text-xs shadow transition';
      lightBtn.className = 'px-3 py-1 rounded-md text-sky-100 hover:text-white font-medium text-xs transition';
    } else {
      lightBtn.className = 'px-3 py-1 rounded-md bg-white text-[#0b2559] font-bold text-xs shadow transition';
      darkBtn.className = 'px-3 py-1 rounded-md text-sky-100 hover:text-white font-medium text-xs transition';
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

function classifyFilterType(mags, poles) {
  if (poles.length === 0) return 'Hệ FIR (Đáp ứng xung hữu hạn)';
  const n = mags.length;
  const dc = mags[0];
  const nyq = mags[n - 1];
  let maxVal = 0, minVal = Infinity, maxIdx = 0, minIdx = 0;
  for (let i = 0; i < n; i++) {
    if (mags[i] > maxVal) { maxVal = mags[i]; maxIdx = i; }
    if (mags[i] < minVal) { minVal = mags[i]; minIdx = i; }
  }
  if (maxVal - minVal < 0.08 * maxVal) return 'All-Pass (Cân bằng pha)';
  if (minVal < 0.12 * maxVal && minIdx > 0.08 * n && minIdx < 0.92 * n && dc > 0.6 * maxVal && nyq > 0.6 * maxVal) {
    return 'IIR Chắn dải (Notch Filter)';
  }
  if (maxIdx > 0.1 * n && maxIdx < 0.9 * n && dc < 0.6 * maxVal && nyq < 0.6 * maxVal) {
    return 'IIR Thông dải (Band-pass)';
  }
  if (dc > nyq * 1.8) return 'IIR Thông thấp (Low-pass)';
  if (nyq > dc * 1.8) return 'IIR Thông cao (High-pass)';
  return 'Hệ IIR Đa tần Tổng quát';
}

function autoFitZPlaneRange() {
  let maxCoord = 1.05;
  state.zeros.forEach(z => {
    maxCoord = Math.max(maxCoord, Math.abs(z.re), Math.abs(z.im), z.abs());
  });
  state.poles.forEach(p => {
    maxCoord = Math.max(maxCoord, Math.abs(p.re), Math.abs(p.im), p.abs());
  });
  state.zViewRange = Math.max(1.42, maxCoord * 1.28);
}

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
  state.bCoeffs = rawB.map(c => c * state.gain);
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
  if (feedbackEl) {
    feedbackEl.textContent = '✓ Đã lấy biểu thức H(z) từ vị trí Cực/Zero hiện tại trên đồ thị';
  }
};

window.evaluateSymbolicHzInput = function (customExpr) {
  const exprEl = document.getElementById('hzFormulaInput');
  const raw = customExpr !== undefined ? customExpr : exprEl.value;
  if (customExpr !== undefined && exprEl) {
    exprEl.value = customExpr;
  }

  const feedbackEl = document.getElementById('exprFeedbackBadge');
  try {
    const { bCoeffs, aCoeffs } = parseTransferFunctionString(raw);
    const firstNonZeroB = bCoeffs.find(v => Math.abs(v) > 1e-10) ?? 1;
    state.gain = firstNonZeroB;
    state.zeros = findPolynomialRoots(bCoeffs);
    state.poles = findPolynomialRoots(aCoeffs);
    state.bCoeffs = bCoeffs;
    state.aCoeffs = aCoeffs;

    autoFitZPlaneRange();
    triggerZPlaneRecalcFlash();

    document.getElementById('numCoeffsInput').value = bCoeffs.map(v => Number(v.toFixed(4))).join(', ');
    document.getElementById('denCoeffsInput').value = aCoeffs.map(v => Number(v.toFixed(4))).join(', ');
    document.getElementById('gainInput').value = Number(state.gain.toFixed(4));

    if (feedbackEl) {
      feedbackEl.textContent = `✓ Đã tính lại & xuất Mặt phẳng phức mặc định: ${state.zeros.length} Zero, ${state.poles.length} Cực`;
    }
    updateAllFormulasAndTables();
    requestRedraw();
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.textContent = `✕ Lỗi cú pháp: ${err.message}. Ví dụ: (1 - z^-2) / (1 - 1.2*z^-1 + 0.8*z^-2)`;
    }
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

  const firstNonZeroB = b.find(v => Math.abs(v) > 1e-12) ?? 1;
  state.gain = firstNonZeroB;
  document.getElementById('gainInput').value = Number(state.gain.toFixed(4));

  state.zeros = findPolynomialRoots(b);
  state.poles = findPolynomialRoots(a);
  state.bCoeffs = b;
  state.aCoeffs = a;

  autoFitZPlaneRange();
  triggerZPlaneRecalcFlash();

  const exprEl = document.getElementById('hzFormulaInput');
  if (exprEl) exprEl.value = coeffsToExprString(b, a);

  const feedbackEl = document.getElementById('exprFeedbackBadge');
  if (feedbackEl) {
    feedbackEl.textContent = `✓ Đã tính lại từ hệ số & xuất Mặt phẳng phức: ${state.zeros.length} Zero, ${state.poles.length} Cực`;
  }

  updateAllFormulasAndTables();
  requestRedraw();
};

function updateAllFormulasAndTables() {
  const rocInfo = analyzeRocAndStability(state.poles, state.rocType);
  const { rMax, rocLatex, isStable, poleOnUnitCircle } = rocInfo;

  // 1. Stability Badge
  const badge = document.getElementById('stabilityBadge');
  if (poleOnUnitCircle) {
    badge.className = 'text-xs font-bold px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40';
    badge.textContent = '◐ Biên giới ổn định (Cực nằm trên |z| = 1)';
  } else if (isStable) {
    badge.className = 'text-xs font-bold px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
    badge.textContent = '● Hệ thống Ổn định BIBO (ROC chứa |z| = 1)';
  } else {
    badge.className = 'text-xs font-bold px-3.5 py-1.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40';
    badge.textContent = '▲ Hệ thống Không ổn định (ROC không chứa |z| = 1)';
  }

  // 2. Top Metrics Cards
  renderLatexToElement('rocSummaryLatex', rocLatex, false);
  renderLatexToElement('maxPoleRadiusLatex', `r_{\\max} = ${rMax.toFixed(3)}`, false);

  // 3. Large Display-Mode H(z) Rational Polynomial
  const numPolyZ = buildPolynomialLatex(state.bCoeffs, 'z');
  const denPolyZ = buildPolynomialLatex(state.aCoeffs, 'z');
  const hzRationalLatex =
    state.aCoeffs.length <= 1 && Math.abs(state.aCoeffs[0] - 1) < 1e-4
      ? `H(z) = ${numPolyZ}`
      : `H(z) = \\frac{B(z)}{A(z)} = \\frac{${numPolyZ}}{${denPolyZ}}`;
  renderLatexToElement('latexHzRational', hzRationalLatex, true);

  // 4. Large Display-Mode H(z) Factored Pole-Zero Form
  const hzFactoredLatex = buildFactoredLatex(state.zeros, state.poles, state.gain);
  renderLatexToElement('latexHzFactored', hzFactoredLatex, true);

  // 5. Large Display-Mode Frequency Response H(e^{jw})
  const numPolyW = buildPolynomialLatex(state.bCoeffs, 'w');
  const denPolyW = buildPolynomialLatex(state.aCoeffs, 'w');
  const hejwLatex =
    state.aCoeffs.length <= 1 && Math.abs(state.aCoeffs[0] - 1) < 1e-4
      ? `H\\left(e^{j\\omega}\\right) = ${numPolyW}`
      : `H\\left(e^{j\\omega}\\right) = \\frac{${numPolyW}}{${denPolyW}}`;
  renderLatexToElement('latexHejw', hejwLatex, true);

  // 6. Large Display-Mode Analytical Impulse Response h[n]
  const hnLatex = buildAnalyticalHnLatex(state.bCoeffs, state.aCoeffs, state.poles, state.rocType);
  renderLatexToElement('latexAnalyticalHn', hnLatex, true);

  // 7. Large Display-Mode Difference Equation y[n]
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

  // 9. Clean Spacious Pole & Zero Coordinate Tables
  renderRootListTables();
}

window.copyLatexReport = function () {
  const numPolyZ = buildPolynomialLatex(state.bCoeffs, 'z');
  const denPolyZ = buildPolynomialLatex(state.aCoeffs, 'z');
  const rocInfo = analyzeRocAndStability(state.poles, state.rocType);
  const hnLatex = buildAnalyticalHnLatex(state.bCoeffs, state.aCoeffs, state.poles, state.rocType);
  const diffEqLatex = buildDifferenceEquationLatex(state.bCoeffs, state.aCoeffs);

  const report = [
    '% === KẾT QUẢ PHÂN TÍCH HỆ THỐNG LTI (ĐẠI HỌC BÁCH KHOA - HCMUT) ===',
    `$$H(z) = \\frac{${numPolyZ}}{${denPolyZ}}, \\quad \\text{ROC: } ${rocInfo.rocLatex}$$`,
    `$$${buildFactoredLatex(state.zeros, state.poles, state.gain)}$$`,
    `$$${hnLatex}$$`,
    `$$${diffEqLatex}$$`
  ].join('\n\n');

  navigator.clipboard.writeText(report).then(() => {
    const btn = document.getElementById('copyLatexBtn');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '✓ Đã Copy LaTeX!';
      setTimeout(() => { btn.textContent = old; }, 2000);
    }
  });
};

function renderRootListTables() {
  const renderTable = (arr, type, containerId, accentText) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (arr.length === 0) {
      container.innerHTML = `<div class="theme-muted italic py-2 text-xs text-center">Không có nghiệm hữu hạn</div>`;
      return;
    }

    container.innerHTML = '';
    arr.forEach((c, idx) => {
      const row = document.createElement('div');
      row.className = 'grid grid-cols-12 items-center gap-2 sci-input px-3 py-2 rounded-lg text-xs';

      const colSym = document.createElement('div');
      colSym.className = `col-span-2 font-bold ${accentText}`;
      const sym = type === 'zero' ? `z_{${idx + 1}}` : `p_{${idx + 1}}`;
      renderLatexToElement(colSym, sym, false);

      const colRect = document.createElement('div');
      colRect.className = 'col-span-5 mono font-medium';
      const sign = c.im >= 0 ? '+' : '-';
      colRect.textContent = `${c.re.toFixed(3)} ${sign} j${Math.abs(c.im).toFixed(3)}`;

      const colPolar = document.createElement('div');
      colPolar.className = 'col-span-4 mono theme-muted text-[11px]';
      const r = c.abs().toFixed(3);
      const deg = ((c.arg() * 180) / Math.PI).toFixed(1);
      colPolar.textContent = `r=${r}, ∠${deg}°`;

      const colDel = document.createElement('div');
      colDel.className = 'col-span-1 text-right';
      const delBtn = document.createElement('button');
      delBtn.className = 'theme-muted hover:text-rose-500 font-bold px-1 transition';
      delBtn.textContent = '✕';
      delBtn.title = 'Xóa nghiệm này';
      delBtn.onclick = () => removeRootAt(type, idx);
      colDel.appendChild(delBtn);

      row.appendChild(colSym);
      row.appendChild(colRect);
      row.appendChild(colPolar);
      row.appendChild(colDel);
      container.appendChild(row);
    });
  };

  renderTable(state.zeros, 'zero', 'zerosListContainer', 'text-sky-400');
  renderTable(state.poles, 'pole', 'polesListContainer', 'text-rose-400');
}

window.removeRootAt = function (type, idx) {
  const list = type === 'zero' ? state.zeros : state.poles;
  const target = list[idx];
  if (!target) return;
  list.splice(idx, 1);

  if (state.conjugatePair && Math.abs(target.im) > 0.02) {
    const conjIdx = list.findIndex(
      r => Math.abs(r.re - target.re) < 0.05 && Math.abs(r.im + target.im) < 0.05
    );
    if (conjIdx !== -1) list.splice(conjIdx, 1);
  }
  syncCoeffsFromRoots(true, false);
  requestRedraw();
};

window.addManualRoot = function (type) {
  const list = type === 'zero' ? state.zeros : state.poles;
  const r = type === 'zero' ? 0.95 : 0.75;
  const angle = 0.35 * Math.PI;
  list.push(Complex.fromPolar(r, angle));
  if (state.conjugatePair) {
    list.push(Complex.fromPolar(r, -angle));
  }
  syncCoeffsFromRoots(true, false);
  requestRedraw();
};

/**
 * 60 FPS Render Loop
 */
let redrawQueued = false;
function requestRedraw() {
  if (redrawQueued) return;
  redrawQueued = true;
  requestAnimationFrame(timestamp => {
    redrawQueued = false;
    const dt = timestamp - state.lastFrameTime;
    if (dt > 0) {
      const instFps = Math.min(120, Math.round(1000 / dt));
      state.fps = Math.round(state.fps * 0.8 + instFps * 0.2);
      const fpsEl = document.getElementById('fpsCounter');
      if (fpsEl) fpsEl.textContent = `${Math.max(60, state.fps)} FPS`;
    }
    state.lastFrameTime = timestamp;

    drawZPlaneCanvas(state);
    const metrics = drawFrequencyCharts(state);
    drawImpulseResponseChart(state);

    if (metrics) {
      renderLatexToElement(
        'peakGainLatex',
        `${metrics.maxMag.toFixed(2)} \\; (${metrics.maxDb.toFixed(1)}\\text{ dB})`,
        false
      );
      renderLatexToElement(
        'vectorGainLatex',
        `\\left|H\\left(e^{j\\omega_0}\\right)\\right| = ${metrics.magW0.toFixed(3)} \\; (${metrics.dbW0.toFixed(1)}\\text{ dB}), \\quad \\angle H\\left(e^{j\\omega_0}\\right) = ${metrics.degW0.toFixed(1)}^\\circ`,
        false
      );
      const filterEl = document.getElementById('filterTypeText');
      if (filterEl && state.freqData) {
        filterEl.textContent = classifyFilterType(state.freqData.mags, state.poles);
      }
    }
  });
}

function findNearestRoot(mouseX, mouseY, width, height, thresholdPx = 15) {
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

function initInteractions() {
  const zCanvas = document.getElementById('zPlaneCanvas');
  if (!zCanvas) return;

  const getMousePos = e => {
    const rect = zCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: rect.width,
      height: rect.height
    };
  };

  zCanvas.addEventListener('mousedown', e => {
    if (e.button === 2) return;
    const pos = getMousePos(e);
    const maxR = state.zViewRange || 1.42;
    const z = screenToZ(pos.x, pos.y, pos.width, pos.height, maxR);

    if (state.interactMode === 'addPole' || state.interactMode === 'addZero') {
      const list = state.interactMode === 'addPole' ? state.poles : state.zeros;
      list.push(z);
      if (state.conjugatePair && Math.abs(z.im) > 0.03) {
        list.push(new Complex(z.re, -z.im));
      }
      setInteractMode('drag');
      syncCoeffsFromRoots(true, false);
      requestRedraw();
      return;
    }

    const hit = findNearestRoot(pos.x, pos.y, pos.width, pos.height);
    if (hit) {
      const list = hit.type === 'pole' ? state.poles : state.zeros;
      const target = list[hit.index];
      let conjIndex = -1;
      if (state.conjugatePair && Math.abs(target.im) > 0.015) {
        conjIndex = list.findIndex(
          (r, i) =>
            i !== hit.index &&
            Math.abs(r.re - target.re) < 0.05 &&
            Math.abs(r.im + target.im) < 0.05
        );
      }
      state.dragging = { type: hit.type, index: hit.index, conjIndex };
    } else if (Math.abs(z.abs() - 1.0) < 0.14) {
      state.dragging = { type: 'omegaProbe' };
      onOmegaSliderChange(z.arg());
    }
  });

  window.addEventListener('mousemove', e => {
    const rect = zCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const maxR = state.zViewRange || 1.42;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      const z = screenToZ(x, y, rect.width, rect.height, maxR);
      const sign = z.im >= 0 ? '+' : '-';
      const deg = ((z.arg() * 180) / Math.PI).toFixed(1);
      renderLatexToElement(
        'zCursorLatex',
        `z = ${z.re.toFixed(2)} ${sign} j${Math.abs(z.im).toFixed(2)}, \\; |z| = ${z.abs().toFixed(2)}, \\; \\angle ${deg}^\\circ`,
        false
      );

      if (!state.dragging) {
        const hit = findNearestRoot(x, y, rect.width, rect.height);
        if (
          (hit && !state.hoveredRoot) ||
          (!hit && state.hoveredRoot) ||
          (hit && state.hoveredRoot && (hit.type !== state.hoveredRoot.type || hit.index !== state.hoveredRoot.index))
        ) {
          state.hoveredRoot = hit;
          requestRedraw();
        }
      }
    }

    if (!state.dragging) return;
    const z = screenToZ(x, y, rect.width, rect.height, maxR);

    if (state.dragging.type === 'omegaProbe') {
      onOmegaSliderChange(z.arg());
      return;
    }

    const bound = maxR * 0.95;
    const clampedRe = Math.max(-bound, Math.min(bound, z.re));
    let clampedIm = Math.max(-bound, Math.min(bound, z.im));
    if (Math.abs(clampedIm) < 0.025) clampedIm = 0;

    const list = state.dragging.type === 'pole' ? state.poles : state.zeros;
    const idx = state.dragging.index;
    if (list[idx]) {
      list[idx] = new Complex(clampedRe, clampedIm);
      if (state.dragging.conjIndex !== -1 && list[state.dragging.conjIndex]) {
        list[state.dragging.conjIndex] = new Complex(clampedRe, -clampedIm);
      }
      syncCoeffsFromRoots(true, false);
      requestRedraw();
    }
  });

  window.addEventListener('mouseup', () => {
    state.dragging = null;
  });

  zCanvas.addEventListener('dblclick', e => {
    const pos = getMousePos(e);
    const maxR = state.zViewRange || 1.42;
    const z = screenToZ(pos.x, pos.y, pos.width, pos.height, maxR);
    const list = e.shiftKey ? state.zeros : state.poles;
    list.push(z);
    if (state.conjugatePair && Math.abs(z.im) > 0.03) {
      list.push(new Complex(z.re, -z.im));
    }
    syncCoeffsFromRoots(true, false);
    requestRedraw();
  });

  zCanvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const pos = getMousePos(e);
    const hit = findNearestRoot(pos.x, pos.y, pos.width, pos.height, 18);
    if (hit) removeRootAt(hit.type, hit.index);
  });

  ['magCanvas', 'phaseCanvas'].forEach(id => {
    const c = document.getElementById(id);
    if (!c) return;
    let scrubbing = false;
    const updateW = e => {
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const padLeft = 56, padRight = 24;
      const plotW = rect.width - padLeft - padRight;
      const frac = Math.max(0, Math.min(1, (x - padLeft) / plotW));
      const wMin = state.fullFreqRange ? -Math.PI : 0;
      const w = wMin + frac * (Math.PI - wMin);
      onOmegaSliderChange(w);
    };
    c.addEventListener('mousedown', e => {
      scrubbing = true;
      updateW(e);
    });
    window.addEventListener('mousemove', e => {
      if (scrubbing) updateW(e);
    });
    window.addEventListener('mouseup', () => {
      scrubbing = false;
    });
  });

  window.addEventListener('resize', () => requestRedraw());
}

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
      el.className = 'px-3 py-1 rounded-md bg-[#0072bc] text-white font-semibold shadow-sm transition';
    } else {
      const color = k === 'addPole' ? 'text-rose-500' : k === 'addZero' ? 'text-sky-400' : 'theme-muted';
      el.className = `px-3 py-1 rounded-md sci-input ${color} hover:opacity-80 font-medium transition`;
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
  renderLatexToElement(
    'omegaValueLatex',
    `\\omega_0 = ${piMult}\\pi \\text{ rad/mẫu } (${deg}^\\circ)`,
    false
  );
  requestRedraw();
};

window.onRocTypeChange = function (val) {
  state.rocType = val;
  updateAllFormulasAndTables();
  requestRedraw();
};

window.onGainChange = function (val) {
  const g = parseFloat(val);
  if (!Number.isNaN(g) && Math.abs(g) > 1e-6) {
    state.gain = g;
    syncCoeffsFromRoots(true, false);
    requestRedraw();
  }
};

window.normalizePeakGain = function () {
  const freq = evaluateFrequencyResponse(
    rootsToPoly(state.zeros),
    rootsToPoly(state.poles),
    false,
    512
  );
  let maxM = 0;
  for (let i = 0; i < freq.mags.length; i++) {
    if (freq.mags[i] > maxM) maxM = freq.mags[i];
  }
  if (maxM > 1e-6) {
    state.gain = Number((1 / maxM).toFixed(4));
    syncCoeffsFromRoots(true, false);
    requestRedraw();
  }
};

window.clearAllPolesZeros = function () {
  state.zeros = [];
  state.poles = [];
  state.gain = 1.0;
  state.zViewRange = 1.42;
  syncCoeffsFromRoots(true, false);
  requestRedraw();
};

window.setPhaseChartMode = function (mode) {
  state.phaseChartMode = mode;
  document.getElementById('phaseModeBtn').className =
    mode === 'phase'
      ? 'px-3 py-1.5 rounded-md bg-[#0072bc] text-white font-semibold transition'
      : 'px-3 py-1.5 rounded-md theme-muted hover:opacity-80 transition';
  document.getElementById('groupDelayModeBtn').className =
    mode === 'groupDelay'
      ? 'px-3 py-1.5 rounded-md bg-[#0072bc] text-white font-semibold transition'
      : 'px-3 py-1.5 rounded-md theme-muted hover:opacity-80 transition';
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
        ? 'px-3 py-1.5 rounded-md bg-[#0072bc] text-white font-semibold transition'
        : 'px-3 py-1.5 rounded-md theme-muted hover:opacity-80 transition';
  });
  requestRedraw();
};

window.applyPreset = function (key) {
  if (!PRESETS[key]) return;
  const p = PRESETS[key];
  state.zeros = p.zeros.map(z => new Complex(z.re, z.im));
  state.poles = p.poles.map(pole => new Complex(pole.re, pole.im));
  state.gain = p.gain;
  state.rocType = p.rocType || 'causal';
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
  requestRedraw();
};

window.switchTab = function (tab) {
  const tabs = {
    simulator: ['tabSimulator', 'tabBtnSimulator'],
    guide: ['tabGuide', 'tabBtnGuide'],
    report: ['tabReport', 'tabBtnReport']
  };
  Object.entries(tabs).forEach(([k, [secId, btnId]]) => {
    const sec = document.getElementById(secId);
    const btn = document.getElementById(btnId);
    if (!sec || !btn) return;
    if (k === tab) {
      sec.classList.remove('hidden');
      btn.className = 'px-4 py-2.5 text-xs md:text-sm font-bold text-sky-400 border-b-2 border-sky-400 transition';
    } else {
      sec.classList.add('hidden');
      btn.className = 'px-4 py-2.5 text-xs md:text-sm font-semibold theme-muted hover:opacity-90 transition';
    }
  });
  if (tab === 'simulator') {
    setTimeout(() => requestRedraw(), 20);
  }
};

window.loadLabAndSwitch = function (presetKey) {
  const sel = document.getElementById('presetSelect');
  if (sel) sel.value = presetKey;
  applyPreset(presetKey);
  switchTab('simulator');
};

window.addEventListener('DOMContentLoaded', () => {
  renderStaticPageMath();
  initInteractions();
  setAppTheme('dark');
  applyPreset('resonator');
});
