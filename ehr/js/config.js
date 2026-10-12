/*
 * ATU Simulation Hospital EHR — site configuration
 * Edit these values to customize the system for your simulation lab.
 */
window.EHR_CONFIG = {
  hospitalName: 'ATU Simulation Hospital',
  systemName: 'SimEHR',
  // Shown on the sign-in screen. Also bump ?v= in index.html and labels.html when files change,
  // so browsers (older iPads especially) load the new files instead of a saved copy.
  version: '2026.09.30-4',

  // Simulation experiences students choose from at sign-in. Each patient in
  // js/data/patients.js lists the experience ids it belongs to.
  experiences: [
    { id: 'ms', label: 'Medical-Surgical' },
    { id: 'advms', label: 'Advanced Medical-Surgical' },
    { id: 'icu', label: 'ICU / Critical Care' },
    { id: 'psych', label: 'Psychiatric / Mental Health' },
    { id: 'ob', label: 'OB / Maternal-Newborn' },
    { id: 'peds', label: 'Pediatrics' }
  ],

  // PIN that unlocks Instructor Tools. This is a convenience lock only,
  // not real security — anyone who can read the page source can see it.
  instructorPin: '2468',

  // When true, students must scan (or type) the patient wristband MRN and the
  // medication barcode before documenting an administration. They may still
  // choose "Unable to scan" and give a reason, which is recorded.
  requireBarcodeScan: true,

  // A scheduled dose is "Due" from this many minutes before to this many
  // minutes after its scheduled time. After that it becomes "Overdue".
  medWindowMinutes: 60,

  // Entries charted more than this many minutes after the event time are
  // labeled "Late entry".
  lateEntryMinutes: 30,

  // Prefix for all browser storage keys. Change it to start fresh everywhere.
  storagePrefix: 'clinicalCombo.ehr.v1', // ClinicalCombo: kept apart from the stand-alone SimEHR

  // Default adult reference ranges used to flag vital signs (H/L).
  // A patient can override any of these with its own "vitalRanges".
  vitalRanges: {
    temp: [96.8, 100.3], // °F
    hr: [60, 100],
    rr: [12, 20],
    sbp: [90, 140],
    dbp: [60, 90],
    map: [65, 110],
    spo2: [94, 100],
    glucose: [70, 180],
    pain: [0, 3]
  }
};
