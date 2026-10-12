/*
 * Browser storage for student documentation.
 * Everything lives in this browser's localStorage, so each workstation keeps
 * its own charting. Use Instructor Tools > Export to save a copy.
 */
(function () {
  'use strict';
  const C = window.EHR_CONFIG;
  const P = C.storagePrefix + '.';
  const SECTIONS = ['vitals', 'assess', 'mar', 'io', 'notes', 'orders', 'ack', 'careplan', 'heparin', 'tar'];

  function read(key, fallback) {
    try {
      const v = localStorage.getItem(P + key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(P + key, JSON.stringify(val)); return true; }
    catch (e) { alert('This browser could not save your documentation (storage is full or blocked).'); return false; }
  }
  function remove(key) { try { localStorage.removeItem(P + key); } catch (e) { /* ignore */ } }

  const Store = {
    SECTIONS,

    // Signed-in user
    session: () => read('session', null),
    setSession: s => write('session', s),
    clearSession: () => remove('session'),

    instructorUnlocked() { try { return sessionStorage.getItem(P + 'instructor') === '1'; } catch (e) { return false; } },
    setInstructor(on) { try { on ? sessionStorage.setItem(P + 'instructor', '1') : sessionStorage.removeItem(P + 'instructor'); } catch (e) { /* ignore */ } },

    // Real time (ms) at which a patient's scenario started. Set on first open.
    scenarioStart(pid) {
      let s = read('sim.' + pid, null);
      if (!s) { s = { realStart: Date.now() }; write('sim.' + pid, s); }
      return s.realStart;
    },
    restartScenario(pid) { write('sim.' + pid, { realStart: Date.now() }); },

    // Student documentation for one patient
    doc(pid) {
      const d = read('doc.' + pid, {});
      SECTIONS.forEach(s => { if (!Array.isArray(d[s])) d[s] = []; });
      return d;
    },
    saveDoc(pid, d) { return write('doc.' + pid, d); },

    // time = when the event happened (chart time); recorded = when it was charted
    add(pid, section, data, time, recorded) {
      const s = Store.session() || { name: 'Unknown', cred: '' };
      if (s.observer && !Store.instructorUnlocked()) { if (window.UI) UI.toast('Observer mode is view only — nothing was saved.', 'warn'); return null; }
      const d = Store.doc(pid);
      const entry = {
        id: U.uid(), time, recorded, data, status: 'active',
        user: { name: s.name, cred: s.cred, group: s.group || '' }
      };
      d[section].push(entry);
      Store.saveDoc(pid, d);
      return entry;
    },

    // Legal-record style correction: never delete, mark "entered in error".
    markError(pid, section, id, reason, when) {
      const d = Store.doc(pid);
      const e = d[section].find(x => x.id === id);
      if (!e) return;
      const s = Store.session() || { name: 'Unknown', cred: '' };
      e.status = 'error';
      e.error = { reason, by: s.name + (s.cred ? ', ' + s.cred : ''), at: when };
      Store.saveDoc(pid, d);
    },

    // Instructor-released scenario events: { eventId: realTimeReleased }
    released: pid => read('released.' + pid, {}),
    release(pid, eventId) { const r = Store.released(pid); r[eventId] = Date.now(); write('released.' + pid, r); },
    unrelease(pid, eventId) { const r = Store.released(pid); delete r[eventId]; write('released.' + pid, r); },

    // Patients added through Instructor Tools (JSON import)
    customPatients: () => read('customPatients', []),
    saveCustomPatient(p) {
      const list = Store.customPatients().filter(x => x.id !== p.id);
      list.push(p);
      write('customPatients', list);
    },
    deleteCustomPatient(id) { write('customPatients', Store.customPatients().filter(x => x.id !== id)); },

    resetPatient(pid) { remove('doc.' + pid); remove('released.' + pid); remove('sim.' + pid); },

    exportAll(pids) {
      const out = { app: 'ATU SimEHR', version: 1, exported: new Date().toISOString(), patients: {} };
      pids.forEach(pid => {
        out.patients[pid] = { doc: Store.doc(pid), released: Store.released(pid), sim: read('sim.' + pid, null) };
      });
      out.customPatients = Store.customPatients();
      return out;
    },
    importAll(obj) {
      if (!obj || obj.app !== 'ATU SimEHR' || !obj.patients) throw new Error('This file is not a SimEHR export.');
      Object.entries(obj.patients).forEach(([pid, v]) => {
        if (v.doc) write('doc.' + pid, v.doc);
        if (v.released) write('released.' + pid, v.released);
        if (v.sim) write('sim.' + pid, v.sim);
      });
      if (Array.isArray(obj.customPatients)) write('customPatients', obj.customPatients);
    }
  };

  window.Store = Store;
})();
