/*
 * Barcode helpers shared by the MAR and the label page.
 *
 * Codes:
 *   <MRN>                      patient wristband
 *   RX-<MEDID>                 pharmacy label for one complete ordered dose (legacy)
 *   NDC-<DRUG>-<STRENGTH><U>   one unit-dose product, e.g. NDC-ACETAMINOPHEN-325MG.
 *                              Several can be scanned for one dose (2 × 325 mg = 650 mg).
 *   <8 digits>                 short form of an RX- or NDC- code, printed as the barcode itself.
 *                              Long text codes make wide, dense Code 128 barcodes that tablet
 *                              cameras and some scanners miss; 8 digits encode in Code 128 set C
 *                              as a short, wide-barred barcode. Both forms are accepted.
 */
(function () {
  'use strict';

  // Canonical units: mass in mg; everything else as written.
  const UNIT = { g: ['mg', 1000], gm: ['mg', 1000], gram: ['mg', 1000], grams: ['mg', 1000], mg: ['mg', 1], mcg: ['mg', 0.001], microgram: ['mg', 0.001],
    unit: ['units', 1], units: ['units', 1], ml: ['mL', 1], meq: ['mEq', 1] };

  // Parse "650 mg", "1 gram", "500 mg/250 mL" (first amount) -> { value, unit } or null.
  function parseDose(s) {
    const m = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(grams?|gm|g|mg|mcg|micrograms?|units?|ml|meq)\b/i.exec(String(s || ''));
    if (!m) return null;
    const k = m[2].toLowerCase();
    const u = UNIT[k] || UNIT[k.replace(/s$/, '')];
    if (!u) return null;
    return { value: Math.round(Number(m[1].replace(/,/g, '')) * u[1] * 1000) / 1000, unit: u[0] };
  }
  const fmt = d => d ? `${Number(d.value.toFixed(3)).toLocaleString('en-US')} ${d.unit}` : '';

  // Drug key: the first word of the generic name ("Acetaminophen" -> ACETAMINOPHEN).
  const drugKey = med => (med.drugKey || (String(med.name).match(/[A-Za-z]{3,}/) || [''])[0]).toUpperCase();

  function productCode(med, dose) {
    const num = String(Number(dose.value.toFixed(3))).replace(/\.$/, '');
    return `NDC-${drugKey(med)}-${num}${dose.unit.toUpperCase()}`;
  }

  // Stable 8-digit number for a text code (FNV-1a hash), so a printed label keeps working.
  function shortCode(text) {
    let h = 0x811c9dc5;
    const t = String(text).toUpperCase();
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return String(10000000 + h % 90000000);
  }

  // Every text code on every chart (base meds, event meds, unit-dose products), by short code.
  function textCodes(p) {
    const meds = [...(p.meds || []), ...(p.events || []).flatMap(e => e.meds || [])];
    return meds.flatMap(m => [m.barcode || ('RX-' + String(m.id).toUpperCase()), ...(m.type !== 'continuous' ? products(m).map(d => productCode(m, d)) : [])]);
  }
  function expand(c) {
    if (!/^\d{8}$/.test(c)) return c;
    const pts = window.Model ? window.Model.allPatients() : (window.SIM_PATIENTS || []);
    for (const p of pts) for (const t of textCodes(p)) if (shortCode(t) === c) return t.toUpperCase();
    return c;
  }

  function parseCode(code) {
    const c = expand(String(code || '').trim().toUpperCase());
    let m = /^NDC-([A-Z]+)-(\d+(?:\.\d+)?)(MG|UNITS|ML|MEQ)$/.exec(c);
    if (m) return { kind: 'product', key: m[1], dose: { value: Number(m[2]), unit: m[3] === 'ML' ? 'mL' : m[3] === 'MEQ' ? 'mEq' : m[3].toLowerCase() }, code: c };
    m = /^RX-(.+)$/.exec(c);
    if (m) return { kind: 'rx', medId: m[1].toLowerCase(), code: c };
    return null;
  }

  // Common unit-dose strengths, used to print extra labels (including wrong strengths for practice).
  const COMMON = {
    ACETAMINOPHEN: [325, 500, 650], OXYCODONE: [5, 10], GABAPENTIN: [100, 300], HYDROCHLOROTHIAZIDE: [12.5, 25], DOCUSATE: [100],
    ASPIRIN: [81, 325], METOPROLOL: [25, 50], PREDNISONE: [5, 10, 20], LORAZEPAM: [0.5, 1, 2], HALOPERIDOL: [2, 5], RISPERIDONE: [1, 2],
    TICAGRELOR: [90], ATORVASTATIN: [40, 80], CALCIUM: [500, 650], ALENDRONATE: [35, 70]
  };

  // Product labels to print for a medication: the ordered strength plus common strengths of the same drug.
  function products(med) {
    const d = parseDose(med.dose);
    if (!d || med.type === 'continuous' || d.unit !== 'mg' && d.unit !== 'units') return d ? [d] : [];
    const list = [d, ...((med.products || COMMON[drugKey(med)] || []).map(v => typeof v === 'number' ? { value: v, unit: d.unit } : parseDose(v)).filter(Boolean))];
    const seen = new Set();
    return list.filter(x => { const k = x.value + x.unit; if (seen.has(k)) return false; seen.add(k); return true; });
  }

  window.Scan = { parseDose, fmt, drugKey, productCode, parseCode, products, shortCode, textCodes };
})();
