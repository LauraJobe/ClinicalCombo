/*
 * ClinicalCombo hook for the IV Pump Practice Lab. Loaded after practice.js
 * and before app.js. It:
 *   - adds a locked "simulation" mode whose one order is the EMR order,
 *   - keeps the pump covered until the student brings the bag from the
 *     medication room and hangs it,
 *   - checks the patient ID typed on the pump against the wristband,
 *   - reports every graded attempt to the simulation.
 */
(function () {
  'use strict';
  const B = window.ComboBridge, S = window.ComboScenarios;
  const run = B.run();
  const sc = run && S.byId(run.scenarioId);
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.IVP_CONFIG = Object.assign({}, window.IVP_CONFIG, { mode: 'combo', lockMode: true, lms: true });
  SCENARIOS.push({
    id: 'combo', level: 'Simulation', title: 'Med pass simulation: the order from the EMR', practice: true, combo: true, lmsOnly: true,
    summary: 'Program the order from the EMR for the patient at this bedside. Your work is checked when you start the infusion.',
    setup: () => {}
  });

  const r1 = n => Math.round(n * 10) / 10;
  const r2 = n => Math.round(n * 100) / 100;
  const durText = min => (min % 60 === 0 ? `${min / 60} hour${min === 60 ? '' : 's'}` : `${min} minutes`);
  const hm = min => (min >= 60 ? `${Math.floor(min / 60)}${String(min % 60).padStart(2, '0')}` : String(min));

  // The practice-mode order object for this scenario (same shape as practice.js builds).
  function buildOrder() {
    const x = sc.pump, pt = sc.patient;
    const d = profileDrug(x.profile, x.drugId), c = d.concs[x.concIdx];
    const patient = { name: `${pt.first} ${pt.last}`, age: pt.age.replace(' years', ' y'), weight: pt.weightKg, mrn: pt.mrn, unit: 'Med-Surg' };
    let o;
    if (x.kind === 'secondary') {
      const rate = r1(c.vol / (x.minutes / 60));
      const pf = profileDrug(x.profile, x.primary.drugId);
      o = { spec: x.profile, kind: 'secondary', drugId: x.drugId, concIdx: x.concIdx, rate, vtbi: c.vol, patient, minutes: x.minutes,
        primary: { drugId: x.primary.drugId, rate: x.primary.rate },
        text: `<b>${d.name} ${fmtNum(c.amt, 3)} ${c.unit}</b> IVPB in ${fmtNum(c.vol)} mL, infuse over <b>${durText(x.minutes)}</b>.<br><span class="policy">${pf.name} is running on Channel A at ${x.primary.rate} mL/hr. The secondary bag is hung above the primary with its clamp open.</span>`,
        math: `${fmtNum(c.vol)} mL ÷ ${r2(x.minutes / 60)} h = <b>${fmtNum(rate, 1)} mL/h</b>. VTBI = ${fmtNum(c.vol)} mL. (Or type DURATION ${hm(x.minutes)}.)`,
        steps: [`CHANNEL SELECT on A → SECONDARY → ${d.name}${d.concs.length > 1 ? ` → ${concLabel(d, c)}` : ''} → Yes`, `VTBI is pre-filled (${fmtNum(c.vol)}). DURATION ${hm(x.minutes)} (${durText(x.minutes)}) → START`] };
    } else {
      const rate = r1(doseToRate(d, c, x.dose, pt.weightKg));
      const unit = doseUnitLabel(d);
      const perHr = x.dose * pt.weightKg;
      o = { spec: x.profile, kind: 'primary', drugId: x.drugId, concIdx: x.concIdx, dose: x.dose, rate, vtbi: c.vol, patient, perKg: d.dose && d.dose.perKg,
        text: `<b>${d.name} ${fmtNum(c.amt, 3)} ${c.unit} in ${fmtNum(c.vol)} mL</b>. Start at <b>${fmtNum(x.dose, 3)} ${unit}</b> (dosing weight ${pt.weightKg} kg). New infusion: the line is primed and loaded.`,
        math: `${fmtNum(x.dose, 3)} ${unit} × ${pt.weightKg} kg = ${fmtNum(perHr, 1)} ${d.dose.unit}/h ÷ ${fmtNum(c.amt / c.vol, 3)} ${c.unit}/mL = <b>${fmtNum(rate, 1)} mL/h</b>. VTBI = ${fmtNum(c.vol)} mL.`,
        steps: [`CHANNEL SELECT → Guardrails Drugs → ${d.name}${d.concs.length > 1 ? ` → ${concLabel(d, c)}` : ''} → Yes${d.highAlert ? ' → CONFIRM' : ''}`,
          d.dose && d.dose.perKg ? `PATIENT WEIGHT ${pt.weightKg} → CONFIRM → NEXT` : 'NEXT', `DOSE ${fmtNum(x.dose, 3)} → VTBI ${fmtNum(c.vol)} → START`] };
    }
    o.profile = x.profile;
    o.drug = d;
    o.conc = c;
    return o;
  }
  window.ComboPump = { order: () => (sc ? buildOrder() : PRACTICE.newOrder('medsurg')) };

  // New starts: the patient ID typed on the pump must match the wristband.
  const evaluate = PRACTICE.evaluate;
  PRACTICE.evaluate = function (St, o, X) {
    const r = evaluate.apply(this, arguments);
    if (!r || !sc || o.kind !== 'primary' || X.held) return r;
    const st = St.log.slice(X.logStart).find(e => e.type === 'start' && e.patientId != null);
    if (st) {
      const ok = String(st.patientId) === String(sc.patient.mrn);
      r.items.unshift({ label: 'Patient ID (wristband)', ok, want: sc.patient.mrn, got: String(st.patientId) });
      r.ok = r.ok && ok;
    }
    return r;
  };

  // Report each graded attempt.
  let attempt = 0;
  window.addEventListener('ivp-result', () => {
    const p = window.ivpPractice, r = p && p.result;
    if (!r) return;
    attempt++;
    B.log('bedside', 'pump', { attempt, ok: !!r.ok, held: !!(r.items || []).some(i => /hold/i.test(i.got || '')),
      items: (r.items || []).map(i => ({ label: i.label, ok: i.ok, want: String(i.want).replace(/<[^>]+>/g, ''), got: String(i.got).replace(/<[^>]+>/g, '') })),
      math: String(p.order && p.order.math || '').replace(/<[^>]+>/g, '') });
  });

  /* ---------- Bedside: bring the bag, hang it, then program ---------- */
  const css = document.createElement('style');
  css.textContent = `
    .simbar .seg, .simbar .label, [data-pr="next"], [data-pr="skip"], [data-pr="answer"], .pr-spec, .pr-score, .coach .picker label, #scenarioSelect, #restartBtn { display: none !important; }
    .device-col { position: relative; }
    .combo-cover { position: absolute; inset: 0; z-index: 30; background: rgba(245, 247, 246, .97); display: flex; align-items: flex-start; justify-content: center; padding: 28px 16px; border-radius: 12px; }
    .combo-card { max-width: 560px; width: 100%; background: #fff; border: 1px solid #c9d3cd; border-radius: 12px; padding: 20px 22px; box-shadow: 0 8px 28px rgba(0,0,0,.12); font: 15px/1.5 "Source Sans 3", system-ui, sans-serif; color: #1c2b24; }
    .combo-card h2 { margin: 0 0 4px; font-size: 21px; }
    .combo-card .room { color: #4d5f56; margin: 0 0 14px; }
    .combo-card .bag { display: flex; gap: 12px; align-items: center; border: 1px solid #cfd8d3; border-radius: 8px; padding: 10px 12px; margin: 8px 0; }
    .combo-card .bag b { display: block; }
    .combo-card .bag small { color: #4d5f56; }
    .combo-card .bag button, .combo-card .go { margin-left: auto; font: inherit; font-weight: 600; padding: 8px 14px; border-radius: 8px; border: 0; background: #1d5b3e; color: #fff; cursor: pointer; white-space: nowrap; }
    .combo-card .go.alt { background: #e9eeeb; color: #1c2b24; margin-left: 0; }
    .combo-card .row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .combo-card .note { background: #fff8e1; border: 1px solid #ecd28e; border-radius: 8px; padding: 8px 12px; margin: 12px 0 0; font-size: 14px; }
    .combo-hung { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 0 0 10px; padding: 8px 12px; border-radius: 8px; background: #eef6f1; border: 1px solid #b5d3c1; font: 14px/1.4 "Source Sans 3", system-ui, sans-serif; }
    .combo-hung button { margin-left: auto; font: inherit; padding: 4px 10px; border-radius: 6px; border: 1px solid #9fb8aa; background: #fff; cursor: pointer; }`;
  document.head.appendChild(css);

  function scannedInEmr() {
    return B.events('mar').some(e => e.medId === sc.order.medId && e.scanMed === 'verified');
  }

  function renderBedside() {
    if (!sc) return;
    const col = $('.device-col');
    if (!col) return;
    const r = B.run() || {};
    const bags = (r.tray || []).filter(t => t.form === 'bag');
    const hung = bags.find(t => t.id === r.hung);
    let cover = col.querySelector('.combo-cover');
    let strip = col.querySelector('.combo-hung');
    const pt = sc.patient;
    if (hung) {
      if (cover) cover.remove();
      if (!strip) { strip = document.createElement('div'); strip.className = 'combo-hung'; col.insertBefore(strip, col.firstChild); }
      strip.innerHTML = `<span>💧 <b>Hanging:</b> ${esc(hung.label)} <small>(label: ${esc(hung.patientName)})</small></span><button type="button" data-unhang>Take it down</button>`;
      strip.querySelector('[data-unhang]').onclick = () => { B.update(x => { x.hung = null; }); B.log('bedside', 'unhang', { item: hung.label }); renderBedside(); };
      return;
    }
    if (strip) strip.remove();
    if (!cover) { cover = document.createElement('div'); cover.className = 'combo-cover'; col.appendChild(cover); }
    const scanNote = scannedInEmr() ? '' : '<p class="note"><b>Before you hang it:</b> scan the wristband and the medication on the MAR in the EMR, and document the administration.</p>';
    cover.innerHTML = `<div class="combo-card">
      <h2>🛏 Bedside — Room ${esc(pt.room)}</h2>
      <p class="room">${esc(pt.last.toUpperCase())}, ${esc(pt.first.toUpperCase())} · DOB ${esc(pt.dob.split('-').slice(1).concat(pt.dob.split('-')[0]).join('/'))} · MRN ${esc(pt.mrn)} · ${esc(pt.weightKg)} kg</p>
      ${bags.length ? `<p>Which bag are you hanging?</p>${bags.map(b => `<div class="bag"><span aria-hidden="true">💧</span><span><b>${esc(b.label)}</b><small>Pharmacy label: ${esc(b.patientName)}</small></span><button type="button" data-hang="${esc(b.id)}">Hang this bag</button></div>`).join('')}${scanNote}`
        : `<p>You don't have the IV medication yet.</p><p>Review the order in the <b>EMR</b>, then remove the medication in the <b>Medication Room</b>.</p>
           <div class="row">${B.inShell() ? '<button type="button" class="go" data-go="ehr">Go to the EMR</button><button type="button" class="go alt" data-go="med">Go to the Medication Room</button>' : ''}</div>`}
    </div>`;
    cover.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => B.goStation(b.dataset.go)));
    cover.querySelectorAll('[data-hang]').forEach(b => b.addEventListener('click', () => {
      const it = bags.find(x => x.id === b.dataset.hang);
      B.update(x => { x.hung = it.id; });
      B.log('bedside', 'hang', { item: it.label, verdict: it.verdict, scannedFirst: scannedInEmr() });
      renderBedside();
    }));
  }
  B.on(renderBedside);
  document.addEventListener('DOMContentLoaded', () => { renderBedside(); setTimeout(renderBedside, 300); });
})();
