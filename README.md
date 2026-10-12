# Med Pass Simulation (ClinicalCombo)

A complete simulated medication pass for nursing students that links three existing simulators:

1. **EMR** ([ATU-Meditech-Simulation-Hospital](https://github.com/LauraJobe/ATU-Meditech-Simulation-Hospital)): a new order arrives flagged **NEW**, and the student reviews and acknowledges it.
2. **Medication Room** ([Medication-Machine](https://github.com/LauraJobe/Medication-Machine)): the student signs in to the Pyxis- or Omnicell-style cabinet and removes the medication for the patient. Whatever is removed goes into the student's hands.
3. **EMR at the bedside:** on the MAR, the camera button is replaced by a **simulated scanner**. The student picks what to scan: the patient's wristband or an item in their hands. The EMR's usual checks apply (wristband first, dose matching, high-alert double check). Items removed for the wrong patient, or the wrong product, stop with a hard alert.
4. **Bedside IV pump** ([IV-INFUSION-PUMPS](https://github.com/LauraJobe/IV-INFUSION-PUMPS)): the pump stays covered until the student brings the bag and hangs it. The student programs the order on their facility's pump, and the pump grades it when the infusion is started.

Then there's a **debrief**: steps completed, safety concerns, near misses caught by the scanner, the pump grading table for each attempt, a timeline, key points, reflection questions, and Print / Save as PDF.

Open `index.html`, enter a name, choose **Guided** (checklist visible) or **Independent** (checklist hidden until the debrief), and pick a scenario.

## Scenarios

| Level | Scenario | What it tests |
|---|---|---|
| 1 | **Cefazolin 2 g IVPB**, post-op THA, LR at 100 mL/hr | Acknowledge, profile removal, BCMA, secondary 200 mL/hr |
| 2 | **Vancomycin 1 g/250 mL over 2 h** with a **name alert** (Marjorie vs Margaret Ellis) | Right patient at the cabinet, creatinine review, ≤ 1 g/hr (125 mL/hr) |
| 3 | **Heparin 25,000 units/500 mL at 18 units/kg/hr**, 90 kg | High-alert double check, concentration look-alike (250 mL bag), new primary by dose (32.4 mL/hr), patient ID on the pump |

Faculty answer keys are on the start page (**For faculty**) and at the bottom of each debrief. All patients are fictional.

## Put it online (GitHub Pages)

Settings → Pages → Deploy from a branch → `main`, `/ (root)`. The site will be at `https://laurajobe.github.io/ClinicalCombo/`. It's a static site, so you can also run `python3 -m http.server` in this folder and open `http://localhost:8000`.

Everything is saved in the browser on that computer. Starting a new scenario clears the previous run on that device, so print or save the debrief first.

## How it fits together

```
index.html, combo/shell.*   launcher: start page, station tabs, progress panel, debrief
combo/bridge.js             shared record of the run (localStorage), used by every station
combo/scenarios.js          the scenarios: EMR chart, cabinet profile and stock, pump order, debrief
ehr/                        copy of the SimEHR (+ js/combo-ehr.js)
medstation/                 copy of the MedStation simulator (+ js/combo-medstation.js)
pumps/                      copy of the IV Pump Practice Lab (+ js/combo-pump.js)
```

The three apps are copies of their repositories (EHR 672b914, MedStation 3e713e9, pumps 593fb80). Each copy changes only a few lines; everything else is in its `combo-*.js` hook:

- **ehr/**: `index.html` loads the hook instead of the Level 1–3 patient files; `js/config.js` uses its own storage prefix so it never mixes with the stand-alone EHR.
- **medstation/**: `js/app.js` reads its storage key and starting mode from the hook, reports each event to it, and draws IV bags.
- **pumps/**: `js/app.js` takes the order from the hook in simulation mode; `index.html` loads the hook (no SCORM or install files).

When you improve one of the original apps, copy the changed files into its folder and keep those few lines.

## Adding a scenario

Copy one of the objects in `combo/scenarios.js` and change it. Each scenario has:

- `patient` and `brief` (shown in the launcher), `order.medId` (the new EMR med id)
- `ehr` (the chart, in the SimEHR patient format: see the SimEHR `docs/ADDING-PATIENTS.md`) and `newMed` (the order released at the start)
- `cabinet`: the patient's cabinet profile, any look-alike patients (`others`), extra stock (`formulary`), and `items`, which says how each item scans at the bedside (`correct`, `wrongProduct` with a message, or `other`)
- `pump`: `kind` (`secondary` or `primary`), the library `drugId` and `concIdx`, and `minutes` + `primary` for a secondary or `dose` for a dose-based drip
- `debrief`: key points, reflection questions, and the answer key

Use a numeric MRN, since the pump keypad takes numbers only, and use the same MRN in the EMR and the cabinet.
