(function () {
  const STORAGE_KEY = "lieline-lang";

  const messages = {
    ko: {
      "page.title": "LieLine — 퍼터 라이각 측정",
      "rotate.portrait": "세로 모드로 사용해 주세요",
      "rotate.stand": "기기를 세로로 세워 주세요",
      "tagline": "퍼터 라이각 · 샤프트 길이",
      "mode.lie": "라이각",
      "mode.length": "샤프트 길이",
      "mode.aria": "측정 모드",
      "lang.aria": "언어",
      "lang.ko": "한국어",
      "lang.en": "English",
      "meter.roll": "Roll",
      "meter.pitch": "Pitch",
      "meter.lr": "좌우",
      "meter.ud": "상하",
      "level.default": "기기를 수평으로 맞춰 주세요",
      "level.flash": "Pitch·Roll ±0.5° 유지 · 화면 고정",
      "measureHint.shaftDetecting": "샤프트 자동 인식 중…",
      "measureHint.manualDrag": "수동 측정 · 끝점을 드래그하세요",
      "measureHint.lengthFrozen": "그립·헤드 끝점을 드래그해 샤프트를 맞추세요",
      "measureHint.lengthIdle":
        "핸드폰을 눕혀 ±0.5° 유지 → 자동 고정 · 샤프트 수동 · 공 자동",
      "permission.title": "카메라와 모션 센서로<br />측정을 시작합니다",
      "permission.start": "측정 시작",
      "permission.note": "모드를 선택한 뒤 촬영하세요",
      "permission.preparing": "준비 중…",
      "angle.lie": "라이각",
      "angle.length": "샤프트 길이",
      "trim.label": "미세조정",
      "trim.reset": "리셋",
      "meta.tilt": "기울기",
      "meta.levelStatus": "수평 상태",
      "meta.pitchCorr": "피치 보정",
      "meta.floorComp": "바닥 촬영 보정 (내려다보기 최소 피치)",
      "meta.shaftDetect": "샤프트 인식",
      "meta.shaft": "샤프트",
      "meta.ball": "골프공",
      "lengthSub.idle":
        "±0.5° 유지 → 자동 고정 · 샤프트 수동 · 공 Ø 42.7mm",
      "ball.diameter": "공 지름",
      "ball.autoDetect": "공 자동 인식",
      "ball.clear": "공 지우기",
      "ctrl.freeze": "화면 고정",
      "ctrl.retake": "다시 촬영",
      "ctrl.reset": "초기화",
      "ctrl.autoDetect": "자동 인식",
      "ctrl.autoOn": "자동 인식 ON",
      "ctrl.autoOff": "자동 인식 OFF",
      "ctrl.save": "결과 저장",
      "howto.lie.1": "퍼터를 평평한 바닥에 솔(sole)이 닿게 놓습니다.",
      "howto.lie.2":
        "기기를 세로로 세운 뒤 Pitch·Roll을 각각 ±0.5°로 0.5초 이상 유지하면 화면이 자동 고정됩니다.",
      "howto.lie.3": "자동 인식 후 샤프트 양면 엣지 평균으로 라이각을 측정합니다.",
      "howto.length.1": "퍼터와 골프공을 같은 바닥에 나란히 둡니다.",
      "howto.length.2":
        "핸드폰을 <strong>눕혀</strong> 위에서 비추고, ±0.5° 수평을 약 0.5초 유지하면 자동 고정·공 인식됩니다.",
      "howto.length.3":
        "고정 후 <strong>그립·헤드 끝점을 드래그</strong>해 샤프트 길이를 맞춥니다.",
      "status.waiting": "대기",
      "status.levelOk": "수평 OK",
      "status.almostLevel": "거의 수평",
      "status.tilted": "기울어짐",
      "status.hold": "유지 {sec}s",
      "status.manualAdjust": "수동 조정",
      "status.waitFreeze": "고정 대기",
      "level.doneLie": "✓ Pitch·Roll ±0.5° · 화면 고정",
      "level.doneLength": "✓ ±0.5° 수평 · 위에서 고정",
      "level.holdLie": "Pitch·Roll 유지 중… {sec}s",
      "level.holdLength": "수평 유지 중… {sec}s",
      "level.tiltPitchFwd": "앞으로 기울여 Pitch를 맞추세요",
      "level.tiltPitchBack": "뒤로 기울여 Pitch를 맞추세요",
      "level.tiltRollLeft": "왼쪽으로 기울여 Roll 수평을 맞추세요",
      "level.tiltRollRight": "오른쪽으로 기울여 Roll 수평을 맞추세요",
      "level.almost": "조금만 더 — ±0.5°까지 맞추세요",
      "level.tiltRollFlatLeft": "왼쪽으로 기울여 수평을 맞추세요",
      "level.tiltRollFlatRight": "오른쪽으로 기울여 수평을 맞추세요",
      "level.flashLie": "Pitch·Roll ±0.5° 유지 · 화면 고정",
      "level.flashLength": "±0.5° 유지 · 고정 후 공 인식",
      "detect.shaftOk": "샤프트 인식",
      "detect.cameraWait": "카메라 대기…",
      "detect.searching": "인식 중…",
      "detect.noFrame": "프레임 없음",
      "detect.weak": "약함 {score}",
      "detect.notFound": "미감지 · 중앙에 샤프트",
      "detect.finding": "찾는 중…",
      "detect.error": "오류",
      "detect.manual": "수동",
      "detect.found": "감지 {angle}°",
      "detect.dualOk": "양면 {left}/{right} → {angle}°",
      "detect.dualDetail":
        "양면 평균 {angle}° (좌 {left}° · 우 {right}°) · 드래그로 보정",
      "detect.autoOk": "자동 인식 {angle}° · 필요하면 드래그로 보정",
      "detect.miss": "인식 실패 · 배경을 단순하게 하거나 수동 조정",
      "detect.manualLie": "수동 조정 중 · 다시 자동하려면 자동 인식",
      "detect.manualLength": "고정 후 그립·헤드 끝점을 드래그 · 공은 자동 인식",
      "detect.idleLie": "샤프트를 화면 중앙에 두고 자동 인식을 켜세요",
      "detect.idleLength": "좌우 ±0.5°를 유지하면 자동 고정됩니다",
      "length.alignShaft": "샤프트 끝점을 그립~헤드에 맞춰 주세요",
      "length.ballHint": "공 자동 인식 중… 또는 공 위를 탭하세요",
      "length.refBall": "기준 공 {diam} mm · {mm} mm",
      "length.guideOverlay": "좌우 ±0.5° 유지 시 자동 고정 · 공 Ø 42.7mm",
      "length.lengthOk": "길이 {inches} in · 끝점을 드래그로 보정",
      "ball.unset": "미설정",
      "ball.set": "설정됨 · 드래그 가능",
      "ball.detectFail": "인식 실패",
      "ball.notFoundTap": "미검출 · 공 위를 탭",
      "ball.detectAtSeed": "지정 지점에서 공 인식 중…",
      "ball.detectAuto": "골프공 자동 인식 중…",
      "ball.detectOkSeed": "지정 지점 주변에서 공 인식됨 · 드래그로 보정",
      "ball.detectOkAuto": "골프공 자동 인식됨 · 필요하면 드래그로 보정",
      "ball.detectMiss":
        "자동 인식 실패 · 골프공 위를 탭하거나 「공 인식」",
      "ball.overlayHint": "골프공 자동 인식 중… 실패 시 공 위를 탭하세요",
      "ball.diameterLabel": "공 Ø {diam} mm",
      "freeze.lengthLocked": "고정됨 · 그립·헤드를 드래그하고 공 인식을 확인하세요",
      "reset.lengthHint":
        "좌우 ±0.5° 유지 → 자동 고정 후 샤프트를 수동으로 맞추세요",
      "overlay.grip": "그립",
      "overlay.head": "헤드",
      "overlay.rollOk": "Roll 수평 ✓",
      "overlay.roll": "Roll (수평)",
      "overlay.ground": "바닥 (화면 수평)",
      "overlay.dualEdge": "양면 {left}° / {right}° → 평균",
      "overlay.shaftAuto": "샤프트 · 자동",
      "overlay.shaftManual": "샤프트 (끝점 드래그)",
      "angleSub.edge": "좌 {left}° · 우 {right}° · ",
      "angleSub.detail":
        "화면 {apparent}° · 피치 +{delta}° · 미세조정 {trim}°",
      "pitch.none": "피치 보정 없음",
      "pitch.corr": "피치 {pitch}° → +{delta}°{floor}",
      "pitch.floorMin": " (바닥최소 {deg}°)",
      "capture.lieTitle": "LieLine 라이각",
      "capture.lengthTitle": "LieLine 샤프트 길이",
      "error.scriptLoad": "스크립트 로드 실패. 새로고침 해 주세요.",
      "error.noCamera":
        "이 브라우저는 카메라를 지원하지 않습니다. HTTPS 또는 localhost에서 Safari/Chrome으로 열어 주세요.",
      "error.cameraPerm":
        "카메라 권한이 필요합니다. 주소창에서 카메라를 허용하고, HTTPS/localhost인지 확인하세요.",
      "error.start":
        "카메라/센서 권한을 허용해 주세요. HTTPS 또는 localhost에서 실행해야 합니다.",
    },
    en: {
      "page.title": "LieLine — Putter Lie Angle",
      "rotate.portrait": "Please use portrait mode",
      "rotate.stand": "Hold your device upright",
      "tagline": "Putter lie angle · Shaft length",
      "mode.lie": "Lie angle",
      "mode.length": "Shaft length",
      "mode.aria": "Measurement mode",
      "lang.aria": "Language",
      "lang.ko": "한국어",
      "lang.en": "English",
      "meter.roll": "Roll",
      "meter.pitch": "Pitch",
      "meter.lr": "L–R",
      "meter.ud": "U–D",
      "level.default": "Level the device",
      "level.flash": "Hold Pitch·Roll ±0.5° · freeze screen",
      "measureHint.shaftDetecting": "Detecting shaft…",
      "measureHint.manualDrag": "Manual mode · drag endpoints",
      "measureHint.lengthFrozen": "Drag grip & head endpoints to align the shaft",
      "measureHint.lengthIdle":
        "Lay phone flat, hold ±0.5° → auto-freeze · manual shaft · auto ball",
      "permission.title": "Start measuring with<br />camera & motion sensors",
      "permission.start": "Start",
      "permission.note": "Choose a mode, then capture",
      "permission.preparing": "Preparing…",
      "angle.lie": "Lie angle",
      "angle.length": "Shaft length",
      "trim.label": "Fine tune",
      "trim.reset": "Reset",
      "meta.tilt": "Tilt",
      "meta.levelStatus": "Level status",
      "meta.pitchCorr": "Pitch correction",
      "meta.floorComp": "Floor shot correction (min look-down pitch)",
      "meta.shaftDetect": "Shaft detection",
      "meta.shaft": "Shaft",
      "meta.ball": "Golf ball",
      "lengthSub.idle":
        "Hold ±0.5° → auto-freeze · manual shaft · ball Ø 42.7mm",
      "ball.diameter": "Ball diameter",
      "ball.autoDetect": "Detect ball",
      "ball.clear": "Clear ball",
      "ctrl.freeze": "Freeze screen",
      "ctrl.retake": "Retake",
      "ctrl.reset": "Reset",
      "ctrl.autoDetect": "Auto detect",
      "ctrl.autoOn": "Auto ON",
      "ctrl.autoOff": "Auto OFF",
      "ctrl.save": "Save result",
      "howto.lie.1": "Place the putter on a flat floor with the sole down.",
      "howto.lie.2":
        "Hold the device upright; keep Pitch·Roll within ±0.5° for 0.5s to auto-freeze.",
      "howto.lie.3":
        "After detection, lie angle is measured from averaged dual-edge shaft lines.",
      "howto.length.1": "Place the putter and golf ball side by side on the floor.",
      "howto.length.2":
        "Lay the phone <strong>flat</strong> from above; hold ±0.5° level ~0.5s to auto-freeze and detect the ball.",
      "howto.length.3":
        "After freeze, <strong>drag grip & head endpoints</strong> to match shaft length.",
      "status.waiting": "Waiting",
      "status.levelOk": "Level OK",
      "status.almostLevel": "Almost level",
      "status.tilted": "Tilted",
      "status.hold": "Hold {sec}s",
      "status.manualAdjust": "Manual adjust",
      "status.waitFreeze": "Awaiting freeze",
      "level.doneLie": "✓ Pitch·Roll ±0.5° · screen frozen",
      "level.doneLength": "✓ ±0.5° level · frozen from above",
      "level.holdLie": "Hold Pitch·Roll… {sec}s",
      "level.holdLength": "Hold level… {sec}s",
      "level.tiltPitchFwd": "Tilt forward to match Pitch",
      "level.tiltPitchBack": "Tilt back to match Pitch",
      "level.tiltRollLeft": "Tilt left to level Roll",
      "level.tiltRollRight": "Tilt right to level Roll",
      "level.almost": "Almost there — within ±0.5°",
      "level.tiltRollFlatLeft": "Tilt left to level",
      "level.tiltRollFlatRight": "Tilt right to level",
      "level.flashLie": "Hold Pitch·Roll ±0.5° · freeze",
      "level.flashLength": "Hold ±0.5° · then ball detect",
      "detect.shaftOk": "Shaft detected",
      "detect.cameraWait": "Waiting for camera…",
      "detect.searching": "Detecting…",
      "detect.noFrame": "No frame",
      "detect.weak": "Weak {score}",
      "detect.notFound": "Not found · center the shaft",
      "detect.finding": "Searching…",
      "detect.error": "Error",
      "detect.manual": "Manual",
      "detect.found": "Detected {angle}°",
      "detect.dualOk": "Dual {left}/{right} → {angle}°",
      "detect.dualDetail":
        "Dual avg {angle}° (L {left}° · R {right}°) · drag to adjust",
      "detect.autoOk": "Auto {angle}° · drag if needed",
      "detect.miss": "Detection failed · simplify background or adjust manually",
      "detect.manualLie": "Manual adjust · tap Auto detect to retry",
      "detect.manualLength": "After freeze drag grip/head · ball auto-detects",
      "detect.idleLie": "Center the shaft and enable auto detect",
      "detect.idleLength": "Hold L–R within ±0.5° to auto-freeze",
      "length.alignShaft": "Align shaft endpoints from grip to head",
      "length.ballHint": "Detecting ball… or tap on the ball",
      "length.refBall": "Ref. ball {diam} mm · {mm} mm",
      "length.guideOverlay": "Hold L–R ±0.5° to auto-freeze · ball Ø 42.7mm",
      "length.lengthOk": "Length {inches} in · drag endpoints to adjust",
      "ball.unset": "Not set",
      "ball.set": "Set · draggable",
      "ball.detectFail": "Detection failed",
      "ball.notFoundTap": "Not found · tap the ball",
      "ball.detectAtSeed": "Detecting ball at tap…",
      "ball.detectAuto": "Auto-detecting golf ball…",
      "ball.detectOkSeed": "Ball found near tap · drag to adjust",
      "ball.detectOkAuto": "Ball detected · drag if needed",
      "ball.detectMiss": "Auto failed · tap the ball or use Detect ball",
      "ball.overlayHint": "Auto-detecting ball… tap the ball if it fails",
      "ball.diameterLabel": "Ball Ø {diam} mm",
      "freeze.lengthLocked": "Frozen · drag grip/head and verify ball detection",
      "reset.lengthHint":
        "Hold L–R ±0.5° → auto-freeze, then align shaft manually",
      "overlay.grip": "Grip",
      "overlay.head": "Head",
      "overlay.rollOk": "Roll level ✓",
      "overlay.roll": "Roll (level)",
      "overlay.ground": "Floor (screen level)",
      "overlay.dualEdge": "Dual {left}° / {right}° → avg",
      "overlay.shaftAuto": "Shaft · auto",
      "overlay.shaftManual": "Shaft (drag endpoints)",
      "angleSub.edge": "L {left}° · R {right}° · ",
      "angleSub.detail":
        "Screen {apparent}° · pitch +{delta}° · trim {trim}°",
      "pitch.none": "No pitch correction",
      "pitch.corr": "Pitch {pitch}° → +{delta}°{floor}",
      "pitch.floorMin": " (floor min {deg}°)",
      "capture.lieTitle": "LieLine lie angle",
      "capture.lengthTitle": "LieLine shaft length",
      "error.scriptLoad": "Script load failed. Please refresh.",
      "error.noCamera":
        "Camera not supported. Open in Safari/Chrome over HTTPS or localhost.",
      "error.cameraPerm":
        "Camera permission required. Allow camera and use HTTPS/localhost.",
      "error.start":
        "Allow camera/sensor access. Must run on HTTPS or localhost.",
    },
  };

  let lang = "ko";
  const listeners = new Set();

  function detectLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ko" || saved === "en") return saved;
    } catch {
      /* ignore */
    }
    const nav = (navigator.language || "ko").toLowerCase();
    return nav.startsWith("en") ? "en" : "ko";
  }

  function interpolate(text, params) {
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (_, key) =>
      params[key] != null ? String(params[key]) : `{${key}}`
    );
  }

  function t(key, params) {
    const bucket = messages[lang] || messages.ko;
    const fallback = messages.ko[key];
    const raw = bucket[key] ?? fallback ?? key;
    return interpolate(raw, params);
  }

  function applyStatic(root = document) {
    document.documentElement.lang = lang === "ko" ? "ko" : "en";
    document.title = t("page.title");

    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });

    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = t(key);
    });

    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", t(key));
    });

    root.querySelectorAll(".lang-btn").forEach((btn) => {
      const code = btn.getAttribute("data-lang");
      btn.classList.toggle("is-active", code === lang);
      btn.setAttribute("aria-pressed", code === lang ? "true" : "false");
    });
  }

  function setLang(next) {
    if (next !== "ko" && next !== "en") return lang;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    applyStatic();
    listeners.forEach((fn) => {
      try {
        fn(lang);
      } catch (err) {
        console.warn("i18n listener failed", err);
      }
    });
    return lang;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function init() {
    lang = detectLang();
    applyStatic();
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-lang");
        if (code && code !== lang) setLang(code);
      });
    });
  }

  window.LieI18n = {
    getLang: () => lang,
    setLang,
    t,
    applyStatic,
    onChange,
    init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
