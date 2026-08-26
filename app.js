/* count-on-it — one count, one goal, stored on this device only. */

(function () {
  'use strict';

  var KEY = 'count-on-it:v1';
  var DEFAULTS = { count: 0, goal: 10 };
  var RESET_ARM_MS = 3000;

  var el = {
    count:    document.getElementById('count'),
    goal:     document.getElementById('goal'),
    goalEcho: document.getElementById('goalEcho'),
    gauge:    document.getElementById('gauge'),
    status:   document.getElementById('status'),
    reset:    document.getElementById('reset')
  };

  var state = load();
  var resetTimer = null;

  /* ---------- persistence ---------- */

  // Anything unreadable, half-written, or hand-edited falls back to defaults
  // rather than throwing on load.
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      var parsed = JSON.parse(raw);
      return {
        count: clampCount(parsed.count),
        goal: clampGoal(parsed.goal)
      };
    } catch (err) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (err) {
      // Private browsing or a full quota. The app keeps working in memory.
    }
  }

  function clampCount(n) {
    n = Math.trunc(Number(n));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function clampGoal(n) {
    n = Math.trunc(Number(n));
    return Number.isFinite(n) && n >= 1 ? n : DEFAULTS.goal;
  }

  /* ---------- rendering ---------- */

  function render(bumped) {
    var done = state.count >= state.goal;
    var left = state.goal - state.count;

    el.count.textContent = state.count;
    el.goal.textContent = state.goal;
    el.goalEcho.textContent = state.goal;

    var pct = Math.min(state.count / state.goal, 1) * 100;
    el.gauge.style.setProperty('--pct', pct.toFixed(2));

    document.body.classList.toggle('complete', done);

    if (done) {
      el.status.textContent = state.count > state.goal
        ? '+' + (state.count - state.goal) + ' OVER'
        : 'GOAL MET';
    } else {
      el.status.textContent = left + ' TO GO';
    }

    document.querySelector('[data-act="count-down"]').disabled = state.count === 0;
    document.querySelector('[data-act="goal-down"]').disabled = state.goal === 1;

    if (bumped) {
      el.count.classList.remove('bump');
      void el.count.offsetWidth; // restart the animation
      el.count.classList.add('bump');
    }
  }

  /* ---------- actions ---------- */

  var actions = {
    'count-up':   function () { state.count += 1; },
    'count-down': function () { state.count = Math.max(0, state.count - 1); },
    'goal-up':    function () { state.goal += 1; },
    'goal-down':  function () { state.goal = Math.max(1, state.goal - 1); }
  };

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn || btn.disabled) return;

    var act = actions[btn.dataset.act];
    if (!act) return;

    act();
    save();
    render(btn.dataset.act.indexOf('count') === 0);
    disarmReset();
  });

  /* ---------- reset, two-tap ---------- */

  // First tap arms, second tap within the window fires. Resets the count
  // only; the goal is left alone.
  el.reset.addEventListener('click', function () {
    if (el.reset.classList.contains('armed')) {
      state.count = 0;
      save();
      render(true);
      disarmReset();
      return;
    }
    el.reset.classList.add('armed');
    el.reset.textContent = 'SURE?';
    resetTimer = setTimeout(disarmReset, RESET_ARM_MS);
  });

  function disarmReset() {
    clearTimeout(resetTimer);
    resetTimer = null;
    el.reset.classList.remove('armed');
    el.reset.textContent = 'RESET';
  }

  /* ---------- boot ---------- */

  render(false);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // Offline support is a bonus; the app runs without it.
      });
    });
  }
})();
