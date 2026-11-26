/**
 * js/charts.js
 * High-DPI 60 FPS HTML5 Canvas Renderers (Engineering Studio Standard):
 * - 2D Interactive Z-Plane (Im-Re, Signature Red ROC, Origin Multiplicity, Collision-Free Labels)
 * - 3D Interactive |H(z)| Surface Plot with Unit Circle |z|=1 Slice & Probe e^{jw_0}
 * - Magnitude Spectrum with -3dB Reference Badge & Hover Probe
 * - Wrapped Phase (jump-free), Unwrapped Phase, and Analytical Group Delay
 * - Time-Domain Impulse h[n], Step s[n], and Signal Filtering x[n] -> y[n]
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
  const effectiveRange = Math.max(0.6, maxRadiusRange);
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
 * Unified Dual-Theme Color Tokens (>= 4.5:1 text contrast in both Dark & Light modes)
 */
function getChartTheme(isLight) {
  if (isLight) {
    return {
      isLight: true,
      bg: '#ffffff',
      originGlowInner: 'rgba(2, 132, 199, 0.06)',
      originGlowOuter: 'rgba(2, 132, 199, 0)',
      grid: '#e2e8f0',
      gridRadial: 'rgba(148, 163, 184, 0.22)',
      axis: '#334155',
      axisTickText: '#0b2559',
      axisHeading: '#0b2559',
      mutedText: '#475569',
      unitCircle: '#0284c7',
      unitCircleGlow: 'rgba(2, 132, 199, 0.16)',
      zero: '#0284c7',
      zeroText: '#0369a1',
      zeroGlow: 'rgba(2, 132, 199, 0.22)',
      pole: '#dc2626',
      poleAlt: '#e11d48',
      poleText: '#b91c1c',
      poleGlow: 'rgba(220, 38, 38, 0.20)',
      rocFill: 'rgba(220, 38, 38, 0.09)',
      rocStroke: '#dc2626',
      rocText: '#b91c1c',
      probe: '#f59e0b',
      probeStroke: '#ffffff',
      probeOuterRing: '#0b2559',
      probeGlow: 'rgba(245, 158, 11, 0.35)',
      probeText: '#92400e',
      magStroke: '#0284c7',
      magGlow: 'rgba(2, 132, 199, 0.18)',
      phaseWrapped: '#db2777',
      phaseUnwrapped: '#059669',
      groupDelay: '#7c3aed',
      signalIn: 'rgba(71, 85, 105, 0.85)',
      signalOut: '#059669',
      signalOutText: '#047857',
      stemCausal: '#0284c7',
      stemCausalText: '#0369a1',
      stemAnti: '#dc2626',
      stemAntiText: '#b91c1c',
      pillBg: 'rgba(248, 250, 252, 0.94)',
      pillBorder: 'rgba(203, 213, 225, 0.95)',
      warnText: '#92400e',
      warnBg: 'rgba(254, 243, 199, 0.95)',
      warnBorder: 'rgba(217, 119, 6, 0.5)'
    };
  }
  return {
    isLight: false,
    bg: '#0b0c10',
    originGlowInner: 'rgba(56, 189, 248, 0.08)',
    originGlowOuter: 'rgba(56, 189, 248, 0)',
    grid: 'rgba(148, 163, 184, 0.16)',
    gridRadial: 'rgba(148, 163, 184, 0.16)',
    axis: '#94a3b8',
    axisTickText: '#cbd5e1',
    axisHeading: '#f8fafc',
    mutedText: '#94a3b8',
    unitCircle: '#38bdf8',
    unitCircleGlow: 'rgba(56, 189, 248, 0.42)',
    zero: '#38bdf8',
    zeroText: '#7dd3fc',
    zeroGlow: 'rgba(56, 189, 248, 0.36)',
    pole: '#ff453a',
    poleAlt: '#fb7185',
    poleText: '#fda4af',
    poleGlow: 'rgba(255, 69, 58, 0.36)',
    rocFill: 'rgba(255, 69, 58, 0.14)',
    rocStroke: '#ff453a',
    rocText: '#ff8a80',
    probe: '#fbbf24',
    probeStroke: '#070b14',
    probeOuterRing: '#fef3c7',
    probeGlow: 'rgba(251, 191, 36, 0.45)',
    probeText: '#fde68a',
    magStroke: '#38bdf8',
    magGlow: 'rgba(56, 189, 248, 0.38)',
    phaseWrapped: '#f472b6',
    phaseUnwrapped: '#34d399',
    groupDelay: '#a855f7',
    signalIn: 'rgba(148, 163, 184, 0.72)',
    signalOut: '#34d399',
    signalOutText: '#34d399',
    stemCausal: '#38bdf8',
    stemCausalText: '#7dd3fc',
    stemAnti: '#fb7185',
    stemAntiText: '#fda4af',
    pillBg: 'rgba(15, 23, 42, 0.88)',
    pillBorder: 'rgba(51, 65, 85, 0.9)',
    warnText: '#fde68a',
    warnBg: 'rgba(120, 53, 15, 0.55)',
    warnBorder: 'rgba(251, 191, 36, 0.45)'
  };
}

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function measurePillBox(ctx, text, x, y, opts = {}) {
  const font = opts.font || '600 10.5px JetBrains Mono, monospace';
  const padX = opts.padX !== undefined ? opts.padX : 6;
  const padY = opts.padY !== undefined ? opts.padY : 3;
  const align = opts.align || 'left';
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const w = tw + padX * 2;
  const h = (opts.fontSize || 11) + padY * 2;
  let bx = x;
  if (align === 'center') bx = x - w / 2;
  else if (align === 'right') bx = x - w;
  return { x: bx, y, w, h, tw, padX, padY };
}

function drawPillBadge(ctx, text, x, y, opts = {}) {
  const box = measurePillBox(ctx, text, x, y, opts);
  ctx.save();
  drawRoundedRectPath(ctx, box.x, box.y, box.w, box.h, opts.radius !== undefined ? opts.radius : 6);
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fill();
  }
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = opts.borderWidth || 1;
    ctx.stroke();
  }
  ctx.font = opts.font || '600 10.5px JetBrains Mono, monospace';
  ctx.fillStyle = opts.color || '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, box.x + box.padX, box.y + box.h / 2 + 0.5);
  ctx.restore();
  return box;
}

function boxesOverlap(a, b, margin = 4) {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

function clampBoxToCanvas(box, width, height, edgePad = 6) {
  return {
    ...box,
    x: Math.max(edgePad, Math.min(width - box.w - edgePad, box.x)),
    y: Math.max(edgePad, Math.min(height - box.h - edgePad, box.y))
  };
}

function placeNonOverlappingBadge(ctx, text, candidates, placedBoxes, width, height, opts = {}) {
  const align0 = (candidates[0] && candidates[0].align) || 'left';
  const baseBox = candidates[0] || { x: width / 2, y: height / 2, align: align0 };

  const tryPlace = (x, y, align) => {
    const raw = measurePillBox(ctx, text, x, y, { ...opts, align: align || 'left' });
    const clamped = clampBoxToCanvas(raw, width, height, 6);
    const hits = placedBoxes.some(b => boxesOverlap(clamped, b, 4));
    return { clamped, hits };
  };

  let chosen = null;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const { clamped, hits } = tryPlace(c.x, c.y, c.align);
    if (!hits) {
      chosen = clamped;
      break;
    }
    if (!chosen) chosen = clamped;
  }

  // Spiral ring fallback if every primary candidate collided
  if (placedBoxes.some(b => boxesOverlap(chosen, b, 4))) {
    const radii = [18, 28, 38, 50];
    outer: for (let rIdx = 0; rIdx < radii.length; rIdx++) {
      const rad = radii[rIdx];
      for (let step = 0; step < 12; step++) {
        const ang = (step / 12) * 2 * Math.PI;
        const cx = baseBox.x + Math.cos(ang) * rad;
        const cy = baseBox.y + Math.sin(ang) * rad;
        const { clamped, hits } = tryPlace(cx, cy, 'center');
        if (!hits) {
          chosen = clamped;
          break outer;
        }
      }
    }
  }

  if (chosen) {
    drawPillBadge(ctx, text, chosen.x, chosen.y, { ...opts, align: 'left' });
    placedBoxes.push(chosen);
  }
  return chosen;
}

function drawHaloText(ctx, text, x, y, fillColor, haloColor, align = 'left') {
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = haloColor;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * 1A. Draw 2D Interactive Z-Plane Canvas
 */
function drawZPlaneCanvas(state) {
  const canvas = document.getElementById('zPlaneCanvas');
  if (!canvas) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas);
  const t = getChartTheme(state.theme === 'light');
  const placedBoxes = [];

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, width, height);

  const maxR = state.zViewRange || 1.42;
  const { scale, cx, cy } = zToScreen(0, 0, width, height, maxR);
  const rocInfo = analyzeRocAndStability(state.poles, state.rocType);
  const { rocInner, rocOuter } = rocInfo;

  // Subtle origin observatory radial glow
  ctx.save();
  const glowR = Math.min(width, height) * 0.42;
  const originGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, glowR);
  originGrad.addColorStop(0, t.originGlowInner);
  originGrad.addColorStop(1, t.originGlowOuter);
  ctx.fillStyle = originGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 1. ROC Shading & Signature Red Dashed Boundary
  ctx.save();
  const maxCanvasRadius = Math.hypot(width, height);
  const rInPx = Math.min(maxCanvasRadius, rocInner * scale);
  const rOutPx = rocOuter === Infinity ? maxCanvasRadius : Math.min(maxCanvasRadius, rocOuter * scale);
  const rocRingsToLabel = [];

  if (rOutPx > rInPx + 0.5 && !(state.rocType === 'stable' && rocInfo.poleOnUnitCircle)) {
    ctx.beginPath();
    ctx.arc(cx, cy, rOutPx, 0, 2 * Math.PI, false);
    if (rInPx > 0.5) {
      ctx.arc(cx, cy, rInPx, 0, 2 * Math.PI, true);
    }
    ctx.fillStyle = t.rocFill;
    ctx.fill();

    ctx.setLineDash([8, 5]);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = t.rocStroke;

    if (rocInner > 0.01 && rocInner < maxR * 3) {
      ctx.beginPath();
      ctx.arc(cx, cy, rInPx, 0, 2 * Math.PI);
      ctx.stroke();
      rocRingsToLabel.push({ rPx: rInPx, val: rocInner, kind: 'inner' });
    }
    if (rocOuter < maxR * 3) {
      ctx.beginPath();
      ctx.arc(cx, cy, rOutPx, 0, 2 * Math.PI);
      ctx.stroke();
      rocRingsToLabel.push({ rPx: rOutPx, val: rocOuter, kind: 'outer' });
    }
  }
  ctx.restore();

  // 2. Polar Grid & Cartesian Axes
  ctx.save();
  ctx.strokeStyle = t.grid;
  ctx.lineWidth = 1;
  [0.5, 1.5, 2.0, 2.5, 3.0].forEach(r => {
    if (r <= maxR * 1.25) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, 2 * Math.PI);
      ctx.stroke();
    }
  });

  for (let deg = 0; deg < 180; deg += 30) {
    if (deg === 0 || deg === 90) continue;
    const rad = (deg * Math.PI) / 180;
    const len = maxR * 1.18 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - len * Math.cos(rad), cy - len * Math.sin(rad));
    ctx.lineTo(cx + len * Math.cos(rad), cy + len * Math.sin(rad));
    ctx.stroke();
  }

  // Primary Axes
  ctx.strokeStyle = t.axis;
  ctx.fillStyle = t.axis;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(10, cy);
  ctx.lineTo(width - 10, cy);
  ctx.moveTo(cx, height - 10);
  ctx.lineTo(cx, 10);
  ctx.stroke();

  // Arrowheads
  ctx.beginPath();
  ctx.moveTo(width - 8, cy);
  ctx.lineTo(width - 16, cy - 4.2);
  ctx.lineTo(width - 16, cy + 4.2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, 8);
  ctx.lineTo(cx - 4.2, 16);
  ctx.lineTo(cx + 4.2, 16);
  ctx.closePath();
  ctx.fill();

  // Tick marks
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

  // Unit Circle |z| = 1 with soft outer glow
  ctx.save();
  const isSnapUC = state.snapHint === 'unitCircle';
  ctx.beginPath();
  ctx.arc(cx, cy, scale, 0, 2 * Math.PI);
  ctx.shadowColor = isSnapUC ? t.probeGlow : t.unitCircleGlow;
  ctx.shadowBlur = isSnapUC ? 14 : t.isLight ? 4 : 10;
  ctx.strokeStyle = isSnapUC ? t.probe : t.unitCircle;
  ctx.lineWidth = isSnapUC ? 3.2 : 2.4;
  ctx.stroke();
  ctx.restore();

  // Axis Headings & Crisp Tick Labels (with background halo for high legibility)
  ctx.font = '700 12px JetBrains Mono, monospace';
  drawHaloText(ctx, 'Re(z)', width - 12, cy - 10, t.axisHeading, t.bg, 'right');
  drawHaloText(ctx, 'Im(z)', cx + 10, 20, t.axisHeading, t.bg, 'left');

  ctx.font = '600 11px JetBrains Mono, monospace';
  drawHaloText(ctx, '1', cx + scale + 6, cy + 16, t.axisTickText, t.bg, 'left');
  drawHaloText(ctx, '-1', cx - scale - 6, cy + 16, t.axisTickText, t.bg, 'right');
  if (scale > 62) {
    drawHaloText(ctx, '0.5', cx + 0.5 * scale, cy + 16, t.axisTickText, t.bg, 'center');
    drawHaloText(ctx, '-0.5', cx - 0.5 * scale, cy + 16, t.axisTickText, t.bg, 'center');
  }
  drawHaloText(ctx, 'j', cx + 9, cy - scale - 6, t.axisTickText, t.bg, 'left');
  drawHaloText(ctx, '-j', cx + 9, cy + scale + 15, t.axisTickText, t.bg, 'left');
  ctx.restore();

  // Top-left Unit Circle badge (registered so ROC/root labels never overlap it)
  const ucBadgeText = state.snapHint === 'unitCircle'
    ? '● Bắt dính |z| = 1'
    : '○ Đường tròn đơn vị |z|=1';
  const ucBadge = drawPillBadge(ctx, ucBadgeText, 10, 10, {
    font: '600 10.5px Inter, sans-serif',
    fontSize: 11,
    color: state.snapHint === 'unitCircle' ? t.probeText : t.zeroText,
    bg: state.snapHint === 'unitCircle' ? t.warnBg : t.pillBg,
    border: state.snapHint === 'unitCircle' ? t.warnBorder : t.pillBorder,
    padX: 8,
    padY: 4
  });
  placedBoxes.push(ucBadge);

  // Reserve axis areas so coordinate callouts avoid sitting directly on top of axis headings
  placedBoxes.push({ x: width - 58, y: cy - 26, w: 54, h: 22 });
  placedBoxes.push({ x: cx + 6, y: 6, w: 46, h: 20 });

  // Pre-compute probe point and reserve marker hitboxes so badges never cover poles, zeros, or e^{jω₀}
  const probeZ = Complex.fromPolar(1.0, state.omega0);
  const probePt = zToScreen(probeZ.re, probeZ.im, width, height, maxR);
  placedBoxes.push({ x: probePt.x - 9, y: probePt.y - 9, w: 18, h: 18 });
  state.zeros.forEach(z => {
    const pt = zToScreen(z.re, z.im, width, height, maxR);
    placedBoxes.push({ x: pt.x - 8, y: pt.y - 8, w: 16, h: 16 });
  });
  state.poles.forEach(pole => {
    const pt = zToScreen(pole.re, pole.im, width, height, maxR);
    placedBoxes.push({ x: pt.x - 8, y: pt.y - 8, w: 16, h: 16 });
  });

  // Place ROC boundary labels cleanly without overlapping
  rocRingsToLabel.forEach((ring, idx) => {
    const labelText = `Biên ROC |z|=${ring.val.toFixed(2)}`;
    const baseAngles = idx === 0
      ? [-Math.PI * 0.65, -Math.PI * 0.35, Math.PI * 0.62, Math.PI * 0.35]
      : [Math.PI * 0.62, -Math.PI * 0.35, Math.PI * 0.35, -Math.PI * 0.65];
    const candidates = baseAngles.map(ang => {
      const px = cx + (ring.rPx + 10) * Math.cos(ang);
      const py = cy - (ring.rPx + 10) * Math.sin(ang);
      return { x: px, y: py - 10, align: Math.cos(ang) < 0 ? 'right' : 'left' };
    });
    placeNonOverlappingBadge(ctx, labelText, candidates, placedBoxes, width, height, {
      font: '600 10.5px JetBrains Mono, monospace',
      fontSize: 10.5,
      color: t.rocText,
      bg: t.pillBg,
      border: t.rocStroke,
      borderWidth: 1,
      padX: 6,
      padY: 3
    });
  });

  // 2B. Origin Multiplicity (poles or zeros at z=0)
  const originOrder = getOriginMultiplicity(state.bCoeffs, state.aCoeffs);
  if (state.showOriginRoots && originOrder !== 0) {
    ctx.save();
    const count = Math.abs(originOrder);
    if (originOrder > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, 2 * Math.PI);
      ctx.fillStyle = t.bg;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = t.zero;
      ctx.stroke();
      placeNonOverlappingBadge(
        ctx,
        `○×${count} (z=0)`,
        [
          { x: cx + 10, y: cy - 24, align: 'left' },
          { x: cx + 10, y: cy + 8, align: 'left' },
          { x: cx - 10, y: cy - 24, align: 'right' }
        ],
        placedBoxes,
        width,
        height,
        {
          font: '700 10px JetBrains Mono, monospace',
          fontSize: 10,
          color: t.zeroText,
          bg: t.pillBg,
          border: t.pillBorder,
          padX: 5,
          padY: 2.5
        }
      );
    } else {
      const r = 5.5;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r);
      ctx.lineTo(cx - r, cy + r);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = t.pole;
      ctx.stroke();
      placeNonOverlappingBadge(
        ctx,
        `×${count} (z=0)`,
        [
          { x: cx + 10, y: cy - 24, align: 'left' },
          { x: cx + 10, y: cy + 8, align: 'left' },
          { x: cx - 10, y: cy - 24, align: 'right' }
        ],
        placedBoxes,
        width,
        height,
        {
          font: '700 10px JetBrains Mono, monospace',
          fontSize: 10,
          color: t.poleText,
          bg: t.pillBg,
          border: t.pillBorder,
          padX: 5,
          padY: 2.5
        }
      );
    }
    ctx.restore();
  }

  // 3. Geometric Vectors from Poles & Zeros to Probe Point e^{jw_0}
  const totalRoots = state.zeros.length + state.poles.length;
  const vectorBadges = [];

  if (state.showVectors) {
    ctx.save();
    ctx.lineCap = 'round';

    state.zeros.forEach(z => {
      const p = zToScreen(z.re, z.im, width, height, maxR);
      ctx.beginPath();
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(probePt.x, probePt.y);
      ctx.strokeStyle = t.isLight ? 'rgba(2, 132, 199, 0.78)' : 'rgba(56, 189, 248, 0.85)';
      ctx.stroke();

      if (totalRoots <= 6) {
        const dist = probeZ.sub(z).abs();
        vectorBadges.push({
          text: `dz=${dist.toFixed(2)}`,
          mx: (p.x + probePt.x) / 2,
          my: (p.y + probePt.y) / 2,
          color: t.zeroText,
          border: t.isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(56, 189, 248, 0.4)'
        });
      }
    });

    state.poles.forEach(pole => {
      const p = zToScreen(pole.re, pole.im, width, height, maxR);
      ctx.beginPath();
      ctx.setLineDash([2, 3]);
      ctx.lineWidth = 1.6;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(probePt.x, probePt.y);
      ctx.strokeStyle = t.isLight ? 'rgba(220, 38, 38, 0.78)' : 'rgba(255, 69, 58, 0.85)';
      ctx.stroke();

      if (totalRoots <= 6) {
        const dist = probeZ.sub(pole).abs();
        vectorBadges.push({
          text: `dp=${dist.toFixed(2)}`,
          mx: (p.x + probePt.x) / 2,
          my: (p.y + probePt.y) / 2,
          color: t.poleText,
          border: t.isLight ? 'rgba(220, 38, 38, 0.35)' : 'rgba(255, 69, 58, 0.4)'
        });
      }
    });
    ctx.restore();
  }

  // 3B. Draw Probe Point e^{jw_0} & reserve its label BEFORE root/vector labels so p_k / dz never overlap it
  ctx.save();
  ctx.beginPath();
  ctx.arc(probePt.x, probePt.y, 12, 0, 2 * Math.PI);
  ctx.fillStyle = t.probeGlow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(probePt.x, probePt.y, 6.8, 0, 2 * Math.PI);
  ctx.fillStyle = t.probe;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = t.probeStroke;
  ctx.stroke();
  ctx.restore();

  const outCos = Math.cos(state.omega0);
  const outSin = Math.sin(state.omega0);
  const probeLabel = 'e^(jω₀)';
  placeNonOverlappingBadge(
    ctx,
    probeLabel,
    [
      { x: probePt.x + outCos * 16, y: probePt.y - outSin * 16 - 9, align: outCos >= 0 ? 'left' : 'right' },
      { x: probePt.x + outCos * 26, y: probePt.y - outSin * 26 - 9, align: outCos >= 0 ? 'left' : 'right' },
      { x: probePt.x + 14, y: probePt.y - 22, align: 'left' },
      { x: probePt.x - 14, y: probePt.y - 22, align: 'right' },
      { x: probePt.x + 14, y: probePt.y + 8, align: 'left' },
      { x: probePt.x - 14, y: probePt.y + 8, align: 'right' }
    ],
    placedBoxes,
    width,
    height,
    {
      font: '700 10px JetBrains Mono, monospace',
      fontSize: 10,
      color: t.probeText,
      bg: t.warnBg,
      border: t.warnBorder,
      padX: 5,
      padY: 2
    }
  );

  // 4. Draw Zeros ('o')
  state.zeros.forEach((z, idx) => {
    const pt = zToScreen(z.re, z.im, width, height, maxR);
    const isHovered =
      state.hoveredRoot && state.hoveredRoot.type === 'zero' && state.hoveredRoot.index === idx;
    ctx.save();
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = t.zeroGlow;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isHovered ? 8.2 : 6.8, 0, 2 * Math.PI);
    ctx.fillStyle = t.bg;
    ctx.fill();
    ctx.shadowColor = t.zeroGlow;
    ctx.shadowBlur = isHovered ? 12 : 6;
    ctx.lineWidth = isHovered ? 3.2 : 2.6;
    ctx.strokeStyle = t.zero;
    ctx.stroke();
    ctx.restore();

    if (state.zeros.length <= 6) {
      const sign = z.im >= 0 ? '+' : '-';
      const txt =
        Math.abs(z.im) < 0.01
          ? `z${idx + 1}(${z.re.toFixed(2)})`
          : `z${idx + 1}(${z.re.toFixed(2)}${sign}j${Math.abs(z.im).toFixed(2)})`;
      const preferTop = z.im >= 0;
      const candidates = [
        { x: pt.x + 11, y: preferTop ? pt.y - 22 : pt.y + 6, align: 'left' },
        { x: pt.x + 11, y: preferTop ? pt.y + 6 : pt.y - 22, align: 'left' },
        { x: pt.x - 11, y: preferTop ? pt.y - 22 : pt.y + 6, align: 'right' },
        { x: pt.x - 11, y: preferTop ? pt.y + 6 : pt.y - 22, align: 'right' }
      ];
      placeNonOverlappingBadge(ctx, txt, candidates, placedBoxes, width, height, {
        font: '600 10px JetBrains Mono, monospace',
        fontSize: 10,
        color: t.zeroText,
        bg: t.pillBg,
        border: t.pillBorder,
        padX: 5,
        padY: 2.5
      });
    }
  });

  // 5. Draw Poles ('x')
  state.poles.forEach((pole, idx) => {
    const pt = zToScreen(pole.re, pole.im, width, height, maxR);
    const isHovered =
      state.hoveredRoot && state.hoveredRoot.type === 'pole' && state.hoveredRoot.index === idx;
    const r = isHovered ? 8.2 : 6.8;
    ctx.save();
    if (isHovered) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 15, 0, 2 * Math.PI);
      ctx.fillStyle = t.poleGlow;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(pt.x - r, pt.y - r);
    ctx.lineTo(pt.x + r, pt.y + r);
    ctx.moveTo(pt.x + r, pt.y - r);
    ctx.lineTo(pt.x - r, pt.y + r);
    ctx.lineCap = 'round';
    ctx.shadowColor = t.poleGlow;
    ctx.shadowBlur = isHovered ? 12 : 6;
    ctx.lineWidth = isHovered ? 3.5 : 2.8;
    ctx.strokeStyle = isHovered ? t.poleAlt : t.pole;
    ctx.stroke();
    ctx.restore();

    if (state.poles.length <= 6) {
      const sign = pole.im >= 0 ? '+' : '-';
      const txt =
        Math.abs(pole.im) < 0.01
          ? `p${idx + 1}(${pole.re.toFixed(2)})`
          : `p${idx + 1}(${pole.re.toFixed(2)}${sign}j${Math.abs(pole.im).toFixed(2)})`;
      const preferBottom = pole.im < 0;
      const candidates = [
        { x: pt.x + 11, y: preferBottom ? pt.y + 6 : pt.y - 22, align: 'left' },
        { x: pt.x + 11, y: preferBottom ? pt.y - 22 : pt.y + 6, align: 'left' },
        { x: pt.x - 11, y: preferBottom ? pt.y + 6 : pt.y - 22, align: 'right' },
        { x: pt.x - 11, y: preferBottom ? pt.y - 22 : pt.y + 6, align: 'right' }
      ];
      placeNonOverlappingBadge(ctx, txt, candidates, placedBoxes, width, height, {
        font: '600 10px JetBrains Mono, monospace',
        fontSize: 10,
        color: t.poleText,
        bg: t.pillBg,
        border: t.pillBorder,
        padX: 5,
        padY: 2.5
      });
    }
  });

  // Render vector distance pills after root & probe badges so they never collide
  vectorBadges.forEach(vb => {
    placeNonOverlappingBadge(
      ctx,
      vb.text,
      [
        { x: vb.mx, y: vb.my - 9, align: 'center' },
        { x: vb.mx + 12, y: vb.my - 18, align: 'left' },
        { x: vb.mx - 12, y: vb.my - 18, align: 'right' },
        { x: vb.mx + 12, y: vb.my + 6, align: 'left' },
        { x: vb.mx - 12, y: vb.my + 6, align: 'right' },
        { x: vb.mx, y: vb.my + 14, align: 'center' }
      ],
      placedBoxes,
      width,
      height,
      {
        font: '600 9.5px JetBrains Mono, monospace',
        fontSize: 9.5,
        color: vb.color,
        bg: t.pillBg,
        border: vb.border,
        padX: 4,
        padY: 2
      }
    );
  });
}

/**
 * Smooth 5-stop scientific elevation colormap for 3D |H(z)| surface
 */
function sampleSurfaceColor(tNorm, slopeShade, isLight) {
  const stops = isLight
    ? [
        [29, 78, 216],   // 0.00: deep sapphire valley
        [2, 132, 199],   // 0.25: sky blue
        [13, 148, 136],  // 0.50: teal
        [217, 119, 6],   // 0.78: warm amber
        [220, 38, 38]    // 1.00: crimson pole peak
      ]
    : [
        [15, 35, 92],    // 0.00: deep observatory navy
        [14, 116, 184],  // 0.25: cerulean
        [56, 189, 248],  // 0.50: luminous sky cyan
        [251, 191, 36],  // 0.78: warm gold
        [255, 69, 58]    // 1.00: vivid rose-red peak
      ];

  const t = Math.max(0, Math.min(1, tNorm));
  const scaled = t * (stops.length - 1);
  const i0 = Math.min(stops.length - 2, Math.floor(scaled));
  const frac = scaled - i0;
  const c0 = stops[i0];
  const c1 = stops[i0 + 1];

  const r = (c0[0] + (c1[0] - c0[0]) * frac) * slopeShade;
  const g = (c0[1] + (c1[1] - c0[1]) * frac) * slopeShade;
  const b = (c0[2] + (c1[2] - c0[2]) * frac) * slopeShade;
  const alpha = isLight ? 0.78 : 0.80;

  return `rgba(${Math.min(255, Math.max(0, Math.round(r)))}, ${Math.min(255, Math.max(0, Math.round(g)))}, ${Math.min(255, Math.max(0, Math.round(b)))}, ${alpha})`;
}

/**
 * 1B. Draw Interactive 3D |H(z)| Surface Canvas
 */
function draw3DZSurfaceCanvas(state) {
  const canvas = document.getElementById('zPlaneCanvas');
  if (!canvas) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas);
  const t = getChartTheme(state.theme === 'light');

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient spotlight behind 3D mesh
  ctx.save();
  const bgGlow = ctx.createRadialGradient(width * 0.5, height * 0.52, 10, width * 0.5, height * 0.52, Math.min(width, height) * 0.52);
  bgGlow.addColorStop(0, t.originGlowInner);
  bgGlow.addColorStop(1, t.originGlowOuter);
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const yaw = state.view3dYaw !== undefined ? state.view3dYaw : 0.65;
  const pitch = state.view3dPitch !== undefined ? state.view3dPitch : 0.58;
  const R = Math.min(1.8, Math.max(1.3, state.zViewRange * 0.92));

  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const camScale = Math.min(width, height) * 0.33 / R;
  const cx = width * 0.5;
  const cy = height * 0.59;

  const project = (x, y, z) => {
    const xr = x * cosY - y * sinY;
    const yr = x * sinY + y * cosY;
    const zr = z;
    const y2 = yr * cosP - zr * sinP;
    const z2 = yr * sinP + zr * cosP;
    const persp = 1 / (1 + z2 * 0.08);
    return {
      sx: cx + xr * camScale * persp,
      sy: cy - y2 * camScale * persp,
      depth: z2
    };
  };

  // Sample |H(z)| on an N x N grid
  const N = 32;
  const grid = [];

  let ucPeak = 1.0;
  if (state.freqData && state.freqData.mags) {
    for (let i = 0; i < state.freqData.mags.length; i++) {
      if (state.freqData.mags[i] > ucPeak) ucPeak = state.freqData.mags[i];
    }
  }
  const heightCap = Math.min(8.0, Math.max(2.6, ucPeak * 1.45));

  for (let i = 0; i <= N; i++) {
    const row = [];
    const re = -R + (2 * R * i) / N;
    for (let j = 0; j <= N; j++) {
      const im = -R + (2 * R * j) / N;
      const zVal = new Complex(re, im);
      let mag = evaluateHzAtZ(state.bCoeffs, state.aCoeffs, zVal).abs();
      if (!Number.isFinite(mag)) mag = heightCap;
      mag = Math.min(heightCap, mag);
      const zHeight = (mag / heightCap) * 1.35 * R;
      row.push({ re, im, mag, p: project(re, im, zHeight) });
    }
    grid.push(row);
  }

  // Draw base Z-plane axes & labels
  ctx.save();
  const ax1 = project(-R, 0, 0), ax2 = project(R, 0, 0);
  const ay1 = project(0, -R, 0), ay2 = project(0, R, 0);
  ctx.strokeStyle = t.isLight ? 'rgba(51, 65, 85, 0.38)' : 'rgba(148, 163, 184, 0.34)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ax1.sx, ax1.sy); ctx.lineTo(ax2.sx, ax2.sy);
  ctx.moveTo(ay1.sx, ay1.sy); ctx.lineTo(ay2.sx, ay2.sy);
  ctx.stroke();

  ctx.font = '600 10.5px JetBrains Mono, monospace';
  drawHaloText(ctx, 'Re', ax2.sx + 4, ax2.sy + 3, t.axisTickText, t.bg, 'left');
  drawHaloText(ctx, 'Im', ay2.sx + 4, ay2.sy + 3, t.axisTickText, t.bg, 'left');

  // Build quads and sort back-to-front (painter's algorithm)
  const quads = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const q00 = grid[i][j];
      const q10 = grid[i + 1][j];
      const q11 = grid[i + 1][j + 1];
      const q01 = grid[i][j + 1];
      const avgDepth = (q00.p.depth + q10.p.depth + q11.p.depth + q01.p.depth) * 0.25;
      const avgMag = (q00.mag + q10.mag + q11.mag + q01.mag) * 0.25;
      const slope = ((q10.mag - q00.mag) + (q01.mag - q00.mag)) * 0.15;
      const shade = Math.max(0.84, Math.min(1.14, 0.98 + slope));
      quads.push({ q00, q10, q11, q01, avgDepth, avgMag, shade });
    }
  }
  quads.sort((a, b) => a.avgDepth - b.avgDepth);

  for (const q of quads) {
    const tNorm = Math.min(1, q.avgMag / heightCap);
    ctx.beginPath();
    ctx.moveTo(q.q00.p.sx, q.q00.p.sy);
    ctx.lineTo(q.q10.p.sx, q.q10.p.sy);
    ctx.lineTo(q.q11.p.sx, q.q11.p.sy);
    ctx.lineTo(q.q01.p.sx, q.q01.p.sy);
    ctx.closePath();
    ctx.fillStyle = sampleSurfaceColor(tNorm, q.shade, t.isLight);
    ctx.fill();
    ctx.strokeStyle = t.isLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.09)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Base shadow of unit circle on z=0 plane
  const ucSteps = 128;
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  for (let k = 0; k <= ucSteps; k++) {
    const w = (k / ucSteps) * 2 * Math.PI;
    const pt = project(Math.cos(w), Math.sin(w), 0);
    if (k === 0) ctx.moveTo(pt.sx, pt.sy);
    else ctx.lineTo(pt.sx, pt.sy);
  }
  ctx.strokeStyle = t.unitCircle;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();

  // Base plane pole ('x') & zero ('o') reference markers on z=0
  state.zeros.forEach(z => {
    if (Math.abs(z.re) <= R && Math.abs(z.im) <= R) {
      const bp = project(z.re, z.im, 0);
      ctx.beginPath();
      ctx.arc(bp.sx, bp.sy, 4.2, 0, 2 * Math.PI);
      ctx.fillStyle = t.bg;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = t.zero;
      ctx.stroke();
    }
  });
  state.poles.forEach(p => {
    if (Math.abs(p.re) <= R && Math.abs(p.im) <= R) {
      const bp = project(p.re, p.im, 0);
      const r = 4.2;
      ctx.beginPath();
      ctx.moveTo(bp.sx - r, bp.sy - r);
      ctx.lineTo(bp.sx + r, bp.sy + r);
      ctx.moveTo(bp.sx + r, bp.sy - r);
      ctx.lineTo(bp.sx - r, bp.sy + r);
      ctx.lineWidth = 2;
      ctx.strokeStyle = t.pole;
      ctx.stroke();
    }
  });

  // Highlight Unit Circle |z| = 1 lifted onto |H(e^{jw})| surface with subtle glow
  ctx.save();
  ctx.beginPath();
  for (let k = 0; k <= ucSteps; k++) {
    const w = (k / ucSteps) * 2 * Math.PI;
    const zVal = Complex.fromPolar(1, w);
    const mag = Math.min(heightCap, evaluateHzAtOmega(state.bCoeffs, state.aCoeffs, w).H.abs());
    const zh = (mag / heightCap) * 1.35 * R;
    const pt = project(zVal.re, zVal.im, zh);
    if (k === 0) ctx.moveTo(pt.sx, pt.sy);
    else ctx.lineTo(pt.sx, pt.sy);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = t.probeGlow;
  ctx.shadowBlur = t.isLight ? 5 : 12;
  ctx.strokeStyle = t.probe;
  ctx.lineWidth = 3.0;
  ctx.stroke();
  ctx.restore();

  // Probe point on 3D surface + vertical drop guide to base unit circle
  const probeMag = Math.min(heightCap, evaluateHzAtOmega(state.bCoeffs, state.aCoeffs, state.omega0).H.abs());
  const pCos = Math.cos(state.omega0);
  const pSin = Math.sin(state.omega0);
  const probeBase = project(pCos, pSin, 0);
  const probe3d = project(pCos, pSin, (probeMag / heightCap) * 1.35 * R);

  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.moveTo(probeBase.sx, probeBase.sy);
  ctx.lineTo(probe3d.sx, probe3d.sy);
  ctx.strokeStyle = t.probe;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(probe3d.sx, probe3d.sy, 6.5, 0, 2 * Math.PI);
  ctx.fillStyle = t.probe;
  ctx.fill();
  ctx.strokeStyle = t.probeOuterRing;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top-left compact legend pill
  drawPillBadge(ctx, '━ Vòng vàng: |H(e^(jω))| trên |z|=1', 10, 10, {
    font: '600 10.5px Inter, sans-serif',
    fontSize: 11,
    color: t.probeText,
    bg: t.warnBg,
    border: t.warnBorder,
    padX: 8,
    padY: 4
  });

  // Clean non-clipped responsive bottom caption pill
  const fullCap = 'Kéo xoay 3D • Cực (×) đẩy lên ∞ • Zero (○) kéo xuống 0';
  const shortCap = 'Kéo xoay 3D • × đẩy lên • ○ kéo xuống';
  ctx.font = '600 10.5px Inter, sans-serif';
  const capText = ctx.measureText(fullCap).width + 28 <= width ? fullCap : shortCap;
  drawPillBadge(ctx, capText, width / 2, height - 28, {
    font: '600 10.5px Inter, sans-serif',
    fontSize: 10.5,
    color: t.axisHeading,
    bg: t.pillBg,
    border: t.pillBorder,
    align: 'center',
    padX: 10,
    padY: 4
  });

  ctx.restore();
}

/**
 * Helper to draw frequency chart grid & axes
 */
function drawFreqGrid(ctx, pad, plotW, plotH, yMin, yMax, fullRange, unitText, isLight, fsHz = 0) {
  const t = getChartTheme(isLight);
  ctx.save();
  ctx.strokeStyle = t.grid;
  ctx.fillStyle = t.axisTickText;
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

  // Subtle plot border
  ctx.strokeStyle = t.gridStrong;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);

  // Unit & sampling frequency caption in top-right (above plot)
  ctx.textAlign = 'right';
  ctx.fillStyle = t.axisHeading;
  ctx.font = '600 11px Inter, sans-serif';
  const fsNote = fsHz > 0 ? ` • fs = ${fsHz} Hz` : '';
  ctx.fillText(`Đơn vị: ${unitText}${fsNote}`, pad.left + plotW, pad.top - 9);
  ctx.restore();
}

function drawOmegaProbeLine(ctx, pad, plotW, plotH, omega0, fullRange, val, yMin, yMax, isLight) {
  if (!Number.isFinite(val)) return;
  const wMin = fullRange ? -Math.PI : 0;
  const wMax = Math.PI;
  const w = fullRange ? omega0 : Math.abs(omega0);
  if (w < wMin || w > wMax) return;

  const t = getChartTheme(isLight);
  const x = pad.left + ((w - wMin) / (wMax - wMin)) * plotW;
  const clamped = Math.max(yMin, Math.min(yMax, val));
  const y = pad.top + plotH - ((clamped - yMin) / (yMax - yMin)) * plotH;

  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.moveTo(x, pad.top);
  ctx.lineTo(x, pad.top + plotH);
  ctx.strokeStyle = t.probe;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Soft outer glow halo
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.arc(x, y, 10.5, 0, 2 * Math.PI);
  ctx.fillStyle = t.probeGlow;
  ctx.fill();

  // Golden dot with crisp contrasting outline
  ctx.beginPath();
  ctx.arc(x, y, 5.6, 0, 2 * Math.PI);
  ctx.fillStyle = t.probe;
  ctx.fill();
  ctx.strokeStyle = t.probeStroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/**
 * 2 & 3. Draw Magnitude and Phase / Unwrapped Phase / Group Delay Charts
 */
function drawFrequencyCharts(state) {
  const isLight = state.theme === 'light';
  const t = getChartTheme(isLight);
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

  const { H: Hw0 } = evaluateHzAtOmega(state.bCoeffs, state.aCoeffs, state.omega0);
  const magW0 = Hw0.abs();
  const dbW0 = 20 * Math.log10(Math.max(magW0, 1e-6));
  const degW0 = (Hw0.arg() * 180) / Math.PI;

  const pad = { left: 56, right: 24, top: 28, bottom: 28 };
  const metrics = analyzeFilterMetrics(state.bCoeffs, state.aCoeffs, state.zeros, state.poles, state.rocType);

  // --- Magnitude Chart ---
  const magCanvas = document.getElementById('magCanvas');
  if (magCanvas) {
    const { ctx, width, height } = setupHiDPICanvas(magCanvas);
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, width, height);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const isSingularPeak = maxMag > 45;
    let linearCap = Math.max(1.2, maxMag * 1.15);
    if (!state.magDb && isSingularPeak) {
      const sorted = Array.from(freqData.mags).sort((a, b) => a - b);
      const p92 = sorted[Math.floor(sorted.length * 0.92)] || 5;
      linearCap = Math.max(6, Math.min(35, Math.ceil(p92 * 1.45)));
    }

    const yMin = state.magDb ? -60 : 0;
    const yMax = state.magDb
      ? Math.max(10, Math.min(80, Math.ceil((maxDb + 5) / 10) * 10))
      : linearCap;

    drawFreqGrid(
      ctx,
      pad,
      plotW,
      plotH,
      yMin,
      yMax,
      state.fullFreqRange,
      state.magDb ? 'dB' : 'Tuyến tính',
      isLight,
      state.fsHz
    );

    if (isSingularPeak) {
      const warnMsg = width < 440 ? 'Đỉnh → ∞ (giới hạn Y)' : 'Đỉnh → ∞ (Cực trên |z|=1)';
      drawPillBadge(ctx, warnMsg, pad.left + 8, pad.top + 8, {
        font: '600 10px Inter, sans-serif',
        fontSize: 10,
        color: t.warnText,
        bg: t.warnBg,
        border: t.warnBorder,
        padX: 6,
        padY: 2.5
      });
    }

    // Plot clipped curve + rich vertical gradient fill
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plotW, plotH);
    ctx.clip();

    ctx.beginPath();
    for (let i = 0; i < freqData.mags.length; i++) {
      const rawVal = state.magDb
        ? Math.max(-60, 20 * Math.log10(Math.max(freqData.mags[i], 1e-6)))
        : freqData.mags[i];
      const val = Math.min(yMax * 1.05, Math.max(yMin, rawVal));
      const x = pad.left + (i / (freqData.mags.length - 1)) * plotW;
      const y = pad.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = t.magGlow;
    ctx.shadowBlur = t.isLight ? 3 : 8;
    ctx.strokeStyle = t.magStroke;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineTo(pad.left + plotW, pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    if (isLight) {
      grad.addColorStop(0, 'rgba(2, 132, 199, 0.28)');
      grad.addColorStop(0.65, 'rgba(56, 189, 248, 0.12)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
    } else {
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
      grad.addColorStop(0.6, 'rgba(56, 189, 248, 0.16)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // -3 dB Reference Line & Clean Pill Badge (drawn over fill so badge is always crisp)
    if (maxMag > 1e-4 && !isSingularPeak) {
      const val3db = state.magDb ? Math.max(yMin, maxDb - 3.0103) : maxMag / Math.SQRT2;
      if (val3db >= yMin && val3db <= yMax) {
        const y3 = pad.top + plotH - ((val3db - yMin) / (yMax - yMin)) * plotH;
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(pad.left, y3);
        ctx.lineTo(pad.left + plotW, y3);
        ctx.strokeStyle = isLight ? 'rgba(217, 119, 6, 0.78)' : 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore();

        const badgeY = Math.max(pad.top + 3, Math.min(pad.top + plotH - 18, y3 - 18));
        drawPillBadge(ctx, '-3 dB', pad.left + 8, badgeY, {
          font: '700 9.5px JetBrains Mono, monospace',
          fontSize: 9.5,
          color: t.warnText,
          bg: t.warnBg,
          border: t.warnBorder,
          padX: 5,
          padY: 2,
          radius: 5
        });
      }
    }

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

  // --- Phase / Unwrapped / Group Delay Chart ---
  const phaseCanvas = document.getElementById('phaseCanvas');
  if (phaseCanvas) {
    const { ctx, width, height } = setupHiDPICanvas(phaseCanvas);
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, width, height);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const mode = state.phaseChartMode;
    const isGd = mode === 'groupDelay';
    const isUnwrapped = mode === 'unwrapped';
    const arr = isGd
      ? freqData.groupDelay
      : isUnwrapped
      ? freqData.unwrappedPhasesDeg
      : freqData.phasesDeg;

    let pMin = -180;
    let pMax = 180;
    if (isGd) {
      let minG = Infinity, maxG = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        if (!Number.isFinite(arr[i])) continue;
        const clamped = Math.max(-40, Math.min(60, arr[i]));
        if (clamped < minG) minG = clamped;
        if (clamped > maxG) maxG = clamped;
      }
      if (!Number.isFinite(minG)) { minG = -2; maxG = 8; }
      pMin = Math.min(-2, Math.floor(minG - 1));
      pMax = Math.max(8, Math.ceil(maxG + 1));
    } else if (isUnwrapped) {
      let minP = Infinity, maxP = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] < minP) minP = arr[i];
        if (arr[i] > maxP) maxP = arr[i];
      }
      pMin = Math.min(-180, Math.floor(minP / 90) * 90);
      pMax = Math.max(180, Math.ceil(maxP / 90) * 90);
      if (pMax - pMin < 180) { pMin -= 90; pMax += 90; }
    }

    drawFreqGrid(
      ctx,
      pad,
      plotW,
      plotH,
      pMin,
      pMax,
      state.fullFreqRange,
      isGd ? 'Mẫu (Samples)' : isUnwrapped ? 'Độ liên tục (°)' : 'Độ (°)',
      isLight,
      state.fsHz
    );

    // Subtle zero reference line if 0 lies inside [pMin, pMax]
    if (pMin < 0 && pMax > 0) {
      const zeroLineY = pad.top + plotH - ((0 - pMin) / (pMax - pMin)) * plotH;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3, 4]);
      ctx.moveTo(pad.left, zeroLineY);
      ctx.lineTo(pad.left + plotW, zeroLineY);
      ctx.strokeStyle = t.gridStrong;
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();
    }

    const strokeColor = isGd ? t.groupDelay : isUnwrapped ? t.phaseUnwrapped : t.phaseWrapped;

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plotW, plotH);
    ctx.clip();

    // Subtle gradient fill for continuous curves (unwrapped & groupDelay)
    if (isUnwrapped || isGd) {
      const baseZeroY = pad.top + plotH - ((Math.max(pMin, Math.min(pMax, 0)) - pMin) / (pMax - pMin)) * plotH;
      ctx.beginPath();
      let started = false;
      let lastX = pad.left;
      for (let i = 0; i < arr.length; i++) {
        const val = arr[i];
        if (!Number.isFinite(val)) {
          if (started) {
            ctx.lineTo(lastX, baseZeroY);
            ctx.closePath();
            started = false;
          }
          continue;
        }
        const x = pad.left + (i / (arr.length - 1)) * plotW;
        const clamped = Math.max(pMin, Math.min(pMax, val));
        const y = pad.top + plotH - ((clamped - pMin) / (pMax - pMin)) * plotH;
        if (!started) {
          ctx.moveTo(x, baseZeroY);
          ctx.lineTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
        lastX = x;
      }
      if (started) {
        ctx.lineTo(lastX, baseZeroY);
        ctx.closePath();
      }
      const pGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      if (isGd) {
        pGrad.addColorStop(0, isLight ? 'rgba(124, 58, 237, 0.22)' : 'rgba(168, 85, 247, 0.28)');
        pGrad.addColorStop(1, 'rgba(168, 85, 247, 0.03)');
      } else {
        pGrad.addColorStop(0, isLight ? 'rgba(5, 150, 105, 0.20)' : 'rgba(52, 211, 153, 0.25)');
        pGrad.addColorStop(1, 'rgba(52, 211, 153, 0.03)');
      }
      ctx.fillStyle = pGrad;
      ctx.fill();
    }

    ctx.beginPath();
    let drawingSegment = false;
    for (let i = 0; i < arr.length; i++) {
      const val = arr[i];
      if (!Number.isFinite(val)) {
        drawingSegment = false;
        continue;
      }
      if (mode === 'phase' && i > 0 && Number.isFinite(arr[i - 1]) && Math.abs(val - arr[i - 1]) > 180) {
        drawingSegment = false;
      }
      const x = pad.left + (i / (arr.length - 1)) * plotW;
      const clamped = Math.max(pMin, Math.min(pMax, val));
      const y = pad.top + plotH - ((clamped - pMin) / (pMax - pMin)) * plotH;
      if (!drawingSegment) {
        ctx.moveTo(x, y);
        drawingSegment = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = strokeColor;
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

  return { maxMag, maxDb, magW0, dbW0, degW0, metrics };
}

/**
 * 4. Draw Time-Domain Impulse h[n], Step s[n], and Signal Filtering x[n] -> y[n]
 */
function drawImpulseResponseChart(state) {
  const canvas = document.getElementById('impulseCanvas');
  if (!canvas) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas);
  const isLight = state.theme === 'light';
  const t = getChartTheme(isLight);

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, width, height);

  const { nIndices, x: inSig, y: outSig } = computeTimeDomainResponse(
    state.bCoeffs,
    state.aCoeffs,
    state.poles,
    state.rocType,
    state.numSamples,
    state.timeChartMode,
    state.signalOpts
  );
  state.lastTimeData = { nIndices, inSig, outSig };

  const pad = { left: 56, right: 24, top: 28, bottom: 28 };
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
  ctx.fillStyle = t.axisTickText;
  ctx.textAlign = 'right';

  [-1, -0.5, 0, 0.5, 1].forEach(frac => {
    const y = zeroY - frac * (plotH / 2);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.strokeStyle = frac === 0 ? t.axis : t.grid;
    ctx.lineWidth = frac === 0 ? 1.5 : 1;
    ctx.stroke();

    const val = frac * maxAbs;
    const label = Math.abs(val) >= 100 ? val.toExponential(1) : val.toFixed(Math.abs(maxAbs) > 10 ? 1 : 2);
    ctx.fillText(label, pad.left - 8, y + 4);
  });

  // Subtle plot border
  ctx.strokeStyle = t.gridStrong;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);

  const numSamples = nIndices.length;
  const denomSamples = Math.max(1, numSamples - 1);

  // Vertical n = 0 marker
  const n0Idx = nIndices.indexOf(0);
  if (n0Idx !== -1) {
    const x0 = pad.left + (n0Idx / denomSamples) * plotW;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(x0, pad.top);
    ctx.lineTo(x0, pad.top + plotH);
    ctx.strokeStyle = isLight ? 'rgba(217, 119, 6, 0.65)' : 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  ctx.textAlign = 'center';
  const stepN = Math.max(4, Math.round(numSamples / 8));
  for (let i = 0; i < numSamples; i += stepN) {
    const x = pad.left + (i / denomSamples) * plotW;
    ctx.fillText(`n=${nIndices[i]}`, x, pad.top + plotH + 18);
  }

  if (state.timeChartMode === 'signal') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plotW, plotH);
    ctx.clip();

    // x[n] input (dashed slate curve so shape differs from solid y[n])
    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = pad.left + (i / denomSamples) * plotW;
      const y = zeroY - (inSig[i] / maxAbs) * (plotH / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.setLineDash([5, 4]);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = t.signalIn;
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.setLineDash([]);

    // y[n] output (solid emerald curve + subtle gradient fill toward zeroY)
    ctx.beginPath();
    for (let i = 0; i < numSamples; i++) {
      const x = pad.left + (i / denomSamples) * plotW;
      const y = zeroY - (outSig[i] / maxAbs) * (plotH / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = t.signalOut;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    ctx.lineTo(pad.left + plotW, zeroY);
    ctx.lineTo(pad.left, zeroY);
    ctx.closePath();
    const sGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    sGrad.addColorStop(0, isLight ? 'rgba(5, 150, 105, 0.20)' : 'rgba(52, 211, 153, 0.24)');
    sGrad.addColorStop(0.5, 'rgba(52, 211, 153, 0.03)');
    sGrad.addColorStop(1, isLight ? 'rgba(5, 150, 105, 0.20)' : 'rgba(52, 211, 153, 0.24)');
    ctx.fillStyle = sGrad;
    ctx.fill();
    ctx.restore();

    // Non-overlapping top-right legend pills (compact on narrow widths)
    const compact = width < 440;
    const outLabel = compact ? '━ y[n] (Ra)' : '━ y[n] (Đầu ra sau lọc)';
    const inLabel = compact ? '╌ x[n] (Vào)' : '╌ x[n] (Đầu vào)';
    const outBox = drawPillBadge(ctx, outLabel, pad.left + plotW, 4, {
      font: '600 10.5px Inter, sans-serif',
      fontSize: 10.5,
      color: t.signalOutText,
      bg: t.pillBg,
      border: t.pillBorder,
      align: 'right',
      padX: 7,
      padY: 2.5
    });
    drawPillBadge(ctx, inLabel, outBox.x - 6, 4, {
      font: '600 10.5px Inter, sans-serif',
      fontSize: 10.5,
      color: t.mutedText,
      bg: t.pillBg,
      border: t.pillBorder,
      align: 'right',
      padX: 7,
      padY: 2.5
    });
  } else {
    let hasAntiCausal = false;
    const dotR = numSamples > 80 ? 2.6 : 3.6;

    for (let i = 0; i < numSamples; i++) {
      const x = pad.left + (i / denomSamples) * plotW;
      const y = zeroY - (outSig[i] / maxAbs) * (plotH / 2);
      const isAnti = nIndices[i] < 0;
      if (isAnti) hasAntiCausal = true;

      ctx.beginPath();
      ctx.moveTo(x, zeroY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isAnti ? t.stemAnti : t.stemCausal;
      ctx.lineWidth = 1.9;
      ctx.stroke();

      if (isAnti) {
        // Distinct diamond marker for n < 0 anti-causal samples
        const d = dotR + 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y - d);
        ctx.lineTo(x + d, y);
        ctx.lineTo(x, y + d);
        ctx.lineTo(x - d, y);
        ctx.closePath();
        ctx.fillStyle = t.stemAnti;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, 2 * Math.PI);
        ctx.fillStyle = t.stemCausal;
        ctx.fill();
      }
    }

    // Non-overlapping top-right legend pills
    const compact = width < 440;
    const mainLabel =
      state.timeChartMode === 'step'
        ? compact ? '● s[n]' : '● s[n] (Nhảy bậc)'
        : compact ? '● h[n]' : '● h[n] (Đáp ứng xung)';
    const mainBox = drawPillBadge(ctx, mainLabel, pad.left + plotW, 4, {
      font: '600 10.5px Inter, sans-serif',
      fontSize: 10.5,
      color: t.stemCausalText,
      bg: t.pillBg,
      border: t.pillBorder,
      align: 'right',
      padX: 7,
      padY: 2.5
    });

    if (hasAntiCausal) {
      drawPillBadge(ctx, compact ? '◆ n<0' : '◆ n<0 (Phản nhân quả)', mainBox.x - 6, 4, {
        font: '600 10.5px Inter, sans-serif',
        fontSize: 10.5,
        color: t.stemAntiText,
        bg: t.pillBg,
        border: t.pillBorder,
        align: 'right',
        padX: 7,
        padY: 2.5
      });
    }
  }

  ctx.restore();
}
