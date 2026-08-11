const LEVEL_TOLERANCE_DEG = 2.5;
/** Level HUD bubble / progress ring saturate at this |tilt| (degrees) */
const LEVEL_UI_RANGE_DEG = 3;
/** Length-mode L/R & U/D meters saturate at this |tilt| (degrees) */
const LEVEL_METER_RANGE_LENGTH_DEG = 30;
/** Lie-mode Yaw & Pitch meters saturate at this |tilt| (degrees) */
const LEVEL_METER_RANGE_LIE_DEG = 30;
/** Length-mode auto-freeze |tilt| (degrees) — roll & pitch */
const AUTO_FREEZE_ROLL_DEG = 0.5;
/** Length-mode hold inside tolerance before freeze */
const AUTO_FREEZE_HOLD_MS = 650;
/** Lie-mode: left-right only, tighter window */
const LIE_AUTO_FREEZE_ROLL_DEG = 0.5;
/** Lie-mode hold inside ±0.5° before freeze */
const LIE_AUTO_FREEZE_HOLD_MS = 500;
/** EMA on raw gravity axes (lower = smoother, slower) */
const GRAVITY_FILTER_ALPHA = 0.08;
/** EMA on derived level angles */
const LEVEL_ANGLE_ALPHA = 0.12;
/** Treat |angle| below this as 0° (sensor noise floor) */
const LEVEL_DEADBAND_DEG = 0.18;
/** Ignore single-frame angle jumps larger than this */
const ORIENT_JUMP_REJECT_DEG = 12;
/** Don't refresh level HUD more often than this */
const LEVEL_UI_MIN_MS = 50;
const ROLL_FILTER_ALPHA = 0.12;
const PITCH_EMA_ALPHA = 0.25;
const APPARENT_HISTORY_MAX = 9;
const SHAFT_DEFAULT_ANGLE = 70; // typical putter lie
const DETECT_INTERVAL_MS = 320;
const DETECT_SMOOTH = 0.5;
const DETECT_MIN_SCORE = 16;
/** Use middle portion of shaft for lie angle (exclude grip/head ends) */
const MEASURE_T0 = 0.28;
const MEASURE_T1 = 0.72;
/**
 * Putter-on-floor photos are almost never truly horizontal.
 * Sensor pitch is often under-reported; enforce a minimum look-down so
 * foreshortening correction matches real use (e.g. screen 63° → ~69°).
 */
const MIN_FLOOR_LOOKDOWN_DEG = 40;
/** Frozen-frame detect resolution (px width) — higher = sharper edges */
const FREEZE_DETECT_MAX_W = 640;
/** Official golf ball diameter (Rules of Golf) */
const DEFAULT_BALL_DIAM_MM = 42.7;

const els = {
  viewport: document.getElementById("viewport"),
  camera: document.getElementById("camera"),
  freeze: document.getElementById("freeze"),
  overlay: document.getElementById("overlay"),
  permissionGate: document.getElementById("permissionGate"),
  startBtn: document.getElementById("startBtn"),
  freezeBtn: document.getElementById("freezeBtn"),
  resetBtn: document.getElementById("resetBtn"),
  autoBtn: document.getElementById("autoBtn"),
  captureBtn: document.getElementById("captureBtn"),
  lieAngle: document.getElementById("lieAngle"),
  shaftLength: document.getElementById("shaftLength"),
  lengthSub: document.getElementById("lengthSub"),
  ballDiamMm: document.getElementById("ballDiamMm"),
  ballDetectBtn: document.getElementById("ballDetectBtn"),
  ballClearBtn: document.getElementById("ballClearBtn"),
  ballStatus: document.getElementById("ballStatus"),
  detectStatusLength: document.getElementById("detectStatusLength"),
  panelLie: document.getElementById("panelLie"),
  panelLength: document.getElementById("panelLength"),
  howtoLie: document.getElementById("howtoLie"),
  howtoLength: document.getElementById("howtoLength"),
  modeLie: document.getElementById("modeLie"),
  modeLength: document.getElementById("modeLength"),
  deviceTilt: document.getElementById("deviceTilt"),
  levelStatus: document.getElementById("levelStatus"),
  detectStatus: document.getElementById("detectStatus"),
  pitchStatus: document.getElementById("pitchStatus"),
  angleSub: document.getElementById("angleSub"),
  trimMinus: document.getElementById("trimMinus"),
  trimPlus: document.getElementById("trimPlus"),
  trimReset: document.getElementById("trimReset"),
  trimValue: document.getElementById("trimValue"),
  floorCompChk: document.getElementById("floorCompChk"),
  levelBubble: document.getElementById("levelBubble"),
  levelHud: document.getElementById("levelHud"),
  levelLabel: document.getElementById("levelLabel"),
  levelRing: document.getElementById("levelRing"),
  levelProgressBar: document.getElementById("levelProgressBar"),
  levelFlash: document.getElementById("levelFlash"),
  rollMeter: document.getElementById("rollMeter"),
  pitchMeter: document.getElementById("pitchMeter"),
  tiltArrows: document.getElementById("tiltArrows"),
  measureHint: document.getElementById("measureHint"),
  readout: document.querySelector(".readout"),
  downloadLink: document.getElementById("downloadLink"),
};

function t(key, params) {
  return window.LieI18n?.t(key, params) ?? key;
}

function refreshI18n() {
  window.LieI18n?.applyStatic?.();
  applyActiveModeUi();
  updateLevelUI(true);
  drawOverlay();
}

const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * 34; // r=34 in SVG
const ARROW_THRESHOLD_DEG = 1.2;

/** Per-mode measurement session (lie ↔ length fully isolated) */
const MODE_SESSION_KEYS = new Set([
  "frozen",
  "frozenPose",
  "freezeCanvas",
  "level",
  "wasLevel",
  "wasFreezeReady",
  "freezeHoldSince",
  "levelRollSm",
  "levelPitchSm",
  "accelLevelRoll",
  "accelLevelPitch",
  "shaft",
  "ball",
  "ballSeed",
  "edgeAngles",
  "apparentHistory",
  "edgeWeights",
  "autoDetect",
  "detectOk",
  "detectI18n",
  "detectStatusKind",
  "missStreak",
  "lastDetectAt",
  "pitchCorrection",
  "angleTrim",
  "drag",
]);

function defaultShaftSeg(angleDeg = SHAFT_DEFAULT_ANGLE) {
  const rad = ((90 - angleDeg) * Math.PI) / 180;
  const cx = 0.5;
  const cy = 0.55;
  const len = 0.36;
  return {
    x1: cx - Math.sin(rad) * len,
    y1: cy - Math.cos(rad) * len,
    x2: cx + Math.sin(rad) * len,
    y2: cy + Math.cos(rad) * len,
    left: null,
    right: null,
  };
}

function createModeSession(kind) {
  return {
    kind,
    frozen: false,
    frozenPose: null,
    freezeCanvas: null,
    level: false,
    wasLevel: false,
    wasFreezeReady: false,
    freezeHoldSince: 0,
    levelRollSm: null,
    levelPitchSm: null,
    accelLevelRoll: null,
    accelLevelPitch: null,
    shaft: defaultShaftSeg(),
    ball: null,
    ballSeed: null,
    edgeAngles: { left: null, right: null, avg: SHAFT_DEFAULT_ANGLE },
    apparentHistory: [],
    edgeWeights: { left: 1, right: 1 },
    autoDetect: kind === "lie",
    detectOk: false,
    detectI18n: { key: "status.waiting", params: {} },
    detectStatusKind: null,
    missStreak: 0,
    lastDetectAt: 0,
    pitchCorrection: {
      apparent: 0,
      pitchDown: 0,
      delta: 0,
      corrected: 0,
      trim: 0,
      final: 0,
    },
    angleTrim: 0,
    drag: null,
    /** Lie: yaw zero (DeviceOrientation alpha) for relative heading */
    yawRef: null,
  };
}

const modeSessions = {
  lie: createModeSession("lie"),
  length: createModeSession("length"),
};

const sharedState = {
  measureMode: "lie", // "lie" | "length"
  stream: null,
  ready: false,
  beta: 0,
  gamma: 0,
  alpha: null,
  yawHeading: null,
  gammaFiltered: null,
  betaFiltered: null,
  alphaFiltered: null,
  gAx: null,
  gAy: null,
  gAz: null,
  levelUiAt: 0,
  pitchEma: null,
  accelPitchDown: null,
  ballDiamMm: DEFAULT_BALL_DIAM_MM,
  floorLookdownComp: true,
  raf: 0,
  detectBusy: false,
  detectTimer: null,
};

/** state.X reads/writes the active mode session for measurement fields */
const state = new Proxy(sharedState, {
  get(target, prop, receiver) {
    if (prop === "sessions") return modeSessions;
    if (typeof prop === "string" && MODE_SESSION_KEYS.has(prop)) {
      return modeSessions[target.measureMode][prop];
    }
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    if (typeof prop === "string" && MODE_SESSION_KEYS.has(prop)) {
      modeSessions[target.measureMode][prop] = value;
      return true;
    }
    return Reflect.set(target, prop, value, receiver);
  },
  has(target, prop) {
    return (
      (typeof prop === "string" && MODE_SESSION_KEYS.has(prop)) ||
      prop in target
    );
  },
});

function activeSession() {
  return modeSessions[state.measureMode];
}

function stashActiveFreeze() {
  const s = activeSession();
  if (!s.frozen) {
    s.freezeCanvas = null;
    return;
  }
  const src = els.freeze;
  if (!src?.width) return;
  const c = s.freezeCanvas || document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  s.freezeCanvas = c;
}

function applyActiveModeUi() {
  const s = activeSession();
  const lie = isLieMode();

  els.viewport?.classList.toggle("is-mode-lie", lie);
  els.viewport?.classList.toggle("is-mode-length", !lie);
  els.levelHud?.classList.remove("is-lie-compact");

  const rollSpan = els.levelHud?.querySelector(".level-meter:not(.is-pitch) span");
  const pitchSpan = els.levelHud?.querySelector(".level-meter.is-pitch span");
  if (rollSpan) rollSpan.textContent = lie ? t("meter.roll") : t("meter.lr");
  if (pitchSpan) pitchSpan.textContent = lie ? t("meter.pitch") : t("meter.ud");

  if (s.frozen && s.freezeCanvas) {
    els.freeze.width = s.freezeCanvas.width;
    els.freeze.height = s.freezeCanvas.height;
    els.freeze.getContext("2d").drawImage(s.freezeCanvas, 0, 0);
    els.viewport.classList.add("is-frozen");
    els.levelHud?.classList.add("is-hidden");
    if (els.freezeBtn) els.freezeBtn.textContent = t("ctrl.retake");
  } else {
    els.viewport.classList.remove("is-frozen");
    els.levelHud?.classList.remove("is-hidden");
    if (els.freezeBtn) els.freezeBtn.textContent = t("ctrl.freeze");
  }

  if (lie) {
    els.viewport.classList.toggle("is-adjusting", s.frozen && !s.autoDetect);
    if (els.autoBtn) {
      els.autoBtn.textContent = s.autoDetect ? t("ctrl.autoOn") : t("ctrl.autoOff");
      els.autoBtn.classList.toggle("is-on", s.autoDetect);
    }
    if (!s.frozen) {
      els.measureHint.classList.remove("is-detecting", "is-locked", "is-miss");
      els.measureHint.textContent = s.autoDetect
        ? t("measureHint.shaftDetecting")
        : t("measureHint.manualDrag");
    }
  } else {
    if (els.autoBtn) {
      els.autoBtn.textContent = t("ball.autoDetect");
      els.autoBtn.classList.remove("is-on");
    }
    if (s.frozen) {
      els.viewport.classList.add("is-adjusting");
      els.measureHint.classList.remove("is-detecting", "is-miss");
      els.measureHint.classList.add("is-locked");
      els.measureHint.textContent = t("measureHint.lengthFrozen");
    } else {
      els.viewport.classList.remove("is-adjusting");
      els.measureHint.classList.remove("is-detecting", "is-locked", "is-miss");
      els.measureHint.textContent = t("measureHint.lengthIdle");
    }
    updateBallStatusUI();
    updateLengthReadout();
  }

  const di = s.detectI18n || { key: "status.waiting", params: {} };
  const detectText = t(di.key, di.params);
  if (els.detectStatus) {
    els.detectStatus.textContent = detectText;
    els.detectStatus.classList.toggle("is-ok", s.detectOk);
  }
  if (els.detectStatusLength) {
    els.detectStatusLength.textContent = detectText;
  }
  if (els.trimValue) {
    const t = s.angleTrim || 0;
    els.trimValue.textContent = `${t > 0 ? "+" : ""}${t.toFixed(1)}°`;
  }
}

const ctx = els.overlay.getContext("2d");

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function setShaftFromAngle(angleDeg) {
  const seg = defaultShaftSeg(angleDeg);
  state.shaft.x1 = seg.x1;
  state.shaft.y1 = seg.y1;
  state.shaft.x2 = seg.x2;
  state.shaft.y2 = seg.y2;
  state.shaft.left = null;
  state.shaft.right = null;
  state.edgeAngles = { left: null, right: null, avg: angleDeg };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Ordered endpoints: p1 = top, p2 = bottom */
function orderSeg(seg) {
  let { x1, y1, x2, y2 } = seg;
  if (y1 > y2) {
    [x1, y1, x2, y2] = [x2, y2, x1, y1];
  }
  return { x1, y1, x2, y2 };
}

function getOrderedShaft() {
  return orderSeg(state.shaft);
}

/** Central portion of a segment for angle measurement */
function getMeasureSegmentFrom(seg) {
  const s = orderSeg(seg);
  return {
    x1: lerp(s.x1, s.x2, MEASURE_T0),
    y1: lerp(s.y1, s.y2, MEASURE_T0),
    x2: lerp(s.x1, s.x2, MEASURE_T1),
    y2: lerp(s.y1, s.y2, MEASURE_T1),
  };
}

function getMeasureSegment() {
  return getMeasureSegmentFrom(state.shaft);
}

function angleOfSegment(seg) {
  const { x1, y1, x2, y2 } = getMeasureSegmentFrom(seg);
  const sx = x2 - x1;
  const sy = y2 - y1;
  const shaftDeg = (Math.atan2(sy, sx) * 180) / Math.PI;
  let rel = shaftDeg;
  while (rel > 180) rel -= 360;
  while (rel < -180) rel += 360;
  let lie = Math.abs(rel);
  if (lie > 90) lie = 180 - lie;
  return lie;
}

/**
 * Apparent lie: score-weighted L/R edge average.
 * Temporal median is applied via apparentHistory (updated on each detect).
 */
function getApparentLieAngle() {
  let sample;
  if (state.shaft.left && state.shaft.right) {
    const left = angleOfSegment(state.shaft.left);
    const right = angleOfSegment(state.shaft.right);
    const wL = Math.max(0.2, state.edgeWeights.left || 1);
    const wR = Math.max(0.2, state.edgeWeights.right || 1);
    const avg = (left * wL + right * wR) / (wL + wR);
    state.edgeAngles = { left, right, avg };
    sample = avg;
  } else {
    const single = angleOfSegment(state.shaft);
    state.edgeAngles = { left: null, right: null, avg: single };
    sample = single;
  }

  if (!state.frozen && state.apparentHistory.length >= 3) {
    const med = medianOf(state.apparentHistory);
    if (med != null) return med;
  }
  return sample;
}

function pushApparentSample(v) {
  if (v == null || Number.isNaN(v)) return;
  state.apparentHistory.push(v);
  while (state.apparentHistory.length > APPARENT_HISTORY_MAX) {
    state.apparentHistory.shift();
  }
}

function medianOf(arr) {
  if (!arr || !arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const m = (s.length / 2) | 0;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function getLivePitchDownDeg() {
  const candidates = [];

  // Accelerometer (portrait): upright |y| large; look-down grows |z|
  if (state.accelPitchDown != null && !Number.isNaN(state.accelPitchDown)) {
    candidates.push(state.accelPitchDown);
  }

  const beta = state.beta;
  if (beta != null && !Number.isNaN(beta)) {
    const uprightPitch = Math.abs(Math.abs(beta) - 90);
    const flatPitch = Math.abs(beta);
    if (uprightPitch <= flatPitch + 15) {
      candidates.push(clamp(90 - Math.abs(beta), 0, 75));
    } else {
      candidates.push(clamp(flatPitch, 0, 75));
    }
  }

  if (!candidates.length) return state.pitchEma || 0;
  // Prefer accelerometer when present; blend with orientation estimate
  let raw;
  if (candidates.length === 1) {
    raw = candidates[0];
  } else {
    // Soft blend — accel often more honest looking down; don't always take max
    const accel = state.accelPitchDown;
    const fromBeta = candidates.find((c) => c !== accel) ?? candidates[0];
    if (accel != null) {
      raw = accel * 0.65 + fromBeta * 0.35;
    } else {
      raw = Math.max(...candidates);
    }
  }
  raw = clamp(raw, 0, 75);
  if (state.pitchEma == null) state.pitchEma = raw;
  else state.pitchEma = state.pitchEma * (1 - PITCH_EMA_ALPHA) + raw * PITCH_EMA_ALPHA;
  return state.pitchEma;
}

function getCameraPitchDownDeg() {
  let sensorPitch =
    state.frozen && state.frozenPose
      ? state.frozenPose.pitchDown
      : getLivePitchDownDeg();

  // Floor putter measurement: apply minimum optical depression
  if (state.floorLookdownComp !== false) {
    sensorPitch = Math.max(sensorPitch, MIN_FLOOR_LOOKDOWN_DEG);
  }
  return sensorPitch;
}

/**
 * Correct foreshortening from looking down at the floor:
 *   L_true = atan( tan(L_apparent) / cos(φ)^γ )
 * γ>1 approximates extra perspective foreshortening vs pure orthographic tilt.
 */
function correctLieForCameraPitch(apparentDeg, pitchDownDeg) {
  const phi = (pitchDownDeg * Math.PI) / 180;
  const gamma = 1.12; // slight perspective boost
  const cosEff = Math.pow(Math.cos(phi), gamma);
  if (cosEff < 0.22 || pitchDownDeg < 2) {
    return { lie: apparentDeg, delta: 0 };
  }
  const ap = (clamp(apparentDeg, 1, 89) * Math.PI) / 180;
  const tanAp = Math.tan(ap);
  const trueDeg = clamp((Math.atan(tanAp / cosEff) * 180) / Math.PI, 0, 90);
  return { lie: trueDeg, delta: trueDeg - apparentDeg };
}

function getLieAngle() {
  const apparent = getApparentLieAngle();
  const pitchDown = getCameraPitchDownDeg();
  const { lie, delta } = correctLieForCameraPitch(apparent, pitchDown);
  const trim = state.angleTrim || 0;
  const out = clamp(lie + trim, 0, 90);

  state.pitchCorrection = {
    apparent,
    pitchDown,
    delta,
    corrected: lie,
    trim,
    final: out,
  };
  return out;
}

function setAngleTrim(next) {
  state.angleTrim = clamp(Math.round(next * 10) / 10, -15, 15);
  try {
    localStorage.setItem("lieline-angle-trim", String(state.angleTrim));
  } catch {
    /* ignore */
  }
  if (els.trimValue) {
    const t = state.angleTrim;
    els.trimValue.textContent = `${t >= 0 ? "+" : ""}${t.toFixed(1)}°`;
  }
}

function isLieMode() {
  return state.measureMode !== "length";
}

function setMeasureMode(mode) {
  const next = mode === "length" ? "length" : "lie";
  const changed = state.measureMode !== next;

  if (changed && state.ready) {
    if (!activeSession().frozen) {
      activeSession().freezeHoldSince = 0;
      activeSession().wasFreezeReady = false;
    }
    stashActiveFreeze();
  }

  state.measureMode = next;

  els.modeLie?.classList.toggle("is-active", next === "lie");
  els.modeLength?.classList.toggle("is-active", next === "length");
  els.panelLie?.classList.toggle("is-hidden", next !== "lie");
  els.panelLength?.classList.toggle("is-hidden", next !== "length");
  els.howtoLie?.classList.toggle("is-hidden", next !== "lie");
  els.howtoLength?.classList.toggle("is-hidden", next !== "length");

  if (changed) {
    // Keep the other mode's session intact — only reset in-progress drag
    activeSession().drag = null;
    if (next === "lie") recenterLieYaw();
    applyActiveModeUi();
  } else if (next === "length") {
    if (els.autoBtn) {
      els.autoBtn.textContent = "공 자동 인식";
      els.autoBtn.classList.remove("is-on");
      els.autoBtn.disabled = !state.ready;
    }
  }

  if (state.ready) enableControls(true);

  if (changed && state.ready && next === "lie" && state.autoDetect && !state.frozen) {
    state.lastDetectAt = 0;
    runShaftDetect(true);
  }
  if (changed && state.ready && next === "length" && state.frozen && !state.ball) {
    queueMicrotask(() => runBallDetect(null));
  }
  if (state.ready) {
    updateLevelUI(true);
    drawOverlay();
  }
}

function getBallDiamMm() {
  const v = Number(els.ballDiamMm?.value);
  if (!Number.isFinite(v) || v < 35 || v > 50) return state.ballDiamMm || DEFAULT_BALL_DIAM_MM;
  state.ballDiamMm = v;
  return v;
}

/** Shaft length from full endpoints using golf-ball diameter as scale */
function getShaftLengthInfo() {
  if (!state.ball || !(state.ball.r > 0)) return null;
  const { width, height } = els.viewport.getBoundingClientRect();
  if (width < 10 || height < 10) return null;
  const s = getOrderedShaft();
  const shaftPx = Math.hypot((s.x2 - s.x1) * width, (s.y2 - s.y1) * height);
  const ballDiamPx = 2 * state.ball.r * Math.min(width, height);
  if (ballDiamPx < 2 || shaftPx < 2) return null;
  const mm = (shaftPx / ballDiamPx) * getBallDiamMm();
  const inches = mm / 25.4;
  const cm = mm / 10;
  return { mm, inches, cm, shaftPx, ballDiamPx };
}

function updateLengthReadout() {
  if (!els.shaftLength) return;
  const info = getShaftLengthInfo();
  if (!info) {
    els.shaftLength.textContent = "—";
    if (els.lengthSub) {
      els.lengthSub.textContent = state.ball
        ? t("length.alignShaft")
        : t("length.ballHint");
    }
    return;
  }
  els.shaftLength.textContent = `${info.inches.toFixed(1)} in / ${info.cm.toFixed(1)} cm`;
  if (els.lengthSub) {
    els.lengthSub.textContent = t("length.refBall", {
      diam: getBallDiamMm().toFixed(2),
      mm: info.mm.toFixed(0),
    });
  }
}

function updateBallStatusUI() {
  if (!els.ballStatus) return;
  if (!state.ball) {
    els.ballStatus.textContent = t("ball.unset");
    els.ballStatus.classList.remove("is-ok");
    els.ballStatus.classList.add("is-warn");
  } else {
    els.ballStatus.textContent = t("ball.set");
    els.ballStatus.classList.add("is-ok");
    els.ballStatus.classList.remove("is-warn");
  }
}

function syncCanvasSize() {
  const rect = els.viewport.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * dpr);
  const h = Math.round(rect.height * dpr);
  if (els.overlay.width !== w || els.overlay.height !== h) {
    els.overlay.width = w;
    els.overlay.height = h;
    els.freeze.width = w;
    els.freeze.height = h;
  }
  return { width: rect.width, height: rect.height, dpr };
}

function drawLengthOverlay(width, height) {
  // Before freeze: light guide only — leveling HUD handles tilt
  if (!state.frozen) {
    ctx.fillStyle = "rgba(243, 247, 244, 0.75)";
    ctx.font = "600 13px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(t("length.guideOverlay"), width / 2, height * 0.12);
    ctx.textAlign = "start";
    updateLengthReadout();
    updateBallStatusUI();
    if (els.detectStatusLength) {
      els.detectStatusLength.textContent = t("status.waitFreeze");
      els.detectStatusLength.classList.remove("is-ok");
    }
    return;
  }

  const full = getOrderedShaft();
  const x1 = full.x1 * width;
  const y1 = full.y1 * height;
  const x2 = full.x2 * width;
  const y2 = full.y2 * height;
  // Manual adjust: keep guides translucent so the photo underneath stays readable
  const adjusting = Boolean(state.drag) || !state.autoDetect;
  const alpha = adjusting ? 0.38 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(232, 213, 163, 0.95)";
  ctx.lineWidth = adjusting ? 2.5 : 4;
  ctx.lineCap = "round";
  if (!adjusting) {
    ctx.shadowColor = "rgba(212, 181, 106, 0.45)";
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();

  for (const [hx, hy, labelKey] of [
    [x1, y1, "overlay.grip"],
    [x2, y2, "overlay.head"],
  ]) {
    const label = t(labelKey);
    ctx.save();
    ctx.globalAlpha = adjusting ? 0.55 : 1;
    ctx.beginPath();
    ctx.fillStyle = "rgba(11, 31, 20, 0.45)";
    ctx.strokeStyle = "rgba(232, 213, 163, 0.9)";
    ctx.lineWidth = 2;
    ctx.arc(hx, hy, adjusting ? 9 : 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Measurement point = circle center
    ctx.beginPath();
    ctx.fillStyle = "rgba(232, 213, 163, 0.95)";
    ctx.arc(hx, hy, adjusting ? 2.2 : 2.6, 0, Math.PI * 2);
    ctx.fill();
    if (!adjusting) {
      ctx.fillStyle = "rgba(232, 213, 163, 0.9)";
      ctx.font = "600 11px Outfit, sans-serif";
      ctx.fillText(label, hx + 14, hy + 4);
    }
    ctx.restore();
  }

  // Seed crosshair before / while targeting ball
  if (state.ballSeed && !state.ball) {
    const sx = state.ballSeed.cx * width;
    const sy = state.ballSeed.cy * height;
    ctx.save();
    ctx.strokeStyle = "rgba(140, 190, 235, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 18, sy);
    ctx.lineTo(sx + 18, sy);
    ctx.moveTo(sx, sy - 18);
    ctx.lineTo(sx, sy + 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (state.ball) {
    const minSide = Math.min(width, height);
    const bx = state.ball.cx * width;
    const by = state.ball.cy * height;
    const br = state.ball.r * minSide;
    ctx.save();
    ctx.globalAlpha = adjusting ? 0.42 : 1;
    ctx.strokeStyle = "rgba(140, 190, 235, 0.95)";
    ctx.fillStyle = adjusting
      ? "rgba(140, 190, 235, 0.05)"
      : "rgba(140, 190, 235, 0.12)";
    ctx.lineWidth = adjusting ? 1.75 : 2.5;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = adjusting ? 0.6 : 1;
    ctx.fillStyle = "#8cbde0";
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + br, by, adjusting ? 7 : 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(11, 31, 20, 0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(140, 190, 235, 0.95)";
    ctx.stroke();
    if (!adjusting) {
      ctx.fillStyle = "rgba(180, 210, 240, 0.95)";
      ctx.font = "600 12px Outfit, sans-serif";
      ctx.fillText(t("ball.diameterLabel", { diam: getBallDiamMm().toFixed(2) }), bx - br, by - br - 10);
    }
    ctx.restore();
  } else if (!state.ballSeed) {
    ctx.fillStyle = "rgba(243, 247, 244, 0.65)";
    ctx.font = "500 12px Outfit, sans-serif";
    ctx.fillText(t("ball.overlayHint"), width * 0.08, height * 0.1);
  }

  const info = getShaftLengthInfo();
  if (info && !adjusting) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.fillStyle = "rgba(232, 213, 163, 0.95)";
    ctx.font = "700 16px Fraunces, serif";
    ctx.textAlign = "center";
    ctx.fillText(`${info.inches.toFixed(1)} in`, mx, my - 14);
    ctx.font = "600 12px Outfit, sans-serif";
    ctx.fillText(`${info.cm.toFixed(1)} cm`, mx, my + 4);
    ctx.textAlign = "start";
  }

  els.viewport.classList.toggle("is-adjusting", adjusting);

  updateLengthReadout();
  updateBallStatusUI();
  if (els.detectStatusLength) {
    els.detectStatusLength.textContent = t("status.manualAdjust");
    els.detectStatusLength.classList.remove("is-warn");
    els.detectStatusLength.classList.add("is-ok");
  }
}

function drawOverlay() {
  const { width, height, dpr } = syncCanvasSize();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!state.ready) return;

  if (!isLieMode()) {
    drawLengthOverlay(width, height);
    return;
  }

  const adjustingLie = Boolean(state.drag);
  els.viewport.classList.toggle("is-adjusting", adjustingLie);
  ctx.save();
  if (adjustingLie) ctx.globalAlpha = 0.4;

  // Roll 수평선 (wings level) — independent from Yaw bubble/meter
  const lieRoll = getLieRollDeg();
  const rollRad = (lieRoll * Math.PI) / 180;
  const horizonY = height * 0.42;
  const horizonLen = width * 0.42;
  const hx = Math.cos(rollRad) * horizonLen;
  const hy = Math.sin(rollRad) * horizonLen;
  const rollOk = Math.abs(lieRoll) <= LIE_AUTO_FREEZE_ROLL_DEG;

  ctx.save();
  ctx.translate(width / 2, horizonY);
  ctx.strokeStyle = rollOk
    ? "rgba(109, 203, 141, 0.85)"
    : "rgba(226, 109, 90, 0.75)";
  ctx.lineWidth = rollOk ? 2.5 : 2;
  ctx.setLineDash(rollOk ? [] : [5, 5]);
  ctx.beginPath();
  ctx.moveTo(-hx, -hy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = rollOk
    ? "rgba(109, 203, 141, 0.9)"
    : "rgba(255, 180, 170, 0.9)";
  ctx.font = "600 11px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(rollOk ? t("overlay.rollOk") : t("overlay.roll"), 0, -12);
  ctx.textAlign = "start";
  ctx.restore();

  const full = getOrderedShaft();
  const x1 = full.x1 * width;
  const y1 = full.y1 * height;
  const x2 = full.x2 * width;
  const y2 = full.y2 * height;
  const lie = getLieAngle();
  const groundY = clamp(Math.max(y1, y2), height * 0.55, height * 0.9);

  const dual = state.shaft.left && state.shaft.right;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Sole / floor reference = screen horizontal
  const gdx = width * 0.44;
  ctx.save();
  ctx.strokeStyle = "rgba(243, 247, 244, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(width / 2 - gdx, groundY);
  ctx.lineTo(width / 2 + gdx, groundY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(243, 247, 244, 0.7)";
  ctx.font = "500 11px Outfit, sans-serif";
  ctx.fillText(t("overlay.ground"), width * 0.06, groundY - 8);
  ctx.restore();

  // Soft center guide
  ctx.save();
  ctx.strokeStyle = "rgba(212, 181, 106, 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, height * 0.08);
  ctx.lineTo(width / 2, height * 0.92);
  ctx.stroke();
  ctx.restore();

  // Dual side edges — full length (angle still uses mid portion in math)
  if (dual) {
    for (const [edge, color] of [
      [state.shaft.left, "rgba(140, 190, 235, 0.85)"],
      [state.shaft.right, "rgba(212, 181, 106, 0.9)"],
    ]) {
      const fullE = orderSeg(edge);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(fullE.x1 * width, fullE.y1 * height);
      ctx.lineTo(fullE.x2 * width, fullE.y2 * height);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Full centerline (grip → head)
  ctx.save();
  ctx.strokeStyle = dual ? "rgba(232, 213, 163, 0.55)" : "#e8d5a3";
  ctx.lineWidth = dual ? 2.5 : 4;
  ctx.lineCap = "round";
  if (!dual) {
    ctx.shadowColor = "rgba(212, 181, 106, 0.55)";
    ctx.shadowBlur = 10;
  }
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();

  // Angle wedge vs screen horizontal (at shaft mid)
  const radius = 44;
  const hRad = 0;
  const topIsRight = Math.cos(Math.atan2(y1 - y2, x1 - x2) - hRad) >= 0;
  const arcStart = hRad + (topIsRight ? 0 : Math.PI);
  const arcEnd = Math.atan2(y1 - y2, x1 - x2);
  const ccw = topIsRight;

  ctx.save();
  ctx.strokeStyle = "rgba(212, 181, 106, 0.95)";
  ctx.fillStyle = "rgba(212, 181, 106, 0.18)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(midX, midY);
  ctx.arc(midX, midY, radius, arcStart, arcEnd, ccw);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(243, 247, 244, 0.45)";
  ctx.lineWidth = 1;
  ctx.moveTo(midX - Math.cos(hRad) * 36, midY - Math.sin(hRad) * 36);
  ctx.lineTo(midX + Math.cos(hRad) * 36, midY + Math.sin(hRad) * 36);
  ctx.stroke();

  const labelAngle = hRad + (topIsRight
    ? -((lie / 2) * Math.PI) / 180
    : Math.PI + ((lie / 2) * Math.PI) / 180);
  ctx.fillStyle = "#e8d5a3";
  ctx.font = "600 13px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `${lie.toFixed(1)}°`,
    midX + Math.cos(labelAngle) * (radius + 16),
    midY + Math.sin(labelAngle) * (radius + 16)
  );
  ctx.textAlign = "start";
  ctx.restore();

  // Drag handles: transparent ring + center measurement dot
  for (const [hx, hy] of [
    [x1, y1],
    [x2, y2],
  ]) {
    ctx.save();
    ctx.globalAlpha = adjustingLie ? 0.55 : 0.9;
    ctx.beginPath();
    ctx.fillStyle = "rgba(11, 31, 20, 0.2)";
    ctx.strokeStyle = "rgba(232, 213, 163, 0.85)";
    ctx.lineWidth = 2;
    ctx.arc(hx, hy, adjustingLie ? 9 : 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = "rgba(232, 213, 163, 0.95)";
    ctx.arc(hx, hy, adjustingLie ? 2.2 : 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(232, 213, 163, 0.95)";
  ctx.font = "600 12px Outfit, sans-serif";
  const ea = state.edgeAngles;
  let shaftTag;
  if (dual && ea.left != null && ea.right != null) {
    shaftTag = t("overlay.dualEdge", {
      left: ea.left.toFixed(1),
      right: ea.right.toFixed(1),
    });
  } else if (state.detectOk && state.autoDetect) {
    shaftTag = t("overlay.shaftAuto");
  } else {
    shaftTag = t("overlay.shaftManual");
  }
  ctx.fillText(shaftTag, Math.min(x1, x2) + 10, Math.min(y1, y2) - 8);

  ctx.restore(); // end adjustingLie transparency

  els.lieAngle.textContent = lie.toFixed(1);

  const pc = state.pitchCorrection;
  if (els.angleSub && pc) {
    const edgeNote =
      dual && ea.left != null && ea.right != null
        ? t("angleSub.edge", {
            left: ea.left.toFixed(1),
            right: ea.right.toFixed(1),
          })
        : "";
    els.angleSub.textContent =
      edgeNote +
      t("angleSub.detail", {
        apparent: pc.apparent.toFixed(1),
        delta: pc.delta.toFixed(1),
        trim: `${pc.trim >= 0 ? "+" : ""}${pc.trim.toFixed(1)}`,
      });
  }

  if (els.pitchStatus) {
    if (pc && Math.abs(pc.delta) >= 0.2) {
      const floorNote =
        state.floorLookdownComp && pc.pitchDown >= MIN_FLOOR_LOOKDOWN_DEG - 0.1
          ? t("pitch.floorMin", { deg: String(MIN_FLOOR_LOOKDOWN_DEG) })
          : "";
      els.pitchStatus.textContent = t("pitch.corr", {
        pitch: pc.pitchDown.toFixed(0),
        delta: pc.delta.toFixed(1),
        floor: floorNote,
      });
      els.pitchStatus.classList.add("is-ok");
      els.pitchStatus.classList.remove("is-warn");
    } else {
      els.pitchStatus.textContent = "피치 보정 없음";
      els.pitchStatus.classList.remove("is-ok", "is-warn");
    }
  }
}

function vibrateLevelOk() {
  try {
    if (navigator.vibrate) navigator.vibrate([18, 40, 28]);
  } catch {
    /* ignore */
  }
}

function flashLevelComplete() {
  els.levelFlash.classList.remove("is-show");
  // Restart CSS animation
  void els.levelFlash.offsetWidth;
  els.levelFlash.classList.add("is-show");
}

function setArrow(dir, active) {
  const el = els.tiltArrows.querySelector(`[data-dir="${dir}"]`);
  if (el) el.classList.toggle("is-active", active);
}

function recenterLieYaw() {
  const h = state.yawHeading;
  modeSessions.lie.yawRef = h != null && !Number.isNaN(h) ? h : null;
}

/**
 * Tilt-compensated yaw (0–360°). Isolates heading from pitch/roll so
 * rolling the phone does not drag the yaw channel.
 * (W3C orientation-event worked example / common mobile web pattern)
 */
function tiltCompensatedYawDeg(alpha, beta, gamma) {
  if (alpha == null || beta == null || gamma == null) return null;
  if (Number.isNaN(alpha) || Number.isNaN(beta) || Number.isNaN(gamma)) return null;
  const toRad = Math.PI / 180;
  const x = beta * toRad;
  const y = gamma * toRad;
  const z = alpha * toRad;
  const cX = Math.cos(x);
  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);
  const Vx = -cZ * sY - sZ * sX * cY;
  const Vy = -sZ * sY + cZ * sX * cY;
  let heading = Math.atan(Vx / Vy);
  if (Vy < 0) heading += Math.PI;
  else if (Vx < 0) heading += 2 * Math.PI;
  return (heading * 180) / Math.PI;
}

function updateYawHeadingFromOrientation() {
  const h = tiltCompensatedYawDeg(state.alpha, state.beta, state.gamma);
  if (h == null) return;
  state.yawHeading = smoothAngleDeg(
    state.yawHeading,
    h,
    ROLL_FILTER_ALPHA,
    40
  );
}

/** Relative yaw vs yawRef — lie Yaw channel (not Roll) */
function getLieYawOffsetDeg() {
  if (state.yawHeading == null || Number.isNaN(state.yawHeading)) return null;
  if (modeSessions.lie.yawRef == null) {
    modeSessions.lie.yawRef = state.yawHeading;
  }
  return wrapDeltaDeg(state.yawHeading - modeSessions.lie.yawRef);
}

/** Lie Roll — wings level (gravity / gamma). Independent from Yaw. */
function getLieRollDeg() {
  if (state.levelRollSm != null) return state.levelRollSm;
  if (state.gamma != null) return state.gamma;
  return 0;
}

function wrapDeltaDeg(d) {
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function emaScalar(prev, next, alpha) {
  if (next == null || Number.isNaN(next)) return prev;
  if (prev == null || Number.isNaN(prev)) return next;
  return prev * (1 - alpha) + next * alpha;
}

/** Low-pass an angle; hard-hold through sudden flips */
function smoothAngleDeg(prev, next, alpha, jumpReject = ORIENT_JUMP_REJECT_DEG) {
  if (next == null || Number.isNaN(next)) return prev;
  if (prev == null || Number.isNaN(prev)) return next;
  const d = wrapDeltaDeg(next - prev);
  if (Math.abs(d) > jumpReject) return prev;
  return prev + alpha * d;
}

function deadbandDeg(v, band = LEVEL_DEADBAND_DEG) {
  if (v == null || Number.isNaN(v)) return 0;
  return Math.abs(v) <= band ? 0 : v;
}

/**
 * Portrait upright level from filtered gravity (phone held ~90° vertical).
 * Upright & wings-level → roll≈0, pitch≈0.
 * roll = left-right (ax vs ay), pitch = forward-back (az vs ay).
 */
function levelFromGravityUpright(ax, ay, az) {
  if (ax == null || ay == null || az == null) return null;
  const mag = Math.hypot(ax, ay, az);
  if (mag < 5) return null;
  // Require upright: gravity mostly along Y (reject flat / lying)
  if (Math.abs(ay) / mag < 0.7) return null;
  const roll = (Math.atan2(ax, ay) * 180) / Math.PI;
  const pitch = (Math.atan2(az, ay) * 180) / Math.PI;
  return { roll, pitch };
}

/**
 * Flat / top-down level (phone lying, screen up — shaft length pose).
 * Flat & level → roll≈0, pitch≈0.
 */
function levelFromGravityFlat(ax, ay, az) {
  if (ax == null || ay == null || az == null) return null;
  const mag = Math.hypot(ax, ay, az);
  if (mag < 5) return null;
  if (Math.abs(az) / mag < 0.55) return null;
  // Prefer screen-up gravity (az < 0 on iOS); fall back to +az
  const zRef = az <= 0 ? -az : az;
  const roll = (Math.atan2(ax, zRef) * 180) / Math.PI;
  const pitch = (Math.atan2(ay, zRef) * 180) / Math.PI;
  return { roll, pitch };
}

function updateLevelUI(force = false) {
  const now = performance.now();
  if (!force && now - state.levelUiAt < LEVEL_UI_MIN_MS) return;
  state.levelUiAt = now;

  // Absolute axes:
  // - Lie bubble/meters: Roll (wings) + Pitch; Yaw shown on overlay only
  // - Length: flat gravity roll/pitch
  const beta = state.beta;
  const gamma = state.gamma;

  let pitchSign;
  let rollSign;
  let pitchErr;
  let rollErr;
  let lieWingRollErr = 0; // true Roll (wings level)

  if (isLieMode()) {
    const yaw = getLieYawOffsetDeg();
    rollSign = yaw != null ? deadbandDeg(yaw) : 0; // overlay yaw only
    if (state.levelPitchSm != null) {
      pitchSign = deadbandDeg(state.levelPitchSm);
    } else {
      pitchSign = deadbandDeg(wrapDeltaDeg(beta - 90));
    }
    rollErr = Math.abs(rollSign); // yaw error
    pitchErr = Math.abs(pitchSign);
    lieWingRollErr = Math.abs(deadbandDeg(getLieRollDeg()));
  } else if (state.levelRollSm != null && state.levelPitchSm != null) {
    rollSign = deadbandDeg(state.levelRollSm);
    pitchSign = deadbandDeg(state.levelPitchSm);
    rollErr = Math.abs(rollSign);
    pitchErr = Math.abs(pitchSign);
  } else {
    // Length Euler fallback: always flat (β≈0)
    pitchSign = deadbandDeg(beta);
    pitchErr = Math.abs(pitchSign);
    rollSign = deadbandDeg(gamma);
    rollErr = Math.abs(rollSign);
  }

  const maxErr = Math.max(pitchErr, rollErr);
  const lie = isLieMode();
  const freezeLim = lie ? LIE_AUTO_FREEZE_ROLL_DEG : AUTO_FREEZE_ROLL_DEG;
  const freezeHoldMs = lie ? LIE_AUTO_FREEZE_HOLD_MS : AUTO_FREEZE_HOLD_MS;

  const nowLevel = lie
    ? Math.max(pitchErr, lieWingRollErr) <= LEVEL_TOLERANCE_DEG
    : maxErr <= LEVEL_TOLERANCE_DEG;
  // Lie: Pitch + Roll (wings level) ±0.5°. Length: roll & pitch ±0.5°.
  const freezeReady = lie
    ? pitchErr <= freezeLim && lieWingRollErr <= freezeLim
    : rollErr <= freezeLim && pitchErr <= freezeLim;
  state.level = nowLevel;

  if (freezeReady && state.ready && !state.frozen) {
    if (!state.freezeHoldSince) state.freezeHoldSince = now;
  } else {
    state.freezeHoldSince = 0;
  }
  const holdMs = state.freezeHoldSince ? now - state.freezeHoldSince : 0;
  const holdDone = freezeReady && holdMs >= freezeHoldMs;
  const becameHoldDone = holdDone && !state.wasFreezeReady;

  // Lie: bubble/meters = Roll(wing) + Pitch; freeze when both ±0.5°
  const ringYawOrRoll = rollSign; // lie: yaw on bubble
  const ringPitch = pitchSign;
  const meterRange = isLieMode()
    ? LEVEL_METER_RANGE_LIE_DEG
    : LEVEL_METER_RANGE_LENGTH_DEG;
  const bubbleRange = isLieMode()
    ? LEVEL_METER_RANGE_LIE_DEG
    : LEVEL_UI_RANGE_DEG;
  const wingRollSign = lie ? deadbandDeg(getLieRollDeg()) : rollSign;
  const tRollRing = clamp(
    (lie ? wingRollSign : ringYawOrRoll) / bubbleRange,
    -1,
    1
  );
  const tPitchRing = clamp(ringPitch / bubbleRange, -1, 1);
  const tRollMeter = clamp(
    (lie ? wingRollSign : ringYawOrRoll) / meterRange,
    -1,
    1
  );
  const tPitchMeter = clamp(ringPitch / meterRange, -1, 1);
  const bx = tRollRing * 26;
  const by = tPitchRing * 26;
  els.levelBubble.style.transform = `translate(calc(-50% + ${bx}px), calc(-50% + ${by}px))`;

  // Progress / green ring: closeness within ±3° (Pitch+Roll for lie)
  const fineErr = lie ? Math.max(pitchErr, lieWingRollErr) : maxErr;
  const closeness = 1 - clamp(fineErr / LEVEL_UI_RANGE_DEG, 0, 1);
  const offset = PROGRESS_CIRCUMFERENCE * (1 - closeness);
  els.levelProgressBar.style.strokeDasharray = String(PROGRESS_CIRCUMFERENCE);
  els.levelProgressBar.style.strokeDashoffset = String(offset);

  els.rollMeter.style.left = `${clamp(50 + tRollMeter * 50, 0, 100)}%`;
  els.rollMeter.style.transform = "translateX(-50%)";
  if (lie) {
    els.rollMeter.classList.toggle("is-ok", lieWingRollErr <= freezeLim);
    els.rollMeter.classList.toggle("is-warn", lieWingRollErr > freezeLim);
  } else {
    els.rollMeter.classList.toggle("is-ok", rollErr <= freezeLim);
    els.rollMeter.classList.toggle("is-warn", rollErr > freezeLim);
  }
  if (els.pitchMeter) {
    const yPct = 50 - tPitchMeter * 50;
    els.pitchMeter.style.top = `${clamp(yPct, 0, 100)}%`;
    els.pitchMeter.style.transform = "translateY(-50%)";
    els.pitchMeter.classList.toggle("is-ok", pitchErr <= freezeLim);
    els.pitchMeter.classList.toggle("is-warn", pitchErr > freezeLim);
  }

  if (lie) {
    const wing = getLieRollDeg();
    setArrow("left", !freezeReady && wing > ARROW_THRESHOLD_DEG);
    setArrow("right", !freezeReady && wing < -ARROW_THRESHOLD_DEG);
    setArrow("up", !freezeReady && pitchSign > ARROW_THRESHOLD_DEG);
    setArrow("down", !freezeReady && pitchSign < -ARROW_THRESHOLD_DEG);
  } else {
    setArrow("left", !freezeReady && rollSign > ARROW_THRESHOLD_DEG);
    setArrow("right", !freezeReady && rollSign < -ARROW_THRESHOLD_DEG);
    setArrow("up", !freezeReady && pitchSign > ARROW_THRESHOLD_DEG);
    setArrow("down", !freezeReady && pitchSign < -ARROW_THRESHOLD_DEG);
  }

  const inFineSpot = fineErr <= LEVEL_UI_RANGE_DEG;
  els.levelRing.classList.toggle("is-level", lie ? inFineSpot : freezeReady);
  els.levelRing.classList.toggle("is-tilted", lie ? !inFineSpot : !freezeReady);
  els.viewport.classList.toggle("is-level", freezeReady && state.ready);
  els.viewport.classList.toggle("is-tilted", !freezeReady && state.ready);
  els.levelLabel.classList.toggle("is-level", freezeReady);
  els.levelLabel.classList.toggle("is-tilted", !freezeReady);
  els.readout?.classList.toggle("is-level", freezeReady && state.ready);
  els.readout?.classList.toggle("is-tilted", !freezeReady && state.ready);

  const tiltMag = lie ? Math.max(pitchErr, lieWingRollErr) : Math.hypot(pitchErr, rollErr);
  els.deviceTilt.textContent = `${tiltMag.toFixed(2)}°`;
  els.deviceTilt.classList.toggle("is-ok", freezeReady);
  els.deviceTilt.classList.toggle("is-warn", !freezeReady);

  els.levelStatus.textContent = freezeReady
    ? holdDone
      ? "수평 OK"
      : `유지 ${(holdMs / 1000).toFixed(1)}s`
    : nowLevel
      ? "거의 수평"
      : "기울어짐";
  els.levelStatus.classList.toggle("is-ok", holdDone);
  els.levelStatus.classList.toggle("is-warn", !freezeReady);

  if (holdDone) {
    els.levelLabel.textContent = lie
      ? "✓ Pitch·Roll ±0.5° · 화면 고정"
      : "✓ ±0.5° 수평 · 위에서 고정";
  } else if (freezeReady) {
    const left = Math.max(0, (freezeHoldMs - holdMs) / 1000);
    els.levelLabel.textContent = lie
      ? `Pitch·Roll 유지 중… ${left.toFixed(1)}s`
      : `수평 유지 중… ${left.toFixed(1)}s`;
  } else if (lie) {
    if (pitchErr >= lieWingRollErr) {
      els.levelLabel.textContent =
        pitchSign > 0
          ? "앞으로 기울여 Pitch를 맞추세요"
          : "뒤로 기울여 Pitch를 맞추세요";
    } else {
      const wing = getLieRollDeg();
      els.levelLabel.textContent =
        wing > 0
          ? "왼쪽으로 기울여 Roll 수평을 맞추세요"
          : "오른쪽으로 기울여 Roll 수평을 맞추세요";
    }
  } else if (nowLevel) {
    els.levelLabel.textContent = "조금만 더 — ±0.5°까지 맞추세요";
  } else if (rollErr >= pitchErr) {
    els.levelLabel.textContent =
      rollSign > 0 ? "왼쪽으로 기울여 수평을 맞추세요" : "오른쪽으로 기울여 수평을 맞추세요";
  } else {
    els.levelLabel.textContent =
      pitchSign > 0 ? "앞으로 기울여 Pitch를 맞추세요" : "뒤로 기울여 Pitch를 맞추세요";
  }

  if (becameHoldDone && state.ready && !state.frozen) {
    vibrateLevelOk();
    els.levelFlash.textContent = lie
      ? "Pitch·Roll ±0.5° 유지 · 화면 고정"
      : "±0.5° 유지 · 고정 후 공 인식";
    flashLevelComplete();
    freezeFrame();
  }
  state.wasLevel = nowLevel;
  state.wasFreezeReady = holdDone;
}

function setDetectStatus(label, kind) {
  state.detectLabel = label;
  els.detectStatus.textContent = label;
  els.detectStatus.classList.toggle("is-ok", kind === "ok");
  els.detectStatus.classList.toggle("is-warn", kind === "warn" || kind === "miss");
  if (els.detectStatusLength) {
    els.detectStatusLength.textContent = label;
    els.detectStatusLength.classList.toggle("is-ok", kind === "ok");
    els.detectStatusLength.classList.toggle("is-warn", kind === "warn" || kind === "miss");
  }

  els.measureHint.classList.remove("is-detecting", "is-locked", "is-miss");
  if (kind === "ok") {
    els.measureHint.classList.add("is-locked");
    if (!isLieMode()) {
      const info = getShaftLengthInfo();
      els.measureHint.textContent = info
        ? `길이 ${info.inches.toFixed(1)} in · 끝점을 드래그로 보정`
        : "그립·헤드 끝점을 드래그해 샤프트를 맞추세요";
    } else {
      const ea = state.edgeAngles;
      if (state.shaft.left && state.shaft.right && ea.left != null && ea.right != null) {
        els.measureHint.textContent = `양면 평균 ${getLieAngle().toFixed(1)}° (좌 ${ea.left.toFixed(1)}° · 우 ${ea.right.toFixed(1)}°) · 드래그로 보정`;
      } else {
        els.measureHint.textContent = `자동 인식 ${getLieAngle().toFixed(1)}° · 필요하면 드래그로 보정`;
      }
    }
  } else if (kind === "detecting") {
    els.measureHint.classList.add("is-detecting");
    els.measureHint.textContent = isLieMode()
      ? "샤프트 자동 인식 중…"
      : "그립·헤드 끝점을 드래그해 샤프트를 맞추세요";
  } else if (kind === "miss") {
    els.measureHint.classList.add("is-miss");
    els.measureHint.textContent = "인식 실패 · 배경을 단순하게 하거나 수동 조정";
  } else if (kind === "manual") {
    els.measureHint.textContent = isLieMode()
      ? "수동 조정 중 · 다시 자동하려면 자동 인식"
      : "고정 후 그립·헤드 끝점을 드래그 · 공은 자동 인식";
  } else {
    els.measureHint.textContent = isLieMode()
      ? "샤프트를 화면 중앙에 두고 자동 인식을 켜세요"
      : "좌우 ±0.5°를 유지하면 자동 고정됩니다";
  }
}

function blendEdge(cur, next, a, b) {
  if (!next) return null;
  let { x1, y1, x2, y2 } = next;
  if (y1 > y2) {
    [x1, y1, x2, y2] = [x2, y2, x1, y1];
  }
  if (!cur) {
    return { x1, y1, x2, y2 };
  }
  const c = orderSeg(cur);
  return {
    x1: c.x1 * b + x1 * a,
    y1: c.y1 * b + y1 * a,
    x2: c.x2 * b + x2 * a,
    y2: c.y2 * b + y2 * a,
  };
}

function applyDetectedShaft(seg, smooth) {
  const a = smooth ? DETECT_SMOOTH : 1;
  const b = 1 - a;
  // Keep endpoints ordered: y1 = top (grip), y2 = bottom (head)
  let { x1, y1, x2, y2 } = seg;
  if (y1 > y2) {
    [x1, y1, x2, y2] = [x2, y2, x1, y1];
  }
  state.shaft.x1 = state.shaft.x1 * b + x1 * a;
  state.shaft.y1 = state.shaft.y1 * b + y1 * a;
  state.shaft.x2 = state.shaft.x2 * b + x2 * a;
  state.shaft.y2 = state.shaft.y2 * b + y2 * a;

  if (seg.dualEdge && seg.left && seg.right) {
    state.shaft.left = blendEdge(state.shaft.left, seg.left, a, b);
    state.shaft.right = blendEdge(state.shaft.right, seg.right, a, b);
    state.edgeWeights = {
      left: seg.weightLeft || seg.left.score || 1,
      right: seg.weightRight || seg.right.score || 1,
    };
  } else {
    state.shaft.left = null;
    state.shaft.right = null;
    state.edgeWeights = { left: 1, right: 1 };
  }

  state.detectOk = true;
  state.missStreak = 0;
  let rawApparent;
  if (state.shaft.left && state.shaft.right) {
    const wL = Math.max(0.2, state.edgeWeights.left || 1);
    const wR = Math.max(0.2, state.edgeWeights.right || 1);
    rawApparent =
      (angleOfSegment(state.shaft.left) * wL + angleOfSegment(state.shaft.right) * wR) /
      (wL + wR);
  } else {
    rawApparent = angleOfSegment(state.shaft);
  }
  if (!state.frozen) pushApparentSample(rawApparent);
  const lie = getLieAngle();
  const ea = state.edgeAngles;
  if (seg.dualEdge && ea.left != null && ea.right != null && isLieMode()) {
    setDetectStatus(
      `양면 ${ea.left.toFixed(1)}/${ea.right.toFixed(1)} → ${lie.toFixed(1)}°`,
      "ok"
    );
  } else if (isLieMode()) {
    setDetectStatus(`감지 ${lie.toFixed(1)}°`, "ok");
  } else {
    setDetectStatus("샤프트 인식", "ok");
  }
}

function runShaftDetect(force = false) {
  // Length mode: shaft is always manual — never auto-detect
  if (!isLieMode()) return;
  if (!state.ready || !state.autoDetect || state.drag || state.detectBusy) return;
  const now = performance.now();
  if (!force && now - state.lastDetectAt < DETECT_INTERVAL_MS - 40) return;
  state.lastDetectAt = now;

  const source = state.frozen ? els.freeze : els.camera;
  if (!state.frozen && !els.camera.videoWidth) {
    setDetectStatus("카메라 대기…", "detecting");
    return;
  }
  if (state.frozen && !els.freeze.width) return;

  const rect = els.viewport.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;

  state.detectBusy = true;
  if (!state.detectOk) setDetectStatus("인식 중…", "detecting");

  const useCover = !state.frozen;

  try {
    let frame;
    if (useCover) {
      frame = grabDetectFrame(source, rect.width, rect.height, 320);
    } else {
      const maxW = FREEZE_DETECT_MAX_W;
      const scale = Math.min(1, maxW / els.freeze.width);
      const w = Math.max(96, Math.round(els.freeze.width * scale));
      const h = Math.max(128, Math.round(els.freeze.height * scale));
      const c =
        runShaftDetect._c || (runShaftDetect._c = document.createElement("canvas"));
      c.width = w;
      c.height = h;
      const cctx = c.getContext("2d", { willReadFrequently: true });
      cctx.drawImage(els.freeze, 0, 0, w, h);
      frame = cctx.getImageData(0, 0, w, h);
    }
    if (!frame) {
      setDetectStatus("프레임 없음", "miss");
      return;
    }
    const prior = state.detectOk ? { ...state.shaft } : null;
    const seg = detectShaftFromImageData(frame, prior);
    if (seg && seg.score >= DETECT_MIN_SCORE) {
      applyDetectedShaft(seg, Boolean(state.detectOk));
    } else {
      state.missStreak += 1;
      if (state.missStreak >= 5) {
        state.detectOk = false;
        setDetectStatus(
          seg ? `약함 ${seg.score.toFixed(0)}` : "미감지 · 중앙에 샤프트",
          "miss"
        );
      } else if (!state.detectOk) {
        setDetectStatus("찾는 중…", "detecting");
      }
    }
  } catch (err) {
    console.warn("shaft detect failed", err);
    setDetectStatus("오류", "miss");
  } finally {
    state.detectBusy = false;
  }
}

function startDetectLoop() {
  if (state.detectTimer) clearInterval(state.detectTimer);
  state.detectTimer = setInterval(() => {
    runShaftDetect(false);
  }, DETECT_INTERVAL_MS);
  runShaftDetect(true);
}

function setAutoDetect(on) {
  // Length mode: this button only re-runs golf-ball detection
  if (!isLieMode()) {
    runBallDetect(null);
    return;
  }
  state.autoDetect = on;
  els.autoBtn.classList.toggle("is-on", on);
  els.autoBtn.textContent = on ? "자동 인식 ON" : "자동 인식 OFF";
  els.viewport.classList.toggle("is-adjusting", !on);
  if (on) {
    state.missStreak = 0;
    state.lastDetectAt = 0;
    setDetectStatus("인식 중…", "detecting");
    runShaftDetect(true);
  } else {
    state.detectOk = false;
    setDetectStatus("수동", "manual");
  }
  drawOverlay();
}

function onOrientation(event) {
  if (event.alpha != null) {
    state.alphaFiltered = smoothAngleDeg(
      state.alphaFiltered,
      event.alpha,
      ROLL_FILTER_ALPHA,
      Math.max(ORIENT_JUMP_REJECT_DEG, 35)
    );
    state.alpha = state.alphaFiltered;
  }
  if (event.beta != null) {
    state.betaFiltered = smoothAngleDeg(
      state.betaFiltered,
      event.beta,
      ROLL_FILTER_ALPHA,
      ORIENT_JUMP_REJECT_DEG
    );
    state.beta = state.betaFiltered;
  }
  if (event.gamma != null) {
    state.gammaFiltered = smoothAngleDeg(
      state.gammaFiltered,
      event.gamma,
      ROLL_FILTER_ALPHA,
      ORIENT_JUMP_REJECT_DEG
    );
    state.gamma = state.gammaFiltered;
  }
  if (event.alpha == null && event.beta == null && event.gamma == null) return;
  updateYawHeadingFromOrientation();
  if (activeSession().frozen) return;
  updateLevelUI();
}

function smoothSessionLevel(session, lvl) {
  if (!lvl || session.frozen) return false;
  session.accelLevelRoll = lvl.roll;
  session.accelLevelPitch = lvl.pitch;
  session.levelRollSm = smoothAngleDeg(
    session.levelRollSm,
    lvl.roll,
    LEVEL_ANGLE_ALPHA,
    ORIENT_JUMP_REJECT_DEG
  );
  session.levelPitchSm = smoothAngleDeg(
    session.levelPitchSm,
    lvl.pitch,
    LEVEL_ANGLE_ALPHA,
    ORIENT_JUMP_REJECT_DEG
  );
  return true;
}

function onDeviceMotion(event) {
  const a = event.accelerationIncludingGravity;
  if (!a || a.y == null || a.z == null || a.x == null) return;

  // Shared gravity (both modes)
  state.gAx = emaScalar(state.gAx, a.x, GRAVITY_FILTER_ALPHA);
  state.gAy = emaScalar(state.gAy, a.y, GRAVITY_FILTER_ALPHA);
  state.gAz = emaScalar(state.gAz, a.z, GRAVITY_FILTER_ALPHA);

  const pitchDown =
    (Math.atan2(Math.abs(state.gAz), Math.max(0.05, Math.abs(state.gAy))) * 180) /
    Math.PI;
  state.accelPitchDown = clamp(pitchDown, 0, 80);

  // Warm each mode's level filter independently
  const lieLvl = levelFromGravityUpright(state.gAx, state.gAy, state.gAz);
  const flatLvl = levelFromGravityFlat(state.gAx, state.gAy, state.gAz);
  if (lieLvl) {
    smoothSessionLevel(modeSessions.lie, lieLvl);
  } else if (!modeSessions.lie.frozen) {
    // Not upright enough — don't keep a stale "flat" roll on lie session
    modeSessions.lie.levelRollSm = null;
    modeSessions.lie.levelPitchSm = null;
  }
  if (flatLvl) {
    smoothSessionLevel(modeSessions.length, flatLvl);
  } else if (!modeSessions.length.frozen) {
    modeSessions.length.levelRollSm = null;
    modeSessions.length.levelPitchSm = null;
  }

  if (activeSession().frozen) return;
  getLivePitchDownDeg();
  updateLevelUI();
}

async function requestMotionPermission() {
  const DOE = window.DeviceOrientationEvent;
  const DME = window.DeviceMotionEvent;
  const bindOrientation = () => {
    window.addEventListener("deviceorientation", onOrientation, true);
    // Prefer earth-referenced heading when the browser provides it
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
  };
  try {
    if (DOE && typeof DOE.requestPermission === "function") {
      const result = await DOE.requestPermission();
      if (result !== "granted") {
        console.warn("Device orientation permission not granted");
      } else {
        bindOrientation();
      }
    } else {
      bindOrientation();
    }

    if (DME && typeof DME.requestPermission === "function") {
      try {
        const m = await DME.requestPermission();
        if (m === "granted") {
          window.addEventListener("devicemotion", onDeviceMotion, true);
        }
      } catch {
        window.addEventListener("devicemotion", onDeviceMotion, true);
      }
    } else {
      window.addEventListener("devicemotion", onDeviceMotion, true);
    }
    return true;
  } catch (err) {
    console.warn("Motion permission failed", err);
    bindOrientation();
    window.addEventListener("devicemotion", onDeviceMotion, true);
    return false;
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "이 브라우저는 카메라를 지원하지 않습니다. HTTPS 또는 localhost에서 Safari/Chrome으로 열어 주세요."
    );
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    state.stream = stream;
    els.camera.srcObject = stream;
    await els.camera.play();
  } catch (err) {
    // Fallback: any camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
      state.stream = stream;
      els.camera.srcObject = stream;
      await els.camera.play();
    } catch {
      throw new Error(
        err?.message ||
          "카메라 권한이 필요합니다. 주소창에서 카메라를 허용하고, HTTPS/localhost인지 확인하세요."
      );
    }
  }
}

function enableControls(on) {
  els.freezeBtn.disabled = !on;
  els.resetBtn.disabled = !on;
  els.captureBtn.disabled = !on;
  els.autoBtn.disabled = !on;
  if (els.autoBtn && on) {
    if (!isLieMode()) {
      els.autoBtn.textContent = "공 자동 인식";
      els.autoBtn.classList.remove("is-on");
    } else {
      els.autoBtn.textContent = state.autoDetect ? "자동 인식 ON" : "자동 인식 OFF";
      els.autoBtn.classList.toggle("is-on", state.autoDetect);
    }
  }
  if (els.trimMinus) els.trimMinus.disabled = !on || !isLieMode();
  if (els.trimPlus) els.trimPlus.disabled = !on || !isLieMode();
  if (els.trimReset) els.trimReset.disabled = !on || !isLieMode();
  if (els.ballDiamMm) els.ballDiamMm.disabled = !on || isLieMode();
  if (els.ballDetectBtn) els.ballDetectBtn.disabled = !on || isLieMode();
  if (els.ballClearBtn) els.ballClearBtn.disabled = !on || isLieMode();
}

function pointerPos(e) {
  const rect = els.viewport.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return {
    x: (t.clientX - rect.left) / rect.width,
    y: (t.clientY - rect.top) / rect.height,
  };
}

function hitHandle(nx, ny) {
  const { width, height } = els.viewport.getBoundingClientRect();
  const minSide = Math.min(width, height);
  const threshold = 28 / minSide;

  if (!isLieMode() && state.ball) {
    const brPx = state.ball.r * minSide;
    const distC = Math.hypot(
      (nx - state.ball.cx) * width,
      (ny - state.ball.cy) * height
    );
    if (Math.abs(distC - brPx) <= 22) return "ballR";
    if (distC <= 22) return "ballC";
  }

  const d1 = Math.hypot(nx - state.shaft.x1, ny - state.shaft.y1);
  const d2 = Math.hypot(nx - state.shaft.x2, ny - state.shaft.y2);
  if (d1 <= threshold && d1 <= d2) return "h1";
  if (d2 <= threshold) return "h2";
  const dist = distToSegment(nx, ny, state.shaft);
  if (dist <= threshold * 0.85) return "line";
  return null;
}

function distToSegment(px, py, s) {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - s.x1) * dx + (py - s.y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const qx = s.x1 + t * dx;
  const qy = s.y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function onPointerDown(e) {
  if (!state.ready) return;
  e.preventDefault();
  const p = pointerPos(e);
  let hit = hitHandle(p.x, p.y);

  // Length mode: tap empty space = set seed point, then detect locally there
  if (!hit && !isLieMode()) {
    state.ballSeed = { cx: p.x, cy: p.y };
    els.measureHint.textContent = "지정 지점에서 공 인식 중…";
    els.measureHint.classList.add("is-detecting");
    drawOverlay();
    queueMicrotask(() => runBallDetect(state.ballSeed));
    return;
  }

  if (!hit) return;
  if (state.autoDetect && (hit === "h1" || hit === "h2" || hit === "line")) {
    setAutoDetect(false);
  }
  els.viewport.classList.add("is-adjusting");
  state.drag = {
    target: hit,
    start: p,
    origin: { ...state.shaft },
    ballOrigin: state.ball ? { ...state.ball } : null,
  };
}

function onPointerMove(e) {
  if (!state.drag) return;
  e.preventDefault();
  const p = pointerPos(e);
  const { target, start, origin, ballOrigin } = state.drag;
  const dx = p.x - start.x;
  const dy = p.y - start.y;

  if (target === "ballC" && ballOrigin) {
    state.ball = {
      ...ballOrigin,
      cx: clamp(ballOrigin.cx + dx, 0.05, 0.95),
      cy: clamp(ballOrigin.cy + dy, 0.05, 0.95),
    };
    drawOverlay();
    return;
  }
  if (target === "ballR" && ballOrigin) {
    const { width, height } = els.viewport.getBoundingClientRect();
    const minSide = Math.min(width, height);
    const dist = Math.hypot(
      (p.x - ballOrigin.cx) * width,
      (p.y - ballOrigin.cy) * height
    );
    state.ball = {
      ...ballOrigin,
      r: clamp(dist / minSide, 0.02, 0.22),
    };
    drawOverlay();
    return;
  }

  if (target === "h1") {
    state.shaft.x1 = clamp(origin.x1 + dx, 0.04, 0.96);
    state.shaft.y1 = clamp(origin.y1 + dy, 0.04, 0.96);
  } else if (target === "h2") {
    state.shaft.x2 = clamp(origin.x2 + dx, 0.04, 0.96);
    state.shaft.y2 = clamp(origin.y2 + dy, 0.04, 0.96);
  } else {
    state.shaft.x1 = clamp(origin.x1 + dx, 0.04, 0.96);
    state.shaft.y1 = clamp(origin.y1 + dy, 0.04, 0.96);
    state.shaft.x2 = clamp(origin.x2 + dx, 0.04, 0.96);
    state.shaft.y2 = clamp(origin.y2 + dy, 0.04, 0.96);
  }
  state.shaft.left = null;
  state.shaft.right = null;
  state.edgeAngles = { left: null, right: null, avg: null };
  drawOverlay();
}

function onPointerUp() {
  state.drag = null;
  if (!isLieMode()) {
    els.viewport.classList.toggle("is-adjusting", !state.autoDetect);
    drawOverlay();
  } else {
    els.viewport.classList.remove("is-adjusting");
  }
}

function freezeFrame() {
  syncCanvasSize();
  const fctx = els.freeze.getContext("2d");
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.clearRect(0, 0, els.freeze.width, els.freeze.height);
  drawCover(fctx, els.camera, els.freeze.width, els.freeze.height);
  state.frozenPose = {
    pitchDown: getLivePitchDownDeg(),
    beta: state.beta,
    gamma: state.gamma,
  };
  state.frozen = true;
  state.freezeHoldSince = 0;
  els.viewport.classList.add("is-frozen");
  els.freezeBtn.textContent = "다시 촬영";
  els.levelHud.classList.add("is-hidden");
  stashActiveFreeze();
  if (!isLieMode()) {
    // Length: freeze → auto ball + manual shaft
    state.autoDetect = false;
    state.detectOk = false;
    els.viewport.classList.add("is-adjusting");
    if (els.autoBtn) {
      els.autoBtn.textContent = "공 자동 인식";
      els.autoBtn.classList.remove("is-on");
    }
    els.measureHint.classList.remove("is-detecting", "is-miss");
    els.measureHint.classList.add("is-locked");
    els.measureHint.textContent =
      "고정됨 · 그립·헤드를 드래그하고 공 인식을 확인하세요";
    queueMicrotask(() => runBallDetect(null));
    drawOverlay();
    return;
  }
  // Lie mode: high-quality shaft detect on frozen frame
  if (state.autoDetect) {
    state.lastDetectAt = 0;
    state.detectOk = false;
    state.apparentHistory = [];
    queueMicrotask(() => runShaftDetect(true));
  }
}

function runBallDetect(seedOverride = undefined) {
  if (isLieMode() || !state.ready) return;

  // undefined → prefer seed/ball if any, else full-frame auto
  // null → force full-frame auto search
  // object → search around that point
  let seed = null;
  if (seedOverride === null) {
    seed = null;
  } else if (seedOverride && Number.isFinite(seedOverride.cx)) {
    seed = seedOverride;
  } else if (state.ballSeed) {
    seed = state.ballSeed;
  } else if (state.ball) {
    seed = { cx: state.ball.cx, cy: state.ball.cy };
  }

  if (seed) state.ballSeed = { cx: seed.cx, cy: seed.cy };

  els.measureHint.classList.remove("is-miss", "is-locked");
  els.measureHint.classList.add("is-detecting");
  els.measureHint.textContent = seed
    ? "지정 지점에서 공 인식 중…"
    : "골프공 자동 인식 중…";

  const source = state.frozen ? els.freeze : els.camera;
  const rect = els.viewport.getBoundingClientRect();
  if (rect.width < 10) return;

  let frame;
  if (state.frozen && els.freeze.width) {
    const maxW = 480;
    const scale = Math.min(1, maxW / els.freeze.width);
    const w = Math.max(96, Math.round(els.freeze.width * scale));
    const h = Math.max(128, Math.round(els.freeze.height * scale));
    const c =
      runBallDetect._c || (runBallDetect._c = document.createElement("canvas"));
    c.width = w;
    c.height = h;
    const cctx = c.getContext("2d", { willReadFrequently: true });
    cctx.drawImage(els.freeze, 0, 0, w, h);
    frame = cctx.getImageData(0, 0, w, h);
  } else {
    frame = grabDetectFrame(source, rect.width, rect.height, 360);
  }
  if (!frame || typeof detectGolfBallFromImageData !== "function") {
    if (els.ballStatus) {
      els.ballStatus.textContent = "인식 실패";
      els.ballStatus.classList.add("is-warn");
    }
    return;
  }

  const hit = detectGolfBallFromImageData(frame, state.shaft, seed);
  if (hit) {
    state.ball = { cx: hit.cx, cy: hit.cy, r: hit.r };
    state.ballSeed = { cx: hit.cx, cy: hit.cy };
    updateBallStatusUI();
    els.measureHint.classList.remove("is-detecting", "is-miss");
    els.measureHint.classList.add("is-locked");
    els.measureHint.textContent = seed
      ? "지정 지점 주변에서 공 인식됨 · 드래그로 보정"
      : "골프공 자동 인식됨 · 필요하면 드래그로 보정";
  } else if (els.ballStatus) {
    els.ballStatus.textContent = "미검출 · 공 위를 탭";
    els.ballStatus.classList.add("is-warn");
    els.ballStatus.classList.remove("is-ok");
    els.measureHint.classList.remove("is-detecting");
    els.measureHint.classList.add("is-miss");
    els.measureHint.textContent =
      "자동 인식 실패 · 골프공 위를 탭하거나 「공 인식」";
  }
  drawOverlay();
}

function unfreezeFrame() {
  state.frozen = false;
  state.frozenPose = null;
  state.freezeCanvas = null;
  state.wasFreezeReady = false;
  state.freezeHoldSince = 0;
  state.apparentHistory = [];
  if (isLieMode()) recenterLieYaw();
  els.viewport.classList.remove("is-frozen");
  els.freezeBtn.textContent = "화면 고정";
  els.levelHud.classList.remove("is-hidden");
  if (!isLieMode()) {
    els.viewport.classList.remove("is-adjusting");
    els.measureHint.textContent =
      "핸드폰을 눕혀 ±0.5° 유지 → 자동 고정 · 샤프트 수동 · 공 자동";
  }
}

function resetMeasure() {
  setShaftFromAngle(SHAFT_DEFAULT_ANGLE);
  state.detectOk = false;
  state.missStreak = 0;
  if (!isLieMode()) {
    state.ball = null;
    state.ballSeed = null;
    state.autoDetect = false;
    updateBallStatusUI();
    updateLengthReadout();
  }
  if (state.frozen) unfreezeFrame();
  if (isLieMode() && state.autoDetect) {
    setDetectStatus("인식 중…", "detecting");
    state.lastDetectAt = 0;
    runShaftDetect(true);
  } else if (!isLieMode()) {
    els.measureHint.textContent =
      "좌우 ±0.5° 유지 → 자동 고정 후 샤프트를 수동으로 맞추세요";
    els.viewport.classList.toggle("is-adjusting", state.frozen);
  } else {
    setDetectStatus("수동", "manual");
  }
  drawOverlay();
}

function captureResult() {
  syncCanvasSize();
  const out = document.createElement("canvas");
  out.width = els.overlay.width;
  out.height = els.overlay.height;
  const octx = out.getContext("2d");

  if (state.frozen) {
    octx.drawImage(els.freeze, 0, 0);
  } else {
    drawCover(octx, els.camera, out.width, out.height);
  }
  octx.drawImage(els.overlay, 0, 0);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.fillStyle = "rgba(7, 20, 14, 0.72)";
  octx.fillRect(12, 12, 200, 58);
  octx.fillStyle = "#e8d5a3";
  octx.font = "600 13px Outfit, sans-serif";
  let fileTag;
  if (isLieMode()) {
    octx.fillText("LieLine 라이각", 24, 34);
    octx.font = "700 28px Fraunces, serif";
    octx.fillText(`${getLieAngle().toFixed(1)}°`, 24, 60);
    fileTag = `${getLieAngle().toFixed(1)}deg`;
  } else {
    const info = getShaftLengthInfo();
    octx.fillText("LieLine 샤프트 길이", 24, 34);
    octx.font = "700 22px Fraunces, serif";
    const text = info ? `${info.inches.toFixed(1)} in` : "—";
    octx.fillText(text, 24, 60);
    fileTag = info ? `${info.inches.toFixed(1)}in` : "length";
  }

  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    els.downloadLink.href = url;
    els.downloadLink.download = `lieline-${fileTag}.png`;
    els.downloadLink.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, "image/png");
}

function loop() {
  drawOverlay();
  state.raf = requestAnimationFrame(loop);
}

async function lockPortrait() {
  try {
    const orient = screen.orientation;
    if (orient && typeof orient.lock === "function") {
      await orient.lock("portrait");
    }
  } catch {
    /* iOS Safari / desktop: lock often unavailable — CSS rotate gate covers this */
  }
}

async function start() {
  els.startBtn.disabled = true;
  els.startBtn.textContent = "준비 중…";
  try {
    await lockPortrait();
    await requestMotionPermission();
    await startCamera();
    setShaftFromAngle(SHAFT_DEFAULT_ANGLE);
    state.ready = true;
    // Desktop / no-sensor fallback: treat as level so measuring can proceed
    if (state.beta === 0 && state.gamma === 0 && !window.DeviceOrientationEvent) {
      state.beta = 90;
    }
    els.permissionGate.classList.add("is-hidden");
    els.viewport.classList.add("is-ready");
    enableControls(true);
    try {
      const saved = parseFloat(localStorage.getItem("lieline-angle-trim") || "0");
      setAngleTrim(Number.isFinite(saved) ? saved : 0);
      const fc = localStorage.getItem("lieline-floor-comp");
      state.floorLookdownComp = fc == null ? true : fc === "1";
      if (els.floorCompChk) els.floorCompChk.checked = state.floorLookdownComp;
    } catch {
      setAngleTrim(0);
    }
    setAutoDetect(true);
    setMeasureMode(state.measureMode || "lie");
    recenterLieYaw();
    applyActiveModeUi();
    enableControls(true);
    updateLevelUI(true);
    cancelAnimationFrame(state.raf);
    loop();
    startDetectLoop();
  } catch (err) {
    console.error(err);
    els.startBtn.disabled = false;
    els.startBtn.textContent = "측정 시작";
    alert(
      err?.message ||
        "카메라/센서 권한을 허용해 주세요. HTTPS 또는 localhost에서 실행해야 합니다."
    );
  }
}

els.startBtn.addEventListener("click", start);
els.modeLie?.addEventListener("click", () => setMeasureMode("lie"));
els.modeLength?.addEventListener("click", () => setMeasureMode("length"));
els.freezeBtn.addEventListener("click", () => {
  if (state.frozen) unfreezeFrame();
  else freezeFrame();
});
els.resetBtn.addEventListener("click", resetMeasure);
els.autoBtn.addEventListener("click", () => setAutoDetect(!state.autoDetect));
els.trimMinus?.addEventListener("click", () => setAngleTrim(state.angleTrim - 1));
els.trimPlus?.addEventListener("click", () => setAngleTrim(state.angleTrim + 1));
els.trimReset?.addEventListener("click", () => setAngleTrim(0));
els.ballDetectBtn?.addEventListener("click", () => {
  // Button = full-frame auto search (clear seed bias)
  state.ballSeed = null;
  runBallDetect(null);
});
els.ballClearBtn?.addEventListener("click", () => {
  state.ball = null;
  state.ballSeed = null;
  updateBallStatusUI();
  updateLengthReadout();
  drawOverlay();
});
els.ballDiamMm?.addEventListener("input", () => {
  getBallDiamMm();
  drawOverlay();
});
els.floorCompChk?.addEventListener("change", () => {
  state.floorLookdownComp = Boolean(els.floorCompChk.checked);
  try {
    localStorage.setItem(
      "lieline-floor-comp",
      state.floorLookdownComp ? "1" : "0"
    );
  } catch {
    /* ignore */
  }
});
els.captureBtn.addEventListener("click", captureResult);

els.viewport.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
els.viewport.addEventListener(
  "touchmove",
  (e) => {
    if (state.drag) e.preventDefault();
  },
  { passive: false }
);

window.addEventListener("resize", () => {
  if (state.ready) drawOverlay();
});

// Desktop fallback: mouse-based fake level (centered = level) when no sensors
if (!window.DeviceOrientationEvent) {
  state.beta = 90;
  state.gamma = 0;
}
