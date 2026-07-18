(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const rand = (min, max) => min + Math.random() * (max - min);

  // ---------- Elements ----------
  const screenGame = $('screen-game');
  const screenLetter = $('screen-letter');
  const screenFinale = $('screen-finale');

  const stage = $('stage');
  const envelope = $('envelope');
  const bowZone = $('bow-zone');
  const bowAimGroup = $('bow-aim-group');
  const bowstring = $('bowstring');
  const nockedArrow = $('nocked-arrow');
  const flyingArrow = $('flying-arrow');
  const feedback = $('feedback');
  const powerFill = $('power-fill');
  const powerMarker = $('power-marker');
  const sweetSpotEl = $('sweet-spot');

  const buttonRow = $('button-row');
  const btnYes = $('btn-yes');
  const btnNo = $('btn-no');
  const dodgeCaption = $('dodge-caption');

  const heartBurst = $('heart-burst');
  const btnReplay = $('btn-replay');

  const ARROW_W = 70, ARROW_H = 18;
  const MAX_AIM_DEG = 42; // how far left/right the bow can tilt
  const AIM_RANGE_PX = 130; // horizontal drag distance to reach MAX_AIM_DEG
  const POWER_RANGE_PX = 130; // vertical drag distance to reach 100% draw power
  const BOW_PIVOT = { x: 110, y: 110 }; // grip point in the bow's own SVG coordinates

  const state = {
    charging: false,
    currentPower: 0,
    busy: false,
    sweetStart: 54,
    sweetWidth: 22,
    aimAngleDeg: 0,
    angleTolerance: 9,
    dragOriginX: 0,
    dragOriginY: 0,
  };

  const SHORT_MISS = [
    "So close, draw it back further! 🏹",
    "Not quite enough oomph 💦",
    "Almost — pull a little harder!",
  ];
  const OVER_MISS = [
    "Whoa, too much power! 💨",
    "It flew right past 😅",
    "Easy there, Cupid!",
  ];
  const AIM_LEFT_MISS = [
    "Aim a little more left! 👈",
    "Swing it left a touch",
  ];
  const AIM_RIGHT_MISS = [
    "Aim a little more right! 👉",
    "Swing it right a touch",
  ];
  const GENERAL_MISS = [
    "Adjust your aim and power! 💘",
    "Not quite — try again!",
  ];
  const DODGE_LINES = [
    "Nope, try Yes 😌",
    "Not an option, sorry 💛",
    "Nice try though 👀",
    "That button is shy today",
    "Yes is right there though...",
    "Keep trying, it won't land 😏",
  ];

  // ---------- Ambient background hearts ----------
  function createAmbientHearts() {
    const container = $('ambient-hearts');
    const symbols = ['💗', '💕', '💖', '💛'];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'ambient-heart';
      el.textContent = pick(symbols);
      const size = rand(12, 26);
      el.style.left = rand(0, 100) + 'vw';
      el.style.fontSize = size + 'px';
      el.style.setProperty('--drift', rand(-40, 40) + 'px');
      const duration = rand(10, 18);
      el.style.animationDuration = duration + 's';
      el.style.animationDelay = -rand(0, duration) + 's';
      container.appendChild(el);
    }
  }

  // ---------- Target placement ----------
  function randomizeEnvelopePosition() {
    envelope.style.left = rand(24, 76) + '%';
  }

  // ---------- Screen transitions ----------
  function showScreen(el) {
    [screenGame, screenLetter, screenFinale].forEach((s) => s.classList.remove('active'));
    el.classList.add('active');
  }

  // ---------- Power / sweet spot UI ----------
  function updateSweetSpotUI() {
    sweetSpotEl.style.left = state.sweetStart + '%';
    sweetSpotEl.style.width = state.sweetWidth + '%';
  }

  function updatePowerUI(power) {
    powerFill.style.width = power + '%';
    powerMarker.style.left = power + '%';
  }

  function updateBowPullUI(power) {
    const pull = (power / 100) * 30;
    const midY = 110 + pull;
    bowstring.setAttribute('points', `63,110 110,${midY} 157,110`);
    nockedArrow.setAttribute('transform', `translate(110,${midY})`);
  }

  function updateBowRotation() {
    bowAimGroup.setAttribute('transform', `rotate(${state.aimAngleDeg} ${BOW_PIVOT.x} ${BOW_PIVOT.y})`);
  }

  function resetBow() {
    state.busy = false;
    state.aimAngleDeg = 0;
    state.currentPower = 0;
    nockedArrow.style.opacity = '1';
    powerMarker.style.opacity = '0';
    updatePowerUI(0);
    updateBowPullUI(0);
    updateBowRotation();
  }

  // ---------- Charge, aim & release (driven entirely by drag distance) ----------
  function startCharge(e) {
    if (state.busy) return;
    e.preventDefault();
    state.charging = true;
    state.dragOriginX = e.clientX;
    state.dragOriginY = e.clientY;
    state.aimAngleDeg = 0;
    state.currentPower = 0;
    bowZone.classList.add('charging');
    powerMarker.style.opacity = '1';
    updatePowerUI(0);
    updateBowPullUI(0);
    updateBowRotation();
  }

  function onDragMove(e) {
    if (!state.charging) return;
    const dx = e.clientX - state.dragOriginX;
    const dy = e.clientY - state.dragOriginY;
    state.aimAngleDeg = clamp((dx / AIM_RANGE_PX) * MAX_AIM_DEG, -MAX_AIM_DEG, MAX_AIM_DEG);
    state.currentPower = clamp((dy / POWER_RANGE_PX) * 100, 0, 100);
    updatePowerUI(state.currentPower);
    updateBowPullUI(state.currentPower);
    updateBowRotation();
  }

  function endCharge() {
    if (!state.charging) return;
    state.charging = false;
    bowZone.classList.remove('charging');

    const power = state.currentPower;
    nockedArrow.style.opacity = '0';
    state.busy = true;
    fire(power);
  }

  // ---------- Firing / trajectory ----------
  function showFeedback(text) {
    feedback.textContent = text;
    feedback.classList.remove('show');
    // force reflow so the animation restarts
    void feedback.offsetWidth;
    feedback.classList.add('show');
    clearTimeout(showFeedback._t);
    showFeedback._t = setTimeout(() => feedback.classList.remove('show'), 1300);
  }

  function fire(power) {
    const stageRect = stage.getBoundingClientRect();
    const bowRect = bowZone.getBoundingClientRect();
    const envRect = envelope.getBoundingClientRect();

    const launch = {
      x: bowRect.left + bowRect.width * 0.5 - stageRect.left,
      y: bowRect.top + bowRect.height * 0.5 - stageRect.top,
    };
    const target = {
      x: envRect.left + envRect.width / 2 - stageRect.left,
      y: envRect.top + envRect.height * 0.55 - stageRect.top,
    };

    const aimAngleDeg = state.aimAngleDeg;
    const targetAngleDeg = Math.atan2(target.x - launch.x, launch.y - target.y) * 180 / Math.PI;
    const angleOk = Math.abs(aimAngleDeg - targetAngleDeg) <= state.angleTolerance;
    const powerOk = power >= state.sweetStart && power <= state.sweetStart + state.sweetWidth;
    const hit = angleOk && powerOk;

    let end, control;
    if (hit) {
      end = target;
      control = { x: (launch.x + target.x) / 2, y: Math.min(launch.y, target.y) - 90 };
    } else {
      const targetDistance = Math.hypot(target.x - launch.x, target.y - launch.y);
      const rad = (aimAngleDeg * Math.PI) / 180;
      const dir = { x: Math.sin(rad), y: -Math.cos(rad) };

      let distFactor = 1;
      let droop = 0;
      if (power < state.sweetStart) {
        distFactor = clamp(0.35 + (power / 100) * 0.35, 0.3, 0.75);
        droop = 45;
      } else if (power > state.sweetStart + state.sweetWidth) {
        distFactor = 1.4;
      }

      end = {
        x: launch.x + dir.x * targetDistance * distFactor,
        y: launch.y + dir.y * targetDistance * distFactor + droop,
      };
      control = { x: (launch.x + end.x) / 2, y: Math.min(launch.y, end.y) - (droop ? 50 : 100) };
    }

    animateArrow(launch, control, end, hit, { power, angleOk, powerOk, aimAngleDeg, targetAngleDeg });
  }

  function animateArrow(P0, C, P2, hit, info) {
    const duration = 620;
    const startTime = performance.now();
    flyingArrow.style.opacity = '1';

    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const x = (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * C.x + t * t * P2.x;
      const y = (1 - t) * (1 - t) * P0.y + 2 * (1 - t) * t * C.y + t * t * P2.y;
      const dx = 2 * (1 - t) * (C.x - P0.x) + 2 * t * (P2.x - C.x);
      const dy = 2 * (1 - t) * (C.y - P0.y) + 2 * t * (P2.y - C.y);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      flyingArrow.style.transform = `translate(${x - ARROW_W / 2}px, ${y - ARROW_H / 2}px) rotate(${angle}deg)`;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        onArrowLanded(hit, info);
      }
    }
    requestAnimationFrame(step);
  }

  function missMessage(info) {
    if (!info.angleOk && info.powerOk) {
      return info.aimAngleDeg > info.targetAngleDeg ? pick(AIM_LEFT_MISS) : pick(AIM_RIGHT_MISS);
    }
    if (info.angleOk && !info.powerOk) {
      return info.power < state.sweetStart ? pick(SHORT_MISS) : pick(OVER_MISS);
    }
    return pick(GENERAL_MISS);
  }

  function onArrowLanded(hit, info) {
    flyingArrow.style.opacity = '0';

    if (hit) {
      envelope.classList.add('hit');
      showFeedback('💘 Right on target!');
      setTimeout(() => {
        showScreen(screenLetter);
        preparePlayfulNo();
      }, 750);
      return;
    }

    envelope.classList.add('miss-shake');
    setTimeout(() => envelope.classList.remove('miss-shake'), 400);
    showFeedback(missMessage(info));

    if (!info.angleOk) state.angleTolerance = Math.min(state.angleTolerance + 3, 30);
    if (!info.powerOk) state.sweetWidth = Math.min(state.sweetWidth + 4, 60);
    updateSweetSpotUI();
    resetBow();
  }

  // ---------- Letter screen: dodging "No" button ----------
  function relocateNoButton() {
    const containerRect = buttonRow.getBoundingClientRect();
    const btnRect = btnNo.getBoundingClientRect();
    const yesRect = btnYes.getBoundingClientRect();
    const maxLeft = Math.max(0, containerRect.width - btnRect.width);
    const maxTop = Math.max(0, containerRect.height - btnRect.height);

    // Keep clear of the Yes button (in container-local coords, with a safety margin).
    const margin = 14;
    const yesLeft = yesRect.left - containerRect.left - margin;
    const yesTop = yesRect.top - containerRect.top - margin;
    const yesRight = yesRect.right - containerRect.left + margin;
    const yesBottom = yesRect.bottom - containerRect.top + margin;

    let left, top;
    for (let i = 0; i < 20; i++) {
      left = rand(0, maxLeft);
      top = rand(0, maxTop);
      const overlaps = left < yesRight && left + btnRect.width > yesLeft &&
        top < yesBottom && top + btnRect.height > yesTop;
      if (!overlaps) break;
    }

    btnNo.style.left = left + 'px';
    btnNo.style.top = top + 'px';
    dodgeCaption.textContent = pick(DODGE_LINES);
  }

  function preparePlayfulNo() {
    dodgeCaption.textContent = ' ';
    requestAnimationFrame(() => {
      const containerRect = buttonRow.getBoundingClientRect();
      const yesRect = btnYes.getBoundingClientRect();
      const btnRect = btnNo.getBoundingClientRect();
      const left = clamp(
        yesRect.right - containerRect.left + 16,
        0,
        Math.max(0, containerRect.width - btnRect.width)
      );
      const top = clamp(
        yesRect.top - containerRect.top + (yesRect.height - btnRect.height) / 2,
        0,
        Math.max(0, containerRect.height - btnRect.height)
      );
      btnNo.style.left = left + 'px';
      btnNo.style.top = top + 'px';
    });
  }

  function dodge(e) {
    e.preventDefault();
    relocateNoButton();
  }

  // ---------- Finale ----------
  let burstInterval = null;

  function spawnHearts(n) {
    const symbols = ['💛', '💕', '💖', '✨', '💗'];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'burst-heart';
      el.textContent = pick(symbols);
      const size = rand(14, 34);
      el.style.left = rand(2, 98) + 'vw';
      el.style.fontSize = size + 'px';
      el.style.setProperty('--drift', rand(-70, 70) + 'px');
      el.style.setProperty('--spin', rand(-180, 180) + 'deg');
      const duration = rand(3.2, 5.5);
      el.style.animationDuration = duration + 's';
      el.style.animationDelay = rand(0, 0.6) + 's';
      el.addEventListener('animationend', () => el.remove());
      heartBurst.appendChild(el);
    }
  }

  function goToFinale() {
    showScreen(screenFinale);
    spawnHearts(30);
    burstInterval = setInterval(() => spawnHearts(4), 900);
  }

  function resetGame() {
    if (burstInterval) {
      clearInterval(burstInterval);
      burstInterval = null;
    }
    heartBurst.innerHTML = '';
    envelope.classList.remove('hit', 'miss-shake');
    state.sweetStart = 54;
    state.sweetWidth = 22;
    state.angleTolerance = 9;
    updateSweetSpotUI();
    randomizeEnvelopePosition();
    resetBow();
    showScreen(screenGame);
  }

  // ---------- Wire up ----------
  bowZone.addEventListener('pointerdown', startCharge);
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', endCharge);
  window.addEventListener('pointercancel', endCharge);

  btnNo.addEventListener('pointerdown', dodge);
  btnNo.addEventListener('pointerenter', dodge);
  btnNo.addEventListener('click', dodge);

  btnYes.addEventListener('click', goToFinale);
  btnReplay.addEventListener('click', resetGame);

  createAmbientHearts();
  updateSweetSpotUI();
  randomizeEnvelopePosition();
  resetBow();
  showScreen(screenGame);
})();
