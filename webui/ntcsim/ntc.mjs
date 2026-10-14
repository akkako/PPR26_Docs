/**
 * NTC 热敏电阻「温度 ↔ 电阻」换算的 JavaScript 实现（浏览器 / Node 通用）。
 *
 * 与同目录 Python 参考实现 `ntc_conversion.py` **同一套算法**，数值已做交叉验证
 * （见 `ntc_verify_js.py`，最大偏差在 1e-12 量级）。公式推导与工程说明见
 * `ntc_b_value_steinhart_hart.md`；本文件供后续网页上位机直接引用。
 *
 * 约定（与 Python 版一致）：
 *   - 温度内部一律用**开尔文**；方法名带 K 后缀的是开尔文，不带的是摄氏度。
 *   - 参考温度 T25 = 298.15 K = 25.00 ℃ 对应 R25。
 *   - 两个模型：
 *       B 值法（2 参数）         1/T = 1/T_ref + ln(R/R_ref) / B
 *       Steinhart-Hart（3 参数） 1/T = A + B·ln R + C·(ln R)³
 *   - 标定点用 [温度℃, 电阻Ω] 数组表示（JSON 友好）。
 *
 * 网页中的用法（ES 模块）：
 *
 *     import { SteinhartHartModel, temperatureFromAdcCounts } from "./ntc_conversion.mjs";
 *     const model = new SteinhartHartModel(7.08e-4, 2.8458e-4, 3.1936e-8);
 *     const t = temperatureFromAdcCounts(model, counts, 4096, 10000);   // ℃
 *
 * 传统脚本页面（webui 现有风格，无 type="module"）可以动态引入：
 *
 *     import("./ntc_conversion.mjs").then(() => {
 *         const model = NTC.betaModel(10000, 3435);   // 见文件末尾的 globalThis.NTC
 *     });
 */

export const T0_K = 273.15;
export const T25_K = 298.15;

/* -------------------------------------------------------------------------- */
/* 工具                                                                        */
/* -------------------------------------------------------------------------- */

/** 摄氏度 -> 开尔文 */
export function cToK(tC) {
    return Number(tC) + T0_K;
}

/** 开尔文 -> 摄氏度 */
export function kToC(tK) {
    return Number(tK) - T0_K;
}

function checkPositive(value, name) {
    const v = Number(value);
    if (!(v > 0) || !Number.isFinite(v)) {
        throw new Error(`${name} 必须为正数，当前为 ${value}`);
    }
    return v;
}

function weightedSum(terms, weights) {
    // 简单顺序求和：与浏览器里的常规写法一致（Python 用 math.fsum，
    // 两者差异在 1e-16 相对量级，交叉验证时按 1e-9 容差判定）。
    let total = 0;
    for (let i = 0; i < terms.length; i++) {
        total += weights === null ? terms[i] : terms[i] * weights;
    }
    return total;
}

/* -------------------------------------------------------------------------- */
/* 线性最小二乘（Householder QR，列归一化）                                     */
/* -------------------------------------------------------------------------- */

/**
 * 最小二乘 min ||mat·x − rhs||（mat 行主序 n×m，n ≥ m）。
 * 用 Householder QR 而非正规方程，避免 x³ 这类高次基函数把条件数平方。
 * @param {number[][]} mat
 * @param {number[]} rhs
 * @returns {number[]}
 */
export function householderLsq(mat, rhs) {
    const n = mat.length;
    if (n === 0) throw new Error("空方程组");
    const m = mat[0].length;
    if (n < m) throw new Error(`方程数少于未知数（${n} < ${m}）`);
    const a = mat.map((row) => row.slice());
    const b = rhs.map(Number);
    for (let k = 0; k < m; k++) {
        let norm = 0;
        for (let i = k; i < n; i++) norm += a[i][k] * a[i][k];
        norm = Math.sqrt(norm);
        if (norm === 0) continue;
        const alpha = a[k][k] >= 0 ? -norm : norm;
        const v = new Array(n).fill(0);
        v[k] = a[k][k] - alpha;
        for (let i = k + 1; i < n; i++) v[i] = a[i][k];
        let vv = 0;
        for (let i = k; i < n; i++) vv += v[i] * v[i];
        if (vv === 0) continue;
        for (let j = k; j < m; j++) {
            let s = 0;
            for (let i = k; i < n; i++) s += v[i] * a[i][j];
            s = (2 * s) / vv;
            for (let i = k; i < n; i++) a[i][j] -= s * v[i];
        }
        let sb = 0;
        for (let i = k; i < n; i++) sb += v[i] * b[i];
        sb = (2 * sb) / vv;
        for (let i = k; i < n; i++) b[i] -= sb * v[i];
    }
    const x = new Array(m).fill(0);
    for (let i = m - 1; i >= 0; i--) {
        let s = 0;
        for (let j = i + 1; j < m; j++) s += a[i][j] * x[j];
        if (a[i][i] === 0) throw new Error("奇异方程组：标定点在所选基函数下退化");
        x[i] = (b[i] - s) / a[i][i];
    }
    return x;
}

/**
 * 拟合 y ≈ Σ coeffs[k]·x^powers[k]，返回 {coeffs, rms, resid}。
 * 列归一化改善条件数；rowScale 给出每行的权重平方根（最小化 Σ(w·r)²）。
 */
export function basisLsq(xs, ys, powers, rowScale = null) {
    const n = xs.length;
    const m = powers.length;
    if (n < m) throw new Error(`标定点数 ${n} 少于系数个数 ${m}`);
    const rows = [];
    const yy = [];
    for (let i = 0; i < n; i++) {
        const w = rowScale === null ? 1 : Number(rowScale[i]);
        rows.push(powers.map((p) => w * Math.pow(xs[i], p)));
        yy.push(w * Number(ys[i]));
    }
    const colNorm = [];
    for (let j = 0; j < m; j++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += rows[i][j] * rows[i][j];
        colNorm.push(Math.sqrt(s));
        if (colNorm[j] === 0) throw new Error("基函数退化：所有标定点的 x 相同？");
    }
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) rows[i][j] /= colNorm[j];
    }
    const z = householderLsq(rows, yy);
    const coeffs = z.map((value, j) => value / colNorm[j]);
    const resid = [];
    for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < m; j++) s += coeffs[j] * Math.pow(xs[i], powers[j]);
        resid.push(s - Number(ys[i]));
    }
    let acc = 0;
    for (const r of resid) acc += r * r;
    return { coeffs, rms: Math.sqrt(acc / n), resid };
}

/* -------------------------------------------------------------------------- */
/* 三次方程（Steinhart-Hart 反解用）                                            */
/* -------------------------------------------------------------------------- */

/**
 * x³ + p·x + q = 0 的全部实根（NTC 通常 p > 0 ⇒ 单实根 Cardano 分支）。
 * @returns {number[]}
 */
export function cubicRealRoots(p, q) {
    const disc = (q / 2) ** 2 + (p / 3) ** 3;
    if (disc > 0) {
        const s = Math.sqrt(disc);
        return [Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s)];
    }
    if (disc === 0) {
        if (p === 0) return [0];
        return [3 * (q / p), -1.5 * (q / p)].sort((x, y) => x - y);
    }
    // 三实根（p < 0）：三角解法，3θ = arccos(arg)
    const r = Math.sqrt(-p / 3);
    const arg = ((3 * q) / (2 * p)) * Math.sqrt(-3 / p);
    const theta = Math.acos(Math.max(-1, Math.min(1, arg))) / 3;
    return [0, 1, 2].map((k) => 2 * r * Math.cos(theta - (2 * Math.PI * k) / 3));
}

/* -------------------------------------------------------------------------- */
/* 模型 1：B 值法                                                              */
/* -------------------------------------------------------------------------- */

/** B 值（beta）模型：R(T) = R_ref·exp(B·(1/T − 1/T_ref)) */
export class BetaModel {
    /**
     * @param {number} rRef  参考温度下的阻值（Ω）
     * @param {number} b     B 值（K）
     * @param {number} [tRefK] 参考温度（K），默认 298.15
     */
    constructor(rRef, b, tRefK = T25_K) {
        this.rRef = Number(rRef);
        this.b = Number(b);
        this.tRefK = Number(tRefK);
    }

    /** 25 ℃ 下的阻值 */
    get r25() {
        return this.resistance(25);
    }

    /** 以 25 ℃ 与 85 ℃ 两点反算的 B（B25/85 口径） */
    get b2585() {
        return betaFromTwoPoints([25, this.r25], [85, this.resistance(85)]).b;
    }

    resistanceK(tK) {
        const t = checkPositive(tK, "温度/K");
        return this.rRef * Math.exp(this.b * (1 / t - 1 / this.tRefK));
    }

    /** 温度（℃）-> 电阻（Ω） */
    resistance(tC) {
        return this.resistanceK(cToK(tC));
    }

    temperatureK(rOhm) {
        const r = checkPositive(rOhm, "电阻/Ω");
        return 1 / (1 / this.tRefK + Math.log(r / this.rRef) / this.b);
    }

    /** 电阻（Ω）-> 温度（℃） */
    temperature(rOhm) {
        return kToC(this.temperatureK(rOhm));
    }

    describe() {
        return `B 值模型: R(T0=${this.tRefK.toFixed(4)} K) = ${this.rRef.toPrecision(6)} Ω，`
            + `B = ${this.b.toPrecision(6)} K（R25 = ${this.r25.toPrecision(6)} Ω）`;
    }
}

/* -------------------------------------------------------------------------- */
/* 模型 2：Steinhart-Hart                                                      */
/* -------------------------------------------------------------------------- */

/** Steinhart-Hart 方程：1/T = A + B·ln R + C·(ln R)³（反解为闭式三次方程解） */
export class SteinhartHartModel {
    constructor(a, b, c) {
        this.a = Number(a);
        this.b = Number(b);
        this.c = Number(c);
    }

    invT(rOhm) {
        const x = Math.log(checkPositive(rOhm, "电阻/Ω"));
        return this.a + this.b * x + this.c * x * x * x;
    }

    temperatureK(rOhm) {
        return 1 / this.invT(rOhm);
    }

    /** 电阻（Ω）-> 温度（℃） */
    temperature(rOhm) {
        return kToC(this.temperatureK(rOhm));
    }

    resistanceK(tK) {
        const t = checkPositive(tK, "温度/K");
        if (this.c === 0) throw new Error("C = 0 时方程退化为 B 值模型，请改用 BetaModel");
        const invT = 1 / t;
        const p = this.b / this.c;
        const q = (this.a - invT) / this.c;
        const roots = cubicRealRoots(p, q);
        let x;
        if (roots.length === 1) {
            x = roots[0];
        } else {
            // 多实根（B、C 异号的非常规系数）：取最接近线性近似的物理根
            const xEst = this.b ? (invT - this.a) / this.b : 0;
            x = roots.reduce((best, r) => (Math.abs(r - xEst) < Math.abs(best - xEst) ? r : best));
        }
        return Math.exp(x);
    }

    /** 温度（℃）-> 电阻（Ω） */
    resistance(tC) {
        return this.resistanceK(cToK(tC));
    }

    coefficients() {
        return [this.a, this.b, this.c];
    }

    describe() {
        return `Steinhart-Hart: A = ${this.a.toPrecision(8)}，B = ${this.b.toPrecision(8)}，`
            + `C = ${this.c.toPrecision(8)}（R25 = ${this.resistance(25).toPrecision(6)} Ω）`;
    }
}

/* -------------------------------------------------------------------------- */
/* 模型 3：通用「ln R 多项式」模型                                              */
/* -------------------------------------------------------------------------- */

/** 1/T = Σ coeffs[k]·(ln R)^powers[k]（powers=(0,1)=B 值；=(0,1,3)=SH；=(0,1,2,3)=4 项） */
export class LogPolynomialModel {
    constructor(coeffs, powers = [0, 1, 2, 3]) {
        if (coeffs.length !== powers.length) throw new Error("coeffs 与 powers 长度不一致");
        this.coeffs = coeffs.map(Number);
        this.powers = powers.map(Number);
    }

    invT(rOhm) {
        const x = Math.log(checkPositive(rOhm, "电阻/Ω"));
        let s = 0;
        for (let i = 0; i < this.coeffs.length; i++) s += this.coeffs[i] * Math.pow(x, this.powers[i]);
        return s;
    }

    temperatureK(rOhm) {
        return 1 / this.invT(rOhm);
    }

    /** 电阻（Ω）-> 温度（℃） */
    temperature(rOhm) {
        return kToC(this.temperatureK(rOhm));
    }

    /** 温度（K）-> 电阻（Ω）：对 ln R 二分求解（要求单调增） */
    resistanceK(tK, xLo = -30, xHi = 30) {
        const t = checkPositive(tK, "温度/K");
        const target = 1 / t;
        const f = (x) => {
            let s = 0;
            for (let i = 0; i < this.coeffs.length; i++) s += this.coeffs[i] * Math.pow(x, this.powers[i]);
            return s - target;
        };
        let lo = xLo;
        let hi = xHi;
        for (let i = 0; i < 400 && f(lo) > 0; i++) lo -= 5;
        if (f(lo) > 0) throw new Error("反解失败：找不到下界（模型不单调？）");
        for (let i = 0; i < 400 && f(hi) < 0; i++) hi += 5;
        if (f(hi) < 0) throw new Error("反解失败：找不到上界（模型不单调？）");
        for (let i = 0; i < 200; i++) {
            const mid = 0.5 * (lo + hi);
            if (f(mid) <= 0) lo = mid;
            else hi = mid;
            if (hi - lo < 1e-14 * (1 + Math.abs(mid))) break;
        }
        return Math.exp(0.5 * (lo + hi));
    }

    /** 温度（℃）-> 电阻（Ω） */
    resistance(tC) {
        return this.resistanceK(cToK(tC));
    }

    /** 检查「1/T 随 ln R 单调增」（NTC 物理性质）；采样按温度由高到低 */
    isIncreasing(tMinC, tMaxC, samples = 257) {
        let prev = null;
        for (let i = 0; i < samples; i++) {
            const tC = tMaxC - ((tMaxC - tMinC) * i) / (samples - 1);
            const value = this.invT(this.resistance(tC));
            if (prev !== null && value <= prev) return false;
            prev = value;
        }
        return true;
    }

    describe() {
        const terms = this.coeffs
            .map((c, i) => `${c.toPrecision(8)}·(ln R)^${this.powers[i]}`)
            .join(" + ");
        return `ln R 多项式  : 1/T = ${terms}（R25 = ${this.resistance(25).toPrecision(6)} Ω）`;
    }
}

/* -------------------------------------------------------------------------- */
/* 拟合                                                                        */
/* -------------------------------------------------------------------------- */

function rowScaleFor(tsK, weights) {
    if (weights === "t") return tsK.map((t) => t * t);
    if (weights === "invT") return null;
    throw new Error("weights 只能是 'invT' 或 't'");
}

/** 拟合结果 + 各标定点上的温度残差（℃） */
export class FitResult {
    constructor(model, tC, rOhm, residC = null) {
        this.model = model;
        this.tC = tC;
        this.rOhm = rOhm;
        this.residC = residC ?? tC.map((t, i) => model.temperature(rOhm[i]) - t);
    }

    get rmsC() {
        let s = 0;
        for (const e of this.residC) s += e * e;
        return Math.sqrt(s / this.residC.length);
    }

    get maxAbsC() {
        return Math.max(...this.residC.map(Math.abs));
    }

    describe() {
        return `${this.model.describe()}；残差 RMS = ${this.rmsC.toPrecision(4)} ℃，`
            + `最大 |残差| = ${this.maxAbsC.toPrecision(4)} ℃（${this.tC.length} 点）`;
    }
}

/** 两点法求 B（精确）：B = ln(R1/R2) / (1/T1 − 1/T2) */
export function betaFromTwoPoints(p1, p2) {
    const [t1C, r1] = p1;
    const [t2C, r2] = p2;
    const t1 = cToK(t1C);
    const t2 = cToK(t2C);
    if (t1 === t2) throw new Error("两点温度相同，无法求 B");
    const b = Math.log(checkPositive(r1, "R1") / checkPositive(r2, "R2")) / (1 / t1 - 1 / t2);
    return new BetaModel(r1, b, t1);
}

/** 由多组 [温度℃, 电阻Ω] 最小二乘拟合 B 值模型（weights: 'invT' | 't'） */
export function fitBeta(points, { tRefC = 25, weights = "invT" } = {}) {
    if (!points || points.length < 2) throw new Error("B 值拟合至少需要 2 个标定点");
    const ts = points.map(([t]) => cToK(t));
    const xs = points.map(([, r]) => Math.log(checkPositive(r, "电阻/Ω")));
    const ys = ts.map((t) => 1 / t);
    const { coeffs } = basisLsq(xs, ys, [0, 1], rowScaleFor(ts, weights));
    const [a, b] = coeffs;
    if (b === 0) throw new Error("拟合得到的 1/B 为 0，数据异常");
    const beta = 1 / b;
    const tRefK = cToK(tRefC);
    const rRef = Math.exp((1 / tRefK - a) * beta);
    return new FitResult(new BetaModel(rRef, beta, tRefK),
        points.map(([t]) => t), points.map(([, r]) => r));
}

/** 三点闭式解（精确过三点），系数公式见文档 4.2 节 */
export function steinhartHartFromThreePoints(p1, p2, p3) {
    const ls = [p1, p2, p3].map(([, r]) => Math.log(checkPositive(r, "电阻/Ω")));
    const ys = [p1, p2, p3].map(([t]) => 1 / cToK(t));
    const [l1, l2, l3] = ls;
    const [y1, y2, y3] = ys;
    if (l1 === l2 || l2 === l3 || l1 === l3) {
        throw new Error("三点中出现了相同阻值，无法求解");
    }
    const gamma2 = (y2 - y1) / (l2 - l1);
    const gamma3 = (y3 - y1) / (l3 - l1);
    const denom = (l3 - l2) * (l1 + l2 + l3);
    if (Math.abs(denom) < 1e-12 * Math.abs(l1 + l2 + l3)) {
        throw new Error("三点阻值过于接近，解不稳定；请增加温度跨度或改用最小二乘");
    }
    const c = (gamma3 - gamma2) / denom;
    const b = gamma2 - c * (l1 * l1 + l1 * l2 + l2 * l2);
    const a = y1 - b * l1 - c * l1 ** 3;
    return new SteinhartHartModel(a, b, c);
}

/** Steinhart-Hart 拟合：恰好 3 点用闭式解，多于 3 点用线性最小二乘 */
export function fitSteinhartHart(points, { weights = "invT" } = {}) {
    if (!points || points.length < 3) throw new Error("Steinhart-Hart 拟合至少需要 3 个标定点");
    let model;
    if (points.length === 3) {
        model = steinhartHartFromThreePoints(...points);
    } else {
        const ts = points.map(([t]) => cToK(t));
        const xs = points.map(([, r]) => Math.log(checkPositive(r, "电阻/Ω")));
        const ys = ts.map((t) => 1 / t);
        const { coeffs } = basisLsq(xs, ys, [0, 1, 3], rowScaleFor(ts, weights));
        model = new SteinhartHartModel(...coeffs);
    }
    return new FitResult(model, points.map(([t]) => t), points.map(([, r]) => r));
}

/** 通用「ln R 多项式」拟合（powers=[0,1,2,3] 即 4 项扩展式） */
export function fitLogPolynomial(points, powers = [0, 1, 2, 3], { weights = "invT" } = {}) {
    if (!points || points.length < powers.length) throw new Error("标定点数少于系数个数");
    const ts = points.map(([t]) => cToK(t));
    const xs = points.map(([, r]) => Math.log(checkPositive(r, "电阻/Ω")));
    const ys = ts.map((t) => 1 / t);
    const { coeffs } = basisLsq(xs, ys, powers, rowScaleFor(ts, weights));
    return new FitResult(new LogPolynomialModel(coeffs, powers),
        points.map(([t]) => t), points.map(([, r]) => r));
}

/* -------------------------------------------------------------------------- */
/* 灵敏度与误差传播                                                            */
/* -------------------------------------------------------------------------- */

/** B 值模型：(1/R)·dR/dT = −B/T²（1/K） */
export function betaDrdtRelative(tC, bK) {
    const t = cToK(tC);
    return -bK / (t * t);
}

/** B 值模型：电阻相对误差 -> 温度误差（K）：|ΔT| ≈ (T²/B)·(ΔR/R) */
export function betaDtForRelativeRError(tC, bK, relRError = 0.01) {
    const t = cToK(tC);
    return (t * t) / bK * relRError;
}

/** 任意模型：电阻相对误差 -> 温度误差（K），数值微分 */
export function modelDtForRelativeRError(model, tC, relRError = 0.01, h = 1e-4) {
    const r0 = model.resistance(tC);
    const drdt = (model.resistance(tC + h) - model.resistance(tC - h)) / (2 * h);
    return Math.abs(r0 / drdt) * relRError;
}

/* -------------------------------------------------------------------------- */
/* 分压电路 / ADC / 自热                                                       */
/* -------------------------------------------------------------------------- */

/** NTC 在下臂：V = V_exc·R/(R+Rs) ⇒ R = Rs·V/(V_exc − V) */
export function rFromDividerLowSide(vNtc, vExc, rSeries) {
    if (!(vNtc >= 0 && vNtc < vExc)) throw new Error("电压必须落在 [0, V_exc) 内（NTC 开路/短路？）");
    return (rSeries * vNtc) / (vExc - vNtc);
}

/** NTC 在上臂：V = V_exc·Rs/(R+Rs) ⇒ R = Rs·(V_exc − V)/V */
export function rFromDividerHighSide(vNtc, vExc, rSeries) {
    if (!(vNtc > 0 && vNtc <= vExc)) throw new Error("电压必须落在 (0, V_exc] 内");
    return (rSeries * (vExc - vNtc)) / vNtc;
}

/** NTC 下臂分压输出（V） */
export function vDividerLowSide(rNtc, rSeries, vExc) {
    return (vExc * rNtc) / (rNtc + rSeries);
}

/** 比例式 ADC（Vref = 激励电压）反推电阻：R = Rs·counts/(full_scale − counts) */
export function rFromAdcLowSide(counts, fullScale, rSeries) {
    if (!(counts >= 0 && counts < fullScale)) throw new Error("ADC 读数越界");
    return (rSeries * counts) / (fullScale - counts);
}

/** 电阻 -> ADC 计数（比例式，NTC 下臂） */
export function adcCountsFromRLowSide(rNtc, rSeries, fullScale) {
    return (fullScale * rNtc) / (rNtc + rSeries);
}

/**
 * ADC 读数 -> 温度（℃）——网页上位机最常用的组合调用。
 * @param {object} model BetaModel | SteinhartHartModel | LogPolynomialModel
 * @param {number} counts  ADC 读数
 * @param {number} fullScale 满量程计数（如 12 位 = 4096）
 * @param {number} rSeries 串联电阻（Ω）
 * @param {boolean} [clamp=true] 读数越界时钳位到 1 LSB / 满量程-1 LSB 而不是抛错
 */
export function temperatureFromAdcCounts(model, counts, fullScale, rSeries, clamp = true) {
    let c = Number(counts);
    if (clamp) c = Math.min(Math.max(c, 1), fullScale - 1);
    return model.temperature(rFromAdcLowSide(c, fullScale, rSeries));
}

/** 比例式 ADC 量化引起的温度不确定度（K） */
export function adcQuantizationDtC(model, tC, rSeries, bits = 12, lsbFraction = 0.5) {
    const r = model.resistance(tC);
    const amplification = (1 + r / rSeries) * (1 + rSeries / r);
    const deltaRRel = (amplification * lsbFraction) / 2 ** bits;
    return modelDtForRelativeRError(model, tC, deltaRRel);
}

/** 稳态自热温升（K）：ΔT = P/δ，P = I²·R，I = V_exc/(R + Rs) */
export function selfHeatingDtC(vExc, rSeries, rNtc, dissipationMwPerK) {
    const current = vExc / (rNtc + rSeries);
    const pMw = current * current * rNtc * 1000;
    return pMw / dissipationMwPerK;
}

/* -------------------------------------------------------------------------- */
/* 查表（LUT）                                                                 */
/* -------------------------------------------------------------------------- */

export const LUT_MODES = ["invT", "linear"];

/** 生成等温度间距的电阻表，返回 {rs, tMinC, stepC}；rs 按温度升高递减 */
export function makeLutResistance(model, tMinC, tMaxC, stepC) {
    if (!(stepC > 0)) throw new Error("步长必须为正");
    if (!(tMaxC > tMinC)) throw new Error("上限必须大于下限");
    const count = Math.round((tMaxC - tMinC) / stepC) + 1;
    const rs = [];
    for (let i = 0; i < count; i++) rs.push(model.resistance(tMinC + i * stepC));
    return { rs, tMinC, stepC };
}

/**
 * 查表 + 插值：电阻（Ω）-> 温度（K）。
 * mode='invT'（默认）在 ln R 上线性插值 1/T，精度最好；'linear' 直接在 T 上插值。
 * 阻值超出表的范围时钳位到端点（固件/上位机常见做法）。
 */
export function lutTemperatureK(rs, rOhm, tMinC, stepC, mode = "invT") {
    if (!LUT_MODES.includes(mode)) throw new Error(`mode 只能是 ${LUT_MODES.join(" / ")}`);
    const n = rs.length;
    const tMinK = cToK(tMinC);
    if (rOhm >= rs[0]) return tMinK;
    if (rOhm <= rs[n - 1]) return cToK(tMinC + (n - 1) * stepC);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (rs[mid] > rOhm) lo = mid;
        else hi = mid;
    }
    const t0 = cToK(tMinC + lo * stepC);
    const t1 = cToK(tMinC + hi * stepC);
    if (mode === "invT") {
        const frac = (Math.log(rOhm) - Math.log(rs[lo])) / (Math.log(rs[hi]) - Math.log(rs[lo]));
        return 1 / (1 / t0 + frac * (1 / t1 - 1 / t0));
    }
    const frac = (rOhm - rs[lo]) / (rs[hi] - rs[lo]);
    return t0 + frac * (t1 - t0);
}

/** 查表 + 插值：电阻（Ω）-> 温度（℃） */
export function lutTemperature(rs, rOhm, tMinC, stepC, mode = "invT") {
    return kToC(lutTemperatureK(rs, rOhm, tMinC, stepC, mode));
}

/** 表覆盖范围内，查表插值相对模型自身的最大温度误差（℃） */
export function lutMaxErrorC(model, rs, tMinC, stepC, mode = "invT", samples = 2001) {
    const tMaxC = tMinC + (rs.length - 1) * stepC;
    let worst = 0;
    for (let i = 0; i < samples; i++) {
        const tC = tMinC + ((tMaxC - tMinC) * i) / (samples - 1);
        const err = lutTemperature(rs, model.resistance(tC), tMinC, stepC, mode) - tC;
        worst = Math.max(worst, Math.abs(err));
    }
    return worst;
}

/** 格式化成合法 C float 字面量（补小数点，避免 10000f） */
function cFloat(value) {
    let text = Number(value).toPrecision(7);
    if (text.includes("e")) {
        // 统一成 C 可接受的指数写法（去掉指数里的多余零：1e-7 而非 1e-07 亦可，保留即可）
        text = text.replace("e", "e");
    }
    if (!text.includes(".") && !text.includes("e") && !text.includes("E")) text += ".0";
    return text + "f";
}

/** 生成 C 头文件文本（与 Python 版 emit_c_header 语义一致，返回字符串） */
export function emitCHeader(rs, tMinC, stepC, { name = "ntc_lut", comment = "" } = {}) {
    const n = rs.length;
    const upper = name.toUpperCase();
    const tMaxC = tMinC + (n - 1) * stepC;
    const lines = [];
    lines.push(`/* 由 ntc_conversion.mjs 生成（emitCHeader）。${comment} */`);
    lines.push(`#ifndef ${upper}_H`);
    lines.push(`#define ${upper}_H`);
    lines.push("");
    lines.push("#include <math.h>");
    lines.push("");
    lines.push(`#define ${upper}_T_MIN_C   (${cFloat(tMinC)})`);
    lines.push(`#define ${upper}_T_MAX_C   (${cFloat(tMaxC)})`);
    lines.push(`#define ${upper}_STEP_C    (${cFloat(stepC)})`);
    lines.push(`#define ${upper}_COUNT     (${n})`);
    lines.push("");
    lines.push(`/* 表按阻值降序：索引 i 对应温度 T_MIN_C + i*STEP_C */`);
    lines.push(`static const float ${name}_ohm[${upper}_COUNT] = {`);
    for (let i = 0; i < n; i += 4) {
        lines.push("    " + rs.slice(i, i + 4).map(cFloat).join(", ") + ",");
    }
    lines.push("};");
    lines.push("");
    lines.push(`/* 电阻(Ω) -> 温度(℃)：二分查找 + ln R 上线性插值 1/T，超范围钳位 */`);
    lines.push(`static inline float ${name}_temp_c_from_r(float r_ohm)`);
    lines.push("{");
    lines.push(`    int lo = 0, hi = ${upper}_COUNT - 1;`);
    lines.push("    float l0, l1, frac, t0, t1, inv0, inv1;");
    lines.push(`    if (r_ohm >= ${name}_ohm[0]) return ${upper}_T_MIN_C;`);
    lines.push(`    if (r_ohm <= ${name}_ohm[hi]) return ${upper}_T_MAX_C;`);
    lines.push("    while (hi - lo > 1) {");
    lines.push("        int mid = (lo + hi) / 2;");
    lines.push(`        if (${name}_ohm[mid] > r_ohm) lo = mid; else hi = mid;`);
    lines.push("    }");
    lines.push(`    l0 = logf(${name}_ohm[lo]);`);
    lines.push(`    l1 = logf(${name}_ohm[hi]);`);
    lines.push("    frac = (logf(r_ohm) - l0) / (l1 - l0);");
    lines.push(`    t0 = ${upper}_T_MIN_C + (float)lo * ${upper}_STEP_C;`);
    lines.push(`    t1 = t0 + ${upper}_STEP_C;`);
    lines.push("    inv0 = 1.0f / (t0 + 273.15f);");
    lines.push("    inv1 = 1.0f / (t1 + 273.15f);");
    lines.push("    return 1.0f / (inv0 + frac * (inv1 - inv0)) - 273.15f;");
    lines.push("}");
    lines.push("");
    lines.push("#endif");
    return lines.join("\n") + "\n";
}

/* -------------------------------------------------------------------------- */
/* 合成参考传感器（与 Python 版一致，用于自检与演示）                            */
/* -------------------------------------------------------------------------- */

export const NOMINAL_R25 = 10000.0;
export const NOMINAL_B2585 = 3435.0;

/** 参考传感器：局部 B 随 ln R 线性变化（正/反解都有闭式） */
export class LogBReferenceModel {
    /**
     * @param {number} r25 25 ℃ 阻值
     * @param {number} b0  u = 0（25 ℃）处的局部 B（K）
     * @param {number} m   dB/du（K），典型 −20…−50
     */
    constructor(r25, b0, m) {
        this.r25 = Number(r25);
        this.b0 = Number(b0);
        this.m = Number(m);
    }

    /** 构造一枚 B25/85 恰好等于目标的参考传感器（对 b0 二分求解） */
    static withB2585(r25, b2585, m) {
        const bOfB0 = (b0) => {
            const model = new LogBReferenceModel(r25, b0, m);
            const r85 = model.resistance(85);
            return Math.log(r85 / r25) / (1 / cToK(85) - 1 / cToK(25));
        };
        let lo = 2900;
        let hi = 3900;
        for (let i = 0; i < 200; i++) {
            const mid = 0.5 * (lo + hi);
            if (bOfB0(mid) < b2585) lo = mid;
            else hi = mid;
        }
        return new LogBReferenceModel(r25, 0.5 * (lo + hi), m);
    }

    invT(rOhm) {
        const u = Math.log(checkPositive(rOhm, "电阻/Ω") / this.r25);
        const invT25 = 1 / T25_K;
        if (Math.abs(this.m) < 1e-12) return invT25 + u / this.b0;
        return invT25 + Math.log1p((this.m * u) / this.b0) / this.m;
    }

    temperatureK(rOhm) {
        return 1 / this.invT(rOhm);
    }

    /** 电阻（Ω）-> 温度（℃） */
    temperature(rOhm) {
        return kToC(this.temperatureK(rOhm));
    }

    resistanceK(tK) {
        const t = checkPositive(tK, "温度/K");
        const invT25 = 1 / T25_K;
        let u;
        if (Math.abs(this.m) < 1e-12) u = this.b0 * (1 / t - invT25);
        else u = (this.b0 * Math.expm1(this.m * (1 / t - invT25))) / this.m;
        return this.r25 * Math.exp(u);
    }

    /** 温度（℃）-> 电阻（Ω） */
    resistance(tC) {
        return this.resistanceK(cToK(tC));
    }

    /** 两点法口径的 B（如 B25/85） */
    bTwoPoint(t1C, t2C) {
        return betaFromTwoPoints([t1C, this.resistance(t1C)], [t2C, this.resistance(t2C)]).b;
    }

    describe() {
        return `参考传感器    : R25 = ${this.r25.toPrecision(6)} Ω，B(25℃) = ${this.b0.toFixed(2)} K，`
            + `dB/du = ${this.m} K，区间 B：B0/25 = ${this.bTwoPoint(0, 25).toFixed(1)}、`
            + `B25/50 = ${this.bTwoPoint(25, 50).toFixed(1)}、`
            + `B25/85 = ${this.bTwoPoint(25, 85).toFixed(1)}、`
            + `B25/100 = ${this.bTwoPoint(25, 100).toFixed(1)} K`;
    }
}

/** 参考 1：B 变化温和 */
export function referenceSoft() {
    return LogBReferenceModel.withB2585(NOMINAL_R25, NOMINAL_B2585, -20.0);
}

/** 参考 2：B 变化强（曲率大） */
export function referenceStrong() {
    return LogBReferenceModel.withB2585(NOMINAL_R25, NOMINAL_B2585, -45.0);
}

/** 在 [tMinC, tMaxC] 上等温距取 count 个标定点，返回 [[t,r], ...] */
export function fitPoints(tMinC, tMaxC, count, truth) {
    const out = [];
    for (let i = 0; i < count; i++) {
        const tC = count === 1 ? tMinC : tMinC + ((tMaxC - tMinC) * i) / (count - 1);
        out.push([tC, truth.resistance(tC)]);
    }
    return out;
}

/** 在温度网格上比较「模型反算温度」与参考温度，返回 [RMS, 最大误差]（K） */
export function compareModelAccuracy(truth, model, tMinC, tMaxC, stepC = 0.5) {
    const n = Math.max(2, Math.round((tMaxC - tMinC) / stepC) + 1);
    const errs = [];
    for (let i = 0; i < n; i++) {
        const tC = tMinC + ((tMaxC - tMinC) * i) / (n - 1);
        errs.push(model.temperature(truth.resistance(tC)) - tC);
    }
    let acc = 0;
    for (const e of errs) acc += e * e;
    return [Math.sqrt(acc / errs.length), Math.max(...errs.map(Math.abs))];
}

/** 便捷构造：B 值模型（R25, B） */
export function betaModel(r25, b, tRefK = T25_K) {
    return new BetaModel(r25, b, tRefK);
}

/** 便捷构造：Steinhart-Hart 模型（A, B, C） */
export function steinhartHartModel(a, b, c) {
    return new SteinhartHartModel(a, b, c);
}

/* -------------------------------------------------------------------------- */
/* 传统脚本页面可直接用 window.NTC（模块方式引入后同样有效）                     */
/* -------------------------------------------------------------------------- */
if (typeof globalThis !== "undefined") {
    globalThis.NTC = {
        T0_K, T25_K, cToK, kToC,
        BetaModel, SteinhartHartModel, LogPolynomialModel, LogBReferenceModel,
        betaModel, steinhartHartModel,
        betaFromTwoPoints, fitBeta, steinhartHartFromThreePoints,
        fitSteinhartHart, fitLogPolynomial,
        betaDrdtRelative, betaDtForRelativeRError, modelDtForRelativeRError,
        rFromDividerLowSide, rFromDividerHighSide, vDividerLowSide,
        rFromAdcLowSide, adcCountsFromRLowSide, temperatureFromAdcCounts,
        adcQuantizationDtC, selfHeatingDtC,
        makeLutResistance, lutTemperature, lutTemperatureK, lutMaxErrorC,
        emitCHeader, LUT_MODES,
        referenceSoft, referenceStrong, fitPoints, compareModelAccuracy,
    };
}
