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
  const symbolsByZ = {1:'H',3:'Li',5:'B',6:'C',7:'N',8:'O',9:'F',11:'Na',12:'Mg',13:'Al',16:'S',17:'Cl',19:'K',20:'Ca',22:'Ti',26:'Fe',29:'Cu',30:'Zn',35:'Br',47:'Ag',53:'I',56:'Ba'};
  const atomCounts = Object.fromEntries(reaction.atoms.map(group => [symbolsByZ[group.z], group.c]));
  assert.deepEqual(formulaCounts, atomCounts, `${key} formula does not match atom groups`);
  assert.equal(reaction.evidenceLevel, 'CATALOGUED', `${key} lacks evidence classification`);
}

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

console.log('Smoke contracts passed.');
