/**
 * js/charts.js
 * High-DPI 60 FPS HTML5 Canvas Renderers
 * - Supports Dual Theme: Dark Mode (Xanh Tối Gốc #070b14) & Light Mode (Sáng #ffffff)
 * - High-visibility Re(z) / Im(z) axes with tick marks & arrowheads
 * - Signature Red ROC Boundary Circle (#ff3b30 / #ef4444) & distinct ROC shading
 * - Vibrant, Soft Sky-Blue Magnitude Spectrum (#38bdf8 / #60a5fa) with rich gradient fill
 */

function setupHiDPICanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(10, Math.floor(rect.width * dpr));
  const h = Math.max(10, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function getZScale(width, height, maxRadiusRange = 1.42) {
  const size = Math.min(width, height);
  const effectiveRange = Math.max(1.38, maxRadiusRange);
  return (size * 0.43) / effectiveRange;
}

function zToScreen(re, im, width, height, maxRadiusRange = 1.42) {
  const scale = getZScale(width, height, maxRadiusRange);
  const cx = width / 2;
  const cy = height / 2;
  return {
    x: cx + re * scale,
    y: cy - im * scale,
    scale,
    cx,
    cy
  };
}

function screenToZ(x, y, width, height, maxRadiusRange = 1.42) {
  const scale = getZScale(width, height, maxRadiusRange);
  const cx = width / 2;
  const cy = height / 2;
  return new Complex((x - cx) / scale, (cy - y) / scale);
}

/**
 * 1. Draw Interactive Z-Plane Canvas (Crystal-Clear Im-Re Axes + Signature Red ROC Boundary)
 */
function drawZPlaneCanvas(state) {
  const canvas = document.getElementById('zPlaneCanvas');
  if (!canvas) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas);
  const isLight = state.theme === 'light';

  // Canvas Background
  ctx.fillStyle = isLight ? '#ffffff' : '#070b14';
  ctx.fillRect(0, 0, width, height);

  const maxR = state.zViewRange || 1.42;
  const { scale, cx, cy } = zToScreen(0, 0, width, height, maxR);
  const rocInfo = analyzeRocAndStability(state.poles, state.rocType);
  const { rocInner, rocOuter } = rocInfo;

  // 1. Region of Convergence (ROC) Shading & Signature Red Boundary Circle
  ctx.save();
  const maxCanvasRadius = Math.hypot(width, height);
  const rInPx = Math.min(maxCanvasRadius, rocInner * scale);
  const rOutPx = rocOuter === Infinity ? maxCanvasRadius : Math.min(maxCanvasRadius, rocOuter * scale);

  if (rOutPx > rInPx + 0.5) {
    ctx.beginPath();
    ctx.arc(cx, cy, rOutPx, 0, 2 * Math.PI, false);
    if (rInPx > 0.5) {
      ctx.arc(cx, cy, rInPx, 0, 2 * Math.PI, true);
    }
    // Signature Red/Rose ROC Shading
    ctx.fillStyle = isLight
      ? 'rgba(239, 68, 68, 0.10)'
      : 'rgba(239, 68, 68, 0.15)';
    ctx.fill();

    // Signature Bright Red Dashed ROC Boundary Circle (#ff3b30 / #ef4444)
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = isLight ? '#dc2626' : '#ff453a';

    if (rocInner > 0.01 && rocInner < 8) {
      ctx.beginPath();
      ctx.arc(cx, cy, rInPx, 0, 2 * Math.PI);
      ctx.stroke();

      // Label the Red ROC Boundary directly on the Z-Plane
      ctx.setLineDash([]);
      ctx.font = '600 11px JetBrains Mono, monospace';
      ctx.fillStyle = isLight ? '#dc2626' : '#ff6961';
      const labelAngle = -Math.PI / 4;
      const lx = cx + (rInPx + 8) * Math.cos(labelAngle);
      const ly = cy - (rInPx + 8) * Math.sin(labelAngle);
      ctx.fillText(`Biên ROC |z|=${rocInner.toFixed(2)}`, lx, ly);
    }
    if (rocOuter < 8) {
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, rOutPx, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.font = '600 11px JetBrains Mono, monospace';
      ctx.fillStyle = isLight ? '#dc2626' : '#ff6961';
      const labelAngle = -Math.PI / 4;
      const lx = cx + (rOutPx + 8) * Math.cos(labelAngle);
      const ly = cy - (rOutPx + 8) * Math.sin(labelAngle);
      ctx.fillText(`Biên ROC |z|=${rocOuter.toFixed(2)}`, lx, ly);
    }
  }
  ctx.restore();

  // 2. High-Visibility Polar Grid & Re(z) / Im(z) Coordinate Axes
  ctx.save();
  ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(100, 116, 139, 0.35)';
  ctx.lineWidth = 1.1;
  [0.5, 1.5, 2.0].forEach(r => {
    if (r <= maxR * 1.1) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, 2 * Math.PI);
      ctx.stroke();
    }
  });

  // Radial angle rays every 30 deg
  for (let deg = 0; deg < 180; deg += 30) {
    if (deg === 0 || deg === 90) continue;
    const rad = (deg * Math.PI) / 180;
    const len = maxR * 1.05 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - len * Math.cos(rad), cy - len * Math.sin(rad));
    ctx.lineTo(cx + len * Math.cos(rad), cy + len * Math.sin(rad));
    ctx.stroke();
  }

  // Bold Main Real & Imaginary Axes
  const axisColor = isLight ? '#334155' : '#94a3b8';
  ctx.strokeStyle = axisColor;
  ctx.fillStyle = axisColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(8, cy);
  ctx.lineTo(width - 8, cy);
  ctx.moveTo(cx, height - 8);
  ctx.lineTo(cx, 8);
  ctx.stroke();

  // Arrowheads for +Re(z) and +Im(z)
  ctx.beginPath();
  ctx.moveTo(width - 8, cy);
  ctx.lineTo(width - 16, cy - 4.5);
  ctx.lineTo(width - 16, cy + 4.5);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, 8);
  ctx.lineTo(cx - 4.5, 16);
  ctx.lineTo(cx + 4.5, 16);
  ctx.closePath();
  ctx.fill();

  // Tick marks at +-0.5, +-1.0 on Re and Im axes
  ctx.font = '600 11px JetBrains Mono, monospace';
  ctx.fillStyle = isLight ? '#0f172a' : '#e2e8f0';
  [-1, -0.5, 0.5, 1].forEach(val => {
    const tx = cx + val * scale;
    const ty = cy - val * scale;
    ctx.beginPath();
    ctx.moveTo(tx, cy - 4);
    ctx.lineTo(tx, cy + 4);
    ctx.moveTo(cx - 4, ty);
    ctx.lineTo(cx + 4, ty);
    ctx.stroke();
  });

  // Unit Circle |z| = 1 (Bright Sky Blue)
  ctx.beginPath();
  ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
  ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
  ctx.lineWidth = 2.6;
  ctx.stroke();

  // Clear Axis & Unit Circle Labels
  ctx.fillStyle = isLight ? '#0b2559' : '#f8fafc';
  ctx.font = '700 12px JetBrains Mono, monospace';
  ctx.fillText('Re(z)', width - 48, cy - 10);
  ctx.fillText('Im(z)', cx + 10, 20);

  ctx.font = '600 11.5px JetBrains Mono, monospace';
  ctx.fillText('1', cx + scale + 6, cy + 16);
  ctx.fillText('-1', cx - scale - 22, cy + 16);
  ctx.fillText('0.5', cx + 0.5 * scale - 10, cy + 16);
  ctx.fillText('-0.5', cx - 0.5 * scale - 16, cy + 16);
  ctx.fillText('j', cx + 8, cy - scale - 6);
  ctx.fillText('-j', cx + 8, cy + scale + 15);

  ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
  ctx.fillText('Đường tròn đơn vị |z|=1', cx - scale * 0.92, cy - scale - 8);
  ctx.restore();

  // 3. Geometric Vectors from Poles & Zeros to Probe Point e^{jw_0}
  const probeZ = Complex.fromPolar(1.0, state.omega0);
  const probePt = zToScreen(probeZ.re, probeZ.im, width, height, maxR);

  if (state.showVectors) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    state.zeros.forEach(z => {
      const p = zToScreen(z.re, z.im, width, height, maxR);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(probePt.x, probePt.y);
      ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.8)' : 'rgba(56, 189, 248, 0.85)';
      ctx.stroke();
    });

    state.poles.forEach(pole => {
      const p = zToScreen(pole.re, pole.im, width, height, maxR);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(probePt.x, probePt.y);
      ctx.strokeStyle = isLight ? 'rgba(220, 38, 38, 0.8)' : 'rgba(255, 69, 58, 0.85)';
      ctx.stroke();
    });
    ctx.restore();
  }

  // 4. Draw Zeros (Glowing Sky-Cyan Circles 'o') + Coordinate Callout
  state.zeros.forEach((z, idx) => {
    const pt = zToScreen(z.re, z.im, width, height, maxR);
    const isHovered =
      state.hoveredRoot && state.hoveredRoot.type === 'zero' && state.hoveredRoot.index === idx;
    ctx.save();
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 14, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isHovered ? 8.2 : 6.8, 0, 2 * Math.PI);
    ctx.fillStyle = isLight ? '#ffffff' : '#070b14';
    ctx.fill();
    ctx.lineWidth = isHovered ? 3.2 : 2.6;
    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.stroke();

    if (state.zeros.length <= 6) {
      const sign = z.im >= 0 ? '+' : '-';
      const txt =
        Math.abs(z.im) < 0.01
          ? `z${idx + 1}(${z.re.toFixed(2)})`
          : `z${idx + 1}(${z.re.toFixed(2)}${sign}j${Math.abs(z.im).toFixed(2)})`;
      ctx.font = '600 10.5px JetBrains Mono, monospace';
      ctx.fillStyle = isLight ? '#0369a1' : '#7dd3fc';
      ctx.fillText(txt, pt.x + 10, pt.y - 7);
    }
    ctx.restore();
  });

  // 5. Draw Poles (Bright Red Crosses 'x') + Coordinate Callout
  state.poles.forEach((pole, idx) => {
    const pt = zToScreen(pole.re, pole.im, width, height, maxR);
    const isHovered =
      state.hoveredRoot && state.hoveredRoot.type === 'pole' && state.hoveredRoot.index === idx;
    const r = isHovered ? 8.2 : 6.8;
    ctx.save();
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 14, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 69, 58, 0.25)';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(pt.x - r, pt.y - r);
    ctx.lineTo(pt.x + r, pt.y + r);
    ctx.moveTo(pt.x + r, pt.y - r);
    ctx.lineTo(pt.x - r, pt.y + r);
    ctx.lineWidth = isHovered ? 3.5 : 2.8;
    ctx.strokeStyle = isLight ? '#dc2626' : '#ff453a';
    ctx.stroke();

    if (state.poles.length <= 6) {
      const sign = pole.im >= 0 ? '+' : '-';
      const txt =
        Math.abs(pole.im) < 0.01
          ? `p${idx + 1}(${pole.re.toFixed(2)})`
          : `p${idx + 1}(${pole.re.toFixed(2)}${sign}j${Math.abs(pole.im).toFixed(2)})`;
      ctx.font = '600 10.5px JetBrains Mono, monospace';
      ctx.fillStyle = isLight ? '#b91c1c' : '#fca5a5';
      ctx.fillText(txt, pt.x + 10, pt.y + 14);
    }
    ctx.restore();
  });

  // 6. Draw Frequency Probe Point e^{jw_0} on Unit Circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(probePt.x, probePt.y, 7, 0, 2 * Math.PI);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isLight ? '#ffffff' : '#070b14';
  ctx.stroke();
  ctx.restore();
}

/**
 * Helper to draw frequency chart grid & axes
 */
function drawFreqGrid(ctx, pad, plotW, plotH, yMin, yMax, fullRange, unitText, isLight) {
  ctx.save();
  ctx.strokeStyle = isLight ? '#e2e8f0' : 'rgba(71, 85, 105, 0.5)';
  ctx.fillStyle = isLight ? '#334155' : '#cbd5e1';
  ctx.font = '500 11px JetBrains Mono, monospace';
  ctx.lineWidth = 1;

  const ySteps = 4;
  ctx.textAlign = 'right';
  for (let i = 0; i <= ySteps; i++) {
    const yVal = yMin + (i / ySteps) * (yMax - yMin);
    const y = pad.top + plotH - (i / ySteps) * plotH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillText(yVal.toFixed(yMax - yMin > 12 ? 0 : 1), pad.left - 8, y + 4);
  }

  ctx.textAlign = 'center';
  const xLabels = fullRange
    ? ['-π', '-0.5π', '0', '0.5π', 'π']
    : ['0', '0.25π', '0.5π', '0.75π', 'π'];
  for (let i = 0; i < xLabels.length; i++) {
    const x = pad.left + (i / (xLabels.length - 1)) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.fillText(xLabels[i], x, pad.top + plotH + 18);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = isLight ? '#0b2559' : '#94a3b8';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillText(`Đơn vị: ${unitText}`, pad.left + plotW, pad.top - 7);
  ctx.restore();
}

function drawOmegaProbeLine(ctx, pad, plotW, plotH, omega0, fullRange, val, yMin, yMax, isLight) {
  const wMin = fullRange ? -Math.PI : 0;
  const wMax = Math.PI;
  const w = fullRange ? omega0 : Math.abs(omega0);
  if (w < wMin || w > wMax) return;

  const x = pad.left + ((w - wMin) / (wMax - wMin)) * plotW;
  const clamped = Math.max(yMin, Math.min(yMax, val));
  const y = pad.top + plotH - ((clamped - yMin) / (yMax - yMin)) * plotH;

  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.moveTo(x, pad.top);
  ctx.lineTo(x, pad.top + plotH);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.arc(x, y, 5.8, 0, 2 * Math.PI);
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.strokeStyle = isLight ? '#ffffff' : '#070b14';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

/**
 * 2 & 3. Draw Magnitude (Vibrant Soft Sky-Blue) and Phase / Group Delay Charts
 */
function drawFrequencyCharts(state) {
  const isLight = state.theme === 'light';
  const freqData = evaluateFrequencyResponse(
    state.bCoeffs,
    state.aCoeffs,
    state.fullFreqRange,
    512
  );
  state.freqData = freqData;

  let maxMag = 0;
  for (let i = 0; i < freqData.mags.length; i++) {
    if (freqData.mags[i] > maxMag) maxMag = freqData.mags[i];
  }
  const maxDb = 20 * Math.log10(Math.max(maxMag, 1e-6));

  const Hw0 = evaluateHzAtOmega(state.bCoeffs, state.aCoeffs, state.omega0);
  const magW0 = Hw0.abs();
  const dbW0 = 20 * Math.log10(Math.max(magW0, 1e-6));
  const degW0 = (Hw0.arg() * 180) / Math.PI;

  const pad = { left: 56, right: 24, top: 24, bottom: 28 };

  // --- Magnitude Chart (Brighter, Fuller Soft Sky-Blue Spectrum) ---
  const magCanvas = document.getElementById('magCanvas');
  if (magCanvas) {
    const { ctx, width, height } = setupHiDPICanvas(magCanvas);
    ctx.fillStyle = isLight ? '#ffffff' : '#070b14';
    ctx.fillRect(0, 0, width, height);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const yMin = state.magDb ? -60 : 0;
    const yMax = state.magDb
      ? Math.max(10, Math.ceil((maxDb + 5) / 10) * 10)
      : Math.max(1.2, maxMag * 1.15);

    drawFreqGrid(
      ctx,
      pad,
      plotW,
      plotH,
      yMin,
      yMax,
      state.fullFreqRange,
      state.magDb ? 'dB' : 'Biên độ tuyến tính',
      isLight
    );

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < freqData.mags.length; i++) {
      const val = state.magDb
        ? Math.max(-60, 20 * Math.log10(Math.max(freqData.mags[i], 1e-6)))
        : freqData.mags[i];
      const x = pad.left + (i / (freqData.mags.length - 1)) * plotW;
      const y = pad.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Luminous Soft Sky-Blue Curve (#60a5fa / #38bdf8)
    ctx.strokeStyle = isLight ? '#0284c7' : '#60a5fa';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    ctx.lineTo(pad.left + plotW, pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    if (isLight) {
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.38)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.04)');
    } else {
      grad.addColorStop(0, 'rgba(96, 165, 250, 0.45)');
      grad.addColorStop(0.65, 'rgba(56, 189, 248, 0.18)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    drawOmegaProbeLine(
      ctx,
      pad,
      plotW,
      plotH,
      state.omega0,
      state.fullFreqRange,
      state.magDb ? Math.max(-60, dbW0) : magW0,
      yMin,
      yMax,
      isLight
    );
  }

  // --- Phase / Group Delay Chart ---
  const phaseCanvas = document.getElementById('phaseCanvas');
  if (phaseCanvas) {
    const { ctx, width, height } = setupHiDPICanvas(phaseCanvas);
    ctx.fillStyle = isLight ? '#ffffff' : '#070b14';
    ctx.fillRect(0, 0, width, height);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const isGd = state.phaseChartMode === 'groupDelay';
    const arr = isGd ? freqData.groupDelay : freqData.phasesDeg;

    let pMin = -180;
    let pMax = 180;
    if (isGd) {
      let minG = Infinity, maxG = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] < minG) minG = arr[i];
        if (arr[i] > maxG) maxG = arr[i];
      }
      pMin = Math.min(-2, Math.floor(minG - 1));
      pMax = Math.max(8, Math.ceil(maxG + 1));
    }

    drawFreqGrid(
      ctx,
      pad,
      plotW,
      plotH,
      pMin,
      pMax,
      state.fullFreqRange,
      isGd ? 'Mẫu (Samples)' : 'Độ (°)',
      isLight
    );

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) {
      const x = pad.left + (i / (arr.length - 1)) * plotW;
      const clamped = Math.max(pMin, Math.min(pMax, arr[i]));
      const y = pad.top + plotH - ((clamped - pMin) / (pMax - pMin)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = isGd ? '#a855f7' : '#f472b6';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    const wMin = state.fullFreqRange ? -Math.PI : 0;
    const wProbe = state.fullFreqRange ? state.omega0 : Math.abs(state.omega0);
    const probeIdx = Math.max(
      0,
      Math.min(arr.length - 1, Math.round(((wProbe - wMin) / (Math.PI - wMin)) * (arr.length - 1)))
    );
    drawOmegaProbeLine(
      ctx,
      pad,
      plotW,
      plotH,
      state.omega0,
      state.fullFreqRange,
      arr[probeIdx],
      pMin,
      pMax,
      isLight
    );
  }

  return { maxMag, maxDb, magW0, dbW0, degW0 };
}

/**
 * 4. Draw Time-Domain Impulse Response h[n] & Step Response s[n]
 */
function drawImpulseResponseChart(state) {
  const canvas = document.getElementById('impulseCanvas');
  if (!canvas) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas);
  const isLight = state.theme === 'light';

  ctx.fillStyle = isLight ? '#ffffff' : '#070b14';
  ctx.fillRect(0, 0, width, height);

  const { nIndices, x: inSig, y: outSig } = computeTimeDomainResponse(
    state.bCoeffs,
    state.aCoeffs,
    state.poles,
    state.rocType,
    state.numSamples,
    state.timeChartMode
  );

  const pad = { left: 56, right: 24, top: 24, bottom: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  let maxAbs = 0.1;
  for (let i = 0; i < outSig.length; i++) {
    maxAbs = Math.max(maxAbs, Math.abs(outSig[i]));
    if (state.timeChartMode === 'signal') {
      maxAbs = Math.max(maxAbs, Math.abs(inSig[i]));
    }
  }
  maxAbs *= 1.15;

  const zeroY = pad.top + plotH / 2;

  ctx.save();
  ctx.font = '500 11px JetBrains Mono, monospace';
  ctx.fillStyle = isLight ? '#334155' : '#cbd5e1';
  ctx.textAlign = 'right';

  [-1, -0.5, 0, 0.5, 1].forEach(frac => {
    const y = zeroY - frac * (plotH / 2);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.strokeStyle =
      frac === 0
        ? isLight ? '#64748b' : 'rgba(148, 163, 184, 0.8)'
        : isLight ? '#e2e8f0' : 'rgba(51, 65, 85, 0.45)';
    ctx.lineWidth = frac === 0 ? 1.5 : 1;
    ctx.stroke();

    const val = frac * maxAbs;
    const label = Math.abs(val) >= 100 ? val.toExponential(1) : val.toFixed(Math.abs(maxAbs) > 10 ? 1 : 2);
    ctx.fillText(label, pad.left - 8, y + 4);
  });

  // Highlight vertical origin line n = 0
  const n0Idx = nIndices.indexOf(0);
  if (n0Idx !== -1) {
    const x0 = pad.left + (n0Idx / (nIndices.length - 1)) * plotW;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(x0, pad.top);
    ctx.lineTo(x0, pad.top + plotH);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.textAlign = 'center';
  const numSamples = nIndices.length;
  const stepN = Math.max(4, Math.round(numSamples / 8));
  for (let i = 0; i < numSamples; i += stepN) {
    const x = pad.left + (i / (numSamples - 1)) * plotW;
    ctx.fillText(`n=${nIndices[i]}`, x, pad.top + plotH + 18);
  }

  if (state.timeChartMode === 'signal') {
    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = pad.left + (i / (numSamples - 1)) * plotW;
      const y = zeroY - (inSig[i] / maxAbs) * (plotH / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = pad.left + (i / (numSamples - 1)) * plotW;
      const y = zeroY - (outSig[i] / maxAbs) * (plotH / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.4;
    ctx.stroke();
  } else {
    for (let i = 0; i < numSamples; i++) {
      const x = pad.left + (i / (numSamples - 1)) * plotW;
      const y = zeroY - (outSig[i] / maxAbs) * (plotH / 2);

      ctx.beginPath();
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = nIndices[i] < 0 ? '#f43f5e' : '#60a5fa';
      ctx.lineWidth = 1.9;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, numSamples > 80 ? 2.6 : 3.6, 0, 2 * Math.PI);
      ctx.fillStyle = nIndices[i] < 0 ? '#f43f5e' : '#60a5fa';
      ctx.fill();
    }
  }

  ctx.restore();
}
