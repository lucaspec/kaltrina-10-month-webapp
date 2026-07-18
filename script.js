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
  const CHARGE_PERIOD = 1500; // ms for a full 0 -> 100 -> 0 draw cycle

  const state = {
    charging: false,
    chargeStart: 0,
    rafId: null,
    currentPower: 0,
    busy: false,
    sweetStart: 54,
    sweetWidth: 22,
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

  function triangleWave(t, period) {
    const phase = (t % period) / period;
    return phase < 0.5 ? phase * 2 * 100 : (1 - phase) * 2 * 100;
  }

  function updatePowerUI(power) {
    powerFill.style.width = power + '%';
  }

  function updateBowPullUI(power) {
    const pull = (power / 100) * 24;
    bowstring.setAttribute('points', `52,10 ${52 - pull},110 52,210`);
    nockedArrow.setAttribute('transform', `translate(${52 - pull},110)`);
  }

  function resetBow() {
    state.busy = false;
    nockedArrow.style.opacity = '1';
    powerFill.style.width = '0%';
    powerMarker.style.opacity = '0';
    updateBowPullUI(0);
  }

  // ---------- Charge & release ----------
  function startCharge(e) {
    if (state.busy) return;
    e.preventDefault();
    state.charging = true;
    state.chargeStart = performance.now();
    bowZone.classList.add('charging');
    loopCharge();
  }

  function loopCharge() {
    if (!state.charging) return;
    const elapsed = performance.now() - state.chargeStart;
    state.currentPower = triangleWave(elapsed, CHARGE_PERIOD);
    updatePowerUI(state.currentPower);
    updateBowPullUI(state.currentPower);
    state.rafId = requestAnimationFrame(loopCharge);
  }

  function endCharge() {
    if (!state.charging) return;
    state.charging = false;
    bowZone.classList.remove('charging');
    cancelAnimationFrame(state.rafId);

    const power = state.currentPower;
    powerMarker.style.left = clamp(power, 0, 100) + '%';
    powerMarker.style.opacity = '1';
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
    const hit = power >= state.sweetStart && power <= state.sweetStart + state.sweetWidth;

    const stageRect = stage.getBoundingClientRect();
    const bowRect = bowZone.getBoundingClientRect();
    const envRect = envelope.getBoundingClientRect();

    const launch = {
      x: bowRect.left + bowRect.width / 2 - stageRect.left,
      y: bowRect.top + bowRect.height * 0.42 - stageRect.top,
    };
    const target = {
      x: envRect.left + envRect.width / 2 - stageRect.left,
      y: envRect.top + envRect.height * 0.55 - stageRect.top,
    };

    let end, control;
    if (hit) {
      end = target;
      control = { x: (launch.x + target.x) / 2, y: Math.min(launch.y, target.y) - 90 };
    } else if (power < state.sweetStart) {
      const f = clamp(0.35 + (power / 100) * 0.35, 0.3, 0.75);
      end = {
        x: launch.x + (target.x - launch.x) * f,
        y: launch.y + (target.y - launch.y) * f + 45,
      };
      control = { x: (launch.x + end.x) / 2, y: Math.min(launch.y, end.y) - 50 };
    } else {
      const f = 1.4;
      end = { x: launch.x + (target.x - launch.x) * f, y: target.y - 95 };
      control = { x: (launch.x + target.x) / 2, y: Math.min(launch.y, target.y) - 110 };
    }

    animateArrow(launch, control, end, hit, power);
  }

  function animateArrow(P0, C, P2, hit, power) {
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
        onArrowLanded(hit, power);
      }
    }
    requestAnimationFrame(step);
  }

  function onArrowLanded(hit, power) {
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
    showFeedback(power < state.sweetStart ? pick(SHORT_MISS) : pick(OVER_MISS));

    state.sweetWidth = Math.min(state.sweetWidth + 4, 60);
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
    updateSweetSpotUI();
    resetBow();
    showScreen(screenGame);
  }

  // ---------- Wire up ----------
  bowZone.addEventListener('pointerdown', startCharge);
  window.addEventListener('pointerup', endCharge);
  window.addEventListener('pointercancel', endCharge);

  btnNo.addEventListener('pointerdown', dodge);
  btnNo.addEventListener('pointerenter', dodge);
  btnNo.addEventListener('click', dodge);

  btnYes.addEventListener('click', goToFinale);
  btnReplay.addEventListener('click', resetGame);

  createAmbientHearts();
  updateSweetSpotUI();
  resetBow();
  showScreen(screenGame);
})();
