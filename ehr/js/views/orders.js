/* Orders — Expanse-style current orders by category, acknowledgment, order detail (ⓘ),
   protocol links (P), and verbal/telephone order entry. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};

  const CATS = ['Admission', 'Code Status', 'Alert', 'Nursing', 'Activity', 'Diet', 'Respiratory', 'IV Fluids', 'IV Access', 'Medication', 'Blood Products', 'Lab', 'Imaging', 'Diagnostics', 'Consult'];
  // Category bands on the screen, like Expanse.
  const BAND = { Medication: 'Medications', Lab: 'Laboratory', Imaging: 'Imaging', Diagnostics: 'Diagnostics', 'Blood Products': 'Blood Products',
    Nursing: 'Nursing Care', Activity: 'Nursing Care', Diet: 'Diet', Respiratory: 'Respiratory Care', 'IV Fluids': 'IV Fluids', 'IV Access': 'Nursing Care',
    Admission: 'Other', 'Code Status': 'Other', Alert: 'Other', Consult: 'Consults' };
  const BAND_ORDER = ['Medications', 'IV Fluids', 'Blood Products', 'Laboratory', 'Imaging', 'Diagnostics', 'Nursing Care', 'Respiratory Care', 'Diet', 'Consults', 'Other'];
  const COLS = '<colgroup><col><col class="oc-by"><col class="oc-time"><col class="oc-status"><col class="oc-act"><col class="oc-i"></colgroup>';

  // All orders as one list: provider orders, medication orders, and nursing-entered verbal/telephone orders.
  function allOrders(p, doc) {
    const verbal = doc.orders.map(e => ({ id: e.id, verbal: e, cat: e.data.cat, text: e.data.text, by: e.data.provider, time: e.time,
      status: e.status === 'error' ? 'Entered in error' : 'Active', type: e.data.type }));
    return [...p.orders, ...Model.medOrders(p), ...verbal];
  }

  function orderText(o) {
    if (!o.med) return `<span class="ord-text">${esc(o.text)}</span>`;
    const m = o.med;
    const sig = [m.dose, m.route, m.freq].filter(x => x && x !== '—').join(' ');
    return `<span class="ord-text">${esc(m.name)}</span> <span class="ord-sig">${esc(sig)}</span>`;
  }

  function row(p, doc, o) {
    const acked = Model.isAcked(doc, o.id);
    const conflict = o.med && Model.allergyConflicts(p, o.med).length;
    const status = o.status === 'Active' ? (o.verbal ? 'Active — needs co-sign' : o.med ? 'Active' : 'Ordered') : o.status;
    return `<tr class="ord-row ${o.status === 'Discontinued' || o.status === 'Entered in error' ? 'dc' : ''} ${o.isNew && !acked ? 'row-new' : ''}">
      <td>
        ${o.isNew && !acked ? UI.badge('NEW', 'new') + ' ' : ''}${o.priority ? UI.badge(o.priority, 'danger') + ' ' : ''}${conflict ? UI.badge('ALLERGY', 'danger') + ' ' : ''}
        ${orderText(o)} ${o.protocol ? Views.protocol.link(p, o.protocol) : ''}
        ${o.verbal ? `<div class="muted small">${esc(o.type)} order · read back ✔ · received by ${esc(Model.signature(o.verbal))}</div>` : ''}
        ${o.med && o.med.indication ? `<div class="muted small">Reason: ${esc(o.med.indication)}</div>` : ''}
      </td>
      <td>${esc(o.by || '')}</td>
      <td class="nowrap">${esc(U.fmtDT(o.time))}${o.dcTime ? `<br>${esc(U.fmtDT(o.dcTime))}` : ''}</td>
      <td>${esc(status)}</td>
      <td class="nowrap">${o.isNew ? (acked ? '<span class="muted small">Ack’d</span>' : `<button class="btn btn-sm btn-primary" data-ack="${esc(o.id)}">Acknowledge</button>`) : ''}</td>
      <td><button type="button" class="i-link" data-info="${esc(o.id)}" title="Order detail" aria-label="Order detail">i</button></td>
    </tr>`;
  }

  // ⓘ — everything about one order.
  function detail(p, doc, o) {
    const m = o.med;
    const ack = doc.ack.find(e => e.status === 'active' && e.data.ref === o.id);
    const rows = [
      ['Order', m ? Model.medLabel(m) : o.text], ['Category', o.cat], ['Priority', o.priority || 'Routine'],
      ['Ordering provider', o.by], ['Ordered', U.fmtDT(o.time)], ['Stop / discontinued', o.dcTime ? U.fmtDT(o.dcTime) : ''], ['Status', o.status],
      m && ['Type', { scheduled: 'Scheduled', prn: 'PRN', continuous: 'Continuous / IV', once: 'One time' }[m.type] || m.type],
      m && m.indication && ['Indication / PRN reason', m.indication], m && m.instructions && ['Instructions', m.instructions],
      m && m.highAlert && ['Alert', 'High-alert medication — independent double check'],
      m && (m.holdIf || []).length && ['Hold parameters', m.holdIf.map(h => `${h.p} ${h.op} ${h.v}`).join(' or ')],
      m && (m.preAssess || []).length && ['Assess before giving', m.preAssess.map(k => k.replace('lab:', 'lab: ')).join(', ')],
      o.detail && !m && ['Detail', o.detail],
      o.verbal && ['Order type', `${o.type} order — read back and verified; received by ${Model.signature(o.verbal)}; pending provider co-signature`],
      o.verbal && o.verbal.status === 'error' && ['Entered in error', o.verbal.error.reason],
      o.isNew && ['Acknowledged', ack ? `${U.fmtDT(ack.time)} by ${Model.signature(ack)}` : 'Not yet acknowledged']
    ].filter(r => r && r[1]);
    UI.modal({
      title: 'Order Detail', wide: true,
      body: `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        ${o.protocol && Views.protocol.get(p, o.protocol) ? `<h4>Protocol</h4>${Views.protocol.html(Views.protocol.get(p, o.protocol))}` : ''}`,
      buttons: [
        o.verbal && o.verbal.status === 'active' ? { label: 'Mark in Error', cls: 'btn-danger', onClick: () => { setTimeout(() => UI.errorEntry(p, 'orders', o.verbal.id), 0); } } : null,
        { label: 'Close' }
      ].filter(Boolean)
    });
  }

  Views.orders = {
    label: 'Orders',
    render(p, doc) {
      const all = allOrders(p, doc);
      const groups = {};
      all.forEach(o => { const band = BAND[o.cat] || o.cat || 'Other'; (groups[band] = groups[band] || []).push(o); });
      const order = [...BAND_ORDER, ...Object.keys(groups).filter(c => !BAND_ORDER.includes(c))];
      const pending = Model.unackedOrders(p, doc);
      const body = order.filter(c => groups[c]).map(band => `<tr class="ord-band"><th colspan="6">${esc(band)}</th></tr>
        ${groups[band].sort((a, b) => (a.status === 'Discontinued') - (b.status === 'Discontinued') || a.time - b.time).map(o => row(p, doc, o)).join('')}`).join('');

      return `<div class="ord-head">
          <h2>Orders</h2>
          <div class="ord-head-right">
            <button class="ord-submit" data-action="ackall" ${pending.length ? '' : 'disabled'}>ACKNOWLEDGE <span>${pending.length}</span></button>
            <a class="wl-btn" href="#/patient/${esc(p.id)}/${App.lastChartTab && App.lastChartTab[p.id] || 'summary'}">Close</a>
          </div>
        </div>
        <div class="ord-tabs" role="tablist">
          <button class="ord-tab ord-tab-on" role="tab" aria-selected="true">CURRENT</button>
          <button class="ord-tab" data-action="verbal">ENTER <small>(verbal / telephone)</small></button>
          <button class="ord-tab" disabled>RECONCILE</button>
          <button class="ord-tab" disabled>TRANSFER/ADMIT</button>
        </div>
        <table class="grid orders-grid">${COLS}
          <thead><tr><th>Orders by Category</th><th>Provider</th><th>Date</th><th>Status</th><th></th><th></th></tr></thead>
          <tbody>${body}</tbody></table>
        <p class="muted small">Click <strong>i</strong> for order detail. <strong>P</strong> opens the protocol for that order.</p>`;
    },
    bind(root, p, doc) {
      const all = allOrders(p, doc);
      root.querySelectorAll('[data-ack]').forEach(b => b.addEventListener('click', () => {
        Store.add(p.id, 'ack', { ref: b.dataset.ack, kind: 'order' }, p.clock.now(), p.clock.now());
        UI.toast('Order acknowledged.');
        App.render();
      }));
      const ackAll = root.querySelector('[data-action="ackall"]');
      if (ackAll) ackAll.addEventListener('click', () => {
        Model.unackedOrders(p, doc).forEach(o => Store.add(p.id, 'ack', { ref: o.id, kind: 'order' }, p.clock.now(), p.clock.now()));
        UI.toast('All new orders acknowledged.');
        App.render();
      });
      root.querySelectorAll('[data-info]').forEach(b => b.addEventListener('click', () => { const o = all.find(x => x.id === b.dataset.info); if (o) detail(p, doc, o); }));
      Views.protocol.bind(root, p);
      root.querySelector('[data-action="verbal"]').addEventListener('click', () => openVerbal(p));
    }
  };
  Views.orders.detail = detail;

  function openVerbal(p) {
    UI.modal({
      title: 'Verbal / Telephone Order',
      wide: true,
      body: `<div class="form-grid">
          <label class="field"><span>Order type</span><select name="type"><option>Telephone</option><option>Verbal</option></select></label>
          <label class="field"><span>Category</span><select name="cat">${UI.options(CATS, 'Medication', false)}</select></label>
          <label class="field"><span>Ordering provider</span><input name="provider" value="${esc(p.attending)}" required></label>
          ${UI.timeField(p, 'Date/time received')}
        </div>
        <label class="field"><span>Order (drug, dose, route, frequency, or complete order text)</span><textarea name="text" rows="3" required></textarea></label>
        <label class="check"><input type="checkbox" name="readBack" data-single="1"> I read the complete order back to the provider and the provider confirmed it (RBTO / RBVO).</label>
        <p class="muted">Verbal/telephone orders are flagged for provider co-signature. Medications ordered this way must also be administered and documented on the eMAR.</p>`,
      buttons: [
        { label: 'Cancel' },
        { label: 'Save Order', cls: 'btn-primary', onClick: api => {
          const v = U.formValues(api.el);
          if (!v.text) { UI.formError(api.el.querySelector('.modal-body'), 'Enter the order text.'); return false; }
          if (!v.readBack) { UI.formError(api.el.querySelector('.modal-body'), 'Read-back verification is required before saving a verbal or telephone order.'); return false; }
          Store.add(p.id, 'orders', { type: v.type, cat: v.cat, provider: v.provider, text: v.text, readBack: true }, UI.readTime(p, api.el), p.clock.now());
          UI.toast('Order saved — pending provider co-signature.');
          App.render();
        } }
      ]
    });
  }
})();
