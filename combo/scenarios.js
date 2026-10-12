/*
 * ClinicalCombo scenarios: one patient and one new IV medication order, followed
 * through all three stations.
 *
 *   EMR (ehr/)          the patient's chart; the new order arrives flagged NEW
 *   Med room (medstation/) the same patient and order on the cabinet profile
 *   Bedside (pumps/)    the same order on the IV pump, graded when started
 *
 * Each scenario holds the EMR chart, the cabinet profile and stock, how each
 * cabinet item scans at the bedside, the pump order, and the debrief.
 * All patients are fictional. Teaching values only: follow facility policy.
 */
(function () {
  'use strict';

  // Shared prior-chart pieces -------------------------------------------------
  const NIGHT_RN = 'K. Walsh, RN';
  const wdl = ['wdl-adult', 'pain', 'braden', 'morse'];

  const LIST = [
    /* ============================================================ 1 */
    {
      id: 'cefazolin',
      level: 'Level 1',
      title: 'IVPB antibiotic: cefazolin',
      tagline: 'A new post-op antibiotic order, run as a secondary (piggyback) over the primary IV.',
      skills: ['Acknowledge a new order', 'Remove from the profile', 'BCMA scan', 'Secondary infusion'],
      patient: {
        first: 'Gerald', last: 'Price', mi: 'T', sex: 'M', dob: '1954-02-18', age: '72 years',
        mrn: '7720145', room: '430-A', heightCm: 178, weightKg: 84,
        allergies: [{ agent: 'Sulfa', reaction: 'Rash', severity: 'Mild', tags: ['sulfa'], key: 'sulfa' }],
        dx: 'POD 1 right total hip arthroplasty', attending: 'Dr. K. Brennan'
      },
      brief: {
        situation: 'Gerald Price, 72, is post-op day 1 after a right total hip arthroplasty. Lactated Ringer\'s is infusing at 100 mL/hr. The surgeon just entered a new antibiotic order.',
        task: 'Find the new order in the EMR, get the medication from the cabinet, scan it at the bedside, and start it on the IV pump.'
      },
      order: { medId: 'cc1-cefazolin', short: 'ceFAZolin 2 g IVPB over 30 minutes' },
      ehr: {
        admitted: { time: '07:00', day: -1 },
        admitDx: 'POD 1 right total hip arthroplasty (osteoarthritis)',
        flags: ['Fall Risk', 'Posterior hip precautions'],
        hpi: 'Mr. Price had an elective right total hip arthroplasty yesterday for severe osteoarthritis. Uneventful spinal anesthetic; EBL 350 mL. Overnight he slept in short stretches, pain controlled with oral oxycodone. He has a peripheral IV in the left forearm with LR infusing. Up to the chair with PT this morning.',
        pmh: ['Osteoarthritis, right hip', 'Hypertension', 'Benign prostatic hyperplasia'],
        psh: ['Right total hip arthroplasty (yesterday)', 'Appendectomy (1978)'],
        familyHx: ['Father: MI at 70', 'Mother: osteoarthritis'],
        socialHx: ['Retired machinist; lives with his wife in a one-story home', 'Never smoker; 1–2 beers on weekends'],
        homeMeds: [
          { name: 'Amlodipine', dose: '5 mg', route: 'PO', freq: 'Daily' },
          { name: 'Tamsulosin', dose: '0.4 mg', route: 'PO', freq: 'Daily at bedtime' }
        ],
        orders: [
          { id: 'cc1-o1', cat: 'Admission', text: 'Admit to Medical-Surgical Unit, post-op orthopedics', time: '07:00', day: -1, by: 'Dr. K. Brennan' },
          { id: 'cc1-o2', cat: 'Nursing', text: 'Vital signs every 4 hours', time: '07:00', day: -1, by: 'Dr. K. Brennan' },
          { id: 'cc1-o3', cat: 'Nursing', text: 'Posterior hip precautions; abduction pillow in bed', time: '07:00', day: -1, by: 'Dr. K. Brennan' },
          { id: 'cc1-o4', cat: 'Activity', text: 'Up with PT, weight bearing as tolerated right leg', time: '07:00', day: -1, by: 'Dr. K. Brennan' },
          { id: 'cc1-o5', cat: 'Diet', text: 'Regular diet', time: '07:00', day: -1, by: 'Dr. K. Brennan' },
          { id: 'cc1-o6', cat: 'Lab', text: 'CBC and BMP POD 1 in AM', time: '07:00', day: -1, by: 'Dr. K. Brennan' }
        ],
        meds: [
          { id: 'cc1-lr', name: 'Lactated Ringer\'s 1,000 mL', dose: '100 mL/hr', rate: '100 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', started: { time: '06:00', by: 'KW' } },
          { id: 'cc1-amlodipine', name: 'Amlodipine', dose: '5 mg', route: 'PO', freq: 'Daily', type: 'scheduled', preAssess: ['SBP', 'HR'], holdIf: [{ p: 'SBP', op: '<', v: 100 }], doses: [{ time: '09:00' }] },
          { id: 'cc1-enox', name: 'Enoxaparin', dose: '40 mg', route: 'Subcut', freq: 'Daily', type: 'scheduled', doses: [{ time: '09:00' }] },
          { id: 'cc1-apap', name: 'Acetaminophen', dose: '650 mg', route: 'PO', freq: 'Every 6 hours', type: 'scheduled', doses: [] },
          { id: 'cc1-oxy', name: 'Oxycodone', dose: '5 mg', route: 'PO', freq: 'Every 4 hours PRN', type: 'prn', indication: 'Moderate pain (4–6)', minIntervalHr: 4, preAssess: ['Pain', 'RR'], lastGiven: { time: '06:10', by: 'KW' } },
          { id: 'cc1-ondan', name: 'Ondansetron', dose: '4 mg', route: 'IV push', freq: 'Every 6 hours PRN', type: 'prn', indication: 'Nausea or vomiting', minIntervalHr: 6 }
        ],
        vitals: [
          { time: '04:00', temp: 99.0, tempRoute: 'Oral', hr: 84, rr: 16, sbp: 132, dbp: 74, spo2: 95, o2: 'Room air', pain: 4, by: NIGHT_RN },
          { time: '08:00', temp: 99.1, tempRoute: 'Oral', hr: 82, rr: 16, sbp: 138, dbp: 76, spo2: 96, o2: 'Room air', pain: 3, by: 'Day shift RN' }
        ],
        labs: [
          { id: 'cc1-cbc', panel: 'CBC', time: '05:30', results: [
            { t: 'WBC', v: 10.2, u: 'k/uL', lo: 4.5, hi: 11.0 }, { t: 'Hemoglobin', v: 11.8, u: 'g/dL', lo: 13.5, hi: 17.5 },
            { t: 'Hematocrit', v: 35.1, u: '%', lo: 41, hi: 53 }, { t: 'Platelets', v: 212, u: 'k/uL', lo: 150, hi: 400 }] },
          { id: 'cc1-bmp', panel: 'Basic Metabolic Panel', time: '05:30', results: [
            { t: 'Sodium', v: 138, u: 'mEq/L', lo: 135, hi: 145 }, { t: 'Potassium', v: 4.1, u: 'mEq/L', lo: 3.5, hi: 5.1 },
            { t: 'Chloride', v: 104, u: 'mEq/L', lo: 98, hi: 107 }, { t: 'CO2', v: 25, u: 'mEq/L', lo: 22, hi: 29 },
            { t: 'BUN', v: 16, u: 'mg/dL', lo: 7, hi: 20 }, { t: 'Creatinine', v: 1.0, u: 'mg/dL', lo: 0.7, hi: 1.3 },
            { t: 'Glucose', v: 118, u: 'mg/dL', lo: 70, hi: 99 }] }
        ],
        notes: [
          { id: 'cc1-n1', type: 'Progress Note', author: 'Dr. K. Brennan', time: '07:15', text: 'POD 1 R THA. Pain controlled on oral regimen. Dressing clean, dry, intact. Neurovascularly intact distally. Hgb 11.8, expected post-op. Plan: PT twice daily, enoxaparin for VTE prophylaxis, continue LR at 100 mL/hr until taking fluids well. Post-op cefazolin ordered — please give now.' },
          { id: 'cc1-n2', type: 'Nursing Note', author: NIGHT_RN, time: '06:15', text: 'Slept in short periods. Oxycodone 5 mg PO at 0610 for pain 5/10 R hip. Dressing dry and intact. Pedal pulses 2+ bilaterally. Voiding in urinal. LR at 100 mL/hr, left forearm PIV patent, no redness or swelling.' }
        ],
        io: [{ time: '06:00', kind: 'in', cat: 'IV', amt: 1200 }, { time: '06:00', kind: 'out', cat: 'Urine', amt: 950 }]
      },
      newMed: { id: 'cc1-cefazolin', name: 'ceFAZolin 2 g in 100 mL (premixed)', dose: '2 g', route: 'IVPB', freq: 'Every 8 hours', type: 'scheduled',
        indication: 'Post-op surgical prophylaxis × 24 hours', instructions: 'Infuse over 30 minutes as a SECONDARY (piggyback) with LR running at 100 mL/hr. First dose now.',
        tags: ['cephalosporin'], orderedBy: 'Dr. K. Brennan', doses: [{ at: 0 }] },
      eventNote: { type: 'Progress Note', author: 'Dr. K. Brennan', text: 'New order: ceFAZolin 2 g IVPB every 8 hours for 24 hours post-op. First dose now.' },
      cabinet: {
        patient: { id: 'CC1', last: 'Price', first: 'Gerald', mi: 'T', sex: 'M', dob: '1954-02-18', mrn: '7720145', room: '430-A',
          allergies: [{ agent: 'Sulfa', reaction: 'rash', key: 'sulfa' }], dx: 'POD 1 right total hip arthroplasty', provider: 'Dr. K. Brennan',
          orders: [
            { id: 'cc1c-cefaz', med: 'cc_cefazolin_bag', dose: 2, freq: 'q8h', dueIn: 0 },
            { id: 'cc1c-apap', med: 'apap_tab', dose: 650, freq: 'q6h', dueIn: 120 },
            { id: 'cc1c-oxy', med: 'oxycodone_tab', dose: 5, freq: 'q4h', prn: 'moderate pain (4–6)' },
            { id: 'cc1c-ondan', med: 'ondansetron_inj', dose: 4, freq: 'q6h', prn: 'nausea/vomiting' },
            { id: 'cc1c-enox', med: 'enoxaparin_40', dose: 40, freq: 'daily', dueIn: 1380 }
          ] },
        others: [],
        formulary: {
          cc_cefazolin_bag: { name: 'ceFAZolin in dextrose (premixed)', brand: '', strength: 2, unit: 'g', volume: 100, form: 'bag', desc: '2 g/100 mL premixed IVPB bag', route: 'IV', loc: { drawer: 'F', type: 'Fridge', pocket: 1 }, count: 6 }
        },
        // How each item scans at the bedside when removed for this patient.
        items: {
          cc_cefazolin_bag: { verdict: 'correct' },
          cefazolin_inj: { verdict: 'wrongProduct', msg: 'You scanned a ceFAZolin 2 g VIAL (powder to reconstitute). The order is the premixed ceFAZolin 2 g/100 mL IVPB bag.' },
          ceftriaxone_inj: { verdict: 'other', msg: 'You scanned cefTRIAXone 1 g — a look-alike/sound-alike of ceFAZolin. There is no active order for it.' }
        }
      },
      pump: { kind: 'secondary', drugId: 'cefazolin', concIdx: 0, minutes: 30, primary: { drugId: 'lr', rate: 100 }, profile: 'medsurg' },
      debrief: {
        keyPoints: [
          'Acknowledge a new order and read all of it (drug, dose, route, frequency, duration, how to infuse) before you go to the cabinet.',
          'Remove from the patient\'s profile, not on override. The order was pharmacy-verified, so it was on the profile.',
          'At the bedside: two identifiers, then scan the wristband first and the medication second. Fix any scanner alert before you give anything.',
          'Secondary (piggyback): hang the IVPB above the primary bag, open the secondary clamp, VTBI = 100 mL, rate = 100 mL ÷ 0.5 hr = 200 mL/hr. The primary LR resumes at 100 mL/hr when the secondary finishes.',
          'Watch for an allergic reaction during the first dose of an antibiotic (rash, hives, wheezing, hypotension), and check the IV site.'
        ],
        questions: [
          'Which two identifiers did you use, and where did you check them at each station?',
          'Why must the secondary bag hang higher than the primary? What happens if the secondary clamp is left closed?',
          'Show the rate calculation. What would have happened if you had programmed the cefazolin as a new primary at 100 mL/hr?',
          'What will you assess during and after the infusion, and what would make you stop it?'
        ],
        answerKey: 'Order: ceFAZolin 2 g/100 mL IVPB q8h × 24 h, first dose now. Cabinet: Price, Gerald (430-A) → Remove → ceFAZolin 2 g/100 mL premixed bag (Fridge bin 1). EMR: acknowledge the order, MAR → scan wristband 7720145, then the bag → Given. Pump: SECONDARY on the LR channel, Cefazolin 2 g/100 mL, VTBI 100 mL, 30 minutes = 200 mL/hr. Distractors: ceFAZolin 2 g vial (needs reconstitution) and cefTRIAXone (look-alike) are stocked as override items and scan as errors.'
      }
    },

    /* ============================================================ 2 */
    {
      id: 'vancomycin',
      level: 'Level 2',
      title: 'Vancomycin and a name alert',
      tagline: 'Two patients named Ellis are on the unit. Pull for the right one, check the kidneys, and infuse no faster than 1 g/hr.',
      skills: ['Name alert at the cabinet', 'Pre-administration lab review', 'Secondary infusion', 'Infusion-rate safety'],
      patient: {
        first: 'Marjorie', last: 'Ellis', mi: 'L', sex: 'F', dob: '1960-06-05', age: '66 years',
        mrn: '7720388', room: '431-A', heightCm: 163, weightKg: 70,
        allergies: [{ agent: 'Penicillin', reaction: 'Hives', severity: 'Moderate', tags: ['penicillin'], key: 'penicillin' }],
        dx: 'Left lower leg cellulitis with abscess (MRSA)', attending: 'Dr. A. Patel'
      },
      brief: {
        situation: 'Marjorie Ellis, 66, was admitted last night with cellulitis and an abscess of the left lower leg. The wound culture grew MRSA this morning. 0.9% sodium chloride is infusing at 75 mL/hr. There is another patient named Ellis on the unit.',
        task: 'Find the new antibiotic order, remove it for the correct patient, scan it, and start it at a safe rate on the IV pump.'
      },
      order: { medId: 'cc2-vanco', short: 'Vancomycin 1 g IVPB over 2 hours' },
      ehr: {
        admitted: { time: '21:00', day: -1 },
        admitDx: 'Left lower leg cellulitis with abscess — MRSA',
        flags: ['NAME ALERT — another patient named Ellis on 4 West', 'Fall Risk'],
        hpi: 'Mrs. Ellis noticed a painful red area on her left shin four days ago after a scrape while gardening. Redness spread and a tender fluctuant area formed. Seen in the ED last night: T 101.2 °F, WBC 14.8. The abscess was drained at the bedside and a wound culture sent. Started on IV fluids. The culture grew MRSA this morning.',
        pmh: ['Type 2 diabetes (diet + metformin)', 'Hypertension', 'Obesity'],
        psh: ['Cholecystectomy (2009)'],
        familyHx: ['Mother: type 2 diabetes'],
        socialHx: ['Retired school librarian; lives with her husband', 'Never smoker; no alcohol'],
        homeMeds: [
          { name: 'Metformin', dose: '500 mg', route: 'PO', freq: 'Twice daily' },
          { name: 'Lisinopril', dose: '10 mg', route: 'PO', freq: 'Daily' }
        ],
        orders: [
          { id: 'cc2-o1', cat: 'Admission', text: 'Admit to Medical-Surgical Unit', time: '21:00', day: -1, by: 'Dr. A. Patel' },
          { id: 'cc2-o2', cat: 'Nursing', text: 'Vital signs every 4 hours', time: '21:00', day: -1, by: 'Dr. A. Patel' },
          { id: 'cc2-o3', cat: 'Nursing', text: 'Mark cellulitis borders with skin marker; elevate left leg', time: '21:00', day: -1, by: 'Dr. A. Patel' },
          { id: 'cc2-o4', cat: 'Nursing', text: 'Point-of-care glucose before meals and at bedtime', time: '21:00', day: -1, by: 'Dr. A. Patel' },
          { id: 'cc2-o5', cat: 'Diet', text: 'Consistent carbohydrate diet', time: '21:00', day: -1, by: 'Dr. A. Patel' },
          { id: 'cc2-o6', cat: 'Lab', text: 'Vancomycin trough before the 4th dose', time: '21:00', day: -1, by: 'Dr. A. Patel', status: 'Pending' }
        ],
        meds: [
          { id: 'cc2-ns', name: 'Sodium chloride 0.9% 1,000 mL', dose: '75 mL/hr', rate: '75 mL/hr', route: 'IV', freq: 'Continuous', type: 'continuous', started: { time: '22:00', day: -1, by: 'KW' } },
          { id: 'cc2-lisin', name: 'Lisinopril', dose: '10 mg', route: 'PO', freq: 'Daily', type: 'scheduled', preAssess: ['SBP'], holdIf: [{ p: 'SBP', op: '<', v: 100 }], doses: [{ time: '09:00' }] },
          { id: 'cc2-apap', name: 'Acetaminophen', dose: '650 mg', route: 'PO', freq: 'Every 6 hours PRN', type: 'prn', indication: 'Pain or temp > 100.4 °F', minIntervalHr: 6, preAssess: ['Pain'], lastGiven: { time: '04:00', by: 'KW' } },
          { id: 'cc2-insulin', name: 'Insulin lispro (sliding scale)', dose: 'Per scale', route: 'Subcut', freq: 'AC & HS', type: 'scheduled', preAssess: ['Glucose'], doses: [] }
        ],
        vitals: [
          { time: '22:00', day: -1, temp: 101.2, tempRoute: 'Oral', hr: 102, rr: 20, sbp: 146, dbp: 84, spo2: 96, o2: 'Room air', pain: 6, by: 'ED RN' },
          { time: '04:00', temp: 100.6, tempRoute: 'Oral', hr: 96, rr: 18, sbp: 138, dbp: 80, spo2: 96, o2: 'Room air', pain: 5, by: NIGHT_RN },
          { time: '08:00', temp: 99.8, tempRoute: 'Oral', hr: 90, rr: 18, sbp: 134, dbp: 78, spo2: 97, o2: 'Room air', pain: 4, by: 'Day shift RN' }
        ],
        labs: [
          { id: 'cc2-cbc', panel: 'CBC', time: '05:00', results: [
            { t: 'WBC', v: 13.6, u: 'k/uL', lo: 4.5, hi: 11.0 }, { t: 'Hemoglobin', v: 12.9, u: 'g/dL', lo: 12.0, hi: 16.0 },
            { t: 'Platelets', v: 288, u: 'k/uL', lo: 150, hi: 400 }] },
          { id: 'cc2-bmp', panel: 'Basic Metabolic Panel', time: '05:00', results: [
            { t: 'Sodium', v: 137, u: 'mEq/L', lo: 135, hi: 145 }, { t: 'Potassium', v: 4.3, u: 'mEq/L', lo: 3.5, hi: 5.1 },
            { t: 'BUN', v: 14, u: 'mg/dL', lo: 7, hi: 20 }, { t: 'Creatinine', v: 0.9, u: 'mg/dL', lo: 0.6, hi: 1.1 },
            { t: 'Glucose', v: 182, u: 'mg/dL', lo: 70, hi: 99 }] },
          { id: 'cc2-cx', panel: 'Wound Culture — left lower leg', time: '08:30', results: [
            { t: 'Gram stain', v: 'Gram-positive cocci in clusters', flag: 'A' },
            { t: 'Culture', v: 'Staphylococcus aureus, methicillin-resistant (MRSA)', flag: 'A' },
            { t: 'Vancomycin', v: 'Susceptible (MIC 1)' }] }
        ],
        notes: [
          { id: 'cc2-n1', type: 'Progress Note', author: 'Dr. A. Patel', time: '09:15', text: 'Wound culture positive for MRSA. Afebrile trend, WBC 13.6 (down from 14.8). Creatinine 0.9. Start vancomycin 1 g IV every 12 hours (about 15 mg/kg). Infuse over 2 hours. Trough before the 4th dose. Continue NS at 75 mL/hr.' },
          { id: 'cc2-n2', type: 'Nursing Note', author: NIGHT_RN, time: '05:30', text: 'Cellulitis border marked at 2200; redness now 1 cm inside the marked line. Drained abscess site with packing, scant serosanguinous drainage. Acetaminophen 650 mg at 0400 for T 100.6 °F. Patient asked twice whether the other Mrs. Ellis\'s visitors were hers — reinforced name alert with the patient.' }
        ],
        io: [{ time: '06:00', kind: 'in', cat: 'IV', amt: 600 }, { time: '06:00', kind: 'out', cat: 'Urine', amt: 700 }]
      },
      newMed: { id: 'cc2-vanco', name: 'Vancomycin 1 g in 250 mL NS (premixed)', dose: '1 g', route: 'IVPB', freq: 'Every 12 hours', type: 'scheduled',
        indication: 'MRSA cellulitis/abscess', instructions: 'Infuse over 2 hours (no faster than 1 g/hr) as a SECONDARY with NS at 75 mL/hr. Review creatinine before each dose. Trough before the 4th dose.',
        preAssess: ['lab:Creatinine'], tags: ['glycopeptide'], orderedBy: 'Dr. A. Patel', doses: [{ at: 0 }] },
      eventNote: null,
      cabinet: {
        patient: { id: 'CC2', last: 'Ellis', first: 'Marjorie', mi: 'L', sex: 'F', dob: '1960-06-05', mrn: '7720388', room: '431-A', nameAlert: true,
          allergies: [{ agent: 'Penicillin', reaction: 'hives', key: 'penicillin' }], dx: 'Left lower leg cellulitis/abscess (MRSA)', provider: 'Dr. A. Patel',
          orders: [
            { id: 'cc2c-vanco', med: 'cc_vanco_1g_bag', dose: 1, freq: 'q12h', dueIn: 0 },
            { id: 'cc2c-apap', med: 'apap_tab', dose: 650, freq: 'q6h', prn: 'pain or temp > 38 °C' },
            { id: 'cc2c-lispro', med: 'lispro_pen', doseMin: 0, doseMax: 10, freq: 'AC & HS per sliding scale', dueIn: 120 }
          ] },
        // The look-alike patient. Her vancomycin is a different dose and bag.
        others: [
          { id: 'CC2B', last: 'Ellis', first: 'Margaret', mi: 'A', sex: 'F', dob: '1948-11-12', mrn: '7719902', room: '433-B', nameAlert: true,
            allergies: [], dx: 'Osteomyelitis right foot', provider: 'Dr. S. Morgan',
            orders: [
              { id: 'cc2b-vanco', med: 'cc_vanco_15_bag', dose: 1.5, freq: 'q12h', dueIn: 0 },
              { id: 'cc2b-apap', med: 'apap_tab', dose: 650, freq: 'q6h', dueIn: 0 },
              { id: 'cc2b-enox', med: 'enoxaparin_40', dose: 40, freq: 'daily', dueIn: 0 }
            ] }
        ],
        formulary: {
          cc_vanco_1g_bag: { name: 'vancomycin in 0.9% NaCl (premixed)', brand: '', strength: 1, unit: 'g', volume: 250, form: 'bag', desc: '1 g/250 mL premixed IVPB bag', route: 'IV', loc: { drawer: 'F', type: 'Fridge', pocket: 3 }, count: 6 },
          cc_vanco_15_bag: { name: 'vancomycin in 0.9% NaCl (premixed)', brand: '', strength: 1.5, unit: 'g', volume: 500, form: 'bag', desc: '1.5 g/500 mL premixed IVPB bag', route: 'IV', loc: { drawer: 'F', type: 'Fridge', pocket: 6 }, count: 4 }
        },
        items: {
          cc_vanco_1g_bag: { verdict: 'correct' },
          cc_vanco_15_bag: { verdict: 'wrongProduct', msg: 'You scanned vancomycin 1.5 g/500 mL. The order for this patient is vancomycin 1 g/250 mL.' }
        }
      },
      pump: { kind: 'secondary', drugId: 'vancomycin', concIdx: 0, minutes: 120, primary: { drugId: 'ns', rate: 75 }, profile: 'medsurg' },
      debrief: {
        keyPoints: [
          'A name alert means slow down: confirm two identifiers (name + DOB or MRN) when you pick the patient in the cabinet, and again at the bedside.',
          'The other Ellis\'s vancomycin was a different dose (1.5 g/500 mL). Removing for the wrong patient is how a look-alike name becomes a wrong-patient, wrong-dose error.',
          'Before vancomycin: review renal function (creatinine 0.9 today) and the monitoring plan (trough before the 4th dose).',
          'Infuse no faster than 1 g/hr to prevent vancomycin infusion reaction (flushing, itching, rash of the face and upper body, hypotension). 250 mL over 2 hours = 125 mL/hr.',
          'Penicillin allergy: vancomycin is not a beta-lactam, so it is a safe choice — but always look at the allergy banner.'
        ],
        questions: [
          'How did you tell the two Ellis patients apart at the cabinet and at the bedside?',
          'Which lab did you review before you gave the dose, and why does it matter for vancomycin?',
          'Thirty minutes in, Mrs. Ellis is flushed and itchy across her neck and chest. What do you do first, and what will you report?',
          'Calculate the rate if the order were 1 g over 90 minutes. Would that still be safe?'
        ],
        answerKey: 'Order: vancomycin 1 g/250 mL IVPB q12h, over 2 hours, first dose now. Cabinet: Ellis, MARJORIE (431-A, DOB 06/05/1960, MRN 7720388) — not Ellis, Margaret (433-B) → Remove → vancomycin 1 g/250 mL (Fridge bin 3). EMR: acknowledge, review creatinine 0.9, scan wristband then bag → Given. Pump: SECONDARY over NS 75 mL/hr, Vancomycin 1 g/250 mL, VTBI 250 mL, 2 hours = 125 mL/hr. Q4: 250 mL ÷ 1.5 hr = 166.7 mL/hr (1 g over 90 min — still within 1 g/hr). Infusion reaction: stop/slow the infusion, assess BP, notify the provider; usually restarted at a slower rate with an antihistamine per order.'
      }
    },

    /* ============================================================ 3 */
    {
      id: 'heparin',
      level: 'Level 3',
      title: 'Weight-based heparin drip',
      tagline: 'A high-alert continuous infusion: units/kg/hr, the right concentration, and an independent double check.',
      skills: ['High-alert medication', 'Weight-based dose calculation', 'Concentration check', 'Independent double check', 'New primary infusion'],
      patient: {
        first: 'Raymond', last: 'Ortiz', mi: 'J', sex: 'M', dob: '1968-03-27', age: '58 years',
        mrn: '7720511', room: '432-A', heightCm: 180, weightKg: 90,
        allergies: [], dx: 'Acute left femoral-popliteal DVT', attending: 'Dr. S. Morgan'
      },
      brief: {
        situation: 'Raymond Ortiz, 58, came to the ED with a swollen, painful left leg; ultrasound shows an acute femoral-popliteal DVT. The ED gave the heparin bolus at 0915 and sent him up without starting the drip. He has a saline-locked 20 g IV in the right forearm. Dosing weight 90 kg.',
        task: 'Find the heparin infusion order, remove the correct bag, scan it with a second RN double check, and start it on the IV pump by dose.'
      },
      order: { medId: 'cc3-heparin', short: 'Heparin 18 units/kg/hr (25,000 units/500 mL)' },
      ehr: {
        admitted: { time: '09:40', day: 0 },
        admitDx: 'Acute left femoral-popliteal deep vein thrombosis',
        flags: ['Bleeding precautions', 'Heparin protocol'],
        heparinFlowsheet: false,
        hpi: 'Mr. Ortiz drove 9 hours home from a trade show two days ago. Yesterday his left calf and thigh became swollen and painful. No chest pain or shortness of breath. Venous duplex in the ED: occlusive thrombus of the left femoral and popliteal veins. Baseline coags and CBC drawn. Heparin 80 units/kg bolus (7,200 units) given IV at 0915 in the ED; the infusion is to be started on the unit.',
        pmh: ['Hyperlipidemia', 'Obesity (BMI 27.8)'],
        psh: ['Left knee arthroscopy (2015)'],
        familyHx: ['Sister: DVT after surgery'],
        socialHx: ['Sales manager, travels often; lives with his partner', 'Former smoker (quit 2010); social alcohol'],
        homeMeds: [{ name: 'Atorvastatin', dose: '40 mg', route: 'PO', freq: 'Daily' }],
        orders: [
          { id: 'cc3-o1', cat: 'Admission', text: 'Admit to Medical-Surgical Unit, telemetry not required', time: '09:40', by: 'Dr. S. Morgan' },
          { id: 'cc3-o2', cat: 'Nursing', text: 'Vital signs every 4 hours; notify for chest pain, dyspnea, SpO2 < 92%, or bleeding', time: '09:40', by: 'Dr. S. Morgan' },
          { id: 'cc3-o3', cat: 'Nursing', text: 'Bleeding precautions; no IM injections', time: '09:40', by: 'Dr. S. Morgan' },
          { id: 'cc3-o4', cat: 'Activity', text: 'Up as tolerated; elevate left leg when in bed', time: '09:40', by: 'Dr. S. Morgan' },
          { id: 'cc3-o5', cat: 'Lab', text: 'aPTT 6 hours after the infusion starts, then per protocol', time: '09:40', by: 'Dr. S. Morgan', status: 'Pending' },
          { id: 'cc3-o6', cat: 'Lab', text: 'CBC daily (monitor platelets)', time: '09:40', by: 'Dr. S. Morgan' }
        ],
        meds: [
          { id: 'cc3-bolus', name: 'Heparin bolus (ED)', dose: '7,200 units', route: 'IV push', freq: 'Once — 80 units/kg', type: 'once', highAlert: true, doses: [{ time: '09:15', given: 'ED' }] },
          { id: 'cc3-atorva', name: 'Atorvastatin', dose: '40 mg', route: 'PO', freq: 'Daily at bedtime', type: 'scheduled', doses: [] },
          { id: 'cc3-apap', name: 'Acetaminophen', dose: '650 mg', route: 'PO', freq: 'Every 6 hours PRN', type: 'prn', indication: 'Pain (no NSAIDs while on heparin)', minIntervalHr: 6, preAssess: ['Pain'] },
          { id: 'cc3-flush', name: 'Sodium chloride 0.9% flush', dose: '10 mL', route: 'IV', freq: 'Every 8 hours and PRN', type: 'prn', indication: 'Line patency', minIntervalHr: 0 }
        ],
        vitals: [
          { time: '08:45', temp: 98.9, tempRoute: 'Oral', hr: 92, rr: 18, sbp: 142, dbp: 86, spo2: 97, o2: 'Room air', pain: 6, by: 'ED RN' },
          { time: '09:50', temp: 98.8, tempRoute: 'Oral', hr: 88, rr: 16, sbp: 136, dbp: 82, spo2: 97, o2: 'Room air', pain: 5, by: 'Day shift RN' }
        ],
        labs: [
          { id: 'cc3-coag', panel: 'Coagulation', time: '08:50', results: [
            { t: 'aPTT', v: 31, u: 'sec', lo: 25, hi: 35 }, { t: 'PT', v: 12.4, u: 'sec', lo: 11, hi: 13.5 }, { t: 'INR', v: 1.0, u: '', lo: 0.8, hi: 1.2 }] },
          { id: 'cc3-cbc', panel: 'CBC', time: '08:50', results: [
            { t: 'WBC', v: 8.1, u: 'k/uL', lo: 4.5, hi: 11.0 }, { t: 'Hemoglobin', v: 14.6, u: 'g/dL', lo: 13.5, hi: 17.5 },
            { t: 'Platelets', v: 245, u: 'k/uL', lo: 150, hi: 400 }] },
          { id: 'cc3-bmp', panel: 'Basic Metabolic Panel', time: '08:50', results: [
            { t: 'Creatinine', v: 1.0, u: 'mg/dL', lo: 0.7, hi: 1.3 }, { t: 'Potassium', v: 4.2, u: 'mEq/L', lo: 3.5, hi: 5.1 }] }
        ],
        imaging: [{ id: 'cc3-us', study: 'Venous duplex, left lower extremity', time: '08:30', text: 'Occlusive thrombus in the left common femoral, femoral and popliteal veins. Calf veins not fully compressible. Right leg not imaged.' }],
        notes: [
          { id: 'cc3-n1', type: 'Admission H&P', author: 'Dr. S. Morgan', time: '09:40', text: 'Acute L femoral-popliteal DVT after prolonged travel. No signs of PE. Baseline aPTT 31, platelets 245, creatinine 1.0. Received heparin 80 units/kg bolus in the ED. Plan: heparin infusion 18 units/kg/hr by weight-based protocol (dosing weight 90 kg), aPTT 6 hours after start, daily CBC for platelets. Transition to oral anticoagulation when stable.' }
        ],
        io: []
      },
      newMed: { id: 'cc3-heparin', name: 'Heparin 25,000 units in 500 mL D5W (premixed)', dose: '18 units/kg/hr', route: 'IV', freq: 'Continuous — titrate per aPTT protocol', type: 'continuous',
        highAlert: true, weightRate: { unit: 'units/kg/hr', perMl: 50, source: '25,000 units/500 mL D5W', startMax: 2250 },
        preAssess: ['lab:aPTT', 'lab:Platelets'], indication: 'Acute DVT',
        instructions: 'Start at 18 units/kg/hr using the dosing weight of 90 kg. Program the pump by DOSE from the drug library. Independent double check with a second RN at start and every rate change. aPTT 6 hours after start.',
        orderedBy: 'Dr. S. Morgan' },
      eventNote: null,
      cabinet: {
        patient: { id: 'CC3', last: 'Ortiz', first: 'Raymond', mi: 'J', sex: 'M', dob: '1968-03-27', mrn: '7720511', room: '432-A',
          allergies: [], dx: 'Acute left femoral-popliteal DVT', provider: 'Dr. S. Morgan',
          orders: [
            { id: 'cc3c-hep', med: 'cc_hep_500_bag', dose: 25000, freq: 'continuous', dueIn: 0 },
            { id: 'cc3c-apap', med: 'apap_tab', dose: 650, freq: 'q6h', prn: 'pain (no NSAIDs)' },
            { id: 'cc3c-flush', med: 'ns_flush', dose: 10, freq: 'q8h', prn: 'line patency' }
          ] },
        others: [],
        formulary: {
          cc_hep_500_bag: { name: 'heparin in D5W (premixed)', brand: '', strength: 25000, unit: 'units', volume: 500, form: 'bag', desc: '25,000 units/500 mL premixed bag (50 units/mL)', route: 'IV', loc: { drawer: 6, type: 'CUBIE', pocket: 'B1' }, count: 4, noSplit: true },
          cc_hep_250_bag: { name: 'heparin in D5W (premixed)', brand: '', strength: 25000, unit: 'units', volume: 250, form: 'bag', desc: '25,000 units/250 mL premixed bag (100 units/mL)', route: 'IV', loc: { drawer: 6, type: 'CUBIE', pocket: 'B2' }, count: 4, noSplit: true }
        },
        items: {
          cc_hep_500_bag: { verdict: 'correct' },
          cc_hep_250_bag: { verdict: 'wrongProduct', msg: 'WRONG CONCENTRATION: you scanned heparin 25,000 units/250 mL (100 units/mL). The order is 25,000 units/500 mL (50 units/mL). Running this bag at the ordered mL/hr would give twice the dose.' }
        }
      },
      pump: { kind: 'primary', drugId: 'heparin', concIdx: 1, dose: 18, profile: 'medsurg' },
      debrief: {
        keyPoints: [
          'Heparin is a high-alert medication: an independent double check covers the order, the dosing weight, the bag concentration, and the pump programming.',
          'Dose math: 18 units/kg/hr × 90 kg = 1,620 units/hr ÷ 50 units/mL = 32.4 mL/hr.',
          'Two premixed bags look alike. 25,000 units/250 mL is 100 units/mL — twice as concentrated. Match the bag label to the pump library concentration every time.',
          'Program by DOSE from the drug library (units/kg/hr) so the dose limits protect the patient. Never use basic mL/hr for a high-alert drip.',
          'Monitor: aPTT 6 hours after the start, platelets (heparin-induced thrombocytopenia), and bleeding (gums, urine, stool, IV sites, neuro changes). Report chest pain or dyspnea (possible PE).'
        ],
        questions: [
          'What exactly did you and your second RN verify independently?',
          'If the 25,000 units/250 mL bag were hung with the pump programmed for 25,000 units/500 mL, what dose would Mr. Ortiz actually receive per hour?',
          'Why does the order use a dosing weight, and where did you find it?',
          'When is the next aPTT due, and what assessments will you do before then?'
        ],
        answerKey: 'Order: heparin 25,000 units/500 mL D5W at 18 units/kg/hr, dosing weight 90 kg. Cabinet: Ortiz, Raymond (432-A) → Remove → heparin 25,000 units/500 mL (Drawer 6 CUBIE B1). EMR: acknowledge, review aPTT 31 and platelets 245, scan wristband then bag, Document Infusion → Started, rate 18 units/kg/hr (= 1,620 units/hr = 32.4 mL/hr), double check + verifier. Pump: New Patient → Adult Med-Surg → patient ID 7720511 → Heparin 25,000 units/500 mL → weight 90 kg → dose 18 units/kg/hr → rate 32.4 mL/hr → VTBI 500 → START. Q2: with the 100 units/mL bag at 32.4 mL/hr the patient gets 3,240 units/hr (36 units/kg/hr) — double the order. Next aPTT: 6 hours after the start time.'
      }
    }
  ];

  // EMR patient record for a scenario (format: ehr/ docs — see the SimEHR README).
  function ehrPatient(sc) {
    const p = sc.patient, e = sc.ehr;
    const notes = (e.notes || []).slice();
    const ev = { id: eventId(sc), title: `New order — ${sc.order.short}`, instructorNotes: sc.debrief.answerKey, meds: [sc.newMed] };
    if (sc.eventNote) ev.notes = [Object.assign({ id: sc.id + '-ev-note', at: 0 }, sc.eventNote)];
    return {
      id: ehrId(sc), level: 1, experiences: ['combo'],
      name: { first: p.first, last: p.last }, mrn: p.mrn, dob: p.dob, age: p.age, sex: p.sex,
      unit: 'Medical-Surgical Unit (4 West)', room: p.room, service: 'Medicine', attending: p.attending,
      admitted: e.admitted, scenarioStart: '10:00', admitDx: e.admitDx, codeStatus: 'Full Code', isolation: /MRSA/.test(e.admitDx) ? 'Contact' : 'Standard',
      allergies: p.allergies.map(a => ({ agent: a.agent, reaction: a.reaction, severity: a.severity, tags: a.tags })), nkda: !p.allergies.length,
      heightCm: p.heightCm, weightKg: p.weightKg, flags: e.flags || [], assessmentForms: wdl, heparinFlowsheet: !!e.heparinFlowsheet,
      emergencyContact: 'Spouse/partner — phone on file',
      hpi: e.hpi, pmh: e.pmh, psh: e.psh, familyHx: e.familyHx, socialHx: e.socialHx, homeMeds: e.homeMeds,
      orders: e.orders, meds: e.meds, vitals: e.vitals, labs: e.labs, imaging: e.imaging || [], notes, io: e.io || [],
      priorDosesGiven: true, priorRN: 'KW',
      events: [ev]
    };
  }
  const ehrId = sc => 'cc-' + sc.id;
  const eventId = sc => sc.id + '-new-order';

  // How a removed cabinet item scans at the bedside for this scenario.
  // patientId = the cabinet patient it was removed for; medKey = formulary key;
  // F = the cabinet formulary; patients = every cabinet patient.
  function verdict(sc, patientId, medKey, F, patients) {
    const cab = sc.cabinet;
    const m = (F || {})[medKey] || {};
    const label = `${m.name || medKey}${m.desc ? ' — ' + m.desc : m.strength ? ` ${m.strength} ${m.unit} ${m.form}` : ''}`;
    if (patientId !== cab.patient.id) {
      const other = (cab.others || []).concat(patients || []).find(o => o.id === patientId);
      const who = other ? `${other.last.toUpperCase()}, ${other.first.toUpperCase()} (Rm ${other.room}, MRN ${other.mrn})` : 'another patient';
      return { verdict: 'wrongPatient', label, msg: `WRONG PATIENT: this medication was removed for ${who}. It is not for ${cab.patient.last.toUpperCase()}, ${cab.patient.first.toUpperCase()}.` };
    }
    const it = cab.items[medKey];
    if (it && it.verdict === 'correct') return { verdict: 'correct', label, ehrCode: 'RX-' + sc.order.medId.toUpperCase() };
    if (it) return { verdict: it.verdict, label, msg: it.msg };
    // Anything else (another of the patient's meds, or a med with no order) scans as a unit-dose
    // product code, and the EMR's own checks decide: matching order, LESS than ordered, or no order.
    return { verdict: 'other', label, ehrCode: productCode(m) };
  }
  // Cabinet item -> EMR unit-dose code (NDC-<DRUG>-<strength><UNIT>), the same format the EMR labels use.
  function productCode(m) {
    const key = (String(m.name || '').match(/[A-Za-z]{3,}/) || ['UNKNOWN'])[0].toUpperCase();
    const f = { g: [1000, 'MG'], mg: [1, 'MG'], mcg: [0.001, 'MG'], units: [1, 'UNITS'], mEq: [1, 'MEQ'], mL: [1, 'ML'] }[m.unit] || [1, 'MG'];
    return `NDC-${key}-${Number((m.strength * f[0]).toFixed(3))}${f[1]}`;
  }

  window.ComboScenarios = {
    list: LIST,
    byId: id => LIST.find(s => s.id === id) || null,
    ehrPatient, ehrId, eventId, verdict
  };
})();
