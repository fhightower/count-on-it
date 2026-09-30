/* count-on-it — one count against a goal that ramps by one each day.
   Stored on this device only. */

(function () {
  'use strict';

  var KEY = 'count-on-it:v2';
  var RESET_ARM_MS = 3000;
  var DAY_MS = 86400000;

  var el = {
    count:     document.getElementById('count'),
    goalEcho:  document.getElementById('goalEcho'),
    startNum:  document.getElementById('startNum'),
    startDate: document.getElementById('startDate'),
    gauge:     document.getElementById('gauge'),
    status:    document.getElementById('status'),
    reset:     document.getElementById('reset')
  };

  var state = load();
  var resetTimer = null;
  var midnightTimer = null;

  /* ---------- date math ---------- */

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function dayKey(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function todayKey() {
    return dayKey(new Date());
  }

  // YYYY-MM-DD at LOCAL midnight. new Date('2026-08-29') parses as UTC, which
  // lands on the previous day everywhere west of Greenwich.
  function parseDay(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key));
    if (!m) return null;

    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var date = new Date(y, mo - 1, d);

    // Date rolls 2026-02-31 forward into March without complaint.
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
      return null;
    }
    return date;
  }

  // Whole calendar days between two local midnights. Rounding absorbs the 23-
  // and 25-hour days a DST transition puts in the middle of the span.
  function daysBetween(from, to) {
    return Math.round((to - from) / DAY_MS);
  }

  // The goal on the start date is startNumber, and gains one per day after it.
  // A start date in the future holds at startNumber rather than counting down.
  function computeGoal(startDate, startNumber, today) {
    var start = parseDay(startDate);
    if (!start) return startNumber;
    return startNumber + Math.max(0, daysBetween(start, parseDay(dayKey(today))));
  }

  function goalFor(today) {
    return computeGoal(state.startDate, state.startNumber, today);
  }

  /* ---------- persistence ---------- */

  function defaults() {
    var today = todayKey();
    return { startDate: today, startNumber: 10, count: 0, countDate: today };
  }

  // Anything unreadable, half-written, or hand-edited falls back to defaults
  // rather than throwing on load.
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();

      var parsed = JSON.parse(raw);
      return {
        startDate: parseDay(parsed.startDate) ? parsed.startDate : todayKey(),
        startNumber: clampStart(parsed.startNumber),
        count: clampCount(parsed.count),
        countDate: parseDay(parsed.countDate) ? parsed.countDate : todayKey()
      };
    } catch (err) {
      return defaults();
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

  function clampStart(n) {
    n = Math.trunc(Number(n));
    return Number.isFinite(n) && n >= 1 ? n : 10;
  }

  /* ---------- the day boundary ---------- */

  // The count belongs to one day. Crossing midnight clears it; the goal has
  // already moved on by itself.
  function syncDay() {
    var today = todayKey();
    if (state.countDate === today) return false;

    state.countDate = today;
    state.count = 0;
    save();
    return true;
  }

  // A home-screen PWA sits open for days, so midnight has to come to us.
  function armMidnight() {
    clearTimeout(midnightTimer);

    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);

    midnightTimer = setTimeout(tick, next - now);
  }

  function tick() {
    syncDay();
    render(false);
    armMidnight();
  }

  /* ---------- rendering ---------- */

  function render(bumped) {
    var goal = goalFor(new Date());
    var done = state.count >= goal;
    var left = goal - state.count;

    el.count.textContent = state.count;
    el.goalEcho.textContent = goal;
    el.startNum.textContent = state.startNumber;

    // Guard the assignment so we never yank the field out from under an open
    // date picker.
    if (el.startDate.value !== state.startDate) el.startDate.value = state.startDate;

    var pct = Math.min(state.count / goal, 1) * 100;
    el.gauge.style.setProperty('--pct', pct.toFixed(2));

    document.body.classList.toggle('complete', done);

    if (done) {
      el.status.textContent = state.count > goal
        ? '+' + (state.count - goal) + ' OVER'
        : 'GOAL MET';
    } else {
      el.status.textContent = left + ' TO GO';
    }

    document.querySelector('[data-act="count-down"]').disabled = state.count === 0;
    document.querySelector('[data-act="start-down"]').disabled = state.startNumber === 1;

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
    'start-up':   function () { state.startNumber += 1; },
    'start-down': function () { state.startNumber = Math.max(1, state.startNumber - 1); }
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

  // Keyboard access for the tappable count face.
  document.querySelector('.face').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      this.click();
    }
  });

  el.startDate.addEventListener('change', function () {
    // A cleared or partial field leaves the stored date alone.
    if (!parseDay(el.startDate.value)) {
      el.startDate.value = state.startDate;
      return;
    }

    state.startDate = el.startDate.value;
    save();
    render(false);
    disarmReset();
  });

  /* ---------- reset, two-tap ---------- */

  // First tap arms, second tap within the window fires. Resets today's count
  // only; the start date and starting number are left alone.
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

  syncDay();
  render(false);
  armMidnight();

  // Coming back to a backgrounded app is the usual way a new day arrives.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) tick();
  });
  window.addEventListener('focus', tick);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // Offline support is a bonus; the app runs without it.
      });
    });
  }
})();
