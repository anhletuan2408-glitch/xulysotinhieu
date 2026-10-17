/**
 * js/dsp.js
 * Complete Digital Signal Processing (DSP), Symbolic Expression Parser,
 * Partial Fraction Expansion (Closed-Form h[n]), and Spacious LaTeX Generator
 */

class Complex {
  constructor(re = 0, im = 0) {
    this.re = re;
    this.im = im;
  }
  add(c) {
    return new Complex(this.re + c.re, this.im + c.im);
  }
  sub(c) {
    return new Complex(this.re - c.re, this.im - c.im);
  }
  mul(c) {
    return new Complex(
      this.re * c.re - this.im * c.im,
      this.re * c.im + this.im * c.re
    );
  }
  div(c) {
    const d = c.re * c.re + c.im * c.im;
    if (d < 1e-20) return new Complex(0, 0);
    return new Complex(
      (this.re * c.re + this.im * c.im) / d,
      (this.im * c.re - this.re * c.im) / d
    );
  }
  pow(expRe) {
    const r = this.abs();
    if (r < 1e-15) return expRe === 0 ? new Complex(1, 0) : new Complex(0, 0);
    const theta = this.arg();
    return Complex.fromPolar(Math.pow(r, expRe), theta * expRe);
  }
  abs() {
    return Math.hypot(this.re, this.im);
  }
  arg() {
    return Math.atan2(this.im, this.re);
  }
  conj() {
    return new Complex(this.re, -this.im);
  }
  static fromPolar(r, theta) {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }
}

/*************************************************************************
 * 1. SYMBOLIC ALGEBRAIC PARSER FOR H(z) EXPRESSIONS
 * Supports expressions like:
 *   (1 - z^-2) / (1 - 1.2728*z^-1 + 0.81*z^-2)
 *   (z^2 - 1) / (z^2 - 1.2728*z + 0.81)
 *   0.25 * (1 + z^-1)^2 / (1 - 0.8*z^-1 + 0.64*z^-2)
 *************************************************************************/

/**
 * Tokenize and evaluate a single algebraic polynomial expression P(z) at complex value zVal
 */
function evalPolyExprAtZ(exprStr, zVal) {
  // Normalize string: insert explicit '*' for implicit multiplication like 2z, )z, )(, 2(
  let s = exprStr
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/(\d|\))(?=[zZ(])/g, '$1*')
    .replace(/([zZ\)])(?=\d|\()/g, '$1*');

  let pos = 0;

  function peek() {
    return s[pos];
  }
  function consume() {
    return s[pos++];
  }

  function parseExpression() {
    let left = parseTerm();
    while (pos < s.length && (peek() === '+' || peek() === '-')) {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left.add(right) : left.sub(right);
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (pos < s.length && (peek() === '*' || peek() === '/')) {
      const op = consume();
      const right = parseFactor();
      left = op === '*' ? left.mul(right) : left.div(right);
    }
    return left;
  }

  function parseFactor() {
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    if (peek() === '-') {
      consume();
      return new Complex(0, 0).sub(parseFactor());
    }
    let base = parsePrimary();
    if (pos < s.length && peek() === '^') {
      consume();
      let sign = 1;
      if (peek() === '-' || peek() === '+') {
        if (consume() === '-') sign = -1;
      }
      let expVal = parsePrimary();
      base = base.pow(sign * expVal.re);
    }
    return base;
  }

  function parsePrimary() {
    const ch = peek();
    if (ch === '(') {
      consume();
      const val = parseExpression();
      if (peek() === ')') consume();
      return val;
    }
    if (ch === 'z' || ch === 'Z') {
      consume();
      return zVal;
    }
    if (ch === 'j' || ch === 'i') {
      consume();
      return new Complex(0, 1);
    }
    // Parse number
    let numStr = '';
    while (pos < s.length && /[0-9.]/.test(peek())) {
      numStr += consume();
    }
    const val = parseFloat(numStr);
    if (Number.isNaN(val)) {
      throw new Error(`Ký tự không hợp lệ gần "${s.slice(pos)}"`);
    }
    return new Complex(val, 0);
  }

  const result = parseExpression();
  if (pos < s.length) {
    throw new Error(`Cú pháp dư thừa tại "${s.slice(pos)}"`);
  }
  return result;
}

/**
 * Split top-level '/' between Numerator B(z) and Denominator A(z)
 */
function splitTopLevelFraction(expr) {
  let depth = 0;
  let splitIdx = -1;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === '/' && depth === 0) {
      splitIdx = i;
      break;
    }
  }
  if (splitIdx === -1) {
    return { numExpr: expr.trim(), denExpr: '1' };
  }
  return {
    numExpr: expr.slice(0, splitIdx).trim(),
    denExpr: expr.slice(splitIdx + 1).trim()
  };
}

/**
 * Parse a full Transfer Function string H(z) into { bCoeffs, aCoeffs } in powers of z^{-1}
 * Uses 32-point Complex DFT inversion on the unit circle to extract exact polynomial coefficients
 */
function parseTransferFunctionString(rawStr) {
  let cleaned = rawStr.trim();
  // Remove leading "H(z) =" if user typed it
  cleaned = cleaned.replace(/^H\s*\(\s*z\s*\)\s*=\s*/i, '');
  if (!cleaned) throw new Error('Biểu thức trống');

  const { numExpr, denExpr } = splitTopLevelFraction(cleaned);
  const L = 32;
  const numSamples = new Array(L);
  const denSamples = new Array(L);

  for (let k = 0; k < L; k++) {
    const w = (2 * Math.PI * k) / L;
    const zVal = Complex.fromPolar(1.0, w);
    numSamples[k] = evalPolyExprAtZ(numExpr, zVal);
    denSamples[k] = evalPolyExprAtZ(denExpr, zVal);
  }

  // Inverse DFT to extract coefficients of z^{-m} (m = 0..15) and z^{+p} (m = L-p)
  const extractLaurent = samples => {
    const c = new Float64Array(L);
    for (let m = 0; m < L; m++) {
      let sumRe = 0;
      for (let k = 0; k < L; k++) {
        const ang = (2 * Math.PI * k * m) / L;
        sumRe += samples[k].re * Math.cos(ang) - samples[k].im * Math.sin(ang);
      }
      const val = sumRe / L;
      c[m] = Math.abs(val) < 1e-9 ? 0 : val;
    }
    return c;
  };

  const bLaurent = extractLaurent(numSamples);
  const aLaurent = extractLaurent(denSamples);

  // Detect highest positive power of z (stored at indices L - p, p = 1..12)
  let maxPosPower = 0;
  for (let p = 1; p <= 12; p++) {
    if (Math.abs(bLaurent[L - p]) > 1e-8 || Math.abs(aLaurent[L - p]) > 1e-8) {
      maxPosPower = p;
    }
  }

  // Shift both polynomials by z^{-maxPosPower} so all powers are in z^{-m} (m >= 0)
  const bShifted = [];
  const aShifted = [];
  for (let m = 0; m <= 16; m++) {
    const idx = (m - maxPosPower + L) % L;
    bShifted.push(bLaurent[idx]);
    aShifted.push(aLaurent[idx]);
  }

  // Trim trailing zeros
  while (bShifted.length > 1 && Math.abs(bShifted[bShifted.length - 1]) < 1e-8) bShifted.pop();
  while (aShifted.length > 1 && Math.abs(aShifted[aShifted.length - 1]) < 1e-8) aShifted.pop();

  // Normalize by leading non-zero denominator coefficient
  let a0 = aShifted[0];
  if (Math.abs(a0) < 1e-9) {
    const firstIdx = aShifted.findIndex(v => Math.abs(v) > 1e-9);
    a0 = firstIdx !== -1 ? aShifted[firstIdx] : 1;
  }

  return {
    bCoeffs: bShifted.map(v => Number((v / a0).toFixed(6))),
    aCoeffs: aShifted.map(v => Number((v / a0).toFixed(6)))
  };
}

/*************************************************************************
 * 2. POLYNOMIAL EXPANSION & DURAND-KERNER ROOT SOLVER
 *************************************************************************/

function rootsToPoly(roots) {
  let coeffs = [new Complex(1, 0)];
  for (const r of roots) {
    const next = new Array(coeffs.length + 1).fill(null).map(() => new Complex(0, 0));
    for (let i = 0; i < coeffs.length; i++) {
      next[i] = next[i].add(coeffs[i]);
      next[i + 1] = next[i + 1].sub(coeffs[i].mul(r));
    }
    coeffs = next;
  }
  return coeffs.map(c => (Math.abs(c.re) < 1e-11 ? 0 : c.re));
}

function findPolynomialRoots(realCoeffs) {
  let arr = realCoeffs.slice();
  while (arr.length > 1 && Math.abs(arr[0]) < 1e-12) arr.shift();
  while (arr.length > 1 && Math.abs(arr[arr.length - 1]) < 1e-12) arr.pop();

  const n = arr.length - 1;
  if (n <= 0) return [];

  const a0 = arr[0];
  const norm = arr.map(v => new Complex(v / a0, 0));

  let roots = [];
  for (let k = 0; k < n; k++) {
    const angle = (2 * Math.PI * k) / n + 0.3719;
    roots.push(Complex.fromPolar(0.65 + 0.07 * (k % 3), angle));
  }

  for (let iter = 0; iter < 90; iter++) {
    let maxDiff = 0;
    const nextRoots = roots.slice();
    for (let i = 0; i < n; i++) {
      const zi = roots[i];
      let pz = norm[0];
      for (let j = 1; j <= n; j++) {
        pz = pz.mul(zi).add(norm[j]);
      }
      let denom = new Complex(1, 0);
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          let diff = zi.sub(roots[j]);
          if (diff.abs() < 1e-12) diff = new Complex(1e-7, -1e-7);
          denom = denom.mul(diff);
        }
      }
      const delta = pz.div(denom);
      nextRoots[i] = zi.sub(delta);
      maxDiff = Math.max(maxDiff, delta.abs());
    }
    roots = nextRoots;
    if (maxDiff < 1e-11) break;
  }

  return roots.map(r => new Complex(
    Math.abs(r.re) < 1e-8 ? 0 : r.re,
    Math.abs(r.im) < 1e-7 ? 0 : r.im
  ));
}

/*************************************************************************
 * 3. FREQUENCY RESPONSE, ROC & TIME-DOMAIN SOLVERS
 *************************************************************************/

function evaluateHzAtOmega(bCoeffs, aCoeffs, w) {
  let numRe = 0, numIm = 0;
  for (let m = 0; m < bCoeffs.length; m++) {
    const ang = -w * m;
    numRe += bCoeffs[m] * Math.cos(ang);
    numIm += bCoeffs[m] * Math.sin(ang);
  }
  let denRe = 0, denIm = 0;
  for (let k = 0; k < aCoeffs.length; k++) {
    const ang = -w * k;
    denRe += aCoeffs[k] * Math.cos(ang);
    denIm += aCoeffs[k] * Math.sin(ang);
  }
  const numC = new Complex(numRe, numIm);
  const denC = new Complex(denRe, denIm);
  return denC.abs() < 1e-12 ? new Complex(1e6, 0) : numC.div(denC);
}

function evaluateFrequencyResponse(bCoeffs, aCoeffs, fullRange = false, numPoints = 512) {
  const omegas = new Float64Array(numPoints);
  const mags = new Float64Array(numPoints);
  const phasesDeg = new Float64Array(numPoints);
  const groupDelay = new Float64Array(numPoints);
  const rawPhases = new Float64Array(numPoints);

  const wMin = fullRange ? -Math.PI : 0;
  const wMax = Math.PI;

  for (let i = 0; i < numPoints; i++) {
    const w = wMin + (i / (numPoints - 1)) * (wMax - wMin);
    omegas[i] = w;
    const H = evaluateHzAtOmega(bCoeffs, aCoeffs, w);
    mags[i] = H.abs();
    rawPhases[i] = H.arg();
    phasesDeg[i] = (rawPhases[i] * 180) / Math.PI;
  }

  const unwrapped = new Float64Array(numPoints);
  unwrapped[0] = rawPhases[0];
  for (let i = 1; i < numPoints; i++) {
    let dp = rawPhases[i] - rawPhases[i - 1];
    while (dp > Math.PI) dp -= 2 * Math.PI;
    while (dp < -Math.PI) dp += 2 * Math.PI;
    unwrapped[i] = unwrapped[i - 1] + dp;
  }

  const dw = (wMax - wMin) / (numPoints - 1);
  for (let i = 0; i < numPoints; i++) {
    if (i === 0) {
      groupDelay[i] = -(unwrapped[1] - unwrapped[0]) / dw;
    } else if (i === numPoints - 1) {
      groupDelay[i] = -(unwrapped[i] - unwrapped[i - 1]) / dw;
    } else {
      groupDelay[i] = -(unwrapped[i + 1] - unwrapped[i - 1]) / (2 * dw);
    }
    if (Math.abs(groupDelay[i]) > 150) {
      groupDelay[i] = Math.sign(groupDelay[i]) * 150;
    }
  }

  return { omegas, mags, phasesDeg, groupDelay };
}

function analyzeRocAndStability(poles, rocType) {
  const poleRadii = poles.map(p => p.abs()).filter(r => r > 1e-9);
  const rMax = poleRadii.length > 0 ? Math.max(...poleRadii) : 0;
  const rMin = poleRadii.length > 0 ? Math.min(...poleRadii) : Infinity;
  const poleOnUnitCircle = poleRadii.some(r => Math.abs(r - 1.0) < 0.008);

  let rocInner = 0;
  let rocOuter = Infinity;
  let rocLatex = '|z| > 0 \\;\\text{(Hệ FIR)}';
  let isStable = true;

  if (poleRadii.length === 0) {
    rocInner = 0;
    rocOuter = Infinity;
    rocLatex = '|z| > 0 \\;\\text{(Hệ FIR)}';
    isStable = true;
  } else if (rocType === 'causal') {
    rocInner = rMax;
    rocOuter = Infinity;
    rocLatex = `|z| > ${rMax.toFixed(3)}`;
    isStable = rMax < 1.0 - 0.008;
  } else if (rocType === 'anticausal') {
    rocInner = 0;
    rocOuter = rMin;
    rocLatex = `|z| < ${rMin.toFixed(3)}`;
    isStable = rMin > 1.0 + 0.008;
  } else {
    if (poleOnUnitCircle) {
      rocInner = rMax;
      rocOuter = Infinity;
      rocLatex = '\\nexists\\text{ ROC chứa } |z|=1';
      isStable = false;
    } else {
      const inside = poleRadii.filter(r => r < 1.0);
      const outside = poleRadii.filter(r => r > 1.0);
      rocInner = inside.length ? Math.max(...inside) : 0;
      rocOuter = outside.length ? Math.min(...outside) : Infinity;

      if (rocOuter === Infinity) {
        rocLatex = `|z| > ${rocInner.toFixed(3)}`;
      } else if (rocInner === 0) {
        rocLatex = `|z| < ${rocOuter.toFixed(3)}`;
      } else {
        rocLatex = `${rocInner.toFixed(3)} < |z| < ${rocOuter.toFixed(3)}`;
      }
      isStable = true;
    }
  }

  return { rMax, rMin, rocInner, rocOuter, rocLatex, isStable, poleOnUnitCircle };
}

function computeTimeDomainResponse(bCoeffs, aCoeffs, poles, rocType, numSamples = 64, mode = 'impulse') {
  const { isStable, rMax } = analyzeRocAndStability(poles, rocType);

  if (rocType === 'causal' || (rocType === 'stable' && rMax < 1.0)) {
    const nIndices = new Int32Array(numSamples);
    const x = new Float64Array(numSamples);
    const y = new Float64Array(numSamples);
    const a0 = Math.abs(aCoeffs[0]) < 1e-12 ? 1 : aCoeffs[0];

    for (let n = 0; n < numSamples; n++) {
      nIndices[n] = n;
      if (mode === 'impulse') x[n] = n === 0 ? 1 : 0;
      else if (mode === 'step') x[n] = 1;
      else x[n] = Math.cos(0.12 * Math.PI * n) + 0.7 * Math.cos(0.65 * Math.PI * n);

      let acc = 0;
      for (let m = 0; m < bCoeffs.length; m++) {
        if (n - m >= 0) acc += bCoeffs[m] * x[n - m];
      }
      for (let k = 1; k < aCoeffs.length; k++) {
        if (n - k >= 0) acc -= aCoeffs[k] * y[n - k];
      }
      y[n] = acc / a0;
      if (Math.abs(y[n]) > 1e5) y[n] = Math.sign(y[n]) * 1e5;
    }
    return { nIndices, x, y };
  }

  if (isStable) {
    const Nfft = 512;
    const Hre = new Float64Array(Nfft);
    const Him = new Float64Array(Nfft);
    for (let k = 0; k < Nfft; k++) {
      const w = (2 * Math.PI * k) / Nfft;
      const H = evaluateHzAtOmega(bCoeffs, aCoeffs, w);
      Hre[k] = H.re;
      Him[k] = H.im;
    }

    const nIndices = new Int32Array(numSamples);
    const x = new Float64Array(numSamples);
    const y = new Float64Array(numSamples);
    const startN = rocType === 'anticausal' ? -(numSamples - 1) : -Math.floor(numSamples / 2);

    for (let idx = 0; idx < numSamples; idx++) {
      const n = startN + idx;
      nIndices[idx] = n;
      x[idx] = n === 0 ? 1 : 0;
      let sum = 0;
      for (let k = 0; k < Nfft; k++) {
        const ang = (2 * Math.PI * k * n) / Nfft;
        sum += Hre[k] * Math.cos(ang) - Him[k] * Math.sin(ang);
      }
      y[idx] = sum / Nfft;
    }

    if (mode === 'step') {
      let running = 0;
      for (let idx = 0; idx < numSamples; idx++) {
        running += y[idx];
        y[idx] = running;
      }
    }
    return { nIndices, x, y };
  }

  // Unstable Anti-Causal
  const nIndices = new Int32Array(numSamples);
  const x = new Float64Array(numSamples);
  const y = new Float64Array(numSamples);

  let aLastIdx = aCoeffs.length - 1;
  while (aLastIdx > 0 && Math.abs(aCoeffs[aLastIdx]) < 1e-12) aLastIdx--;
  const aN = aCoeffs[aLastIdx] || 1;

  for (let idx = numSamples - 1; idx >= 0; idx--) {
    const n = idx - (numSamples - 1);
    nIndices[idx] = n;
    x[idx] = n === 0 ? 1 : 0;
  }

  const yMap = new Map();
  const xMap = new Map();
  xMap.set(0, 1);

  for (let step = 0; step < numSamples; step++) {
    const n = -step;
    const shiftN = n + aLastIdx;
    let acc = 0;
    for (let m = 0; m < bCoeffs.length; m++) {
      acc += bCoeffs[m] * (xMap.get(shiftN - m) || 0);
    }
    for (let k = 0; k < aLastIdx; k++) {
      acc -= aCoeffs[k] * (yMap.get(shiftN - k) || 0);
    }
    let val = acc / aN;
    if (Math.abs(val) > 1e5) val = Math.sign(val) * 1e5;
    yMap.set(n, val);
  }

  for (let idx = 0; idx < numSamples; idx++) {
    y[idx] = yMap.get(nIndices[idx]) || 0;
  }
  return { nIndices, x, y };
}

/*************************************************************************
 * 4. SPACIOUS LATEX FORMULA & CLOSED-FORM h[n] GENERATORS
 *************************************************************************/

function formatNum(num, decimals = 3) {
  if (Math.abs(num) < 1e-5) return '0';
  return Number(num.toFixed(decimals)).toString();
}

function buildPolynomialLatex(coeffs, variable = 'z') {
  const terms = [];
  for (let i = 0; i < coeffs.length; i++) {
    const c = coeffs[i];
    if (Math.abs(c) < 1e-5 && coeffs.length > 1) continue;
    const absC = Math.abs(c);
    const sign = c < 0 ? '-' : terms.length > 0 ? '+' : '';
    const coeffStr =
      i === 0 || Math.abs(absC - 1) > 1e-4 ? formatNum(absC, 3) : '';
    let varPart = '';
    if (i === 1) {
      varPart = variable === 'z' ? 'z^{-1}' : 'e^{-j\\omega}';
    } else if (i > 1) {
      varPart = variable === 'z' ? `z^{-${i}}` : `e^{-j${i}\\omega}`;
    }
    terms.push(`${sign} ${coeffStr}${varPart}`.trim());
  }
  return terms.length > 0 ? terms.join(' ') : '0';
}

function buildFactoredLatex(zeros, poles, gain) {
  const formatFactors = roots => {
    if (roots.length === 0) return '1';
    const used = new Array(roots.length).fill(false);
    const factors = [];

    for (let i = 0; i < roots.length; i++) {
      if (used[i]) continue;
      const r = roots[i];
      used[i] = true;

      if (Math.abs(r.re) < 1e-4 && Math.abs(r.im) < 1e-4) {
        factors.push('1');
        continue;
      }

      if (Math.abs(r.im) > 1e-3) {
        let conjIdx = -1;
        for (let j = i + 1; j < roots.length; j++) {
          if (
            !used[j] &&
            Math.abs(roots[j].re - r.re) < 0.03 &&
            Math.abs(roots[j].im + r.im) < 0.03
          ) {
            conjIdx = j;
            break;
          }
        }
        if (conjIdx !== -1) {
          used[conjIdx] = true;
          const rad = r.abs();
          const thetaPi = Math.abs(r.arg()) / Math.PI;
          factors.push(
            `\\left(1 - ${formatNum(rad, 2)}e^{j${formatNum(thetaPi, 2)}\\pi}z^{-1}\\right)\\left(1 - ${formatNum(rad, 2)}e^{-j${formatNum(thetaPi, 2)}\\pi}z^{-1}\\right)`
          );
          continue;
        }
      }

      const sign = r.re >= 0 ? '-' : '+';
      factors.push(`\\left(1 ${sign} ${formatNum(Math.abs(r.re), 2)}z^{-1}\\right)`);
    }
    return factors.join(' \\cdot ');
  };

  const kStr = formatNum(gain, 3);
  const numF = formatFactors(zeros);
  const denF = formatFactors(poles);
  if (poles.length === 0) {
    return `H(z) = ${kStr} \\cdot ${numF}`;
  }
  return `H(z) = ${kStr} \\cdot \\frac{${numF}}{${denF}}`;
}

function buildDifferenceEquationLatex(bCoeffs, aCoeffs) {
  const rhs = [];
  for (let m = 0; m < bCoeffs.length; m++) {
    const c = bCoeffs[m];
    if (Math.abs(c) < 1e-4) continue;
    const sign = c < 0 ? '-' : rhs.length > 0 ? '+' : '';
    const absVal = Math.abs(c);
    const valStr = Math.abs(absVal - 1) < 1e-4 ? '' : formatNum(absVal, 3);
    const xTerm = m === 0 ? 'x[n]' : `x[n-${m}]`;
    rhs.push(`${sign} ${valStr}${xTerm}`);
  }
  for (let k = 1; k < aCoeffs.length; k++) {
    const c = -aCoeffs[k];
    if (Math.abs(c) < 1e-4) continue;
    const sign = c < 0 ? '-' : rhs.length > 0 ? '+' : '';
    const absVal = Math.abs(c);
    const valStr = Math.abs(absVal - 1) < 1e-4 ? '' : formatNum(absVal, 3);
    rhs.push(`${sign} ${valStr}y[n-${k}]`);
  }
  return `y[n] = ${rhs.length > 0 ? rhs.join(' ') : '0'}`;
}

/**
 * Compute Closed-Form Analytical Impulse Response h[n] via Polynomial Long Division + Residues
 */
function buildAnalyticalHnLatex(bCoeffs, aCoeffs, poles, rocType) {
  // Trim trailing near-zero coefficients
  let b = bCoeffs.slice();
  let a = aCoeffs.slice();
  while (b.length > 1 && Math.abs(b[b.length - 1]) < 1e-7) b.pop();
  while (a.length > 1 && Math.abs(a[a.length - 1]) < 1e-7) a.pop();

  // Case 1: Pure FIR system (no poles)
  if (poles.length === 0 || a.length <= 1) {
    const terms = [];
    for (let m = 0; m < b.length; m++) {
      if (Math.abs(b[m]) < 1e-4) continue;
      const sign = b[m] < 0 ? '-' : terms.length > 0 ? '+' : '';
      const absC = Math.abs(b[m]);
      const cStr = Math.abs(absC - 1) < 1e-4 ? '' : formatNum(absC, 3);
      const dStr = m === 0 ? '\\delta[n]' : `\\delta[n-${m}]`;
      terms.push(`${sign} ${cStr}${dStr}`);
    }
    return `h[n] = ${terms.length ? terms.join(' ') : '0'}`;
  }

  // Polynomial long division in z^{-1} (from highest degree down) if deg(B) >= deg(A)
  let rem = b.slice();
  const degA = a.length - 1;
  const firTerms = new Array(Math.max(0, rem.length - degA)).fill(0);

  for (let m = rem.length - 1; m >= degA; m--) {
    const q = rem[m] / a[degA];
    const qIdx = m - degA;
    firTerms[qIdx] = q;
    for (let k = 0; k <= degA; k++) {
      rem[qIdx + k] -= q * a[k];
    }
  }

  const terms = [];
  for (let m = 0; m < firTerms.length; m++) {
    const c = firTerms[m];
    if (Math.abs(c) < 1e-4) continue;
    const sign = c < 0 ? '-' : terms.length > 0 ? '+' : '';
    const absC = Math.abs(c);
    const cStr = Math.abs(absC - 1) < 1e-4 ? '' : formatNum(absC, 3);
    const dStr = m === 0 ? '\\delta[n]' : `\\delta[n-${m}]`;
    terms.push(`${sign} ${cStr}${dStr}`);
  }

  // Compute residues R_k for the strictly proper remainder R(z^{-1}) / A(z^{-1})
  // R_k = R(p_k^{-1}) / \prod_{j != k} (1 - p_j p_k^{-1})
  const used = new Array(poles.length).fill(false);

  for (let k = 0; k < poles.length; k++) {
    if (used[k]) continue;
    const pk = poles[k];
    if (pk.abs() < 1e-5) continue;
    used[k] = true;

    // Check for repeated root
    const isRepeated = poles.some((p, j) => j !== k && p.sub(pk).abs() < 0.02);
    if (isRepeated) {
      // Fallback to first 4 numerical impulse samples when multiple poles coalesce
      return buildNumericalSeriesHnLatex(bCoeffs, aCoeffs, poles, rocType);
    }

    const invPk = new Complex(1, 0).div(pk);
    // Evaluate remainder polynomial rem(z^{-1}) at z^{-1} = p_k^{-1}
    let numVal = new Complex(0, 0);
    for (let m = 0; m < rem.length; m++) {
      numVal = numVal.add(invPk.pow(m).mul(new Complex(rem[m], 0)));
    }

    let denVal = new Complex(1, 0);
    for (let j = 0; j < poles.length; j++) {
      if (j !== k) {
        const factor = new Complex(1, 0).sub(poles[j].mul(invPk));
        denVal = denVal.mul(factor);
      }
    }
    const residue = numVal.div(denVal);

    // Determine whether this pole is causal (right-sided u[n]) or anti-causal (left-sided -u[-n-1])
    const isCausalPole =
      rocType === 'causal' || (rocType === 'stable' && pk.abs() < 1.0);
    const stepStr = isCausalPole ? 'u[n]' : 'u[-n-1]';
    const rocSignFlip = isCausalPole ? 1 : -1;

    // Check if pk has a complex conjugate partner
    if (Math.abs(pk.im) > 1e-3) {
      const conjIdx = poles.findIndex(
        (p, j) => !used[j] && Math.abs(p.re - pk.re) < 0.03 && Math.abs(p.im + pk.im) < 0.03
      );
      if (conjIdx !== -1) {
        used[conjIdx] = true;
        // Combine 2 * |R_k| * r^n * cos(w_0 n + arg(R_k))
        const amp = 2 * residue.abs() * rocSignFlip;
        if (Math.abs(amp) < 1e-4) continue;
        const rStr = formatNum(pk.abs(), 2);
        const wPi = formatNum(Math.abs(pk.arg()) / Math.PI, 2);
        const phaseRad = pk.im >= 0 ? residue.arg() : -residue.arg();
        const phaseDeg = Math.round((phaseRad * 180) / Math.PI);
        const phasePart =
          Math.abs(phaseDeg) <= 2
            ? ''
            : phaseDeg > 0
            ? ` + ${phaseDeg}^\\circ`
            : ` - ${Math.abs(phaseDeg)}^\\circ`;

        const sign = amp < 0 ? '-' : terms.length > 0 ? '+' : '';
        terms.push(
          `${sign} ${formatNum(Math.abs(amp), 3)}\\left(${rStr}\\right)^n \\cos\\left(${wPi}\\pi n${phasePart}\\right)${stepStr}`
        );
        continue;
      }
    }

    // Real pole term: R_k * (p_k)^n * u[n]
    const amp = residue.re * rocSignFlip;
    if (Math.abs(amp) < 1e-4) continue;
    const sign = amp < 0 ? '-' : terms.length > 0 ? '+' : '';
    const pStr = pk.re < 0 ? `\\left(${formatNum(pk.re, 2)}\\right)^n` : `\\left(${formatNum(pk.re, 2)}\\right)^n`;
    terms.push(`${sign} ${formatNum(Math.abs(amp), 3)}${pStr}${stepStr}`);
  }

  return `h[n] = ${terms.length > 0 ? terms.join(' ') : '0'}`;
}

function buildNumericalSeriesHnLatex(bCoeffs, aCoeffs, poles, rocType) {
  const { nIndices, y } = computeTimeDomainResponse(bCoeffs, aCoeffs, poles, rocType, 6, 'impulse');
  const terms = [];
  for (let i = 0; i < Math.min(5, y.length); i++) {
    if (Math.abs(y[i]) < 1e-4) continue;
    const n = nIndices[i];
    const sign = y[i] < 0 ? '-' : terms.length > 0 ? '+' : '';
    const dStr = n === 0 ? '\\delta[n]' : n > 0 ? `\\delta[n-${n}]` : `\\delta[n+${Math.abs(n)}]`;
    terms.push(`${sign} ${formatNum(Math.abs(y[i]), 3)}${dStr}`);
  }
  return `h[n] = ${terms.join(' ')} + \\dots`;
}
