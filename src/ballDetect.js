/**
 * Golf-ball scale detector (edge + Hough-style voting + radial refine).
 * More accurate diameter than brightness-only scoring; still pure JS / no ML.
 * Ball diameter default is supplied by UI (42.7 mm).
 */

function bdClamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function bdGrayscale(data, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

function bdBlur3(src, w, h) {
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

/** Sobel gradient magnitude */
function bdSobelMag(gray, w, h) {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] +
        gray[i - w + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + w - 1] +
        gray[i + w + 1];
      const gy =
        -gray[i - w - 1] -
        2 * gray[i - w] -
        gray[i - w + 1] +
        gray[i + w - 1] +
        2 * gray[i + w] +
        gray[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function bdMedian(arr) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const m = (s.length / 2) | 0;
  return s.length % 2 ? s[m] : 0.5 * (s[m - 1] + s[m]);
}

/**
 * True silhouette radius via radial profiles:
 * - measure interior brightness near center
 * - along each ray, find the innermost strong bright→dark transition
 * - half-intensity / peak-derivative with sub-pixel refine
 * - median across rays (rejects dimple/glare outliers)
 */
function bdRadialEdgeRadius(gray, mag, w, h, cx, cy, rMin, rMax) {
  // Interior reference (avoid center specular by sampling a small ring)
  let inSum = 0;
  let inN = 0;
  const inR = Math.max(2, (rMin * 0.45) | 0);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = (cx + Math.cos(a) * inR) | 0;
    const y = (cy + Math.sin(a) * inR) | 0;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    inSum += gray[y * w + x];
    inN++;
  }
  if (inN < 4) return null;
  const inMean = inSum / inN;
  if (inMean < 70) return null;

  const rays = 48;
  const radii = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    // Build 1D samples
    const vals = [];
    const mags = [];
    for (let r = 0; r <= rMax + 2; r++) {
      const x = (cx + cos * r) | 0;
      const y = (cy + sin * r) | 0;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) {
        vals.push(0);
        mags.push(0);
        break;
      }
      vals.push(gray[y * w + x]);
      mags.push(mag[y * w + x]);
    }
    if (vals.length < rMin + 3) continue;

    // Outer reference (past expected ball)
    const outStart = Math.min(vals.length - 1, rMax);
    let outSum = 0;
    let outN = 0;
    for (let r = outStart; r < vals.length; r++) {
      outSum += vals[r];
      outN++;
    }
    const outMean = outN ? outSum / outN : vals[vals.length - 1];
    // ~63%: between half-max (halo-prone) and tight core lock (~72%)
    const thresh = outMean + (inMean - outMean) * 0.63;
    if (inMean - outMean < 12) continue;

    // Innermost intensity crossing (walk outward)
    let cross = -1;
    for (let r = Math.max(2, (rMin * 0.55) | 0); r < Math.min(rMax, vals.length - 1); r++) {
      if (vals[r] >= thresh && vals[r + 1] < thresh) {
        cross = r;
        break;
      }
    }
    if (cross < 0) continue;

    // Peak drop near the crossing for stability
    let bestR = cross;
    let bestDrop = 0;
    const scan0 = Math.max(2, cross - 2);
    const scan1 = Math.min(rMax, cross + 2);
    for (let r = scan0; r < Math.min(scan1, vals.length - 1); r++) {
      const drop = vals[r] - vals[r + 1];
      const s = drop + mags[r] * 0.12;
      if (s > bestDrop) {
        bestDrop = s;
        bestR = r;
      }
    }
    if (bestDrop < 5) bestR = cross;
    if (bestR < 2) continue;

    // Sub-pixel at intensity threshold; tiny inward bias for soft blur
    let rSub = bestR + 0.4;
    if (bestR + 1 < vals.length) {
      const v0 = vals[bestR];
      const v1 = vals[bestR + 1];
      if (v0 !== v1 && v0 >= thresh && v1 <= thresh) {
        rSub = bestR + (v0 - thresh) / (v0 - v1);
      }
    }
    radii.push(Math.max(2, rSub - 0.12));
  }

  if (radii.length < 12) return null;
  radii.sort((a, b) => a - b);
  const lo = radii[Math.floor(radii.length * 0.2)];
  const hi = radii[Math.ceil(radii.length * 0.8) - 1];
  const mid = radii.filter((r) => r >= lo && r <= hi);
  const med = bdMedian(mid.length >= 8 ? mid : radii);
  if (med == null) return null;
  return { r: med, support: radii.length, spread: hi - lo };
}

/**
 * Local circle Hough around a seed center (coarse voting on edge pixels).
 */
function bdLocalHough(mag, w, h, seedX, seedY, rMin, rMax, searchR) {
  const edgeThr = 32;
  const x0 = bdClamp((seedX - searchR) | 0, 1, w - 2);
  const x1 = bdClamp((seedX + searchR) | 0, 1, w - 2);
  const y0 = bdClamp((seedY - searchR) | 0, 1, h - 2);
  const y1 = bdClamp((seedY + searchR) | 0, 1, h - 2);

  const edges = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const m = mag[y * w + x];
      if (m < edgeThr) continue;
      edges.push({ x, y, m });
    }
  }
  if (edges.length < 35) return null;

  // Cap work for phones
  const stride = Math.max(1, (edges.length / 450) | 0);
  const acc = new Map();
  const angStep = 18;
  const rStep = Math.max(1, ((rMax - rMin) / 14) | 0);
  for (let ei = 0; ei < edges.length; ei += stride) {
    const e = edges[ei];
    for (let r = rMin; r <= rMax; r += rStep) {
      for (let deg = 0; deg < 360; deg += angStep) {
        const rad = (deg * Math.PI) / 180;
        const cx = Math.round(e.x - r * Math.cos(rad));
        const cy = Math.round(e.y - r * Math.sin(rad));
        if (cx < x0 || cy < y0 || cx > x1 || cy > y1) continue;
        if (Math.hypot(cx - seedX, cy - seedY) > searchR * 0.85) continue;
        const key = cx + "," + cy + "," + r;
        acc.set(key, (acc.get(key) || 0) + e.m);
      }
    }
  }

  let best = null;
  for (const [key, votes] of acc) {
    if (!best || votes > best.votes) {
      const [cx, cy, r] = key.split(",").map(Number);
      best = { cx, cy, r, votes };
    }
  }
  if (!best || best.votes < 60) return null;
  return best;
}

/**
 * Brightness + ring score — used only for coarse candidates.
 */
function bdCoarseScore(gray, mag, w, h, cx, cy, r) {
  if (cx - r < 2 || cy - r < 2 || cx + r >= w - 2 || cy + r >= h - 2) return null;
  let inside = 0;
  let inN = 0;
  let ring = 0;
  let ringN = 0;
  const samples = Math.max(20, (r * 2.4) | 0);
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const xi = (cx + cos * r * 0.5) | 0;
    const yi = (cy + sin * r * 0.5) | 0;
    const xr = (cx + cos * r) | 0;
    const yr = (cy + sin * r) | 0;
    if (xi >= 0 && yi >= 0 && xi < w && yi < h) {
      inside += gray[yi * w + xi];
      inN++;
    }
    if (xr >= 1 && yr >= 1 && xr < w - 1 && yr < h - 1) {
      ring += mag[yr * w + xr];
      ringN++;
    }
  }
  if (inN < 8 || ringN < 10) return null;
  const meanIn = inside / inN;
  if (meanIn < 75) return null;
  return meanIn * 0.45 + (ring / ringN) * 0.55;
}

/**
 * Detect a golf ball in imageData.
 * seed {cx,cy} (normalized) → search only near that point.
 */
function detectGolfBallFromImageData(imageData, avoidSeg = null, seed = null) {
  const { data, width: w, height: h } = imageData;
  if (w < 48 || h < 48) return null;

  const gray = bdBlur3(bdGrayscale(data, w, h), w, h);
  const mag = bdSobelMag(gray, w, h);
  const minSide = Math.min(w, h);
  const rMin = Math.max(6, (minSide * 0.028) | 0);
  const rMax = Math.max(rMin + 4, (minSide * 0.12) | 0);
  const step = seed ? Math.max(2, (minSide / 80) | 0) : Math.max(3, (minSide / 48) | 0);

  let xLo = rMax + 2;
  let xHi = w - rMax - 2;
  let yLo = rMax + 2;
  let yHi = h - rMax - 2;

  if (seed && Number.isFinite(seed.cx) && Number.isFinite(seed.cy)) {
    const sx = bdClamp(seed.cx, 0.02, 0.98) * w;
    const sy = bdClamp(seed.cy, 0.02, 0.98) * h;
    const win = Math.max(rMax * 2.4, minSide * 0.18);
    xLo = bdClamp((sx - win) | 0, rMax + 2, w - rMax - 2);
    xHi = bdClamp((sx + win) | 0, rMax + 2, w - rMax - 2);
    yLo = bdClamp((sy - win) | 0, rMax + 2, h - rMax - 2);
    yHi = bdClamp((sy + win) | 0, rMax + 2, h - rMax - 2);
  }

  // 1) Coarse bright candidates
  const candidates = [];
  for (let y = yLo; y <= yHi; y += step) {
    for (let x = xLo; x <= xHi; x += step) {
      if (gray[y * w + x] < 80) continue;
      if (avoidSeg) {
        const nx = x / w;
        const ny = y / h;
        const dx = avoidSeg.x2 - avoidSeg.x1;
        const dy = avoidSeg.y2 - avoidSeg.y1;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((nx - avoidSeg.x1) * dx + (ny - avoidSeg.y1) * dy) / len2;
        t = bdClamp(t, 0, 1);
        const qx = avoidSeg.x1 + t * dx;
        const qy = avoidSeg.y1 + t * dy;
        if (Math.hypot(nx - qx, ny - qy) < 0.05) continue;
      }
      // Try a few radii for coarse score
      let local = null;
      for (let r = rMin + 2; r <= rMax; r += Math.max(2, ((rMax - rMin) / 5) | 0)) {
        const s = bdCoarseScore(gray, mag, w, h, x, y, r);
        if (s != null && (!local || s > local.s)) local = { s, r };
      }
      if (!local) continue;
      let score = local.s;
      if (seed) {
        score += Math.max(
          0,
          35 - Math.hypot(x / w - seed.cx, y / h - seed.cy) * minSide * 0.4
        );
      }
      candidates.push({ cx: x, cy: y, r: local.r, score });
    }
  }

  if (seed) {
    candidates.push({
      cx: (seed.cx * w) | 0,
      cy: (seed.cy * h) | 0,
      r: ((rMin + rMax) / 2) | 0,
      score: 50,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, Math.min(8, candidates.length));
  if (!top.length) return null;

  // 2) Refine each: local Hough + radial edge median
  let best = null;
  for (const c of top) {
    const searchR = Math.max(rMax, (minSide * 0.1) | 0);
    const hough = bdLocalHough(mag, w, h, c.cx, c.cy, rMin, rMax, searchR);
    let cx = hough ? hough.cx : c.cx;
    let cy = hough ? hough.cy : c.cy;

    // Micro-adjust center for max radial consistency
    let refined = null;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const rad = bdRadialEdgeRadius(
          gray,
          mag,
          w,
          h,
          cx + dx,
          cy + dy,
          rMin,
          rMax
        );
        if (!rad || rad.spread > rMax * 0.45) continue;
        const bright = bdCoarseScore(gray, mag, w, h, cx + dx, cy + dy, rad.r | 0);
        if (bright == null) continue;
        const score =
          rad.support * 3 +
          bright * 0.4 -
          rad.spread * 2 +
          (hough ? Math.min(40, hough.votes * 0.02) : 0);
        if (!refined || score > refined.score) {
          refined = {
            cx: cx + dx,
            cy: cy + dy,
            r: rad.r,
            score,
            support: rad.support,
          };
        }
      }
    }
    if (!refined) continue;
    if (!best || refined.score > best.score) best = refined;
  }

  if (!best) {
    // Fallback: radial fit on best coarse candidate only
    const c = top[0];
    const rad = bdRadialEdgeRadius(gray, mag, w, h, c.cx, c.cy, rMin, rMax);
    if (!rad) return null;
    best = { cx: c.cx, cy: c.cy, r: rad.r, score: rad.support * 2, support: rad.support };
  }

  if (best.support != null && best.support < 12 && !seed) return null;
  if (best.score < (seed ? 20 : 35)) return null;

  // No fudge shrink — radius comes from silhouette half-intensity / edge fit
  return {
    cx: bdClamp(best.cx / w, 0.04, 0.96),
    cy: bdClamp(best.cy / h, 0.04, 0.96),
    r: bdClamp(best.r / minSide, 0.018, 0.2),
    score: best.score,
    method: "hough+radial-silhouette",
  };
}
