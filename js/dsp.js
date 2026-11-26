/**
 * js/dsp.js
 * Complete Digital Signal Processing (DSP) Engine:
 * - Complex arithmetic
 * - Exact Symbolic Laurent Rational Parser for H(z)
 * - Aberth-Ehrlich Root Finder with repeated-root clustering
 * - Exact Partial Fraction Expansion (simple & repeated poles) for closed-form h[n]
 * - Exact Analytical Group Delay, Wrapped/Unwrapped Phase, ROC & Filter Metrics
 * - Causal, Anti-Causal & Two-Sided Time-Domain Solvers (h[n], s[n], signal filtering)
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
  neg() {
    return new Complex(-this.re, -this.im);
  }
  scale(s) {
    return new Complex(this.re * s, this.im * s);
  }
  mul(c) {
    return new Complex(
      this.re * c.re - this.im * c.im,
      this.re * c.im + this.im * c.re
    );
  }
  div(c) {
    const d = c.re * c.re + c.im * c.im;
    if (d < 1e-24) return new Complex(0, 0);
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
  abs2() {
    return this.re * this.re + this.im * this.im;
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
 * 1. EXACT SYMBOLIC LAURENT RATIONAL PARSER FOR H(z)
 * Supports arbitrary rational expressions in z and z^-1, e.g.:
 *   0.19 * (1 - z^-2) / (1 - 1.2728*z^-1 + 0.81*z^-2)
 *   1/2 * (z^2 - 1) / (z^2 - 1.2*z + 0.75)
 *   (1 - 0.5*z^-1)^-2
 *   ((1 - z^-1)/(1 - 0.5*z^-1)) * ((1 + z^-1)/(1 + 0.5*z^-1))
 *************************************************************************/

class LaurentPoly {
  constructor(termsMap = null) {
    // Map<integerPowerOfZ, Complex>
    this.terms = new Map();
    if (termsMap) {
      for (const [p, c] of termsMap.entries()) {
        if (c.abs() > 1e-13) this.terms.set(p, new Complex(c.re, c.im));
      }
    }
  }
  static constant(c) {
    const p = new LaurentPoly();
    const val = c instanceof Complex ? c : new Complex(c, 0);
    if (val.abs() > 1e-13) p.terms.set(0, val);
    return p;
  }
  static zPower(pow) {
    const p = new LaurentPoly();
    p.terms.set(pow, new Complex(1, 0));
    return p;
  }
  isZero() {
    return this.terms.size === 0;
  }
  isConstant() {
    if (this.terms.size === 0) return true;
    if (this.terms.size === 1 && this.terms.has(0)) return true;
    return false;
  }
  constantComplex() {
    return this.terms.get(0) || new Complex(0, 0);
  }
  add(other) {
    const out = new LaurentPoly(this.terms);
    for (const [p, c] of other.terms.entries()) {
      const prev = out.terms.get(p) || new Complex(0, 0);
      const sum = prev.add(c);
      if (sum.abs() > 1e-13) out.terms.set(p, sum);
      else out.terms.delete(p);
    }
    return out;
  }
  sub(other) {
    const out = new LaurentPoly(this.terms);
    for (const [p, c] of other.terms.entries()) {
      const prev = out.terms.get(p) || new Complex(0, 0);
      const diff = prev.sub(c);
      if (diff.abs() > 1e-13) out.terms.set(p, diff);
      else out.terms.delete(p);
    }
    return out;
  }
  neg() {
    const out = new LaurentPoly();
    for (const [p, c] of this.terms.entries()) {
      out.terms.set(p, c.neg());
    }
    return out;
  }
  mul(other) {
    const out = new LaurentPoly();
    for (const [p1, c1] of this.terms.entries()) {
      for (const [p2, c2] of other.terms.entries()) {
        const p = p1 + p2;
        const prev = out.terms.get(p) || new Complex(0, 0);
        const next = prev.add(c1.mul(c2));
        if (next.abs() > 1e-13) out.terms.set(p, next);
        else out.terms.delete(p);
      }
    }
    return out;
  }
  powInt(n) {
    if (n === 0) return LaurentPoly.constant(1);
    let res = LaurentPoly.constant(1);
    let base = this;
    let exp = n;
    while (exp > 0) {
      if (exp & 1) res = res.mul(base);
      exp >>= 1;
      if (exp > 0) base = base.mul(base);
    }
    return res;
  }
}

class RatFunc {
  constructor(num, den = LaurentPoly.constant(1)) {
    this.num = num;
    this.den = den;
  }
  static fromConstant(c) {
    return new RatFunc(LaurentPoly.constant(c), LaurentPoly.constant(1));
  }
  add(other) {
    if (this.den.isConstant() && other.den.isConstant()) {
      const d1 = this.den.constantComplex();
      const d2 = other.den.constantComplex();
      if (Math.abs(d1.re - 1) < 1e-12 && Math.abs(d1.im) < 1e-12 &&
          Math.abs(d2.re - 1) < 1e-12 && Math.abs(d2.im) < 1e-12) {
        return new RatFunc(this.num.add(other.num), LaurentPoly.constant(1));
      }
    }
    return new RatFunc(
      this.num.mul(other.den).add(other.num.mul(this.den)),
      this.den.mul(other.den)
    );
  }
  sub(other) {
    return this.add(new RatFunc(other.num.neg(), other.den));
  }
  mul(other) {
    return new RatFunc(this.num.mul(other.num), this.den.mul(other.den));
  }
  div(other) {
    if (other.num.isZero()) {
      throw new Error('Không thể chia cho 0 trong biểu thức H(z)');
    }
    return new RatFunc(this.num.mul(other.den), this.den.mul(other.num));
  }
  powInt(n) {
    if (n === 0) return RatFunc.fromConstant(1);
    if (n > 0) return new RatFunc(this.num.powInt(n), this.den.powInt(n));
    if (this.num.isZero()) throw new Error('Không thể nâng 0 lên lũy thừa âm');
    return new RatFunc(this.den.powInt(-n), this.num.powInt(-n));
  }
}

function tokenizeHzExpression(rawStr) {
  let s = rawStr
    .trim()
    .replace(/^H\s*\(\s*z\s*\)\s*=\s*/i, '')
    .replace(/π/g, 'pi')
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/·/g, '*');

  if (!s) throw new Error('Biểu thức trống');

  const rawTokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ('+-*/^()'.includes(ch)) {
      rawTokens.push({ type: ch === '(' ? 'LPAREN' : ch === ')' ? 'RPAREN' : 'OP', value: ch });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < s.length && /[0-9.]/.test(s[i])) {
        numStr += s[i++];
      }
      // Scientific notation: e.g. 1e-3, 2.5E+2
      if (i < s.length && (s[i] === 'e' || s[i] === 'E')) {
        const nextCh = s[i + 1];
        if (/[0-9]/.test(nextCh) || ((nextCh === '+' || nextCh === '-') && /[0-9]/.test(s[i + 2]))) {
          numStr += s[i++];
          if (s[i] === '+' || s[i] === '-') numStr += s[i++];
          while (i < s.length && /[0-9]/.test(s[i])) {
            numStr += s[i++];
          }
        }
      }
      const numVal = Number(numStr);
      if (!Number.isFinite(numVal)) throw new Error(`Số không hợp lệ "${numStr}"`);
      rawTokens.push({ type: 'NUM', value: numVal });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let ident = '';
      while (i < s.length && /[a-zA-Z]/.test(s[i])) {
        ident += s[i++];
      }
      const lower = ident.toLowerCase();
      if (lower === 'z' || lower === 'j' || lower === 'i' || lower === 'pi' || lower === 'e') {
        rawTokens.push({ type: 'IDENT', value: lower });
      } else {
        throw new Error(`Biến hoặc ký hiệu không hỗ trợ "${ident}"`);
      }
      continue;
    }
    throw new Error(`Ký tự không hợp lệ "${ch}"`);
  }

  // Insert implicit '*' between adjacent value-like tokens
  const isLeftValue = t => t.type === 'NUM' || t.type === 'IDENT' || t.type === 'RPAREN';
  const isRightValue = t => t.type === 'NUM' || t.type === 'IDENT' || t.type === 'LPAREN';
  const tokens = [];
  for (let k = 0; k < rawTokens.length; k++) {
    const curr = rawTokens[k];
    if (k > 0 && isLeftValue(rawTokens[k - 1]) && isRightValue(curr)) {
      tokens.push({ type: 'OP', value: '*' });
    }
    tokens.push(curr);
  }
  return tokens;
}

function parseTransferFunctionString(rawStr) {
  const tokens = tokenizeHzExpression(rawStr);
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseExpression() {
    let left = parseTerm();
    while (pos < tokens.length && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      left = op === '+' ? left.add(right) : left.sub(right);
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (pos < tokens.length && peek().type === 'OP' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parseFactor();
      left = op === '*' ? left.mul(right) : left.div(right);
    }
    return left;
  }

  function parseFactor() {
    if (pos < tokens.length && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const f = parseFactor();
      return op === '-' ? new RatFunc(f.num.neg(), f.den) : f;
    }
    let base = parsePrimary();
    if (pos < tokens.length && peek().type === 'OP' && peek().value === '^') {
      consume();
      let sign = 1;
      if (pos < tokens.length && peek().type === 'OP' && (peek().value === '+' || peek().value === '-')) {
        if (consume().value === '-') sign = -1;
      }
      const expRat = parseFactor();
      if (!expRat.num.isConstant() || !expRat.den.isConstant()) {
        throw new Error('Số mũ của đa thức phải là hằng số nguyên');
      }
      const expC = expRat.num.constantComplex().div(expRat.den.constantComplex());
      const expVal = sign * expC.re;
      if (Math.abs(expC.im) > 1e-8 || Math.abs(expVal - Math.round(expVal)) > 1e-6) {
        throw new Error('Số mũ của z hoặc nhân tử phải là số nguyên');
      }
      const intExp = Math.round(expVal);
      if (Math.abs(intExp) > 64) {
        throw new Error('Bậc lũy thừa quá lớn (tối đa 64)');
      }
      base = base.powInt(intExp);
    }
    return base;
  }

  function parsePrimary() {
    if (pos >= tokens.length) throw new Error('Biểu thức kết thúc đột ngột');
    const tok = consume();
    if (tok.type === 'LPAREN') {
      const val = parseExpression();
      if (pos >= tokens.length || peek().type !== 'RPAREN') {
        throw new Error('Thiếu dấu ngoặc đóng ")"');
      }
      consume();
      return val;
    }
    if (tok.type === 'NUM') {
      return RatFunc.fromConstant(tok.value);
    }
    if (tok.type === 'IDENT') {
      if (tok.value === 'z') return new RatFunc(LaurentPoly.zPower(1), LaurentPoly.constant(1));
      if (tok.value === 'pi') return RatFunc.fromConstant(Math.PI);
      if (tok.value === 'e') return RatFunc.fromConstant(Math.E);
      if (tok.value === 'j' || tok.value === 'i') return RatFunc.fromConstant(new Complex(0, 1));
    }
    throw new Error(`Token không hợp lệ "${tok.value}"`);
  }

  const rat = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Cú pháp dư thừa gần "${tokens[pos].value}"`);
  }
  if (rat.den.isZero()) {
    throw new Error('Mẫu số A(z) bằng 0');
  }

  // Convert { num, den } in powers of z into standard z^-m arrays
  const allPows = [...rat.num.terms.keys(), ...rat.den.terms.keys()];
  const maxPow = allPows.length > 0 ? Math.max(...allPows) : 0;
  const minPow = allPows.length > 0 ? Math.min(...allPows) : 0;
  const len = maxPow - minPow + 1;

  if (len > 128) {
    throw new Error('Bậc hệ thống quá lớn để phân tích');
  }

  const bArr = new Array(len).fill(0);
  const aArr = new Array(len).fill(0);
  let hasComplex = false;

  for (const [p, c] of rat.num.terms.entries()) {
    if (Math.abs(c.im) > 1e-6) hasComplex = true;
    bArr[maxPow - p] = c.re;
  }
  for (const [p, c] of rat.den.terms.entries()) {
    if (Math.abs(c.im) > 1e-6) hasComplex = true;
    aArr[maxPow - p] = c.re;
  }

  if (hasComplex) {
    throw new Error('Hệ thống LTI hệ số thực không hỗ trợ hệ số phức tường minh ở đa thức');
  }

  // Factor out common leading zeros of denominator so a[0] != 0
  let firstNonZeroA = aArr.findIndex(v => Math.abs(v) > 1e-11);
  if (firstNonZeroA === -1) throw new Error('Mẫu số A(z) bằng 0');

  let firstNonZeroB = bArr.findIndex(v => Math.abs(v) > 1e-11);
  if (firstNonZeroB !== -1 && firstNonZeroA > 0) {
    const commonShift = Math.min(firstNonZeroA, firstNonZeroB);
    bArr.splice(0, commonShift);
    aArr.splice(0, commonShift);
    firstNonZeroA -= commonShift;
  }
  // If denominator still starts with 0 (non-causal pure advance), shift denominator & note warning
  if (firstNonZeroA > 0) {
    aArr.splice(0, firstNonZeroA);
  }

  while (bArr.length > 1 && Math.abs(bArr[bArr.length - 1]) < 1e-11) bArr.pop();
  while (aArr.length > 1 && Math.abs(aArr[aArr.length - 1]) < 1e-11) aArr.pop();

  const a0 = aArr[0];
  const clean = v => {
    const norm = v / a0;
    return Math.abs(norm) < 1e-11 ? 0 : Number(norm.toFixed(8));
  };

  return {
    bCoeffs: bArr.map(clean),
    aCoeffs: aArr.map(clean)
  };
}

/*************************************************************************
 * 2. POLYNOMIAL EXPANSION & ABERTH-EHRLICH ROOT SOLVER
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

function evalComplexPolyAndDeriv(normCoeffs, z) {
  let p = normCoeffs[0];
  let dp = new Complex(0, 0);
  for (let j = 1; j < normCoeffs.length; j++) {
    dp = dp.mul(z).add(p);
    p = p.mul(z).add(normCoeffs[j]);
  }
  return { p, dp };
}

function findPolynomialRoots(realCoeffs) {
  let arr = realCoeffs.slice();
  while (arr.length > 1 && Math.abs(arr[0]) < 1e-12) arr.shift();
  while (arr.length > 1 && Math.abs(arr[arr.length - 1]) < 1e-12) arr.pop();

  const n = arr.length - 1;
  if (n <= 0) return [];

  const a0 = arr[0];
  const norm = arr.map(v => new Complex(v / a0, 0));

  // Analytical degree 1 & 2 (exact even for repeated roots!)
  if (n === 1) {
    return [new Complex(-norm[1].re, 0)];
  }
  if (n === 2) {
    const b = norm[1].re;
    const c = norm[2].re;
    const disc = b * b - 4 * c;
    if (disc >= -1e-12) {
      const sq = Math.sqrt(Math.max(0, disc));
      return [new Complex((-b + sq) / 2, 0), new Complex((-b - sq) / 2, 0)];
    }
    const sq = Math.sqrt(-disc) / 2;
    return [new Complex(-b / 2, sq), new Complex(-b / 2, -sq)];
  }

  // Cauchy bound for initial circle radius
  let maxRatio = 0;
  for (let i = 1; i <= n; i++) {
    maxRatio = Math.max(maxRatio, norm[i].abs());
  }
  const initR = Math.max(0.65, Math.min(3.0, (1 + maxRatio) * 0.65));

  let roots = [];
  for (let k = 0; k < n; k++) {
    const angle = (2 * Math.PI * k) / n + 0.3719;
    roots.push(Complex.fromPolar(initR * (0.85 + 0.1 * (k % 3)), angle));
  }

  // Aberth-Ehrlich simultaneous cubic-convergent solver
  for (let iter = 0; iter < 140; iter++) {
    let maxStep = 0;
    for (let i = 0; i < n; i++) {
      const zi = roots[i];
      const { p, dp } = evalComplexPolyAndDeriv(norm, zi);
      if (p.abs() < 1e-14) continue;

      let sumInv = new Complex(0, 0);
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          let diff = zi.sub(roots[j]);
          if (diff.abs() < 1e-12) diff = new Complex(1e-7, -1e-7);
          sumInv = sumInv.add(new Complex(1, 0).div(diff));
        }
      }

      const w = dp.abs() < 1e-15 ? new Complex(1e12, 0) : p.div(dp);
      const denom = new Complex(1, 0).sub(w.mul(sumInv));
      const delta = denom.abs() < 1e-14 ? w : w.div(denom);
      roots[i] = zi.sub(delta);
      maxStep = Math.max(maxStep, delta.abs());
    }
    if (maxStep < 1e-12) break;
  }

  // Cluster near-coincident roots (handles repeated poles/zeros cleanly)
  const visited = new Array(n).fill(false);
  const refined = [];
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;
    const cluster = [roots[i]];
    for (let j = i + 1; j < n; j++) {
      if (!visited[j] && roots[j].sub(roots[i]).abs() < 4e-3) {
        visited[j] = true;
        cluster.push(roots[j]);
      }
    }
    let avgRe = 0, avgIm = 0;
    cluster.forEach(c => { avgRe += c.re; avgIm += c.im; });
    avgRe /= cluster.length;
    avgIm /= cluster.length;
    if (Math.abs(avgRe) < 1e-7) avgRe = 0;
    if (Math.abs(avgIm) < 1e-5) avgIm = 0;
    const snapped = new Complex(avgRe, avgIm);
    for (let k = 0; k < cluster.length; k++) {
      refined.push(new Complex(snapped.re, snapped.im));
    }
  }

  return refined;
}

function getLeadingZeroCount(coeffs) {
  let d = 0;
  while (d < coeffs.length - 1 && Math.abs(coeffs[d]) < 1e-10) d++;
  return d;
}

function getOriginMultiplicity(bCoeffs, aCoeffs) {
  let effLenB = bCoeffs.length;
  while (effLenB > 1 && Math.abs(bCoeffs[effLenB - 1]) < 1e-10) effLenB--;
  let effLenA = aCoeffs.length;
  while (effLenA > 1 && Math.abs(aCoeffs[effLenA - 1]) < 1e-10) effLenA--;
  // H(z) = B(z^-1)/A(z^-1) -> power of z at origin = (degA - degB)
  // > 0: zeros at z=0; < 0: poles at z=0
  return (effLenA - 1) - (effLenB - 1);
}

/*************************************************************************
 * 3. FREQUENCY RESPONSE, EXACT GROUP DELAY, ROC & METRICS
 *************************************************************************/

function evaluateHzAtZ(bCoeffs, aCoeffs, z) {
  // Evaluate H(z) = (\sum b_m z^{-m}) / (\sum a_k z^{-k}) at any complex z
  if (z.abs() < 1e-12) return new Complex(1e8, 0);
  const invZ = new Complex(1, 0).div(z);
  let num = new Complex(0, 0);
  for (let m = bCoeffs.length - 1; m >= 0; m--) {
    num = num.mul(invZ).add(new Complex(bCoeffs[m], 0));
  }
  let den = new Complex(0, 0);
  for (let k = aCoeffs.length - 1; k >= 0; k--) {
    den = den.mul(invZ).add(new Complex(aCoeffs[k], 0));
  }
  return den.abs() < 1e-12 ? new Complex(1e8, 0) : num.div(den);
}

function evaluateHzAtOmega(bCoeffs, aCoeffs, w) {
  let numRe = 0, numIm = 0;
  let dNumRe = 0, dNumIm = 0;
  for (let m = 0; m < bCoeffs.length; m++) {
    const c = bCoeffs[m];
    if (c === 0) continue;
    const ang = -w * m;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    numRe += c * cs;
    numIm += c * sn;
    if (m > 0) {
      dNumRe += m * c * cs;
      dNumIm += m * c * sn;
    }
  }
  let denRe = 0, denIm = 0;
  let dDenRe = 0, dDenIm = 0;
  for (let k = 0; k < aCoeffs.length; k++) {
    const c = aCoeffs[k];
    if (c === 0) continue;
    const ang = -w * k;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    denRe += c * cs;
    denIm += c * sn;
    if (k > 0) {
      dDenRe += k * c * cs;
      dDenIm += k * c * sn;
    }
  }
  const numC = new Complex(numRe, numIm);
  const denC = new Complex(denRe, denIm);
  const H = denC.abs() < 1e-12 ? new Complex(1e6, 0) : numC.div(denC);

  // Exact analytical group delay: Re(B'(e^-jw)/B(e^-jw) - A'(e^-jw)/A(e^-jw))
  let gd = NaN;
  if (numC.abs() > 1e-7 && denC.abs() > 1e-7) {
    const termB = new Complex(dNumRe, dNumIm).div(numC);
    const termA = new Complex(dDenRe, dDenIm).div(denC);
    gd = termB.re - termA.re;
    if (!Number.isFinite(gd)) gd = NaN;
  }
  return { H, groupDelay: gd };
}

function evaluateFrequencyResponse(bCoeffs, aCoeffs, fullRange = false, numPoints = 512) {
  const omegas = new Float64Array(numPoints);
  const mags = new Float64Array(numPoints);
  const phasesDeg = new Float64Array(numPoints);
  const unwrappedPhasesDeg = new Float64Array(numPoints);
  const groupDelay = new Float64Array(numPoints);
  const rawPhases = new Float64Array(numPoints);

  const wMin = fullRange ? -Math.PI : 0;
  const wMax = Math.PI;

  for (let i = 0; i < numPoints; i++) {
    const w = wMin + (i / (numPoints - 1)) * (wMax - wMin);
    omegas[i] = w;
    const { H, groupDelay: gd } = evaluateHzAtOmega(bCoeffs, aCoeffs, w);
    mags[i] = H.abs();
    rawPhases[i] = H.arg();
    phasesDeg[i] = (rawPhases[i] * 180) / Math.PI;
    groupDelay[i] = gd;
  }

  let acc = rawPhases[0];
  unwrappedPhasesDeg[0] = (acc * 180) / Math.PI;
  for (let i = 1; i < numPoints; i++) {
    let dp = rawPhases[i] - rawPhases[i - 1];
    while (dp > Math.PI) dp -= 2 * Math.PI;
    while (dp < -Math.PI) dp += 2 * Math.PI;
    acc += dp;
    unwrappedPhasesDeg[i] = (acc * 180) / Math.PI;
  }

  return { omegas, mags, phasesDeg, unwrappedPhasesDeg, groupDelay };
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

function analyzeFilterMetrics(bCoeffs, aCoeffs, zeros, poles, rocType) {
  const freq = evaluateFrequencyResponse(bCoeffs, aCoeffs, false, 512);
  const mags = freq.mags;
  const n = mags.length;
  const dc = mags[0];
  const nyq = mags[n - 1];
  let maxVal = 0, minVal = Infinity, maxIdx = 0, minIdx = 0;
  for (let i = 0; i < n; i++) {
    if (mags[i] > maxVal) { maxVal = mags[i]; maxIdx = i; }
    if (mags[i] < minVal) { minVal = mags[i]; minIdx = i; }
  }

  const rocInfo = analyzeRocAndStability(poles, rocType);
  const isFIR = poles.length === 0;
  const prefix = isFIR ? 'FIR' : 'IIR';

  // Band averages for robust frequency-shape classification (independent of stability)
  const lowEnd = Math.max(2, Math.floor(n * 0.2));
  const highStart = Math.min(n - 2, Math.floor(n * 0.8));
  let sumLow = 0, sumHigh = 0;
  for (let i = 0; i < lowEnd; i++) sumLow += Math.min(mags[i], 1e4);
  for (let i = highStart; i < n; i++) sumHigh += Math.min(mags[i], 1e4);
  const avgLow = sumLow / lowEnd;
  const avgHigh = sumHigh / (n - highStart);

  let shapeType = 'Đa tần (Multi-band)';
  let filterType = `Hệ ${prefix} Đa tần`;

  if (maxVal < 1e-8) {
    shapeType = 'Triệt tiêu (Gain = 0)';
    filterType = 'Hệ triệt tiêu (Gain = 0)';
  } else if (maxVal - minVal < 0.06 * maxVal && !rocInfo.poleOnUnitCircle) {
    shapeType = 'All-Pass (Thông toàn dải)';
    filterType = 'All-Pass (Thông toàn dải)';
  } else {
    let zeroMinCount = 0;
    let peakCount = 0;
    for (let i = 1; i < n - 1; i++) {
      if (mags[i] < mags[i - 1] && mags[i] <= mags[i + 1] && mags[i] < 0.14 * maxVal) {
        zeroMinCount++;
      }
      if (mags[i] > mags[i - 1] && mags[i] >= mags[i + 1] && mags[i] > 0.72 * maxVal) {
        peakCount++;
      }
    }
    if ((zeroMinCount >= 2 && dc > 0.45 * maxVal) || (peakCount >= 2 && zeroMinCount >= 1)) {
      shapeType = 'Răng lược (Comb / Đa hố)';
    } else if (
      minVal < 0.18 * maxVal &&
      minIdx > 0.05 * n &&
      minIdx < 0.95 * n &&
      dc > 0.45 * maxVal &&
      nyq > 0.45 * maxVal
    ) {
      shapeType = 'Chắn dải (Notch / Band-stop)';
    } else if (
      maxIdx > 0.06 * n &&
      maxIdx < 0.94 * n &&
      dc < 0.72 * maxVal &&
      nyq < 0.72 * maxVal
    ) {
      shapeType = 'Thông dải (Band-pass)';
    } else if (dc >= nyq * 1.4 && avgLow > avgHigh * 1.35) {
      shapeType = 'Thông thấp (Low-pass)';
    } else if (nyq >= dc * 1.4 && avgHigh > avgLow * 1.35) {
      shapeType = 'Thông cao (High-pass)';
    }
    filterType = `${prefix} ${shapeType}`;
  }

  const stabilityTag = rocInfo.poleOnUnitCircle
    ? 'Biên giới ổn định'
    : rocInfo.isStable
    ? 'Ổn định BIBO'
    : 'Không ổn định';

  // -3dB threshold relative to peak
  const thresh3db = maxVal / Math.SQRT2;
  const cutoffOmegas = [];
  for (let i = 1; i < n; i++) {
    const prev = mags[i - 1] - thresh3db;
    const curr = mags[i] - thresh3db;
    if ((prev <= 0 && curr > 0) || (prev >= 0 && curr < 0)) {
      const t = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr) + 1e-12);
      const wCross = ((i - 1 + t) / (n - 1)) * Math.PI;
      cutoffOmegas.push(wCross);
    }
  }

  // Minimum phase check: all poles & zeros strictly inside |z| < 1
  const allZerosInside = zeros.every(z => z.abs() < 1.0 - 1e-4);
  const allPolesInside = poles.every(p => p.abs() < 1.0 - 1e-4);
  const isMinPhase = rocInfo.isStable && rocType === 'causal' && allZerosInside && allPolesInside;

  return {
    filterType,
    shapeType,
    stabilityTag,
    isMinPhase,
    maxMag: maxVal,
    peakOmega: (maxIdx / (n - 1)) * Math.PI,
    notchOmega: (minIdx / (n - 1)) * Math.PI,
    thresh3db,
    cutoffOmegas,
    dcGain: dc,
    nyqGain: nyq
  };
}

/**
 * Automatic Human-Readable DSP Diagnosis & Pole-Zero Explanation for ANY H(z)
 */
function buildSystemExplanation(bCoeffs, aCoeffs, zeros, poles, rocType, fsHz = 300) {
  const metrics = analyzeFilterMetrics(bCoeffs, aCoeffs, zeros, poles, rocType);
  const rocInfo = analyzeRocAndStability(poles, rocType);
  const degB = Math.max(0, bCoeffs.length - 1);
  const degA = Math.max(0, aCoeffs.length - 1);
  const order = Math.max(degB, degA);
  const originOrder = getOriginMultiplicity(bCoeffs, aCoeffs);

  const fmtFreq = w => {
    const piStr = `${(w / Math.PI).toFixed(2)}π`;
    if (fsHz > 0) {
      const hz = (Math.abs(w) / (2 * Math.PI)) * fsHz;
      return `${piStr} (${hz.toFixed(1)} Hz)`;
    }
    return piStr;
  };

  const bullets = [];

  // 1. Structure & Order
  if (poles.length === 0) {
    const originNote = originOrder < 0 ? `, có ${Math.abs(originOrder)} cực ẩn tại gốc z = 0` : '';
    bullets.push(
      `<strong>Cấu trúc:</strong> Bộ lọc <strong>FIR bậc ${order}</strong> (${zeros.length} Zero hữu hạn khác 0${originNote}) — không có hồi tiếp mẫu ra.`
    );
  } else {
    const originNote =
      originOrder > 0
        ? `, kèm ${originOrder} Zero tại gốc z = 0`
        : originOrder < 0
        ? `, kèm ${Math.abs(originOrder)} Cực tại gốc z = 0`
        : '';
    bullets.push(
      `<strong>Cấu trúc:</strong> Hệ thống <strong>IIR bậc ${order}</strong> (${zeros.length} Zero, ${poles.length} Cực khác 0${originNote}).`
    );
  }

  // 2. Frequency behavior from Pole-Zero geometry
  if (metrics.shapeType.includes('All-Pass')) {
    bullets.push(
      `<strong>Đặc tính phổ:</strong> Các cặp Cực–Zero đối xứng nghịch đảo qua |z|=1 nên triệt tiêu nhau về biên độ → <strong>phẳng tuyệt đối 0 dB</strong> toàn dải, chỉ làm dịch pha và tạo trễ nhóm.`
    );
  } else {
    const unitZeros = [];
    zeros.forEach(z => {
      if (Math.abs(z.abs() - 1.0) < 0.035 && z.arg() >= -1e-4) {
        const w = Math.abs(z.arg());
        if (!unitZeros.some(u => Math.abs(u - w) < 0.04)) unitZeros.push(w);
      }
    });
    if (unitZeros.length > 0) {
      const list = unitZeros.map(fmtFreq).join(', ');
      bullets.push(
        `<strong>Triệt tần số (Notch / Zero):</strong> Có Zero nằm trên |z|=1 tại <strong>ω ≈ ${list}</strong> → độ dài vector tới e^(jω) bằng 0 nên triệt tiêu hoàn toàn tần số này (−∞ dB).`
      );
    }

    const unitPoles = [];
    const nearPoles = [];
    poles.forEach(p => {
      const r = p.abs();
      const w = Math.abs(p.arg());
      if (p.arg() >= -1e-4) {
        if (Math.abs(r - 1.0) < 0.008) {
          if (!unitPoles.some(u => Math.abs(u.w - w) < 0.04)) unitPoles.push({ r, w });
        } else if (r >= 0.72) {
          if (!nearPoles.some(u => Math.abs(u.w - w) < 0.04)) nearPoles.push({ r, w });
        }
      }
    });

    if (unitPoles.length > 0) {
      const list = unitPoles.map(u => fmtFreq(u.w)).join(', ');
      bullets.push(
        `<strong>Cộng hưởng biên giới:</strong> Có Cực nằm ngay trên |z|=1 tại <strong>ω ≈ ${list}</strong> → biên độ tiến tới ∞ (hệ tích lũy / dao động không tắt dần).`
      );
    } else if (nearPoles.length > 0) {
      const list = nearPoles.map(u => `ω ≈ ${fmtFreq(u.w)} (r=${u.r.toFixed(2)})`).join(', ');
      bullets.push(
        `<strong>Đỉnh cộng hưởng (Pole):</strong> Cực gần đường tròn đơn vị tại <strong>${list}</strong> → tạo đỉnh nhọn trên phổ biên độ.`
      );
    }
  }

  // Repeated pole detection
  let hasRepeatedPole = false;
  for (let i = 0; i < poles.length; i++) {
    for (let j = i + 1; j < poles.length; j++) {
      if (poles[i].sub(poles[j]).abs() < 0.015) hasRepeatedPole = true;
    }
  }
  if (hasRepeatedPole) {
    bullets.push(
      `<strong>Cực bội:</strong> Có nghiệm cực trùng nhau → công thức h[n] xuất hiện thừa số đa thức (n+1), làm đáp ứng xung mượt/tăng chậm trước khi suy giảm.`
    );
  }

  // 3. Stability & ROC & Min-phase
  if (rocInfo.poleOnUnitCircle) {
    bullets.push(
      `<strong>Ổn định &amp; ROC:</strong> Hệ nằm ở <strong>biên giới ổn định</strong> (không ổn định BIBO vì cực nằm trên |z|=1).`
    );
  } else if (rocInfo.isStable) {
    const minPhaseText = metrics.isMinPhase
      ? ' Đạt chuẩn <strong>Pha cực tiểu (Min-Phase)</strong> vì mọi Zero &amp; Cực đều nằm trong |z| &lt; 1.'
      : '';
    const rocDesc =
      rocType === 'causal'
        ? 'nhân quả (h[n] = 0 với n < 0)'
        : rocType === 'anticausal'
        ? 'phản nhân quả (h[n] = 0 với n ≥ 0)'
        : 'hai phía (hội tụ chứa |z|=1)';
    bullets.push(
      `<strong>Ổn định &amp; ROC:</strong> Hệ ${rocDesc}, <strong>ổn định BIBO</strong> vì miền hội tụ chứa đường tròn đơn vị |z|=1.${minPhaseText}`
    );
  } else {
    bullets.push(
      `<strong>Ổn định &amp; ROC:</strong> Hệ <strong>không ổn định BIBO</strong> dưới chế độ ROC hiện tại (h[n] phân kỳ). Thử đổi ROC sang <em>Phản nhân quả</em> hoặc <em>Chứa |z|=1</em> để quan sát vùng hội tụ ổn định.`
    );
  }

  // 4. Explicit Final Conclusion (Bộ lọc gì + đặc điểm tần số + ổn định)
  let bandDetail = '';
  if (metrics.shapeType.includes('Thông thấp')) {
    bandDetail = `cho các tần số thấp đi qua và suy giảm tần số cao (DC = ${metrics.dcGain.toFixed(2)}, Nyquist = ${metrics.nyqGain.toFixed(2)})`;
  } else if (metrics.shapeType.includes('Thông cao')) {
    bandDetail = `chặn tần số thấp/DC và cho tần số cao đi qua (DC = ${metrics.dcGain.toFixed(2)}, Nyquist = ${metrics.nyqGain.toFixed(2)})`;
  } else if (metrics.shapeType.includes('Thông dải')) {
    bandDetail = `cho dải tần quanh <strong>ω ≈ ${fmtFreq(metrics.peakOmega)}</strong> đi qua, suy giảm ở cả DC và Nyquist`;
  } else if (metrics.shapeType.includes('Chắn dải')) {
    bandDetail = `triệt sâu thành phần nhiễu quanh <strong>ω ≈ ${fmtFreq(metrics.notchOmega)}</strong> và giữ nguyên các tần số còn lại`;
  } else if (metrics.shapeType.includes('Răng lược')) {
    bandDetail = `tạo nhiều hố triệt tiêu tuần hoàn trên dải tần (kiểu Comb Filter)`;
  } else if (metrics.shapeType.includes('All-Pass')) {
    bandDetail = `biên độ phẳng <strong>0 dB</strong> toàn dải, chuyên dùng cân bằng pha / tạo trễ nhóm`;
  } else {
    bandDetail = `đáp ứng biên độ đa dải tùy chỉnh`;
  }

  const stabSummary = rocInfo.poleOnUnitCircle
    ? 'nằm ở <strong>Biên giới ổn định</strong> (cực trên |z|=1)'
    : rocInfo.isStable
    ? '<strong>Ổn định BIBO</strong>'
    : '<strong>Không ổn định BIBO</strong> (do có cực ngoài ROC ổn định)';

  const conclusion = `Đây là <strong>Bộ lọc ${metrics.filterType}</strong> bậc ${order}: ${bandDetail} — trạng thái hiện tại: ${stabSummary}.`;

  // 5. Real-World DSP Application tailored to filter shape & stability
  let application = '';
  if (rocInfo.poleOnUnitCircle) {
    application =
      'Làm bộ tạo dao động số (Digital Oscillator sinh sóng sin chuẩn tần số ω) hoặc bộ tích lũy rời rạc (Accumulator / Integrator).';
  } else if (!rocInfo.isStable) {
    application =
      'Hệ không ổn định không dùng lọc nhân quả thời gian thực (dễ tràn số); cần kéo cực vào trong |z| < 1 hoặc dùng ROC hai phía/phản nhân quả cho xử lý tín hiệu offline.';
  } else if (metrics.shapeType.includes('All-Pass')) {
    application =
      'Cân bằng pha (Phase Equalization) bù méo trễ nhóm trên kênh truyền viễn thông, mạch phân tần loa (Crossover) hoặc tạo hiệu ứng Phaser âm thanh.';
  } else if (metrics.shapeType.includes('Chắn dải')) {
    application =
      'Khử nhiễu đơn tần cố định như nhiễu nguồn điện 50/60 Hz trong thiết bị đo điện tim (ECG), cảm biến công nghiệp hoặc chống hú micro (feedback).';
  } else if (metrics.shapeType.includes('Răng lược')) {
    application =
      'Triệt nhiễu lưới điện kèm toàn bộ hài bậc cao (50 Hz, 100 Hz, 150 Hz…), tạo hiệu ứng vang âm thanh (Echo/Reverb) hoặc tổng hợp nhạc cụ.';
  } else if (metrics.shapeType.includes('Thông dải')) {
    application =
      'Tách dải tần mục tiêu như giọng nói (300–3400 Hz), giải mã phím điện thoại DTMF, tách sóng não (Alpha/Beta EEG) hoặc mạch cộng hưởng chọn kênh.';
  } else if (metrics.shapeType.includes('Thông thấp')) {
    application =
      poles.length === 0
        ? 'Làm mượt dữ liệu cảm biến (nhiệt độ, gia tốc), triệt nhiễu ngẫu nhiên và bảo toàn dạng sóng nhờ pha gần tuyến tính (FIR).'
        : 'Khử nhiễu cao tần (EMI/nhiễu trắng), làm mượt tín hiệu điều khiển hoặc lọc chống răng cưa (Anti-aliasing) trước khi giảm tần số lấy mẫu.';
  } else if (metrics.shapeType.includes('Thông cao')) {
    application =
      'Loại bỏ thành phần trôi nền một chiều (DC offset) trong tín hiệu y sinh (ECG/EEG), tách cạnh biến thiên nhanh hoặc cắt tiếng ù/gió tần số thấp.';
  } else {
    application =
      'Lọc đa băng tần tùy biến (Equalizer âm thanh nhiều dải hoặc cân bằng đặc tuyến kênh truyền viễn thông).';
  }

  // 6. Equivalent Analog Circuit & Generalized Transfer Formula (s-domain / DSP)
  // Helper: attach primary fields + variants[] for dual-circuit card tabs
  const makeCircuit = variants => {
    const primary = variants[0];
    return {
      topology: primary.topology,
      name: primary.name,
      formulaLatex: primary.formulaLatex,
      note: primary.note,
      variants
    };
  };

  let circuit = null;
  if (rocInfo.poleOnUnitCircle) {
    const isIntegrator = poles.some(p => Math.abs(p.re - 1) < 0.05 && Math.abs(p.im) < 0.05);
    circuit = isIntegrator
      ? makeCircuit([
          {
            shortLabel: 'Op-Amp Tích phân',
            topology: 'integrator',
            name: 'Mạch Tích phân Op-Amp đảo pha (Integrator) / Tích lũy rời rạc',
            formulaLatex: 'H(s) = -\\frac{1}{sRC}, \\quad H(z) = \\frac{1}{1 - z^{-1}}',
            note: 'Cực tại z = 1 (s = 0) tương ứng tụ hồi tiếp C tích điện liên tục không có điện trở xả song song.'
          }
        ])
      : makeCircuit([
          {
            shortLabel: 'Khung LC lý tưởng',
            topology: 'lc_osc',
            name: 'Mạch Cộng hưởng LC lý tưởng (L nối tiếp, C rẽ nhánh, R = 0)',
            formulaLatex: 'H(s) = \\frac{\\omega_0^2}{s^2 + \\omega_0^2}, \\quad f_0 = \\frac{1}{2\\pi\\sqrt{LC}}',
            note: 'Cặp cực nằm ngay trên trục ảo jω (trên |z|=1) do không có điện trở tiêu tán → dao động điều hòa không tắt dần.'
          }
        ]);
  } else if (!rocInfo.isStable) {
    circuit = makeCircuit([
      {
        shortLabel: 'Hồi tiếp dương',
        topology: 'unstable',
        name: 'Mạch Hồi tiếp dương / Điện trở âm hiệu dụng (R_eff < 0)',
        formulaLatex: '\\operatorname{Re}(s_k) > 0 \\;\\Longleftrightarrow\\; |p_k| > 1',
        note: 'Hệ số tắt dần âm làm năng lượng tự khuếch đại theo hàm mũ thay vì tiêu tán trên điện trở.'
      }
    ]);
  } else if (order === 0) {
    circuit = makeCircuit([
      {
        shortLabel: 'Khuếch đại thuần',
        topology: 'gain',
        name: 'Mạch Khuếch đại / Suy hao thuần (Buffer / Attenuator)',
        formulaLatex: 'H(s) = K, \\quad y[n] = K\\,x[n]',
        note: 'Hệ bậc 0 không có phần tử nhớ (tụ/cuộn cảm hay trễ z⁻¹), chỉ nhân biên độ tín hiệu với hằng số K.'
      }
    ]);
  } else if (poles.length === 0) {
    circuit = makeCircuit([
      {
        shortLabel: 'Dây trễ FIR',
        topology: 'fir_tapped',
        name: 'Mạch Dây trễ FIR (Tapped Delay Line — không có RLC tương đương)',
        formulaLatex: 'H(z) = \\sum_{m=0}^{M} b_m z^{-m}',
        note: 'Thực thi hoàn toàn bằng chuỗi thanh ghi trễ z⁻¹, bộ nhân bₘ và bộ cộng Σ (không vòng hồi tiếp).'
      }
    ]);
  } else if (metrics.shapeType.includes('All-Pass')) {
    circuit =
      order <= 1
        ? makeCircuit([
            {
              shortLabel: 'Op-Amp chủ động',
              topology: 'allpass',
              name: 'Mạch Dịch pha Op-Amp bậc 1 (Active All-Pass)',
              formulaLatex: 'H(s) = \\frac{sRC - 1}{sRC + 1}, \\quad |H(j\\omega)| = 1',
              note: 'Mạch Op-Amp có cực và zero đối xứng qua trục ảo (s-plane) / đường tròn đơn vị (z-plane) chỉ dịch pha, không đổi biên độ.'
            },
            {
              shortLabel: 'Cầu Lattice (RC)',
              topology: 'allpass_lattice',
              name: 'Mạch Cầu Lattice đối xứng (Symmetric RC Lattice All-Pass)',
              formulaLatex: 'H(s) = \\frac{1 - sRC}{1 + sRC}, \\quad \\angle H(j\\omega) = -2\\arctan(\\omega RC)',
              note: 'Cầu thụ động đối xứng hai nhánh R nối tiếp và hai nhánh C chéo cho biên độ phẳng 0 dB và pha dịch từ 0° đến −180°.'
            }
          ])
        : makeCircuit([
            {
              shortLabel: 'Op-Amp All-Pass',
              topology: 'allpass',
              name: `Mạch Dịch pha Op-Amp All-Pass bậc ${order} (Ghép tầng Active All-Pass)`,
              formulaLatex: 'H(s) = \\frac{s^2 - \\frac{\\omega_0}{Q}s + \\omega_0^2}{s^2 + \\frac{\\omega_0}{Q}s + \\omega_0^2}, \\quad |H(j\\omega)| = 1',
              note: 'Ghép tầng Op-Amp dịch pha tạo cặp cực – zero đối xứng qua trục ảo, chuyên dùng cân bằng trễ nhóm.'
            },
            {
              shortLabel: 'Cầu Lattice (RC)',
              topology: 'allpass_lattice',
              name: `Mạch Cầu Lattice đối xứng ghép tầng (Bậc ${order})`,
              formulaLatex: 'H(s) = \\prod_{k} \\frac{1 - s\\tau_k}{1 + s\\tau_k}, \\quad |H(j\\omega)| = 1',
              note: 'Cầu Lattice thụ động đối xứng không cần nguồn nuôi, giữ nguyên biên độ ở mọi tần số.'
            }
          ]);
  } else if (metrics.shapeType.includes('Chắn dải')) {
    circuit = makeCircuit([
      {
        shortLabel: 'RLC Bẫy LC',
        topology: 'notch',
        name: 'Mạch Chắn dải RLC (Bẫy cộng hưởng LC nối tiếp rẽ nhánh)',
        formulaLatex: 'H(s) = \\frac{s^2 + \\omega_N^2}{s^2 + \\frac{\\omega_N}{Q}s + \\omega_N^2}, \\quad f_N = \\frac{1}{2\\pi\\sqrt{LC}}',
        note: 'Tại tần số nhiễu f_N = 1/(2π√LC), nhánh LC nối tiếp cộng hưởng có trở kháng bằng 0, ngắn mạch hoàn toàn f_N xuống mass.'
      },
      {
        shortLabel: 'Cầu Twin-T (RC)',
        topology: 'notch_twin_t',
        name: 'Mạch Cầu Twin-T Notch (Thụ động RC không cần cuộn cảm)',
        formulaLatex: 'H(s) = \\frac{s^2 + \\omega_N^2}{s^2 + 4\\omega_N s + \\omega_N^2}, \\quad f_N = \\frac{1}{2\\pi RC}',
        note: 'Gồm nhánh T thông thấp (R–R–2C) song song nhánh T thông cao (C–C–R/2), triệt pha nhau hoàn toàn tại f_N = 1/(2πRC).'
      }
    ]);
  } else if (metrics.shapeType.includes('Thông dải')) {
    circuit = makeCircuit([
      {
        shortLabel: 'RLC nối tiếp',
        topology: 'bandpass',
        name: 'Mạch Cộng hưởng RLC nối tiếp (lấy áp trên R)',
        formulaLatex: '\\begin{gathered} H(s) = \\frac{\\frac{\\omega_0}{Q}s}{s^2 + \\frac{\\omega_0}{Q}s + \\omega_0^2} \\\\[4pt] f_0 = \\frac{1}{2\\pi\\sqrt{LC}},\\; Q = \\frac{1}{R}\\sqrt{\\frac{L}{C}} \\end{gathered}',
        note: 'Tụ C chặn tần số thấp (DC), cuộn cảm L chặn tần số cao, chỉ cho cộng hưởng quanh f₀ đi qua R.'
      },
      {
        shortLabel: 'RLC song song',
        topology: 'bandpass_parallel',
        name: 'Mạch Cộng hưởng RLC song song (lấy áp trên khung L ∥ C)',
        formulaLatex: '\\begin{gathered} H(s) = \\frac{\\frac{\\omega_0}{Q}s}{s^2 + \\frac{\\omega_0}{Q}s + \\omega_0^2} \\\\[4pt] f_0 = \\frac{1}{2\\pi\\sqrt{LC}},\\; Q = R\\sqrt{\\frac{C}{L}} \\end{gathered}',
        note: 'Tại f₀, khung song song L ∥ C có tổng trở cực đại (hở mạch lý tưởng) nên toàn bộ áp tín hiệu xuất hiện ở Vout.'
      }
    ]);
  } else if (metrics.shapeType.includes('Thông thấp')) {
    circuit =
      order <= 1
        ? makeCircuit([
            {
              shortLabel: 'Mạch RC',
              topology: 'lowpass_rc',
              name: 'Mạch Lọc Thông thấp RC bậc 1 (lấy áp trên tụ C)',
              formulaLatex: 'H(s) = \\frac{1}{1 + sRC}, \\quad f_c = \\frac{1}{2\\pi RC}',
              note: 'Tụ C ngắn mạch tín hiệu tần số cao xuống mass và giữ nguyên thành phần tần số thấp (DC).'
            },
            {
              shortLabel: 'Mạch RL',
              topology: 'lowpass_rl',
              name: 'Mạch Lọc Thông thấp RL bậc 1 (lấy áp trên điện trở R)',
              formulaLatex: 'H(s) = \\frac{1}{1 + s\\frac{L}{R}}, \\quad f_c = \\frac{R}{2\\pi L}',
              note: 'Cuộn cảm L nối tiếp có cảm kháng jωL tăng theo tần số, cản tín hiệu cao tần và cho DC đi qua R.'
            }
          ])
        : makeCircuit([
            {
              shortLabel: 'Mạch RLC',
              topology: 'lowpass_rlc',
              name: `Mạch Thông thấp RLC bậc ${order} (lấy áp trên tụ C)`,
              formulaLatex: 'H(s) = \\frac{\\omega_0^2}{s^2 + \\frac{\\omega_0}{Q}s + \\omega_0^2}, \\quad f_0 = \\frac{1}{2\\pi\\sqrt{LC}}',
              note: 'Cuộn cảm L cản tần số cao kết hợp tụ C thoát cao tần xuống mass, độ dốc suy giảm −40 dB/decade (bậc 2).'
            },
            {
              shortLabel: 'Sallen-Key (Op-Amp)',
              topology: 'lowpass_sallen_key',
              name: `Mạch Thông thấp Sallen-Key Op-Amp bậc ${order} (Không cuộn cảm)`,
              formulaLatex: 'H(s) = \\frac{\\omega_0^2}{s^2 + \\frac{\\omega_0}{Q}s + \\omega_0^2}, \\quad f_0 = \\frac{1}{2\\pi\\sqrt{R_1 R_2 C_1 C_2}}',
              note: 'Mạch lọc chủ động dùng Op-Amp đệm (K = 1) thay thế cuộn cảm cồng kềnh, dễ chỉnh hệ số phẩm chất Q.'
            }
          ]);
  } else if (metrics.shapeType.includes('Thông cao')) {
    circuit =
      order <= 1
        ? makeCircuit([
            {
              shortLabel: 'Mạch CR',
              topology: 'highpass_cr',
              name: 'Mạch Lọc Thông cao CR bậc 1 (lấy áp trên điện trở R)',
              formulaLatex: 'H(s) = \\frac{sRC}{1 + sRC}, \\quad f_c = \\frac{1}{2\\pi RC}',
              note: 'Tụ C nối tiếp chặn hoàn toàn thành phần DC và cho tín hiệu biến thiên nhanh đi qua R.'
            },
            {
              shortLabel: 'Mạch RL',
              topology: 'highpass_rl',
              name: 'Mạch Lọc Thông cao RL bậc 1 (lấy áp trên cuộn cảm L)',
              formulaLatex: 'H(s) = \\frac{s\\frac{L}{R}}{1 + s\\frac{L}{R}}, \\quad f_c = \\frac{R}{2\\pi L}',
              note: 'Cuộn cảm L rẽ nhánh ngắn mạch DC xuống mass và có cảm kháng lớn ở tần số cao để giữ áp trên Vout.'
            }
          ])
        : makeCircuit([
            {
              shortLabel: 'Mạch RLC',
              topology: 'highpass_rlc',
              name: `Mạch Thông cao RLC bậc ${order} (lấy áp trên cuộn cảm L)`,
              formulaLatex: 'H(s) = \\frac{s^2}{s^2 + \\frac{\\omega_0}{Q}s + \\omega_0^2}, \\quad f_0 = \\frac{1}{2\\pi\\sqrt{LC}}',
              note: 'Tụ C chặn DC kết hợp cuộn cảm L thoát tần số thấp xuống mass, chỉ cho dải tần cao đi qua.'
            },
            {
              shortLabel: 'Sallen-Key (Op-Amp)',
              topology: 'highpass_sallen_key',
              name: `Mạch Thông cao Sallen-Key Op-Amp bậc ${order} (Không cuộn cảm)`,
              formulaLatex: 'H(s) = \\frac{s^2}{s^2 + \\frac{\\omega_0}{Q}s + \\omega_0^2}, \\quad f_0 = \\frac{1}{2\\pi\\sqrt{R_1 R_2 C_1 C_2}}',
              note: 'Hoán đổi vị trí R và C so với Sallen-Key thông thấp, chặn DC triệt để với độ dốc +40 dB/decade.'
            }
          ]);
  } else {
    circuit = makeCircuit([
      {
        shortLabel: 'Biquad IIR',
        topology: 'biquad_general',
        name: `Mạch Biquad IIR Tổng quát bậc ${order} (Direct Form II / Đa tầng RLC)`,
        formulaLatex: 'H(s) = \\frac{b_2 s^2 + b_1 s + b_0}{s^2 + a_1 s + a_0} \\;\\xrightarrow{\\text{Bilinear}}\\; H(z)',
        note: 'Tổ hợp ghép nối tiếp các khâu bậc 1 (RC) và bậc 2 (RLC / Sallen-Key) tạo đáp ứng đa dải.'
      }
    ]);
  }

  return {
    title: `${metrics.filterType} • ${metrics.stabilityTag}`,
    bullets,
    conclusion,
    application,
    circuit
  };
}

/*************************************************************************
 * 4. TIME-DOMAIN SOLVERS (CAUSAL, ANTI-CAUSAL, TWO-SIDED, TEST SIGNALS)
 *************************************************************************/

function generateInputSample(n, mode, signalOpts = {}) {
  if (mode === 'impulse') return n === 0 ? 1 : 0;
  if (mode === 'step') return n >= 0 ? 1 : 0;

  const sigType = signalOpts.type || 'twoTone';
  const w1 = signalOpts.w1 !== undefined ? signalOpts.w1 : 0.12 * Math.PI;
  const w2 = signalOpts.w2 !== undefined ? signalOpts.w2 : 0.72 * Math.PI;

  if (sigType === 'twoTone') {
    return Math.cos(w1 * n) + 0.75 * Math.cos(w2 * n);
  }
  if (sigType === 'noisySine') {
    // Deterministic pseudo-noise + low-freq sine
    const noise = 0.45 * Math.sin(2.43 * n + 0.7) + 0.35 * Math.cos(2.89 * n - 1.1);
    return Math.sin(w1 * n) + noise;
  }
  if (sigType === 'square') {
    return Math.sin(w1 * n) >= 0 ? 1 : -1;
  }
  if (sigType === 'chirp') {
    const Ntotal = signalOpts.numSamples || 64;
    const t = Math.max(0, n) / Math.max(1, Ntotal);
    return Math.cos(0.5 * Math.PI * t * Math.max(0, n));
  }
  return Math.cos(w1 * n);
}

function computeTimeDomainResponse(bCoeffs, aCoeffs, poles, rocType, numSamples = 64, mode = 'impulse', signalOpts = {}) {
  const { isStable, rMax } = analyzeRocAndStability(poles, rocType);
  const opts = { ...signalOpts, numSamples };

  // Case 1: Causal (or stable with all poles inside |z| < 1)
  if (rocType === 'causal' || (rocType === 'stable' && rMax < 1.0)) {
    const nIndices = new Int32Array(numSamples);
    const x = new Float64Array(numSamples);
    const y = new Float64Array(numSamples);
    const a0 = Math.abs(aCoeffs[0]) < 1e-12 ? 1 : aCoeffs[0];

    for (let n = 0; n < numSamples; n++) {
      nIndices[n] = n;
      x[n] = generateInputSample(n, mode, opts);

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

  // Case 2: Stable Anti-Causal or Two-Sided (IDFT impulse response + convolution for step/signal)
  if (isStable) {
    const Nfft = 1024;
    const Hre = new Float64Array(Nfft);
    const Him = new Float64Array(Nfft);
    for (let k = 0; k < Nfft; k++) {
      const w = (2 * Math.PI * k) / Nfft;
      const { H } = evaluateHzAtOmega(bCoeffs, aCoeffs, w);
      Hre[k] = H.re;
      Him[k] = H.im;
    }

    const evalHAtN = nVal => {
      let sum = 0;
      for (let k = 0; k < Nfft; k++) {
        const ang = (2 * Math.PI * k * nVal) / Nfft;
        sum += Hre[k] * Math.cos(ang) - Him[k] * Math.sin(ang);
      }
      return sum / Nfft;
    };

    const nIndices = new Int32Array(numSamples);
    const x = new Float64Array(numSamples);
    const y = new Float64Array(numSamples);
    const startN = rocType === 'anticausal' ? -(numSamples - 1) : -Math.floor(numSamples / 2);

    if (mode === 'impulse') {
      for (let idx = 0; idx < numSamples; idx++) {
        const n = startN + idx;
        nIndices[idx] = n;
        x[idx] = n === 0 ? 1 : 0;
        y[idx] = evalHAtN(n);
      }
      return { nIndices, x, y };
    }

    // Precompute h[k] over wide window [-256, 256] for exact step / signal convolution
    const halfW = 256;
    const hWin = new Float64Array(2 * halfW + 1);
    for (let k = -halfW; k <= halfW; k++) {
      hWin[k + halfW] = evalHAtN(k);
    }

    for (let idx = 0; idx < numSamples; idx++) {
      const n = startN + idx;
      nIndices[idx] = n;
      x[idx] = generateInputSample(n, mode, opts);
      let conv = 0;
      for (let k = -halfW; k <= halfW; k++) {
        const hk = hWin[k + halfW];
        if (Math.abs(hk) < 1e-9) continue;
        conv += hk * generateInputSample(n - k, mode, opts);
      }
      y[idx] = conv;
    }
    return { nIndices, x, y };
  }

  // Case 3: Unstable Anti-Causal backward recursion
  const nIndices = new Int32Array(numSamples);
  const x = new Float64Array(numSamples);
  const y = new Float64Array(numSamples);

  let aLastIdx = aCoeffs.length - 1;
  while (aLastIdx > 0 && Math.abs(aCoeffs[aLastIdx]) < 1e-12) aLastIdx--;
  const aN = aCoeffs[aLastIdx] || 1;

  for (let idx = 0; idx < numSamples; idx++) {
    const n = idx - (numSamples - 1);
    nIndices[idx] = n;
    x[idx] = generateInputSample(n, mode, opts);
  }

  const yMap = new Map();
  // Backward recursion from n = 0 down to -(numSamples - 1)
  for (let step = 0; step < numSamples; step++) {
    const n = -step;
    const shiftN = n + aLastIdx;
    let acc = 0;
    for (let m = 0; m < bCoeffs.length; m++) {
      acc += bCoeffs[m] * generateInputSample(shiftN - m, mode, opts);
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
 * 5. LATEX GENERATORS & GENERAL PFE CLOSED-FORM h[n] (SIMPLE + REPEATED POLES)
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

function buildFactoredLatex(zeros, poles, gain, delay = 0) {
  const formatFactors = roots => {
    if (roots.length === 0) return '1';
    const used = new Array(roots.length).fill(false);
    const factors = [];

    for (let i = 0; i < roots.length; i++) {
      if (used[i]) continue;
      const r = roots[i];
      used[i] = true;

      if (Math.abs(r.re) < 1e-4 && Math.abs(r.im) < 1e-4) {
        continue;
      }

      if (Math.abs(r.im) > 1e-3) {
        let conjIdx = -1;
        for (let j = i + 1; j < roots.length; j++) {
          if (
            !used[j] &&
            Math.abs(roots[j].re - r.re) < 0.025 &&
            Math.abs(roots[j].im + r.im) < 0.025
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
    return factors.length > 0 ? factors.join(' \\cdot ') : '1';
  };

  const kStr = formatNum(gain, 3);
  const delayStr = delay > 0 ? (delay === 1 ? 'z^{-1} \\cdot ' : `z^{-${delay}} \\cdot `) : '';
  const numF = formatFactors(zeros);
  const denF = formatFactors(poles);
  const numCombined = numF === '1' && delay > 0 ? (delay === 1 ? 'z^{-1}' : `z^{-${delay}}`) : `${delayStr}${numF}`;
  if (poles.length === 0) {
    return `H(z) = ${kStr} \\cdot ${numCombined}`;
  }
  return `H(z) = ${kStr} \\cdot \\frac{${numCombined}}{${denF}}`;
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

/* Truncated power-series helpers mod w^M for exact repeated-pole PFE */
function psTrim(p, M) {
  return p.slice(0, M);
}
function psAdd(a, b, M) {
  const res = new Array(M).fill(null).map(() => new Complex(0, 0));
  for (let i = 0; i < M; i++) {
    if (i < a.length) res[i] = res[i].add(a[i]);
    if (i < b.length) res[i] = res[i].add(b[i]);
  }
  return res;
}
function psMul(a, b, M) {
  const res = new Array(M).fill(null).map(() => new Complex(0, 0));
  for (let i = 0; i < Math.min(a.length, M); i++) {
    for (let j = 0; j < Math.min(b.length, M - i); j++) {
      res[i + j] = res[i + j].add(a[i].mul(b[j]));
    }
  }
  return res;
}
function psDiv(num, den, M) {
  const res = new Array(M).fill(null).map(() => new Complex(0, 0));
  const d0 = den[0];
  if (d0.abs() < 1e-14) return res;
  for (let i = 0; i < M; i++) {
    let acc = i < num.length ? num[i] : new Complex(0, 0);
    for (let j = 1; j <= i && j < den.length; j++) {
      acc = acc.sub(res[i - j].mul(den[j]));
    }
    res[i] = acc.div(d0);
  }
  return res;
}

function formatBinomialCoeffLatex(s, shiftStr = 'n') {
  // Coefficient for 1 / (1 - p z^-1)^s: C(n + s - 1, s - 1)
  if (s === 1) return '';
  if (s === 2) return shiftStr === 'n' ? '(n+1)' : `(${shiftStr}+1)`;
  const factors = [];
  for (let k = 1; k < s; k++) {
    factors.push(shiftStr === 'n' ? `(n+${k})` : `(${shiftStr}+${k})`);
  }
  let fact = 1;
  for (let k = 2; k < s; k++) fact *= k;
  return `\\frac{${factors.join('')}}{${fact}}`;
}

/**
 * Compute Closed-Form Analytical Impulse Response h[n] via Long Division + Exact PFE (Simple & Repeated Poles)
 */
function buildAnalyticalHnLatex(bCoeffs, aCoeffs, poles, rocType) {
  const rocInfo = analyzeRocAndStability(poles, rocType);
  if (rocType === 'stable' && rocInfo.poleOnUnitCircle) {
    return '\\nexists\\; h[n]\\text{ ổn định BIBO (cực nằm trên } |z|=1\\text{)}';
  }

  let b = bCoeffs.slice();
  let a = aCoeffs.slice();
  while (b.length > 1 && Math.abs(b[b.length - 1]) < 1e-7) b.pop();
  while (a.length > 1 && Math.abs(a[a.length - 1]) < 1e-7) a.pop();

  const a0 = Math.abs(a[0]) < 1e-12 ? 1 : a[0];

  // Case 1: Pure FIR system (no poles)
  if (poles.length === 0 || a.length <= 1) {
    const terms = [];
    for (let m = 0; m < b.length; m++) {
      const val = b[m] / a0;
      if (Math.abs(val) < 1e-4) continue;
      const sign = val < 0 ? '-' : terms.length > 0 ? '+' : '';
      const absC = Math.abs(val);
      const cStr = Math.abs(absC - 1) < 1e-4 ? '' : formatNum(absC, 3);
      const dStr = m === 0 ? '\\delta[n]' : `\\delta[n-${m}]`;
      terms.push(`${sign} ${cStr}${dStr}`);
    }
    return `h[n] = ${terms.length ? terms.join(' ') : '0'}`;
  }

  // Polynomial long division in z^{-1} if deg(B) >= deg(A)
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

  // Group poles into clusters { pole, mult }
  const activePoles = poles.filter(p => p.abs() > 1e-5);
  const groups = [];
  const pUsed = new Array(activePoles.length).fill(false);
  for (let i = 0; i < activePoles.length; i++) {
    if (pUsed[i]) continue;
    pUsed[i] = true;
    const base = activePoles[i];
    let count = 1;
    for (let j = i + 1; j < activePoles.length; j++) {
      if (!pUsed[j] && activePoles[j].sub(base).abs() < 0.015) {
        pUsed[j] = true;
        count++;
      }
    }
    groups.push({ pole: base, mult: count });
  }

  const gUsed = new Array(groups.length).fill(false);

  for (let gi = 0; gi < groups.length; gi++) {
    if (gUsed[gi]) continue;
    gUsed[gi] = true;
    const { pole: pk, mult: M } = groups[gi];
    const invPk = new Complex(1, 0).div(pk);

    // Substitute u = z^-1 = invPk * (1 - w) so (1 - pk*z^-1) = w
    // uSeries(w) = invPk - invPk * w
    const uSeries = [invPk, invPk.neg()];
    let numSeries = [new Complex(0, 0)];
    let uPow = [new Complex(1, 0)];
    for (let m = 0; m < rem.length; m++) {
      if (Math.abs(rem[m]) > 1e-12) {
        const scaled = uPow.map(c => c.scale(rem[m]));
        numSeries = psAdd(numSeries, scaled, M);
      }
      uPow = psMul(uPow, uSeries, M);
    }

    let denSeries = [new Complex(a0, 0)];
    for (let gj = 0; gj < groups.length; gj++) {
      if (gj === gi) continue;
      const pj = groups[gj].pole;
      const mj = groups[gj].mult;
      // factor: 1 - pj * invPk * (1 - w) = (1 - pj*invPk) + (pj*invPk)*w
      const pjInvPk = pj.mul(invPk);
      const lin = [new Complex(1, 0).sub(pjInvPk), pjInvPk];
      for (let t = 0; t < mj; t++) {
        denSeries = psMul(denSeries, lin, M);
      }
    }

    // Taylor coefficients qSeries[k] give C_{k, M-k} / w^{M-k}
    const qSeries = psDiv(numSeries, denSeries, M);

    const isCausalPole =
      rocType === 'causal' || (rocType === 'stable' && pk.abs() < 1.0);
    const stepStr = isCausalPole ? 'u[n]' : 'u[-n-1]';
    const rocSignFlip = isCausalPole ? 1 : -1;

    // Check for conjugate group partner
    let conjGi = -1;
    if (Math.abs(pk.im) > 1e-3) {
      conjGi = groups.findIndex(
        (g, idx) =>
          !gUsed[idx] &&
          g.mult === M &&
          Math.abs(g.pole.re - pk.re) < 0.03 &&
          Math.abs(g.pole.im + pk.im) < 0.03
      );
      if (conjGi !== -1) gUsed[conjGi] = true;
    }

    for (let s = 1; s <= M; s++) {
      const residue = qSeries[M - s];
      if (!residue || residue.abs() < 1e-4) continue;
      const binom = formatBinomialCoeffLatex(s);

      if (conjGi !== -1) {
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
        const ampStr = Math.abs(Math.abs(amp) - 1) < 1e-3 && binom ? '' : formatNum(Math.abs(amp), 3);
        terms.push(
          `${sign} ${ampStr}${binom}\\left(${rStr}\\right)^n \\cos\\left(${wPi}\\pi n${phasePart}\\right)${stepStr}`
        );
      } else {
        const amp = residue.re * rocSignFlip;
        if (Math.abs(amp) < 1e-4) continue;
        const sign = amp < 0 ? '-' : terms.length > 0 ? '+' : '';
        const ampStr = Math.abs(Math.abs(amp) - 1) < 1e-3 && binom ? '' : formatNum(Math.abs(amp), 3);
        const pStr = `\\left(${formatNum(pk.re, 2)}\\right)^n`;
        terms.push(`${sign} ${ampStr}${binom}${pStr}${stepStr}`);
      }
    }
  }

  return `h[n] = ${terms.length > 0 ? terms.join(' ') : '0'}`;
}
