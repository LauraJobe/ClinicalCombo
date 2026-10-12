/*
 * ClinicalCombo hook for the MedStation cabinet. Loaded after data.js and
 * before app.js. It:
 *   - keeps the cabinet's data separate from the stand-alone simulator,
 *   - adds the scenario's patient(s), orders and stock to the cabinet,
 *   - puts everything the student removes "in their hands" (the tray) so it
 *     can be scanned in the EMR and hung at the bedside.
 */
(function () {
  'use strict';
  const B = window.ComboBridge, S = window.ComboScenarios;
  const run = B.run();
  const sc = run && S.byId(run.scenarioId);

  window.MEDSIM_STORE_KEY = 'clinicalCombo.medstation.v1';
  window.MEDSIM_MODE = 'free';
  // A new run starts with a fresh cabinet (new counts, nothing removed yet).
  try {
    const k = 'clinicalCombo.medstation.runId';
    if (localStorage.getItem(k) !== String(run && run.id)) {
      localStorage.removeItem(window.MEDSIM_STORE_KEY);
      localStorage.setItem(k, String(run && run.id));
    }
  } catch (e) { /* storage blocked */ }

  document.documentElement.classList.add('combo');
  const css = document.createElement('style');
  css.textContent = `
    html.combo .coach, html.combo .coach-jump, html.combo .quickbar { display: none !important; }
    html.combo .shell { grid-template-columns: 1fr !important; max-width: 1100px; margin: 0 auto; }
    .u-bag { width: 22px; height: 30px; border-radius: 4px 4px 8px 8px; background: linear-gradient(#f4f9ff 0 25%, #d6e9fb 25%); border: 1px solid #5b87b3; }
    .u-bag::before { content: ""; position: absolute; top: -5px; left: 8px; width: 4px; height: 6px; background: #7b8a99; border-radius: 1px; }
    .combo-tip { margin: 12px auto 0; max-width: 1100px; padding: 8px 12px; border-radius: 6px; background: #eef6f1; border: 1px solid #b5d3c1; font: 14px/1.4 "Source Sans 3", system-ui, sans-serif; color: #1f3a2c; }`;
  document.head.appendChild(css);

  if (!sc) return;

  // Scenario patient(s), orders and stock. PATIENTS and FORMULARY come from data.js.
  Object.assign(FORMULARY, sc.cabinet.formulary);
  PATIENTS.push(sc.cabinet.patient, ...(sc.cabinet.others || []));

  const name = p => p ? `${p.last.toUpperCase()}, ${p.first.toUpperCase()}` : 'Unknown patient';
  const findPt = id => PATIENTS.find(p => p.id === id);

  window.ComboMed = {
    event(e) {
      switch (e.type) {
        case 'signin': B.log('med', 'signin', { method: e.method }); break;
        case 'patient_action': B.log('med', 'patient', { patient: e.patient, patientName: name(findPt(e.patient)), action: e.action }); break;
        case 'allergy_alert': B.log('med', 'allergy_alert', { patient: e.patient, med: e.med, action: e.action }); break;
        case 'override_reason': B.log('med', 'override_reason', { reason: e.reason }); break;
        case 'removed': {
          const m = FORMULARY[e.med] || {};
          const v = S.verdict(sc, e.patient, e.med, FORMULARY, PATIENTS);
          const pt = findPt(e.patient);
          for (let i = 0; i < (e.qty || 1); i++) {
            B.addToTray({ med: e.med, form: m.form, label: v.label, patient: e.patient, patientName: `${name(pt)} · Rm ${pt ? pt.room : '?'}`,
              verdict: v.verdict, msg: v.msg || '', ehrCode: v.ehrCode || '' });
          }
          B.log('med', 'removed', { patient: e.patient, patientName: name(pt), med: e.med, label: v.label, qty: e.qty, override: !!e.override, verdict: v.verdict });
          break;
        }
        case 'returned':
          for (let i = 0; i < (e.qty || 1); i++) B.removeFromTray(t => t.med === e.med && t.patient === e.patient);
          B.log('med', 'returned', { patient: e.patient, med: e.med, label: (FORMULARY[e.med] || {}).name, qty: e.qty });
          break;
        case 'waste': B.log('med', 'waste', { med: e.med, amount: e.amount }); break;
        case 'signout': B.log('med', 'signout', {}); break;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const tip = document.createElement('div');
    tip.className = 'combo-tip';
    tip.innerHTML = 'Sign in with user ID <b>student</b> and your fingerprint (or password <b>nurse1</b>). Find your patient under <b>All Available Patients</b>. Whatever you remove goes into your hands for the EMR scan and the bedside.';
    const shell = document.querySelector('.shell');
    if (shell) shell.parentNode.insertBefore(tip, shell);
  });
})();
