/**
 * Putter shaft detector — fast ridge tracking + light line fit.
 * Tuned to work on phone CPUs without blocking the UI thread.
 */

function sdClamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function sdGrayscale(data, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

function sdBlur3(src, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          s += src[(y + dy) * w + (x + dx)];
        }
      }
      out[y * w + x] = s / 9;
    }
  }
  // copy borders
  for (let x = 0; x < w; x++) {
    out[x] = src[x];
    out[(h - 1) * w + x] = src[(h - 1) * w + x];
  }
  for (let y = 0; y < h; y++) {
    out[y * w] = src[y * w];
    out[y * w + w - 1] = src[y * w + w - 1];
  }
  return out;
}

function sdStretch(src) {
  let lo = 255;
  let hi = 0;
  const step = Math.max(1, (src.length / 2000) | 0);
  for (let i = 0; i < src.length; i += step) {
    const v = src[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = Math.max(12, hi - lo);
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    out[i] = sdClamp(((src[i] - lo) / span) * 255, 0, 255);
  }
  return out;
}

function sdLie(x1, y1, x2, y2) {
  return (Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)) * 180) / Math.PI;
}

function sdNormalizeSeg(x1, y1, x2, y2, w, h, score) {
  if (y1 > y2) {
    const tx = x1;
    const ty = y1;
    x1 = x2;
    y1 = y2;
    x2 = tx;
    y2 = ty;
  }
  const lieDeg = sdLie(x1, y1, x2, y2);
  if (lieDeg < 45 || lieDeg > 89.8) return null;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < Math.min(w, h) * 0.18) return null;
  return {
    x1: sdClamp(x1 / w, 0.02, 0.98),
    y1: sdClamp(y1 / h, 0.02, 0.98),
    x2: sdClamp(x2 / w, 0.02, 0.98),
    y2: sdClamp(y2 / h, 0.02, 0.98),
    lieDeg,
    score,
  };
}

/**
 * Per-row: locate shaft center, then left/right boundary edges (handles taper).
 * Rejects width outliers so shadows / floor lines don't skew the fit.
 */
function sdSampleDualEdges(gray, w, h, prior) {
  const xMin = Math.floor(w * 0.04);
  const xMax = Math.floor(w * 0.96);
  const y0 = Math.floor(h * 0.05);
  const y1 = Math.floor(h * 0.95);
  const stepY = Math.max(1, Math.round(h / 110));
  const maxHalf = Math.max(10, Math.round(w * 0.09));

  const leftPts = [];
  const rightPts = [];
  const midPts = [];
  const widths = [];
  let lastMid = prior ? ((prior.x1 + prior.x2) / 2) * w : w * 0.5;

  for (let y = y0; y < y1; y += stepY) {
    let expected = lastMid;
    if (prior) {
      const t = (y / h - prior.y1) / Math.max(1e-6, prior.y2 - prior.y1);
      expected = (prior.x1 + t * (prior.x2 - prior.x1)) * w;
    }
    const searchR =
      prior && midPts.length > 2 ? Math.max(14, w * 0.16) : Math.max(24, w * 0.4);
    const xa = sdClamp((expected - searchR) | 0, xMin, xMax);
    const xb = sdClamp((expected + searchR) | 0, xMin, xMax);
    if (xb - xa < 8) continue;

    // Center: dark valley / bright ridge / edge energy
    let bestC = null;
    for (let x = xa + 2; x <= xb - 2; x++) {
      const i = y * w + x;
      const c = gray[i];
      const l = gray[i - 1];
      const r = gray[i + 1];
      const gx = r - l;
      const dark = (l + r) * 0.5 - c + Math.abs(gx) * 0.2;
      const bright = c - (l + r) * 0.5 + Math.abs(gx) * 0.15;
      const s = Math.max(dark, bright);
      if (s > 3 && (!bestC || s > bestC.s)) bestC = { x, s };
    }
    if (!bestC) continue;
    if (midPts.length >= 2 && Math.abs(bestC.x - lastMid) > w * 0.12) continue;

    const cx = bestC.x;
    let bestL = null;
    const l0 = Math.max(xMin + 1, cx - maxHalf);
    for (let x = cx - 1; x >= l0; x--) {
      const gx = Math.abs(gray[y * w + x + 1] - gray[y * w + x - 1]);
      // Mild outer bias — less than before to avoid floor/shadow lock
      const s = gx + (cx - x) * 0.025;
      if (gx >= 5 && (!bestL || s > bestL.s)) bestL = { x, s: gx };
    }
    let bestR = null;
    const r1 = Math.min(xMax - 1, cx + maxHalf);
    for (let x = cx + 1; x <= r1; x++) {
      const gx = Math.abs(gray[y * w + x + 1] - gray[y * w + x - 1]);
      const s = gx + (x - cx) * 0.025;
      if (gx >= 5 && (!bestR || s > bestR.s)) bestR = { x, s: gx };
    }

    if (!bestL || !bestR || bestL.s < 5 || bestR.s < 5) continue;
    const width = bestR.x - bestL.x;
    if (width < 3 || width > maxHalf * 2.2) continue;
    if (!(bestL.x < cx && cx < bestR.x)) continue;

    // Smooth width continuity (taper OK, jumps not)
    if (widths.length >= 2) {
      const prev = widths[widths.length - 1];
      if (Math.abs(width - prev) > Math.max(6, prev * 0.45)) continue;
    }

    leftPts.push({ x: bestL.x, y, w: bestL.s });
    rightPts.push({ x: bestR.x, y, w: bestR.s });
    midPts.push({ x: (bestL.x + bestR.x) * 0.5, y, w: bestC.s });
    widths.push(width);
    lastMid = (bestL.x + bestR.x) * 0.5;
  }

  // MAD width prune
  if (widths.length >= 10) {
    const sorted = widths.slice().sort((a, b) => a - b);
    const med = sorted[(sorted.length / 2) | 0];
    const devs = widths.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = Math.max(1.5, devs[(devs.length / 2) | 0] * 1.4826);
    const keepL = [];
    const keepR = [];
    const keepM = [];
    for (let i = 0; i < widths.length; i++) {
      if (Math.abs(widths[i] - med) <= mad * 2.5) {
        keepL.push(leftPts[i]);
        keepR.push(rightPts[i]);
        keepM.push(midPts[i]);
      }
    }
    if (keepL.length >= 8) {
      return { leftPts: keepL, rightPts: keepR, midPts: keepM };
    }
  }

  return { leftPts, rightPts, midPts };
}

function sdFitLine(points, w, h) {
  if (points.length < 8) return null;

  let sy = 0;
  let sx = 0;
  let syy = 0;
  let sxy = 0;
  let n = points.length;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    syy += p.y * p.y;
    sxy += p.x * p.y;
  }
  let denom = n * syy - sy * sy;
  if (Math.abs(denom) < 1e-4) return null;
  let m = (n * sxy - sx * sy) / denom;
  let c = (sx - m * sy) / n;

  // Residual MAD → adaptive inlier band (tighter than fixed 4.5px when clean)
  const residuals = points.map((p) => Math.abs(p.x - (m * p.y + c)));
  const resSorted = residuals.slice().sort((a, b) => a - b);
  const resMed = resSorted[(resSorted.length / 2) | 0];
  const absDev = residuals.map((r) => Math.abs(r - resMed)).sort((a, b) => a - b);
  const mad = Math.max(0.6, absDev[(absDev.length / 2) | 0] * 1.4826);
  const thr = Math.min(4.5, Math.max(1.8, mad * 2.8));

  const inliers = [];
  for (let i = 0; i < points.length; i++) {
    if (residuals[i] <= thr) inliers.push(points[i]);
  }
  if (inliers.length < 6) return null;

  sy = sx = syy = sxy = 0;
  n = inliers.length;
  for (const p of inliers) {
    sx += p.x;
    sy += p.y;
    syy += p.y * p.y;
    sxy += p.x * p.y;
  }
  denom = n * syy - sy * sy;
  if (Math.abs(denom) < 1e-4) return null;
  m = (n * sxy - sx * sy) / denom;
  c = (sx - m * sy) / n;

  inliers.sort((a, b) => a.y - b.y);
  let run0 = 0;
  let b0 = 0;
  let b1 = 0;
  for (let i = 1; i <= inliers.length; i++) {
    const gap = i < inliers.length ? inliers[i].y - inliers[i - 1].y : Infinity;
    if (gap > h * 0.1 || i === inliers.length) {
      if (i - 1 - run0 > b1 - b0) {
        b0 = run0;
        b1 = i - 1;
      }
      run0 = i;
    }
  }
  const run = inliers.slice(b0, b1 + 1);
  if (run.length < 6) return null;

  // Central portion orientation (handles taper / thickness change)
  const i0 = Math.floor(run.length * 0.25);
  const i1 = Math.max(i0 + 2, Math.ceil(run.length * 0.75) - 1);
  const mid = run.slice(i0, i1 + 1);
  let msy = 0;
  let msx = 0;
  let msyy = 0;
  let msxy = 0;
  const mn = mid.length;
  for (const p of mid) {
    msx += p.x;
    msy += p.y;
    msyy += p.y * p.y;
    msxy += p.x * p.y;
  }
  const md = mn * msyy - msy * msy;
  if (Math.abs(md) < 1e-4) return null;
  const mm = (mn * msxy - msx * msy) / md;
  const mc = (msx - mm * msy) / mn;

  const yTop = run[0].y;
  const yBot = run[run.length - 1].y;
  if (yBot - yTop < h * 0.18) return null;

  const x1 = mm * yTop + mc;
  const x2 = mm * yBot + mc;
  const lie = sdLie(x1, yTop, x2, yBot);
  if (lie < 45 || lie > 89.8) return null;

  const midX = (x1 + x2) / 2 / w;
  const score =
    mid.length * 10 +
    ((yBot - yTop) / h) * 60 +
    (1.2 - Math.abs(midX - 0.5)) * 25 +
    (1 - Math.abs(lie - 70) / 50) * 15;

  return sdNormalizeSeg(x1, yTop, x2, yBot, w, h, score);
}

/**
 * Backup: find strongest near-vertical line via simple angle sweep on |gx|.
 */
function sdSweepLine(gray, w, h) {
  // Build sparse edge points where |gx| is high
  const pts = [];
  const stride = Math.max(2, (Math.min(w, h) / 70) | 0);
  for (let y = (h * 0.08) | 0; y < h * 0.92; y += stride) {
    for (let x = (w * 0.1) | 0; x < w * 0.9; x += stride) {
      const gx = gray[y * w + x + 1] - gray[y * w + x - 1];
      const a = Math.abs(gx);
      if (a > 12) pts.push({ x, y, a });
    }
  }
  if (pts.length < 30) return null;

  let best = null;
  for (let deg = 50; deg <= 130; deg += 3) {
    const rad = (deg * Math.PI) / 180;
    const tx = Math.cos(rad);
    const ty = Math.sin(rad);
    const nx = -ty;
    const ny = tx;
    const buckets = new Map();
    for (const p of pts) {
      const rho = Math.round((p.x * nx + p.y * ny) / 3) * 3;
      buckets.set(rho, (buckets.get(rho) || 0) + p.a);
    }
    let peakRho = 0;
    let peakV = 0;
    for (const [rho, v] of buckets) {
      if (v > peakV) {
        peakV = v;
        peakRho = rho;
      }
    }
    if (peakV < 200) continue;

    // Collect support along line
    const along = [];
    for (const p of pts) {
      if (Math.abs(p.x * nx + p.y * ny - peakRho) > 4) continue;
      along.push(p);
    }
    if (along.length < 12) continue;
    along.sort((a, b) => a.y - b.y);
    const p0 = along[Math.floor(along.length * 0.15)];
    const p1 = along[Math.floor(along.length * 0.85)];
    const seg = sdNormalizeSeg(p0.x, p0.y, p1.x, p1.y, w, h, peakV * 0.05 + along.length);
    if (!seg) continue;
    if (!best || seg.score > best.score) best = seg;
  }
  return best;
}

function detectShaftFromImageData(imageData, prior = null) {
  const { data, width: w, height: h } = imageData;
  if (w < 40 || h < 40) return null;

  const gray = sdBlur3(sdStretch(sdGrayscale(data, w, h)), w, h);
  const { leftPts, rightPts, midPts } = sdSampleDualEdges(gray, w, h, prior);

  const left = sdFitLine(leftPts, w, h);
  const right = sdFitLine(rightPts, w, h);
  const mid = sdFitLine(midPts, w, h);
  const swept = sdSweepLine(gray, w, h);

  // Prefer dual-edge when both sides lock; weight by fit score
  if (left && right) {
    const disagree = Math.abs(left.lieDeg - right.lieDeg);
    const wL = Math.max(1, left.score);
    const wR = Math.max(1, right.score);
    let lieDeg = (left.lieDeg * wL + right.lieDeg * wR) / (wL + wR);
    let dualEdge = true;
    let useLeft = left;
    let useRight = right;

    // Hard gate: large L/R disagreement → prefer stronger edge (+ mid if available)
    if (disagree > 2.0) {
      if (mid && Math.abs(mid.lieDeg - lieDeg) < disagree) {
        lieDeg = mid.lieDeg;
        dualEdge = false;
        useLeft = null;
        useRight = null;
      } else if (wL >= wR) {
        lieDeg = left.lieDeg;
        dualEdge = false;
        useRight = null;
      } else {
        lieDeg = right.lieDeg;
        dualEdge = false;
        useLeft = null;
      }
    }

    const center = mid || {
      x1: (left.x1 + right.x1) / 2,
      y1: (left.y1 + right.y1) / 2,
      x2: (left.x2 + right.x2) / 2,
      y2: (left.y2 + right.y2) / 2,
    };
    const score =
      (left.score + right.score) * 0.55 +
      Math.max(0, 30 - disagree * 8) +
      (dualEdge ? 12 : 0);
    let boost = 0;
    if (prior) {
      const d =
        Math.hypot(center.x1 - prior.x1, center.y1 - prior.y1) +
        Math.hypot(center.x2 - prior.x2, center.y2 - prior.y2);
      boost = Math.max(0, 20 - d * 35);
    }
    return {
      x1: center.x1,
      y1: center.y1,
      x2: center.x2,
      y2: center.y2,
      left: useLeft
        ? { x1: useLeft.x1, y1: useLeft.y1, x2: useLeft.x2, y2: useLeft.y2, lieDeg: useLeft.lieDeg, score: useLeft.score }
        : null,
      right: useRight
        ? {
            x1: useRight.x1,
            y1: useRight.y1,
            x2: useRight.x2,
            y2: useRight.y2,
            lieDeg: useRight.lieDeg,
            score: useRight.score,
          }
        : null,
      lieLeft: left.lieDeg,
      lieRight: right.lieDeg,
      lieDeg,
      weightLeft: wL,
      weightRight: wR,
      score: score + boost,
      dualEdge,
    };
  }

  // Fallback: single centerline / sweep
  let best = null;
  for (const cand of [mid, swept, left, right]) {
    if (!cand) continue;
    let score = cand.score;
    if (prior) {
      const d =
        Math.hypot(cand.x1 - prior.x1, cand.y1 - prior.y1) +
        Math.hypot(cand.x2 - prior.x2, cand.y2 - prior.y2);
      score += Math.max(0, 20 - d * 35);
    }
    if (!best || score > best.score) {
      best = { ...cand, score, dualEdge: false, left: null, right: null };
    }
  }
  return best;
}

function drawCover(ctx, source, dw, dh) {
  const sw = source.videoWidth || source.width;
  const sh = source.videoHeight || source.height;
  if (!sw || !sh) return false;
  const sa = sw / sh;
  const da = dw / dh;
  let sx = 0;
  let sy = 0;
  let sWidth = sw;
  let sHeight = sh;
  if (sa > da) {
    sWidth = sh * da;
    sx = (sw - sWidth) / 2;
  } else {
    sHeight = sw / da;
    sy = (sh - sHeight) / 2;
  }
  ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, dw, dh);
  return true;
}

function grabDetectFrame(source, viewW, viewH, maxWidth = 280) {
  if (!viewW || !viewH) return null;
  const scale = Math.min(1, maxWidth / viewW);
  const w = Math.max(64, Math.round(viewW * scale));
  const h = Math.max(86, Math.round(viewH * scale));
  const canvas =
    grabDetectFrame._canvas || (grabDetectFrame._canvas = document.createElement("canvas"));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  if (!drawCover(ctx, source, w, h)) return null;
  try {
    return ctx.getImageData(0, 0, w, h);
  } catch (err) {
    console.warn("getImageData failed", err);
    return null;
  }
}
