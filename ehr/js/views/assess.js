/* Assessments — WDL physical assessment, MSE, pain, and scored tools. */
(function () {
  'use strict';
  const esc = U.esc;
  window.Views = window.Views || {};
  const FORMS = () => window.ASSESSMENT_FORMS;

  const scoreOf = (field, label) => { const o = (field.options || []).find(x => x[0] === label); return o ? o[1] : null; };

  function wdlDef(p, sec) { return (p.wdlDefinitions && p.wdlDefinitions[sec.id]) || sec.wdl; }

  function fieldHtml(sec, f) {
    const name = `${sec.id}.${f.id}`;
    const label = f.label ? `<span>${esc(f.label)}</span>` : '';
    switch (f.type) {
      case 'select': return `<label class="field">${label}<select name="${name}">${UI.options(f.options)}</select></label>`;
      case 'checks': return `<fieldset class="field checks">${f.label ? `<legend>${esc(f.label)}</legend>` : ''}${f.options.map(o => `<label class="check"><input type="checkbox" name="${name}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</fieldset>`;
      case 'radio': return `<fieldset class="field checks">${f.label ? `<legend>${esc(f.label)}</legend>` : ''}${f.options.map(o => `<label class="check"><input type="radio" name="${name}" value="${esc(o)}"> ${esc(o)}</label>`).join('')}</fieldset>`;
      case 'score': return `<fieldset class="field checks score">${f.label ? `<legend>${esc(f.label)}</legend>` : ''}${f.options.map(([o, s]) => `<label class="check"><input type="radio" name="${name}" value="${esc(o)}"> ${esc(o)} <span class="pts">(${s})</span></label>`).join('')}</fieldset>`;
      case 'number': return `<label class="field">${label}<input type="number" name="${name}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}></label>`;
      case 'textarea': return `<label class="field wide">${label}<textarea name="${name}" rows="2"></textarea></label>`;
      default: return `<label class="field">${label}<input name="${name}"></label>`;
    }
  }

  function formHtml(p, form) {
    return `${form.intro ? `<p class="muted">${esc(form.intro)}</p>` : ''}
      <div class="form-grid">${UI.timeField(p, 'Date/time assessed')}</div>
      ${form.sections.map(sec => sec.wdl ? `
        <fieldset class="wdl-sec">
          <legend>${esc(sec.title)}</legend>
          <p class="wdl-def"><strong>WDL definition:</strong> ${esc(wdlDef(p, sec))}</p>
          <div class="wdl-choice">
            <label class="check"><input type="radio" name="${sec.id}.wdl" value="WDL"> WDL</label>
            <label class="check"><input type="radio" name="${sec.id}.wdl" value="WDL Except"> WDL Except</label>
            <label class="check"><input type="radio" name="${sec.id}.wdl" value="Not assessed"> Not assessed</label>
          </div>
          <label class="field wide exc" hidden><span>Exceptions (document what was NOT WDL)</span><textarea name="${sec.id}.exc" rows="2"></textarea></label>
        </fieldset>` : `
        <fieldset class="form-sec"><legend>${esc(sec.title)}</legend><div class="form-grid">${sec.fields.map(f => fieldHtml(sec, f)).join('')}</div></fieldset>`).join('')}
      ${form.scored ? '<div class="score-total" aria-live="polite"></div>' : ''}`;
  }

  function computeScore(form, values) {
    let total = 0, complete = true;
    form.sections.forEach(sec => (sec.fields || []).forEach(f => {
      if (f.type !== 'score') return;
      const s = scoreOf(f, values[`${sec.id}.${f.id}`]);
      if (s == null) complete = false; else total += s;
    }));
    return { total, complete, interp: complete ? window.SCORE_INTERP[form.scored](total) : '' };
  }

  function summary(form, d) {
    if (form.scored) return `Total ${d.total} — ${d.interp}`;
    if (form.sections.some(s => s.wdl)) {
      const exc = form.sections.filter(s => d.values[`${s.id}.wdl`] === 'WDL Except').map(s => s.title);
      const wdl = form.sections.filter(s => d.values[`${s.id}.wdl`] === 'WDL').length;
      return `${wdl} WDL${exc.length ? ' · Exceptions: ' + exc.join(', ') : ''}`;
    }
    const n = Object.values(d.values).filter(v => !U.isEmpty(v)).length;
    return `${n} item(s) documented`;
  }

  function detail(p, form, d) {
    return form.sections.map(sec => {
      if (sec.wdl) {
        const v = d.values[`${sec.id}.wdl`] || '—';
        const exc = d.values[`${sec.id}.exc`];
        return `<div class="detail-row"><strong>${esc(sec.title)}:</strong> ${esc(v)}${exc ? ` — <span class="abn">${esc(exc)}</span>` : ''}</div>`;
      }
      const items = sec.fields.map(f => {
        const v = d.values[`${sec.id}.${f.id}`];
        if (U.isEmpty(v)) return '';
        const txt = Array.isArray(v) ? v.join(', ') : v;
        const pts = f.type === 'score' ? ` (${scoreOf(f, v)})` : '';
        return `<div class="detail-row">${f.label ? `<strong>${esc(f.label)}:</strong> ` : ''}${esc(txt)}${pts}</div>`;
      }).join('');
      return items ? `<h4>${esc(sec.title)}</h4>${items}` : '';
    }).join('') + (form.scored ? `<p class="strong">Total: ${d.total} — ${esc(d.interp)}</p>` : '');
  }

  Views.assess = {
    label: 'Assessments',
    render(p, doc) {
      const forms = (p.assessmentForms || ['wdl-adult', 'pain']).filter(id => FORMS()[id]);
      // Assessments are charted only from the Worklist (Document); this tab shows what was documented.
      const how = `<div class="alerts"><div class="alert alert-info">Assessments (${esc(forms.map(id => FORMS()[id].title).join(', '))}) are documented from the <a href="#/patient/${esc(p.id)}/worklist"><strong>Worklist</strong></a>: check the assessment's box for the time, then click <strong>Document</strong>.</div></div>`;
      const entries = [...doc.assess].sort((a, b) => b.time - a.time);
      const hist = entries.length ? `<table class="grid"><thead><tr><th>Date/time</th><th>Assessment</th><th>Summary</th><th>Documented by</th><th></th></tr></thead><tbody>
        ${entries.map(e => { const f = FORMS()[e.data.formId]; return `<tr class="${e.status === 'error' ? 'error-row' : ''}">
          <td class="nowrap">${esc(U.fmtDT(e.time))}</td><td>${esc(f ? f.title : e.data.formId)}</td><td>${f ? esc(summary(f, e.data)) : ''}${e.status === 'error' ? `<div class="err-label">Entered in error — ${esc(e.error.reason)}</div>` : ''}</td>
          <td>${esc(Model.signature(e))}${Model.lateLabel(e) ? `<div class="late">${esc(Model.lateLabel(e))}</div>` : ''}</td>
          <td class="nowrap"><button class="btn btn-sm" data-view="${e.id}">View</button>${e.status === 'active' ? ` <button class="btn btn-sm btn-link" data-err="${e.id}">Error</button>` : ''}</td></tr>`; }).join('')}
        </tbody></table>` : UI.empty('No assessments documented yet.');

      const prior = (p.priorAssessments || []).map(a => `<details class="prior"><summary>${esc(a.title)} — ${esc(U.fmtDT(a.time))} · ${esc(a.author)}</summary>
          ${a.sections.map(([t, x]) => `<div class="detail-row"><strong>${esc(t)}:</strong> ${esc(x)}</div>`).join('')}</details>`).join('');

      return `${how}
        ${UI.panel('Assessment History', hist)}
        ${prior ? UI.panel('Prior Assessments (previous shift)', prior) : ''}`;
    },
    bind(root, p, doc) {
      root.querySelectorAll('[data-err]').forEach(b => b.addEventListener('click', () => UI.errorEntry(p, 'assess', b.dataset.err)));
      root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
        const e = doc.assess.find(x => x.id === b.dataset.view);
        const f = FORMS()[e.data.formId];
        UI.modal({ title: f.title, wide: true, body: `${UI.entryMeta(e)}${detail(p, f, e.data)}` });
      }));
    }
  };

  function open(p, formId, after) {
    const form = FORMS()[formId];
    UI.modal({
      title: form.title,
      wide: true,
      body: `<form class="assess-form">${formHtml(p, form)}</form>`,
      onOpen(api) {
        const el = api.el;
        el.querySelectorAll('.wdl-sec').forEach(fs => fs.addEventListener('change', () => {
          const sel = fs.querySelector('input[type=radio]:checked');
          fs.querySelector('.exc').hidden = !(sel && sel.value === 'WDL Except');
        }));
        const box = el.querySelector('.score-total');
        if (box) {
          const upd = () => { const s = computeScore(form, U.formValues(el)); box.innerHTML = `Total: <strong>${s.total}</strong>${s.complete ? ' — ' + esc(s.interp) : ' (complete all items)'}`; };
          el.addEventListener('change', upd); upd();
        }
      },
      buttons: [
        { label: 'Cancel' },
        { label: 'Sign & Save', cls: 'btn-primary', onClick: api => {
          const el = api.el;
          const values = U.formValues(el.querySelector('.assess-form'));
          const time = UI.readTime(p, el);
          delete values._time;
          const body = el.querySelector('.modal-body');
          const wdlSecs = form.sections.filter(s => s.wdl);
          if (wdlSecs.length) {
            const missing = wdlSecs.filter(s => !values[`${s.id}.wdl`]);
            if (missing.length) { UI.formError(body, 'Choose WDL, WDL Except, or Not assessed for: ' + missing.map(s => s.title).join(', ')); return false; }
            const noExc = wdlSecs.filter(s => values[`${s.id}.wdl`] === 'WDL Except' && !values[`${s.id}.exc`]);
            if (noExc.length) { UI.formError(body, 'Document the exceptions for: ' + noExc.map(s => s.title).join(', ')); return false; }
          } else if (!Object.values(values).some(v => !U.isEmpty(v))) {
            UI.formError(body, 'Nothing has been documented.'); return false;
          }
          const data = { formId, values };
          if (form.scored) {
            const s = computeScore(form, values);
            if (!s.complete) { UI.formError(body, 'Score every item to calculate the total.'); return false; }
            data.total = s.total; data.interp = s.interp;
          }
          Store.add(p.id, 'assess', data, time, p.clock.now());
          UI.toast(form.title + ' saved.');
          App.render();
          if (after) setTimeout(after, 0);
        } }
      ]
    });
  }

  Views.assess.open = open;
  Views.assess.detail = detail;
  Views.assess.summary = summary;
})();
