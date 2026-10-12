/* MedStation Practice Simulator — seed data.
 * All patients, orders and users are fictional and for education only. */

// Storage locations drawn on the cabinet graphic.
// type: MiniDrawer (single-dose, controlled), Matrix (open pockets), CUBIE (lidded), Fridge, Tower
const FORMULARY = {
  digoxin_tab:      { name: 'digoxin', brand: 'Lanoxin', strength: 0.125, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 4, type: 'Matrix', pocket: 3 }, count: 24 },
  metoprolol_tab:   { name: 'metoprolol tartrate', brand: 'Lopressor', strength: 25, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 4, type: 'Matrix', pocket: 7 }, count: 30 },
  furosemide_inj:   { name: 'furosemide', brand: 'Lasix', strength: 40, unit: 'mg', volume: 4, form: 'vial', desc: '10 mg/mL, 4 mL vial', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 2 }, count: 12 },
  kcl_tab:          { name: 'potassium chloride ER', brand: 'K-Dur', strength: 20, unit: 'mEq', form: 'tab', route: 'PO', loc: { drawer: 4, type: 'Matrix', pocket: 9 }, count: 18 },
  apixaban_tab:     { name: 'apixaban', brand: 'Eliquis', strength: 5, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 4, type: 'Matrix', pocket: 11 }, count: 14 },
  apap_tab:         { name: 'acetaminophen', brand: 'Tylenol', strength: 325, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 3, type: 'Matrix', pocket: 1 }, count: 60, override: true },
  morphine_inj:     { name: 'morphine', brand: '', strength: 4, unit: 'mg', volume: 1, form: 'Carpuject', desc: '4 mg/mL, 1 mL Carpuject', route: 'IV', controlled: 'C-II', loc: { drawer: 1, type: 'MiniDrawer', pocket: 2 }, count: 10, override: true },
  hydromorphone_inj:{ name: 'HYDROmorphone', brand: 'Dilaudid', strength: 1, unit: 'mg', volume: 1, form: 'Carpuject', desc: '1 mg/mL, 1 mL Carpuject', route: 'IV', controlled: 'C-II', loc: { drawer: 1, type: 'MiniDrawer', pocket: 4 }, count: 8, override: true },
  oxycodone_tab:    { name: 'oxyCODONE', brand: 'Roxicodone', strength: 5, unit: 'mg', form: 'tab', route: 'PO', controlled: 'C-II', loc: { drawer: 1, type: 'MiniDrawer', pocket: 6 }, count: 15 },
  fentanyl_inj:     { name: 'fentaNYL', brand: 'Sublimaze', strength: 100, unit: 'mcg', volume: 2, form: 'vial', desc: '50 mcg/mL, 2 mL vial', route: 'IV', controlled: 'C-II', loc: { drawer: 1, type: 'MiniDrawer', pocket: 8 }, count: 10, physicalOffset: -1 },
  lorazepam_inj:    { name: 'LORazepam', brand: 'Ativan', strength: 2, unit: 'mg', volume: 1, form: 'vial', desc: '2 mg/mL, 1 mL vial', route: 'IV', controlled: 'C-IV', loc: { drawer: 'F', type: 'Fridge', pocket: 2 }, count: 6, override: true },
  ondansetron_inj:  { name: 'ondansetron', brand: 'Zofran', strength: 4, unit: 'mg', volume: 2, form: 'vial', desc: '2 mg/mL, 2 mL vial', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 5 }, count: 20, override: true },
  enoxaparin_40:    { name: 'enoxaparin', brand: 'Lovenox', strength: 40, unit: 'mg', volume: 0.4, form: 'syringe', desc: '40 mg/0.4 mL prefilled syringe', route: 'subcut', loc: { drawer: 6, type: 'CUBIE', pocket: 'A3' }, count: 10 },
  enoxaparin_30:    { name: 'enoxaparin', brand: 'Lovenox', strength: 30, unit: 'mg', volume: 0.3, form: 'syringe', desc: '30 mg/0.3 mL prefilled syringe', route: 'subcut', loc: { drawer: 6, type: 'CUBIE', pocket: 'A4' }, count: 10 },
  docusate_cap:     { name: 'docusate sodium', brand: 'Colace', strength: 100, unit: 'mg', form: 'cap', route: 'PO', loc: { drawer: 3, type: 'Matrix', pocket: 4 }, count: 40 },
  pantoprazole_tab: { name: 'pantoprazole', brand: 'Protonix', strength: 40, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 3, type: 'Matrix', pocket: 6 }, count: 20 },
  senna_tab:        { name: 'sennosides', brand: 'Senokot', strength: 8.6, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 3, type: 'Matrix', pocket: 8 }, count: 40 },
  lispro_pen:       { name: 'insulin lispro', brand: 'HumaLOG', strength: 300, unit: 'units', volume: 3, form: 'pen', desc: '100 units/mL, 3 mL pen (patient-specific)', route: 'subcut', loc: { drawer: 'F', type: 'Fridge', pocket: 4 }, count: 5, noSplit: true },
  glargine_pen:     { name: 'insulin glargine', brand: 'Lantus', strength: 300, unit: 'units', volume: 3, form: 'pen', desc: '100 units/mL, 3 mL pen (patient-specific)', route: 'subcut', loc: { drawer: 'F', type: 'Fridge', pocket: 5 }, count: 5, noSplit: true },
  ceftriaxone_inj:  { name: 'cefTRIAXone', brand: 'Rocephin', strength: 1, unit: 'g', form: 'vial', desc: '1 g vial (reconstitute)', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 8 }, count: 8 },
  azithromycin_inj: { name: 'azithromycin', brand: 'Zithromax', strength: 500, unit: 'mg', form: 'vial', desc: '500 mg vial (reconstitute)', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 9 }, count: 6 },
  cefazolin_inj:    { name: 'ceFAZolin', brand: 'Ancef', strength: 2, unit: 'g', form: 'vial', desc: '2 g vial (reconstitute)', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 11 }, count: 8 },
  albuterol_neb:    { name: 'albuterol', brand: 'Ventolin', strength: 2.5, unit: 'mg', volume: 3, form: 'neb', desc: '2.5 mg/3 mL nebulizer vial', route: 'inhalation', loc: { drawer: 2, type: 'CUBIE', pocket: 'B1' }, count: 25, override: true },
  naloxone_inj:     { name: 'naloxone', brand: 'Narcan', strength: 0.4, unit: 'mg', volume: 1, form: 'vial', desc: '0.4 mg/mL, 1 mL vial', route: 'IV', loc: { drawer: 2, type: 'CUBIE', pocket: 'A1' }, count: 10, override: true },
  dextrose50_inj:   { name: 'dextrose 50%', brand: '', strength: 25, unit: 'g', volume: 50, form: 'syringe', desc: '25 g/50 mL Abboject syringe', route: 'IV', loc: { drawer: 2, type: 'CUBIE', pocket: 'A2' }, count: 6, override: true },
  glucagon_inj:     { name: 'glucagon', brand: 'GlucaGen', strength: 1, unit: 'mg', form: 'kit', desc: '1 mg emergency kit', route: 'IM', loc: { drawer: 2, type: 'CUBIE', pocket: 'A3' }, count: 4, override: true },
  epinephrine_inj:  { name: 'EPINEPHrine', brand: '', strength: 1, unit: 'mg', volume: 1, form: 'vial', desc: '1 mg/mL (1:1,000), 1 mL vial', route: 'IM', loc: { drawer: 2, type: 'CUBIE', pocket: 'A4' }, count: 6, override: true },
  diphenhydramine_inj: { name: 'diphenhydrAMINE', brand: 'Benadryl', strength: 50, unit: 'mg', volume: 1, form: 'vial', desc: '50 mg/mL, 1 mL vial', route: 'IV', loc: { drawer: 2, type: 'CUBIE', pocket: 'B2' }, count: 10, override: true },
  nitroglycerin_sl: { name: 'nitroglycerin SL', brand: 'Nitrostat', strength: 0.4, unit: 'mg', form: 'tab', route: 'SL', loc: { drawer: 2, type: 'CUBIE', pocket: 'B3' }, count: 25, override: true },
  sterile_water_10: { name: 'sterile water for injection', brand: '', strength: 10, unit: 'mL', form: 'vial', desc: '10 mL vial (diluent)', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 12 }, count: 30, override: true, noSplit: true },
  ns_flush:         { name: 'sodium chloride 0.9% flush', brand: '', strength: 10, unit: 'mL', form: 'syringe', desc: '10 mL prefilled flush syringe', route: 'IV', loc: { drawer: 3, type: 'Matrix', pocket: 10 }, count: 50, override: true, noSplit: true },
};

const ALLERGY_CLASSES = {
  morphine: ['morphine_inj'],
  codeine: [],
  penicillin: [],
  sulfa: [],
  latex: [],
};

// dueIn = minutes from shift start (negative = past due). Scheduled orders only.
const PATIENTS = [
  { id: 'P1', last: 'Jenkins', first: 'Harold', mi: 'M', sex: 'M', dob: '1954-03-14', mrn: '4012245', room: '412-A',
    allergies: [{ agent: 'Penicillin', reaction: 'rash', key: 'penicillin' }], dx: 'CHF exacerbation, atrial fibrillation', provider: 'Dr. A. Patel',
    orders: [
      { id: 'o101', med: 'digoxin_tab', dose: 0.125, freq: 'daily', dueIn: 15 },
      { id: 'o102', med: 'metoprolol_tab', dose: 25, freq: 'BID', dueIn: 15 },
      { id: 'o103', med: 'furosemide_inj', dose: 40, freq: 'BID', dueIn: 15 },
      { id: 'o104', med: 'kcl_tab', dose: 20, freq: 'daily', dueIn: 15 },
      { id: 'o105', med: 'apixaban_tab', dose: 5, freq: 'BID', dueIn: 15 },
      { id: 'o106', med: 'apap_tab', dose: 650, freq: 'q6h', prn: 'mild pain or temp > 38.3 °C' },
      { id: 'o107', med: 'morphine_inj', dose: 2, freq: 'q4h', prn: 'severe pain (7–10)' },
      { id: 'o108', med: 'ondansetron_inj', dose: 4, freq: 'q6h', prn: 'nausea/vomiting' },
    ] },
  { id: 'P2', last: 'Delgado', first: 'Maria', mi: 'E', sex: 'F', dob: '1981-07-02', mrn: '4019871', room: '415-B',
    allergies: [{ agent: 'Sulfa', reaction: 'hives', key: 'sulfa' }, { agent: 'Codeine', reaction: 'nausea/vomiting', key: 'codeine' }], dx: 'POD 1 laparoscopic cholecystectomy', provider: 'Dr. S. Morgan',
    orders: [
      { id: 'o201', med: 'hydromorphone_inj', doseMin: 0.2, doseMax: 0.6, freq: 'q2h', prn: 'severe pain (7–10)' },
      { id: 'o202', med: 'oxycodone_tab', doseMin: 5, doseMax: 10, freq: 'q4h', prn: 'moderate pain (4–6)' },
      { id: 'o203', med: 'ondansetron_inj', dose: 4, freq: 'q6h', prn: 'nausea/vomiting' },
      { id: 'o204', med: 'enoxaparin_40', dose: 40, freq: 'daily', dueIn: -40 },
      { id: 'o205', med: 'docusate_cap', dose: 100, freq: 'BID', dueIn: 15 },
      { id: 'o206', med: 'pantoprazole_tab', dose: 40, freq: 'daily before breakfast', dueIn: 15 },
    ] },
  { id: 'P3', last: 'Carter', first: 'Evelyn', mi: 'R', sex: 'F', dob: '1958-11-23', mrn: '4020334', room: '418-A',
    allergies: [], dx: 'Community-acquired pneumonia, type 2 diabetes', provider: 'Dr. A. Patel',
    orders: [
      { id: 'o301', med: 'ceftriaxone_inj', dose: 1, freq: 'daily', dueIn: 15,
        nursePrep: { label: 'Reconstitute cefTRIAXone 1 g with 10 mL sterile water; give IV push over 1–2 minutes', items: [{ med: 'ceftriaxone_inj', qty: 1 }, { med: 'sterile_water_10', qty: 1 }] } },
      { id: 'o302', med: 'azithromycin_inj', dose: 500, freq: 'daily', dueIn: 240 },
      { id: 'o303', med: 'lispro_pen', doseMin: 0, doseMax: 10, freq: 'AC & HS per sliding scale', dueIn: 15 },
      { id: 'o304', med: 'glargine_pen', dose: 20, freq: 'at bedtime', dueIn: 720 },
      { id: 'o305', med: 'lorazepam_inj', dose: 0.5, freq: 'q6h', prn: 'anxiety' },
      { id: 'o306', med: 'albuterol_neb', dose: 2.5, freq: 'q4h', prn: 'wheezing/shortness of breath' },
      { id: 'o307', med: 'apap_tab', dose: 650, freq: 'q6h', prn: 'mild pain or temp > 38.3 °C' },
    ] },
  { id: 'P4', last: 'Thompson', first: 'Robert', mi: 'L', sex: 'M', dob: '1968-05-09', mrn: '4021756', room: '420-A', nameAlert: true,
    allergies: [{ agent: 'Morphine', reaction: 'hives, pruritus', key: 'morphine' }, { agent: 'Latex', reaction: 'contact dermatitis', key: 'latex' }], dx: 'POD 0 right total knee arthroplasty', provider: 'Dr. K. Brennan',
    orders: [
      { id: 'o401', med: 'fentanyl_inj', dose: 25, freq: 'q1h', prn: 'severe pain (7–10)' },
      { id: 'o402', med: 'oxycodone_tab', dose: 5, freq: 'q4h', prn: 'moderate pain (4–6)' },
      { id: 'o403', med: 'cefazolin_inj', dose: 2, freq: 'q8h', dueIn: 15 },
      { id: 'o404', med: 'enoxaparin_30', dose: 30, freq: 'q12h', dueIn: 15 },
      { id: 'o405', med: 'apap_tab', dose: 650, freq: 'q6h', dueIn: 15 },
      { id: 'o406', med: 'senna_tab', dose: 8.6, freq: 'at bedtime', dueIn: 720 },
    ] },
  { id: 'P5', last: 'Thompson', first: 'Roberta', mi: 'A', sex: 'F', dob: '1945-01-30', mrn: '4017702', room: '406-B', nameAlert: true,
    allergies: [], dx: 'Left hip fracture, dementia', provider: 'Dr. K. Brennan',
    orders: [
      { id: 'o501', med: 'hydromorphone_inj', dose: 0.2, freq: 'q3h', prn: 'severe pain (7–10)' },
      { id: 'o502', med: 'apap_tab', dose: 650, freq: 'q6h', dueIn: 15 },
      { id: 'o503', med: 'enoxaparin_40', dose: 40, freq: 'daily', dueIn: 240 },
      { id: 'o504', med: 'docusate_cap', dose: 100, freq: 'BID', dueIn: 15 },
    ] },
];

// Practice accounts. Credentials are shown on the sign-in screens and never change.
const USERS = {
  student: { id: 'student', first: 'Nursing', last: 'Student', title: 'SN', password: 'nurse1', bioid: true },
  kjones:  { id: 'kjones',  first: 'Kelly',   last: 'Jones',   title: 'RN', password: 'pyxis1', witness: true, bioid: true },
  mlee:    { id: 'mlee',    first: 'Marcus',  last: 'Lee',     title: 'RN', password: 'pyxis2', witness: true, bioid: true },
};

const OVERRIDE_REASONS = [
  'Emergency / rapid response / code',
  'STAT order — not yet verified by pharmacy',
  'Pharmacy closed (after hours)',
  'Verbal order — provider at bedside',
];

const WASTE_SHORT_REASONS = [
  'Patient required more than initially planned (titrated)',
  'Waste amount previously documented in error',
  'Dose drawn up but patient refused',
  'Medication dropped / contaminated',
];

const DISCREPANCY_REASONS = [
  'Typo / miscount by me during blind count',
  'Previous user miscounted and did not correct inventory',
  'Previous user removed more or less than ordered (verified on MAR)',
  'Medication found (e.g., in return bin or wrong pocket)',
  'Unable to determine — incident report filed & charge nurse notified',
];

/* Guided practice scenarios.
 * Each step has a matcher on emitted events. `patient` is the correct patient for
 * wrong-patient error checks. */
// System kits: groups of items removed together (a kit on a profiled cabinet is treated as an override).
const KITS = [
  { id: 'k_hypo', name: 'Hypoglycemia Rescue Kit', use: 'Symptomatic hypoglycemia (BG < 70 mg/dL) per protocol', items: [{ med: 'dextrose50_inj', qty: 1 }, { med: 'glucagon_inj', qty: 1 }] },
  { id: 'k_opioid', name: 'Opioid Reversal Kit', use: 'Opioid-induced respiratory depression per protocol', items: [{ med: 'naloxone_inj', qty: 2 }, { med: 'ns_flush', qty: 2 }] },
  { id: 'k_anaphylaxis', name: 'Anaphylaxis Kit', use: 'Anaphylaxis per rapid response protocol', items: [{ med: 'epinephrine_inj', qty: 1 }, { med: 'diphenhydramine_inj', qty: 1 }, { med: 'ns_flush', qty: 2 }] },
];

const SCENARIOS = [
  { id: 's2', title: 'Remove a scheduled oral med', level: 'Beginner', patient: 'P1',
    brief: 'It is time for <b>Harold Jenkins\'</b> {DUE} medications. Remove his scheduled <b>digoxin 0.125 mg PO</b> from his medication profile.',
    steps: [
      { text: 'Sign in', hint: 'Type <b>student</b>, then hold your finger on the fingerprint scanner.', match: e => e.type === 'signin' },
      { text: 'Select Harold Jenkins and choose <b>Remove</b>', hint: 'My Patients or All Available Patients → tap Jenkins → Remove.', match: e => e.type === 'patient_action' && e.patient === 'P1' && e.action === 'remove' },
      { text: 'Remove digoxin 0.125 mg (1 tab) and close the drawer', hint: 'Select digoxin in Harold Jenkins\' medication list, then Remove Med.', match: e => e.type === 'removed' && e.med === 'digoxin_tab' && e.patient === 'P1' },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's3', title: 'Controlled substance: remove + waste the partial dose', level: 'Intermediate', patient: 'P1',
    brief: '<b>Harold Jenkins</b> is asking for pain medicine. He has an order for <b>morphine 2 mg IV q4h PRN severe pain</b>. The unit stocks morphine <b>4 mg/1 mL</b> Carpujects. Remove the dose, count accurately, and waste the unused 2 mg with a witness.',
    steps: [
      { text: 'Sign in and open Jenkins → <b>Remove</b>', match: e => e.type === 'patient_action' && e.patient === 'P1' && e.action === 'remove' },
      { text: 'Perform an accurate <b>blind count</b> of the MiniDrawer pocket', hint: 'Select morphine, then count the Carpujects you see in the open pocket BEFORE removing one. The number changes every time.', match: e => e.type === 'count' && e.med === 'morphine_inj' && e.correct },
      { text: 'Remove 1 Carpuject (4 mg)', match: e => e.type === 'removed' && e.med === 'morphine_inj' && e.patient === 'P1' },
      { text: 'Choose <b>Waste Now</b> and waste <b>2 mg (0.5 mL)</b> with a witness', hint: '4 mg removed − 2 mg dose = 2 mg waste. 2 mg ÷ 4 mg/mL = 0.5 mL.', match: e => e.type === 'waste' && e.med === 'morphine_inj' && Math.abs(e.amount - 2) < 0.001 },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's5', title: 'Emergency override (naloxone)', level: 'Advanced', patient: 'P4',
    brief: 'Rapid response for <b>Robert Thompson (420-A)</b>, who received an opioid after knee surgery and is now very hard to arouse. The provider gives a verbal order: <b>naloxone 0.4 mg IV now</b>. Pharmacy has not verified it. Remove on <b>Override</b>. <i>Watch for the Name Alert — there are two Thompsons on the unit.</i>',
    steps: [
      { text: 'Select the <b>correct</b> Thompson (Robert, 420-A) and choose <b>Override</b>', hint: 'Verify two identifiers: name + DOB or MRN. Roberta Thompson in 406-B is a different patient.', match: e => e.type === 'patient_action' && e.patient === 'P4' && e.action === 'override' },
      { text: 'Select <b>naloxone</b> and enter 0.4 mg', match: e => e.type === 'dose_entered' && e.med === 'naloxone_inj' && Math.abs(e.dose - 0.4) < 0.001 },
      { text: 'Choose an override reason', hint: 'Emergency / rapid response is the appropriate reason.', match: e => e.type === 'override_reason' },
      { text: 'Remove naloxone from the drawer', match: e => e.type === 'removed' && e.med === 'naloxone_inj' && e.patient === 'P4' && e.override },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's13', title: 'Nurse-prepared med order (cefTRIAXone)', level: 'Intermediate', patient: 'P3',
    brief: 'It is time for <b>Evelyn Carter\'s</b> {DUE} <b>cefTRIAXone 1 g IV</b>. It is a <b>nurse-prepared</b> order: you remove the drug vial and the <b>10 mL sterile water</b> diluent, then reconstitute at the bedside per policy. Remove both components.',
    steps: [
      { text: 'Open Carter → <b>Remove</b> and select the nurse-prepared cefTRIAXone order', hint: 'Selecting the order selects every component. Review the components before you continue.', match: e => e.type === 'nurseprep_selected' && e.order === 'o301' },
      { text: 'Remove the cefTRIAXone 1 g vial', match: e => e.type === 'removed' && e.med === 'ceftriaxone_inj' && e.patient === 'P3' },
      { text: 'Remove the sterile water 10 mL diluent', match: e => e.type === 'removed' && e.med === 'sterile_water_10' && e.patient === 'P3' },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's18', title: 'Several scheduled meds at once', level: 'Beginner', patient: 'P4',
    brief: 'It is time for <b>Robert Thompson\'s</b> {DUE} medications: <b>ceFAZolin 2 g IV</b>, <b>enoxaparin 30 mg subcut</b> and <b>acetaminophen 650 mg PO</b>. Select all three, then remove them in one transaction.',
    steps: [
      { text: 'Open Robert Thompson → <b>Remove</b>', match: e => e.type === 'patient_action' && e.patient === 'P4' && e.action === 'remove' },
      { text: 'Select all three due medications, then remove them together', hint: 'Tap each medication so it appears in the selected list before you start removing.', match: e => e.type === 'txn_done' && e.patient === 'P4' && ['cefazolin_inj', 'enoxaparin_30', 'apap_tab'].every(m => e.meds.includes(m)) },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
];


/* Cabinet profiles. Both are patient-first. The Omnicell profile follows the Omnicell
 * Color Touch 22.5 user guide (Remove Meds / Return Meds / Waste Meds, PMAs). */
const DEVICES = {
  pyxis: {
    key: 'pyxis', name: 'MedStation', model: 'Pyxis-style MedStation ES', station: '4W-MAIN', actionFirst: false,
    L: { remove: 'Remove', removeMed: 'Remove Med', removeMeds: 'Remove Meds', removing: 'Remove Medications', selected: 'Selected Meds', allPts: 'All Available Patients',
         undoc: 'Undocumented Waste', due: 'Due Now', find: 'Global Find', prefs: 'User Preferences', past: 'Past Removed', profile: 'Patient Profile', removed: 'removed' },
    types: { MiniDrawer: 'MiniDrawer', Matrix: 'Matrix', CUBIE: 'CUBIE', Fridge: 'Refrigerator' }, pocket: 'Pocket',
    openMsg: 'The drawer is open and the pocket light is on.',
  },
  omnicell: {
    key: 'omnicell', name: 'Omnicell XT', model: 'Omnicell-style XT (Color Touch)', station: '4W-OMNI1', actionFirst: false,
    L: { remove: 'Remove Meds', removeMed: 'Remove Now', removeMeds: 'Remove Now', removing: 'Remove Meds', selected: 'Display Meds to Remove', allPts: 'Local List',
         undoc: 'Partial Dose List', due: 'Scheduled Meds', find: 'Find Item', prefs: 'User Menus', past: 'Transaction History', profile: 'Active Med Orders', removed: 'issued' },
    types: { MiniDrawer: 'FlexBin single-dose drawer', Matrix: 'Matrix drawer', CUBIE: 'Locking bin drawer', Fridge: 'FlexLock refrigerator' }, pocket: 'Bin',
    openMsg: 'Follow the guiding lights: open the drawer with the blinking green LED, then the lit bin.',
  },
};

// Omnicell Color Touch lists (from the 22.5 user guide screens)
const OMNI_OVERRIDE_REASONS = ['Emergency Situation', 'MD Order', 'Patient Condition', 'Pharmacy Not Available'];
const OMNI_WASTE_REASONS = ['Partial dose — remainder of package', 'Patient refused after preparation', 'Dropped / contaminated', 'Order changed or discontinued'];
const OMNI_RESOLVE_REASONS = ['Miscount at blind count (my error)', 'Previous user miscount — bin level corrected by cycle count', 'Removed more or less than indicated on screen (verified on MAR)', 'Item found in wrong bin or return bin', 'Unable to resolve — incident report filed, charge nurse notified'];

// Debrief shown when a guided scenario is finished (or on request).
const DEBRIEFS = {
  s2: 'Remove scheduled medications within the administration window and only from the pharmacist-verified profile. Check the rights of medication administration against the eMAR, and complete any assessment the drug requires (for digoxin, an apical pulse) in the EMR before you give it.',
  s3: 'Controlled substances need a blind count before removal and any unused portion must be wasted in front of a licensed witness who watches the whole waste. Math: 4 mg − 2 mg = 2 mg to waste; 2 mg ÷ 4 mg/mL = 0.5 mL.',
  s5: 'Override is for emergencies or when pharmacist review would delay urgent care. After naloxone, stay with the patient and reassess often, because naloxone can wear off before the opioid does. Two patients with similar names need two identifiers every time.',
  s13: 'A nurse-prepared order bundles the drug and its diluent so you get both. Reconstitute exactly as directed, label the syringe, and do not substitute a different diluent. Skipping a component creates a partial issue.',
  s18: 'Select every due medication for a patient before you start removing: the cabinet then guides you drawer to drawer in one transaction, which saves time and reduces the chance of forgetting a dose.',
};

