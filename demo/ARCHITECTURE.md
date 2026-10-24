# NULLA-LABS runtime architecture

The deployed demo remains a static, dependency-free GitHub Pages application. Modularization follows a strangler pattern: pure scientific contracts are extracted first while `app.js` remains the rendering façade, preserving the established DOM and Three.js scene.

## Active modules

| Module | Contract | Side effects |
|---|---|---|
| `src/nuclear/nuclear-data.js` | Curated isotope channels, mass-derived fusion Q-values and A/Z validator | Exposes immutable `NULLA_NUCLEAR` |
| `src/chemistry/verified-reactions.js` | Catalogued binary compounds with explicit evidence level | Exposes immutable `NULLA_VERIFIED_REACTIONS` |
| `src/chemistry/vsepr-engine.js` | Gillespie-Nyholm VSEPR classification (steric 2-6), orbital hybridization and 3D coordinate generation | Exposes immutable `NULLA_VSEPR` |
| `src/analysis/compatibility-engine.js` | Evidence vectors and contact-barrier estimates without arbitrary probability scores | Exposes immutable `NULLA_COMPATIBILITY` |
| `src/physics/quantum-spectroscopy.js` | Rydberg transitions, Bohr series, wavelength-to-RGB mapping and NIST atomic emission spectra | Exposes immutable `NULLA_QUANTUM_SPECTROSCOPY` |
| `src/physics/thermodynamics.js` | Pure phase boundary, profile validity, progress, Gibbs energy, Arrhenius/Eyring kinetics and Lennard-Jones | Exposes immutable `NULLA_THERMODYNAMICS` |
| `src/physics/measurement.js` | Pure distance, Å/pm conversion and three-point angle functions | Exposes immutable `NULLA_MEASUREMENT` |
| `src/i18n/i18n.js` | Eleven-locale static UI catalogue and locale lifecycle | Updates translated DOM bindings |
| `src/i18n/runtime-i18n.js` | Runtime status translations and interpolation | Extends the i18n façade |
| `src/i18n/ui-labels.js` | HUD, export, material and media labels in every locale | Extends the i18n catalogue |
| `src/i18n/scientific-i18n.js` | Evidence, coverage, instability and compatibility labels in every locale | Extends the i18n catalogue |
| `src/i18n/experience-science-i18n.js` | Mixture, phase applicability, Q-status and safe-export labels in every locale | Extends the i18n catalogue |
| `src/education/quiz-data.js` | Three equivalent scientific questions in every supported locale | Exposes immutable `NULLA_QUIZ` |
| `src/education/education-content.js` | Equivalent tutorial and technical documentation in every locale | Exposes immutable `NULLA_EDUCATION` |
| `src/education/advanced-tutorial.js` | Seven action-verified missions with stable IDs and targets in eleven locales | Exposes immutable `NULLA_ADVANCED_TUTORIAL` |
| `src/experience/experience-mode.js` | Stateful Basic/Laboratory/Scientific Data disclosure layer | Owns only DOM visibility and accessibility state |
| `app.js` | Three.js rendering, interactions, media capture and compatibility façade | Owns the scene and DOM event wiring |

## Safety rules

1. `index.html` is the authoritative module load list.
2. Pure modules may not access Three.js or mutate the DOM.
3. Unknown chemical inputs return `NO_CATALOGUED_PATH`; they never synthesize a fabricated product.
4. Nuclear reactions must pass conservation of mass number A and atomic number Z.
5. The cell renderer, cell control and organelle navigation are absent.
6. Any extraction from `app.js` requires characterization tests before changing the call site.
7. Renderer resources created per structure must be disposed or demonstrably stable across repeated cycles.
8. `tests/release-baseline.json` freezes the verified runtime files by SHA-256; intentional changes require a new test cycle and baseline.

## Deliberately local-first

There is no silent PubChem or remote-data request. External verification should be introduced later only as an explicit, cached, failure-tolerant user action; the current scientific catalogue remains deterministic and works offline.
