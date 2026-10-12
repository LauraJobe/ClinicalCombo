/* MedStation Practice Simulator — application logic.
 * Plain JavaScript, no build step. State lives in localStorage on the student's device. */
(() => {
'use strict';

const F = FORMULARY;
const STORE_KEY = window.MEDSIM_STORE_KEY || 'medsim.v1'; // ClinicalCombo sets its own key
const HOUR = 3600000, MIN = 60000;

/* ---------- utilities ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => String(parseFloat(Number(n).toFixed(3)));
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = n => String(n).padStart(2, '0');
const hhmm = t => { const d = new Date(t); return pad(d.getHours()) + pad(d.getMinutes()); };
const dateStr = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const clone = o => JSON.parse(JSON.stringify(o));
const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();

const medLabel = id => { const m = F[id]; return m.name + (m.brand ? ` (${m.brand})` : ''); };
const medDesc = id => { const m = F[id]; return m.desc || `${num(m.strength)} ${m.unit} ${m.form}`; };
const unitWord = (id, q) => { const f = F[id].form; const w = { tab: 'tab', cap: 'cap', vial: 'vial', Carpuject: 'Carpuject', syringe: 'syringe', pen: 'pen', neb: 'nebule', kit: 'kit' }[f] || f; return q === 1 ? w : w + 's'; };
const volOf = (id, amt) => { const m = F[id]; return m.volume ? amt * m.volume / m.strength : null; };
const amtText = (id, amt) => { const v = volOf(id, amt); return `${num(amt)} ${F[id].unit}` + (v != null ? ` (${num(v)} mL)` : ''); };
const allPatients = () => [...PATIENTS, ...((typeof db !== 'undefined' && db && db.tempPatients) || [])];
const PAT = id => allPatients().find(p => p.id === id);
const patName = p => `${p.last}, ${p.first} ${p.mi || ''}`.trim();
const age = dob => { if (!dob) return '?'; const b = new Date(dob), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const fmtDob = dob => { if (!dob) return 'Unknown'; const [y, m, d] = dob.split('-'); return `${m}/${d}/${y}`; };
const orderById = oid => { for (const p of PATIENTS) { const o = p.orders.find(x => x.id === oid); if (o) return o; } return null; };
const doseText = o => o.dose != null ? `${num(o.dose)}` : `${num(o.doseMin)}–${num(o.doseMax)}`;
const sig = o => `${doseText(o)} ${F[o.med].unit} ${F[o.med].route} ${o.freq}${o.prn ? ' PRN ' + o.prn : ''}`;
const freqHours = f => { const m = /^q(\d+)h/.exec(f); return m ? +m[1] : null; };
const userName = id => { const u = db.users[id]; return u ? `${u.last}, ${u.first} ${u.title || ''}`.trim() : id; };
const scenById = id => SCENARIOS.find(s => s.id === id);
const D = () => DEVICES[(db && db.settings.device) || 'pyxis'] || DEVICES.pyxis;
const T = k => D().L[k];
const OMNI_TEXT = [
  [/Waste Later &amp; resolve undocumented waste|Waste Later & resolve undocumented waste/g, 'Partial dose: waste it later from the Partial Dose List'],
  [/remove \+ Waste Now/g, 'remove + Waste Partial Dose'],
  [/Remove on <b>Override<\/b>\./g, 'Override it from the <b>Stocked Meds</b> tab.'],
  [/From Home, open <b>Discrepancies<\/b> and resolve with a recount, reason and witness/g, 'Press Main Menu → <b>Resolve Discrep</b>; use Cycle Count, a resolution reason and a witness'],
  [/Recount, pick the matching reason, add a comment, and have your witness co-sign\./g, 'Press Cycle Count, pick a reason from List of Resolve Reasons, press Resolve Discrep, and have your witness sign.'],
  [/Emergency \/ rapid response is the appropriate reason\./g, 'Emergency Situation is the appropriate reason.'],
  [/Home → My Patients → Edit/g, 'Patient list → My Patients tab → Edit My Patients'],
  [/From Home, open/g, 'From the patient list, open'],
  [/<b>Override<\/b>/g, '<b>Remove Meds → Stocked Meds</b>'],
  [/→ <b>Remove<\/b>/g, '→ <b>Remove Meds</b>'], [/<b>Remove<\/b>/g, '<b>Remove Meds</b>'], [/→ Remove\b/g, '→ Remove Meds'],
  [/<b>Return<\/b>/g, '<b>Return Meds</b>'], [/→ Waste\b/g, '→ Waste Meds'], [/<b>PRN<\/b> tab/g, '<b>PRN Only</b> tab'],
  [/<b>Undocumented Waste<\/b>/g, 'the <b>Partial Dose List</b> tab'], [/undocumented waste/gi, 'partial dose waste'],
  [/All Available Patients/g, 'Local List'],
  [/MiniDrawer pocket/g, 'FlexBin'], [/MiniDrawer/g, 'FlexBin'], [/the pocket/g, 'the bin'],
  [/<b>Waste Now<\/b>/g, '<b>Waste Partial Dose</b>'], [/Waste Now/g, 'Waste Partial Dose'], [/<b>Waste Later<\/b>/g, '<b>Close Bin</b> without wasting'], [/Waste Later/g, 'Close Bin without wasting'],
  [/Sign out of the MedStation/g, 'Press Exit to log off'], [/Sign out/g, 'Press Exit to log off'], [/sign out/g, 'press Exit to log off'], [/Sign in/g, 'Log on'], [/sign in/g, 'log on'],
  [/MedStation/g, 'cabinet'],
];
const devText = h => { h = String(h).replace(/\{DUE\}/g, hhmm(dueHourMs())); return D().key === 'omnicell' ? OMNI_TEXT.reduce((t, [a, b]) => t.replace(a, b), h) : h; };

/* ---------- persistent state ---------- */
let db;
// Pocket counts are random so every count has to be done for real.
function randomCount(m) { return m.controlled ? 3 + Math.floor(Math.random() * 12) : Math.max(8, m.count - 6 + Math.floor(Math.random() * 12)); }
function freshPractice(base = db) {
  base.base = Date.now();
  base.inventory = {}; base.physical = {};
  for (const [id, m] of Object.entries(F)) { const n = randomCount(m); base.inventory[id] = n; base.physical[id] = n + (m.physicalOffset || 0); }
  base.orders = {}; base.tx = []; base.removals = []; base.discrepancies = []; base.myPatients = {}; base.shortList = []; base.tempPatients = [];
  return base;
}
function freshDb() { return freshPractice({ v: 1, users: clone(USERS), settings: { challenge: false }, scen: null }); }
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v === 1) return d; } } catch {}
  return freshDb();
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch {} }
db = load();
// Keep the simulated shift current if the student comes back another day.
if (!db.settings.device) db.settings.device = 'pyxis';
if (!db.tempPatients) db.tempPatients = [];
// Practice passwords never change: always restore the published ones.
for (const [id, u] of Object.entries(USERS)) db.users[id] = { ...(db.users[id] || u), password: u.password, bioid: true, mustChange: false };
if (Date.now() - db.base > 30 * MIN) { db.base = Date.now(); db.orders = {}; }

const session = { user: null, screen: 'standby', listTab: 'my', sel: null, mode: 'remove', tab: 'due', cart: [], reportAll: false };

/* ---------- scenario engine ---------- */
const hist = [];   // cabinet event history shown in the coach
function emit(type, data = {}) {
  const e = { type, ...data };
  if (window.ComboMed) window.ComboMed.event(e); // ClinicalCombo: report cabinet activity to the simulation
  if (!['cdc_shown', 'txn_done', 'prn_alert'].includes(type)) { hist.unshift({ t: Date.now(), e }); hist.length = Math.min(hist.length, 60); }
  practiceEvent(e);
  const sc = db.mode === 'scen' ? db.scen : null;
  if (!sc || sc.done) { renderCoachSoon(); return; }
  const S = scenById(sc.id);
  const addErr = msg => { if (!sc.errors.includes(msg)) sc.errors.push(msg); };
  if (S.patient && e.type === 'removed' && e.patient !== S.patient) addErr(`Removed ${medLabel(e.med)} for the wrong patient (${patName(PAT(e.patient))}).`);
  if (S.patient && e.type === 'patient_action' && e.patient !== S.patient && PAT(e.patient).nameAlert && PAT(S.patient).nameAlert)
    addErr('Selected the wrong patient with a similar name — verify two identifiers (name + DOB or MRN).');
  (S.errorRules || []).forEach(r => r.match(e) && addErr(r.msg));

  let idx = S.steps.findIndex((s, j) => j >= sc.step && s.match(e));
  while (idx !== -1) {
    for (let k = sc.step; k < idx; k++) sc.missed.push(k);
    sc.step = idx + 1;
    idx = (sc.step < S.steps.length && S.steps[sc.step].match(e)) ? sc.step : -1;
  }
  if (sc.step >= S.steps.length) {
    sc.done = true; sc.end = Date.now();
    setTimeout(() => toast('Scenario complete — see your results in the Practice Coach.', 'good', () => $('#coach').scrollIntoView({ behavior: 'smooth' })), 400);
  }
  save(); renderCoach();
}

function startScenario(id) {
  const S = scenById(id);
  if (S.device && db.settings.device !== S.device) { db.settings.device = S.device; toast(`This scenario uses the ${DEVICES[S.device].model} cabinet — switched for you.`); }
  freshPractice();
  // Later scenarios assume the student already has My Patients set up.
  if (id !== 's1') db.myPatients.student = ['P1', 'P2', 'P3', 'P4'];
  db.scen = { id, step: 0, missed: [], errors: [], start: Date.now(), done: false };
  db.mode = 'scen'; session.hintsShown = 0; session.showDebrief = false;
  ((S.seed && S.seed.removals) || []).forEach(x => seedRemoval(x));
  save();
  cancelFlows();
  session.user = null; session.sel = null; session.cart = [];
  go('standby');
  toast(`Scenario started: ${S.title}`);
}

/* ---------- DOM refs ---------- */
const screenEl = $('#screen'), topbar = $('#topbar'), titlebar = $('#titlebar'), content = $('#content'), actionbar = $('#actionbar'), overlay = $('#overlay');
const sidel = $('#sidel'), tabsbar = $('#tabsbar'), hintbar = $('#hintbar');

/* ---------- pending-input machinery (for step-by-step flows and modals) ---------- */
const pend = [];
function waitIn(root, validate) { return new Promise(resolve => pend.push({ root, resolve, validate })); }
function formData(root) {
  const d = {};
  root.querySelectorAll('input, select, textarea').forEach(el => {
    const k = el.name || el.id; if (!k) return;
    if (el.type === 'radio') { if (el.checked) d[k] = el.value; else if (!(k in d)) d[k] = ''; }
    else if (el.type === 'checkbox') d[k] = el.checked;
    else d[k] = el.value.trim();
  });
  return d;
}
function showErr(root, msg) { const el = root.querySelector('.err'); if (el) { el.textContent = msg; el.hidden = false; } }
function cancelFlows() { pend.length = 0; overlay.hidden = true; overlay.innerHTML = ''; }

function btns(list) {
  return list.map(b => `<button type="button" class="btn ${b.cls || (b.primary ? 'primary' : '')}" data-resolve="${esc(b.value)}"${b.primary ? ' data-primary' : ''}${b.novalidate ? ' data-novalidate' : ''}${b.disabled ? ' disabled' : ''}>${b.label}</button>`).join('');
}
function modal({ title, body, buttons, validate, cls = '', after }) {
  overlay.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">${title}</h2><div class="modal-body">${body}</div><div class="err" role="alert" hidden></div><div class="modal-btns">${btns(buttons)}</div></div>`;
  overlay.hidden = false;
  const first = overlay.querySelector('input:not([type=radio]):not([type=hidden]), select, textarea') || overlay.querySelector('[data-primary]');
  if (first) setTimeout(() => first.focus(), 30);
  if (/\balert\b/.test(cls)) buzz([60, 50, 60]);
  if (after) after();
  return waitIn(overlay, validate).then(r => { overlay.hidden = true; overlay.innerHTML = ''; return r; });
}
function step({ title, body, buttons, validate, after, left = '', tabs = '', hint = '' }) {
  screenEl.className = 'screen dev-' + D().key;
  titlebar.innerHTML = titleHtml(title);
  sidel.innerHTML = left; tabsbar.innerHTML = tabs; hintbar.innerHTML = hint;
  content.innerHTML = body + '<div class="err" role="alert" hidden></div>';
  if (body.includes('drawer-view')) buzz([20, 40, 20]);
  content.scrollTop = 0;
  actionbar.innerHTML = btns(buttons);
  topbar.innerHTML = renderTopbar();
  if (after) after();
  const first = content.querySelector('input:not([type=radio]), select');
  if (first) setTimeout(() => first.focus(), 30);
  return waitIn(screenEl, validate);
}
const info = (title, body, label = 'OK', cls = '') => modal({ title, body, cls, buttons: [{ label, value: 'ok', primary: true }] });

/* Haptics: short vibrations on phones/tablets that support them (Android browsers; iPhone Safari ignores this). */
function buzz(pattern = 10) {
  if (db && db.settings && db.settings.haptics === false) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}
function toast(msg, kind = '', onClick) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg; t.setAttribute('role', 'status');
  if (onClick) { t.style.cursor = 'pointer'; t.addEventListener('click', onClick); }
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  box.appendChild(t);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3600);
}

/* ---------- global event delegation ---------- */
document.addEventListener('click', e => {
  if (e.target.closest('button:not(:disabled), .btn')) buzz(8);
  const r = e.target.closest('[data-resolve]');
  if (r && !r.disabled) {
    const p = [...pend].reverse().find(p => p.root.contains(r));
    if (p) {
      const value = r.dataset.resolve, data = formData(p.root);
      if (p.validate && !r.hasAttribute('data-novalidate')) {
        const err = p.validate(value, data);
        if (err) { showErr(p.root === screenEl && !overlay.contains(r) ? content : p.root, err); return; }
      }
      pend.splice(pend.indexOf(p), 1);
      p.resolve({ value, data });
      return;
    }
  }
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled && ACT[a.dataset.act]) { e.preventDefault(); ACT[a.dataset.act](a.dataset, a); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
  if (e.target.matches('[data-scanner]')) { e.preventDefault(); finishScan(e.target); return; }
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') return;
  const root = overlay.contains(e.target) ? overlay : screenEl;
  const b = root.querySelector('[data-primary]:not([disabled])');
  if (b) { e.preventDefault(); b.click(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.filter != null) {
    const q = t.value.trim().toLowerCase();
    content.querySelectorAll('[data-filterable]').forEach(r => { r.hidden = q && !r.dataset.filterable.toLowerCase().includes(q); });
  }
  if (t.dataset.volfor) {
    const out = t.closest('.modal, .content').querySelector('.vol-out');
    const v = parseFloat(t.value);
    if (out) out.textContent = isNaN(v) ? '' : (volOf(t.dataset.volfor, v) != null ? `= ${num(volOf(t.dataset.volfor, v))} mL` : '');
  }
});

/* ---------- simulated fingerprint scanner ---------- */
const FINGERPRINT_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 46c2-5 3-9 3-14a11 11 0 0 1 22 0c0 6-1 11-3 15"/><path d="M26 50c2-5 3-11 3-18a3 3 0 0 1 6 0c0 8-1 14-4 20"/><path d="M12 38c1-3 1-4 1-7a19 19 0 0 1 38 0c0 4 0 8-1 11"/><path d="M36 54c2-4 3-8 3.5-12"/><path d="M16 17a22 22 0 0 1 32 0"/><path d="M20 12a26 26 0 0 1 24 0"/></g></svg>`;
function scannerHtml(msg) {
  return `<div class="scanner-wrap"><div class="scanner" data-scanner tabindex="0" role="button" aria-label="Fingerprint scanner. Press and hold, or press Enter.">${FINGERPRINT_SVG}<span class="scan-ring"></span></div>
    <p class="scan-msg">${msg}</p><button type="button" hidden data-resolve="scan-ok" data-novalidate></button><button type="button" hidden data-resolve="scan-fail" data-novalidate></button></div>`;
}
let scanTimer = null;
function finishScan(el) { buzz([30, 50, 30]); el.classList.remove('pressing'); el.classList.add('ok'); setTimeout(() => el.closest('.scanner-wrap')?.querySelector('[data-resolve="scan-ok"]')?.click(), 350); }
document.addEventListener('pointerdown', e => {
  const s = e.target.closest('[data-scanner]'); if (!s || s.classList.contains('ok')) return;
  e.preventDefault(); s.classList.add('pressing'); buzz(15);
  scanTimer = setTimeout(() => { scanTimer = null; finishScan(s); }, D().key === 'omnicell' ? 2000 : 1400);
});
const liftFinger = () => {
  const s = document.querySelector('[data-scanner].pressing'); if (!s || !scanTimer) return;
  clearTimeout(scanTimer); scanTimer = null; s.classList.remove('pressing'); buzz(120);
  s.closest('.scanner-wrap')?.querySelector('[data-resolve="scan-fail"]')?.click();
};
document.addEventListener('pointerup', liftFinger);
document.addEventListener('pointercancel', liftFinger);
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-scanner]')) e.preventDefault(); });


/* ---------- screen chrome ---------- */
function titleHtml(t) { return t ? `<h1>${t}</h1>` : ''; }
function undocFor(userId) { return db.removals.filter(r => r.undocumented && r.user === userId); }
function renderTopbar() {
  const now = Date.now();
  if (D().key === 'omnicell') {
    const d = new Date(now), u = session.user;
    return `<span class="of-time"><span class="clock" data-fmt="colon">${clockText(now, 'colon')}</span> ${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)}</span>
      <span class="of-brand">Color Touch · ${D().station}</span><span class="of-user">${u ? esc(`${db.users[u].first} ${db.users[u].last}`) : ''}</span>
      <button class="btn of-exit" data-act="${u ? 'signout' : 'noop'}"${u ? '' : ' disabled'}>Exit</button>`;
  }
  const u = session.user;
  const undoc = u ? undocFor(u).length : 0;
  const disc = db.discrepancies.filter(d => !d.resolved).length;
  return `<div class="tb-device"><b>${D().station}</b><span>${D().name} · 4 West Med-Surg</span></div>
    <div class="tb-clock" aria-label="Current time"><span class="clock" data-fmt="mil">${clockText(now, 'mil')}</span><span class="tb-date">${dateStr(now)}</span></div>
    <div class="tb-user">
      ${disc ? `<button class="ind ind-disc" data-act="go" data-to="disc" title="Unresolved discrepancy" aria-label="Unresolved discrepancies: ${disc}">Δ ${disc}</button>` : ''}
      ${undoc ? `<button class="ind ind-waste" data-act="go" data-to="undoc" title="${T('undoc')}" aria-label="${T('undoc')}: ${undoc}">W ${undoc}</button>` : ''}
      ${u ? `<span class="tb-name">${esc(userName(u))}</span><button class="btn small ghost" data-act="home">Home</button><button class="btn small signout" data-act="signout">Sign Out</button>` : ''}
    </div>`;
}
// Live clocks: every element with class "clock" ticks each second.
function clockText(t) { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
setInterval(() => { const now = Date.now(); document.querySelectorAll('.clock[data-fmt]').forEach(c => { c.innerHTML = clockText(now, c.dataset.fmt); }); }, 1000);

function go(screen, extra = {}) { Object.assign(session, extra); session.screen = screen; render(); }
function render() {
  cancelFlows();
  const out = ((D().key === 'omnicell' && OMNI[session.screen]) || SCREENS[session.screen] || SCREENS.standby)();
  screenEl.className = `screen dev-${D().key} ` + (out.cls || '');
  topbar.innerHTML = renderTopbar();
  titlebar.innerHTML = titleHtml(out.title);
  content.innerHTML = out.body;
  actionbar.innerHTML = out.footer || '';
  sidel.innerHTML = out.left || ''; tabsbar.innerHTML = out.tabs || ''; hintbar.innerHTML = out.hint || '';
  content.scrollTop = 0;
  save();
  renderCoach();
}

/* ---------- order status (real clock) ----------
 * Scheduled doses fall on the hour nearest to when the student started ("due now"),
 * a past-due dose two hours earlier, and later doses whole hours ahead.
 * A dose is on time within 60 minutes of its scheduled time. */
function dueHourMs() { const d = new Date(db.base); d.setMinutes(d.getMinutes() >= 30 ? 60 : 0, 0, 0); return d.getTime(); }
function dueTime(o) { const h = o.dueIn < -30 ? -2 : Math.round(o.dueIn / 60); return dueHourMs() + h * HOUR; }
function refreshShift() { if (Date.now() - db.base > 30 * MIN) { db.base = Date.now(); db.orders = {}; } }
function orderStatus(o) {
  const st = db.orders[o.id] || {};
  if (o.prn) return { kind: 'prn', last: st.lastRemoved, by: st.by };
  const due = dueTime(o);
  if (st.given) return { kind: 'given', due, at: st.given, by: st.by };
  const diff = (due - Date.now()) / MIN;
  if (diff < -60) return { kind: 'pastdue', due };
  if (diff <= 60) return { kind: 'due', due };
  return { kind: 'future', due };
}
function patientCounts(p) {
  let due = 0, past = false, prn = 0;
  p.orders.forEach(o => { const s = orderStatus(o); if (s.kind === 'due' || s.kind === 'pastdue') due++; if (s.kind === 'pastdue') past = true; if (s.kind === 'prn') prn++; });
  return { due, past, prn, all: p.orders.length };
}
const allergyText = p => p.allergyUnknown ? 'Unknown — check MAR' : p.allergies.length ? p.allergies.map(a => `${a.agent} (${a.reaction})`).join(', ') : 'NKDA';

function patientBanner(p) {
  return `<div class="pt-banner">
    <div class="pt-id"><b>${esc(patName(p))}</b>${p.nameAlert ? '<span class="chip alert">NAME ALERT</span>' : ''}${p.temp ? '<span class="chip temp">TEMPORARY</span>' : ''}
      <span class="muted">MRN <span class="mono">${p.mrn}</span> · DOB <span class="mono">${fmtDob(p.dob)}</span> (${age(p.dob)} y, ${p.sex}) · Rm <span class="mono">${p.room}</span></span></div>
    <div class="pt-allergy ${p.allergies.length ? 'has' : ''}"><b>Allergies:</b> ${esc(allergyText(p))}</div>
    <div class="pt-dx muted">${esc(p.dx)} · ${esc(p.provider)}</div>
  </div>`;
}

/* ---------- drawer / cabinet graphics ---------- */
const POCKETS = {
  MiniDrawer: ['1', '2', '3', '4', '5', '6', '7', '8'],
  Matrix: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  CUBIE: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'],
  Fridge: ['1', '2', '3', '4', '5', '6'],
};
function locText(id) {
  const L = F[id].loc;
  return L.type === 'Fridge' ? `Refrigerator · ${D().key === 'omnicell' ? 'Locking' : 'Secure'} Bin ${L.pocket}` : `Main · Drawer ${L.drawer} · ${D().types[L.type]} · ${D().pocket} ${L.pocket}`;
}
function unitIcon(id) {
  const f = F[id].form;
  const cls = { tab: 'pill', cap: 'cap', Carpuject: 'syr', syringe: 'syr', vial: 'vial', pen: 'pen', neb: 'neb', kit: 'kit', bag: 'bag' }[f] || 'pill';
  return `<i class="u u-${cls}"></i>`;
}
function drawerView(id, { contents = 'label', note = '' } = {}) {
  const L = F[id].loc;
  const cab = `<div class="cabinet" aria-hidden="true">
      <div class="cab-col"><div class="cab-top">Main</div>${[1, 2, 3, 4, 5, 6].map(n => `<div class="cab-drawer ${L.drawer === n ? 'lit' : ''}">${n}</div>`).join('')}</div>
      <div class="cab-col side"><div class="cab-fridge ${L.drawer === 'F' ? 'lit' : ''}">Fridge</div><div class="cab-return">Return<br>Bin</div></div>
    </div>`;
  const grid = `<div class="pocket-grid t-${L.type}" aria-hidden="true">${POCKETS[L.type].map(pk => `<div class="pocket ${String(L.pocket) === pk ? 'open' : ''}">${pk}</div>`).join('')}</div>`;
  const n = Math.max(0, db.physical[id]);
  let inner = '';
  if (contents === 'items') inner = `<div class="pocket-zoom" role="img" aria-label="Open pocket containing ${n} ${unitWord(id, n)}">${n ? Array.from({ length: Math.min(n, 60) }, () => unitIcon(id)).join('') : '<span class="muted">Empty</span>'}</div>`;
  else inner = `<div class="pocket-zoom label"><b>${esc(medLabel(id))}</b><span>${esc(medDesc(id))}</span></div>`;
  return `<div class="drawer-view">
      <div class="dv-loc"><span class="light"></span><div><b>${locText(id)}</b><span class="muted">${L.type === 'Fridge' ? 'The refrigerator bin light is on.' : D().openMsg}</span></div></div>
      <div class="dv-art">${cab}<div class="dv-drawer"><div class="dv-drawer-label">${L.type === 'Fridge' ? 'Refrigerator bins' : 'Drawer ' + L.drawer + ' · ' + D().types[L.type]}</div>${grid}</div><div class="dv-pocket"><div class="dv-drawer-label">${D().pocket} ${L.pocket}</div>${inner}</div></div>
      ${note}
    </div>`;
}

/* ---------- screens ---------- */
const SCREENS = {
  standby() {
    return { cls: 'standby', body: `<button class="standby-btn" data-act="signin">
        <span class="sb-kicker">${D().station} · 4 West Medical-Surgical</span>
        <span class="sb-title">${D().name}</span>
        <span class="sb-sub">Touch the screen to sign in</span>
        <span class="sb-time mono clock" data-fmt="colon">${clockText(Date.now())}</span>
      </button>` };
  },

  home() {
    const u = session.user;
    const my = (db.myPatients[u] || []).length;
    const undoc = undocFor(u).length;
    const disc = db.discrepancies.filter(d => !d.resolved).length;
    const tile = (act, to, label, sub, extra = '', badge = '') => `<button class="tile ${extra}" data-act="${act}" data-to="${to}"><span class="t-label">${label}</span><span class="t-sub">${sub}</span>${badge}</button>`;
    return { title: 'Home', body: `
      ${undoc ? `<button class="banner blue" data-act="go" data-to="undoc"><b>You have ${T('undoc').toLowerCase()}.</b> Select to document it now (${undoc}).</button>` : ''}
      ${disc ? `<button class="banner red" data-act="go" data-to="disc"><b>Unresolved discrepancy on this device.</b> Resolve before the end of your shift.</button>` : ''}
      <div class="tiles">
        ${tile('list', 'my', 'My Patients', my ? `${my} patient${my > 1 ? 's' : ''} on your list` : 'Build your assignment list')}
        ${tile('list', 'all', T('allPts'), `${allPatients().length} patients on 4 West`)}
        ${tile('go', 'undoc', T('undoc'), undoc ? `${undoc} to document` : 'Nothing pending', undoc ? 'warn' : '', undoc ? `<span class="badge">${undoc}</span>` : '')}
        ${tile('go', 'disc', 'Discrepancies', disc ? `${disc} unresolved` : 'None open', disc ? 'danger' : '', disc ? `<span class="badge red">${disc}</span>` : '')}
        ${tile('go', 'find', T('find'), 'Locate any medication')}
        ${tile('go', 'reports', 'Reports', 'Activity by user or patient')}
      </div>` };
  },

  patients() {
    const u = session.user;
    const my = session.listTab === 'my';
    const ids = my ? (db.myPatients[u] || []) : allPatients().map(p => p.id);
    const list = ids.map(PAT).filter(Boolean).sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
    const sel = list.find(p => p.id === session.sel) ? session.sel : null;
    const rows = list.map(p => {
      const undoc = db.removals.some(r => r.undocumented && r.patient === p.id);
      return `<div class="prow ${sel === p.id ? 'sel' : ''}" data-filterable="${esc(p.last + ' ' + p.first + ' ' + p.room + ' ' + p.mrn)}">
        <button class="prow-main" data-act="selPatient" data-id="${p.id}" aria-pressed="${sel === p.id}">
          <span class="pr-name"><span class="pr-title"><b>${esc(patName(p))}</b>${p.nameAlert ? ' <span class="chip alert">NAME ALERT</span>' : ''}${p.temp ? ' <span class="chip temp">TEMPORARY</span>' : ''}${p.allergies.length ? ' <span class="chip allergy">ALLERGY</span>' : ''}${undoc ? ' <span class="chip waste">UNDOC WASTE</span>' : ''}</span>
            <span class="muted small">${age(p.dob)} y (${fmtDob(p.dob)}) ${p.sex}<span class="rm-inline"> · <span class="mono">${p.mrn}</span> · <span class="mono">${p.room}</span></span></span></span>
          <span class="pr-visit mono">${p.mrn}</span>
          <span class="pr-room mono">${p.room}</span>
        </button>
      </div>`;
    }).join('');
    const dis = sel ? '' : ' disabled';
    return { title: my ? 'My Patients' : T('allPts'), body: `
      <div class="seg" role="tablist"><button class="${my ? 'on' : ''}" data-act="list" data-to="my" role="tab" aria-selected="${my}">My Patients</button><button class="${!my ? 'on' : ''}" data-act="list" data-to="all" role="tab" aria-selected="${!my}">${T('allPts')}</button></div>
      <div class="list-tools"><input id="ptsearch" type="search" placeholder="Search last name, room or MRN" data-filter aria-label="Search patients">
        ${my ? '<button class="btn" data-act="go" data-to="editMy">Edit Patient List</button>' : '<button class="btn" data-act="addTemp">Add Temporary Patient</button>'}</div>
      ${list.length ? `<div class="ptable"><div class="phead"><span>Name</span><span>Visit ID</span><span>Location</span></div>${rows}</div>`
      : `<div class="empty"><b>Your My Patients list is empty.</b><p>Select <b>Edit Patient List</b> and add the patients you are assigned to today.</p><button class="btn primary" data-act="go" data-to="editMy">Edit Patient List</button></div>`}`,
      footer: `<button class="btn" data-act="pa" data-a="remove"${dis}>${T('remove')}</button><button class="btn" data-act="pa" data-a="past"${dis}>${T('past')}</button><button class="btn" data-act="pa" data-a="waste"${dis}>Waste</button><button class="btn" data-act="pa" data-a="return"${dis}>Return</button><button class="btn override" data-act="pa" data-a="override"${dis}>Override</button>` };
  },

  editMy() {
    const u = session.user;
    if (!session.editList) session.editList = [...(db.myPatients[u] || [])];
    const mine = session.editList;
    return { title: 'Edit My Patients', body: `<p class="muted">Tap a patient on the left to add them to your list. Tap × to remove.</p>
      <div class="two-col">
        <div><h3>${T('allPts')}</h3>${allPatients().map(p => `<button class="pick ${mine.includes(p.id) ? 'added' : ''}" data-act="addMy" data-id="${p.id}"${mine.includes(p.id) ? ' disabled' : ''}><b>${esc(patName(p))}</b> <span class="mono muted">${p.room}</span>${p.nameAlert ? ' <span class="chip alert">NAME ALERT</span>' : ''}</button>`).join('')}</div>
        <div><h3>My Patients (${mine.length})</h3>${mine.length ? mine.map(id => { const p = PAT(id); return `<div class="pick in"><span><b>${esc(patName(p))}</b> <span class="mono muted">${p.room}</span></span><button class="x" data-act="delMy" data-id="${id}" aria-label="Remove ${esc(patName(p))}">×</button></div>`; }).join('') : '<p class="muted">No patients yet.</p>'}</div>
      </div>`,
      footer: `<button class="btn" data-act="cancelMy">Cancel</button><button class="btn primary" data-act="saveMy">Accept</button>` };
  },

  profile() {
    const p = PAT(session.sel);
    const ov = session.mode === 'override';
    const cart = session.cart;
    let listHtml;
    if (!ov) {
      // Non-profile style: only this patient's orders, alphabetical, with no due times or due markers.
      // Due times live on the MAR in the EMR; the cabinet still warns on early, repeat or too-soon removals.
      const orders = [...p.orders].sort((a, b) => F[a.med].name.localeCompare(F[b.med].name));
      listHtml = orders.length ? orders.map(o => {
        const m = F[o.med];
        const when = `<span class="due">${esc(m.route)}</span>`;
        const inCart = cart.some(c => c.orderId === o.id);
        return `<button class="mrow ${inCart ? 'incart' : ''}" data-act="pickOrder" data-id="${o.id}" data-filterable="${esc(m.name + ' ' + m.brand)}">
          <span class="m-name"><b>${esc(medLabel(o.med))}</b> <span class="muted">${esc(medDesc(o.med))}</span>
            <span class="m-sig">${esc(sig(o))}</span>
            <span class="chips">${m.controlled ? `<span class="chip cs">${m.controlled}</span>` : ''}${o.dose == null ? '<span class="chip">RANGE DOSE</span>' : ''}${m.loc.type === 'Fridge' ? '<span class="chip fridge">REFRIGERATED</span>' : ''}</span></span>
          <span class="m-when">${when}</span></button>`;
      }).join('') : '<p class="empty-line">No active orders for this patient.</p>';
    } else {
      const meds = Object.keys(F).filter(id => F[id].override).sort((a, b) => F[a].name.localeCompare(F[b].name));
      listHtml = meds.map(id => { const m = F[id]; return `<button class="mrow override-row ${cart.some(c => c.med === id && c.override) ? 'incart' : ''}" data-act="pickOverride" data-id="${id}" data-filterable="${esc(m.name + ' ' + m.brand)}">
        <span class="stripes" aria-hidden="true"></span>
        <span class="m-name"><b>${esc(medLabel(id))}</b> <span class="muted">${esc(medDesc(id))}</span><span class="chips">${m.controlled ? `<span class="chip cs">${m.controlled}</span>` : ''}<span class="chip ov">OVERRIDE</span></span></span>
        <span class="m-when"><span class="due">${m.route}</span></span></button>`; }).join('');
    }
    const cartHtml = cart.length ? cart.map((c, i) => `<div class="cart-item ${c.override ? 'ov' : ''}"><div><b>${esc(medLabel(c.med))}</b><span class="muted">${esc(medDesc(c.med))}</span>
        <span>Dose <b>${num(c.dose)} ${F[c.med].unit}</b> · Remove <b>${c.qty} ${unitWord(c.med, c.qty)}</b>${c.override ? ' · <span class="ovtxt">Override</span>' : ''}</span></div>
        <button class="x" data-act="unpick" data-i="${i}" aria-label="Remove ${esc(medLabel(c.med))} from selected meds">×</button></div>`).join('') : '<p class="muted">Select medications on the left. They will appear here.</p>';
    return { title: ov ? `Override — ${T('remove').toLowerCase()} without pharmacist review` : T('removing'), cls: ov ? 'mode-override' : '', body: `${patientBanner(p)}
      ${ov ? '<p class="warnline">Override bypasses pharmacist order review. Use it only for emergencies or when the order cannot be verified in time. Striped items are override medications.</p>' : ''}
      <div class="profile">
        <section class="plist">
          <input type="search" id="medsearch" placeholder="Type the first 3 letters of the medication" data-filter aria-label="Search medications">
          <div class="mlist">${listHtml}</div>
        </section>
        <aside class="cart"><h3>${T('selected')} <span class="muted">(${cart.length})</span></h3>${cartHtml}</aside>
      </div>`,
      footer: `<button class="btn" data-act="backList">Back</button>${ov ? `<button class="btn" data-act="mode" data-m="remove">${T('profile')}</button>` : '<button class="btn override" data-act="mode" data-m="override">Override</button>'}<button class="btn" data-act="kitsModal">System Kits</button><button class="btn primary" data-act="removeMeds"${cart.length ? '' : ' disabled'}>${T('removeMed')}</button>` };
  },

  returns() {
    const p = PAT(session.sel);
    const recent = db.removals.filter(r => r.patient === p.id && Date.now() - r.t < 24 * HOUR).sort((a, b) => b.t - a.t);
    const rows = recent.map(r => {
      const left = r.qty - r.returnedQty;
      const why = left <= 0 ? 'Already returned' : r.wasted > 0 ? 'Opened/partially used — waste documented. Cannot return.' : '';
      return `<button class="mrow ${why ? 'dim' : ''}" data-act="${why ? 'why' : 'doReturn'}" data-id="${r.id}" data-why="${esc(why)}">
        <span class="m-name"><b>${esc(medLabel(r.med))}</b> <span class="muted">${esc(medDesc(r.med))}</span><span class="m-sig">Removed ${r.qty} ${unitWord(r.med, r.qty)} at ${hhmm(r.t)} by ${esc(userName(r.user))}</span>${why ? `<span class="muted small">${why}</span>` : ''}</span>
        <span class="m-when">${F[r.med].controlled ? `<span class="chip cs">${F[r.med].controlled}</span>` : ''}</span></button>`;
    }).join('');
    return { title: 'Return Medication', body: `${patientBanner(p)}<p class="muted">Return an item only if its sealed packaging has not been opened. Removals from the past 24 hours are listed. Dimmed items cannot be returned — select one to see why.</p><div class="mlist">${rows || '<p class="empty-line">No removals for this patient in the last 24 hours.</p>'}</div>`,
      footer: `<button class="btn" data-act="backList">Back</button>` };
  },

  waste() {
    const p = PAT(session.sel);
    const recent = db.removals.filter(r => r.patient === p.id && F[r.med].controlled && Date.now() - r.t < 32 * HOUR).sort((a, b) => b.t - a.t);
    const rows = recent.map(r => {
      const left = Math.max(0, r.expectedWaste - r.wasted);
      return `<button class="mrow" data-act="doWaste" data-id="${r.id}">
        <span class="m-name"><b>${esc(medLabel(r.med))}</b> <span class="muted">${esc(medDesc(r.med))}</span><span class="m-sig">Removed ${r.qty} ${unitWord(r.med, r.qty)} at ${hhmm(r.t)} · dose ${num(r.dose)} ${F[r.med].unit} · by ${esc(userName(r.user))}</span>
          ${r.undocumented ? `<span class="chip waste">UNDOCUMENTED WASTE ${db.settings.challenge ? '' : amtText(r.med, left)}</span>` : r.wasted ? `<span class="muted small">Wasted ${amtText(r.med, r.wasted)}</span>` : ''}</span>
        <span class="m-when"><span class="chip cs">${F[r.med].controlled}</span></span></button>`;
    }).join('');
    return { title: 'Waste Medication', body: `${patientBanner(p)}<p class="muted">Controlled-substance removals from the past 32 hours. Select the medication to waste. A witness must watch the waste.</p><div class="mlist">${rows || '<p class="empty-line">No controlled-substance removals for this patient.</p>'}</div>`,
      footer: `<button class="btn" data-act="backList">Back</button><button class="btn" data-act="searchAllWaste">Search All Meds</button>` };
  },

  past() {
    const p = PAT(session.sel);
    const list = db.tx.filter(t => t.patient === p.id).sort((a, b) => b.t - a.t);
    return { title: T('past'), body: `${patientBanner(p)}${txTable(list)}`, footer: `<button class="btn" data-act="backList">Back</button>` };
  },

  undoc() {
    const list = undocFor(session.user);
    return { title: T('undoc'), body: `<p class="muted">These controlled-substance removals left an unused portion that you have not documented. Select one and waste it with a witness.</p>
      <div class="mlist">${list.map(r => { const p = PAT(r.patient); const left = r.expectedWaste - r.wasted; return `<button class="mrow" data-act="doWaste" data-id="${r.id}">
        <span class="m-name"><b>${esc(patName(p))}</b> <span class="mono muted">${p.room}</span><span class="m-sig">${esc(medLabel(r.med))} ${esc(medDesc(r.med))} · removed ${hhmm(r.t)} · dose ${num(r.dose)} ${F[r.med].unit}</span></span>
        <span class="m-when"><span class="chip waste">${db.settings.challenge ? 'WASTE DUE' : amtText(r.med, left)}</span></span></button>`; }).join('') || '<p class="empty-line">No undocumented waste. Nice work.</p>'}</div>`,
      footer: `<button class="btn" data-act="home">Home</button>` };
  },

  disc() {
    const open = db.discrepancies.filter(d => !d.resolved), done = db.discrepancies.filter(d => d.resolved);
    const row = d => `<button class="mrow ${d.resolved ? 'dim' : ''}" data-act="${d.resolved ? 'noop' : 'resolveDisc'}" data-id="${d.id}">
      <span class="m-name"><b>${esc(medLabel(d.med))}</b> <span class="muted">${esc(medDesc(d.med))}</span><span class="m-sig">${locText(d.med)} · expected ${d.expected}, counted ${d.counted} · ${hhmm(d.t)} by ${esc(userName(d.user))}</span>${d.resolved ? `<span class="muted small">Resolved: ${esc(d.reason)} · witness ${esc(userName(d.witness))}</span>` : ''}</span>
      <span class="m-when">${d.resolved ? '<span class="chip">RESOLVED</span>' : '<span class="chip alert">OPEN</span>'}</span></button>`;
    return { title: 'Discrepancies', body: `<p class="muted">A discrepancy is created when a blind count does not match the expected inventory. The nurse who discovers it starts the resolution. Resolve open discrepancies before the end of your shift.</p>
      <div class="mlist">${open.map(row).join('') || '<p class="empty-line">No open discrepancies.</p>'}</div>${done.length ? `<h3>Resolved</h3><div class="mlist">${done.map(row).join('')}</div>` : ''}`,
      footer: `<button class="btn" data-act="home">Home</button>` };
  },

  find() {
    const ids = Object.keys(F).sort((a, b) => F[a].name.localeCompare(F[b].name));
    return { title: T('find'), body: `<input type="search" id="gfsearch" placeholder="Search medication (generic or brand)" data-filter aria-label="Search medications">
      <div class="mlist">${ids.map(id => { const m = F[id]; return `<div class="mrow static" data-filterable="${esc(m.name + ' ' + m.brand)}"><span class="m-name"><b>${esc(medLabel(id))}</b> <span class="muted">${esc(medDesc(id))}</span><span class="m-sig">${D().station} · ${locText(id)}</span><span class="chips">${m.controlled ? `<span class="chip cs">${m.controlled}</span>` : ''}${m.override ? '<span class="chip ov">OVERRIDE LIST</span>' : ''}</span></span><span class="m-when mono">On hand ${db.inventory[id]}</span></div>`; }).join('')}</div>`,
      footer: `<button class="btn" data-act="home">Home</button>` };
  },

  reports() {
    const list = db.tx.filter(t => session.reportAll || t.user === session.user).sort((a, b) => b.t - a.t);
    return { title: 'Reports', body: `<div class="seg small"><button class="${!session.reportAll ? 'on' : ''}" data-act="report" data-all="0">Activity by Current User</button><button class="${session.reportAll ? 'on' : ''}" data-act="report" data-all="1">All Activity (device)</button></div>
      ${txTable(list, true)}`,
      footer: `<button class="btn" data-act="home">Home</button><button class="btn" data-act="copyReport">Copy Report</button>${inFrame ? '' : '<button class="btn" data-act="print">Print</button>'}` };
  },

};

function txTable(list, showPatient = true) {
  if (!list.length) return '<p class="empty-line">No transactions yet.</p>';
  return `<div class="table-wrap"><table class="tx"><thead><tr><th>Time</th><th>Type</th>${showPatient ? '<th>Patient</th>' : ''}<th>Medication</th><th>Amount</th><th>User</th><th>Witness</th><th>Note</th></tr></thead><tbody>
    ${list.map(t => `<tr class="t-${t.type.toLowerCase()}"><td class="mono">${hhmm(t.t)}</td><td><span class="chip">${t.type.toUpperCase()}</span></td>${showPatient ? `<td>${t.patient ? esc(patName(PAT(t.patient))) : '—'}</td>` : ''}<td>${esc(medLabel(t.med))}<br><span class="muted small">${esc(medDesc(t.med))}</span></td><td class="mono">${esc(t.amount)}</td><td>${esc(userName(t.user))}</td><td>${t.witness ? esc(userName(t.witness)) : ''}</td><td class="small">${esc(t.note || '')}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function addTx(t) { db.tx.push({ id: uid(), t: Date.now(), user: session.user, ...t }); save(); }

/* ---------- actions ---------- */
const ACT = {
  signin: () => isOmni() ? omniSignIn() : signInFlow(),
  home: () => { session.editList = null; go('home'); },
  signout: () => signOut(),
  go: ds => go(ds.to),
  noop: () => {},
  openPt: ds => { session.sel = ds.id; go('pt'); },
  olist: ds => go('patients', { listTab: ds.t }),
  osort: () => { session.sortRoom = !session.sortRoom; render(); },
  otab: ds => { if (ds.t === 'stocked' && session.tab !== 'stocked') emit('patient_action', { patient: session.sel, action: 'override' }); session.tab = ds.t; render(); },
  pickStocked: ds => omniSelectStocked(ds.id),
  unpickKey: async ds => {
    const comp = session.cart.find(c => c.key === ds.key && c.nursePrep && session.cart.filter(x => x.group === c.group).length > 1);
    if (comp && (await modal({ title: 'Partial Issue', body: '<p>Removing one component of a nurse-prepared med order results in a <b>partial issue</b> of the order. Follow hospital policy.</p>', buttons: [{ label: 'Keep Component', value: 'no', primary: true }, { label: 'Remove Component', value: 'yes' }] })).value !== 'yes') return;
    session.cart = session.cart.filter(c => comp ? c.key !== ds.key : (c.key !== ds.key && c.group !== ds.key)); render(); },
  addTemp: () => addTempPatient(),
  kitsModal: () => kitsModal(),
  kitPick: ds => pickKit(ds.id).then(() => render()),
  cancelMedList: () => { session.cart = []; render(); },
  inactiveOrder: ds => { const o = orderById(ds.id); info('Inactive Med Order', `<p><b>${esc(medLabel(o.med))}</b> ${esc(sig(o))}</p><p>This med order cannot be issued because it is not time to administer it to the patient (next due ${hhmm(orderStatus(o).due)}).</p>`); },
  allergyInfo: () => { const p = PAT(session.sel); info('Allergy Info', p.allergies.length ? `<ul>${p.allergies.map(a => `<li><b>${esc(a.agent)}</b> — ${esc(a.reaction)}</li>`).join('')}</ul>` : '<p>No known allergies are displayed. Check the MAR.</p>'); },
  retTab: ds => { session.retAll = ds.all === '1'; render(); },
  wasteTab: ds => { session.wasteTab = ds.t; render(); },
  oRep: ds => { session.oRep = ds.t; render(); },
  kitTab: ds => { session.kitTab = ds.t; render(); },
  list: ds => go('patients', { listTab: ds.to }),
  selPatient: ds => { session.sel = ds.id; render(); },
  dot: ds => { session.sel = ds.id; patientAction('remove', ds.tab); },
  pa: ds => patientAction(ds.a),
  backList: () => go(isOmni() ? 'pt' : 'patients', { cart: [] }),
  tab: ds => { session.tab = ds.tab; render(); },
  mode: ds => { session.mode = ds.m; if (ds.m === 'remove' && !session.tab) session.tab = 'due'; if (ds.m === 'override') emit('patient_action', { patient: session.sel, action: 'override' }); render(); },
  addMy: ds => { if (!session.editList.includes(ds.id)) session.editList.push(ds.id); render(); },
  delMy: ds => { session.editList = session.editList.filter(x => x !== ds.id); render(); },
  cancelMy: () => { session.editList = null; go('patients', { listTab: 'my' }); },
  saveMy: () => { db.myPatients[session.user] = session.editList; emit('mypatients_saved', { ids: [...session.editList] }); session.editList = null; go('patients', { listTab: 'my' }); },
  pickOrder: ds => selectOrder(ds.id),
  pickOverride: ds => selectOverride(ds.id),
  unpick: ds => { session.cart.splice(+ds.i, 1); render(); },
  removeMeds: () => runRemoval(),
  doReturn: ds => returnFlow(db.removals.find(r => r.id === ds.id)),
  why: ds => info('Cannot Return', `<p>${esc(ds.why)}</p>`),
  doWaste: ds => { const r = db.removals.find(x => x.id === ds.id); wasteFlow(r).then(() => render()); },
  searchAllWaste: () => searchAllWaste(),
  resolveDisc: ds => resolveDiscrepancy(db.discrepancies.find(d => d.id === ds.id)),
  report: ds => { session.reportAll = ds.all === '1'; render(); },
  print: () => window.print(),
  copyReport: () => copyText(reportText()),
};

function signOut() {
  if (!session.user) return;
  emit('signout', {});
  cancelFlows();
  session.user = null; session.sel = null; session.cart = []; session.editList = null; session.alerted = null;
  go('standby');
}

async function patientAction(action, tab) {
  const p = PAT(session.sel); if (!p) return;
  if (p.nameAlert && session.alerted !== p.id) {
    await info('<span class="alert-title">Name Alert</span>', `<p>Another patient on this unit has a similar name.</p><p><b>${esc(patName(p))}</b><br>MRN <span class="mono">${p.mrn}</span> · DOB <span class="mono">${fmtDob(p.dob)}</span> · Room <span class="mono">${p.room}</span></p><p>Verify two patient identifiers before you continue.</p>`, 'I verified the patient', 'alert');
    session.alerted = p.id;
  }
  emit('patient_action', { patient: p.id, action });
  if (action === 'remove' || action === 'override') {
    session.mode = action; session.cart = [];
    const c = patientCounts(p);
    if (isOmni()) session.tab = c.due ? 'sched' : 'active';
    else session.tab = 'all';
    go('profile');
  } else if (action === 'kits') { session.cart = []; go('kits'); } else go({ return: 'returns', waste: 'waste', past: 'past' }[action]);
}

/* ---------- sign in ---------- */
// Practice credentials are shown right under each box (nothing needs to be remembered).
const cred = (label, value) => `<p class="cred-under">${label}: <b class="mono">${esc(value)}</b></p>`;

async function signInFlow() {
  let user;
  for (;;) {
    const r = await step({ title: 'Sign In', body: `<div class="signin">
        <label for="uid">User ID</label><input id="uid" autocomplete="off" autocapitalize="none" spellcheck="false">
        ${cred('Your user ID', 'student')}</div>`,
      buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Next', value: 'next', primary: true }],
      validate: (v, d) => !d.uid ? 'Enter your User ID.' : !db.users[d.uid.toLowerCase()] ? `User ID "${d.uid}" was not found. Type the user ID shown under the box.` : null });
    if (r.value === 'cancel') return go('standby');
    user = db.users[r.data.uid.toLowerCase()];
    break;
  }
  let method = null;
  if (user.bioid) method = await bioLogin(user);
  if (method === 'cancel') return go('standby');
  if (!method || method === 'password') {
    const ok = await passwordLogin(user);
    if (!ok) return go('standby');
    method = 'password';
  }
  session.user = user.id; session.loginMethod = method;
  emit('signin', { user: user.id, method });
  go('home');
  toast(`Signed in as ${userName(user.id)}`);
}

async function passwordLogin(user) {
  let tries = 0;
  const r = await step({ title: 'Sign In', body: `<div class="signin"><p>User ID <b class="mono">${esc(user.id)}</b></p>
      <label for="pw">Password</label><input id="pw" type="password" autocomplete="off">
      ${cred('Your password', user.password)}</div>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Sign In', value: 'ok', primary: true }],
    validate: (v, d) => { if (d.pw !== user.password) { tries++; return tries >= 3 ? 'Incorrect password again. In a real facility, repeated failures lock your account — contact pharmacy for a reset.' : 'Incorrect password. Passwords are case-sensitive.'; } return null; } });
  return r.value === 'ok';
}

async function bioLogin(user) {
  let fails = 0, msg = '<b>Touch and hold</b> the fingerprint scanner (on a computer, click and hold the mouse) until the ring fills.';
  for (;;) {
    const r = await step({ title: 'BioID Sign In', body: `<div class="signin center"><p>User ID <b class="mono">${esc(user.id)}</b></p>${scannerHtml(msg)}</div>`,
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Use Password', value: 'password' }] });
    if (r.value === 'cancel' || r.value === 'password') return r.value;
    if (r.value === 'scan-ok') return 'bioid';
    if (r.value === 'scan-fail') {
      fails++;
      if (fails >= 3) {
        await info('BioID Failed', '<p>The scanner could not verify your fingerprint after 3 attempts.</p><p>Sign in with your password. A witness may be required at some facilities. Common causes: finger not covering the lens, moving during the scan, cold or dry finger, lotion, gloves or a bandage.</p>');
        return 'password';
      }
      msg = `<span class="bad">Unable to verify your fingerprint (attempt ${fails} of 3).</span> Lift your finger, then cover the lens completely and hold still until the scan finishes.`;
    }
  }
}

// The witness walks up and signs with their fingerprint; the student does not type anyone's credentials.
async function witnessFlow(purpose) {
  const w = db.users.kjones, cab = isOmni() ? 'Omnicell' : 'Pyxis';
  const r = await modal({ title: 'Witness Required', body: `<p>${purpose}</p>
      <div class="witness-card"><span class="wc-avatar" aria-hidden="true">KJ</span><div><b>${esc(w.first)} ${esc(w.last)}, ${esc(w.title)}</b><span>comes to the ${cab} to witness for you.</span></div></div>
      <div class="witness-sign" id="wsign"><span class="wc-dot"></span><span>Scanning ${esc(w.first)}'s fingerprint…</span></div>
      <p class="muted small">The witness signs in with their own credentials and must watch the entire waste or return.</p>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Continue', value: 'ok', primary: true, disabled: true }] ,
    after: () => setTimeout(() => {
      const el = overlay.querySelector('#wsign'); if (!el) return;
      el.classList.add('done'); el.lastElementChild.textContent = `Signed: ${w.first} ${w.last}, ${w.title} (fingerprint verified)`;
      const b = overlay.querySelector('[data-resolve="ok"]'); if (b) { b.disabled = false; b.focus(); }
      buzz([25, 40, 25]);
    }, 1100) });
  return r.value === 'ok' ? w.id : null;
}

/* ---------- medication selection ---------- */

async function askDose(medId, { min, max, override }) {
  const m = F[medId];
  const r = await modal({ title: override ? 'Enter Amount to Administer' : 'Range Dose', body: `
      <p><b>${esc(medLabel(medId))}</b> · ${esc(medDesc(medId))}</p>
      ${override ? '<p class="muted">An override is not attached to a pharmacist-verified order, so the MedStation cannot calculate the dose. Enter the amount you will ADMINISTER.</p>'
        : `<p>Ordered range: <b>${num(min)}–${num(max)} ${m.unit}</b>. Enter the amount you will <b>ADMINISTER</b>. It must fall within the ordered range.</p>`}
      <label for="dose">Amount to administer (${m.unit})</label><div class="inline"><input id="dose" type="number" inputmode="decimal" step="any" ${override ? `value="${num(m.strength)}"` : ''}><span>${m.unit}</span></div>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'OK', value: 'ok', primary: true }],
    validate: (v, d) => { const x = parseFloat(d.dose); if (isNaN(x) || x <= 0) return 'Enter an amount greater than zero.'; if (!override && (x < min - 1e-9 || x > max + 1e-9)) return `The amount must be between ${num(min)} and ${num(max)} ${m.unit}.`; if (override && x > m.strength * 10) return 'That amount is unusually large. Check the dose.'; return null; } });
  if (r.value !== 'ok') return null;
  const dose = parseFloat(r.data.dose);
  emit('dose_entered', { med: medId, dose, patient: session.sel });
  return dose;
}

function cartItem(medId, dose, extra) {
  const m = F[medId];
  const qty = m.noSplit ? 1 : Math.max(1, Math.ceil(dose / m.strength - 1e-9));
  return { med: medId, dose, qty, key: (extra && extra.orderId) || 'ov-' + medId, ...extra };
}

async function selectOrder(oid) {
  const o = orderById(oid), p = PAT(session.sel), m = F[o.med];
  if (session.cart.some(c => c.orderId === oid)) return toast(`Already in ${T('selected')}.`);
  const s = orderStatus(o);
  const cont = async (title, body) => {
    emit('prn_alert', { med: o.med, patient: p.id });
    const go = (await modal({ title, cls: 'alert', body, buttons: [{ label: isOmni() ? 'OK' : 'Continue', value: 'go' }, { label: 'Cancel', value: 'no', primary: true }] })).value === 'go';
    if (!go) emit('prn_hold', { med: o.med, patient: p.id });
    return go;
  };
  if (isOmni()) {
    const h = freqHours(o.freq), last = s.kind === 'given' ? s.at : s.last;
    if (last && (s.kind === 'given' || (s.kind === 'prn' && h && Date.now() - last < h * HOUR)) &&
      !await cont('<span class="alert-title">Last Issued Alert</span>', `<p>This item was recently issued on <b>${oDate(last)}</b>. Do you want to continue?</p><p class="muted">Order: ${esc(o.freq)}${o.prn ? ' PRN' : ''}. Check the MAR before continuing.</p>`)) return;
  } else {
  if (s.kind === 'given' && !await cont('<span class="alert-title">Dose Already Removed</span>', `<p>This scheduled dose was removed at <b>${hhmm(s.at)}</b> by ${esc(userName(s.by))}. Removing it again could cause a <b>double dose</b>.</p><p class="muted">Check the MAR before continuing.</p>`)) return;
  if (s.kind === 'future' && !await cont('Early Removal', `<p>This dose is not due until <b>${hhmm(s.due)}</b>. Removing more than 60 minutes early is outside the administration window.</p>`)) return;
  if (s.kind === 'prn' && s.last) {
    const h = freqHours(o.freq);
    if (h && Date.now() - s.last < h * HOUR && !await cont('<span class="alert-title">Too Soon</span>', `<p>${esc(medLabel(o.med))} was last removed at <b>${hhmm(s.last)}</b>. The order is <b>${o.freq} PRN</b>; the next dose is available at <b>${hhmm(s.last + h * HOUR)}</b>.</p>`)) return;
  }
  }
  if (o.nursePrep) return selectNursePrep(o);
  let dose = o.dose;
  if (dose == null) { dose = await askDose(o.med, { min: o.doseMin, max: o.doseMax }); if (dose == null) return; }
  else if (isOmni() && !await omniConfirmQty(o.med, dose)) return;
  session.cart.push(cartItem(o.med, dose, { orderId: oid, override: false, note: '' }));
  render();
}

async function selectOverride(medId) {
  const p = PAT(session.sel);
  if (session.cart.some(c => c.med === medId && c.override)) return toast(`Already in ${T('selected')}.`);
  const allergy = p.allergies.find(a => (ALLERGY_CLASSES[a.key] || []).includes(medId));
  if (allergy) {
    const r = await modal({ title: '<span class="alert-title">Allergy Alert</span>', cls: 'alert', body: `<p><b>${esc(patName(p))}</b> has a documented allergy to <b>${esc(allergy.agent)}</b> (${esc(allergy.reaction)}).</p><p>You selected <b>${esc(medLabel(medId))}</b>.</p><p class="muted">Stop and clarify with the prescriber before giving any medication the patient is allergic to.</p>`,
      buttons: [{ label: 'Override Allergy', value: 'proceed', cls: 'danger' }, { label: 'Cancel Removal', value: 'cancel', primary: true }] });
    emit('allergy_alert', { patient: p.id, med: medId, action: r.value });
    if (r.value !== 'proceed') return toast('Removal cancelled. Clarify the order with the prescriber.');
  }
  const existing = p.orders.find(o => o.med === medId || F[o.med].name === F[medId].name);
  if (existing) {
    const r = await modal({ title: 'Order Exists', body: `<p>This patient already has an active, pharmacist-verified order:</p><p><b>${esc(medLabel(existing.med))}</b> ${esc(sig(existing))}</p><p class="muted">Remove from the patient's profile whenever possible so the pharmacist-reviewed order is used.</p>`,
      buttons: [{ label: 'Continue Override', value: 'ov' }, { label: 'Go to Profile', value: 'profile', primary: true }] });
    emit('order_exists', { med: medId, action: r.value });
    if (r.value === 'profile') { session.mode = 'remove'; session.tab = existing.prn ? 'prn' : 'all'; return render(); }
  }
  const dose = await askDose(medId, { override: true }); if (dose == null) return;
  session.cart.push(cartItem(medId, dose, { orderId: null, override: true, note: '' }));
  render();
}

/* ---------- removal ---------- */
async function runRemoval() {
  const p = PAT(session.sel);
  const items = [...session.cart];
  if (!items.length) return;
  let reason = null;
  if (!isOmni() && items.some(i => i.override)) {
    const r = await modal({ title: 'Override Warning', cls: 'alert', body: `<p>You are removing medication <b>without pharmacist review</b> of the order. Select the reason for the override.</p>
        ${OVERRIDE_REASONS.map((x, i) => `<label class="radio"><input type="radio" name="reason" value="${esc(x)}"${i ? '' : ''}> <span>${esc(x)}</span></label>`).join('')}`,
      buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: T('removeMeds'), value: 'ok', primary: true }],
      validate: (v, d) => d.reason ? null : 'Select an override reason.' });
    if (r.value !== 'ok') return;
    reason = r.data.reason;
    emit('override_reason', { reason });
  }
  const done = [];
  for (const it of items) {
    const res = isOmni() ? await omniRemoveItem(p, it) : await removeItem(p, it, reason);
    if (res) done.push({ ...res, key: it.key });
  }
  emit('txn_done', { patient: p.id, meds: done.map(d => d.med) });
  [...new Set(items.filter(i => i.kit).map(i => i.kit))].forEach(k => {
    if (items.filter(i => i.kit === k).every(i => done.some(d => d.key === i.key))) emit('kit_removed', { kit: k, patient: p.id });
  });
  if (items.some(i => i.nursePrep) && items.filter(i => i.nursePrep).some(i => !done.some(d => d.key === i.key))) done.push({ med: items.find(i => i.nursePrep).med, qty: 0, dose: 0, wasteNote: '<b>Partial issue</b> of the nurse-prepared order — one or more components were skipped. Follow hospital policy.' });
  session.cart = [];
  const lines = done.map(d => d.qty === 0 ? `<li>${d.wasteNote}</li>` : `<li><b>${esc(medLabel(d.med))}</b> — removed ${d.qty} ${unitWord(d.med, d.qty)} for a dose of ${num(d.dose)} ${F[d.med].unit}${d.wasteNote ? `<br><span class="muted">${d.wasteNote}</span>` : ''}</li>`).join('');
  await step({ title: isOmni() ? `Remove Complete — ${esc(p.last)}, ${esc(p.first)}` : 'Transaction Complete', body: `${patientBanner(p)}
      ${done.length ? `<ul class="summary">${lines}</ul>` : '<p>No medications were removed.</p>'}
      <div class="teach"><b>At the bedside:</b> verify the rights of medication administration, scan the patient's ID band and each medication barcode, then document on the eMAR. Label any syringe that leaves your hands.</div>`,
    buttons: [{ label: 'Done', value: 'ok', primary: true }] });
  go(D().key === 'omnicell' ? 'pt' : 'patients');
}

async function removeItem(p, it, reason) {
  const m = F[it.med];
  if (db.physical[it.med] < it.qty) { await info('Insufficient Stock', `<p>There are not enough ${esc(medLabel(it.med))} in this pocket. Use <b>Global Find</b> to locate another device and notify pharmacy.</p>`); return null; }
  let countNote = '';
  if (m.controlled) {
    let attempts = 0;
    for (;;) {
      const r = await step({ title: `Blind Count · ${esc(medLabel(it.med))}`, body: `${drawerView(it.med, { contents: 'items' })}
          <div class="count-box"><label for="count">Count every ${unitWord(it.med, 1)} in the open pocket <b>before</b> you remove anything.</label>
          <div class="inline"><input id="count" type="number" inputmode="numeric" min="0"><span>${unitWord(it.med, 2)} counted</span></div></div>`,
        buttons: [{ label: 'Cancel Med', value: 'cancel', novalidate: true }, { label: 'Accept', value: 'ok', primary: true }],
        validate: (v, d) => d.count === '' || isNaN(parseInt(d.count, 10)) ? 'Enter the number you counted.' : null });
      if (r.value === 'cancel') return null;
      const n = parseInt(r.data.count, 10), sys = db.inventory[it.med], phys = db.physical[it.med];
      if (n === sys) { emit('count', { med: it.med, correct: n === phys }); break; }
      if (++attempts === 1) { await info('Recount', '<p>Your count does not match the expected count. Count the pocket again, carefully, one item at a time.</p>', 'Recount'); continue; }
      const d = { id: uid(), t: Date.now(), med: it.med, user: session.user, patient: p.id, expected: sys, counted: n, resolved: false };
      db.discrepancies.push(d);
      addTx({ type: 'Discrepancy', patient: p.id, med: it.med, amount: `exp ${sys} / cnt ${n}`, note: 'Blind count mismatch' });
      db.inventory[it.med] = n;
      emit('count', { med: it.med, correct: n === phys });
      emit('discrepancy_created', { med: it.med });
      countNote = 'Discrepancy created — resolve it before the end of your shift.';
      await info('<span class="alert-title">Discrepancy Created</span>', `<p>Your second count (<b>${n}</b>) does not match the expected count. A discrepancy has been recorded and the inventory now reflects your count.</p><p>You may continue this removal. The discrepancy must be resolved with a witness before the end of your shift.</p>`, 'Continue', 'alert');
      break;
    }
  }
  const r = await step({ title: `${T('remove')} · ${esc(medLabel(it.med))}`, body: `${drawerView(it.med, { contents: m.controlled ? 'items' : 'label' })}
      <div class="take"><div class="take-n">${it.qty}</div><div><b>Remove ${it.qty} ${unitWord(it.med, it.qty)}</b> of ${esc(medLabel(it.med))} ${esc(medDesc(it.med))}<br>
      <span class="muted">Dose to administer: ${num(it.dose)} ${m.unit}${it.override ? ' · OVERRIDE' : ''}</span></div></div>
      <p class="muted">Take the medication, check the label against the order, then close the ${m.loc.type === 'Fridge' ? 'refrigerator bin' : 'drawer'}.</p>`,
    buttons: [{ label: 'Cancel Med', value: 'cancel' }, { label: `${T('remove')} & Close Drawer`, value: 'ok', primary: true }] });
  if (r.value !== 'ok') return null;
  db.inventory[it.med] -= it.qty; db.physical[it.med] -= it.qty;
  return afterRemoval(p, it, reason, countNote);
}

// Bookkeeping after the item leaves the drawer; shared by both cabinet types.
async function afterRemoval(p, it, reason, countNote) {
  const m = F[it.med];
  const removedAmt = it.qty * m.strength;
  const expectedWaste = m.noSplit ? 0 : Math.max(0, +(removedAmt - it.dose).toFixed(4));
  const rem = { id: uid(), t: Date.now(), user: session.user, patient: p.id, med: it.med, orderId: it.orderId, qty: it.qty, dose: it.dose, override: it.override, expectedWaste: m.controlled ? expectedWaste : 0, wasted: 0, returnedQty: 0, undocumented: false };
  db.removals.push(rem);
  if (it.orderId) { const o = orderById(it.orderId); db.orders[it.orderId] = { ...(db.orders[it.orderId] || {}), lastRemoved: rem.t, by: session.user, ...(o.prn ? {} : { given: rem.t }) }; }
  addTx({ type: it.kit ? 'Kit' : it.override ? 'Override' : 'Remove', patient: p.id, med: it.med, amount: `${it.qty} ${unitWord(it.med, it.qty)} / dose ${num(it.dose)} ${m.unit}`, note: [reason, it.note].filter(Boolean).join(' · ') });
  emit('removed', { patient: p.id, med: it.med, override: it.override, dose: it.dose, qty: it.qty, temp: !!p.temp, kit: it.kit || null });

  let wasteNote = countNote;
  if (m.controlled && expectedWaste > 0 && isOmni()) {
    const w = await modal({ title: 'Partial Dose', body: `<p>Intended dose <b>${amtText(it.med, it.dose)}</b>; you removed <b>${amtText(it.med, removedAmt)}</b>.</p>
        <p>Press <b>Waste Partial Dose</b> to record the ${db.settings.challenge ? 'waste' : `waste of <b>${amtText(it.med, expectedWaste)}</b>`} now with a witness. If you close the bin without wasting, this issue goes on the <b>Partial Dose List</b> and must be wasted later.</p>`,
      buttons: [{ label: 'Close Bin', value: 'later' }, { label: 'Waste Partial Dose', value: 'now', primary: true }] });
    if (w.value === 'now' && await omniWasteFlow(rem)) wasteNote = [countNote, `Partial dose wasted: ${amtText(it.med, rem.wasted)} with ${esc(userName(rem.witness))}.`].filter(Boolean).join(' ');
    else { rem.undocumented = true; emit('waste_later', { med: it.med, patient: p.id }); wasteNote = [countNote, 'Partial dose not wasted — it is on the Partial Dose List. Waste it with a witness from Waste Meds.'].filter(Boolean).join(' '); }
  } else if (m.controlled && expectedWaste > 0) {
    const w = await modal({ title: 'Waste Required', body: `<p>You removed <b>${amtText(it.med, removedAmt)}</b> and will administer <b>${amtText(it.med, it.dose)}</b>.</p>
        ${db.settings.challenge ? '<p>Calculate the amount you must waste.</p>' : `<p>Amount to waste: <b>${amtText(it.med, expectedWaste)}</b></p>`}
        <p class="muted">By law, the unused portion of a controlled substance must be wasted and documented with a witness.</p>`,
      buttons: [{ label: 'Waste Later', value: 'later' }, { label: 'Waste Now', value: 'now', primary: true }] });
    if (w.value === 'now') {
      const ok = await wasteFlow(rem);
      if (!ok) { rem.undocumented = true; wasteNote = 'Waste not documented — listed under ' + T('undoc') + '.'; }
      else wasteNote = `Wasted ${amtText(it.med, rem.wasted)} with ${esc(userName(rem.witness))}.`;
    } else {
      rem.undocumented = true; emit('waste_later', { med: it.med, patient: p.id });
      wasteNote = 'Waste Later selected — document it from ' + T('undoc') + ' as soon as possible.';
    }
  } else if (!m.controlled && !m.noSplit && expectedWaste > 0) {
    wasteNote = `Discard the unused ${amtText(it.med, expectedWaste)} per facility policy (non-controlled, no witness needed).`;
  }
  save();
  return { med: it.med, qty: it.qty, dose: it.dose, wasteNote };
}

/* ---------- waste ---------- */
async function wasteFlow(rem, synthetic = false) {
  if (isOmni()) return omniWasteFlow(rem, synthetic);
  const m = F[rem.med], id = rem.med;
  const removedAmt = (rem.qty - (rem.returnedQty || 0)) * m.strength;
  const expected = Math.max(0, +(rem.expectedWaste - rem.wasted).toFixed(4));
  const max = Math.max(0, +(removedAmt - rem.wasted).toFixed(4));
  if (max <= 0) { await info('Nothing to Waste', '<p>All of this removal has been accounted for.</p>'); return false; }
  const liquid = !!m.volume;
  const ch = db.settings.challenge;
  const r = await modal({ title: `Waste · ${esc(medLabel(id))}`, body: `
      <dl class="facts"><dt>Medication</dt><dd>${esc(medDesc(id))}</dd><dt>Removed</dt><dd>${rem.qty} ${unitWord(id, rem.qty)} = ${amtText(id, removedAmt)}${synthetic ? '' : ` at ${hhmm(rem.t)}`}</dd>
      <dt>Administered</dt><dd>${amtText(id, rem.dose)}</dd>${rem.wasted ? `<dt>Already wasted</dt><dd>${amtText(id, rem.wasted)}</dd>` : ''}
      ${ch ? '' : `<dt>Expected waste</dt><dd><b>${amtText(id, expected)}</b></dd>`}</dl>
      <label for="wamt">Amount to waste (${m.unit})</label><div class="inline"><input id="wamt" type="number" inputmode="decimal" step="any" ${ch ? '' : `value="${num(expected)}" data-volfor="${id}"`}><span>${m.unit}</span> <span class="vol-out mono">${!ch && liquid ? `= ${num(volOf(id, expected))} mL` : ''}</span></div>
      ${ch && liquid ? `<label for="wvol">Volume to waste (mL) — concentration ${num(m.strength / m.volume)} ${m.unit}/mL</label><div class="inline"><input id="wvol" type="number" inputmode="decimal" step="any"><span>mL</span></div>` : ''}
      <label for="wreason">Reason (required if the amount differs from the expected waste)</label>
      <select id="wreason"><option value="">— none —</option>${WASTE_SHORT_REASONS.map(x => `<option>${esc(x)}</option>`).join('')}</select>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Continue', value: 'ok', primary: true }],
    validate: (v, d) => {
      const a = parseFloat(d.wamt);
      if (isNaN(a) || a < 0) return 'Enter the amount to waste.';
      if (a > max + 1e-9) return `You cannot waste more than the ${amtText(id, max)} remaining from this removal.`;
      if (ch && liquid) { const vol = parseFloat(d.wvol); if (isNaN(vol) || Math.abs(vol - volOf(id, a)) > 0.011) return `The volume does not match ${num(a)} ${m.unit} at ${num(m.strength / m.volume)} ${m.unit}/mL. Recalculate: amount ÷ concentration.`; }
      if (Math.abs(a - expected) > 1e-6 && !d.wreason) return ch ? 'That amount does not match what the system expects. Recheck your calculation (removed − administered), or select a reason if the difference is intentional.' : 'The amount differs from the expected waste. Select a reason.';
      return null;
    } });
  if (r.value !== 'ok') return false;
  const amt = parseFloat(r.data.wamt);
  const p = PAT(rem.patient);
  const w = await witnessFlow(`Witness the waste of <b>${amtText(id, amt)}</b> of ${esc(medLabel(id))} for ${esc(patName(p))}.`);
  if (!w) return false;
  await info('Waste the Medication', `<p>With <b>${esc(userName(w))}</b> watching, expel <b>${amtText(id, amt)}</b> into the controlled-substance waste container (e.g., pharmaceutical waste bin or drug-destruction pouch) per facility policy.</p><p class="muted">Both of you must see the entire waste.</p>`, 'Waste Complete');
  rem.wasted = +(rem.wasted + amt).toFixed(4);
  rem.witness = w;
  if (rem.wasted >= rem.expectedWaste - 1e-6) rem.undocumented = false;
  addTx({ type: 'Waste', patient: rem.patient, med: id, amount: amtText(id, amt), witness: w, note: r.data.wreason || (synthetic ? 'Search All Meds' : '') });
  emit('waste', { med: id, amount: amt, patient: rem.patient, witness: w });
  toast(`Waste documented: ${amtText(id, amt)}`, 'good');
  return true;
}

async function searchAllWaste() {
  const p = PAT(session.sel);
  const ids = Object.keys(F).filter(id => F[id].controlled);
  const r = await modal({ title: 'Search All Meds — Waste', body: `<p class="muted">Use this when the removal is not listed (for example, it happened at another device or more than 32 hours ago).</p>
      <label for="sam">Medication</label><select id="sam">${ids.map(id => `<option value="${id}">${esc(medLabel(id))} — ${esc(medDesc(id))}</option>`).join('')}</select>
      <label for="samq">Quantity originally removed</label><input id="samq" type="number" inputmode="numeric" value="1" min="1">
      <label for="samd">Amount administered</label><input id="samd" type="number" inputmode="decimal" step="any">`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Waste Now', value: 'ok', primary: true }],
    validate: (v, d) => { const q = parseInt(d.samq, 10), a = parseFloat(d.samd); if (!(q >= 1)) return 'Enter the quantity removed.'; if (isNaN(a) || a < 0) return 'Enter the amount administered (0 if none).'; if (a > q * F[d.sam].strength) return 'The amount administered cannot exceed the amount removed.'; return null; } });
  if (r.value !== 'ok') return;
  const med = r.data.sam, qty = parseInt(r.data.samq, 10), dose = parseFloat(r.data.samd);
  const rem = { id: uid(), t: Date.now(), user: session.user, patient: p.id, med, qty, dose, expectedWaste: +(qty * F[med].strength - dose).toFixed(4), wasted: 0, returnedQty: 0 };
  await wasteFlow(rem, true);
  render();
}

/* ---------- return ---------- */
async function returnFlow(rem) {
  if (isOmni()) return omniReturnFlow(rem);
  const m = F[rem.med], left = rem.qty - rem.returnedQty;
  const r = await modal({ title: `Return · ${esc(medLabel(rem.med))}`, body: `<p>${esc(medDesc(rem.med))} — removed ${rem.qty} ${unitWord(rem.med, rem.qty)} at ${hhmm(rem.t)}.</p>
      <p class="muted">Return only unopened, intact packages.</p>
      <label for="rq">Quantity to return</label><input id="rq" type="number" inputmode="numeric" min="1" max="${left}" value="${left}">
      <label class="check"><input type="checkbox" id="sealed"> The packaging is sealed and unopened</label>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Return', value: 'ok', primary: true }],
    validate: (v, d) => { const q = parseInt(d.rq, 10); if (!(q >= 1 && q <= left)) return `Enter a quantity from 1 to ${left}.`; if (!d.sealed) return 'Opened medications cannot be returned. Waste an opened controlled substance instead.'; return null; } });
  if (r.value !== 'ok') return;
  const q = parseInt(r.data.rq, 10);
  let witness = null;
  if (m.controlled) { witness = await witnessFlow(`Witness the return of <b>${q} ${unitWord(rem.med, q)}</b> of ${esc(medLabel(rem.med))}.`); if (!witness) return; }
  await step({ title: 'Return to Return Bin', body: `<div class="drawer-view"><div class="dv-loc"><span class="light"></span><div><b>Main · External Return Bin</b><span class="muted">The return bin is unlocked. Items in the return bin are checked by pharmacy and are not reissued from here.</span></div></div>
      <div class="return-art" aria-hidden="true"><div class="return-slot">${Array.from({ length: q }, () => unitIcon(rem.med)).join('')}</div><span>RETURN BIN</span></div></div>
      <p>Place <b>${q} ${unitWord(rem.med, q)}</b> of ${esc(medLabel(rem.med))} in the return bin${witness ? ` while ${esc(userName(witness))} watches` : ''}, then select Accept.</p>`,
    buttons: [{ label: 'Accept', value: 'ok', primary: true }] });
  rem.returnedQty += q;
  if (rem.returnedQty >= rem.qty) { rem.expectedWaste = 0; rem.undocumented = false; if (rem.orderId && db.orders[rem.orderId]) { delete db.orders[rem.orderId].given; } }
  addTx({ type: 'Return', patient: rem.patient, med: rem.med, amount: `${q} ${unitWord(rem.med, q)}`, witness, note: 'Return bin' });
  emit('returned', { med: rem.med, patient: rem.patient, qty: q });
  toast('Return recorded.', 'good');
  go('returns');
}

/* ---------- discrepancy resolution ---------- */
async function resolveDiscrepancy(d) {
  if (isOmni()) return omniResolve(d);
  const recent = db.tx.filter(t => t.med === d.med).sort((a, b) => b.t - a.t).slice(0, 8);
  const r1 = await step({ title: `Resolve Discrepancy · ${esc(medLabel(d.med))}`, body: `
      <dl class="facts"><dt>Location</dt><dd>${locText(d.med)}</dd><dt>Expected count</dt><dd>${d.expected}</dd><dt>Count entered</dt><dd>${d.counted}</dd><dt>Created</dt><dd>${hhmm(d.t)} by ${esc(userName(d.user))}</dd></dl>
      <h3>Investigate: recent transactions for this medication</h3>${txTable(recent)}
      <p class="muted">Review the transactions and the MAR. Did someone miscount, remove more or less than ordered, or return to the wrong place?</p>`,
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Count Now', value: 'ok', primary: true }] });
  if (r1.value !== 'ok') return go('disc');
  const r2 = await step({ title: 'Inventory Count', body: `${drawerView(d.med, { contents: 'items' })}<div class="count-box"><label for="rc">Count every item in the pocket.</label><div class="inline"><input id="rc" type="number" inputmode="numeric" min="0"><span>counted</span></div></div>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Accept', value: 'ok', primary: true }],
    validate: (v, x) => { const n = parseInt(x.rc, 10); if (isNaN(n)) return 'Enter the number you counted.'; if (n !== db.physical[d.med]) return 'That count does not match what is in the pocket. Count again, one item at a time.'; return null; } });
  if (r2.value !== 'ok') return go('disc');
  db.inventory[d.med] = parseInt(r2.data.rc, 10);
  const r3 = await modal({ title: 'Discrepancy Reason', body: `${DISCREPANCY_REASONS.map(x => `<label class="radio"><input type="radio" name="dr" value="${esc(x)}"> <span>${esc(x)}</span></label>`).join('')}
      <label for="dc">Comment (what you found)</label><textarea id="dc" rows="3" placeholder="e.g., Physical count 9 confirmed with witness; previous count entered as 10."></textarea>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Continue', value: 'ok', primary: true }],
    validate: (v, x) => !x.dr ? 'Select a reason.' : (x.dc || '').length < 10 ? 'Add a short comment describing your investigation.' : null });
  if (r3.value !== 'ok') return go('disc');
  const w = await witnessFlow(`Witness the count and resolution of the ${esc(medLabel(d.med))} discrepancy.`);
  if (!w) return go('disc');
  Object.assign(d, { resolved: true, reason: r3.data.dr, comment: r3.data.dc, witness: w, resolvedBy: session.user, resolvedAt: Date.now() });
  addTx({ type: 'Resolve', med: d.med, amount: `count ${db.inventory[d.med]}`, witness: w, note: `${r3.data.dr} — ${r3.data.dc}` });
  emit('discrepancy_resolved', { med: d.med });
  toast('Discrepancy resolved.', 'good');
  go('disc');
}

/* =====================================================================
 * Omnicell Color Touch mode — follows the Omnicell Color Touch 22.5 user guide:
 * log on (User ID + password or fingerprint, Short List), patient lists
 * (Global / Local / Partial Dose / My Patients), patient screen, Remove Meds tabs,
 * Stocked Meds override, blind count before removing, Waste Partial Dose,
 * Return Meds / Waste Meds with Patient Medication Accounts, Resolve Discrep.
 * ===================================================================== */
const isOmni = () => D().key === 'omnicell';
const oSide = list => list.map(([label, attrs, cls = '']) => `<button type="button" class="btn obtn ${cls}" ${attrs}>${label}</button>`).join('');
const oDate = t => { const d = new Date(t); return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const oMenuItems = [['pc', 'Patient Care', 'patients'], ['rep', 'Reports', 'reports'], ['rd', 'Resolve Discrep', 'disc'], ['inv', 'Inventory Menus', null], ['um', 'User Menus', null], ['am', 'Admin Menus', null]];
function oMenu(active, loggedOn = true) {
  const disc = db.discrepancies.some(d => !d.resolved);
  return oMenuItems.map(([k, l, to]) => {
    const flash = k === 'rd' && disc ? ' flash' : '';
    if (!loggedOn) return `<button type="button" class="otab menu${flash}" ${k === 'rd' && disc ? 'data-resolve="disc" data-novalidate' : 'disabled'}>${l}</button>`;
    return `<button type="button" class="otab menu${active === k ? ' on' : ''}${flash}" ${to ? `data-act="go" data-to="${to}"` : 'disabled title="Not part of this practice simulator"'}>${l}</button>`;
  }).join('');
}
const oTitle = (t, p) => `${t}${p ? `<span class="o-allergy">Allergies: ${p.allergies.length || p.allergyUnknown ? esc(allergyText(p)) : 'None known — check MAR'}</span>` : ''}`;
function lastIssue(pid, medId) { const r = db.removals.filter(x => x.patient === pid && x.med === medId).sort((a, b) => b.t - a.t)[0]; return r ? r.t : null; }
function outstandingOf(rem) { const m = F[rem.med]; return +((rem.qty - (rem.returnedQty || 0)) * m.strength - rem.wasted - (rem.adminDone ? rem.dose : 0)).toFixed(4); }

const OMNI = {
  standby() {
    const disc = db.discrepancies.some(d => !d.resolved);
    return { cls: 'standby', body: `<button class="standby-btn" data-act="signin">
        <span class="sb-kicker">${D().station} · 4 West Medical-Surgical</span>
        <span class="sb-title">Omnicell XT</span>
        <span class="sb-sub">Touch the screen to log on</span>
        ${disc ? '<span class="sb-disc">Discrepancy exists — press Resolve Discrep after you log on</span>' : ''}
        <span class="sb-time mono clock" data-fmt="colon">${clockText(Date.now())}</span></button>` };
  },

  home() {
    return { title: 'Main Menu', body: '<div class="o-center">Choose menu option…</div>', hint: 'Select main menu option from the buttons below.',
      tabs: oMenu(''), left: oSide([['Previous Screen', 'data-act="go" data-to="patients"', 'back']]) };
  },

  patients() {
    const u = session.user;
    const tab = ['global', 'local', 'partial', 'my'].includes(session.listTab) ? session.listTab : 'local';
    let ids = allPatients().map(p => p.id);
    if (tab === 'my') ids = db.myPatients[u] || [];
    if (tab === 'partial') ids = ids.filter(id => db.removals.some(r => r.undocumented && r.patient === id));
    const list = ids.map(PAT).filter(Boolean).sort((a, b) => session.sortRoom ? a.room.localeCompare(b.room) : (a.last.localeCompare(b.last) || a.first.localeCompare(b.first)));
    const rows = list.map(p => {
      const partial = db.removals.some(r => r.undocumented && r.patient === p.id);
      return `<button class="orow pt" data-act="openPt" data-id="${p.id}" data-filterable="${esc(p.last + ' ' + p.first + ' ' + p.room + ' ' + p.mrn)}">
        <span><b>${esc(p.last)}, ${esc(p.first)}</b>${p.nameAlert ? ' <span class="chip alert">NAME ALERT</span>' : ''}${p.temp ? ' <span class="chip temp">TEMPORARY</span>' : ''}${partial ? ' <span class="chip waste">PARTIAL DOSE</span>' : ''}<br>PtID: <span class="mono">${p.mrn}</span><br>MRN: <span class="mono">${p.mrn}-4W</span></span>
        <span class="o-mid"><br><br>DOB: <span class="mono">${fmtDob(p.dob)}</span></span>
        <span>Rm#: <span class="mono">${p.room}</span><br>Pt.Type: ${p.temp ? 'TMP' : 'INP'}<br>Area: 4W</span></button>`;
    }).join('');
    const empty = tab === 'my' ? 'Your My Patients list is empty. Press <b>Edit My Patients</b> to add your assigned patients.' : tab === 'partial' ? 'No patients have partial dose issues that require waste.' : 'No patients found.';
    return { title: 'Patient List:', body: `<input type="search" id="ptsearch" class="o-search" placeholder="Type the first few letters of the last name" data-filter aria-label="Search patients">
        <div class="olist">${rows || `<p class="empty-line">${empty}</p>`}</div>`,
      hint: tab === 'partial' ? 'Partial Dose List: patients with undocumented medication issues. Select the patient, then press Waste Meds.' : 'Select a patient from the list. To search for a patient, enter the first few characters of the last name. If the patient is not found, look in the Global List.',
      tabs: [['global', 'Global List'], ['local', 'Local List'], ['partial', 'Partial Dose List'], ['my', 'My Patients']].map(([k, l]) => `<button type="button" class="otab${tab === k ? ' on' : ''}" data-act="olist" data-t="${k}">${l}</button>`).join(''),
      left: oSide([['Main Menu', 'data-act="home"'], ['Add New Patient', 'data-act="addTemp"'], ['Find Item', 'data-act="go" data-to="find"'], ...(tab === 'my' ? [['Edit My Patients', 'data-act="go" data-to="editMy"']] : [])]),
      footer: oSide([[session.sortRoom ? 'Sort by Name' : 'Sort by Room', 'data-act="osort"']]) };
  },

  pt() {
    const p = PAT(session.sel);
    if (!p) return OMNI.patients();
    return { title: oTitle(`Patient: ${esc(p.last)}, ${esc(p.first)} ${p.mi}`, p), body: `<dl class="facts o-facts">
        <dt>Patient ID:</dt><dd class="mono">${p.mrn}</dd><dt>Patient Type:</dt><dd>${p.temp ? 'TMP (temporary)' : 'INP'}</dd><dt>Med. Rec. #:</dt><dd class="mono">${p.mrn}-4W</dd>
        <dt>Date of Birth:</dt><dd class="mono">${fmtDob(p.dob)} (${age(p.dob)} y, ${p.sex})</dd><dt>Physician:</dt><dd>${esc(p.provider)}</dd><dt>Area:</dt><dd>4W</dd><dt>Room:</dt><dd class="mono">${p.room}</dd><dt>Diagnosis:</dt><dd>${esc(p.dx)}</dd></dl>
        ${p.nameAlert ? '<p class="warnline">Name alert: another patient on this unit has a similar name. Verify two identifiers.</p>' : ''}`,
      hint: 'Select Remove Meds, Return Meds or Waste Meds. Verify the patient with two identifiers first.',
      left: oSide([['Previous Screen', 'data-act="go" data-to="patients"', 'back'], ['Allergy Info', 'data-act="allergyInfo"'], ['Transaction History', 'data-act="pa" data-a="past"']]),
      footer: oSide([['Remove Meds', 'data-act="pa" data-a="remove"', 'go'], ['Remove Kits', 'data-act="pa" data-a="kits"'], ['Return Meds', 'data-act="pa" data-a="return"'], ['Waste Meds', 'data-act="pa" data-a="waste"']]) };
  },

  profile() {
    const p = PAT(session.sel), cart = session.cart, tab = session.tab;
    const inCart = key => { const l = cart.filter(c => c.key === key || c.group === key); return l.length ? { qty: l.reduce((n, c) => n + c.qty, 0) } : null; };
    const row = ({ key, act, id, medId, line2, right, dim, icons = '' }) => {
      const c = inCart(key);
      return `<div class="orow med${c ? ' sel' : ''}${dim ? ' dim' : ''}" data-filterable="${esc(F[medId].name + ' ' + F[medId].brand)}">
        <button type="button" class="oqty" ${c ? `data-act="unpickKey" data-key="${key}" aria-label="Deselect ${esc(medLabel(medId))}"` : 'tabindex="-1" aria-hidden="true"'}>${c ? `[${c.qty}]` : ''}</button>
        <button type="button" class="omain" data-act="${act}" data-id="${id}"><span><b>${esc(medLabel(medId))} ${esc(medDesc(medId))}</b>${icons}<br>${line2}</span><span class="oright">${right}</span></button></div>`;
    };
    const issuedTxt = (medId, warn) => { const t = lastIssue(p.id, medId); return t ? `<span class="${warn ? 'o-red' : ''}">Issued: ${oDate(t)}</span>` : '<span class="muted">Item has not been issued</span>'; };
    const oIcons = o => `${F[o.med].controlled ? ' <span class="chip cs" title="Witness required for waste">W</span>' : ''}${o.prn ? ' <span class="chip">PRN</span>' : ''}${o.dose == null ? ' <span class="chip">RANGE</span>' : ''}${o.nursePrep ? ' <span class="chip np">NURSE-PREPARED</span>' : ''}`;
    let listHtml = '';
    if (tab === 'stocked') {
      listHtml = Object.keys(F).sort((a, b) => F[a].name.localeCompare(F[b].name)).map(id => row({ key: 'ov-' + id, act: 'pickStocked', id, medId: id,
        line2: `${esc(locText(id))}${F[id].override ? '' : ' · <span class="o-red">Override not permitted</span>'}`, right: `On hand ${db.inventory[id]}`, dim: !F[id].override && !p.orders.some(o => o.med === id),
        icons: F[id].controlled ? ` <span class="chip cs">${F[id].controlled}</span>` : '' })).join('');
    } else if (tab === 'display') {
      listHtml = cart.map(c => row({ key: c.key, act: 'noop', id: c.key, medId: c.med, line2: `Dose: ${num(c.dose)} ${F[c.med].unit.toUpperCase()}${c.override ? ' · <b class="o-red">OVERRIDE</b> — ' + esc(c.reason || '') : ''}`, right: `Qty ${c.qty}` })).join('');
    } else {
      const orders = p.orders.filter(o => { const s = orderStatus(o);
        if (tab === 'inactive') return s.kind === 'future';
        if (tab === 'prn') return s.kind === 'prn';
        if (tab === 'sched') return s.kind === 'due' || s.kind === 'pastdue';
        return s.kind !== 'future'; });
      listHtml = orders.map(o => { const s = orderStatus(o); const h = freqHours(o.freq);
        const recent = (s.kind === 'given') || (s.kind === 'prn' && s.last && h && Date.now() - s.last < h * HOUR);
        const due = s.kind === 'due' ? ` · Due ${hhmm(s.due)}` : s.kind === 'pastdue' ? ' · <b class="o-red">PAST DUE ' + hhmm(s.due) + '</b>' : s.kind === 'future' ? ` · Not due until ${hhmm(s.due)}` : '';
        return row({ key: o.id, act: tab === 'inactive' ? 'inactiveOrder' : 'pickOrder', id: o.id, medId: o.med, dim: tab === 'inactive', icons: oIcons(o),
          line2: `Dose: ${doseText(o)} ${F[o.med].unit.toUpperCase()} &nbsp; ${esc(F[o.med].route)} ${esc(o.freq.toUpperCase())}${o.prn ? ' PRN ' + esc(o.prn) : ''}${due}`, right: issuedTxt(o.med, recent) }); }).join('');
    }
    const tabs = [['display', 'Display Meds to Remove'], ['stocked', 'Stocked Meds'], ['active', 'Active Med Orders'], ['inactive', 'Inactive Med Orders'], ['prn', 'PRN Only'], ['sched', 'Scheduled Meds']];
    return { title: oTitle(`Remove Meds for: ${esc(p.last)}, ${esc(p.first)}`, p), body: `<input type="search" id="medsearch" class="o-search" placeholder="Type the first letters of the medication" data-filter aria-label="Search medications">
        <div class="olist">${listHtml || '<p class="empty-line">No items on this tab.</p>'}</div>`,
      hint: (tab === 'stocked' ? '' : `Now <span class="clock" data-fmt="colon">${clockText(Date.now(), 'colon')}</span> — scheduled doses are due at ${hhmm(dueHourMs())}. `) + (tab === 'stocked' ? 'Stocked Meds: every item in this cabinet. Selecting an item that is not on the patient\'s active med orders is an OVERRIDE.' : 'Select the medication to remove. Any med order displayed in grey is not available. Deselect an item by pressing the quantity indicator to the left of any selected item.'),
      tabs: tabs.map(([k, l]) => `<button type="button" class="otab${tab === k ? ' on' : ''}" data-act="otab" data-t="${k}">${l}</button>`).join(''),
      left: cart.length ? oSide([['Cancel Med List', 'data-act="cancelMedList"', 'red']]) : oSide([['Previous Screen', 'data-act="go" data-to="pt"', 'back']]),
      footer: oSide([['Remove Now', `data-act="removeMeds"${cart.length ? '' : ' disabled'}`, 'go']]) };
  },

  returns() {
    const p = PAT(session.sel), all = session.retAll;
    const list = db.removals.filter(r => r.patient === p.id && (all || r.user === session.user) && Date.now() - r.t < 72 * HOUR && r.qty - r.returnedQty > 0).sort((a, b) => b.t - a.t);
    const rows = list.map(r => { const why = r.wasted > 0 ? 'Opened / partly wasted — cannot return' : '';
      return `<button class="orow med1${why ? ' dim' : ''}" data-act="${why ? 'why' : 'doReturn'}" data-id="${r.id}" data-why="${esc(why)}"><span><b>${esc(medLabel(r.med))} ${esc(medDesc(r.med))}</b><br>Issued ${oDate(r.t)} by ${esc(userName(r.user))} · qty ${r.qty - r.returnedQty}${why ? ` · <span class="o-red">${why}</span>` : ''}</span><span class="oright">Outstanding: ${amtText(r.med, outstandingOf(r))}</span></button>`; }).join('');
    return { title: oTitle(`Return Meds for: ${esc(p.last)}, ${esc(p.first)}`, p), body: `<div class="olist">${rows || '<p class="empty-line">No open issues to return. Press All Meds to see issues by all users.</p>'}</div>`,
      hint: 'Meds Eligible to Return lists your open Patient Medication Accounts (PMAs). Return unused items before recording any waste.',
      tabs: `<button type="button" class="otab${!all ? ' on' : ''}" data-act="retTab" data-all="0">Meds Eligible to Return</button><button type="button" class="otab${all ? ' on' : ''}" data-act="retTab" data-all="1">All Meds</button>`,
      left: oSide([['Previous Screen', 'data-act="go" data-to="pt"', 'back']]) };
  },

  waste() {
    const p = PAT(session.sel), t = session.wasteTab || 'req';
    const base = db.removals.filter(r => r.patient === p.id && F[r.med].controlled && outstandingOf(r) > 0);
    const list = (t === 'req' ? base.filter(r => r.undocumented || r.expectedWaste - r.wasted > 1e-6) : base).sort((a, b) => b.t - a.t);
    const rows = list.map(r => `<button class="orow med1" data-act="doWaste" data-id="${r.id}"><span><b>${esc(medLabel(r.med))} ${esc(medDesc(r.med))}</b><br>Issued ${oDate(r.t)} by ${esc(userName(r.user))} · intended dose ${num(r.dose)} ${F[r.med].unit}</span><span class="oright">Outstanding: ${amtText(r.med, outstandingOf(r))}</span></button>`).join('');
    return { title: oTitle(`Waste Meds for: ${esc(p.last)}, ${esc(p.first)}`, p), body: `<div class="olist">${rows || '<p class="empty-line">No items require waste on this tab.</p>'}</div>`,
      hint: 'Select the item to waste. You must enter a waste reason, and a witness must watch the waste. Complete any returns first.',
      tabs: `<button type="button" class="otab${t === 'req' ? ' on' : ''}" data-act="wasteTab" data-t="req">Meds Requiring Waste</button><button type="button" class="otab${t === 'all' ? ' on' : ''}" data-act="wasteTab" data-t="all">All Meds</button><button type="button" class="otab" data-act="searchAllWaste">Stocked Meds</button>`,
      left: oSide([['Previous Screen', 'data-act="go" data-to="pt"', 'back']]) };
  },

  past() {
    const p = PAT(session.sel);
    return { title: oTitle(`Transaction History: ${esc(p.last)}, ${esc(p.first)}`, p), body: txTable(db.tx.filter(t => t.patient === p.id).sort((a, b) => b.t - a.t)),
      hint: 'All transactions for this patient at this cabinet.', left: oSide([['Previous Screen', 'data-act="go" data-to="pt"', 'back']]) };
  },

  undoc() { session.listTab = 'partial'; session.screen = 'patients'; return OMNI.patients(); },

  disc() {
    const open = db.discrepancies.filter(d => !d.resolved), done = db.discrepancies.filter(d => d.resolved);
    const row = d => `<button class="orow med1${d.resolved ? ' dim' : ''}" data-act="${d.resolved ? 'noop' : 'resolveDisc'}" data-id="${d.id}"><span><b>${esc(medLabel(d.med))} ${esc(medDesc(d.med))}</b><br>Found by ${esc(userName(d.user))} at ${oDate(d.t)} · Qty Expected ${d.expected} · Qty Found ${d.counted}</span><span class="oright">${d.resolved ? 'Resolved' : '<b class="o-red">OPEN</b>'}</span></button>`;
    return { title: 'Resolve Discrepancies', body: `<div class="olist">${open.map(row).join('') || '<p class="empty-line">No open discrepancies.</p>'}${done.map(row).join('')}</div>`,
      hint: 'Finding a discrepancy does not mean it is yours — only that it must be addressed. Resolve discrepancies by the end of the shift in which they were found.',
      tabs: oMenu('rd'), left: oSide([['Previous Screen', 'data-act="go" data-to="patients"', 'back']]) };
  },

  find() { const o = SCREENS.find(); return { ...o, title: 'Find Item — Check Item Availability', footer: '', hint: 'Locations and quantities on this cabinet.', left: oSide([['Previous Screen', 'data-act="go" data-to="patients"', 'back']]) }; },

  reports() {
    const t = session.oRep || 'user';
    let body;
    if (t === 'disc') body = db.discrepancies.length ? `<div class="table-wrap"><table class="tx"><thead><tr><th>Found</th><th>Item</th><th>Found by</th><th>Users with previous access</th><th>Expected / Found</th><th>Status</th></tr></thead><tbody>${db.discrepancies.map(d => `<tr><td class="mono">${oDate(d.t)}</td><td>${esc(medLabel(d.med))}</td><td>${esc(userName(d.user))}</td><td>${[...new Set(db.tx.filter(x => x.med === d.med && x.t <= d.t).map(x => userName(x.user)))].map(esc).join(', ') || '—'}</td><td class="mono">${d.expected} / ${d.counted}</td><td>${d.resolved ? 'Resolved' : 'Open'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-line">No discrepancies.</p>';
    else if (t === 'waste') { const l = db.removals.filter(r => r.undocumented); body = l.length ? `<div class="table-wrap"><table class="tx"><thead><tr><th>Issued</th><th>Patient</th><th>Item</th><th>User</th><th>Waste due</th></tr></thead><tbody>${l.map(r => `<tr><td class="mono">${oDate(r.t)}</td><td>${esc(patName(PAT(r.patient)))}</td><td>${esc(medLabel(r.med))}</td><td>${esc(userName(r.user))}</td><td class="mono">${amtText(r.med, r.expectedWaste - r.wasted)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-line">No waste-required items.</p>'; }
    else body = txTable(db.tx.filter(x => t === 'all' || x.user === session.user).sort((a, b) => b.t - a.t));
    session.reportAll = t === 'all';
    return { title: 'Cabinet Reports', body, hint: 'Use Discrepancy by User to find users with previous access to an item when researching a discrepancy.',
      tabs: [['user', 'Transaction by User'], ['all', 'All Transactions'], ['disc', 'Discrepancy by User'], ['waste', 'Waste Required Items']].map(([k, l]) => `<button type="button" class="otab${t === k ? ' on' : ''}" data-act="oRep" data-t="${k}">${l}</button>`).join(''),
      left: oSide([['Main Menu', 'data-act="home"']]), footer: oSide([['Copy Report', 'data-act="copyReport"']]) };
  },


  editMy() { const o = SCREENS.editMy(); return { ...o, hint: 'Tap a patient on the left to add them to My Patients. Press Accept when finished.' }; },
};

/* ---------- Omnicell log on ---------- */
function oLogonBody(uid, stage, msg, err) {
  return `<div class="o-logon"><div class="o-brand">Omnicell XT · Color Touch</div><p class="o-welcome">Welcome! Please Enter:</p>
    <div class="o-logon-grid"><div>
      <label for="uid">User ID:</label><input id="uid" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(uid)}" class="${err === 'uid' ? 'hl' : ''}"${stage === 'pw' ? ' readonly' : ''}>
      ${cred('Your user ID', 'student')}
      ${stage === 'pw' ? `<label for="pw">Password:</label><input id="pw" type="password" autocomplete="off">${cred('Your password', (db.users[uid] || {}).password || 'nurse1')}` : ''}
    </div>${scannerHtml(msg)}</div></div>`;
}
async function omniSignIn() {
  let uid = '', stage = 'id', fails = 0, err = '';
  let msg = 'Type your user ID, then <b>touch and hold</b> the fingerprint sensor for about <b>two seconds</b> (on a computer, click and hold the mouse).';
  let user = null, method = null;
  for (;;) {
    const r = await step({ title: `${D().station} · MED1<span class="o-sub">4 West Medical-Surgical</span>`, body: oLogonBody(uid, stage, msg, err),
      hint: 'Please enter your user ID and Password if required. Press the Enter key when you are finished typing a user ID or password. You may scan your fingerprint at any time.',
      tabs: oMenu('', false), left: stage === 'pw' ? oSide([['Previous Screen', 'data-resolve="back" data-novalidate', 'back']]) : oSide([['Cancel', 'data-resolve="cancel" data-novalidate', 'back']]),
      buttons: [{ label: 'Enter', value: 'enter', primary: true }] });
    err = '';
    const typed = (r.data.uid || '').toLowerCase();
    if (r.value === 'cancel') return go('standby');
    if (r.value === 'back') { stage = 'id'; continue; }
    if (r.value === 'disc') { await info('Discrepancy', '<p>An open discrepancy exists on this cabinet. Log on, then press <b>Main Menu → Resolve Discrep</b>.</p>'); continue; }
    if (r.value === 'scan-ok') {
      const cand = typed && db.users[typed] ? db.users[typed] : (!typed ? (db.shortList || []).map(id => db.users[id]).find(x => x && x.bioid) : null);
      if (!cand) { msg = typed ? '<span class="bad">Fingerprint not recognized.</span> Check your User ID.' : '<span class="bad">Enter User ID first.</span> You are not on this cabinet\'s Short List. Enter your User ID, then scan.'; err = 'uid'; uid = typed; continue; }
      if (!cand.bioid) { msg = '<span class="bad">No fingerprint enrolled for this user.</span> Log on with User ID and password.'; uid = cand.id; continue; }
      user = cand; method = 'bioid'; break;
    }
    if (r.value === 'scan-fail') {
      fails++; uid = typed;
      msg = fails >= 3 ? '<span class="bad">Fingerprint not recognized.</span> Enter your User ID and password.' : '<span class="bad">Try Again.</span> Place the same finger flat and centered for at least two seconds — do not roll it.';
      continue;
    }
    if (r.value === 'enter') {
      if (!typed || !db.users[typed]) { msg = typed ? `<span class="bad">User ID "${esc(typed)}" was not found.</span>` : '<span class="bad">Enter your User ID.</span>'; err = 'uid'; uid = typed; stage = 'id'; continue; }
      uid = typed;
      if (stage === 'id') { stage = 'pw'; msg = 'Touch and hold the fingerprint sensor, or enter your password.'; continue; }
      if (r.data.pw !== db.users[typed].password) { msg = '<span class="bad">Invalid password.</span> Passwords may be case sensitive — check Caps Lock.'; continue; }
      user = db.users[typed]; method = 'password'; break;
    }
  }
  session.user = user.id; session.loginMethod = method;
  db.shortList = [user.id, ...(db.shortList || []).filter(x => x !== user.id)].slice(0, 8);
  if (undocFor(user.id).length) await info('Log-on Message', '<p><b>You Have Partial Dose Issues That Require Waste.</b></p><p class="muted">See the Partial Dose List tab, then select the patient and press Waste Meds.</p>');
  emit('signin', { user: user.id, method });
  toast(`Logged on: ${db.users[user.id].first} ${db.users[user.id].last}`);
  go('patients', { listTab: (db.myPatients[user.id] || []).length ? 'my' : 'local', sel: null });
}

/* ---------- Omnicell remove / blind count ---------- */
async function omniConfirmQty(medId, dose) {
  const m = F[medId], q = cartItem(medId, dose, {}).qty;
  const r = await modal({ title: `${esc(medLabel(medId))}`, body: `<p>${esc(medDesc(medId))}</p><dl class="facts"><dt>Intended Dose:</dt><dd><b>${num(dose)} ${m.unit.toUpperCase()}</b></dd><dt>Quantity to Remove:</dt><dd><b>${q} ${unitWord(medId, q)}</b></dd></dl>`,
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'OK', value: 'ok', primary: true }] });
  return r.value === 'ok';
}

async function omniSelectStocked(medId) {
  const p = PAT(session.sel), m = F[medId];
  if (session.cart.some(c => c.key === 'ov-' + medId)) return toast('Already selected — see Display Meds to Remove.');
  const existing = p.orders.find(o => o.med === medId || F[o.med].name === m.name);
  if (existing && existing.nursePrep) return info('Override Not Permitted', '<p>Overrides are not permitted for nurse-prepared med orders. Select the order from Active Med Orders or Scheduled Meds.</p>');
  if (existing) {
    const r = await modal({ title: 'Active Med Order Exists', body: `<p>This item is on the patient's active med orders:</p><p><b>${esc(medLabel(existing.med))}</b> ${esc(sig(existing))}</p><p class="muted">Select it from Active Med Orders so the pharmacist-verified order is used.</p>`,
      buttons: [{ label: 'Override Anyway', value: 'ov' }, { label: 'Go to Active Med Orders', value: 'go', primary: true }] });
    emit('order_exists', { med: medId, action: r.value });
    if (r.value === 'go') { session.tab = existing.prn ? 'prn' : 'active'; return render(); }
  } else if (!m.override) return info('Override Not Permitted', `<p>${esc(medLabel(medId))} cannot be overridden at this cabinet. Contact pharmacy.</p>`);
  const yes = await modal({ title: 'Override', body: `<p>Do you wish to override <b>${esc(medLabel(medId))}</b>?</p><p class="muted">The medication will be removed without a pharmacist-reviewed order.</p>`, buttons: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes', primary: true }] });
  if (yes.value !== 'yes') return;
  const allergy = p.allergies.find(a => (ALLERGY_CLASSES[a.key] || []).includes(medId));
  if (allergy) {
    const r = await modal({ title: '<span class="alert-title">Allergy Alert</span>', cls: 'alert', body: `<p><b>${esc(patName(p))}</b> has a documented allergy to <b>${esc(allergy.agent)}</b> (${esc(allergy.reaction)}).</p><p>You selected <b>${esc(medLabel(medId))}</b>.</p><p class="muted">Stop and clarify with the prescriber before giving any medication the patient is allergic to.</p>`,
      buttons: [{ label: 'Override Allergy', value: 'proceed', cls: 'danger' }, { label: 'Cancel', value: 'cancel', primary: true }] });
    emit('allergy_alert', { patient: p.id, med: medId, action: r.value });
    if (r.value !== 'proceed') return toast('Override cancelled. Clarify the order with the prescriber.');
  }
  const rr = await modal({ title: `Remove Meds for: ${esc(p.last)}, ${esc(p.first)} — Select Override Reason`, body: `${OMNI_OVERRIDE_REASONS.map(x => `<label class="radio"><input type="radio" name="reason" value="${esc(x)}"> <span>${esc(x)}</span></label>`).join('')}
      <label for="ovtext">Enter Override Reason (if none of the reasons apply)</label><input id="ovtext">`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'OK', value: 'ok', primary: true }],
    validate: (v, d) => d.reason || (d.ovtext || '').length > 2 ? null : 'Select the reason for the override, or enter your own.' });
  if (rr.value !== 'ok') return;
  const reason = rr.data.ovtext && !rr.data.reason ? rr.data.ovtext : rr.data.reason;
  const dose = await askDose(medId, { override: true }); if (dose == null) return;
  emit('override_reason', { reason });
  session.cart.push(cartItem(medId, dose, { key: 'ov-' + medId, orderId: null, override: true, reason, note: reason }));
  session.tab = 'display';
  render();
}

async function omniRemoveItem(p, it) {
  const m = F[it.med], who = `${esc(p.last)}, ${esc(p.first)}`;
  if (db.physical[it.med] < it.qty) { await info('Insufficient Quantity', `<p>There are not enough ${esc(medLabel(it.med))} in this bin. Press <b>Find Item</b> to check availability in other cabinets, and notify pharmacy.</p>`); return null; }
  let countNote = '';
  if (m.controlled) {
    // Blind count: the nurse counts what is in the bin BEFORE taking anything out.
    let attempts = 0;
    for (;;) {
      const c = await step({ title: `Removing Meds for ${who}`, body: `${drawerView(it.med, { contents: 'items' })}
          <div class="count-box"><label for="count">Count every ${unitWord(it.med, 1)} in the open bin <b>before</b> you remove anything. Quantity in Bin:</label>
          <div class="inline"><input id="count" type="number" inputmode="numeric" min="0"><span>EA</span></div></div>`,
        hint: 'Blind count: follow the guiding lights to the open bin, count the quantity in the bin before removing, then press OK.',
        buttons: [{ label: 'Skip Item', value: 'skip', novalidate: true }, { label: 'OK', value: 'ok', primary: true }],
        validate: (v, d) => d.count === '' || isNaN(parseInt(d.count, 10)) ? 'Enter the quantity in the bin.' : null });
      if (c.value !== 'ok') return null;
      const n = parseInt(c.data.count, 10), sys = db.inventory[it.med], phys = db.physical[it.med];
      if (n === sys) { emit('count', { med: it.med, correct: n === phys }); break; }
      if (++attempts === 1) { await info('Recount', '<p>The quantity you entered does not match the expected quantity. Count the bin again, one item at a time.</p>', 'Recount'); continue; }
      db.discrepancies.push({ id: uid(), t: Date.now(), med: it.med, user: session.user, patient: p.id, expected: sys, counted: n, resolved: false });
      addTx({ type: 'Discrepancy', patient: p.id, med: it.med, amount: `exp ${sys} / cnt ${n}`, note: 'Blind count mismatch' });
      db.inventory[it.med] = n;
      emit('count', { med: it.med, correct: n === phys });
      emit('discrepancy_created', { med: it.med });
      countNote = 'Discrepancy created at the blind count — press Main Menu → Resolve Discrep before the end of your shift.';
      await info('<span class="alert-title">Discrepancy</span>', `<p>Your second count (<b>${n}</b>) does not match the quantity the cabinet expected. A discrepancy has been created.</p><p>You may continue this removal. The <b>Resolve Discrep</b> button is now active; resolve it by the end of your shift.</p>`, 'OK', 'alert');
      break;
    }
  }
  const r = await step({ title: `Removing Meds for ${who}`, body: `${drawerView(it.med, { contents: m.controlled ? 'items' : 'label' })}
      <div class="take"><div class="take-n">${it.qty}</div><div><b>Remove ${it.qty} ${unitWord(it.med, it.qty)}</b> of ${esc(medLabel(it.med))} ${esc(medDesc(it.med))}<br><span class="muted">Intended dose: ${num(it.dose)} ${m.unit}${it.override ? ' · OVERRIDE' : ''}</span></div></div>`,
    hint: 'Follow the guiding lights. Open the drawer with the blinking green LED, open the lit bin and remove the item. Press OK when you have removed it.',
    buttons: [{ label: 'Skip Item', value: 'skip' }, { label: 'OK', value: 'ok', primary: true }] });
  if (r.value !== 'ok') {
    if (it.nursePrep) {
      const k = await modal({ title: 'Skip Item', body: '<p>Skip this component? This results in a <b>partial issue</b> of the nurse-prepared med order. Once you skip, do not remove the item even if some quantity is available.</p>', buttons: [{ label: 'No', value: 'no', primary: true }, { label: 'Yes', value: 'yes' }] });
      if (k.value !== 'yes') return omniRemoveItem(p, it);
    }
    return null;
  }
  db.inventory[it.med] -= it.qty; db.physical[it.med] -= it.qty;
  return afterRemoval(p, it, null, countNote);
}

/* ---------- Omnicell waste / return / discrepancy ---------- */
async function omniWasteFlow(rem, synthetic = false) {
  const m = F[rem.med], id = rem.med, p = PAT(rem.patient), ch = db.settings.challenge, liquid = !!m.volume;
  const outstanding = outstandingOf(rem);
  if (outstanding <= 0) { await info('Nothing to Waste', '<p>This Patient Medication Account is reconciled.</p>'); return false; }
  const expected = Math.max(0, +(rem.expectedWaste - rem.wasted).toFixed(4));
  const r = await modal({ title: `Wasting Meds for ${esc(p.last)}, ${esc(p.first)}`, body: `<h3 class="o-item">${esc(medLabel(id))} ${esc(medDesc(id))}</h3>
      <dl class="facts"><dt>Outstanding Issued Amount:</dt><dd><b>${num(outstanding)} ${m.unit.toUpperCase()}</b></dd></dl>
      <label for="admin">Administration Amount (${m.unit})</label><div class="inline"><input id="admin" type="number" inputmode="decimal" step="any" ${rem.adminDone ? 'value="0" readonly' : ch ? '' : `value="${num(rem.dose)}"`}><span>${m.unit.toUpperCase()}</span></div>
      <label for="wamt">Waste Amount (${m.unit})</label><div class="inline"><input id="wamt" type="number" inputmode="decimal" step="any" ${ch ? '' : `value="${num(expected)}"`} data-volfor="${liquid && !ch ? id : ''}"><span>${m.unit.toUpperCase()}</span> <span class="vol-out mono">${liquid && !ch ? `= ${num(volOf(id, expected))} mL` : ''}</span></div>
      ${liquid ? `<p class="small muted">Volume Converter: ${num(m.strength / m.volume)} ${m.unit}/mL.${ch ? ' Enter the volume you will waste.' : ''}</p>` : ''}
      ${ch && liquid ? '<label for="wvol">Waste Volume (mL)</label><div class="inline"><input id="wvol" type="number" inputmode="decimal" step="any"><span>mL</span></div>' : ''}
      <label for="wreason">Waste Reason</label><select id="wreason"><option value="">— List of Reasons —</option>${OMNI_WASTE_REASONS.map(x => `<option>${esc(x)}</option>`).join('')}</select>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'OK', value: 'ok', primary: true }],
    validate: (v, d) => {
      const a = parseFloat(d.admin), w = parseFloat(d.wamt);
      if (isNaN(a) || a < 0) return 'Enter the Administration Amount (enter 0 if none was given).';
      if (isNaN(w) || w < 0) return 'Enter the Waste Amount.';
      if (a + w > outstanding + 1e-6) return `Administration + Waste (${num(a + w)}) cannot be greater than the Outstanding Issued Amount (${num(outstanding)} ${m.unit}).`;
      if (a + w < outstanding - 1e-6) return `Administration + Waste (${num(a + w)}) is less than the Outstanding Issued Amount (${num(outstanding)} ${m.unit}). ${num(outstanding - a - w)} ${m.unit} would stay open on your PMA — recheck your amounts.`;
      if (ch && liquid) { const vol = parseFloat(d.wvol); if (isNaN(vol) || Math.abs(vol - volOf(id, w)) > 0.011) return `The volume does not match ${num(w)} ${m.unit} at ${num(m.strength / m.volume)} ${m.unit}/mL. Volume = amount ÷ concentration.`; }
      if (!d.wreason) return 'You must provide a waste reason. Select one from the List of Reasons.';
      return null;
    } });
  if (r.value !== 'ok') return false;
  const a = parseFloat(r.data.admin), w = parseFloat(r.data.wamt);
  const wit = await witnessFlow(`Have your witness enter their User ID and password to witness the waste of <b>${amtText(id, w)}</b> of ${esc(medLabel(id))}.`);
  if (!wit) return false;
  const bin = await modal({ title: 'Waste Contents', body: '<p>Do you want to place the waste contents into the return bin?</p>', buttons: [{ label: 'No', value: 'no' }, { label: 'Yes', value: 'yes', primary: true }] });
  await info(bin.value === 'yes' ? 'Access Return Bin Now' : 'Record Waste Now', bin.value === 'yes'
    ? `<p>With <b>${esc(userName(wit))}</b> watching, place the waste in the return bin and close the lid. Enclose the waste receipt if your facility requires it.</p>`
    : `<p>With <b>${esc(userName(wit))}</b> watching, waste <b>${amtText(id, w)}</b> per hospital policy (e.g., controlled-substance waste container).</p>`, 'Done');
  if (!rem.adminDone) { rem.dose = a; rem.adminDone = true; rem.expectedWaste = +((rem.qty - (rem.returnedQty || 0)) * m.strength - a).toFixed(4); }
  rem.wasted = +(rem.wasted + w).toFixed(4); rem.witness = wit;
  rem.undocumented = outstandingOf(rem) > 1e-6;
  addTx({ type: 'Waste', patient: rem.patient, med: id, amount: amtText(id, w), witness: wit, note: `${r.data.wreason}; admin ${num(a)} ${m.unit}${synthetic ? '; misc. waste' : ''}` });
  emit('waste', { med: id, amount: w, patient: rem.patient, witness: wit });
  toast(`Waste recorded: ${amtText(id, w)}`, 'good');
  return true;
}

async function omniReturnFlow(rem) {
  const m = F[rem.med], p = PAT(rem.patient), left = rem.qty - rem.returnedQty, outstanding = outstandingOf(rem);
  const r = await modal({ title: `Return Meds for ${esc(p.last)}, ${esc(p.first)}`, body: `<h3 class="o-item">${esc(medLabel(rem.med))} ${esc(medDesc(rem.med))}</h3>
      <dl class="facts"><dt>Outstanding Issued Amount:</dt><dd><b>${num(outstanding)} ${m.unit.toUpperCase()}</b> (${left} ${unitWord(rem.med, left)})</dd></dl>
      <label for="radmin">Administration Amount (${m.unit}) — enter 0 if none was given</label><div class="inline"><input id="radmin" type="number" inputmode="decimal" step="any" value="0"><span>${m.unit.toUpperCase()}</span></div>
      <label for="rq">Quantity to Return</label><div class="inline"><input id="rq" type="number" inputmode="numeric" min="1" max="${left}" value="${left}"><span>EA</span></div>
      <label for="rreason">Return reason</label><select id="rreason"><option value="">— select —</option><option>Patient refused</option><option>Dose held</option><option>Order discontinued</option><option>Patient transferred or discharged</option></select>
      <label class="check"><input type="checkbox" id="sealed"> The package is sealed and unopened</label>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Return Now', value: 'ok', primary: true }],
    validate: (v, d) => { const q = parseInt(d.rq, 10), a = parseFloat(d.radmin);
      if (!(q >= 1 && q <= left)) return `Enter a Quantity to Return from 1 to ${left}.`;
      if (isNaN(a) || a < 0) return 'Enter the Administration Amount (0 if none).';
      if (a + q * m.strength > outstanding + 1e-6) return 'The administration and return amounts combined cannot be greater than the outstanding issued amount.';
      if (!d.sealed) return 'Only unopened items can be returned. Waste an opened controlled substance instead.';
      if (!d.rreason) return 'Select a return reason.';
      return null; } });
  if (r.value !== 'ok') return;
  const q = parseInt(r.data.rq, 10);
  let witness = null;
  if (m.controlled) { witness = await witnessFlow(`Have your witness enter their User ID and password for the return of <b>${q} ${unitWord(rem.med, q)}</b> of ${esc(medLabel(rem.med))}.`); if (!witness) return; }
  await step({ title: `Return Meds for ${esc(p.last)}, ${esc(p.first)}`, body: `<div class="drawer-view"><div class="dv-loc"><span class="light"></span><div><b>External Return Bin</b><span class="muted">Follow the screen prompt: open the return bin and place the contents inside.</span></div></div>
      <div class="return-art" aria-hidden="true"><div class="return-slot">${Array.from({ length: q }, () => unitIcon(rem.med)).join('')}</div><span>RETURN BIN</span></div></div>
      <p>Place <b>${q} ${unitWord(rem.med, q)}</b> in the return bin${witness ? ` while ${esc(userName(witness))} watches` : ''}, close the lid, then press OK.</p>`,
    hint: 'Returns made to the return bin are reconciled by pharmacy.', buttons: [{ label: 'OK', value: 'ok', primary: true }] });
  rem.returnedQty += q;
  if (rem.returnedQty >= rem.qty) { rem.expectedWaste = 0; rem.undocumented = false; if (rem.orderId && db.orders[rem.orderId]) delete db.orders[rem.orderId].given; }
  addTx({ type: 'Return', patient: rem.patient, med: rem.med, amount: `${q} ${unitWord(rem.med, q)}`, witness, note: `${r.data.rreason}; return bin` });
  emit('returned', { med: rem.med, patient: rem.patient, qty: q });
  toast('Return recorded.', 'good');
  go('returns');
}

async function omniResolve(d) {
  let reason = '', counted = false;
  const prev = () => { const t = db.tx.filter(x => x.med === d.med && x.user !== d.user && x.t <= d.t).sort((a, b) => b.t - a.t)[0]; return t ? userName(t.user) : '—'; };
  for (;;) {
    const r = await step({ title: 'Discrepancy Resolution', body: `<dl class="facts o-facts">
        <dt>Patient Name:</dt><dd>${d.patient ? esc(patName(PAT(d.patient))) : 'FLOOR STOCK'}</dd><dt>Item:</dt><dd><b>${esc(medLabel(d.med))} ${esc(medDesc(d.med))}</b></dd>
        <dt>Found by:</dt><dd>${esc(userName(d.user))}</dd><dt>Found at:</dt><dd class="mono">${oDate(d.t)}</dd><dt>Previous User:</dt><dd>${esc(prev())}</dd>
        <dt>Qty Expected:</dt><dd class="mono">${d.expected} EA</dd><dt>Qty Found:</dt><dd class="mono">${d.counted} EA</dd><dt>${d.counted >= d.expected ? 'Adj Up' : 'Adj Down'}:</dt><dd class="mono">${Math.abs(d.counted - d.expected)} EA</dd>
        <dt>Qty Remaining:</dt><dd class="mono">${db.inventory[d.med]} EA${counted ? ' (cycle counted)' : ''}</dd></dl>
        <label for="rr">Resolution Reason:</label><input id="rr" value="${esc(reason)}">`,
      hint: 'Please enter the reason for the discrepancy or select a reason from the list. Use Transaction History to investigate and Cycle Count to confirm the bin level.',
      tabs: oMenu('rd'),
      left: oSide([['Transaction History', 'data-resolve="hist" data-novalidate'], ['List of Resolve Reasons', 'data-resolve="list" data-novalidate'], ['Previous Screen', 'data-resolve="back" data-novalidate', 'back']]),
      buttons: [{ label: 'Resolve Discrep', value: 'resolve', primary: true }, { label: 'Cycle Count', value: 'count', novalidate: true }] });
    reason = r.data.rr || reason;
    if (r.value === 'back') return go('disc');
    if (r.value === 'hist') { await info(`Transaction History — ${esc(medLabel(d.med))}`, txTable(db.tx.filter(t => t.med === d.med).sort((a, b) => b.t - a.t).slice(0, 10))); continue; }
    if (r.value === 'list') {
      const l = await modal({ title: 'List of Resolve Reasons', body: OMNI_RESOLVE_REASONS.map(x => `<label class="radio"><input type="radio" name="dr" value="${esc(x)}"> <span>${esc(x)}</span></label>`).join(''),
        buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'OK', value: 'ok', primary: true }], validate: (v, x) => x.dr ? null : 'Select a reason.' });
      if (l.value === 'ok') reason = l.data.dr;
      continue;
    }
    if (r.value === 'count') {
      const c = await step({ title: `Cycle Count — ${esc(medLabel(d.med))}`, body: `${drawerView(d.med, { contents: 'items' })}<div class="count-box"><label for="cc">Count every item in the bin.</label><div class="inline"><input id="cc" type="number" inputmode="numeric" min="0"><span>EA</span></div></div>`,
        hint: 'Cycle count verifies quantity on hand. A witness may be required.', buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'OK', value: 'ok', primary: true }],
        validate: (v, x) => { const n = parseInt(x.cc, 10); if (isNaN(n)) return 'Enter the count.'; if (n !== db.physical[d.med]) return 'That count does not match what is in the bin. Count again, one item at a time.'; return null; } });
      if (c.value === 'ok') { db.inventory[d.med] = parseInt(c.data.cc, 10); counted = true; addTx({ type: 'Count', med: d.med, amount: `count ${db.inventory[d.med]}`, note: 'Cycle count during discrepancy resolution' }); }
      continue;
    }
    if (!reason.trim()) { await info('Resolution Reason Required', '<p>Enter the reason for the discrepancy or press <b>List of Resolve Reasons</b>.</p>'); continue; }
    if (!counted) {
      const k = await modal({ title: 'Cycle Count Not Done', body: '<p>Perform a cycle count to confirm the correct bin level before resolving. This helps prevent another discrepancy.</p>', buttons: [{ label: 'Resolve Anyway', value: 'go' }, { label: 'Cycle Count', value: 'count', primary: true }] });
      if (k.value === 'count') continue;
    }
    const w = await witnessFlow(`Have your witness enter their User ID and password to resolve the ${esc(medLabel(d.med))} discrepancy.`);
    if (!w) continue;
    Object.assign(d, { resolved: true, reason, witness: w, resolvedBy: session.user, resolvedAt: Date.now() });
    addTx({ type: 'Resolve', med: d.med, amount: `bin ${db.inventory[d.med]}`, witness: w, note: reason });
    emit('discrepancy_resolved', { med: d.med });
    toast('Discrepancy resolved.', 'good');
    return go('disc');
  }
}

/* ---------- temporary patients (Pyxis: Add Temporary Patient · Omnicell: Add New Patient) ---------- */
async function addTempPatient() {
  const omni = isOmni();
  const r = await modal({ title: omni ? 'New Patient Information' : 'Add Temporary Patient', body: `
      <p class="muted">${omni ? 'Adding a patient should be rare. Check the Global List first, and enter the information carefully so the record can be reconciled.' : 'Before adding a temporary patient, search the facility to be sure the patient is not already in the system (for example, not yet transferred).'}</p>
      <label for="tl">Last name *</label><input id="tl" autocomplete="off">
      <label for="tf">First name</label><input id="tf" autocomplete="off">
      <label for="tr">${omni ? 'Room *' : 'Unit / room *'}</label><input id="tr" placeholder="e.g., 424-A" autocomplete="off">
      <label for="tid">Patient ID / MRN (if known)</label><input id="tid" autocomplete="off">
      <label>Date of birth (complete all fields, or leave all blank)</label>
      <div class="inline dob"><input id="tm" placeholder="MM" inputmode="numeric" maxlength="2" aria-label="Birth month"><input id="tdd" placeholder="DD" inputmode="numeric" maxlength="2" aria-label="Birth day"><input id="ty" placeholder="YYYY" inputmode="numeric" maxlength="4" aria-label="Birth year"></div>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: omni ? 'Add New Patient' : 'Accept', value: 'ok', primary: true }],
    validate: (v, d) => {
      if (!/[a-z]/i.test(d.tl)) return 'Last name is required.';
      if (!d.tr) return omni ? 'Room is required.' : 'Unit / room is required.';
      const parts = [d.tm, d.tdd, d.ty].filter(Boolean).length;
      if (parts && parts < 3) return 'If entering the date of birth, all fields must be completed (month, day and year).';
      if (parts === 3) { const dt = new Date(+d.ty, +d.tm - 1, +d.tdd); if (d.ty.length !== 4 || dt.getMonth() !== +d.tm - 1 || dt > new Date()) return 'Enter a valid date of birth.'; }
      return null;
    } });
  if (r.value !== 'ok') return;
  const d = r.data;
  if (d.tid) {
    const match = allPatients().find(p => p.mrn === d.tid.trim());
    if (match) {
      const m = await modal({ title: 'Active Patient Found', body: `<p>An active patient already matches ID <b class="mono">${esc(d.tid)}</b>:</p><p><b>${esc(patName(match))}</b> · Room ${esc(match.room)} · DOB ${fmtDob(match.dob)}</p><p class="muted">Select the active patient to avoid creating a duplicate record.</p>`,
        buttons: [{ label: 'Create Anyway', value: 'create' }, { label: 'Select Active Patient', value: 'select', primary: true }] });
      if (m.value === 'select') { session.sel = match.id; return go(omni ? 'pt' : 'patients', { listTab: 'all' }); }
    }
  }
  const cap = x => x.trim().charAt(0).toUpperCase() + x.trim().slice(1);
  const n = db.tempPatients.length + 1;
  const p = { id: 'T' + n, last: cap(d.tl), first: d.tf ? cap(d.tf) : 'Unknown', mi: '', sex: 'U', dob: d.ty ? `${d.ty}-${pad(+d.tm)}-${pad(+d.tdd)}` : null,
    mrn: d.tid ? d.tid.trim() : `TMP${String(n).padStart(4, '0')}`, room: d.tr.trim().toUpperCase(), allergies: [], allergyUnknown: true,
    dx: 'Temporary patient — reconcile with the permanent record', provider: '—', orders: [], temp: true };
  db.tempPatients.push(p); save();
  emit('temp_added', { patient: p.id, last: p.last });
  toast(`Temporary patient added: ${patName(p)}`, 'good');
  session.sel = p.id;
  go(omni ? 'pt' : 'patients', { listTab: omni ? 'local' : 'all' });
}

/* ---------- system kits ---------- */
const kitList = () => KITS.map(k => `<b>${esc(k.name)}</b> — ${esc(k.use)}<br><span class="muted small">${k.items.map(i => `${i.qty} × ${esc(medLabel(i.med))} ${esc(medDesc(i.med))}`).join(' · ')}</span>`);
async function kitsModal() {
  const r = await modal({ title: 'System Kits', body: `<p class="muted">Kits are removed outside the patient's profile, so a profiled MedStation treats them as an <b>override</b>.</p>
      ${KITS.map((k, i) => `<label class="radio"><input type="radio" name="kit" value="${k.id}"> <span>${kitList()[i]}</span></label>`).join('')}`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Select Kit', value: 'ok', primary: true }], validate: (v, d) => d.kit ? null : 'Select a kit.' });
  if (r.value === 'ok') { await pickKit(r.data.kit, true); render(); }
}
async function pickKit(kitId, confirmed = false) {
  const k = KITS.find(x => x.id === kitId), p = PAT(session.sel);
  if (session.cart.some(c => c.group === 'kit-' + kitId)) return toast('That kit is already selected.');
  if (!confirmed) {
    const r = await modal({ title: esc(k.name), body: `<p>${esc(k.use)}</p><ul>${k.items.map(i => `<li>${i.qty} × ${esc(medLabel(i.med))} ${esc(medDesc(i.med))}</li>`).join('')}</ul><p class="muted">Verify the kit and quantities. You will be guided to each item in turn.</p>`,
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'OK', value: 'ok', primary: true }] });
    if (r.value !== 'ok') return;
  }
  k.items.forEach((it, i) => session.cart.push({ med: it.med, qty: it.qty, dose: it.qty * F[it.med].strength, key: `kit-${kitId}#${i}`, group: `kit-${kitId}`, kit: kitId, orderId: null, override: true, note: `Kit: ${k.name}` }));
  emit('kit_selected', { kit: kitId, patient: p.id });
  toast(`${k.name} added (${k.items.length} items).`);
}
OMNI.kits = () => {
  const p = PAT(session.sel), cart = session.cart, show = session.kitTab === 'display';
  const rows = show ? cart.map(c => `<div class="orow med1"><span><b>${esc(medLabel(c.med))} ${esc(medDesc(c.med))}</b><br>${esc(c.note || '')}</span><span class="oright">Qty ${c.qty}</span></div>`).join('')
    : KITS.map((k, i) => `<button class="orow med1${cart.some(c => c.kit === k.id) ? ' selk' : ''}" data-act="kitPick" data-id="${k.id}"><span>${kitList()[i]}</span><span class="oright">${cart.some(c => c.kit === k.id) ? '<b>Selected</b>' : ''}</span></button>`).join('');
  return { title: oTitle(`Remove Kits for: ${esc(p.last)}, ${esc(p.first)}`, p), body: `<div class="olist">${rows || '<p class="empty-line">No items selected.</p>'}</div>`,
    hint: 'Select the desired kit and acknowledge alerts. To add another kit, select it too. The Display Selected Items tab lists every item that will be removed.',
    tabs: `<button type="button" class="otab${!show ? ' on' : ''}" data-act="kitTab" data-t="kits">Kits</button><button type="button" class="otab${show ? ' on' : ''}" data-act="kitTab" data-t="display">Display Selected Items</button>`,
    left: cart.length ? oSide([['Cancel Med List', 'data-act="cancelMedList"', 'red']]) : oSide([['Previous Screen', 'data-act="go" data-to="pt"', 'back']]),
    footer: oSide([['Remove Now', `data-act="removeMeds"${cart.length ? '' : ' disabled'}`, 'go']]) };
};

/* ---------- nurse-prepared med orders ---------- */
async function selectNursePrep(o) {
  const p = PAT(session.sel), np = o.nursePrep;
  const r = await modal({ title: isOmni() ? 'Nurse-prepared Med Order' : 'Nurse-prepared Order', body: `<p><b>${esc(medLabel(o.med))}</b> ${esc(sig(o))}</p><p>${esc(np.label)}</p>
      <h3>Component Details</h3><ul>${np.items.map(c => `<li>${c.qty} × <b>${esc(medLabel(c.med))}</b> ${esc(medDesc(c.med))} <span class="muted small">— ${esc(locText(c.med))}</span></li>`).join('')}</ul>
      <p class="muted">Selecting this order selects every component. You cannot change the intended dose or quantity.${isOmni() ? ' Overrides are not permitted for nurse-prepared med orders.' : ''} Prepare the order per hospital policy before giving it.</p>`,
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'OK', value: 'ok', primary: true }] });
  if (r.value !== 'ok') return;
  emit('nurseprep_selected', { order: o.id, patient: p.id });
  np.items.forEach((c, i) => session.cart.push({ med: c.med, qty: c.qty, dose: c.qty * F[c.med].strength, key: `${o.id}#${i}`, group: o.id, orderId: o.id, nursePrep: true, override: false, note: 'Nurse-prepared component' }));
  if (isOmni()) session.tab = 'display';
  render();
}

/* ---------- reports / clipboard ---------- */
function reportText() {
  const list = db.tx.filter(t => session.reportAll || t.user === session.user).sort((a, b) => a.t - b.t);
  return `${D().model} practice — Activity report (${session.reportAll ? 'all users' : userName(session.user)}) — ${dateStr(Date.now())}\n` +
    list.map(t => `${hhmm(t.t)}  ${t.type.padEnd(11)} ${t.patient ? patName(PAT(t.patient)) : '—'} | ${medLabel(t.med)} ${medDesc(t.med)} | ${t.amount} | user ${userName(t.user)}${t.witness ? ' | witness ' + userName(t.witness) : ''}${t.note ? ' | ' + t.note : ''}`).join('\n');
}
function copyText(txt) {
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied.'); } catch { toast('Select and copy the text manually.'); } ta.remove(); };
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Copied to clipboard.', 'good'), fallback); else fallback();
}

/* ---------- practice modes (same structure as the IV Pump Practice Lab) ----------
 * practice: endless random tasks with a score
 * free: explore with no checklist · scen: guided scenarios with hints and a debrief */
let rcT = null;
function renderCoachSoon() { clearTimeout(rcT); rcT = setTimeout(renderCoach, 0); }

function seedRemoval({ patient, med, orderId, dose, minsAgo = 30, refused = false }) {
  const m = F[med], q = m.noSplit ? 1 : Math.max(1, Math.ceil(dose / m.strength - 1e-9)), t = Date.now() - minsAgo * MIN;
  const exp = m.controlled && !m.noSplit && !refused ? +(q * m.strength - dose).toFixed(4) : 0;
  db.inventory[med] -= q; db.physical[med] -= q;
  db.removals.push({ id: uid(), t, user: 'student', patient, med, orderId, qty: q, dose, override: false, expectedWaste: exp, wasted: exp, adminDone: !refused, returnedQty: 0, undocumented: false, witness: exp ? 'kjones' : undefined });
  if (orderId) { const o = orderById(orderId); db.orders[orderId] = { lastRemoved: t, by: 'student', ...(o.prn ? {} : { given: t }) }; }
  db.tx.push({ id: uid(), t, user: 'student', type: 'Remove', patient, med, amount: `${q} ${unitWord(med, q)} / dose ${num(dose)} ${m.unit}`, note: 'Earlier this shift' });
  if (exp) db.tx.push({ id: uid(), t: t + MIN, user: 'student', type: 'Waste', patient, med, amount: amtText(med, exp), witness: 'kjones', note: 'Earlier this shift' });
}

const PCATS = { all: 'All task types', routine: 'Scheduled & PRN meds', cs: 'Controlled substances & waste', override: 'Emergency overrides', ret: 'Returns', safety: 'Safety checks (hold & clarify)' };
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ordOf = oid => { const o = orderById(oid); return { o, p: PATIENTS.find(x => x.orders.includes(o)) }; };
const who = pid => { const p = PAT(pid); return `<b>${esc(p.first)} ${esc(p.last)}</b> (${esc(p.room)})`; };

const TASKGEN = {
  routine: [
    () => { const oid = pickOne(['o101', 'o102', 'o103', 'o104', 'o105', 'o204', 'o205', 'o206', 'o403', 'o404', 'o405', 'o502', 'o504']), { o, p } = ordOf(oid);
      return { cat: 'routine', kind: 'remove', patient: p.id, med: o.med, orderId: oid, dose: o.dose, tab: 'due',
        text: `It is time for ${who(p.id)}'s scheduled <b>${esc(medLabel(o.med))} ${esc(sig(o))}</b>, due at <b>${hhmm(dueTime(o))}</b>. Remove the dose.` }; },
    () => { const c = pickOne([{ oid: 'o106', why: 'has a fever and a headache' }, { oid: 'o108', why: 'is nauseated and has vomited' }, { oid: 'o203', why: 'is nauseated' }, { oid: 'o306', why: 'is wheezing' }, { oid: 'o307', why: 'reports mild pain' }]), { o, p } = ordOf(c.oid);
      return { cat: 'routine', kind: 'remove', patient: p.id, med: o.med, orderId: c.oid, dose: o.dose, tab: 'prn',
        text: `${who(p.id)} ${c.why}. Order: <b>${esc(medLabel(o.med))} ${esc(sig(o))}</b>. Remove one dose.` }; },
  ],
  cs: [
    () => { const c = pickOne([{ oid: 'o107', a: 'is asking for pain medicine' }, { oid: 'o305', a: 'is anxious and restless' }, { oid: 'o501', a: 'is asking for pain medicine (there are two Thompsons on the unit)' }, { oid: 'o402', a: 'is asking for pain medicine' }]), { o, p } = ordOf(c.oid);
      return { cat: 'cs', kind: 'remove', patient: p.id, med: o.med, orderId: c.oid, dose: o.dose, tab: 'prn',
        text: `${who(p.id)} ${c.a}. Order: <b>${esc(medLabel(o.med))} ${esc(sig(o))}</b>. Stock: ${esc(medDesc(o.med))}. Remove the dose and waste any unused portion <b>now</b> with a witness.` }; },
    () => { const c = pickOne([{ oid: 'o201', doses: [0.2, 0.3, 0.4, 0.5, 0.6] }, { oid: 'o202', doses: [5, 10] }]), { o, p } = ordOf(c.oid), d = pickOne(c.doses);
      return { cat: 'cs', kind: 'remove', patient: p.id, med: o.med, orderId: c.oid, dose: d, range: true, tab: 'prn',
        text: `${who(p.id)} is asking for pain medicine. Range order: <b>${esc(medLabel(o.med))} ${esc(sig(o))}</b>. Per the titration guideline you will give <b>${num(d)} ${F[o.med].unit}</b>. Stock: ${esc(medDesc(o.med))}. Remove it and waste any unused portion <b>now</b>.` }; },
  ],
  override: [
    () => { const c = pickOne([
        { pid: 'P4', med: 'naloxone_inj', dose: 0.4, why: 'is very hard to arouse after an opioid', how: 'IV now' },
        { pid: 'P3', med: 'dextrose50_inj', dose: 25, why: 'has a critically low blood sugar and cannot swallow', how: 'IV push now' },
        { pid: 'P1', med: 'nitroglycerin_sl', dose: 0.4, why: 'has new chest pain', how: 'SL now' },
        { pid: 'P3', med: 'epinephrine_inj', dose: 0.3, why: 'has hives and wheezing minutes after an IV antibiotic (anaphylaxis)', how: 'IM now' },
        { pid: 'P2', med: 'diphenhydramine_inj', dose: 25, why: 'has new itchy hives on both arms', how: 'IV now' }]);
      return { cat: 'override', kind: 'remove', override: true, patient: c.pid, med: c.med, dose: c.dose,
        text: `Rapid response: ${who(c.pid)} ${c.why}. The provider gives a verbal order that pharmacy has not verified: <b>${esc(medLabel(c.med))} ${num(c.dose)} ${F[c.med].unit} ${F[c.med].route} ${c.how}</b>. Remove it on override.` }; },
  ],
  ret: [
    () => { const c = pickOne([{ oid: 'o202', dose: 5, why: 'says the pain has eased and declines it' }, { oid: 'o108', dose: 4, why: 'says the nausea has passed' }, { oid: 'o402', dose: 5, why: 'has fallen asleep comfortably' }, { oid: 'o307', dose: 650, why: 'declines it' }]), { o, p } = ordOf(c.oid);
      const q = cartItem(o.med, c.dose, {}).qty;
      return { cat: 'ret', kind: 'return', patient: p.id, med: o.med, orderId: c.oid, dose: c.dose, qty: q, seed: () => seedRemoval({ patient: p.id, med: o.med, orderId: c.oid, dose: c.dose, minsAgo: 0, refused: true }),
        text: `You just removed <b>${q} ${unitWord(o.med, q)} of ${esc(medLabel(o.med))}</b> for ${who(p.id)}. At the bedside the patient ${c.why}. The package is sealed. Return it.` }; },
  ],
  safety: [
    () => ({ cat: 'safety', kind: 'hold', patient: 'P4', med: 'morphine_inj', dose: 2, override: true,
        text: `A covering provider in the hallway asks you to "grab morphine 2 mg IV" for ${who('P4')}, who is in pain. There is no written order yet.`, holdWhy: 'Robert Thompson is allergic to morphine (hives): do not give it; clarify the order with the prescriber.' }),
    () => { const mins = rint(60, 150); return { cat: 'safety', kind: 'hold', patient: 'P1', med: 'morphine_inj', orderId: 'o107', dose: 2, tab: 'prn',
        seed: () => seedRemoval({ patient: 'P1', med: 'morphine_inj', orderId: 'o107', dose: 2, minsAgo: mins }),
        text: `${who('P1')} asks for more pain medicine. Order: <b>morphine 2 mg IV q4h PRN severe pain</b>.`, holdWhy: `The last dose was removed ${mins} minutes ago. The order is every 4 hours, so the next dose is not due yet.` }; },
    () => { const c = pickOne(['o405', 'o502', 'o105', 'o205']), { o, p } = ordOf(c), mins = rint(20, 50);
      return { cat: 'safety', kind: 'hold', patient: p.id, med: o.med, orderId: c, dose: o.dose, tab: 'all',
        seed: () => seedRemoval({ patient: p.id, med: o.med, orderId: c, dose: o.dose, minsAgo: mins }),
        text: `A classmate asks you to get ${who(p.id)}'s ${hhmm(dueTime(o))} <b>${esc(medLabel(o.med))} ${esc(sig(o))}</b> "because nobody has given it yet."`, holdWhy: `This dose was already removed ${mins} minutes ago. Removing it again could cause a double dose — check the eMAR and ask who removed it.` }; },
  ],
};
function genTask(cat) { const pool = cat && cat !== 'all' ? TASKGEN[cat] : Object.values(TASKGEN).flat(); return pickOne(pool)(); }

let PX = { task: null, events: [], result: null, held: false, showAnswer: false };
function newTask(same = false, quiet = false) {
  refreshShift();
  const t = same && PX.task ? PX.task : genTask(db.pfilter || 'all');
  cancelFlows(); session.cart = [];
  if (t.orderId) delete db.orders[t.orderId];
  if (db.physical[t.med] < 6) db.physical[t.med] = F[t.med].count;
  db.inventory[t.med] = db.physical[t.med];
  if (t.seed) t.seed();
  const mine = db.myPatients.student || [];
  db.myPatients.student = mine.includes(t.patient) ? mine : [...mine, t.patient];
  PX = { task: t, events: [], result: null, held: false, showAnswer: false };
  save();
  if (quiet) return;
  if (session.user) go(isOmni() ? 'patients' : 'home'); else go('standby');
}
function practiceEvent(e) {
  if (db.mode !== 'practice' || !PX.task || PX.result) return;
  PX.events.push(e);
  const t = PX.task;
  if (t.kind === 'return' ? e.type === 'returned' : e.type === 'txn_done') finishTask(false);
  else if (t.kind === 'hold' && e.med === t.med && (e.type === 'hold_cancel' || e.type === 'prn_hold' || (e.type === 'allergy_alert' && e.action === 'cancel'))) finishTask(true);
}
function finishTask(held) {
  PX.held = PX.held || held;
  PX.result = evalTask(PX.task, PX.events, PX.held);
  const sc = db.pscore = db.pscore || { correct: 0, total: 0, streak: 0, best: 0 };
  sc.total++; if (PX.result.ok) { sc.correct++; sc.streak++; sc.best = Math.max(sc.best, sc.streak); } else sc.streak = 0;
  save(); renderCoachSoon();
  toast(PX.result.ok ? 'Correct — see the Practice Coach.' : 'Not quite — see the Practice Coach.', PX.result.ok ? 'good' : '', () => $('#coach').scrollIntoView({ behavior: 'smooth' }));
}
const pn = id => { const p = PAT(id); return p ? `${p.last}, ${p.first}` : '—'; };
function taskWaste(t) { const m = F[t.med]; if (!m.controlled || m.noSplit) return 0; return +(cartItem(t.med, t.dose, {}).qty * m.strength - t.dose).toFixed(4); }
function evalTask(t, ev, held) {
  const items = [], u = F[t.med].unit, rems = ev.filter(e => e.type === 'removed');
  if (t.kind === 'hold') {
    const gave = rems.find(r => r.med === t.med);
    items.push({ label: 'Held and clarified', want: t.holdWhy, got: gave ? `Removed ${medLabel(gave.med)}` : held ? 'Held' : '—', ok: held && !gave });
    return { ok: items[0].ok, items };
  }
  if (held) return { ok: false, items: [{ label: 'Medication', want: t.kind === 'return' ? `Return ${medLabel(t.med)}` : `Remove ${medLabel(t.med)} ${num(t.dose)} ${u}`, got: 'Held — this task was safe to complete', ok: false }] };
  if (t.kind === 'return') {
    const r = ev.find(e => e.type === 'returned');
    items.push({ label: 'Patient', want: pn(t.patient), got: r ? pn(r.patient) : '—', ok: !!r && r.patient === t.patient });
    items.push({ label: 'Medication returned', want: `${t.qty} ${unitWord(t.med, t.qty)} ${medLabel(t.med)}`, got: r ? `${r.qty} ${medLabel(r.med)}` : '—', ok: !!r && r.med === t.med && r.qty === t.qty });
    if (rems.length) items.push({ label: 'Other removals', want: 'None', got: rems.map(x => medLabel(x.med)).join(', '), ok: false });
    return { ok: items.every(i => i.ok), items };
  }
  const r = rems.find(x => x.med === t.med && x.patient === t.patient) || rems.find(x => x.med === t.med) || rems[0];
  items.push({ label: 'Patient', want: pn(t.patient), got: r ? pn(r.patient) : 'Nothing removed', ok: !!r && r.patient === t.patient });
  items.push({ label: 'Medication', want: medLabel(t.med), got: r ? medLabel(r.med) : '—', ok: !!r && r.med === t.med });
  items.push({ label: 'Dose', want: `${num(t.dose)} ${u}`, got: r ? `${num(r.dose)} ${F[r.med].unit}` : '—', ok: !!r && Math.abs(r.dose - t.dose) < 1e-6 });
  items.push(t.override
    ? { label: 'Removed on override', want: 'Override with a reason', got: r ? (r.override ? 'Override' : 'Patient profile') : '—', ok: !!r && r.override }
    : { label: 'Used the verified order', want: 'From the patient profile', got: r ? (r.override ? 'Override (an order already exists)' : 'Patient profile') : '—', ok: !!r && !r.override });
  if (F[t.med].controlled) { const c = ev.filter(e => e.type === 'count' && e.med === t.med), okc = c.length > 0 && c.every(x => x.correct);
    items.push({ label: 'Blind count', want: 'Accurate count', got: c.length ? (okc ? 'Accurate' : 'Did not match the drawer') : 'Not done', ok: okc }); }
  const w = taskWaste(t);
  if (w > 1e-6) { const we = ev.filter(e => e.type === 'waste' && e.med === t.med), tot = we.reduce((n, x) => n + x.amount, 0);
    items.push({ label: 'Waste with a witness', want: amtText(t.med, w), got: we.length ? amtText(t.med, tot) : 'Not documented (left for later)', ok: we.length > 0 && Math.abs(tot - w) < 1e-6 }); }
  const extra = rems.filter(x => x !== r);
  if (extra.length) items.push({ label: 'Other removals', want: 'None', got: extra.map(x => medLabel(x.med)).join(', '), ok: false });
  return { ok: items.every(i => i.ok), items };
}
function taskMath(t) {
  if (t.kind === 'hold') return esc(t.holdWhy);
  const m = F[t.med], q = cartItem(t.med, t.dose, {}).qty, removed = q * m.strength, w = taskWaste(t);
  let s = `Dose ${num(t.dose)} ${m.unit} from ${esc(medDesc(t.med))} → ${t.kind === 'return' ? 'return' : 'remove'} ${q} ${unitWord(t.med, q)} (${num(removed)} ${m.unit}).`;
  if (w > 1e-6) s += ` Waste = ${num(removed)} − ${num(t.dose)} = <b>${num(w)} ${m.unit}</b>${m.volume ? `; ${num(w)} ${m.unit} ÷ ${num(m.strength / m.volume)} ${m.unit}/mL = <b>${num(volOf(t.med, w))} mL</b>` : ''}.`;
  else if (t.kind === 'remove' && !m.controlled && !m.noSplit && removed - t.dose > 1e-6) s += ` Discard the unused ${amtText(t.med, removed - t.dose)} (not a controlled substance).`;
  return s;
}
function answerSteps(t) {
  const o = isOmni(), nm = `<b>${esc(pn(t.patient))}</b>`, med = `<b>${esc(medLabel(t.med))}</b>`, w = taskWaste(t), u = F[t.med].unit;
  const s = [o ? 'Log on: type <b>student</b>, then touch and hold the fingerprint sensor.' : 'Tap the screen, type <b>student</b>, Next, then touch and hold the fingerprint scanner.'];
  if (t.kind === 'hold') {
    return [`Read the task: ${esc(t.holdWhy)}`, 'Do not remove the medication. If you already started, cancel when the cabinet warns you (allergy, last-dose or already-removed alert).', 'Press <b>Can\'t give: hold and clarify</b>, notify the provider and document the held dose.'];
  }
  if (t.kind === 'return') return s.concat(o
    ? [`Select ${nm} → <b>Return Meds</b>.`, `Select ${med} on Meds Eligible to Return.`, `Administration Amount <b>0</b>, Quantity to Return <b>${t.qty}</b>, pick a reason, check "sealed", <b>Return Now</b>.`, ...(F[t.med].controlled ? ['Witness: <b>kjones</b> / <b>pyxis1</b>.'] : []), 'Place it in the return bin → <b>OK</b>.']
    : [`My Patients → select ${nm} → <b>Return</b>.`, `Select ${med}, quantity <b>${t.qty}</b>, check "sealed" → <b>Return</b>.`, ...(F[t.med].controlled ? ['Witness: <b>kjones</b> / <b>pyxis1</b>.'] : []), 'Place it in the return bin → <b>Accept</b>.']);
  if (t.override) return s.concat(o
    ? [`Select ${nm} → <b>Remove Meds</b> → <b>Stocked Meds</b> tab.`, `Select ${med} → <b>Yes</b> → reason <b>Emergency Situation</b> → OK.`, `Amount to administer <b>${num(t.dose)} ${u}</b> → OK.`, '<b>Remove Now</b> → follow the guiding lights → <b>OK</b>.']
    : [`Select ${nm} → <b>Override</b>.`, `Select ${med}; amount to administer <b>${num(t.dose)} ${u}</b> → OK.`, '<b>Remove Med</b> → reason <b>Emergency / rapid response</b> → Remove Meds.', 'Take it from the lit pocket → <b>Remove &amp; Close Drawer</b>.']);
  const tab = t.tab === 'due' ? (o ? 'Scheduled Meds' : 'Due Now') : t.tab === 'all' ? (o ? 'Active Med Orders' : 'All Orders') : (o ? 'PRN Only' : 'PRN');
  const out = s.concat(o ? [`Select ${nm} → <b>Remove Meds</b>.`, `<b>${tab}</b> tab → select ${med}.`] : [`My Patients → select ${nm} → <b>Remove</b>.`, `Select ${med} from the patient's medication list.`]);
  out.push(t.range ? `Amount to administer: <b>${num(t.dose)} ${u}</b>.` : o ? 'Confirm the intended dose → <b>OK</b>.' : `It moves to Selected Meds.`);
  if (o) { out.push('<b>Remove Now</b> → follow the guiding lights to the open bin.'); if (F[t.med].controlled) out.push('Blind count: count the quantity in the bin <b>before</b> removing → <b>OK</b>.'); out.push('Take the item → <b>OK</b>.'); }
  else { out.push('<b>Remove Med</b>.'); if (F[t.med].controlled) out.push('Blind count: count what is in the pocket <b>before</b> removing.'); out.push('<b>Remove &amp; Close Drawer</b>.'); }
  if (w > 1e-6) out.push(o ? `<b>Waste Partial Dose</b>: Administration ${num(t.dose)}, Waste <b>${num(w)} ${u}</b>, pick a reason → witness <b>kjones</b> / <b>pyxis1</b>.` : `<b>Waste Now</b>: waste <b>${amtText(t.med, w)}</b> → witness <b>kjones</b> / <b>pyxis1</b>.`);
  return out;
}

function describe(e) {
  const ml = id => (F[id] ? esc(medLabel(id)) : ''), p = id => esc(pn(id));
  switch (e.type) {
    case 'signin': return `Signed in with ${e.method === 'password' ? 'password' : 'fingerprint'}`;
    case 'signout': return 'Signed out';
    case 'patient_action': return `${p(e.patient)} → ${esc(({ remove: T('remove'), override: 'Override', return: 'Return', waste: 'Waste', past: T('past'), kits: 'Kits' })[e.action] || e.action)}`;
    case 'dose_entered': return `Amount to administer: ${num(e.dose)} ${F[e.med].unit} ${ml(e.med)}`;
    case 'count': return `Blind count ${ml(e.med)}: ${e.correct ? 'accurate' : 'did not match the drawer'}`;
    case 'removed': return `Removed ${e.qty} ${unitWord(e.med, e.qty)} ${ml(e.med)} for ${p(e.patient)}${e.override ? ' (override)' : ''}`;
    case 'waste': return `Wasted ${amtText(e.med, e.amount)} ${ml(e.med)} — witness ${esc(userName(e.witness))}`;
    case 'waste_later': return `Waste left for later: ${ml(e.med)}`;
    case 'returned': return `Returned ${e.qty} ${ml(e.med)}`;
    case 'allergy_alert': return `Allergy alert: ${ml(e.med)} — ${e.action === 'cancel' ? 'cancelled' : 'overridden'}`;
    case 'order_exists': return `Order-exists alert: ${ml(e.med)}`;
    case 'override_reason': return `Override reason: ${esc(e.reason)}`;
    case 'prn_hold': return `Cancelled ${ml(e.med)} after the last-dose warning`;
    case 'discrepancy_created': return `Discrepancy created: ${ml(e.med)}`;
    case 'discrepancy_resolved': return `Discrepancy resolved: ${ml(e.med)}`;
    case 'mypatients_saved': return 'My Patients list saved';
    case 'temp_added': return `Temporary patient added: ${p(e.patient)}`;
    case 'kit_selected': case 'kit_removed': return `${e.type === 'kit_selected' ? 'Selected' : 'Removed'} ${esc((KITS.find(k => k.id === e.kit) || {}).name || 'kit')}`;
    case 'nurseprep_selected': return 'Selected a nurse-prepared order';
    case 'remote_created': return `Anywhere RN ${esc(e.kind)} request created`;
    case 'remote_started': return `Started the pending ${esc(e.kind)} request`;
    default: return esc(e.type);
  }
}

const coach = $('#coach');
function modeSummary(m) {
  if (m === 'practice') return 'A new task every round: scheduled and PRN meds, controlled substances with waste, overrides, returns, and safety checks you should refuse. Your score and streak are kept.';
  if (m === 'free') return 'No checklist. Explore every screen: sign in, look up patients, remove, override, waste, return, kits, temporary patients and discrepancies. The event history shows what the cabinet recorded.';
  const S = scenById(m); return S ? devText(S.brief).replace(/<[^>]+>/g, '') : '';
}
function practiceHtml() {
  const t = PX.task; if (!t) return '';
  const p = PAT(t.patient), sc = db.pscore || { correct: 0, total: 0, streak: 0, best: 0 };
  const head = `<div class="pr-head"><h3>Practice mode</h3><label class="pr-spec" for="pcat">Task type <select id="pcat">${Object.entries(PCATS).map(([k, v]) => `<option value="${k}"${(db.pfilter || 'all') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="pr-score"><span><b>${sc.correct}</b>/${sc.total} correct</span><span>Streak <b>${sc.streak}</b></span><span>Best <b>${sc.best}</b></span></div>`;
  const band = `<dl class="band"><div class="bname">${esc(pn(t.patient))}</div><dt>Room</dt><dd class="mono">${esc(p.room)}</dd><dt>MRN</dt><dd class="mono">${esc(p.mrn)}</dd><dt>DOB</dt><dd class="mono">${fmtDob(p.dob)}</dd><dt>Allergies</dt><dd>${esc(allergyText(p))}</dd></dl>`;
  const order = `<div class="orders"><h4>Task</h4><p>${t.text}</p></div>`;
  let body;
  if (PX.result) {
    const r = PX.result;
    body = `<div class="pr-result ${r.ok ? 'good' : 'bad'}"><strong>${r.ok ? 'Correct' : 'Not quite'}</strong>
      <table class="pr-table"><thead><tr><th></th><th>Task needs</th><th>You did</th></tr></thead><tbody>${r.items.map(i => `<tr class="${i.ok ? 'ok' : 'no'}"><td>${i.ok ? '✓' : '✕'} ${esc(i.label)}</td><td>${esc(i.want)}</td><td>${esc(i.got)}</td></tr>`).join('')}</tbody></table>
      <p class="pr-math">${taskMath(t)}</p></div>
      <div class="coach-btns">${`<button class="btn small primary-c" data-cact="pnext">Next task</button>${r.ok ? '' : '<button class="btn small" data-cact="pretry">Try this task again</button>'}`}</div>`;
  } else {
    body = `<p class="pr-help">Use the cabinet to do the task. Your work is checked when the ${t.kind === 'return' ? 'return' : 'removal'} is finished. If the order should <b>not</b> be given, don't remove it.</p>
      <div class="coach-btns"><button class="btn small" data-cact="phold">Can't give: hold and clarify</button><button class="btn small" data-cact="panswer">${PX.showAnswer ? 'Hide' : 'Show'} the answer</button><button class="btn small ghost" data-cact="pskip">Skip</button></div>
      ${PX.showAnswer ? `<div class="pr-answer"><ol>${answerSteps(t).map(x => `<li>${x}</li>`).join('')}</ol><p class="pr-math">${taskMath(t)}</p></div>` : ''}`;
  }
  return head + band + order + body;
}
function scenarioHtml() {
  const sc = db.scen, S = sc && scenById(sc.id); if (!S) return '';
  const stepsHtml = S.steps.map((s, i) => {
    const state = sc.missed.includes(i) ? 'missed' : i < sc.step ? 'done' : i === sc.step && !sc.done ? 'current' : 'todo';
    return `<li class="st ${state}"><span class="st-mark" aria-hidden="true">${state === 'done' ? '✓' : state === 'missed' ? '✕' : i + 1}</span><div><span>${devText(s.text)}</span>${state === 'missed' ? '<span class="small bad">Missed or out of order</span>' : ''}</div></li>`;
  }).join('');
  const hints = S.steps.map(s => s.hint).filter(Boolean), shown = Math.min(session.hintsShown || 0, hints.length);
  const deb = DEBRIEFS[S.id];
  return `<div class="scen"><div class="scen-top"><span class="lvl">${S.level}${S.device ? ' · Omnicell only' : ''}</span><h3>${devText(S.title)}</h3></div><div class="brief">${devText(S.brief)}</div>
    <p class="small muted">Checklist · ${sc.step - sc.missed.filter(i => i < sc.step).length}/${S.steps.length}</p><div class="progress"><i style="width:${Math.round(sc.step / S.steps.length * 100)}%"></i></div>
    <ol class="steps">${stepsHtml}</ol>
    ${hints.length ? `<div class="coach-btns"><button class="btn small" data-cact="hint"${shown >= hints.length ? ' disabled' : ''}>${shown ? 'Next hint' : 'Show a hint'} (${shown}/${hints.length})</button></div>${shown ? `<ol class="hintlist">${hints.slice(0, shown).map(h => `<li>${devText(h)}</li>`).join('')}</ol>` : ''}` : ''}
    ${sc.errors.length ? `<div class="errs"><b>Safety concerns</b><ul>${sc.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
    ${sc.done ? resultHtml(sc, S) : ''}
    ${deb ? (sc.done || session.showDebrief ? `<div class="debrief"><b>Debrief</b><p>${esc(deb)}</p></div>` : '<div class="coach-btns"><button class="btn small ghost" data-cact="debrief">Show debrief</button></div>') : ''}</div>`;
}
function renderCoach() {
  const mode = db.mode || 'practice';
  const sel = mode === 'scen' && db.scen ? db.scen.id : mode;
  let html = `<div class="coach-head"><h2>Practice Coach</h2><button class="btn small ghost only-narrow" data-cact="toDevice">Back to cabinet ↑</button></div>
    <div class="now-card"><div><span class="now-lbl">Current time</span><span class="now-time clock" data-fmt="mil">${clockText(Date.now(), 'mil')}</span></div>
      <p>Scheduled doses are due at <b>${hhmm(dueHourMs())}</b>; on time from ${hhmm(dueHourMs() - HOUR)} to ${hhmm(dueHourMs() + HOUR)}. The sim uses your device's real time.</p></div>
    <div class="dev-switch" role="radiogroup" aria-label="Cabinet type">${Object.values(DEVICES).map(d => `<button role="radio" aria-checked="${D().key === d.key}" class="${D().key === d.key ? 'on' : ''}" data-cact="device" data-dev="${d.key}"><b>${d.key === 'pyxis' ? 'Pyxis' : 'Omnicell'}</b><span>${d.key === 'omnicell' ? 'Omnicell XT · Color Touch' : 'Pyxis MedStation ES'}</span></button>`).join('')}</div>
    <div class="picker"><label for="modeSel">Mode</label><select id="modeSel">
      <option value="practice"${sel === 'practice' ? ' selected' : ''}>Practice mode: random tasks</option>
      <option value="free"${sel === 'free' ? ' selected' : ''}>Free practice: explore the cabinet</option>
      <optgroup label="Guided scenarios">${SCENARIOS.map(s => `<option value="${s.id}"${sel === s.id ? ' selected' : ''}>${esc(s.level)}: ${esc(devText(s.title).replace(/<[^>]+>/g, ''))}${s.device ? ' (Omnicell only)' : ''}</option>`).join('')}</optgroup></select>
      <p class="summary">${esc(modeSummary(sel))}</p>
      <div class="coach-btns"><button class="btn small" data-cact="restartMode">${mode === 'scen' ? 'Restart scenario' : mode === 'free' ? 'Reset practice data' : 'New task'}</button></div></div>`;
  if (mode === 'practice') html += `<div class="pr">${practiceHtml()}</div>`;
  else if (mode === 'scen') html += scenarioHtml();
  else html += `<div class="scen"><h3>Free practice</h3><p class="small">No checklist. Some things to try:</p><ul class="small ideas">
      <li>Sign in with your fingerprint, and once with the password.</li><li>Build My Patients, then remove a scheduled med and a PRN.</li>
      <li>Remove a controlled substance: blind count before removing, then waste now or later.</li><li>Override an emergency med; try morphine for Robert Thompson and read the allergy alert.</li>
      <li>Return an unopened item; remove a kit; add a temporary patient.</li><li>Remove fentaNYL and count carefully — the pocket is one short. Then resolve the discrepancy.</li></ul></div>`;
  html += `<details class="coach-sec" id="histDet"${mode === 'free' || session.histOpen ? ' open' : ''}><summary>Event history</summary>${hist.length ? `<ol class="history">${hist.slice(0, 25).map(h => `<li><span class="mono">${hhmm(h.t)}</span> ${describe(h.e)}</li>`).join('')}</ol>` : '<p class="small muted">Nothing recorded yet.</p>'}</details>
    <details class="coach-sec"><summary>Signing in</summary><ul class="small">
      <li>User ID <code>student</code>, then your fingerprint: <b>touch and hold</b> the scanner (phone or tablet) or <b>click and hold</b> the mouse (computer) for about ${isOmni() ? '2' : '1.5'} seconds. Lift early to practice a failed scan.</li>
      <li>Password (if you choose it instead): <code>nurse1</code>. The user ID and password are shown under each box.</li>
      <li>When a witness is needed, Kelly Jones, RN comes to the cabinet and signs with a fingerprint for you.</li></ul></details>
    <details class="coach-sec"><summary>Settings</summary>
      <label class="check"><input type="checkbox" data-cact="challenge" ${db.settings.challenge ? 'checked' : ''}> <span><b>Dosage-calculation challenge</b><br><span class="muted small">Hide the calculated waste. Students calculate the waste amount and volume themselves.</span></span></label>
      <label class="check"><input type="checkbox" data-cact="haptics" ${db.settings.haptics === false ? '' : 'checked'}> <span><b>Vibration (haptics)</b><br><span class="muted small">Short vibrations on taps, fingerprint scans, drawers and alerts. Works on most Android phones and tablets; iPhone and iPad browsers do not allow it.</span></span></label>
      <div class="coach-btns"><button class="btn small" data-cact="resetScore">Reset my score</button><button class="btn small danger" data-cact="resetAll">Reset everything</button></div></details>
    <details class="coach-sec"><summary>Key symbols</summary><ul class="small keys">
      <li><span class="stripes mini"></span> Striped — override medication</li><li><span class="ind ind-waste">W</span> Undocumented waste</li><li><span class="ind ind-disc">Δ</span> Discrepancy on the device</li></ul></details>`;
  coach.innerHTML = html;
  renderQuickbar(sel);
}
// Phones and tablets stack the coach under the cabinet, so the cabinet type and mode are repeated above it.
function renderQuickbar(sel) {
  const qb = $('#quickbar'); if (!qb) return;
  const opt = (v, l) => `<option value="${v}"${sel === v ? ' selected' : ''}>${l}</option>`;
  qb.innerHTML = `<div class="qb-dev" role="radiogroup" aria-label="Cabinet type">${Object.values(DEVICES).map(d => `<button role="radio" aria-checked="${D().key === d.key}" class="${D().key === d.key ? 'on' : ''}" data-cact="device" data-dev="${d.key}">${d.key === 'pyxis' ? 'Pyxis' : 'Omnicell'}</button>`).join('')}</div>
    <select id="qbMode" aria-label="Practice mode">${opt('practice', 'Practice: random tasks')}${opt('free', 'Free practice')}<optgroup label="Guided scenarios">${SCENARIOS.map(s => opt(s.id, `${esc(s.level)}: ${esc(devText(s.title).replace(/<[^>]+>/g, ''))}`)).join('')}</optgroup></select>
    <button class="qb-coach" type="button" data-cact="toCoach">Coach ↓</button>`;
}
const nextScen = S => SCENARIOS[SCENARIOS.indexOf(S) + 1];
function resultHtml(sc, S) {
  const secs = Math.round((sc.end - sc.start) / 1000), ok = S.steps.length - sc.missed.length, pass = !sc.missed.length && !sc.errors.length;
  return `<div class="result ${pass ? 'pass' : 'review'}"><b>${pass ? 'Scenario complete — no errors' : 'Scenario complete — review needed'}</b>
    <p>${ok}/${S.steps.length} steps · ${sc.errors.length} safety concern${sc.errors.length === 1 ? '' : 's'} · ${Math.floor(secs / 60)} min ${secs % 60} s</p>
    <div class="coach-btns"><button class="btn small" data-cact="copyResult">Copy result for instructor</button>${nextScen(S) ? `<button class="btn small" data-cact="start" data-id="${nextScen(S).id}">Next: ${esc(devText(nextScen(S).title).replace(/<[^>]+>/g, ''))}</button>` : ''}</div></div>`;
}
function setMode(m) {
  if (m.startsWith('s') && scenById(m)) return startScenario(m);
  db.mode = m; db.scen = null;
  save();
  if (m === 'practice') newTask();
  else { PX = { task: null, events: [], result: null }; render(); }
}
function coachClick(e) {
  const b = e.target.closest('[data-cact]'); if (!b || b.disabled) return;
  const a = b.dataset.cact;
  if (a === 'start') startScenario(b.dataset.id);
  else if (a === 'restartMode') { if (db.mode === 'scen' && db.scen) startScenario(db.scen.id); else if (db.mode === 'free') { freshPractice(); save(); signOutQuiet(); toast('Practice data reset.'); } else setMode(db.mode || 'practice'); }
  else if (a === 'pnext' || a === 'pskip') newTask();
  else if (a === 'pretry') newTask(true);
  else if (a === 'panswer') { PX.showAnswer = !PX.showAnswer; renderCoach(); }
  else if (a === 'phold') { if (PX.task && !PX.result) finishTask(true); }
  else if (a === 'hint') { session.hintsShown = (session.hintsShown || 0) + 1; renderCoach(); }
  else if (a === 'debrief') { session.showDebrief = true; renderCoach(); }
  else if (a === 'device') { if (db.settings.device !== b.dataset.dev) { db.settings.device = b.dataset.dev; save(); signOutQuiet(); toast(`Switched to ${D().model}.`); } }
  else if (a === 'toDevice') $('#device').scrollIntoView({ behavior: 'smooth' });
  else if (a === 'toCoach') $('#coach').scrollIntoView({ behavior: 'smooth' });
  else if (a === 'resetScore') { db.pscore = { correct: 0, total: 0, streak: 0, best: 0 }; save(); renderCoach(); toast('Score reset.'); }
  else if (a === 'resetAll') { db = freshDb(); save(); PX = { task: null, events: [], result: null }; hist.length = 0; setMode('practice'); toast('Everything reset.'); }
  else if (a === 'copyResult') {
    const sc = db.scen, S = scenById(sc.id); const secs = Math.round((sc.end - sc.start) / 1000);
    copyText(`MedStation Practice Simulator — scenario result\nCabinet: ${D().model}\nScenario: ${S.title} (${S.level})\nCompleted: ${new Date(sc.end).toLocaleString()}\nSteps: ${S.steps.length - sc.missed.length}/${S.steps.length}\nMissed: ${sc.missed.map(i => S.steps[i].text.replace(/<[^>]+>/g, '')).join('; ') || 'none'}\nSafety concerns: ${sc.errors.join('; ') || 'none'}\nTime: ${Math.floor(secs / 60)} min ${secs % 60} s`);
  }
}
coach.addEventListener('click', coachClick);
$('#quickbar').addEventListener('click', coachClick);
$('#quickbar').addEventListener('change', e => { if (e.target.id === 'qbMode') setMode(e.target.value); });
coach.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'modeSel') setMode(t.value);
  else if (t.id === 'pcat') { db.pfilter = t.value; save(); newTask(); }
  else if (t.dataset.cact === 'haptics') { db.settings.haptics = t.checked; save(); if (t.checked) buzz([20, 40, 20]); }
  else if (t.dataset.cact === 'challenge') { db.settings.challenge = t.checked; save(); toast(t.checked ? 'Challenge mode on: calculate waste yourself.' : 'Challenge mode off.'); }
});
coach.addEventListener('toggle', e => { if (e.target.id === 'histDet') session.histOpen = e.target.open; }, true);
function signOutQuiet() { cancelFlows(); session.user = null; session.sel = null; session.cart = []; go('standby'); }

$('#coachJump').addEventListener('click', () => $('#coach').scrollIntoView({ behavior: 'smooth' }));

if (/[?&]e2e\b/.test(location.search)) window.__medsim = { task: () => PX.task, result: () => PX.result };
if (!db.mode) db.mode = window.MEDSIM_MODE || 'practice';
if (db.mode === 'scen' && (!db.scen || !scenById(db.scen.id))) db.mode = 'free';
if (db.mode === 'checkoff') db.mode = 'practice';
if (db.mode === 'practice') newTask(false, true);
render();
})();
