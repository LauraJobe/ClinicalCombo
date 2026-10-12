/*
 * ClinicalCombo hook for the SimEHR. Loaded after the EHR's own scripts and
 * before app.js. It:
 *   - loads only the current scenario's patient,
 *   - signs the student in under the "Med Pass Simulation" experience,
 *   - releases the scenario's new order (flagged NEW, must be acknowledged),
 *   - reports acknowledgments and MAR documentation to the simulation,
 *   - replaces the camera with a simulated scanner: the student "scans" the
 *     wristband or an item they removed from the medication cabinet.
 */
(function () {
  'use strict';
  const B = window.ComboBridge, S = window.ComboScenarios, C = window.EHR_CONFIG;
  const esc = U.esc;
  const run = B.run();
  const sc = run && S.byId(run.scenarioId);

  C.experiences = [{ id: 'combo', label: 'Med Pass Simulation' }].concat(C.experiences);
  C.hospitalName = 'ATU Simulation Hospital';
  window.SIM_PATIENTS = sc ? [S.ehrPatient(sc)] : [];

  if (!sc) {
    // Opened on its own: send the student to the launcher.
    document.addEventListener('DOMContentLoaded', () => {
      document.body.innerHTML = '<div style="font:16px/1.5 system-ui;padding:40px;max-width:560px;margin:auto"><h1>No simulation running</h1><p>Start a scenario from the <a href="../index.html">Med Pass Simulation</a> page.</p></div>';
    });
    return;
  }
  const pid = S.ehrId(sc);

  // Sign in as the student for this run (no sign-in screen in the simulation).
  const s = Store.session();
  if (!s || s.experience !== 'combo' || s.runId !== run.id) {
    Store.setSession({ name: run.student, cred: 'SN', group: '', experience: 'combo', observer: false, signedIn: Date.now(), runId: run.id });
  }
  // Start the chart clock and release the new order.
  Store.scenarioStart(pid);
  if (!Store.released(pid)[S.eventId(sc)]) Store.release(pid, S.eventId(sc));

  // Report charting to the simulation.
  const add = Store.add;
  Store.add = function (p, section, data) {
    const e = add.apply(this, arguments);
    if (!e || p !== pid) return e;
    if (section === 'ack') B.log('ehr', 'ack', { ref: data.ref, kind: data.kind });
    if (section === 'mar' && data.action !== 'Effectiveness') {
      const sc0 = data.scan || {};
      B.log('ehr', 'mar', { medId: data.medId, medName: data.medName, action: data.action, dose: data.dose, rate: data.rate,
        scanPatient: sc0.patient, scanMed: sc0.med, unableReason: sc0.unableReason || '', doubleCheck: data.doubleCheck || '',
        reason: data.reason || '', allergyOverride: data.allergyOverride || '' });
    }
    return e;
  };
  const markError = Store.markError;
  Store.markError = function (p, section, id, reason) {
    markError.apply(this, arguments);
    if (p === pid && section === 'mar') B.log('ehr', 'mar_error', { reason });
  };

  /* ---------- Simulated scanner ---------- */
  const FORM_ICON = { bag: '💧', vial: '🧪', tab: '💊', cap: '💊', syringe: '💉', Carpuject: '💉', pen: '🖊', neb: '🌫', kit: '🧰' };
  function hardStop(title, msg) {
    UI.modal({ title, body: `<div class="hard-stop"><strong>⛔ ${esc(msg)}</strong></div><p>Do not give it. Return the item to the medication room and get the correct medication.</p>`, buttons: [{ label: 'OK', cls: 'btn-primary' }] });
  }

  CameraScan.open = function (onCode, opts) {
    opts = opts || {};
    const p = Model.get(pid);
    const tray = B.tray();
    const items = tray.map(it => `<button type="button" class="sim-scan-item" data-tray="${esc(it.id)}">
        <span class="ssi-icon" aria-hidden="true">${FORM_ICON[it.form] || '💊'}</span>
        <span><strong>${esc(it.label)}</strong><small>Pharmacy label: ${esc(it.patientName)}</small></span></button>`).join('');
    UI.modal({
      title: 'Simulated Scanner',
      body: `<p class="muted">Choose what to point the scanner at. In the hospital you would scan the barcode with the handheld scanner.</p>
        <div class="sim-scan-list">
          <button type="button" class="sim-scan-item" data-wrist="1"><span class="ssi-icon" aria-hidden="true">🪪</span>
            <span><strong>Patient wristband</strong><small>${esc(p.name.last.toUpperCase())}, ${esc(p.name.first.toUpperCase())} · DOB ${esc(U.fmtDOB(p.dob))} · MRN ${esc(p.mrn)}</small></span></button>
          <div class="sim-scan-h">In your hands</div>
          ${items || `<p class="sim-scan-empty">Nothing yet. Remove the medication in the <strong>Medication Room</strong> first.${B.inShell() ? ' <button type="button" class="btn btn-sm" data-go="med">Go to the Medication Room</button>' : ''}</p>`}
        </div>`,
      buttons: [{ label: 'Cancel' }],
      onOpen(api) {
        const el = api.el;
        el.querySelector('[data-wrist]').addEventListener('click', () => { api.close(); onCode(String(p.mrn)); });
        const go = el.querySelector('[data-go]');
        if (go) go.addEventListener('click', () => { api.close(); B.goStation('med'); });
        el.querySelectorAll('[data-tray]').forEach(btn => btn.addEventListener('click', () => {
          const it = B.tray().find(x => x.id === btn.dataset.tray);
          api.close();
          if (!it) return;
          B.log('ehr', 'scan', { item: it.label, verdict: it.verdict });
          if (it.ehrCode) return onCode(it.ehrCode);
          B.log('ehr', 'bcma', { item: it.label, verdict: it.verdict, msg: it.msg });
          hardStop(it.verdict === 'wrongPatient' ? 'WRONG PATIENT' : it.verdict === 'wrongProduct' ? 'WRONG PRODUCT' : 'No Matching Order', it.msg);
        }));
      }
    });
  };
  // The EMR's own "No Active Order" / "WRONG MEDICATION" stops also count as scanner alerts.
  const modal = UI.modal;
  UI.modal = function (o) {
    if (o && /^(WRONG PATIENT|No Active Order)$/.test(o.title || '')) B.log('ehr', 'bcma', { msg: String(o.body || '').replace(/<[^>]+>/g, '').trim() });
    return modal.apply(this, arguments);
  };

  // Camera buttons become scanner buttons.
  function relabel(root) {
    (root || document).querySelectorAll('.cam-btn:not([data-sim])').forEach(b => {
      b.dataset.sim = '1';
      b.textContent = /Camera/.test(b.textContent) ? '⌖ Scanner' : '⌖';
      b.title = 'Simulated barcode scanner';
      b.setAttribute('aria-label', 'Open the simulated barcode scanner');
    });
  }
  new MutationObserver(() => relabel()).observe(document.documentElement, { childList: true, subtree: true });

  // Simulator styles.
  const css = document.createElement('style');
  css.textContent = `
    .sim-scan-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .sim-scan-item { display: flex; align-items: center; gap: 12px; text-align: left; padding: 10px 12px; border: 1px solid #b9c4cc; border-radius: 6px; background: #fff; cursor: pointer; font: inherit; }
    .sim-scan-item:hover, .sim-scan-item:focus-visible { border-color: #1d5b3e; background: #eef6f1; outline: none; }
    .sim-scan-item small { display: block; color: #555; }
    .ssi-icon { font-size: 22px; width: 28px; text-align: center; }
    .sim-scan-h { margin-top: 6px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #555; }
    .sim-scan-empty { padding: 10px 12px; background: #fff8e1; border: 1px dashed #d8b65a; border-radius: 6px; }
    .cam-btn[data-sim] { white-space: nowrap; }`;
  document.head.appendChild(css);
})();
