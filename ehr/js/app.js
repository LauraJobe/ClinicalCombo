/* App shell: Expanse-style toolbar, folder tabs, patient side panel, routing. */
(function () {
  'use strict';
  const esc = U.esc;
  const C = window.EHR_CONFIG;

  // Older Safari (iOS 12–14.0) ignores flex `gap`; flag it so styles.css can space items with margins.
  (function () {
    const f = document.createElement('div');
    f.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
    f.appendChild(document.createElement('div')); f.appendChild(document.createElement('div'));
    document.documentElement.appendChild(f);
    if (f.scrollHeight !== 1) document.documentElement.classList.add('no-flexgap');
    f.remove();
  })();

  // Chart tabs laid out like MEDITECH Expanse: 3 rows x 4 tabs. Each tab holds
  // one or more screens (shown as sub-tabs). null = empty tab slot.
  const GROUPS = [
    [{ label: 'Diagnostics', views: ['results'] }, { label: 'Provider Notes', views: ['provnotes'] },
     { label: 'Nurse/Allied Health', views: ['assess', 'notes'] }, { label: 'Medications', views: ['meds'] }],
    [{ label: 'History & Problems', views: ['history'] }, { label: 'Administrative', views: ['admin'] },
     { label: 'Other Clinical', views: ['documents', 'report'] }, null],
    [{ label: 'Summary', views: ['summary'] }, { label: 'Activity', views: ['activity'] },
     { label: 'Flowsheets', views: ['vitals', 'io', 'heparin'] }, { label: 'Health Mgmt', views: ['careplan'] }]
  ];
  const TABS = GROUPS.flat().filter(Boolean).flatMap(g => g.views).concat(['worklist', 'orders', 'tar', 'mar']); // worklist, orders, TAR, and MAR are their own screens
  const viewsOf = (g, p) => g.views.filter(v => v !== 'heparin' || p.heparinFlowsheet);
  const groupOf = tab => GROUPS.flat().find(g => g && g.views.includes(tab));

  const ICON = {
    back: '<path d="M10 4 4 10l6 6M4 10h12"/>',
    home: '<path d="M3 10 10 3l7 7M5 8.5V17h4v-5h2v5h4V8.5"/>',
    workload: '<rect x="3" y="4" width="14" height="13" rx="1"/><path d="M3 8h14M7 2v4M13 2v4M6 11h2M9 11h2M12 11h2M6 14h2M9 14h2"/>',
    chart: '<path d="M3 5h5l2 2h7v10H3z"/>',
    document: '<path d="M5 2h7l4 4v12H5z"/><path d="M12 2v4h4M8 10h5M8 13h5"/>',
    orders: '<rect x="4" y="3" width="12" height="15" rx="1"/><path d="M8 3V2h4v1M7 8h6M7 11h6M7 14h4"/>',
    gear: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8"/>',
    suspend: '<circle cx="10" cy="10" r="7"/><path d="M7.5 7.5l5 5M12.5 7.5l-5 5"/>'
  };
  const svg = name => `<svg viewBox="0 0 20 20" aria-hidden="true">${ICON[name]}</svg>`;
  const tool = (name, label, href, attrs, cls) => `<a class="tb-btn${cls ? ' ' + cls : ''}" href="${href}" ${attrs || ''}>${svg(name)}<span>${esc(label)}</span></a>`;

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    return { page: parts[0] || 'census', pid: parts[1], tab: parts[2] || 'summary' };
  }

  function toolbar(p, mode) {
    const s = Store.session();
    const clock = p ? p.clock.now() : Date.now();
    const exp = Screens.experienceLabel(Screens.experience());
    return `<header class="toolbar">
      <div class="tb-group">
        ${tool('back', 'Return To', '#/census')}
        ${tool('home', 'Home', '#/census')}
        ${tool('workload', 'Workload', p ? `#/patient/${esc(p.id)}/worklist` : '#/census')}
      </div>
      ${p ? `<div class="tb-group tb-center">
        ${tool('chart', 'Chart', `#/patient/${esc(p.id)}/${App.lastChartTab && App.lastChartTab[p.id] || 'summary'}`, mode === 'chart' ? 'aria-current="page"' : '', mode === 'chart' ? 'tb-on' : '')}
        <div class="tb-split ${mode === 'document' ? 'tb-split-on' : ''}">${tool('document', 'Document', `#/patient/${esc(p.id)}/worklist`)}<button class="tb-caret" type="button" aria-haspopup="true" aria-expanded="false" aria-label="Documentation menu">▾</button>
          <div class="tb-menu" hidden role="menu">
            <a role="menuitem" href="#/patient/${esc(p.id)}/worklist" data-docmenu="worklist">Worklist</a>
            <a role="menuitem" href="#/patient/${esc(p.id)}/mar" data-docmenu="mar">Mar</a>
            <a role="menuitem" href="#/patient/${esc(p.id)}/tar" data-docmenu="tar">Transfusion Administration Record (TAR)</a>
            <a role="menuitem" href="#/patient/${esc(p.id)}/careplan" data-docmenu="careplan">Plan Of Care</a>
            <a role="menuitem" href="#/patient/${esc(p.id)}/worklist" data-docmenu="specialty">Specialty Care</a>
            <a role="menuitem" href="#/patient/${esc(p.id)}/notes" data-docmenu="note">Write Note</a>
          </div></div>
        ${tool('orders', 'Orders', `#/patient/${esc(p.id)}/orders`, mode === 'orders' ? 'aria-current="page"' : '', mode === 'orders' ? 'tb-on' : '')}
      </div>` : '<div class="tb-center tb-title">' + esc(C.hospitalName) + ' · ' + esc(C.systemName) + '</div>'}
      <div class="tb-group tb-right">
        <div class="tb-info"><div class="tb-clock"><span id="clock">${U.fmtDT(clock)}</span></div>
          <div class="tb-user">${esc(s.name)}, ${esc(s.cred)} · ${esc(exp)}</div></div>
        <div class="tb-split tb-mode">
          <a class="tb-btn tb-mode-btn" href="#" data-action="mode" aria-haspopup="true">${svg('gear')}<span>${esc(Screens.MODE_LABEL[Screens.mode()])} ▾</span></a>
          <div class="tb-menu tb-mode-menu" hidden role="menu">
            <div class="ml-menu-h">Chart mode</div>
            ${['student', 'observer', 'faculty'].map(m => `<a role="menuitem" href="#" data-setmode="${m}" class="${Screens.mode() === m ? 'ml-on' : ''}">${Screens.MODE_LABEL[m]}${m === 'observer' ? ' (view only)' : m === 'faculty' ? ' (PIN)' : ' (documenting)'}</a>`).join('')}
            ${Screens.mode() === 'faculty' ? '<a role="menuitem" href="#/instructor">Instructor Tools…</a>' : ''}
          </div></div>
        <a class="tb-btn" href="#" data-action="logout">${svg('suspend')}<span>Suspend</span></a>
      </div>
    </header>
    <div class="sim-strip">SIMULATION — FOR EDUCATIONAL USE ONLY · NOT A REAL MEDICAL RECORD</div>
    ${Screens.mode() === 'observer' ? '<div class="observer-strip" role="status">OBSERVER MODE — VIEW ONLY. You can review the chart but cannot document, give medications, or acknowledge orders or results.</div>' : ''}
    ${Screens.mode() === 'faculty' ? '<div class="faculty-strip" role="status">FACULTY MODE — all experiences visible. Switch back to Student before handing this computer to a student.</div>' : ''}`;
  }

  function tabs(p, doc, tab) {
    const counts = {
      orders: Model.unackedOrders(p, doc).length,
      results: Model.unreviewedResults(p, doc).length,
      meds: (c => c.due + c.overdue)(Model.dueCounts(p, doc))
    };
    const active = groupOf(tab);
    // Like Expanse, the row holding the active tab moves down next to the page and turns tan.
    const activeRow = GROUPS.findIndex(r => r.includes(active));
    const ordered = GROUPS.filter((_, i) => i !== activeRow).concat([GROUPS[activeRow]]);
    const cell = g => {
      if (!g) return '<span class="ftab ftab-empty" aria-hidden="true"></span>';
      const n = viewsOf(g, p).reduce((a, v) => a + (counts[v] || 0), 0);
      const on = g === active;
      return `<a href="#/patient/${esc(p.id)}/${viewsOf(g, p)[0]}" class="ftab ${on ? 'ftab-on' : ''}" ${on ? 'aria-current="page"' : ''}><span>${esc(g.label)}</span>${n ? `<span class="count">${n}</span>` : ''}</a>`;
    };
    return `<nav class="folder-tabs" aria-label="Chart sections">${ordered.map((r, i) =>
      `<div class="tab-row ${i === ordered.length - 1 ? 'tab-row-on' : ''}">${r.map(cell).join('')}</div>`).join('')}</nav>`;
  }

  function paneHead(p, doc, tab) {
    const g = groupOf(tab);
    const views = viewsOf(g, p);
    const sub = views.length > 1 ? `<div class="subtabs">${views.map(v => `<a href="#/patient/${esc(p.id)}/${v}" class="subtab ${v === tab ? 'subtab-on' : ''}">${esc(Views[v].label)}</a>`).join('')}</div>` : '';
    return `<div class="pane-head"><span class="pane-up" aria-hidden="true">↑</span><h1 class="view-title">${esc(g.label)}</h1>
      <span class="pane-icons" aria-hidden="true"><svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 8h14M10 11v3M8.5 12.5 10 11l1.5 1.5"/></svg>${svg('gear')}</span></div>${sub}`;
  }

  function sidePanel(p) {
    const initials = (p.name.first[0] + p.name.last[0]).toUpperCase();
    const bmi = Model.bmi(p);
    const allergies = p.nkda || !(p.allergies || []).length
      ? '<p>No Known Drug Allergies</p>'
      : p.allergies.map(a => `<p class="al">${esc(a.agent)} <span class="muted">— ${esc(a.reaction)}${a.severity ? ', ' + esc(a.severity) : ''}</span></p>`).join('');
    const indicators = [
      `<span class="code ${p.codeStatus === 'DNR' ? 'code-dnr' : ''}">${esc(p.codeStatus)}</span>`,
      p.isolation && p.isolation !== 'None' && p.isolation !== 'Standard' ? `<p>Isolation: ${esc(p.isolation)}</p>` : '',
      ...(p.flags || []).map(f => `<p>${esc(f)}</p>`)
    ].join('');
    const problems = [p.admitDx, ...(p.pmh || [])].map(x => `<p>${esc(x)}</p>`).join('');
    const resus = /not documented/i.test(p.codeStatus || '') ? '<div class="resus">Resus Status Needs Review</div>' : '';
    return `<aside class="side" aria-label="Patient">
      <div class="side-id"><button class="side-refresh" type="button" title="Refresh" onclick="App.render()" aria-label="Refresh chart">↻</button>
        <div class="avatar" aria-hidden="true">${esc(initials)}</div>
        <div><div class="side-name">${esc(p.name.last)},${esc(p.name.first)}</div>
          <div>${esc(p.age.replace(' years', ''))}, ${esc(p.sex)} — ${esc(U.fmtDOB(p.dob))}</div>
          <div>MRN# ${esc(p.mrn)}</div></div>
      </div>${resus}
      <div class="side-facts">
        <div>${esc(p.unit)}${p.room && p.room !== '—' ? ' · ' + esc(p.room) : ''}</div>
        <div>${p.heightCm ? esc(p.heightCm) + ' cm' : 'Ht —'} · ${p.weightKg ? esc(p.weightKg) + ' kg' : 'Wt —'}${bmi ? ' · BMI ' + bmi : ''}</div>
        <div>Admit: ${esc(U.fmtDate(p.admitTime))} · ${esc(p.attending)}</div>
      </div>
      <details class="side-sec" open><summary>Special Indicators</summary>${indicators}</details>
      <details class="side-sec" open><summary>Allergies</summary>${allergies}</details>
      <details class="side-sec" open><summary>Problems</summary>${problems}</details>
    </aside>`;
  }

  const App = {
    current: null,
    render() {
      const app = document.getElementById('app');
      const r = route();
      const s = Store.session();
      App.current = null;
      if (s && !Screens.experience()) { Store.clearSession(); }
      if (!Store.session()) {
        app.innerHTML = Screens.login.render();
        Screens.login.bind(app);
        return;
      }
      if (r.page === 'patient' && r.pid) {
        const base = Model.base(r.pid);
        if (!base) { location.hash = '#/census'; return; }
        if (!Screens.canSee(base)) {
          location.hash = '#/census';
          UI.toast('That patient is not part of your sim experience.', 'warn');
          return;
        }
        const p = Model.get(r.pid);
        const tab = TABS.includes(r.tab) && (r.tab !== 'heparin' || p.heparinFlowsheet) ? r.tab : 'summary';
        const doc = Store.doc(p.id);
        const view = Views[tab];
        App.current = p;
        const solo = tab === 'worklist' || tab === 'orders' || tab === 'tar' || tab === 'mar';
        if (!solo) { App.lastChartTab = App.lastChartTab || {}; App.lastChartTab[p.id] = tab; }
        const scroll = window.scrollY;
        app.innerHTML = tab === 'worklist' || tab === 'tar' || tab === 'mar'
          // The documentation worklist is a separate screen (no chart folders); Chart returns to the tabs.
          ? `${toolbar(p, 'document')}<main class="content worklist-screen" id="content">${view.render(p, doc)}</main>`
          : tab === 'orders'
          // Orders open from the Orders toolbar button, also outside the chart folders.
          ? `${toolbar(p, 'orders')}<main class="content worklist-screen" id="content">${Views.worklist.band(p)}${view.render(p, doc)}</main>`
          : `${toolbar(p, 'chart')}<div class="chart">
          <div class="chart-main">${tabs(p, doc, tab)}
            <main class="content" id="content">${paneHead(p, doc, tab)}${view.render(p, doc)}</main>
          </div>${sidePanel(p)}</div>`;
        if (view.bind) view.bind(app.querySelector('#content'), p, doc);
        document.title = `${p.name.last}, ${p.name.first} — ${view.label} · ${C.systemName}`;
        if (App._lastKey === location.hash) window.scrollTo(0, scroll);
      } else if (r.page === 'instructor') {
        if (!Store.instructorUnlocked()) {
          location.hash = '#/census';
          Screens.unlock(() => { location.hash = '#/instructor'; });
          return;
        }
        app.innerHTML = toolbar(null) + `<main class="content solo">${Screens.instructor.render()}</main>`;
        Screens.instructor.bind(app);
        document.title = `Instructor Tools · ${C.systemName}`;
      } else {
        app.innerHTML = toolbar(null) + `<main class="content solo board">${Screens.census.render()}</main>`;
        Screens.census.bind(app);
        document.title = `Census · ${C.hospitalName}`;
      }
      App._lastKey = location.hash;
      const caret = app.querySelector('.tb-caret');
      if (caret) {
        const menu = app.querySelector('.tb-menu');
        const close = () => { menu.hidden = true; caret.setAttribute('aria-expanded', 'false'); };
        caret.addEventListener('click', e => {
          e.stopPropagation();
          menu.hidden = !menu.hidden;
          caret.setAttribute('aria-expanded', String(!menu.hidden));
          if (!menu.hidden) setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
        });
        menu.querySelectorAll('[data-docmenu]').forEach(a => a.addEventListener('click', () => {
          const k = a.dataset.docmenu;
          if (k === 'note' && App.current) { const pt = App.current; setTimeout(() => Views.notes.write(Model.get(pt.id), 'Nursing Narrative'), 50); }
          close();
        }));
      }
      const modeBtn = app.querySelector('[data-action="mode"]');
      if (modeBtn) {
        const menu = app.querySelector('.tb-mode-menu');
        const close = () => { menu.hidden = true; };
        modeBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); menu.hidden = !menu.hidden; if (!menu.hidden) setTimeout(() => document.addEventListener('click', close, { once: true }), 0); });
        menu.querySelectorAll('[data-setmode]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); close(); Screens.setMode(a.dataset.setmode); }));
      }
      document.body.classList.toggle('mode-observer', Screens.mode() === 'observer');
      app.querySelector('[data-action="logout"]').addEventListener('click', e => {
        e.preventDefault();
        UI.confirm('Suspend session', 'Sign out of the simulation EHR? Your documentation stays saved on this device.', () => {
          Store.clearSession(); Store.setInstructor(false); location.hash = '#/'; App.render();
        }, 'Sign Out');
      });
    }
  };

  window.App = App;

  // Observer mode: block every charting or acknowledging action before its handler runs.
  const BLOCK = ['[data-ack]', '[data-action="ackall"]', '[data-action="verbal"]', '[data-action="new"]', '[data-dose]', '[data-prn]', '[data-infusion]', '[data-titrate]',
    '[data-effect]', '[data-err]', '[data-tar]', '[data-review]', '[data-wl="document"]', '.wl-row', '[data-docmenu="note"]', '[data-add]', '[data-eval]'].join(',');
  const observing = () => Screens.mode() === 'observer';
  document.addEventListener('click', e => {
    if (!observing() || !e.target.closest) return;
    const hit = e.target.closest(BLOCK);
    if (hit && hit.closest('#app, #modal-root')) {
      e.preventDefault(); e.stopImmediatePropagation();
      UI.toast('Observer mode is view only. You cannot document or acknowledge.', 'warn');
    }
  }, true);
  document.addEventListener('submit', e => {
    if (!observing() || !e.target.closest('#app, #modal-root') || e.target.closest('.login-card')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    UI.toast('Observer mode is view only. You cannot document.', 'warn');
  }, true);
  window.addEventListener('hashchange', () => App.render());
  // Keep the clock current; refresh due/overdue colors each minute.
  let lastMinute = null;
  setInterval(() => {
    const el = document.getElementById('clock');
    const now = App.current ? App.current.clock.now() : Date.now();
    if (el) el.textContent = U.fmtDT(now);
    const m = Math.floor(now / 60000);
    if (lastMinute != null && m !== lastMinute && App.current && !document.querySelector('.modal-backdrop') && !(document.activeElement && document.activeElement.closest('form'))) App.render();
    lastMinute = m;
  }, 5000);
  // Sync if another tab (e.g., instructor window) changes storage.
  window.addEventListener('storage', () => { if (!document.querySelector('.modal-backdrop')) App.render(); });
  document.addEventListener('DOMContentLoaded', () => App.render());
})();
