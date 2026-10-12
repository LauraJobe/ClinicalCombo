/*
 * ClinicalCombo bridge: the shared record of one simulation run.
 *
 * The launcher (index.html), the EMR, the medication cabinet and the IV pump
 * all load this file. They live on the same site, so they share one
 * localStorage record. Each station writes what the student did (orders
 * acknowledged, meds removed, scans, pump programming) and the launcher reads
 * it to show progress and build the debrief.
 *
 * Run record:
 *   { id, scenarioId, student, mode: 'guided' | 'independent', startedAt,
 *     events: [{ t, station, type, ...data }],
 *     tray:   [{ id, med, label, form, patient, patientName, verdict, msg, ehrCode, t }],
 *     hung:   tray item id hung at the bedside, or null,
 *     finishedAt }
 */
(function () {
  'use strict';
  const KEY = 'clinicalCombo.v1.run';
  const PREFIX = 'clinicalCombo.';

  function read() {
    try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function write(run) {
    try { localStorage.setItem(KEY, JSON.stringify(run)); } catch (e) { /* storage blocked: the run is not saved */ }
    notify(run);
  }

  const listeners = [];
  function notify(run) { listeners.forEach(fn => { try { fn(run); } catch (e) { /* a listener failed */ } }); }
  // Other frames (and the launcher) hear about changes through the storage event.
  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) notify(read()); });

  const uid = () => Math.random().toString(36).slice(2, 10);

  const Bridge = {
    KEY,
    run: read,
    scenario() { const r = read(); return r && window.ComboScenarios ? window.ComboScenarios.byId(r.scenarioId) : null; },

    // Start a new run: clears every station's saved data from the last run.
    start(scenarioId, student, mode) {
      Bridge.clearAll();
      const run = { id: Date.now(), scenarioId, student: student || 'Student Nurse', mode: mode || 'guided', startedAt: Date.now(), events: [], tray: [], hung: null, finishedAt: null };
      write(run);
      return run;
    },
    clearAll() {
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(PREFIX) === 0) keys.push(k); }
        keys.forEach(k => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
    },

    // Read-modify-write so two stations never overwrite each other's entries.
    update(fn) {
      const run = read();
      if (!run) return null;
      fn(run);
      write(run);
      return run;
    },
    log(station, type, data) {
      return Bridge.update(r => { r.events.push(Object.assign({ t: Date.now(), station, type }, data || {})); });
    },
    events: type => ((read() || {}).events || []).filter(e => !type || e.type === type),

    tray: () => (read() || {}).tray || [],
    addToTray(item) {
      const it = Object.assign({ id: uid(), t: Date.now() }, item);
      Bridge.update(r => { r.tray.push(it); });
      return it;
    },
    removeFromTray(match) {
      Bridge.update(r => {
        const i = r.tray.findIndex(match);
        if (i >= 0) { const [gone] = r.tray.splice(i, 1); if (r.hung === gone.id) r.hung = null; }
      });
    },

    on(fn) { listeners.push(fn); },

    // Move the student to another station (when running inside the launcher).
    goStation(name) {
      try { if (window.parent && window.parent !== window && window.parent.ComboShell) { window.parent.ComboShell.show(name); return true; } } catch (e) { /* not inside the launcher */ }
      return false;
    },
    inShell() { try { return !!(window.parent && window.parent !== window && window.parent.ComboShell); } catch (e) { return false; } }
  };

  window.ComboBridge = Bridge;
})();
