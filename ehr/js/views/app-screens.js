/* Screens outside a chart: sign-in, census, instructor tools. */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;
  window.Screens = {};

  const allergyText = p => p.nkda || !(p.allergies || []).length ? 'NKDA' : p.allergies.map(a => a.agent).join(', ');

  // Students are locked to the experience chosen at sign-in; only an unlocked
  // instructor may switch experiences or view "all".
  Screens.experience = () => {
    const s = Store.session() || {};
    if (Store.instructorUnlocked()) return s.viewExperience || s.experience || 'all';
    return s.experience && s.experience !== 'all' ? s.experience : '';
  };
  Screens.canSee = p => {
    const exp = Screens.experience();
    return exp === 'all' || (p.experiences || []).includes(exp);
  };
  // Chart mode: faculty (PIN unlocked), observer (view only), or student (documenting).
  Screens.mode = () => Store.instructorUnlocked() ? 'faculty' : ((Store.session() || {}).observer ? 'observer' : 'student');
  Screens.MODE_LABEL = { student: 'Student', observer: 'Observer', faculty: 'Faculty' };

  // Switch modes. Faculty needs the PIN; leaving Observer also needs the PIN so observers can't start charting on their own.
  Screens.setMode = function (to) {
    const from = Screens.mode();
    if (to === from) return;
    const apply = () => {
      const s = Store.session();
      if (to === 'faculty') { Store.setInstructor(true); }
      else { Store.setInstructor(false); if (s) { s.observer = to === 'observer'; delete s.viewExperience; Store.setSession(s); } }
      UI.toast(`Switched to ${Screens.MODE_LABEL[to]} mode${to === 'observer' ? ' — view only' : ''}.`);
      App.render();
    };
    if (to === 'faculty' || from === 'observer') {
      UI.modal({
        title: to === 'faculty' ? 'Switch to Faculty' : 'Leave Observer Mode',
        body: `<p>${to === 'faculty' ? 'Faculty mode shows every experience and the instructor tools.' : 'An instructor must enter the PIN to change an observer to a documenting student.'}</p>
          <label class="field"><span>Instructor PIN</span><input type="password" name="pin" autofocus inputmode="numeric"></label>`,
        buttons: [{ label: 'Cancel' }, { label: 'Switch', cls: 'btn-primary', onClick: api => {
          if (U.formValues(api.el).pin !== String(C.instructorPin)) { UI.formError(api.el.querySelector('.modal-body'), 'Incorrect PIN.'); return false; }
          if (to === 'faculty') { Store.setInstructor(true); UI.toast('Switched to Faculty mode.'); App.render(); }
          else { Store.setInstructor(false); const s = Store.session(); s.observer = false; Store.setSession(s); UI.toast('Switched to Student mode.'); App.render(); }
        } }]
      });
      return;
    }
    apply();
  };

  Screens.experienceLabel = id => id === 'all' ? 'All Experiences' : ((C.experiences.find(x => x.id === id) || {}).label || id);

  /* ---------------- Sign in ---------------- */
  Screens.login = {
    render() {
      return `<div class="login-wrap">
        <form class="login-card" autocomplete="off">
          <div class="login-brand"><div class="logo-mark" aria-hidden="true">✚</div><div><div class="brand-1">${esc(C.hospitalName)}</div><div class="brand-2">${esc(C.systemName)} · Simulation Electronic Health Record</div></div></div>
          <div class="sim-warning">SIMULATION ONLY — Do not enter real patient information.</div>
          <label class="field"><span>Full name</span><input name="name" required autofocus placeholder="First Last"></label>
          <label class="field"><span>Role</span><select name="cred">
            <option value="SN">Student Nurse (SN)</option><option value="RN">Registered Nurse (RN)</option>
            <option value="Instructor">Instructor</option></select></label>
          <label class="field"><span>Simulation experience</span><select name="experience" required>
            <option value="">— Select your sim experience —</option>
            ${C.experiences.map(x => `<option value="${esc(x.id)}">${esc(x.label)}</option>`).join('')}
</select></label>
          <fieldset class="field login-mode"><legend>Sign in as</legend>
            <label class="check"><input type="radio" name="mode" value="student" checked> <span><strong>Documenting nurse</strong> — I am charting in this simulation</span></label>
            <label class="check"><input type="radio" name="mode" value="observer"> <span><strong>Observer (view only)</strong> — I am watching; I can read the chart but not document or acknowledge</span></label>
          </fieldset>
          <label class="field"><span>Clinical group / cohort (optional)</span><input name="group" placeholder="e.g., Level 3 — Group A"></label>
          <button class="btn btn-primary btn-block" type="submit">Sign In</button>
          <p class="muted small">Your name is attached to every entry as your electronic signature.</p>
          <p class="muted small">Version ${U.esc(C.version || '')}</p>
        </form></div>`;
    },
    bind(root) {
      root.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const v = U.formValues(e.target);
        if (!v.name) return;
        if (!v.experience) { UI.formError(e.target, 'Choose your simulation experience.'); return; }
        Store.setSession({ name: v.name, cred: v.cred, group: v.group, experience: v.experience, observer: v.mode === 'observer', signedIn: Date.now() });
        location.hash = '#/census';
        App.render();
      });
    }
  };

  /* ---------------- Status board (census) ---------------- */
  let levelTab = null;
  let selected = null;

  function nextMeds(p, doc) {
    const out = [];
    p.meds.forEach(m => (m.doseTimes || []).forEach(dt => {
      const st = Model.doseStatus(p, doc, m, dt).code;
      if (st === 'due' || st === 'overdue' || st === 'future') out.push({ time: dt.time, text: `${m.name} ${m.dose}`, overdue: st === 'overdue' });
    }));
    return out.sort((x, y) => x.time - y.time).slice(0, 3);
  }
  const lines = (list, empty) => list.length ? list.map(x => `<div class="sb-line"><span class="${x.overdue ? 'sb-late' : ''}">${U.fmtTime(x.time)}</span> ${esc(x.text || x.name)}</div>`).join('') : (empty || '');

  Screens.census = {
    render() {
      const exp = Screens.experience();
      const s = Store.session();
      const pts = Model.allPatients().filter(Screens.canSee);
      const instructor = Store.instructorUnlocked();
      const levels = [1, 2, 3];
      if (levelTab == null) levelTab = pts.some(p => p.level === 3) ? 3 : (pts[0] && pts[0].level) || 3;
      const shown = pts.filter(p => (p.level || 3) === levelTab);
      const now = Date.now();
      const rows = shown.map(base => {
        const p = Model.get(base.id);
        const doc = Store.doc(p.id);
        const unacked = Model.unackedOrders(p, doc);
        const stat = unacked.some(o => /stat/i.test(o.priority || ''));
        const results = Model.unreviewedResults(p, doc);
        const allergy = !(p.nkda || !(p.allergies || []).length);
        const initials = (p.name.first[0] + p.name.last[0]).toUpperCase();
        return `<tr class="census-row ${selected === p.id ? 'sb-selected' : ''}" data-open="${esc(p.id)}" tabindex="0">
          <td class="sb-rm">${esc(p.room && p.room !== '—' ? p.room : p.unit)}</td>
          <td class="sb-pix"><div class="avatar sb-avatar" aria-hidden="true">${esc(initials)}</div></td>
          <td class="sb-name"><a href="#/patient/${esc(p.id)}/summary" class="sb-link"><strong>${esc(p.name.last)},${esc(p.name.first)}</strong></a>
            <div>${esc(p.admitDx)}</div><div class="muted">ADM IN · ${esc(p.age.replace(' years', ''))} ${esc(p.sex)} · DOB ${esc(U.fmtDOB(p.dob))}</div></td>
          <td class="sb-alerts">${allergy ? `<span class="sb-chip sb-red" title="Allergies: ${esc(allergyText(p))}">ALLERGY</span>` : '<span class="sb-chip sb-plain">NKDA</span>'}
            ${p.codeStatus === 'DNR' ? '<span class="sb-chip sb-purple">DNR</span>' : ''}
            ${p.isolation && !/^(none|standard)$/i.test(p.isolation) ? `<span class="sb-chip sb-plain">${esc(p.isolation)}</span>` : ''}</td>
          <td class="${(p.homeMeds || []).length ? 'sb-green' : 'sb-gray'}">${(p.homeMeds || []).length ? 'Confirmed' : 'None'}</td>
          <td class="sb-list">${lines(Views.worklist.due(p, doc).slice(0, 3))}</td>
          <td class="sb-list">${lines(nextMeds(p, doc))}</td>
          <td class="${stat ? 'sb-redcell' : unacked.length ? 'sb-newcell' : ''}" title="${unacked.length ? unacked.length + ' order(s) to acknowledge' : 'No new orders to acknowledge'}">${unacked.length ? `${stat ? 'Stat' : 'New'} (${unacked.length})` : ''}</td>
          <td class="sb-results">${results.map(r => { const crit = (r.results || []).some(x => /\*/.test(Model.labFlag(x))); return `<div class="sb-res ${crit ? 'sb-res-crit' : ''}">${esc(r.panel || r.study)}</div>`; }).join('')}</td>
        </tr>`;
      }).join('');
      const title = `${Screens.experienceLabel(exp)} - ${s.cred}*`;
      return `<div class="sb">
        <div class="sb-titlebar"><span class="sb-e" aria-hidden="true">E</span><h1>PCS Status Board</h1></div>
        <div class="sb-band"><span>Dept: <b>Patient Care</b></span><span>Site: <b>${esc(C.hospitalName)}</b></span><span>Level: <b>${levelTab}</b></span></div>
        <div class="sb-body">
          <div class="sb-main">
            <div class="sb-head"><strong>${esc(title)}</strong><div>${shown.length} patient${shown.length === 1 ? '' : 's'} as of ${U.fmtDT(now)}</div></div>
            <div class="scroll-x">${shown.length ? `<table class="grid census sb-table">
              <thead><tr><th>Rm/ Bed</th><th>Pix</th><th>Name ▾<br>Diagnosis<br>Reg Status</th><th>Alerts</th><th>Home Meds</th><th>Interventions</th><th>Next Meds</th><th>Orders</th><th>New Results</th></tr></thead>
              <tbody>${rows}</tbody></table>` : `<p class="empty sb-empty">No Level ${levelTab} patients have been added for ${esc(Screens.experienceLabel(exp))} yet.</p>`}</div>
            <div class="sb-foot">
              <button class="btn btn-sm" data-action="refresh">Refresh</button>
              <button class="btn btn-sm" data-action="open" ${selected && shown.some(p => p.id === selected) ? '' : 'disabled'}>Open Chart</button>
              <span class="muted small">Click a patient to select, double-click (or Open Chart) to open. Always verify two identifiers.${instructor ? '' : ' To change your sim experience, Suspend and sign in again.'}</span>
            </div>
          </div>
          <nav class="sb-side" aria-label="Status board menu">
            <div class="sb-side-h">Lists</div>
            ${levels.map(l => `<a href="#" class="${l === levelTab ? 'on' : ''}" data-level="${l}">Level ${l} Patients</a>`).join('')}
            <div class="sb-sep"></div>
            <a href="#" class="on">Status Board</a>
            <a href="#" data-action="open">Open Chart</a>
            ${instructor ? `<div class="sb-sep"></div><label class="sb-side-h">Instructor view
              <select data-action="experience">${C.experiences.map(x => `<option value="${esc(x.id)}" ${x.id === exp ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}
              <option value="all" ${exp === 'all' ? 'selected' : ''}>All experiences</option></select></label>
              <a href="#/instructor">Instructor Tools</a>` : ''}
          </nav>
        </div>
      </div>`;
    },
    bind(root) {
      const sel = root.querySelector('[data-action="experience"]');
      if (sel) sel.addEventListener('change', e => {
        const sess = Store.session(); sess.viewExperience = e.target.value; Store.setSession(sess); levelTab = null; selected = null; App.render();
      });
      root.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); levelTab = Number(b.dataset.level); selected = null; App.render(); }));
      root.querySelector('[data-action="refresh"]').addEventListener('click', () => App.render());
      const open = id => { if (id) location.hash = `#/patient/${id}/summary`; };
      root.querySelectorAll('[data-action="open"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(selected); }));
      root.querySelectorAll('[data-open]').forEach(r => {
        r.addEventListener('click', e => {
          if (e.target.closest('a')) return;
          selected = r.dataset.open;
          root.querySelectorAll('.census-row').forEach(x => x.classList.toggle('sb-selected', x === r));
          root.querySelectorAll('button[data-action="open"]').forEach(b => { b.disabled = false; });
        });
        r.addEventListener('dblclick', () => open(r.dataset.open));
        r.addEventListener('keydown', e => { if (e.key === 'Enter') open(r.dataset.open); });
      });
    }
  };

  /* ---------------- Instructor tools ---------------- */
  Screens.unlock = function (then) {
    if (Store.instructorUnlocked()) { then(); return; }
    UI.modal({
      title: 'Instructor Tools',
      body: '<label class="field"><span>Instructor PIN</span><input type="password" name="pin" autofocus inputmode="numeric"></label>',
      buttons: [{ label: 'Cancel' }, { label: 'Unlock', cls: 'btn-primary', onClick: api => {
        if (U.formValues(api.el).pin !== String(C.instructorPin)) { UI.formError(api.el.querySelector('.modal-body'), 'Incorrect PIN.'); return false; }
        Store.setInstructor(true);
        then();
      } }]
    });
  };

  Screens.instructor = {
    render() {
      const pts = Model.allPatients();
      const cards = pts.map(base => {
        const p = Model.get(base.id);
        const doc = Store.doc(p.id);
        const rel = Store.released(p.id);
        const count = Store.SECTIONS.reduce((n, s) => n + doc[s].length, 0);
        const custom = Store.customPatients().some(c => c.id === p.id);
        return `<section class="panel">
          <header class="panel-head"><h2>Level ${esc(p.level || 3)} · ${esc(p.name.last)}, ${esc(p.name.first)} <span class="muted">— ${esc(p.admitDx)} · ${esc((p.experiences || []).map(Screens.experienceLabel).join(', ') || 'No experience assigned')}</span></h2>
            <div class="panel-actions">
              <a class="btn btn-sm" href="#/patient/${esc(p.id)}/summary">Open Chart</a>
              <a class="btn btn-sm" href="#/patient/${esc(p.id)}/report">Chart Report</a>
              <button class="btn btn-sm" data-restart="${esc(p.id)}">Restart Clock</button>
              <button class="btn btn-sm btn-danger" data-reset="${esc(p.id)}">Reset Patient</button>
              ${custom ? `<button class="btn btn-sm btn-danger" data-delcustom="${esc(p.id)}">Remove Patient</button>` : ''}
            </div></header>
          <div class="panel-body">
            <p>Chart clock: <strong>${U.fmtDT(p.clock.now())}</strong> (real time; scenario written for ${esc(p.scenarioStart || "—")}, shifted ${p.clock.shift / 3600000 >= 0 ? "+" : ""}${Math.round(p.clock.shift / 3600000)} h) · ${count} student entr${count === 1 ? 'y' : 'ies'} · MRN barcode <code>${esc(p.mrn)}</code></p>
            ${p.labsPending ? `<p class="warn-box">${esc(p.labsPending)}</p>` : ''}
            ${(base.events || []).length ? `<h3>Scenario events</h3>${base.events.map(ev => `<div class="event ${rel[ev.id] ? 'event-on' : ''}">
                <div><strong>${esc(ev.title)}</strong>
                  <div class="muted small">${[(ev.orders || []).length && (ev.orders.length + ' order(s)'), (ev.meds || []).length && (ev.meds.length + ' med(s)'), (ev.labs || []).length && (ev.labs.length + ' result panel(s)')].filter(Boolean).join(' · ')}</div>
                  ${ev.instructorNotes ? `<details><summary>Instructor notes</summary><p>${esc(ev.instructorNotes)}</p></details>` : ''}</div>
                <div>${rel[ev.id] ? `<span class="badge badge-ok">Released ${U.fmtTime(p.clock.toSim(rel[ev.id]))}</span> <button class="btn btn-sm" data-unrelease="${esc(p.id)}|${esc(ev.id)}">Undo</button>`
                  : `<button class="btn btn-sm btn-primary" data-release="${esc(p.id)}|${esc(ev.id)}">Release Now</button>`}</div>
              </div>`).join('')}` : '<p class="muted">No scripted events for this patient.</p>'}
            ${(base.facultyGuide || []).map(g => `<details class="faculty-guide"><summary>📘 ${esc(g.title)} (instructor only)</summary><div class="note-body">${U.md(g.md)}</div></details>`).join('')}
          </div></section>`;
      }).join('');

      return `<div class="page">
        <div class="page-head"><h1>Instructor Tools</h1><div>
          <a class="btn" href="labels.html" target="_blank" rel="noopener">Print Wristbands & Med Labels</a>
          <button class="btn" data-action="export">Export All Documentation</button>
          <label class="btn">Import Documentation<input type="file" accept=".json,application/json" data-action="import" hidden></label>
          <label class="btn">Add Patient (JSON)<input type="file" accept=".json,application/json" data-action="addpt" hidden></label>
          <button class="btn" data-action="lock">Lock</button>
        </div></div>
        <div class="alert alert-info">Documentation is saved in <strong>this browser only</strong>. Release events and export charting on the same workstation the student used. "Reset Patient" erases that patient's documentation and restarts the scenario.</div>
        ${cards}
      </div>`;
    },
    bind(root) {
      const pts = () => Model.allPatients().map(p => p.id);
      root.querySelectorAll('[data-release]').forEach(b => b.addEventListener('click', () => { const [pid, ev] = b.dataset.release.split('|'); Store.release(pid, ev); UI.toast('Event released to the chart.'); App.render(); }));
      root.querySelectorAll('[data-unrelease]').forEach(b => b.addEventListener('click', () => { const [pid, ev] = b.dataset.unrelease.split('|'); Store.unrelease(pid, ev); App.render(); }));
      root.querySelectorAll('[data-restart]').forEach(b => b.addEventListener('click', () => UI.confirm('Restart clock', 'Set this chart\'s clock back to the scenario start time? Existing documentation keeps its times.', () => { Store.restartScenario(b.dataset.restart); App.render(); }, 'Restart')));
      root.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', () => UI.confirm('Reset patient', 'Erase ALL student documentation and released events for this patient? This cannot be undone. Export first if you need a copy.', () => { Store.resetPatient(b.dataset.reset); UI.toast('Patient reset.', 'warn'); App.render(); }, 'Erase & Reset')));
      root.querySelectorAll('[data-delcustom]').forEach(b => b.addEventListener('click', () => UI.confirm('Remove patient', 'Remove this imported patient from this browser?', () => { Store.deleteCustomPatient(b.dataset.delcustom); Store.resetPatient(b.dataset.delcustom); App.render(); }, 'Remove')));
      root.querySelector('[data-action="export"]').addEventListener('click', () =>
        U.download(`SimEHR_export_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`, JSON.stringify(Store.exportAll(pts()), null, 2)));
      root.querySelector('[data-action="lock"]').addEventListener('click', () => { const sess = Store.session(); delete sess.viewExperience; Store.setSession(sess); Store.setInstructor(false); location.hash = '#/census'; });
      const readFile = (input, fn) => input.addEventListener('change', () => {
        const f = input.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => { try { fn(JSON.parse(r.result)); App.render(); } catch (err) { UI.toast(err.message, 'danger'); } input.value = ''; };
        r.readAsText(f);
      });
      readFile(root.querySelector('[data-action="import"]'), obj => { Store.importAll(obj); UI.toast('Documentation imported.'); });
      readFile(root.querySelector('[data-action="addpt"]'), obj => {
        const list = Array.isArray(obj) ? obj : [obj];
        list.forEach(pt => {
          if (!pt.id || !pt.name || !pt.mrn || !pt.dob) throw new Error('Patient JSON needs at least id, name, mrn, and dob.');
          if ((window.SIM_PATIENTS || []).some(x => x.id === pt.id)) throw new Error(`A built-in patient already uses id "${pt.id}".`);
          Store.saveCustomPatient(pt);
        });
        UI.toast(`${list.length} patient(s) added to this browser.`);
      });
    }
  };
})();
