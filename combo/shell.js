/*
 * Med Pass Simulation launcher: start screen, the three stations (each an
 * iframe that stays open, so nothing is lost when switching), live progress,
 * and the debrief.
 */
(function () {
  'use strict';
  const B = window.ComboBridge, S = window.ComboScenarios;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const hhmm = t => { const d = new Date(t); return pad(d.getHours()) + pad(d.getMinutes()); };
  const dur = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
  const fmtDob = d => { const [y, m, dd] = d.split('-'); return `${m}/${dd}/${y}`; };

  const STATIONS = {
    ehr: { src: 'ehr/index.html', title: 'EMR workstation' },
    med: { src: 'medstation/index.html', title: 'Medication room: automated dispensing cabinet' },
    bed: { src: 'pumps/index.html', title: 'Bedside: IV infusion pump' }
  };
  let current = null;
  let chosen = null;

  /* ---------------- Progress: what the student has done ---------------- */
  function evaluate(run, sc) {
    const ev = run.events || [];
    const of = (station, type) => ev.filter(e => e.station === station && e.type === type);
    const medId = sc.order.medId;
    const acks = of('ehr', 'ack').filter(e => e.ref === medId);
    const removed = of('med', 'removed');
    const goodRemove = removed.filter(e => e.verdict === 'correct');
    const mars = of('ehr', 'mar').filter(e => e.medId === medId);
    const goodMar = mars.filter(e => /Given|Started/.test(e.action || '') && e.scanPatient === 'verified' && e.scanMed === 'verified');
    const anyGiven = mars.filter(e => /Given|Started/.test(e.action || ''));
    const pumps = of('bedside', 'pump');
    const goodPump = pumps.filter(e => e.ok);
    const hangs = of('bedside', 'hang');

    const steps = [
      { st: 'ehr', label: 'Review and acknowledge the new order', done: acks[0] },
      { st: 'med', label: 'Remove the medication for your patient', done: goodRemove[0] },
      { st: 'ehr', label: 'Scan wristband + medication, then document on the MAR', done: goodMar[0] || anyGiven[0], warn: !goodMar[0] && anyGiven[0] },
      { st: 'bed', label: 'Hang the bag and program the pump', done: goodPump[0], warn: !goodPump[0] && pumps[0] }
    ];

    const concerns = [], nearMiss = [], info = [];
    const firstAck = acks[0] ? acks[0].t : Infinity;
    const firstRemove = removed.filter(e => e.verdict !== 'other')[0];
    if (firstRemove && firstRemove.t < firstAck) concerns.push('Removed the medication before reviewing and acknowledging the new order in the EMR.');
    removed.forEach(e => {
      if (e.verdict === 'wrongPatient') concerns.push(`Removed ${e.label} for the wrong patient (${e.patientName}). Confirm two identifiers when you choose the patient in the cabinet.`);
      else if (e.verdict === 'wrongProduct') concerns.push(`Removed the wrong product: ${e.label}.`);
      else if (e.verdict === 'other') info.push(`Also removed ${e.label} for ${e.patientName}.`);
      if (e.override && e.verdict !== 'other') concerns.push(`Used an override to remove ${e.label}. The order was already pharmacy-verified on the profile.`);
    });
    of('med', 'allergy_alert').forEach(e => { if (e.action && !/cancel|no/i.test(e.action)) concerns.push('Continued past an allergy alert in the cabinet.'); });
    of('med', 'returned').forEach(e => info.push(`Returned ${e.label || e.med} to the cabinet.`));
    of('ehr', 'bcma').forEach(e => nearMiss.push(`The scanner stopped you: ${e.msg}`));
    mars.forEach(e => {
      if (e.unableReason) concerns.push(`Documented without scanning ("Unable to scan: ${e.unableReason}"). Scan every time unless there is a true emergency.`);
      if (/Not Given/.test(e.action)) info.push(`Documented the dose as Not Given (${e.reason || 'no reason'}).`);
    });
    hangs.forEach(e => {
      if (e.verdict !== 'correct') concerns.push(`Hung the wrong bag at the bedside: ${e.item}.`);
      if (!e.scannedFirst) concerns.push('Hung the bag before scanning the patient and medication in the EMR.');
    });
    const firstScan = goodMar[0] ? goodMar[0].t : Infinity;
    if (pumps[0] && pumps[0].t < firstScan && !hangs.some(h => !h.scannedFirst)) concerns.push('Started the infusion before scanning and documenting in the EMR.');
    if (pumps[0] && !pumps[0].ok) concerns.push(`Pump programming was not correct on the first attempt: ${pumps[0].items.filter(i => !i.ok).map(i => i.label).join(', ') || 'see the table'}.`);
    if (sc.newMed.highAlert && goodMar[0] && !goodMar[0].doubleCheck) concerns.push('No independent double check documented for a high-alert medication.');

    const complete = steps.every(s => s.done && !s.warn);
    return { steps, concerns: Array.from(new Set(concerns)), nearMiss: Array.from(new Set(nearMiss)), info, pumps, complete };
  }

  /* ---------------- Start screen ---------------- */
  function renderStart() {
    current = null;
    $('#start').hidden = false; $('#sim').hidden = true; $('#debrief').hidden = true;
    document.title = 'Med Pass Simulation';
    const run = B.run();
    const rs = run && S.byId(run.scenarioId);
    $('#resume').innerHTML = rs && !run.finishedAt ? `<div class="resume"><div><b>Simulation in progress:</b> ${esc(rs.level)} · ${esc(rs.title)} — ${esc(run.student)}, started ${hhmm(run.startedAt)}</div>
      <div class="resume-btns"><button class="btn btn-primary" type="button" data-resume>Resume</button><button class="btn" type="button" data-review>Debrief</button></div></div>`
      : rs && run.finishedAt ? `<div class="resume"><div><b>Last run:</b> ${esc(rs.title)} — ${esc(run.student)}, finished ${hhmm(run.finishedAt)}</div><div class="resume-btns"><button class="btn" type="button" data-review>View debrief</button></div></div>` : '';
    const r = $('#resume [data-resume]'); if (r) r.onclick = () => openSim();
    const v = $('#resume [data-review]'); if (v) v.onclick = () => openDebrief();
    if (run && run.student && !$('#studentName').value) $('#studentName').value = run.student;

    $('#scenarioCards').innerHTML = S.list.map(sc => `<button type="button" class="scn-card${chosen === sc.id ? ' on' : ''}" role="radio" aria-checked="${chosen === sc.id}" data-scn="${sc.id}">
        <span class="scn-level">${esc(sc.level)}</span>
        <span class="scn-title">${esc(sc.title)}</span>
        <span class="scn-tag">${esc(sc.tagline)}</span>
        <span class="scn-skills">${sc.skills.map(k => `<span>${esc(k)}</span>`).join('')}</span>
      </button>`).join('');
    $$('[data-scn]').forEach(b => b.onclick = () => { chosen = b.dataset.scn; renderStart(); });
    $('#answerKeys').innerHTML = S.list.map(sc => `<h3>${esc(sc.level)} · ${esc(sc.title)}</h3><p>${esc(sc.debrief.answerKey)}</p>`).join('');
  }
  $('#startForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#studentName').value.trim();
    const err = $('#startErr');
    if (!name) { err.textContent = 'Enter your name. It becomes your signature in the EMR.'; err.hidden = false; $('#studentName').focus(); return; }
    if (!chosen) { err.textContent = 'Choose a scenario.'; err.hidden = false; return; }
    err.hidden = true;
    const mode = (document.querySelector('[name="mode"]:checked') || {}).value || 'guided';
    B.start(chosen, name, mode);
    $('#frames').innerHTML = '';
    openSim();
  });

  /* ---------------- Simulation ---------------- */
  function openSim() {
    const run = B.run(), sc = run && S.byId(run.scenarioId);
    if (!sc) return renderStart();
    $('#start').hidden = true; $('#debrief').hidden = true; $('#sim').hidden = false;
    document.title = `${sc.patient.last}, ${sc.patient.first} — Med Pass Simulation`;
    $('#barScn').textContent = `${sc.level} · ${sc.title}`;
    const p = sc.patient;
    $('#ptCard').innerHTML = `<p class="pt-name">${esc(p.last.toUpperCase())}, ${esc(p.first)}</p>
      <dl class="pt-dl"><dt>Room</dt><dd>${esc(p.room)}</dd><dt>DOB</dt><dd>${esc(fmtDob(p.dob))} (${esc(p.age.replace(' years', ''))} ${esc(p.sex)})</dd>
      <dt>MRN</dt><dd>${esc(p.mrn)}</dd><dt>Weight</dt><dd>${esc(p.weightKg)} kg</dd>
      <dt>Allergies</dt><dd class="${p.allergies.length ? 'alg' : ''}">${p.allergies.length ? p.allergies.map(a => esc(a.agent + ' (' + a.reaction.toLowerCase() + ')')).join(', ') : 'NKDA'}</dd>
      <dt>Dx</dt><dd>${esc(p.dx)}</dd></dl>`;
    $('#situation').textContent = sc.brief.situation;
    $('#task').textContent = sc.brief.task;
    show(current || 'ehr');
    refresh();
  }

  function show(name) {
    if (!STATIONS[name]) return;
    const frames = $('#frames');
    let f = frames.querySelector(`iframe[data-st="${name}"]`);
    if (!f) {
      f = document.createElement('iframe');
      f.dataset.st = name;
      f.title = STATIONS[name].title;
      f.src = STATIONS[name].src;
      f.setAttribute('allow', 'autoplay');
      frames.appendChild(f);
    }
    frames.querySelectorAll('iframe').forEach(x => { x.hidden = x !== f; });
    current = name;
    $$('.st').forEach(b => b.setAttribute('aria-selected', String(b.dataset.st === name)));
    if (window.innerWidth < 900) togglePanel(false);
  }
  $$('.st').forEach(b => b.addEventListener('click', () => show(b.dataset.st)));

  function togglePanel(open) {
    const sim = $('#sim');
    const on = open == null ? sim.classList.contains('panel-closed') : open;
    sim.classList.toggle('panel-closed', !on);
    $('#panelBtn').setAttribute('aria-expanded', String(on));
  }
  $('#panelBtn').addEventListener('click', () => togglePanel());
  if (window.innerWidth < 900) $('#sim').classList.add('panel-closed');
  $('#debriefBtn').addEventListener('click', () => {
    const run = B.run(), sc = run && S.byId(run.scenarioId);
    const res = sc && evaluate(run, sc);
    if (res && !res.complete && !confirm('Not every step is complete. Finish the simulation and go to the debrief?')) return;
    B.update(r => { if (!r.finishedAt) r.finishedAt = Date.now(); });
    openDebrief();
  });
  $('#endBtn').addEventListener('click', () => { if (confirm('Leave this simulation? Your progress stays saved on this device until you start another scenario.')) renderStart(); });

  let wasComplete = false;
  function refresh() {
    const run = B.run(), sc = run && S.byId(run.scenarioId);
    if (!sc || $('#sim').hidden) return;
    const res = evaluate(run, sc);
    const guided = run.mode !== 'independent';
    $('#steps').innerHTML = guided ? res.steps.map((s, i) => `<li class="${s.done ? (s.warn ? 'warn' : 'done') : ''}">
        <span class="step-n" aria-hidden="true">${s.done && !s.warn ? '✓' : s.warn ? '!' : i + 1}</span>
        <span><span class="step-st">${{ ehr: 'EMR', med: 'Medication Room', bed: 'Bedside' }[s.st]}</span>${esc(s.label)}${s.done ? ` <small>${hhmm(s.done.t)}</small>` : ''}
        ${s.warn ? `<small class="warn-t">${s.st === 'bed' ? 'Not correct yet — check the pump result and try again.' : 'Documented, but the wristband and medication were not both scanned.'}</small>` : ''}</span></li>`).join('')
      : '<li class="hidden-note">Independent mode: your progress is shown in the debrief.</li>';
    const tray = run.tray || [];
    $('#hands').innerHTML = tray.length ? tray.map(t => `<li><span aria-hidden="true">${t.form === 'bag' ? '💧' : '💊'}</span><span><b>${esc(t.label)}</b><small>${esc(t.patientName)}${t.id === run.hung ? ' · <em>hanging at the bedside</em>' : ''}</small></span></li>`).join('')
      : '<li class="empty">Nothing yet. Medications you remove from the cabinet appear here.</li>';
    // Station dots: guided mode marks a station when its steps are done.
    const doneBy = st => res.steps.filter(s => s.st === st).every(s => s.done && !s.warn);
    $$('.st').forEach(b => b.classList.toggle('st-done', guided && doneBy(b.dataset.st)));
    $('#timer').textContent = dur((run.finishedAt || Date.now()) - run.startedAt);
    if (res.complete && !wasComplete) {
      wasComplete = true;
      if (!run.finishedAt) toast(guided ? 'All four steps are complete. Select Finish & debrief when you are ready.' : 'Select Finish & debrief when you are done.');
      $('#debriefBtn').classList.add('pulse');
    }
    if (!res.complete) { wasComplete = false; $('#debriefBtn').classList.remove('pulse'); }
  }
  B.on(refresh);
  setInterval(() => { if (!$('#sim').hidden) refresh(); }, 1000);

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 6000);
  }

  /* ---------------- Debrief ---------------- */
  function describe(e) {
    const m = {
      'ehr.ack': () => 'Acknowledged a new order',
      'ehr.mar': () => `Documented ${e.medName}: ${e.action}${e.dose ? ' · ' + e.dose : ''}${e.rate ? ' · ' + e.rate : ''} — wristband ${e.scanPatient}, medication ${e.scanMed}${e.doubleCheck ? ' · double check: ' + e.doubleCheck : ''}${e.unableReason ? ' · unable to scan: ' + e.unableReason : ''}`,
      'ehr.mar_error': () => `Marked a MAR entry in error (${e.reason})`,
      'ehr.scan': () => `Scanned ${e.item}`,
      'ehr.bcma': () => `Scanner stop: ${e.msg}`,
      'med.signin': () => `Signed in to the cabinet (${e.method || 'fingerprint'})`,
      'med.patient': () => `Selected ${e.patientName} → ${e.action}`,
      'med.removed': () => `Removed ${e.label} for ${e.patientName}${e.override ? ' (override)' : ''}`,
      'med.returned': () => `Returned ${e.label || e.med}`,
      'med.allergy_alert': () => `Allergy alert in the cabinet (${e.action})`,
      'med.override_reason': () => `Override reason: ${e.reason}`,
      'med.waste': () => `Wasted ${e.amount}`,
      'med.signout': () => 'Signed out of the cabinet',
      'bedside.hang': () => `Hung ${e.item}`,
      'bedside.unhang': () => `Took down ${e.item}`,
      'bedside.pump': () => `Pump attempt ${e.attempt}: ${e.ok ? 'correct' : 'not correct'}`
    }[e.station + '.' + e.type];
    return m ? m() : `${e.station} ${e.type}`;
  }

  function openDebrief() {
    const run = B.run(), sc = run && S.byId(run.scenarioId);
    if (!sc) return renderStart();
    const res = evaluate(run, sc);
    $('#start').hidden = true; $('#sim').hidden = true;
    const d = $('#debrief'); d.hidden = false;
    document.title = `Debrief — ${run.student} — Med Pass Simulation`;
    const stepsDone = res.steps.filter(s => s.done && !s.warn).length;
    const firstPump = res.pumps[0];
    const stName = { ehr: 'EMR', med: 'Medication Room', bed: 'Bedside', bedside: 'Bedside' };
    const reflections = run.reflections || {};
    d.innerHTML = `<div class="db-wrap">
      <header class="db-head">
        <div><p class="kicker">Med Pass Simulation · Debrief</p><h1>${esc(sc.level)} · ${esc(sc.title)}</h1>
          <p class="muted">${esc(run.student)} · ${new Date(run.startedAt).toLocaleDateString()} · started ${hhmm(run.startedAt)} · ${dur((run.finishedAt || Date.now()) - run.startedAt)} min · patient ${esc(sc.patient.last)}, ${esc(sc.patient.first)} (MRN ${esc(sc.patient.mrn)})</p></div>
        <div class="db-btns no-print"><button class="btn" type="button" data-back>Back to the simulation</button><button class="btn" type="button" data-print>Print / Save PDF</button><button class="btn btn-primary" type="button" data-new>New scenario</button></div>
      </header>
      <div class="tiles">
        <div class="tile"><span class="tile-n">${stepsDone}/4</span><span>steps complete</span></div>
        <div class="tile ${res.concerns.length ? 'bad' : 'good'}"><span class="tile-n">${res.concerns.length}</span><span>safety concern${res.concerns.length === 1 ? '' : 's'}</span></div>
        <div class="tile ${res.nearMiss.length ? 'warn' : ''}"><span class="tile-n">${res.nearMiss.length}</span><span>scanner stop${res.nearMiss.length === 1 ? '' : 's'} (near miss)</span></div>
        <div class="tile ${firstPump ? (firstPump.ok ? 'good' : 'bad') : ''}"><span class="tile-n">${firstPump ? (firstPump.ok ? '✓' : '✕') : '—'}</span><span>pump, first attempt</span></div>
      </div>
      <section class="db-sec"><h2>The four steps</h2><ol class="db-steps">${res.steps.map(s => `<li class="${s.done && !s.warn ? 'done' : s.warn ? 'warn' : 'miss'}"><b>${stName[s.st]}:</b> ${esc(s.label)} — ${s.done ? (s.warn ? 'done with a problem' : 'done') + ' at ' + hhmm(s.done.t) : 'not done'}</li>`).join('')}</ol></section>
      <section class="db-sec"><h2>Safety</h2>
        ${res.concerns.length ? `<ul class="db-list bad">${res.concerns.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : '<p class="ok-line">No safety concerns recorded.</p>'}
        ${res.nearMiss.length ? `<h3>Near misses (caught by the barcode scan)</h3><ul class="db-list warn">${res.nearMiss.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
        ${res.info.length ? `<h3>Other notes</h3><ul class="db-list">${res.info.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      </section>
      <section class="db-sec"><h2>IV pump</h2>${res.pumps.length ? res.pumps.map(p => `<h3>Attempt ${p.attempt} — ${p.ok ? '<span class="ok-t">correct</span>' : '<span class="bad-t">not correct</span>'} (${hhmm(p.t)})</h3>
        <table class="db-table"><thead><tr><th></th><th>Order needs</th><th>You programmed</th></tr></thead><tbody>${p.items.map(i => `<tr class="${i.ok ? 'ok' : 'no'}"><td>${i.ok ? '✓' : '✕'} ${esc(i.label)}</td><td>${esc(i.want)}</td><td>${esc(i.got)}</td></tr>`).join('')}</tbody></table>`).join('')
        + `<p class="math"><b>Math:</b> ${esc(res.pumps[0].math)}</p>` : '<p class="muted">The pump was not started.</p>'}</section>
      <section class="db-sec"><h2>Key points</h2><ul class="db-list">${sc.debrief.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul></section>
      <section class="db-sec"><h2>Reflection</h2>${sc.debrief.questions.map((q, i) => `<label class="refl"><span>${i + 1}. ${esc(q)}</span><textarea rows="3" data-refl="${i}">${esc(reflections[i] || '')}</textarea></label>`).join('')}</section>
      <section class="db-sec"><h2>Timeline</h2><table class="db-table tl"><tbody>${(run.events || []).map(e => `<tr><td class="t">${hhmm(e.t)}</td><td class="where">${stName[e.station] || e.station}</td><td>${esc(describe(e))}</td></tr>`).join('') || '<tr><td>Nothing recorded.</td></tr>'}</tbody></table></section>
      <details class="db-sec faculty no-print"><summary>Faculty answer key</summary><p>${esc(sc.debrief.answerKey)}</p></details>
    </div>`;
    d.querySelector('[data-back]').onclick = () => { B.update(r => { r.finishedAt = null; }); openSim(); };
    d.querySelector('[data-print]').onclick = () => window.print();
    d.querySelector('[data-new]').onclick = () => { chosen = null; renderStart(); window.scrollTo(0, 0); };
    d.querySelectorAll('[data-refl]').forEach(t => t.addEventListener('input', () => {
      clearTimeout(t._h); t._h = setTimeout(() => B.update(r => { r.reflections = r.reflections || {}; r.reflections[t.dataset.refl] = t.value; }), 400);
    }));
    window.scrollTo(0, 0);
  }

  window.ComboShell = { show, evaluate };

  // Open where the student left off.
  const run = B.run();
  if (run && S.byId(run.scenarioId) && !run.finishedAt) openSim();
  else renderStart();
})();
