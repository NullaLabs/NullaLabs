import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const periodicSource = readFileSync(new URL('../periodic-table-data.js', import.meta.url), 'utf8');
const nuclearSource = readFileSync(new URL('../src/nuclear/nuclear-data.js', import.meta.url), 'utf8');
const i18nSource = readFileSync(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8');
const runtimeI18nSource = readFileSync(new URL('../src/i18n/runtime-i18n.js', import.meta.url), 'utf8');
const uiLabelsSource = readFileSync(new URL('../src/i18n/ui-labels.js', import.meta.url), 'utf8');
const telemetryI18nSource = readFileSync(new URL('../src/i18n/telemetry-i18n.js', import.meta.url), 'utf8');
const scientificI18nSource = readFileSync(new URL('../src/i18n/scientific-i18n.js', import.meta.url), 'utf8');
const experienceScienceI18nSource = readFileSync(new URL('../src/i18n/experience-science-i18n.js', import.meta.url), 'utf8');
const quizSource = readFileSync(new URL('../src/education/quiz-data.js', import.meta.url), 'utf8');
const educationSource = readFileSync(new URL('../src/education/education-content.js', import.meta.url), 'utf8');
const advancedTutorialSource = readFileSync(new URL('../src/education/advanced-tutorial.js', import.meta.url), 'utf8');
const experienceModeSource = readFileSync(new URL('../src/experience/experience-mode.js', import.meta.url), 'utf8');
const chemistrySource = readFileSync(new URL('../src/chemistry/verified-reactions.js', import.meta.url), 'utf8');
const compatibilitySource = readFileSync(new URL('../src/analysis/compatibility-engine.js', import.meta.url), 'utf8');
const thermodynamicsSource = readFileSync(new URL('../src/physics/thermodynamics.js', import.meta.url), 'utf8');
const measurementSource = readFileSync(new URL('../src/physics/measurement.js', import.meta.url), 'utf8');
const quantumSpectroscopySource = readFileSync(new URL('../src/physics/quantum-spectroscopy.js', import.meta.url), 'utf8');
const vseprSource = readFileSync(new URL('../src/chemistry/vsepr-engine.js', import.meta.url), 'utf8');

for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
  const sourcePath = match[1].split('?')[0];
  if (/^https?:/.test(sourcePath)) continue;
  assert.ok(existsSync(new URL(`../${sourcePath}`, import.meta.url)), `missing local script ${sourcePath}`);
  assert.match(match[1],/\?v=101\.2$/,`runtime script ${sourcePath} lacks the unified v101.2 cache key`);
}
const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(htmlIds).size,htmlIds.length,'HTML IDs must be unique');

const materials = [
  ['btn-nacl', 'buildNaclCrystal'],
  ['btn-diamond', 'buildDiamondLattice'],
  ['btn-c60', 'buildFullereneC60'],
  ['btn-nanotube', 'buildCarbonNanotube'],
  ['btn-graphene', 'buildGrapheneSheet'],
  ['btn-solvation', 'buildSolvationShell']
];

for (const [buttonId, builder] of materials) {
  assert.match(html, new RegExp(`id="${buttonId}"`), `missing ${buttonId}`);
  assert.match(app, new RegExp(`function ${builder}\\(`), `missing ${builder}`);
  assert.match(app, new RegExp(`'${buttonId}': ${builder}`), `uncoupled ${buttonId}`);
}

assert.doesNotMatch(html, /id="btn-cell"|organelle-nav-panel/, 'cell UI must stay removed');
assert.doesNotMatch(app, /buildEukaryoticCell/, 'cell builder must stay removed');
assert.doesNotMatch(app, /removedLegacyCellRenderer|Eukaryotic Animal Cell|Organelle Cutaway/i, 'legacy cell renderer must not remain in the runtime');
assert.match(app, /new MediaRecorder\(/, 'video recorder is not connected');
assert.match(app, /function downloadBlob\(/, 'export downloads are not centralized');
assert.match(app, /URL\.revokeObjectURL\(url\)/, 'export object URLs are not released');
assert.match(app, /requestSession\('immersive-vr'/, 'WebXR button must request a real immersive session');
assert.match(app, /renderer\.xr\.setSession\(session\)/, 'WebXR session is not connected to the renderer');
assert.match(app, /structure\.startsWith\('nuclear-'\)/, 'shared nuclear URLs are not routed to the nuclear engine');
assert.match(app, /startNuclearCollision\(fusionReaction, 'fusion'\)/, 'shared fusion URLs cannot restore fusion');
assert.match(app, /startNuclearCollision\(fissionReaction, 'fission'\)/, 'shared fission URLs cannot restore fission');
assert.doesNotMatch(app, /WebXR Polyfill Enabled|Virtual Reality Session Active[\s\S]{0,100}isSessionSupported/, 'WebXR capability checks must not claim a session is active');
assert.match(app, /lennardJonesForceMagnitude/, 'Lennard-Jones model is absent');
assert.match(app, /activeThermalProfile/, 'material-specific phase profile is absent');
assert.match(app, /angstromPerWorldUnit/, 'physical measurement scale is absent');
assert.match(html, /btn-nuclear-fusion/, 'nuclear fusion control is absent');
assert.match(html, /btn-nuclear-fission/, 'nuclear fission control is absent');
assert.match(html, /id="btn-mix"/, 'physical mixture control is absent');
assert.match(html, /data-experience="basic"/, 'basic experience must be the progressive-disclosure entry point');
assert.match(html, /\.experience-mode-btn\[aria-checked="true"\]/, 'selected experience mode must retain its visual state');
assert.doesNotMatch(html, /experience-mode-btn\[aria-selected=/, 'obsolete tab-state styling must stay removed');
assert.match(app, /function attemptPhysicalMixture\(/, 'physical mixing is not separated from chemical combination');
assert.doesNotMatch(app, /zSum\s*>\s*118/, 'atomic-number addition must never fabricate fission');
assert.doesNotMatch(app, /Predicted \$\{|isVsepr|isEstimate|\(Est\)/, 'estimated compounds must not enter the product or suggestion paths');
assert.doesNotMatch(app, /predictCompoundFormula|buildVseprCompound|formVseprCompound/, 'legacy compound fabrication engine must stay removed');
assert.doesNotMatch(app, /formFissionDecay|isFission/, 'atomic-number-sum fission legacy must stay removed');
assert.doesNotMatch(app, /Multi-Fusion|Fusion State: DECAY/, 'chemical collisions must not be labelled as nuclear fusion');
assert.doesNotMatch(html, /superfluid transitions/i, 'educational thermal motion must not be advertised as a real phase simulation');
assert.match(app, /if \(!reaction\)[\s\S]{0,500}COMBINACIÓN QUÍMICA NO CATALOGADA/, 'direct chemical collision must reject unknown reactions');
assert.match(app, /formNuclearProducts/, 'nuclear products are not rendered');
assert.match(html, /id="runtime-diagnostics"/, 'runtime diagnostics output is absent');
assert.match(app, /getDiagnosticsSnapshot/, 'runtime diagnostics are not connected');
assert.match(app, /runtimeHealth:\{\.\.\.window\.NULLA_RUNTIME_HEALTH\}/, 'runtime error counters are not exposed to diagnostics');
assert.match(app, /translateVisibleRuntimeValues\(\)/, 'dynamic telemetry is not refreshed when the locale changes');
assert.match(app, /disposeLabelSprite/, 'label texture disposal is not centralized');
assert.match(app, /generation !== spawnGeneration/, 'stale asynchronous structure spawns are not rejected');
assert.match(app, /noBond: item\.noBond/, 'non-chemical particles cannot opt out of the bond graph');
assert.match(app, /nearestDistance \* 1\.18/, 'compound bond cutoff is not derived from nearest-neighbour geometry');
assert.doesNotMatch(app, /fusionTimer--/, 'reaction timing must not depend on frame rate');
assert.match(app, /fusionTimer - elapsedSeconds/, 'reaction timing is not based on elapsed time');
assert.doesNotMatch(app, /explosionTimer--/, 'explosion lifetime must not depend on frame rate');
assert.match(app, /explosionTimer - elapsedSeconds/, 'explosion lifetime is not based on elapsed time');
assert.doesNotMatch(app, /calculateGibbsFreeEnergy|95\.0%|0\.00 Debye \(NON-POLAR\)/, 'telemetry must not fabricate thermodynamic or stability data');
assert.match(app, /canonicalReactionKey/, 'chemical reaction selection is not canonicalized');
assert.match(app, /spawnAtoms\(atomList, explicitBondPairs = null\)/, 'explicit scientific bond topology is unavailable');
assert.match(app, /getExplicitCompoundBonds/, 'molecular products do not declare explicit bond graphs');
assert.match(app, /function formInertMixture[\s\S]{0,900}spawnAtoms\(combinedList, \[\]\)/, 'physical mixtures must use an explicit empty bond graph');
assert.match(app, /if \(phase\.key === 'unknown'\)[\s\S]{0,180}targetPos\.copy\(a\.basePos\)/, 'unknown phase data must not be animated as a solid');
assert.match(app, /A=\$\{activePhysicalNucleonCount \|\| count\}/, 'nuclear counter must expose physical mass number A');
assert.match(app, /nucleonType:isProton \? 'p' : 'n'/, 'nucleus particles must preserve proton/neutron identity');
assert.match(app, /nucleonType: item\.nucleonType \|\| null/, 'spawned particles must retain nucleon identity');
assert.match(app, /particleCount:liveAtoms\.length/, 'diagnostics must expose a neutral particle count while retaining atomCount compatibility');
assert.match(app, /if \(isNuclearMode\)[\s\S]{0,220}nucleonCounts\[atom\.nucleonType\]\+\+;[\s\S]{0,220}else[\s\S]{0,220}elementCounts\[symbol\]/, 'nuclear diagnostics must count nucleons without reporting them as chemical elements');
assert.match(app, /z < 1 \|\| z > 118/, 'the runtime must reject speculative non-IUPAC elements');
assert.doesNotMatch(app, /B-DNA · TP53/, 'schematic DNA must not claim a TP53 sequence');
assert.match(app, /NO PREDICTIVE THERMAL PROFILE/, 'schematic DNA limitations are not explicit');
assert.match(app, /tr\('xyzNuclearBlocked'\)[\s\S]{0,180}PROTON\/NEUTRON/, 'nuclear nucleons must not be exported as hydrogen XYZ records');
assert.match(app, /fusionRouteMismatch[\s\S]{0,260}blockedDomainMismatch/, 'fusion must reject a selected fission route instead of substituting a default');
assert.match(app, /fissionRouteMismatch[\s\S]{0,260}blockedDomainMismatch/, 'fission must reject a selected fusion route instead of substituting a default');
assert.doesNotMatch(app, /FUSIÓN NUCLEAR NO CATALOGADA|Graphics Quality Applied|Share Sheet Opened|Copy this share URL:|WebXR unavailable/, 'runtime telemetry must not retain hardcoded Spanish/English UI prose');
assert.match(app, /status\.atTransition \? tr\('phaseBoundary'\)/, 'phase thresholds must be presented as boundaries, not exact single phases');
assert.match(app, /name:'Phosphorus\(V\) Oxide',[\s\S]{0,100}formula:'P₄O₁₀',[\s\S]{0,100}c:10/, 'P4O10 cage metadata must match rendered atom counts');
assert.match(app, /name === 'Phosphorus\(V\) Oxide' && atomCount === 14[\s\S]{0,420}bridgeBonds[\s\S]{0,220}terminalBonds/, 'P4O10 cage must declare its 12 bridge and four terminal bonds');
assert.doesNotMatch(html, /id="hud-note"[^>]+data-i18n=/, 'dynamic telemetry note must not be overwritten by a static DNA binding');
assert.doesNotMatch(app, /Hydrochloric Acid|Iron Oxide \(Rust\)|Phosphorus Pentoxide|Iodine Gas|LIQUID MODEL/, 'known legacy scientific naming contradictions must stay removed');
assert.match(app, /tutorialReviewedScientificPanel/, 'tutorial verification must require an explicit scientific-panel review');
assert.match(app, /canvas\.addEventListener\('keydown'[\s\S]{0,420}measurementHit/, '3D measurement must expose a keyboard selection path');
assert.match(html, /id="onboarding-announcement"[^>]+aria-live="polite"[^>]+aria-atomic="true"/, 'tutorial steps need one atomic live announcer');
assert.match(app, /const announcement = `\$\{step\.title\}\. \$\{step\.instruction\} \$\{objectiveText\}`/, 'tutorial announcements must include title, instruction, and objective state');
assert.match(app, /aria-keyshortcuts','Enter Space'/, 'measurement mode must expose its keyboard shortcut');
assert.match(app, /periodicCells\.forEach\(cell => \{[\s\S]{0,260}elementAria/, 'periodic-cell accessible names must refresh on locale changes');
assert.match(html, /@media \(max-width: 600px\)[\s\S]{0,1800}\.nuclear-mode-bar \{[^}]*overflow-x:auto/, 'mobile nuclear controls must scroll instead of clipping');
assert.match(app, /setDialogBackgroundInert\(dialog,true\)/, 'modal dialogs must isolate background semantics and focus');
assert.match(app, /calibratedGeometryExportAllowed\(\)/, 'coordinate exporters must share the calibrated-geometry gate');
assert.match(html, /src\/audio\/procedural-audio\.js\?v=101\.2/, 'procedural audio synthesizer module is absent from html');
assert.match(app, /NULLA_AUDIO/, 'procedural tactile feedback is not integrated into runtime');

const periodicSandbox = {window:{}};
vm.runInNewContext(periodicSource, periodicSandbox);
const iupacElements = periodicSandbox.window.PERIODIC_DATA.elements.filter(element => element.number >= 1 && element.number <= 118);
assert.equal(iupacElements.length,118,'the IUPAC runtime set must contain exactly 118 elements');
assert.deepEqual(Array.from(iupacElements, element => element.number),Array.from({length:118},(_,index)=>index+1),'atomic numbers must be contiguous');
for (const element of iupacElements) {
  for (const field of ['melt','boil']) assert.ok(element[field] == null || Number.isFinite(element[field]),`${element.symbol} ${field} must be numeric or unavailable`);
  if (Number.isFinite(element.melt) && Number.isFinite(element.boil)) assert.ok(element.boil >= element.melt,`${element.symbol} has contradictory phase thresholds`);
}

const nuclearSandbox = {};
nuclearSandbox.globalThis = nuclearSandbox;
vm.runInNewContext(nuclearSource, nuclearSandbox);
const nuclear = nuclearSandbox.NULLA_NUCLEAR;
for (const routes of Object.values(nuclear.fusion)) {
  for (const reaction of routes) {
    const validation = nuclear.validateReaction(reaction);
    assert.equal(validation.valid, true, `${reaction.id} violates conservation or Q consistency`);
    assert.ok(Number.isFinite(validation.qCalculatedMeV), `${reaction.id} must calculate Q from isotope masses`);
    assert.ok(validation.qDeltaMeV <= 0.03, `${reaction.id} Q differs from the mass-derived value`);
    assert.equal(validation.qStatus,'VERIFIED',`${reaction.id} mass-derived Q must be verified`);
    assert.equal(validation.fullyValidated,true,`${reaction.id} must be fully validated`);
  }
}
for (const reaction of Object.values(nuclear.fission)) {
  const validation = nuclear.validateReaction(reaction);
  assert.equal(validation.valid, true, `${reaction.id} violates A/Z conservation`);
  assert.equal(validation.conservationValid, true, `${reaction.id} violates A/Z conservation`);
  assert.equal(validation.qStatus, 'UNVERIFIED', `${reaction.id} must disclose incomplete product-mass Q validation`);
  assert.equal(validation.fullyValidated, false, `${reaction.id} cannot be fully validated without channel masses`);
}
for (const reaction of [...Object.values(nuclear.fusion).flat(),...Object.values(nuclear.fission)]) {
  for (const id of reaction.reactants) assert.ok(nuclear.isotopes[id], `${reaction.id} references unknown reactant ${id}`);
  for (const [id,count] of reaction.products) {
    assert.ok(nuclear.isotopes[id], `${reaction.id} references unknown product ${id}`);
    assert.ok(Number.isInteger(count) && count > 0, `${reaction.id} has an invalid product multiplicity`);
  }
  const reactantNucleons = reaction.reactants.reduce((sum,id) => ({p:sum.p+nuclear.isotopes[id].Z,n:sum.n+nuclear.isotopes[id].A-nuclear.isotopes[id].Z}),{p:0,n:0});
  const productNucleons = reaction.products.reduce((sum,[id,count]) => ({p:sum.p+nuclear.isotopes[id].Z*count,n:sum.n+(nuclear.isotopes[id].A-nuclear.isotopes[id].Z)*count}),{p:0,n:0});
  assert.deepEqual(reactantNucleons,productNucleons,`${reaction.id} does not conserve proton/neutron counts`);
  const layout = nuclear.balancedProductLayout(reaction,20);
  const expandedCount = reaction.products.reduce((sum,[,count=1]) => sum+count,0);
  assert.equal(layout.length,expandedCount,`${reaction.id} product layout count diverges`);
  const totalA = layout.reduce((sum,item) => sum+item.A,0);
  const center = layout.reduce((sum,item) => ({x:sum.x+item.x*item.A,y:sum.y+item.y*item.A,z:sum.z+item.z*item.A}),{x:0,y:0,z:0});
  assert.ok(Math.hypot(center.x,center.y,center.z)/Math.max(1,totalA) < 1e-9,`${reaction.id} product layout has non-zero mass-weighted centre`);
  for (let i=0;i<layout.length;i++) for (let j=i+1;j<layout.length;j++) {
    assert.ok(Math.hypot(layout[i].x-layout[j].x,layout[i].y-layout[j].y,layout[i].z-layout[j].z) > 1,`${reaction.id} products overlap at initialization`);
  }
}

const i18nSandbox = {
  document:{ addEventListener(){} },
  CustomEvent:class {},
  addEventListener(){},
  globalThis:null
};
i18nSandbox.globalThis = i18nSandbox;
vm.runInNewContext(i18nSource, i18nSandbox);
vm.runInNewContext(runtimeI18nSource, i18nSandbox);
vm.runInNewContext(uiLabelsSource, i18nSandbox);
vm.runInNewContext(telemetryI18nSource, i18nSandbox);
vm.runInNewContext(scientificI18nSource, i18nSandbox);
vm.runInNewContext(experienceScienceI18nSource, i18nSandbox);
const catalogs = i18nSandbox.NULLA_I18N.messages;
assert.equal(Object.keys(catalogs).length, 11, 'exactly 11 Chronolith locales are required');
const canonicalKeys = Object.keys(catalogs.es).sort();
for (const [locale, catalog] of Object.entries(catalogs)) {
  assert.deepEqual(Object.keys(catalog).sort(), canonicalKeys, `${locale} translation keys diverge`);
  assert.ok(Object.values(catalog).every(value => String(value).trim()), `${locale} contains an empty translation`);
  for (const key of ['atoms','waiting','selectFusion','selectFission','noSuggestion','phaseUnknown','phaseSolid','phaseLiquid','phaseGas','blockedDomainMismatch','graphicsQualityApplied','shareSheetOpened','webxrUnavailable','thermochemistryUnavailable','distributedYields']) {
    assert.ok(catalog[key], `${locale} is missing runtime key ${key}`);
  }
  for (const key of ['referenceModel','dataUnavailable','dataCoverage','instability','statusIncompleteData','statusExoenergetic']) {
    assert.ok(catalog[key], `${locale} is missing scientific key ${key}`);
  }
  for (const key of ['phaseBoundary','fusionRouteMismatch','fissionRouteMismatch','geometricAngle','sceneLabel','experienceLevelLabel','measurementSceneLabel']) {
    assert.ok(catalog[key], `${locale} is missing final science/UX key ${key}`);
  }
}
assert.match(i18nSandbox.NULLA_I18N.t('atoms',{count:3}), /3/, 'runtime interpolation failed');
for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) {
  assert.ok(catalogs.es[match[1]], `HTML references unknown translation key ${match[1]}`);
}
for (const match of html.matchAll(/data-i18n-(?:aria-label|label)="([^"]+)"/g)) {
  assert.ok(catalogs.es[match[1]], `HTML references unknown accessible translation key ${match[1]}`);
}
vm.runInNewContext(quizSource, i18nSandbox);
assert.deepEqual([...i18nSandbox.NULLA_QUIZ.locales].sort(), Object.keys(catalogs).sort(), 'quiz locales diverge from platform locales');
for (const locale of Object.keys(catalogs)) {
  const questions = i18nSandbox.NULLA_QUIZ.get(locale);
  assert.equal(questions.length, 3, `${locale} must expose the same three quiz questions`);
  for (const question of questions) {
    assert.equal(question.options.length, 4, `${locale} quiz option count diverges`);
    assert.ok(Number.isInteger(question.correct) && question.correct >= 0 && question.correct < 4, `${locale} quiz answer is invalid`);
    assert.ok(question.question && question.explanation, `${locale} quiz content is incomplete`);
  }
}
vm.runInNewContext(educationSource, i18nSandbox);
assert.deepEqual([...i18nSandbox.NULLA_EDUCATION.locales].sort(), Object.keys(catalogs).sort(), 'education locales diverge from platform locales');
for (const locale of Object.keys(catalogs)) {
  const education = i18nSandbox.NULLA_EDUCATION.get(locale);
  assert.equal(education.tutorial.length, 3, `${locale} tutorial step count diverges`);
  assert.equal(education.docs.length, 4, `${locale} documentation section count diverges`);
  assert.ok(education.tutorial.every(step => step.title && step.instruction && step.targetId), `${locale} tutorial is incomplete`);
  assert.ok(education.docs.every(section => section.length === 2 && section.every(Boolean)), `${locale} documentation is incomplete`);
}
vm.runInNewContext(advancedTutorialSource, i18nSandbox);
assert.deepEqual([...i18nSandbox.NULLA_ADVANCED_TUTORIAL.locales].sort(), Object.keys(catalogs).sort(), 'advanced tutorial locales diverge');
for (const locale of Object.keys(catalogs)) {
  const tutorial = i18nSandbox.NULLA_ADVANCED_TUTORIAL.get(locale);
  assert.equal(tutorial.tutorial.length,7,`${locale} advanced tutorial step count diverges`);
  assert.deepEqual(Array.from(tutorial.tutorial,step => step.id),Array.from(i18nSandbox.NULLA_ADVANCED_TUTORIAL.stepIds),`${locale} tutorial IDs diverge`);
  assert.ok(tutorial.tutorial.every(step => step.title && step.instruction && step.objective && step.targetId && step.mode && step.verify),`${locale} advanced tutorial is incomplete`);
  for (const step of tutorial.tutorial) assert.match(html,new RegExp(`id="${step.targetId}"`),`tutorial target ${step.targetId} is missing`);
}
vm.runInNewContext(experienceModeSource,i18nSandbox);
assert.deepEqual([...i18nSandbox.NULLA_EXPERIENCE.locales].sort(),Object.keys(catalogs).sort(),'experience-mode locales diverge');
const experienceCallbacks = {};
const experienceButtons = ['basic','lab','science'].map(mode => ({
  dataset:{experienceMode:mode},attributes:{},tabIndex:0,textContent:'',
  setAttribute(key,value){this.attributes[key]=value;},addEventListener(){},focus(){}
}));
const experienceSections = [
  {classList:{contains:key=>key==='experience-lab'},attributes:{},setAttribute(key,value){this.attributes[key]=value;},inert:false},
  {classList:{contains:key=>key==='experience-science'},attributes:{},setAttribute(key,value){this.attributes[key]=value;},inert:false}
];
const experienceDescription = {textContent:''};
const experienceSandbox = {
  document:{
    body:{dataset:{}},documentElement:{lang:'es'},
    addEventListener(type,callback){experienceCallbacks[type]=callback;},
    querySelectorAll(selector){return selector==='[data-experience-mode]'?experienceButtons:experienceSections;},
    getElementById(id){return id==='experience-mode-description'?experienceDescription:null;}
  },
  localStorage:{getItem(){return null;},setItem(){}},
  location:{hash:''},
  URLSearchParams,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
  NULLA_I18N:{locale:'es'},
  addEventListener(){},dispatchEvent(){},globalThis:null
};
experienceSandbox.globalThis=experienceSandbox;
vm.runInNewContext(experienceModeSource,experienceSandbox);
experienceCallbacks.DOMContentLoaded();
assert.equal(experienceSandbox.document.body.dataset.experience,'basic');
experienceSandbox.NULLA_EXPERIENCE.set('lab',{persist:false});
assert.equal(experienceSections[0].inert,false,'lab controls must be interactive in laboratory mode');
assert.equal(experienceSections[1].inert,true,'science controls must remain hidden in laboratory mode');
experienceSandbox.NULLA_EXPERIENCE.set('science',{persist:false});
assert.ok(experienceSections.every(section=>section.inert===false),'science mode must expose every tier');

const chemistrySandbox = {};
chemistrySandbox.globalThis = chemistrySandbox;
vm.runInNewContext(chemistrySource, chemistrySandbox);
const subscriptDigits = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
function parseFormula(formula) {
  const normalized = formula.replace(/[₀-₉]/g, digit => subscriptDigits[digit]);
  const counts = {};
  for (const match of normalized.matchAll(/([A-Z][a-z]?)(\d*)/g)) counts[match[1]] = (counts[match[1]] || 0) + Number(match[2] || 1);
  return counts;
}
for (const [key, reaction] of Object.entries(chemistrySandbox.NULLA_VERIFIED_REACTIONS)) {
  const formulaCounts = parseFormula(reaction.formula);
  const symbolsByZ = {
    1:'H',3:'Li',5:'B',6:'C',7:'N',8:'O',9:'F',11:'Na',12:'Mg',13:'Al',14:'Si',15:'P',16:'S',17:'Cl',
    19:'K',20:'Ca',22:'Ti',26:'Fe',27:'Co',28:'Ni',29:'Cu',30:'Zn',31:'Ga',33:'As',35:'Br',38:'Sr',
    39:'Y',40:'Zr',41:'Nb',42:'Mo',47:'Ag',50:'Sn',52:'Te',53:'I',56:'Ba',60:'Nd',72:'Hf',73:'Ta',74:'W',83:'Bi'
  };
  const atomCounts = Object.fromEntries(reaction.atoms.map(group => [symbolsByZ[group.z], group.c]));
  assert.deepEqual(formulaCounts, atomCounts, `${key} formula does not match atom groups`);
  assert.equal(reaction.evidenceLevel, 'CATALOGUED', `${key} lacks evidence classification`);
}
assert.ok(Object.keys(chemistrySandbox.NULLA_MOLECULAR_REACTIONS || {}).length >= 12, 'molecular and heterostructure synthesis catalogue must be populated');

const compatibilitySandbox = {};
compatibilitySandbox.globalThis = compatibilitySandbox;
vm.runInNewContext(compatibilitySource, compatibilitySandbox);
const compatibility = compatibilitySandbox.NULLA_COMPATIBILITY;
const unknownCompatibility = compatibility.chemical({reactants:[],reaction:null,temperatureK:298});
assert.equal(unknownCompatibility.status, 'NO_CATALOGUED_PATH');
assert.equal(unknownCompatibility.score, null);
const knownCompatibility = compatibility.chemical({
  reactants:[{electronegativity:0.82},{electronegativity:2.96}],
  reaction:chemistrySandbox.NULLA_VERIFIED_REACTIONS['Br+K'],
  temperatureK:298
});
assert.equal(knownCompatibility.status, 'COMPOSITION_CATALOGUED_ROUTE_UNEVALUATED');
assert.equal(knownCompatibility.score, null, 'chemical compatibility must not expose an arbitrary percentage');
assert.ok(knownCompatibility.factors.some(item => item.includes('Δχ=')));
const legacyCompatibility = compatibility.chemical({
  reactants:[{electronegativity:2.2},{electronegativity:2.55},{electronegativity:3.04}],
  reaction:{evidenceLevel:'LEGACY_CURATED_ILLUSTRATION'}, temperatureK:298
});
assert.equal(legacyCompatibility.status, 'REFERENCE_MODEL_INCOMPLETE_DATA');
const alloyCompatibility = compatibility.multidisciplinary({
  reactants:[{z:29,symbol:'Cu',electronegativity:1.90},{z:28,symbol:'Ni',electronegativity:1.91}],
  reaction:null,
  temperatureK:298
});
assert.equal(alloyCompatibility.canCombine, true, 'Hume-Rothery Cu-Ni solid solution must be evaluated as combinable');
assert.equal(alloyCompatibility.stabilityClass, 'STABLE');
const nobleCompatibility = compatibility.multidisciplinary({
  reactants:[{z:2,symbol:'He'},{z:10,symbol:'Ne'}],
  reaction:null,
  temperatureK:298
});
assert.equal(nobleCompatibility.canCombine, false, 'Noble gas pair must be rejected as chemically unstable');
assert.equal(nobleCompatibility.stabilityClass, 'UNSTABLE_BOND');
assert.equal(nobleCompatibility.scribaGate, 'NO_GO', 'uncatalogued noble gas pair must trigger SCRIBA NO_GO gate');
assert.match(html, /id="btn-export-cif"/, 'crystallographic CIF export button must be present');
assert.match(app, /function exportCIFFile\(/, 'crystallographic CIF exporter must be implemented');
assert.equal(chemistrySandbox.NULLA_VERIFIED_REACTIONS['C+Hf'].melt, 4231, 'HfC UHTC melting point must be calibrated');
assert.equal(chemistrySandbox.NULLA_VERIFIED_REACTIONS['C+Hf'].bondLengthA, 2.32, 'HfC bond length must be calibrated in Angstroms');
const btoGoldschmidt = compatibility.computeGoldschmidtTolerance([56, 22, 8]);
assert.ok(btoGoldschmidt && btoGoldschmidt.t >= 1.0 && btoGoldschmidt.t <= 1.08, 'BaTiO3 Goldschmidt tolerance factor must be in the ferroelectric perovskite window');
const freeEnergy298 = compatibility.evaluateFreeEnergyKJmol(-285.8, -163.3, 298);
assert.ok(Math.abs(freeEnergy298 - (-237.1)) < 0.2, 'Gibbs free energy of H2O at 298 K must match thermodynamic reference');
assert.match(compatibility.computeChronolithSeal('BaTiO₃|298|-1659'), /^CHR-[0-9A-F]{8}$/, 'Chronolith seal must produce deterministic 8-hex-digit hash');
assert.match(html, /id="btn-polymorph"/, 'polymorph phase competition button must be present');
assert.match(html, /id="btn-synkronia"/, 'Synkronia neuromorphic button must be present');
const bnPoly1 = compatibility.getNextPolymorph('BN', null);
assert.equal(bnPoly1.polymorph.id, 'h-BN', 'first BN polymorph must be hexagonal h-BN');
const bnPoly2 = compatibility.getNextPolymorph('BN', 'h-BN');
assert.equal(bnPoly2.polymorph.id, 'c-BN', 'second BN polymorph must be cubic c-BN');
const synk1 = compatibility.evaluateSynkroniaState('SrTiO₃', 1, 298);
const synk5 = compatibility.evaluateSynkroniaState('SrTiO₃', 5, 298);
assert.ok(synk5.synapticWeight > synk1.synapticWeight, 'STDP pulse sequence must increase synaptic weight via LTP');
assert.ok(synk5.conductanceMicroS > synk1.conductanceMicroS, 'STDP potentiation must increase synaptic conductance');
assert.match(html, /id="btn-visual-mode"/, '3D visual representation switcher button must be present');
assert.match(html, /id="btn-ftir"/, 'FT-IR vibrational spectroscopy button must be present');
assert.match(html, /id="btn-homo-lumo"/, 'HOMO/LUMO frontier orbital button must be present');
assert.match(html, /id="homo-lumo-modal"/, 'HOMO/LUMO modal dialog must be present');
assert.match(html, /id="orbital-levels-canvas"/, 'HOMO/LUMO energy ladder canvas must be present');
assert.match(html, /id="btn-mep"/, 'MEP electrostatic potential surface button must be present');
assert.match(html, /id="mep-modal"/, 'MEP modal dialog must be present');
assert.match(html, /id="mep-canvas"/, 'MEP electrostatic potential canvas must be present');
assert.match(html, /id="btn-xrd"/, 'Bragg XRD diffraction button must be present');
assert.match(html, /id="btn-restore-left-hud"/, 'left telemetry panel drawer tab button must be present');
assert.match(html, /id="btn-restore-pt-hud"/, 'bottom periodic table drawer tab button must be present');
assert.match(html, /id="btn-segre-inject-isotope"/, 'Segrè nuclide synthesis injector button must be present');
assert.match(html, /id="btn-inspect-in-segre"/, 'Molecular HUD Segrè inspector link button must be present');
assert.match(app, /function injectNuclideIntoSynthesis\(/, 'injectNuclideIntoSynthesis must be defined in runtime');
assert.match(app, /function inspectCurrentInSegreChart\(/, 'inspectCurrentInSegreChart must be defined in runtime');
assert.match(app, /function generateMolecularHOMOLUMOCloud\(/, 'generateMolecularHOMOLUMOCloud must be defined in runtime');
assert.match(app, /function refreshHOMOLUMOSpectroscopy\(/, 'refreshHOMOLUMOSpectroscopy must be defined in runtime');
assert.match(app, /function drawOrbitalEnergyLadder\(/, 'drawOrbitalEnergyLadder must be defined in runtime');
assert.match(app, /function generateMEPSurface\(/, 'generateMEPSurface must be defined in runtime');
assert.match(app, /function generateDipoleArrow\(/, 'generateDipoleArrow must be defined in runtime');
assert.match(app, /function refreshMEPSpectroscopy\(/, 'refreshMEPSpectroscopy must be defined in runtime');
assert.match(app, /function drawMEPCanvas\(/, 'drawMEPCanvas must be defined in runtime');
assert.match(html, /id="btn-spectroscopy"/, 'quantum spectroscopy button must be present');
assert.match(html, /id="spectroscopy-modal"/, 'quantum spectroscopy modal must be present');
assert.match(html, /id="spectroscopy-canvas"/, 'quantum spectroscopy canvas must be present');
assert.match(html, /id="btn-vsepr"/, 'VSEPR geometry button must be present');
assert.match(html, /id="vsepr-modal"/, 'VSEPR geometry modal must be present');
assert.match(html, /id="vsepr-canvas"/, 'VSEPR geometry canvas must be present');
assert.match(app, /function refreshSpectroscopyView\(/, 'refreshSpectroscopyView must be defined in runtime');
assert.match(app, /function refreshVseprView\(/, 'refreshVseprView must be defined in runtime');
assert.match(app, /function drawVseprCanvas\(/, 'drawVseprCanvas must be defined in runtime');

const ftirWater = compatibility.computeFTIRVibrationalSpectrum([
  { z: 8, symbol: 'O', x: 0, y: 0, zCoord: 0, mass: 15.999 },
  { z: 1, symbol: 'H', x: 0.95, y: 0, zCoord: 0, mass: 1.008 },
  { z: 1, symbol: 'H', x: -0.24, y: 0.92, zCoord: 0, mass: 1.008 }
], [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }], 298);
assert.ok(ftirWater && Array.isArray(ftirWater.modes) && ftirWater.modes.length >= 2, 'FT-IR analysis must identify vibrational modes');
const stretchH = ftirWater.modes.find(m => m.type === 'stretch');
assert.ok(stretchH && stretchH.wavenumberCm1 > 3400 && stretchH.wavenumberCm1 < 3750, 'Water O-H stretch must be located in 3400-3750 cm^-1 region');

const ftirHeavyWater = compatibility.computeFTIRVibrationalSpectrum([
  { z: 8, symbol: 'O', x: 0, y: 0, zCoord: 0, mass: 15.999 },
  { z: 1, symbol: 'H', x: 0.95, y: 0, zCoord: 0, mass: 2.014 },
  { z: 1, symbol: 'H', x: -0.24, y: 0.92, zCoord: 0, mass: 2.014 }
], [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }], 298);
const stretchD = ftirHeavyWater.modes.find(m => m.type === 'stretch');
assert.ok(stretchD && stretchD.wavenumberCm1 < stretchH.wavenumberCm1, 'Isotopic substitution (Deuterium) must down-shift stretching wavenumber');
const isotopicRatio = stretchH.wavenumberCm1 / stretchD.wavenumberCm1;
assert.ok(isotopicRatio >= 1.34 && isotopicRatio <= 1.42, 'Isotopic wavenumber ratio must conform to square root of reduced masses');
assert.equal(ftirWater.spectrumCurve.length, 901, 'FT-IR continuous spectrum must span 4000 to 400 cm^-1 in 4 cm^-1 increments');

const homolumoWater = compatibility.computeHOMOLUMOProperties([
  { z: 8, symbol: 'O' },
  { z: 1, symbol: 'H' },
  { z: 1, symbol: 'H' }
], [{ a: 0, b: 1 }, { a: 0, b: 2 }], 'H2O', 298);
assert.equal(homolumoWater.formula, 'H2O');
assert.equal(homolumoWater.homoEv, -12.6);
assert.equal(homolumoWater.lumoEv, -5.2);
assert.equal(homolumoWater.bandgapEv, 7.4);
assert.equal(homolumoWater.hardnessEtaEv, 3.7);
assert.equal(homolumoWater.regime, 'AISLANTE_ELECTRICO');
assert.ok(homolumoWater.energyLevels.length >= 5, 'Must calculate energy ladder levels');
assert.ok(homolumoWater.nucleophilicSites.some(s => s.symbol === 'O'), 'Oxygen must be recognized as nucleophilic site');
assert.ok(homolumoWater.electrophilicSites.some(s => s.symbol === 'H'), 'Hydrogen must be recognized as electrophilic site');

const mepWater = compatibility.computeMolecularElectrostaticPotential([
  { z: 8, symbol: 'O', x: 0, y: 0, zCoord: 0, mass: 15.999 },
  { z: 1, symbol: 'H', x: 0.757, y: 0.586, zCoord: 0, mass: 1.008 },
  { z: 1, symbol: 'H', x: -0.757, y: 0.586, zCoord: 0, mass: 1.008 }
], [{ a: 0, b: 1 }, { a: 0, b: 2 }], 298);
assert.equal(mepWater.formula, 'OHH');
assert.ok(mepWater.dipoleDebye >= 1.5 && mepWater.dipoleDebye <= 2.2, 'Water dipole moment must be in 1.5-2.2 Debye range');
assert.ok(mepWater.vMinEv < -1.0, 'Water Oxygen must exhibit negative electrostatic potential');
assert.ok(mepWater.vMaxEv > 1.0, 'Water Hydrogens must exhibit positive electrostatic potential');
assert.equal(mepWater.polarityRegime, 'MODERADAMENTE_POLAR');
assert.ok(mepWater.hydrogenBondAcceptors.some(s => s.symbol === 'O'), 'Oxygen must be recognized as H-bond acceptor');
assert.ok(mepWater.hydrogenBondDonors.some(s => s.symbol === 'H'), 'Hydrogens must be recognized as H-bond donors');
assert.equal(mepWater.mepDistributionCurve.length, 60, 'MEP distribution curve must have 60 bins');
const xrdSample = compatibility.computeBraggXRDPattern([
  { z: 11, x: 0, y: 0, zCoord: 0 },
  { z: 17, x: 2.82, y: 0, zCoord: 0 },
  { z: 11, x: 0, y: 2.82, zCoord: 0 },
  { z: 17, x: 2.82, y: 2.82, zCoord: 0 }
], 1.5406);
assert.ok(xrdSample && Array.isArray(xrdSample.peaks) && xrdSample.peaks.length >= 1, 'Bragg XRD pattern must produce diffraction peaks');
assert.equal(xrdSample.peaks[0].intensity, 100, 'strongest Bragg XRD peak must be normalized to 100%');
const chargePlus = compatibility.computePaulingPartialCharge(0.93, 2.05);
const chargeMinus = compatibility.computePaulingPartialCharge(3.16, 2.05);
assert.ok(chargePlus.q > 0 && chargePlus.hexColor === 0x38BDF8, 'electropositive atom must receive positive partial charge and electrophilic blue color');
assert.ok(chargeMinus.q < 0 && chargeMinus.hexColor === 0xF43F5E, 'electronegative atom must receive negative partial charge and nucleophilic red color');
const relaxTest = compatibility.relaxAtomicStructure([
  { z: 8, x: -3.2, y: 0, zCoord: 0, electronegativity: 3.44 },
  { z: 1, x: 3.2, y: 0.5, zCoord: 0, electronegativity: 2.20 },
  { z: 1, x: 0, y: -3.2, zCoord: 0, electronegativity: 2.20 }
], 0.42, 298);
assert.ok(relaxTest && Array.isArray(relaxTest.relaxedPositions) && relaxTest.relaxedPositions.length === 3, 'relaxAtomicStructure must return relaxed 3D coordinates for all input atoms');
assert.ok(relaxTest.deltaEnergyKJmol <= 0, '3D force-field relaxation must lower or preserve potential energy');
const dtCompatibility = compatibility.nuclear({reaction:nuclear.fusion['H+H'][0],isotopes:nuclear.isotopes});
assert.equal(dtCompatibility.status, 'EXOENERGETIC_CHANNEL_KINETICS_UNEVALUATED');
assert.equal(dtCompatibility.confidence, null, 'Q and contact barrier do not justify a probability score');
assert.ok(dtCompatibility.barrierMeV > 0);

const physicsSandbox = {};
physicsSandbox.globalThis = physicsSandbox;
vm.runInNewContext(thermodynamicsSource, physicsSandbox);
const physics = physicsSandbox.NULLA_THERMODYNAMICS;
const waterProfile = {melt:273.15,boil:373.15};
assert.equal(physics.phaseAtTemperature(waterProfile,273.14),'solid');
assert.equal(physics.phaseAtTemperature(waterProfile,273.15),'liquid');
assert.equal(physics.phaseAtTemperature(waterProfile,373.15),'gas');
assert.equal(physics.phaseAtTemperature({boil:3915,transition:'sublimation'},3914),'solid');
assert.equal(physics.phaseAtTemperature({boil:3915,transition:'sublimation'},3915),'gas');
assert.equal(physics.phaseAtTemperature({melt:null,boil:null},298),'unknown');
assert.equal(physics.hasUsablePhaseProfile({melt:273.15,boil:373.15}),true);
assert.equal(physics.hasUsablePhaseProfile({melt:300,boil:null}),false);
assert.equal(physics.hasUsablePhaseProfile({boil:3915,transition:'sublimation'}),true);
const waterStatus = physics.phaseStatus(waterProfile,300);
assert.equal(waterStatus.key,'liquid');
assert.ok(Math.abs(waterStatus.progress - 0.2685) < 1e-12);
assert.equal(waterStatus.nextTransitionK,373.15);
const meltingBoundary = physics.phaseStatus(waterProfile,273.15);
assert.equal(meltingBoundary.atTransition,true);
assert.equal(meltingBoundary.boundaryTransition,'melting');
assert.equal(meltingBoundary.boundaryK,273.15);
const boilingBoundary = physics.phaseStatus(waterProfile,373.15);
assert.equal(boilingBoundary.boundaryTransition,'boiling');
assert.equal(boilingBoundary.boundaryK,373.15);
const sublimationBoundary = physics.phaseStatus({boil:3915,transition:'sublimation'},3915);
assert.equal(sublimationBoundary.boundaryTransition,'sublimation');
assert.equal(sublimationBoundary.boundaryK,3915);
const sigma = 3;
const epsilon = 0.003;
const equilibrium = Math.pow(2,1/6) * sigma;
assert.ok(Math.abs(physics.lennardJonesForceMagnitude(equilibrium,epsilon,sigma)) < 1e-12, 'LJ force must vanish at its equilibrium distance');
assert.ok(Math.abs(physics.reducedLennardJonesPotential(equilibrium,epsilon,sigma) + epsilon) < 1e-12, 'LJ potential minimum must equal -epsilon');
assert.ok(physics.lennardJonesForceMagnitude(sigma,epsilon,sigma) > 0, 'LJ short-range force must be repulsive');
assert.ok(physics.lennardJonesForceMagnitude(2*sigma,epsilon,sigma) < 0, 'LJ long-range force must be attractive');

const measurementSandbox = {};
measurementSandbox.globalThis = measurementSandbox;
vm.runInNewContext(measurementSource, measurementSandbox);
const measurement = measurementSandbox.NULLA_MEASUREMENT;
const unitDistance = measurement.distance({x:0,y:0,z:0},{x:3,y:4,z:0},0.2);
assert.equal(unitDistance.world,5);
assert.equal(unitDistance.angstrom,1);
assert.equal(unitDistance.picometer,100);
assert.ok(Math.abs(measurement.angleDegrees({x:1,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0})-90) < 1e-12);
assert.ok(Math.abs(measurement.angleDegrees({x:1,y:0,z:0},{x:0,y:0,z:0},{x:-1,y:0,z:0})-180) < 1e-12);
assert.equal(measurement.angleDegrees({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0}),null);

// Nuclear AME2020 / CODATA Mass Defect and Q-Value
const dtDefect = nuclear.calculateMassDefectAndQ(['D', 'T'], [['He4', 1], ['n', 1]]);
assert.equal(dtDefect.valid, true);
assert.equal(dtDefect.conservationValid, true);
assert.ok(Math.abs(dtDefect.qMeV - 17.589) < 0.05, 'D-T Q-value must agree with reference 17.589 MeV');
assert.equal(dtDefect.isExoenergetic, true);

// Stability Line & Nuclear Decay Prediction
assert.equal(nuclear.getStabilityLineN(1), 1);
assert.equal(nuclear.getStabilityLineN(20), 20);
assert.ok(nuclear.getStabilityLineN(92) > 140, 'Uranium stable N must be > 140');
assert.equal(nuclear.predictDecayMode(92, 146), 'alpha', 'U-238 must decay via alpha');
assert.equal(nuclear.predictDecayMode(6, 8), 'beta_minus', 'C-14 must decay via beta-minus');
assert.equal(nuclear.predictDecayMode(6, 5), 'beta_plus', 'C-11 must decay via beta-plus');
assert.equal(nuclear.predictDecayMode(2, 2), 'stable', 'He-4 must be stable');

const decayRemaining = nuclear.calculateRadioactiveDecayRemaining(100, 10, 20);
assert.equal(decayRemaining.remaining, 25);
assert.equal(decayRemaining.decayed, 75);
assert.equal(decayRemaining.elapsedHalfLives, 2);

const stepU238 = nuclear.simulateDecayStep('U238');
assert.equal(stepU238.found, true);
assert.equal(stepU238.daughter, 'Th234');
assert.equal(stepU238.mode, 'alpha');

// Quantum Spectroscopy & Rydberg Transitions
const spectroscopySandbox = {};
spectroscopySandbox.globalThis = spectroscopySandbox;
vm.runInNewContext(quantumSpectroscopySource, spectroscopySandbox);
const spectroscopy = spectroscopySandbox.NULLA_QUANTUM_SPECTROSCOPY;

const hAlpha = spectroscopy.calculateRydbergTransition(2, 3);
assert.equal(hAlpha.valid, true);
assert.ok(Math.abs(hAlpha.wavelengthNm - 656.28) < 0.2, 'H-alpha wavelength must be ~656.3 nm');
assert.equal(hAlpha.seriesName, 'Balmer Series');
assert.equal(hAlpha.spectralRegion, 'Visible (VIS)');
assert.ok(hAlpha.color && hAlpha.color.visible === true);
assert.ok(hAlpha.color.r > 150 && hAlpha.color.g < 50 && hAlpha.color.b < 50, 'H-alpha must be red');

const lymanAlpha = spectroscopy.calculateRydbergTransition(1, 2);
assert.ok(Math.abs(lymanAlpha.wavelengthNm - 121.57) < 0.2, 'Lyman-alpha wavelength must be ~121.6 nm');
assert.equal(lymanAlpha.seriesName, 'Lyman Series');
assert.equal(lymanAlpha.spectralRegion, 'Ultraviolet (UV)');

const rgbRed = spectroscopy.wavelengthToRGB(656);
assert.equal(rgbRed.visible, true);
assert.ok(rgbRed.r > 200);

const rgbCyan = spectroscopy.wavelengthToRGB(486);
assert.equal(rgbCyan.visible, true);
assert.ok(rgbCyan.b > 150 && rgbCyan.g > 150);

assert.ok(spectroscopy.ELEMENT_EMISSION_SPECTRA.H.lines.length >= 4);
assert.ok(spectroscopy.ELEMENT_EMISSION_SPECTRA.Na.lines.some(l => Math.abs(l.wavelengthNm - 589.0) < 0.5));

// Chemical Thermodynamics & Eyring/Arrhenius Kinetics
const gibbs = physics.calculateGibbsFreeEnergy(-285.8, -163.3, 298.15);
assert.equal(gibbs.valid, true);
assert.ok(Math.abs(gibbs.deltaG_kJ_mol - (-237.1)) < 0.3, 'Water formation Delta G must be ~ -237.1 kJ/mol');
assert.equal(gibbs.regime, 'EXERGONIC_SPONTANEOUS');
assert.equal(gibbs.isSpontaneous, true);

const keq = physics.calculateEquilibriumConstant(-237.1, 298.15);
assert.equal(keq.valid, true);
assert.equal(keq.favorProducts, true);
assert.ok(keq.keq > 1e30);

const arrhenius = physics.calculateArrheniusRate(1e11, 50, 300);
assert.equal(arrhenius.valid, true);
assert.ok(arrhenius.rateConstantK > 0);

const rxnCoord = physics.generateReactionCoordinateCurve(0, 75, -25);
assert.equal(rxnCoord.activationEnergyForward, 75);
assert.equal(rxnCoord.activationEnergyReverse, 100);
assert.equal(rxnCoord.deltaHReaction, -25);
assert.equal(rxnCoord.curve.length, 101);

// VSEPR 3D Molecular Geometry & Hybridization
const vseprSandbox = {};
vseprSandbox.globalThis = vseprSandbox;
vm.runInNewContext(vseprSource, vseprSandbox);
const vsepr = vseprSandbox.NULLA_VSEPR;

const tet = vsepr.classifyStericGeometry(4, 0);
assert.equal(tet.valid, true);
assert.equal(tet.hybridization, 'sp³');
assert.equal(tet.molecularGeometry, 'Tetrahedral');
assert.equal(tet.idealAngleDegrees, 109.47);

const bentWater = vsepr.classifyStericGeometry(2, 2);
assert.equal(bentWater.valid, true);
assert.equal(bentWater.hybridization, 'sp³');
assert.equal(bentWater.molecularGeometry, 'Bent / Angular');
assert.equal(bentWater.idealAngleDegrees, 104.5);

const trigBip = vsepr.classifyStericGeometry(5, 0);
assert.equal(trigBip.hybridization, 'sp³d');
assert.equal(trigBip.molecularGeometry, 'Trigonal Bipyramidal');

const octa = vsepr.classifyStericGeometry(6, 0);
assert.equal(octa.hybridization, 'sp³d²');
assert.equal(octa.molecularGeometry, 'Octahedral');

const coordsCH4 = vsepr.generateVSEPR3DCoordinates(4, 0, 1.09);
assert.equal(coordsCH4.valid, true);
assert.equal(coordsCH4.ligandAtoms.length, 4);
assert.equal(coordsCH4.lonePairLobes.length, 0);

const coordsH2O = vsepr.generateVSEPR3DCoordinates(2, 2, 0.96);
assert.equal(coordsH2O.valid, true);
assert.equal(coordsH2O.ligandAtoms.length, 2);
assert.equal(coordsH2O.lonePairLobes.length, 2);

assert.ok(vsepr.VSEPR_MOLECULAR_DATABASE.H2O);
assert.ok(vsepr.VSEPR_MOLECULAR_DATABASE.CO2);
assert.ok(vsepr.VSEPR_MOLECULAR_DATABASE.SF6);

console.log('Smoke contracts passed.');
