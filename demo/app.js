// NULLA-LABS IUPAC 3D MOLECULAR SYNTHESIS PLATFORM v101.2
// 118 elements + catalogued chemistry + explicit educational motion models
window.NULLA_RUNTIME_HEALTH = { errors:0, unhandledRejections:0 };
window.addEventListener('error', () => { window.NULLA_RUNTIME_HEALTH.errors++; });
window.addEventListener('unhandledrejection', () => { window.NULLA_RUNTIME_HEALTH.unhandledRejections++; });
window.addEventListener('DOMContentLoaded', function() {
  'use strict';

  // === URL PARAMETERS SAFE PARSING (Hoisted to avoid Temporal Dead Zone) ===
  let paramZ = null;
  let paramFuse = null;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    paramZ = urlParams.get('z');
    paramFuse = urlParams.get('fuse');

    if (!paramFuse && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      if (hash.includes('reactants')) {
        paramFuse = hash.split('=')[1];
      }
    }
  } catch (e) {
    console.warn("Error parsing URL params:", e);
  }

  const canvas = document.getElementById('webgl-canvas');
  const fpsVal = document.getElementById('fps-val');
  const runtimeDiagnostics = document.getElementById('runtime-diagnostics');
  const tr = (key, variables) => window.NULLA_I18N?.t(key, variables) ?? key;
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  const topBanner = document.getElementById('active-synthesis-banner');
  const hudPanel = document.getElementById('molecular-hud');
  const hudName = document.getElementById('hud-name');
  const hudFormula = document.getElementById('hud-formula');
  const hudClass = document.getElementById('hud-class');
  const hudBonds = document.getElementById('hud-bonds');
  const hudEnthalpy = document.getElementById('hud-enthalpy');
  const hudDipole = document.getElementById('hud-dipole');
  const hudStability = document.getElementById('hud-stability');
  const hudSpectrum = document.getElementById('hud-spectrum');
  const hudIr = document.getElementById('hud-ir');
  const hudNote = document.getElementById('hud-note');
  const hudEpi = document.getElementById('hud-epi');
  const hudCompatibility = document.getElementById('hud-compatibility');
  const hudConditions = document.getElementById('hud-conditions');
  const tempSlider = document.getElementById('temp-slider');
  const tempVal = document.getElementById('temp-val');
  const phaseProgressFill = document.getElementById('phase-progress-fill');
  const phaseTransitionStatus = document.getElementById('phase-transition-status');
  function updateThermalStatus() {
    const status = window.NULLA_THERMODYNAMICS?.phaseStatus(activeThermalProfile,temperatureK);
    if (phaseProgressFill) phaseProgressFill.style.width = `${Math.round((status?.progress ?? 0) * 100)}%`;
    if (!phaseTransitionStatus) return;
    if (!status || status.key === 'unknown') {
      phaseTransitionStatus.textContent = `${tr('phaseUnavailable')} · ${tr('phaseModelDisabled')}`;
      return;
    }
    const phaseLabel = status.atTransition ? tr('phaseBoundary') : phaseAtTemperature(activeThermalProfile,temperatureK).label;
    const displayedTransition = status.atTransition ? status.boundaryTransition : status.transition;
    const displayedTransitionK = status.atTransition ? status.boundaryK : status.nextTransitionK;
    const transitionKey = {
      melting:'transitionMelting',
      boiling:'transitionBoiling',
      sublimation:'transitionSublimation'
    }[displayedTransition];
    const transition = displayedTransitionK == null
      ? tr('noFurtherTransition')
      : `${tr(transitionKey)} @ ${displayedTransitionK} K`;
    const applicability = activeThermalProfile?.applicablePhase && activeThermalProfile.applicablePhase !== status.key
      ? ` · ${tr('outsideApplicability')} (${tr(`phase${activeThermalProfile.applicablePhase[0].toUpperCase()}${activeThermalProfile.applicablePhase.slice(1)}`)})`
      : '';
    phaseTransitionStatus.textContent = `${phaseLabel} · ${transition}${applicability} · ${tr('qualitativeNotMd')}`;
  }
  function setThermalControlEnabled(enabled, reason = 'unavailable') {
    if (tempSlider) tempSlider.disabled = !enabled;
    if (tempSlider) tempSlider.style.opacity = enabled ? '1' : '0.45';
    if (tempVal) tempVal.textContent = enabled
      ? `${temperatureK} K (${Math.round(temperatureK - 273.15)}°C)`
      : reason === 'nuclear'
        ? tr('nuclearThermalOutsideModel')
        : tr('phaseUnavailable');
    updateThermalStatus();
  }
  const btnReassemble = document.getElementById('btn-reassemble');
  const btnOrbitals = document.getElementById('btn-orbitals');
  const btnMeasure = document.getElementById('btn-measure');
  const btnExportGltf = document.getElementById('btn-export-gltf');
  const btnExportXyz = document.getElementById('btn-export-xyz');
  const btnAudio = document.getElementById('btn-audio');
  const btnExport = document.getElementById('btn-export');
  const btnSuggest = document.getElementById('btn-suggest');

  const ptHudPanel = document.getElementById('pt-hud-panel');
  let activeDialog = null;
  let lastDialogFocus = null;
  const dialogBackgroundState = new Map();

  function setDialogBackgroundInert(dialog, inert) {
    for (const element of document.body.children) {
      if (element === dialog || element.tagName === 'SCRIPT') continue;
      if (inert) {
        if (!dialogBackgroundState.has(element)) dialogBackgroundState.set(element,{inert:element.inert,ariaHidden:element.getAttribute('aria-hidden')});
        element.inert = true;
        element.setAttribute('aria-hidden','true');
      } else {
        const previous = dialogBackgroundState.get(element);
        if (!previous) continue;
        element.inert = previous.inert;
        if (previous.ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden',previous.ariaHidden);
      }
    }
    if (!inert) dialogBackgroundState.clear();
  }

  function openDialog(dialog, trigger = null) {
    if (!dialog) return;
    if (activeDialog !== dialog) lastDialogFocus = trigger || document.activeElement;
    activeDialog = dialog;
    dialog.style.display = 'block';
    setDialogBackgroundInert(dialog,true);
    const focusTarget = dialog.querySelector('button, [href], select, input, [tabindex]:not([tabindex="-1"])');
    if (focusTarget) focusTarget.focus({preventScroll:true});
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    dialog.style.display = 'none';
    setDialogBackgroundInert(dialog,false);
    if (activeDialog === dialog) activeDialog = null;
    if (lastDialogFocus && typeof lastDialogFocus.focus === 'function') lastDialogFocus.focus({preventScroll:true});
  }

  document.addEventListener('keydown', event => {
    if (!activeDialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(activeDialog);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...activeDialog.querySelectorAll('button:not([disabled]), [href], select, input, [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const current = focusable.indexOf(document.activeElement);
    if (event.shiftKey && current <= 0) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
    else if (!event.shiftKey && current === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
  });

  const slots = [
    document.getElementById('slot-0'),
    document.getElementById('slot-1'),
    document.getElementById('slot-2')
  ];
  const btnFuse = document.getElementById('btn-fuse');
  const btnMix = document.getElementById('btn-mix');
  const btnRandom = document.getElementById('btn-random');
  const btnUndo = document.getElementById('btn-undo');
  const btnClear = document.getElementById('btn-clear');
  const atomCountEl = document.getElementById('atom-count');

  // ═══════════════════════════════════════════════════════════════
  // DYNAMIC 118 IUPAC ELEMENTS DATABASE Initializer
  // ═══════════════════════════════════════════════════════════════
  const EL_VISUALS = {
    1: { col: 0xFFFFFF, r: 0.53 },
    2: { col: 0xBF00FF, r: 0.31 },
    3: { col: 0xFFD700, r: 1.67 },
    4: { col: 0xFF7700, r: 1.12 },
    5: { col: 0x00FF9D, r: 0.87 },
    6: { col: 0x8A2BE2, r: 0.77 },
    7: { col: 0x00F0FF, r: 0.75 },
    8: { col: 0xFF0055, r: 0.73 },
    9: { col: 0xFF0055, r: 0.64 },
    10: { col: 0xBF00FF, r: 0.38 },
    11: { col: 0xFFD700, r: 1.90 },
    12: { col: 0xFF7700, r: 1.45 },
    13: { col: 0xAAAAAA, r: 1.18 },
    14: { col: 0x00FF9D, r: 1.11 },
    15: { col: 0xFF8800, r: 1.06 },
    16: { col: 0xFFD700, r: 1.02 },
    17: { col: 0x00FF9D, r: 0.99 },
    18: { col: 0xBF00FF, r: 0.71 },
    19: { col: 0xFFD700, r: 2.43 },
    20: { col: 0xFF7700, r: 1.94 },
    21: { col: 0x00D4FF, r: 1.84 },
    22: { col: 0x00D4FF, r: 1.76 },
    23: { col: 0x00D4FF, r: 1.71 },
    24: { col: 0x00D4FF, r: 1.66 },
    25: { col: 0x00D4FF, r: 1.61 },
    26: { col: 0x00D4FF, r: 1.56 },
    27: { col: 0x00D4FF, r: 1.52 },
    28: { col: 0x00D4FF, r: 1.49 },
    29: { col: 0x00D4FF, r: 1.45 },
    30: { col: 0x00D4FF, r: 1.42 },
    31: { col: 0xAAAAAA, r: 1.36 },
    32: { col: 0x00FF9D, r: 1.25 },
    33: { col: 0x00FF9D, r: 1.21 },
    34: { col: 0xFF8800, r: 1.20 },
    35: { col: 0xFF0055, r: 1.20 },
    36: { col: 0xBF00FF, r: 1.16 },
    37: { col: 0xFFD700, r: 2.35 },
    38: { col: 0xFF7700, r: 2.15 },
    39: { col: 0x00D4FF, r: 1.90 },
    40: { col: 0x00D4FF, r: 1.75 },
    41: { col: 0x00D4FF, r: 1.64 },
    42: { col: 0x00D4FF, r: 1.54 },
    43: { col: 0x00D4FF, r: 1.47 },
    44: { col: 0x00D4FF, r: 1.46 },
    45: { col: 0x00D4FF, r: 1.42 },
    46: { col: 0x00D4FF, r: 1.39 },
    47: { col: 0x00D4FF, r: 1.45 },
    48: { col: 0x00D4FF, r: 1.44 },
    49: { col: 0xAAAAAA, r: 1.42 },
    50: { col: 0xAAAAAA, r: 1.39 },
    51: { col: 0x00FF9D, r: 1.39 },
    52: { col: 0x00FF9D, r: 1.38 },
    53: { col: 0xFF0055, r: 1.39 },
    54: { col: 0xBF00FF, r: 1.40 },
    55: { col: 0xFFD700, r: 2.72 },
    56: { col: 0xFF7700, r: 2.22 },
    57: { col: 0xFF55BB, r: 2.04 },
    58: { col: 0xFF55BB, r: 2.04 },
    59: { col: 0xFF55BB, r: 2.03 },
    60: { col: 0xFF55BB, r: 2.01 },
    61: { col: 0xFF55BB, r: 1.99 },
    62: { col: 0xFF55BB, r: 1.98 },
    63: { col: 0xFF55BB, r: 1.98 },
    64: { col: 0xFF55BB, r: 1.96 },
    65: { col: 0xFF55BB, r: 1.94 },
    66: { col: 0xFF55BB, r: 1.92 },
    67: { col: 0xFF55BB, r: 1.92 },
    68: { col: 0xFF55BB, r: 1.89 },
    69: { col: 0xFF55BB, r: 1.90 },
    70: { col: 0xFF55BB, r: 1.87 },
    71: { col: 0xFF55BB, r: 1.87 },
    72: { col: 0x00D4FF, r: 1.75 },
    73: { col: 0x00D4FF, r: 1.70 },
    74: { col: 0x00D4FF, r: 1.62 },
    75: { col: 0x00D4FF, r: 1.59 },
    76: { col: 0x00D4FF, r: 1.59 },
    77: { col: 0x00D4FF, r: 1.37 },
    78: { col: 0x00D4FF, r: 1.36 },
    79: { col: 0xFFD700, r: 1.44 },
    80: { col: 0x00D4FF, r: 1.49 },
    81: { col: 0xAAAAAA, r: 1.48 },
    82: { col: 0xAAAAAA, r: 1.47 },
    83: { col: 0xAAAAAA, r: 1.46 },
    84: { col: 0xAAAAAA, r: 1.46 },
    85: { col: 0xFF0055, r: 1.45 },
    86: { col: 0xBF00FF, r: 1.45 },
    87: { col: 0xFFD700, r: 2.90 },
    88: { col: 0xFF7700, r: 2.35 },
    89: { col: 0xFF5533, r: 2.15 },
    90: { col: 0xFF5533, r: 2.06 },
    91: { col: 0xFF5533, r: 2.00 },
    92: { col: 0xFF5533, r: 1.96 },
    93: { col: 0xFF5533, r: 1.90 },
    94: { col: 0xFF5533, r: 1.87 },
    95: { col: 0xFF5533, r: 1.80 },
    96: { col: 0xFF5533, r: 1.69 },
    97: { col: 0xFF5533, r: 1.66 },
    98: { col: 0xFF5533, r: 1.68 },
    99: { col: 0xFF5533, r: 1.65 },
    100: { col: 0xFF5533, r: 1.67 },
    101: { col: 0xFF5533, r: 1.73 },
    102: { col: 0xFF5533, r: 1.76 },
    103: { col: 0xFF5533, r: 1.61 },
    104: { col: 0x00D4FF, r: 1.57 },
    105: { col: 0x00D4FF, r: 1.49 },
    106: { col: 0x00D4FF, r: 1.43 },
    107: { col: 0x00D4FF, r: 1.41 },
    108: { col: 0x00D4FF, r: 1.34 },
    109: { col: 0x00D4FF, r: 1.29 },
    110: { col: 0x00D4FF, r: 1.28 },
    111: { col: 0x00D4FF, r: 1.21 },
    112: { col: 0x00D4FF, r: 1.22 },
    113: { col: 0xAAAAAA, r: 1.36 },
    114: { col: 0xAAAAAA, r: 1.43 },
    115: { col: 0xAAAAAA, r: 1.62 },
    116: { col: 0xAAAAAA, r: 1.75 },
    117: { col: 0xFF0055, r: 1.65 },
    118: { col: 0xBF00FF, r: 1.57 }
  };

  const EL = {};
  if (window.PERIODIC_DATA && window.PERIODIC_DATA.elements) {
    window.PERIODIC_DATA.elements.forEach(el => {
      const z = el.number;
      if (!Number.isInteger(z) || z < 1 || z > 118) return;
      const visual = EL_VISUALS[z] || { col: 0x888888, r: 1.0 };
      EL[z] = {
        z,
        s: el.symbol,
        n: el.name,
        m: el.mass,
        cat: el.category,
        sh: el.config,
        col: visual.col,
        r: visual.r,
        phase: el.phase,
        melt: el.melt,
        boil: el.boil,
        electronegativity: el.electronegativity || 0,
        density: el.density || 0,
        shells: el.shells,
        summary: el.summary
      };
    });
  }

  // Fallback to static data if script failed
  if (Object.keys(EL).length === 0) {
    for (let z in EL_VISUALS) {
      EL[z] = {
        z:Number(z),
        s: z == 1 ? 'H' : z == 2 ? 'He' : 'El',
        n: 'Element ' + z,
        m: z * 2,
        cat: 'Unknown',
        sh: '',
        col: EL_VISUALS[z].col,
        r: EL_VISUALS[z].r,
        phase: 'Solid',
        melt: 0,
        boil: 0,
        electronegativity: 0,
        density: 0,
        shells: [2],
        summary: 'Dataset load fallback'
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CURATED CHEMICAL STRUCTURE LIBRARY (separate from nuclear reactions)
  // Each entry is normalized by its selected element symbols.
  // ═══════════════════════════════════════════════════════════════
  const REACTION_LIBRARY = {
    'H+O':   { name:'Water',                formula:'H₂O',   atoms:[{z:8,c:1},{z:1,c:2}],     type:'Polar Covalent', bonds:'O-H Polar Covalent (×2)', state:'Liquid (25°C)', geom:'Bent 104.5°' },
    'H+N':   { name:'Ammonia',              formula:'NH₃',   atoms:[{z:7,c:1},{z:1,c:3}],     type:'Polar Covalent', bonds:'N-H Polar Covalent (×3)', state:'Gas (25°C)', geom:'Trigonal Pyramidal' },
    'H+C':   { name:'Methane',              formula:'CH₄',   atoms:[{z:6,c:1},{z:1,c:4}],     type:'Covalent', bonds:'C-H Covalent (×4)', state:'Gas (25°C)', geom:'Tetrahedral' },
    'H+Cl':  { name:'Hydrogen Chloride',    formula:'HCl',   atoms:[{z:17,c:1},{z:1,c:1}],    type:'Polar Covalent', bonds:'H-Cl Polar Covalent', state:'Gas (25°C); hydrochloric acid only in aqueous solution', geom:'Linear' },
    'H+F':   { name:'Hydrogen Fluoride',    formula:'HF',    atoms:[{z:9,c:1},{z:1,c:1}],     type:'Polar Covalent', bonds:'H-F Polar Covalent', state:'Gas (25°C)', geom:'Linear' },
    'H+S':   { name:'Hydrogen Sulfide',     formula:'H₂S',   atoms:[{z:16,c:1},{z:1,c:2}],    type:'Polar Covalent', bonds:'S-H Covalent (×2)', state:'Gas (25°C)', geom:'Bent 92°' },
    'C+O':   { name:'Carbon Dioxide',       formula:'CO₂',   atoms:[{z:6,c:1},{z:8,c:2}],     type:'Covalent', bonds:'C=O Double Bond (×2)', state:'Gas (25°C)', geom:'Linear 180°' },
    'N+O':   { name:'Nitric Oxide',         formula:'NO',    atoms:[{z:7,c:1},{z:8,c:1}],     type:'Covalent', bonds:'N=O Double Bond', state:'Gas (25°C)', geom:'Linear' },
    'S+O':   { name:'Sulfur Dioxide',       formula:'SO₂',   atoms:[{z:16,c:1},{z:8,c:2}],    type:'Covalent', bonds:'S=O Double Bond (×2)', state:'Gas (25°C)', geom:'Bent 119°' },
    'Na+Cl': { name:'Sodium Chloride',      formula:'NaCl',  atoms:[{z:11,c:1},{z:17,c:1}],   type:'Ionic Crystal', bonds:'Na⁺ Cl⁻ Ionic Bond', state:'Solid Crystal (25°C)', geom:'Cubic FCC Lattice' },
    'Na+O':  { name:'Sodium Oxide',         formula:'Na₂O',  atoms:[{z:11,c:2},{z:8,c:1}],    type:'Ionic', bonds:'Na⁺ O²⁻ Ionic Bond', state:'Solid (25°C)', geom:'Antifluorite' },
    'K+Cl':  { name:'Potassium Chloride',   formula:'KCl',   atoms:[{z:19,c:1},{z:17,c:1}],   type:'Ionic Crystal', bonds:'K⁺ Cl⁻ Ionic Bond', state:'Solid Crystal (25°C)', geom:'Cubic FCC Lattice' },
    'Ca+O':  { name:'Calcium Oxide',        formula:'CaO',   atoms:[{z:20,c:1},{z:8,c:1}],    type:'Ionic', bonds:'Ca²⁺ O²⁻ Ionic Bond', state:'Solid (25°C)', geom:'Rock Salt Structure' },
    'Ca+C':  { name:'Calcium Carbide',      formula:'CaC₂',  atoms:[{z:20,c:1},{z:6,c:2}],    type:'Ionic/Covalent', bonds:'Ca²⁺ C₂²⁻', state:'Solid (25°C)', geom:'Tetragonal' },
    'Fe+O':  { name:'Iron(III) Oxide',      formula:'Fe₂O₃', atoms:[{z:26,c:2},{z:8,c:3}],   type:'Ionic', bonds:'Fe³⁺ O²⁻ Ionic Bond', state:'Solid (25°C); rust is a hydrated multiphase mixture', geom:'Corundum Structure' },
    'Cu+O':  { name:'Copper Oxide',         formula:'CuO',   atoms:[{z:29,c:1},{z:8,c:1}],    type:'Ionic', bonds:'Cu²⁺ O²⁻ Ionic Bond', state:'Solid (25°C)', geom:'Monoclinic' },
    'Mg+O':  { name:'Magnesium Oxide',      formula:'MgO',   atoms:[{z:12,c:1},{z:8,c:1}],    type:'Ionic', bonds:'Mg²⁺ O²⁻ Ionic Bond', state:'Solid (25°C)', geom:'Rock Salt Structure' },
    'Si+O':  { name:'Silicon Dioxide',      formula:'SiO₂',  atoms:[{z:14,c:1},{z:8,c:2}],    type:'Covalent Network', bonds:'Si-O Covalent Network', state:'Solid Crystal (Quartz)', geom:'Tetrahedral Network' },
    'Al+O':  { name:'Aluminium Oxide',      formula:'Al₂O₃', atoms:[{z:13,c:2},{z:8,c:3}],   type:'Ionic', bonds:'Al³⁺ O²⁻ Ionic Bond', state:'Solid (Corundum/Sapphire)', geom:'Corundum' },
    'H+Br':  { name:'Hydrogen Bromide',     formula:'HBr',   atoms:[{z:35,c:1},{z:1,c:1}],    type:'Polar Covalent', bonds:'H-Br Polar Covalent', state:'Gas/Acid Solution', geom:'Linear' },
    'Na+F':  { name:'Sodium Fluoride',      formula:'NaF',   atoms:[{z:11,c:1},{z:9,c:1}],    type:'Ionic Crystal', bonds:'Na⁺ F⁻ Ionic Bond', state:'Solid Crystal (25°C)', geom:'Cubic FCC Lattice' },
    'C+H+N': { name:'Hydrogen Cyanide',     formula:'HCN',   atoms:[{z:1,c:1},{z:6,c:1},{z:7,c:1}], type:'Covalent', bonds:'C≡N Triple + C-H', state:'Gas/Liquid', geom:'Linear', note:'Composition model; not a one-step synthesis claim.' },
    'C+Cl':  { name:'Carbon Tetrachloride', formula:'CCl₄',  atoms:[{z:6,c:1},{z:17,c:4}],    type:'Covalent', bonds:'C-Cl Covalent (×4)', state:'Liquid (25°C)', geom:'Tetrahedral' },
    'P+O':   { name:'Phosphorus(V) Oxide',  formula:'P₄O₁₀', atoms:[{z:15,c:4},{z:8,c:10}],   type:'Covalent', bonds:'P-O & P=O Bonds', state:'Solid (25°C)', geom:'P₄O₁₀ Cage Structure' },
    'N+H':   { name:'Ammonia',              formula:'NH₃',   atoms:[{z:7,c:1},{z:1,c:3}],     type:'Polar Covalent', bonds:'N-H Polar Covalent (×3)', state:'Gas (25°C)', geom:'Trigonal Pyramidal' },
    
    // CURATED BINARY COMPOSITION MODELS
    'Li+O':  { name:'Lithium Oxide',        formula:'Li₂O',  atoms:[{z:3,c:2},{z:8,c:1}],     type:'Ionic Solid', bonds:'Li⁺ O²⁻ Ionic Bond', state:'Solid (25°C)', geom:'Antifluorite Structure' },
    'C+S':   { name:'Carbon Disulfide',     formula:'CS₂',   atoms:[{z:6,c:1},{z:16,c:2}],    type:'Covalent Liquid', bonds:'C=S Double Bond (×2)', state:'Liquid (25°C)', geom:'Linear 180°' },
    'C+F':   { name:'Carbon Tetrafluoride', formula:'CF₄',   atoms:[{z:6,c:1},{z:9,c:4}],     type:'Covalent Gas', bonds:'C-F Polar Covalent (×4)', state:'Gas (25°C)', geom:'Tetrahedral' },
    'Si+C':  { name:'Silicon Carbide',      formula:'SiC',   atoms:[{z:14,c:1},{z:6,c:1}],    type:'Covalent Network', bonds:'Si-C Covalent Network', state:'Solid (Carborundum)', geom:'Tetrahedral Grid' },
    'Mg+Cl': { name:'Magnesium Chloride',   formula:'MgCl₂', atoms:[{z:12,c:1},{z:17,c:2}],   type:'Ionic Solid', bonds:'Mg²⁺ Cl⁻ Ionic Bond', state:'Solid (25°C)', geom:'Cadmium Chloride Structure' },
    'Ca+Cl': { name:'Calcium Chloride',     formula:'CaCl₂', atoms:[{z:20,c:1},{z:17,c:2}],   type:'Ionic Solid', bonds:'Ca²⁺ Cl⁻ Ionic Bond', state:'Solid (25°C)', geom:'Rutile-like Structure' },
    'Al+Cl': { name:'Aluminium Chloride',   formula:'AlCl₃', atoms:[{z:13,c:1},{z:17,c:3}],   type:'Covalent/Ionic', bonds:'Al-Cl Polar Covalent', state:'Solid (25°C)', geom:'Layered Sheet Structure' },
    'Ti+Cl': { name:'Titanium Tetrachloride',formula:'TiCl₄', atoms:[{z:22,c:1},{z:17,c:4}],   type:'Covalent Liquid', bonds:'Ti-Cl Covalent (×4)', state:'Liquid (25°C)', geom:'Tetrahedral' },
    'Fe+Cl': { name:'Iron Chloride',        formula:'FeCl₃', atoms:[{z:26,c:1},{z:17,c:3}],   type:'Covalent Solid', bonds:'Fe-Cl Covalent (×3)', state:'Solid (25°C)', geom:'BiI3 Layered Structure' },
    'Cu+Cl': { name:'Copper Chloride',      formula:'CuCl₂', atoms:[{z:29,c:1},{z:17,c:2}],   type:'Covalent/Ionic', bonds:'Cu-Cl Polar Covalent', state:'Solid (25°C)', geom:'Monoclinic Chains' },
    'Zn+O':  { name:'Zinc Oxide',           formula:'ZnO',   atoms:[{z:30,c:1},{z:8,c:1}],    type:'Ionic/Covalent', bonds:'Zn²⁺ O²⁻ Polar Bond', state:'Solid (25°C)', geom:'Wurtzite/Hexagonal' },
    'Zn+Cl': { name:'Zinc Chloride',        formula:'ZnCl₂', atoms:[{z:30,c:1},{z:17,c:2}],   type:'Ionic/Covalent', bonds:'Zn-Cl Polar Covalent', state:'Solid (25°C)', geom:'Orthorhombic Network' },
    'Ag+O':  { name:'Silver Oxide',         formula:'Ag₂O',  atoms:[{z:47,c:2},{z:8,c:1}],    type:'Ionic Solid', bonds:'Ag⁺ O²⁻ Ionic Bond', state:'Solid (25°C)', geom:'Cubic Network' },
    'Au+O':  { name:'Gold Oxide',           formula:'Au₂O₃', atoms:[{z:79,c:2},{z:8,c:3}],    type:'Covalent Solid', bonds:'Au-O Covalent (×3)', state:'Solid (25°C)', geom:'Trigonal Pyramidal Grid' },
    'Pb+O':  { name:'Lead Oxide',           formula:'PbO',   atoms:[{z:82,c:1},{z:8,c:1}],    type:'Ionic Solid', bonds:'Pb²⁺ O²⁻ Ionic Bond', state:'Solid (Litharge)', geom:'Tetragonal Layered' },
    
    // HOMO-ATOMIC MOLECULAR REACTIONS
    'H+H':   { name:'Hydrogen Gas',         formula:'H₂',    atoms:[{z:1,c:2}],               type:'Covalent Diatomic', bonds:'H-H Covalent Bond', state:'Gas (25°C)', geom:'Linear' },
    'O+O':   { name:'Oxygen Gas',           formula:'O₂',    atoms:[{z:8,c:2}],               type:'Covalent Diatomic', bonds:'O=O Double Covalent Bond', state:'Gas (25°C)', geom:'Linear' },
    'N+N':   { name:'Nitrogen Gas',         formula:'N₂',    atoms:[{z:7,c:2}],               type:'Covalent Diatomic', bonds:'N≡N Triple Covalent Bond', state:'Gas (25°C)', geom:'Linear' },
    'F+F':   { name:'Fluorine Gas',         formula:'F₂',    atoms:[{z:9,c:2}],               type:'Covalent Diatomic', bonds:'F-F Covalent Bond', state:'Gas (25°C)', geom:'Linear' },
    'Cl+Cl': { name:'Chlorine Gas',         formula:'Cl₂',   atoms:[{z:17,c:2}],              type:'Covalent Diatomic', bonds:'Cl-Cl Covalent Bond', state:'Gas (25°C)', geom:'Linear' },
    'Br+Br': { name:'Bromine Gas',          formula:'Br₂',   atoms:[{z:35,c:2}],              type:'Covalent Diatomic', bonds:'Br-Br Covalent Bond', state:'Liquid (25°C)', geom:'Linear' },
    'I+I':   { name:'Iodine Molecule',      formula:'I₂',    atoms:[{z:53,c:2}],              type:'Covalent Diatomic', bonds:'I-I Covalent Bond', state:'Solid (25°C)', geom:'Linear' },
    'S+S':   { name:'Octasulfur Ring',      formula:'S₈',    atoms:[{z:16,c:8}],              type:'Covalent Ring', bonds:'S-S Covalent Bonds (×8)', state:'Solid (25°C)', geom:'Crown Ring' },
    'P+P':   { name:'White Phosphorus',     formula:'P₄',    atoms:[{z:15,c:4}],              type:'Covalent Molecule', bonds:'P-P Covalent Bonds (×6)', state:'Solid (25°C)', geom:'Tetrahedral' },
    'C+C':   { name:'Graphite',             formula:'C_n',   atoms:[{z:6,c:14}],              type:'Covalent Network', bonds:'C-C Hexagonal Sheet Bonds', state:'Solid (25°C)', geom:'Hexagonal Sheets' },
  };
  const canonicalReactionKey = symbols => [...symbols].map(String).sort().join('+');
  const REACTIONS = {};
  Object.entries({...REACTION_LIBRARY, ...(window.NULLA_VERIFIED_REACTIONS || {})}).forEach(([key, reaction]) => {
    REACTIONS[canonicalReactionKey(key.split('+'))] = {
      evidenceLevel:'LEGACY_CURATED_ILLUSTRATION',
      ...reaction
    };
  });


  // ═══════════════════════════════════════════════════════════════
  // WEBGL 3D SETUP & SAFE CONTEXT CREATION
  // ═══════════════════════════════════════════════════════════════
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  } catch (e) {
    console.warn('High-performance WebGL context failed, falling back to basic WebGL:', e);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  if (canvas) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('WebGL context lost. Suppressing crash...');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored. Re-rendering 3D model...');
      renderer.setSize(window.innerWidth, window.innerHeight);
      buildDNA();
    });
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020306, 0.002);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 75);

  // Studio Lighting (3-Point)
  scene.add(new THREE.DirectionalLight(0x00F0FF, 2.0).translateX(50).translateY(60).translateZ(50));
  const rimLight = new THREE.DirectionalLight(0x8A2BE2, 1.4);
  rimLight.position.set(-50, -40, -30);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight(0xFFFFFF, 0.75));

  // ═══════════════════════════════════════════════════════════════
  // DYNAMIC ATOM POOL - Spawn/despawn with smooth educational transitions
  // ═══════════════════════════════════════════════════════════════
  const sphereGeo = new THREE.SphereGeometry(1.0, 32, 32);
  const cylinderGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.0, 12);
  const bondMat = new THREE.MeshStandardMaterial({ color:0xFFFFFF, roughness:0.1, metalness:0.9, opacity:0.85, transparent:true });

  const moleculeGroup = new THREE.Group();
  scene.add(moleculeGroup);

  // Active Atom Objects
  let activeAtoms = [];
  let activeBonds = [];
  let spawnGeneration = 0;
  let activeInstancedMeshes = [];
  let activeBondInstancedMesh = null;
  let activeOrbitLines = [];
  let isDnaMode = false;
  let fusionState = 'idle';
  let fusionTimer = 0;
  let fusionChargeDuration = 1;
  let camShakeTimer = 0;
  let fusionReactantA = 0;
  let fusionReactantB = 0;
  let fusionTargetReaction = null;
  let explosionParticles = null;
  let explosionVelocities = [];
  let explosionTimer = 0;
  let shockwaveRing = null;
  let shockwaveRing2 = null;
  let fusionFlashSphere = null;
  let fusionFlashLight = null;
  let shockwaveScale = 0.1;
  let shockwaveOpacity = 1.0;
  let activeCollisionMode = 'chemical';
  let activePhysicalNucleonCount = 0;
  let nuclearChargeField = null;
  let activeStructureId = 'dna';
  let angstromPerWorldUnit = 0.42;
  let measurementScaleVerified = true;
  let activeThermalProfile = {
    label: 'B-DNA in aqueous environment',
    melt: 363,
    boil: 373.15,
    pressure: '1 atm',
    model: 'educational'
  };
  let activeBondCutoffWorld = null;

  // Selection Ring
  const selectRingGeo = new THREE.TorusGeometry(2.8, 0.3, 16, 32);
  const selectRingMat = new THREE.MeshBasicMaterial({ color:0xFF0055, wireframe:true });
  const selectRing = new THREE.Mesh(selectRingGeo, selectRingMat);
  selectRing.visible = false;
  moleculeGroup.add(selectRing);

  // ═══════════════════════════════════════════════════════════════
  // WEBAUDIO API QUANTUM SYNTHESIZER (Local-First & Frugal / Legion C08)
  // ═══════════════════════════════════════════════════════════════
  let audioCtx = null;
  let audioEnabled = typeof window !== 'undefined' && window.NULLA_AUDIO ? !window.NULLA_AUDIO.isMuted() : true;

  function initAudio() {
    if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
      window.NULLA_AUDIO.unlock();
      return;
    }
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.15, vol = 0.08) {
    if (!audioEnabled) return;
    if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
      if (freq >= 800) window.NULLA_AUDIO.playCue('confirm');
      else if (freq >= 500) window.NULLA_AUDIO.playCue('material');
      else window.NULLA_AUDIO.playCue('click');
      return;
    }
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playCollisionSound() {
    if (!audioEnabled) return;
    if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
      window.NULLA_AUDIO.playCue('nuclear');
      return;
    }
    initAudio();
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(32, audioCtx.currentTime + 0.45);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════
  // ATOMIC ORBITAL DENSITY CLOUD GENERATOR (s, p, d, f Probability Maps)
  // ═══════════════════════════════════════════════════════════════
  let orbitalParticleSystem = null;

  function generateAtomicOrbitalCloud(z) {
    if (orbitalParticleSystem) {
      moleculeGroup.remove(orbitalParticleSystem);
      orbitalParticleSystem.geometry.dispose();
      orbitalParticleSystem.material.dispose();
      orbitalParticleSystem = null;
    }

    const count = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const el = EL[z] || EL[1];
    const baseColor = new THREE.Color(el.col);

    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, zPos = 0;

      if (z <= 2) {
        // 1s Spherical Orbital
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = Math.pow(Math.random(), 2.0) * 14.0;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        zPos = r * Math.cos(phi);
      } else if (z <= 10) {
        // 2p Dumbbell Lobes
        const axis = Math.floor(Math.random() * 3);
        const angle = Math.random() * Math.PI * 2;
        if (axis === 0) {
          x = (Math.random() > 0.5 ? 1 : -1) * (4.0 + Math.random() * 10.0);
          y = Math.sin(angle) * 3.5;
          zPos = Math.cos(angle) * 3.5;
        } else if (axis === 1) {
          y = (Math.random() > 0.5 ? 1 : -1) * (4.0 + Math.random() * 10.0);
          x = Math.sin(angle) * 3.5;
          zPos = Math.cos(angle) * 3.5;
        } else {
          zPos = (Math.random() > 0.5 ? 1 : -1) * (4.0 + Math.random() * 10.0);
          x = Math.sin(angle) * 3.5;
          y = Math.cos(angle) * 3.5;
        }
      } else {
        // 3d Cloverleaf Lobes
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const r = Math.sin(2 * theta) * 15.0 + (Math.random() - 0.5) * 3.0;
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.sin(phi) * Math.sin(theta);
        zPos = r * Math.cos(phi);
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = zPos;

      const c = baseColor.clone().lerp(new THREE.Color(0x00FFFF), Math.random() * 0.4);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    orbitalParticleSystem = new THREE.Points(geometry, material);
    moleculeGroup.add(orbitalParticleSystem);

    updateTelemetry(
      `${el.s} · ORBITAL MOTIF · ${tr('referenceModel')}`,
      `Nvisual=${count}`,
      `CONFIG: ${el.sh}`,
      `|ψ|²: N/D`,
      tr('referenceModel')
    );
  }

  const materialCache = {};
  function getMaterialForElement(elData, overrideCol) {
    const col = overrideCol !== undefined ? overrideCol : elData.col;
    const cat = elData.cat ? elData.cat.toLowerCase() : '';
    const key = `${elData.z}_${col}_${cat}`;
    
    if (materialCache[key]) return materialCache[key];

    // High-Vibrancy Cyberpunk Glassmorphic PBR
    let metalness = 0.2;
    let roughness = 0.08;
    let clearcoat = 1.0;
    let clearcoatRoughness = 0.02;

    if (cat.includes('alkali') || cat.includes('transition') || cat.includes('lanthanide') || cat.includes('actinide')) {
      metalness = 0.45;
      roughness = 0.06;
      clearcoat = 1.0;
      clearcoatRoughness = 0.01;
    } else if (cat.includes('noble')) {
      metalness = 0.15;
      roughness = 0.02;
      clearcoat = 1.0;
      clearcoatRoughness = 0.01;
    } else if (cat.includes('metalloid')) {
      metalness = 0.35;
      roughness = 0.08;
      clearcoat = 1.0;
      clearcoatRoughness = 0.02;
    } else if (cat.includes('halogen') || cat.includes('nonmetal')) {
      metalness = 0.15;
      roughness = 0.10;
      clearcoat = 1.0;
      clearcoatRoughness = 0.03;
    }

    materialCache[key] = new THREE.MeshPhysicalMaterial({
      color: col,
      metalness,
      roughness,
      clearcoat,
      clearcoatRoughness
    });
    return materialCache[key];
  }

  // Create high-fidelity floating 3D text labels for elements
  function createTextSprite(text, colorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 26px "Orbitron", "Fira Code", monospace';
    ctx.fillStyle = colorStr || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3.8, 3.8, 1);
    return sprite;
  }

  function disposeLabelSprite(sprite) {
    if (!sprite) return;
    moleculeGroup.remove(sprite);
    if (sprite.material?.map) sprite.material.map.dispose();
    if (sprite.material) sprite.material.dispose();
  }

  function formatParticleCount(count) {
    return activeCollisionMode === 'fusion' || activeCollisionMode === 'fission'
      ? `A=${activePhysicalNucleonCount || count} · ${count} N`
      : tr('atoms', {count});
  }

  // Smoothly spawn atoms at positions with scale-up animation
  function spawnAtoms(atomList, explicitBondPairs = null) {
    // atomList: [{z, pos: Vector3, col: hex, scale: float, startPos: Vector3, isElectron: bool, noLabel: bool, parent, orbitR, ...}]
    atomList = (atomList || [])
      .filter(item => item && item.pos && typeof item.pos.clone === 'function')
      .map((item, sourceIndex) => ({...item, sourceIndex}));
    const generation = ++spawnGeneration;
    const isInitial = activeAtoms.length === 0;
    const spawnDelay = isInitial ? 0 : 300;

    // Clean up any existing quantum orbital particle cloud
    if (orbitalParticleSystem) {
      moleculeGroup.remove(orbitalParticleSystem);
      orbitalParticleSystem.geometry.dispose();
      orbitalParticleSystem.material.dispose();
      orbitalParticleSystem = null;
    }

    // Fade out existing atoms that aren't needed
    activeAtoms.forEach(a => { a.targetScale = 0.0; a.removing = true; });
    activeBonds.forEach(b => { b.removing = true; });

    const doSpawn = () => {
      if (generation !== spawnGeneration) return;
      // Remove old atoms and their labels
      activeAtoms.filter(a => a.removing).forEach(a => {
        disposeLabelSprite(a.labelSprite);
        a.labelSprite = null;
      });
      activeAtoms = activeAtoms.filter(a => !a.removing);
      activeBonds = activeBonds.filter(b => !b.removing);

      // Clear old instanced meshes and orbit lines
      activeInstancedMeshes.forEach(im => moleculeGroup.remove(im));
      activeInstancedMeshes = [];
      if (activeBondInstancedMesh) {
        moleculeGroup.remove(activeBondInstancedMesh);
        activeBondInstancedMesh = null;
      }
      activeOrbitLines.forEach(line => {
        moleculeGroup.remove(line);
        if (line.geometry) line.geometry.dispose();
        if (line.material) line.material.dispose();
      });
      activeOrbitLines = [];

      // Group new atoms by `z` and `col`
      const groups = {};
      atomList.forEach(item => {
        const elData = EL[item.z] || EL[1];
        const colorHex = item.col !== undefined ? item.col : elData.col;
        const key = `${item.z}_${colorHex}`;
        if (!groups[key]) {
          groups[key] = {
            z: item.z,
            col: colorHex,
            items: []
          };
        }
        groups[key].items.push(item);
      });

      // Find central-most atom item for dense lattices (> 15 atoms)
      const nonElectronAtoms = atomList.filter(a => !a.isElectron);
      const isDenseLattice = !isDnaMode && nonElectronAtoms.length > 15;
      let centralAtomItem = null;
      if (isDenseLattice) {
        let minD = Infinity;
        nonElectronAtoms.forEach(item => {
          if (item.pos) {
            const d = item.pos.lengthSq();
            if (d < minD) { minD = d; centralAtomItem = item; }
          }
        });
      }

      const dummy = new THREE.Object3D();

      // Create InstancedMesh for each group
      Object.keys(groups).forEach(key => {
        const grp = groups[key];
        const count = grp.items.length;
        const elData = EL[grp.z] || EL[1];
        const mat = getMaterialForElement(elData, grp.col);
        const instMesh = new THREE.InstancedMesh(sphereGeo, mat, count);
        instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instMesh.frustumCulled = false;
        moleculeGroup.add(instMesh);
        activeInstancedMeshes.push(instMesh);

        // Store group metadata for raycasting map
        instMesh.userData = { z: grp.z, col: grp.col, groupKey: key };

        grp.items.forEach((item, idx) => {
          const elData = EL[item.z] || EL[1];
          const scale = item.scale !== undefined ? item.scale : (1.2 + (elData.r || 1.0) * 0.4);
          const start = isInitial ? item.pos.clone() : (item.startPos ? item.startPos.clone() : new THREE.Vector3(
            (Math.random()-0.5) * 60,
            (Math.random()-0.5) * 40,
            (Math.random()-0.5) * 30
          ));
          const initScale = isInitial ? scale : 0.01;
          
          let labelSprite = null;
          // Show label if <= 15 atoms OR if this is the single central atom of a dense lattice
          const showLabel = !isDnaMode && !item.noLabel && (!isDenseLattice || item === centralAtomItem);
          if (showLabel) {
            const spriteColor = '#' + grp.col.toString(16).padStart(6, '0');
            labelSprite = createTextSprite(elData.s, spriteColor);
            labelSprite.position.copy(start);
            labelSprite.scale.setScalar(initScale * 3.8);
            moleculeGroup.add(labelSprite);
          }

          dummy.position.copy(start);
          dummy.scale.setScalar(initScale);
          dummy.updateMatrix();
          instMesh.setMatrixAt(idx, dummy.matrix);

          activeAtoms.push({
            currentPos: start.clone(),
            targetPos: item.pos.clone(),
            currentScale: initScale,
            targetScale: scale,
            z: item.z,
            col: grp.col,
            elData,
            isElectron: item.isElectron || false,
            nucleonType: item.nucleonType || null,
            noLabel: item.noLabel || false,
            noBond: item.noBond || false,
            sourceIndex: item.sourceIndex,
            nuclearCenter: item.nuclearCenter ? item.nuclearCenter.clone() : null,
            nuclearLocal: item.nuclearLocal ? item.nuclearLocal.clone() : null,
            labelSprite,
            instancedMesh: instMesh,
            instIdx: idx,
            velocity: item.velocity ? item.velocity.clone() : null,
            basePos: item.basePos ? item.basePos.clone() : item.pos.clone(),
            parent: item.parent || null,
            orbitR: item.orbitR || 0,
            orbitAngle: item.orbitAngle || 0,
            orbitSpeed: item.orbitSpeed || 0,
            tiltX: item.tiltX || 0,
            tiltY: item.tiltY || 0,
            removing: false
          });
        });
      });

      // Add orbit ring lines for noble gas shells
      atomList.forEach(item => {
        const elData = EL[item.z] || EL[1];
        const symbol = elData.s;
        if (symbol === 'He' || symbol === 'Ne' || symbol === 'Ar' || symbol === 'Kr' || symbol === 'Xe' || symbol === 'Rn') {
          if (!item.isElectron) {
            const electrons = Math.min(item.z, 20);
            const numShells = Math.ceil(electrons / 8);
            for (let s = 0; s < numShells; s++) {
              const shellR = 6.0 + s * 4.0;
              const points = [];
              const segments = 64;
              for (let j = 0; j <= segments; j++) {
                const theta = (j / segments) * Math.PI * 2;
                points.push(new THREE.Vector3(Math.cos(theta) * shellR, 0, Math.sin(theta) * shellR));
              }
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const material = new THREE.LineBasicMaterial({
                color: 0x00FFFF,
                transparent: true,
                opacity: 0.18,
                depthWrite: false
              });
              const line = new THREE.LineLoop(geometry, material);
              
              line.rotation.x = (Math.random() - 0.5) * 0.8;
              line.rotation.y = (Math.random() - 0.5) * 0.8;
              line.userData = { nucleusPos: item.pos, tiltX: line.rotation.x, tiltY: line.rotation.y };
              
              moleculeGroup.add(line);
              activeOrbitLines.push(line);
            }
          }
        }
      });

      if (!isDnaMode) {
        const newBonds = [];
        if (Array.isArray(explicitBondPairs)) {
          const sourceToActive = new Map(activeAtoms.map((atom, index) => [atom.sourceIndex, index]));
          explicitBondPairs.forEach(pair => {
            const a = sourceToActive.get(pair.a);
            const b = sourceToActive.get(pair.b);
            if (Number.isInteger(a) && Number.isInteger(b) && a !== b) newBonds.push({a,b,order:pair.order || 1});
          });
        } else for (let i = 0; i < activeAtoms.length; i++) {
          for (let j = i + 1; j < activeAtoms.length; j++) {
            if (activeAtoms[i].isElectron || activeAtoms[j].isElectron || activeAtoms[i].noBond || activeAtoms[j].noBond) continue;
            const start = activeAtoms[i].targetPos;
            const end = activeAtoms[j].targetPos;
            const dist = start.distanceTo(end);
            const r1 = activeAtoms[i].elData.r || 1.0;
            const r2 = activeAtoms[j].elData.r || 1.0;
            let maxBondDist = activeBondCutoffWorld || Math.max(9.5, (r1 + r2) * 3.5);
            
            const sym1 = activeAtoms[i].elData.s;
            const sym2 = activeAtoms[j].elData.s;
            if (sym1 === sym2 && !activeBondCutoffWorld) {
              if (sym1 === 'Po') maxBondDist = 12.0;
              else if (['Li', 'Na', 'K', 'V', 'Cr', 'Fe', 'Rb', 'Nb', 'Mo', 'Cs', 'Ba', 'Ta', 'W', 'Eu'].includes(sym1)) maxBondDist = 13.0;
              else if (['Si', 'Ge', 'Sn'].includes(sym1)) maxBondDist = 11.0;
              else if (['As', 'Sb', 'Bi'].includes(sym1)) maxBondDist = 8.5;
              else if (['Se', 'Te'].includes(sym1)) maxBondDist = 7.0;
              else if (sym1 === 'I') maxBondDist = 4.5;
              else if (['Hg', 'Ga', 'Cs', 'Rb', 'Fr', 'Br'].includes(sym1)) maxBondDist = 7.5;
            }
            
            if (dist > 0.1 && dist < maxBondDist) {
              newBonds.push({ a: i, b: j });
            }
          }
        }
        spawnBonds(newBonds);
      }

      if (atomCountEl) atomCountEl.textContent = formatParticleCount(activeAtoms.length);
    };

    if (spawnDelay === 0) {
      doSpawn();
    } else {
      setTimeout(doSpawn, spawnDelay);
    }
  }

  // Spawn chemical bonds using a single InstancedMesh
  function spawnBonds(bondPairs) {
    let totalCylinders = 0;
    bondPairs.forEach(bp => {
      let order = bp.order || 1;
      if (!bp.order && !isDnaMode && activeAtoms[bp.a] && activeAtoms[bp.b]) {
        const zA = activeAtoms[bp.a].z;
        const zB = activeAtoms[bp.b].z;
        const symA = EL[zA].s;
        const symB = EL[zB].s;
        if ((symA === 'O' && symB === 'O') || (symA === 'C' && symB === 'O') || (symA === 'O' && symB === 'C')) {
          order = 2;
        } else if (symA === 'N' && symB === 'N') {
          order = 3;
        }
      }
      totalCylinders += order;
    });

    if (totalCylinders === 0) return;

    const bondInstMesh = new THREE.InstancedMesh(cylinderGeo, bondMat, totalCylinders);
    bondInstMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    bondInstMesh.frustumCulled = false;
    moleculeGroup.add(bondInstMesh);
    activeBondInstancedMesh = bondInstMesh;

    let instIdx = 0;
    bondPairs.forEach(bp => {
      let order = bp.order || 1;
      if (!bp.order && !isDnaMode && activeAtoms[bp.a] && activeAtoms[bp.b]) {
        const zA = activeAtoms[bp.a].z;
        const zB = activeAtoms[bp.b].z;
        const symA = EL[zA].s;
        const symB = EL[zB].s;
        if ((symA === 'O' && symB === 'O') || (symA === 'C' && symB === 'O') || (symA === 'O' && symB === 'C')) {
          order = 2;
        } else if (symA === 'N' && symB === 'N') {
          order = 3;
        }
      }
      activeBonds.push({
        aIdx: bp.a,
        bIdx: bp.b,
        order,
        startIdx: instIdx,
        removing: false
      });
      instIdx += order;
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // BUILD DEFAULT SCHEMATIC B-DNA HELIX (visual teaching model, not a sequence reconstruction)
  // ═══════════════════════════════════════════════════════════════
  function buildDNA() {
    clearMaterialSelection();
    isDnaMode = true;
    activeCollisionMode = 'chemical';
    activeStructureId = 'dna';
    activeThermalProfile = null;
    angstromPerWorldUnit = 1;
    measurementScaleVerified = false;
    setThermalControlEnabled(false);
    activeBondCutoffWorld = null;
    const atoms = [];
    const BP = 130; // High density
    const HR = 15.0; // Helix Radius
    const MG = 0.38 * Math.PI; // Major Groove
    const T = 4.2; // Turns

    const BACKBONE1_COLORS = [0xFFD700, 0x8A2BE2, 0xFF5500, 0xFF0055, 0x00FF9D, 0x00D4FF];
    const BACKBONE2_COLORS = [0x00D4FF, 0x00FF9D, 0xFF5500, 0x8A2BE2, 0xFFD700, 0xFF0055];

    // Biological nucleobase pairing (A-T = 2 H-bonds, G-C = 3 H-bonds)
    const BASE_PAIRS = [
      { col1: 0x00FF9D, col2: 0xFF0055 }, // Adenine (Green) - Thymine (Red)
      { col1: 0xFFD700, col2: 0x00F0FF }, // Guanine (Yellow) - Cytosine (Cyan)
      { col1: 0xFF0055, col2: 0x00FF9D }, // Thymine (Red) - Adenine (Green)
      { col1: 0x00F0FF, col2: 0xFFD700 }  // Cytosine (Cyan) - Guanine (Yellow)
    ];

    for (let i = 0; i < BP; i++) {
      const p = i / BP;
      const x = (p - 0.5) * 115;
      const a1 = p * T * Math.PI * 2;
      const a2 = a1 + Math.PI + MG;

      const y1 = Math.sin(a1) * HR, z1 = Math.cos(a1) * HR;
      const y2 = Math.sin(a2) * HR, z2 = Math.cos(a2) * HR;

      // Backbone 1 sphere (Phosphorus-sugar group)
      atoms.push({
        z: 15,
        pos: new THREE.Vector3(x, y1, z1),
        col: BACKBONE1_COLORS[i % BACKBONE1_COLORS.length],
        scale: 2.3
      });

      // Backbone 2 sphere
      atoms.push({
        z: 15,
        pos: new THREE.Vector3(x, y2, z2),
        col: BACKBONE2_COLORS[i % BACKBONE2_COLORS.length],
        scale: 2.3
      });

      // Base pair rungs (Biological A-T and G-C pairs)
      if (i % 2 === 0) {
        const pair = BASE_PAIRS[(i / 2) % BASE_PAIRS.length];
        for (let r = 1; r <= 6; r++) {
          const rp = r / 7;
          const ry = THREE.MathUtils.lerp(y1, y2, rp);
          const rz = THREE.MathUtils.lerp(z1, z2, rp);
          const rungColor = rp <= 0.5 ? pair.col1 : pair.col2;
          atoms.push({
            z: 6,
            pos: new THREE.Vector3(x, ry, rz),
            col: rungColor,
            scale: 1.1
          });
        }
      }
    }

    spawnAtoms(atoms);
    updateTelemetry(
      'B-DNA · SCHEMATIC HELIX',
      'A··T / G···C · REPEATING VISUAL MOTIF',
      `B-DNA TEACHING SCHEMA · ${tr('referenceModel')}`,
      'BASE-PAIR MOTIF · SCALE NOT CALIBRATED',
      `${tr('schematicDnaNote')} · NO PREDICTIVE THERMAL PROFILE`
    );
  }

  // Shared material activation preserves one rendering path for all structures.
  function activateMaterial(id, atoms, profile, telemetry, scale, bondCutoff, explicitBonds = null) {
    isDnaMode = false;
    activeCollisionMode = 'chemical';
    activeStructureId = id;
    activeThermalProfile = profile;
    angstromPerWorldUnit = scale;
    measurementScaleVerified = Number.isFinite(scale) && scale > 0;
    setThermalControlEnabled(true);
    activeBondCutoffWorld = bondCutoff || null;
    selectedMeasureAtoms = [];
    spawnAtoms(atoms, explicitBonds);
    const reportedEnthalpy = telemetry.enthalpy == null || typeof telemetry.enthalpy === 'number' ? tr('dataUnavailable') : telemetry.enthalpy;
    const reportedDipole = telemetry.dipole == null || typeof telemetry.dipole === 'number' || /\b\d+(?:\.\d+)?\s*D\b/.test(String(telemetry.dipole || ''))
      ? tr('dataUnavailable') : telemetry.dipole;
    const reportedStability = telemetry.stability == null || typeof telemetry.stability === 'number' ? tr('dataUnavailable') : telemetry.stability;
    updateTelemetry(
      telemetry.name,
      telemetry.formula,
      `${telemetry.cls} · ${tr('referenceModel')}`,
      telemetry.bonds,
      `T/P PROFILE · ${activeThermalProfile.pressure || '1 atm'}`,
      reportedEnthalpy,
      reportedDipole,
      reportedStability,
      `${telemetry.note} · GEOMETRY: CALIBRATED · DYNAMICS: ILLUSTRATION ≠ ab initio`
    );
  }

  function buildNaclCrystal() {
    const atoms = [];
    const spacing = 4.0;
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 6; y++) {
        for (let z = 0; z < 6; z++) {
          atoms.push({
            z: ((x + y + z) & 1) === 0 ? 11 : 17,
            pos: new THREE.Vector3((x - 2.5) * spacing, (y - 2.5) * spacing, (z - 2.5) * spacing),
            scale: 1.25,
            noLabel: true
          });
        }
      }
    }
    activateMaterial('nacl', atoms,
      { label:'NaCl', melt:1074, boil:1738, pressure:'1 atm', model:'educational' },
      { name:'NaCl · ROCK-SALT', formula:'Na⁺Cl⁻', cls:'FCC/FCC · CN=6', bonds:'Na–Cl · CN=6', enthalpy:-411, dipole:0, stability:98, note:'d(Na–Cl)≈2.82 Å @ 298 K' },
      2.82 / spacing, spacing * 1.08);
  }

  function buildDiamondLattice() {
    const atoms = [];
    const a = 8.0;
    const basis = [
      [0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0],
      [.25,.25,.25],[.25,.75,.75],[.75,.25,.75],[.75,.75,.25]
    ];
    for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) for (let iz = -1; iz <= 1; iz++) {
      basis.forEach(([x,y,z]) => atoms.push({
        z:6, pos:new THREE.Vector3((ix+x-.5)*a,(iy+y-.5)*a,(iz+z-.5)*a),
        scale:1.15, noLabel:true
      }));
    }
    const nn = a * Math.sqrt(3) / 4;
    activateMaterial('diamond', atoms,
      { label:'Diamond', melt:null, boil:3915, transition:'sublimation', pressure:'1 atm', model:'educational' },
      { name:'C · DIAMOND', formula:'Cₙ', cls:'sp³ · T_d', bonds:'C–C · 109.47°', enthalpy:1.9, dipole:0, stability:99, note:'SUBLIMATION≈3915 K @ 1 atm' },
      1.544 / nn, nn * 1.08);
  }

  function icosahedronVertices() {
    const p = (1 + Math.sqrt(5)) / 2;
    return [
      [0,-1,-p],[0,-1,p],[0,1,-p],[0,1,p],
      [-1,-p,0],[-1,p,0],[1,-p,0],[1,p,0],
      [-p,0,-1],[p,0,-1],[-p,0,1],[p,0,1]
    ].map(v => new THREE.Vector3(v[0],v[1],v[2]));
  }

  function buildFullereneC60() {
    const vertices = icosahedronVertices();
    let edge = Infinity;
    for (let i=0;i<vertices.length;i++) for (let j=i+1;j<vertices.length;j++) {
      const d=vertices[i].distanceTo(vertices[j]); if (d>0.01 && d<edge) edge=d;
    }
    const atoms=[];
    for (let i=0;i<vertices.length;i++) for (let j=0;j<vertices.length;j++) {
      if (i !== j && Math.abs(vertices[i].distanceTo(vertices[j])-edge)<0.01) {
        atoms.push({z:6,pos:vertices[i].clone().multiplyScalar(2).add(vertices[j]).multiplyScalar(3.15),scale:1.05,noLabel:true});
      }
    }
    const nn = atoms[0].pos.distanceTo(atoms.find((a,idx)=>idx>0 && atoms[0].pos.distanceTo(a.pos)>0.1 && atoms[0].pos.distanceTo(a.pos)<8).pos);
    activateMaterial('c60', atoms,
      { label:'C₆₀', melt:null, boil:800, transition:'sublimation', pressure:'vacuum/1 atm', model:'educational' },
      { name:'C₆₀', formula:'C₆₀', cls:'I_h · V=60 · E=90 · deg=3', bonds:'sp² C–C · E=90', enthalpy:null, dipole:0, stability:96, note:'TRUNCATED ICOSAHEDRON' },
      1.43 / nn, nn * 1.13);
  }

  function buildGrapheneSheet() {
    const atoms=[]; const bonds=[]; const bond=3.4; const index=new Map();
    const add=(site,row,col,pos)=>{const id=atoms.length;atoms.push({z:6,pos,scale:1.0,noLabel:true});index.set(`${site}:${row}:${col}`,id);};
    for(let row=-5;row<=5;row++) for(let col=-5;col<=5;col++) {
      const x=Math.sqrt(3)*bond*(col+row/2), y=1.5*bond*row;
      if (row > -5 && !(row === 5 && col === 5)) add('A',row,col,new THREE.Vector3(x,y,0));
      if (row < 5 && !(row === -5 && col === -5)) add('B',row,col,new THREE.Vector3(x,y+bond,0));
    }
    for(let row=-5;row<=5;row++) for(let col=-5;col<=5;col++) {
      const a=index.get(`A:${row}:${col}`);
      if (!Number.isInteger(a)) continue;
      [`B:${row}:${col}`,`B:${row-1}:${col}`,`B:${row-1}:${col+1}`].forEach(key=>{
        const b=index.get(key); if(Number.isInteger(b)) bonds.push({a,b});
      });
    }
    activateMaterial('graphene', atoms,
      { label:'Graphene', melt:null, boil:4510, transition:'sublimation', pressure:'1 atm', model:'educational' },
      { name:'Cₙ · GRAPHENE', formula:'Cₙ', cls:'2D · HEX · sp²', bonds:'C–C · 120°', enthalpy:0, dipole:0, stability:99, note:'FINITE · OPEN BOUNDARY' },
      1.42/bond, bond*1.12, bonds);
  }

  function buildCarbonNanotube() {
    const atoms=[]; const bonds=[]; const index=new Map();
    const n=12, rows=16, bond=3.4;
    const circumference=n*Math.sqrt(3)*bond;
    const radius=circumference/(2*Math.PI);
    const add=(site,row,col,x,y)=>{
      const angle=x/radius;
      const id=atoms.length;
      atoms.push({z:6,pos:new THREE.Vector3(Math.cos(angle)*radius,y,Math.sin(angle)*radius),scale:1.0,noLabel:true});
      index.set(`${site}:${row}:${col}`,id);
    };
    for(let row=0;row<=rows;row++) for(let col=0;col<n;col++) {
      const x=Math.sqrt(3)*bond*(col+row/2);
      const y=1.5*bond*(row-rows/2);
      if(row>0) add('A',row,col,x,y);
      if(row<rows) add('B',row,col,x,y+bond);
    }
    for(let row=1;row<=rows;row++) for(let col=0;col<n;col++) {
      const a=index.get(`A:${row}:${col}`);
      [`B:${row}:${col}`,`B:${row-1}:${col}`,`B:${row-1}:${(col+1)%n}`].forEach(key=>{
        const b=index.get(key); if(Number.isInteger(b)) bonds.push({a,b});
      });
    }
    activateMaterial('nanotube', atoms,
      { label:'SWCNT (12,0)', melt:null, boil:4510, transition:'sublimation', pressure:'1 atm', model:'educational' },
      { name:'Cₙ · SWCNT (12,0)', formula:'Cₙ · SWCNT (12,0)', cls:'sp² · (12,0)', bonds:'C–C · deg=2/3', enthalpy:null, dipole:0, stability:97, note:'FINITE · OPEN ENDS' },
      1.42/bond, bond*1.13, bonds);
  }

  function buildSolvationShell() {
    const atoms=[{z:11,pos:new THREE.Vector3(0,0,0),scale:1.5,noBond:true}];
    const bonds=[];
    const count=12, r=10, golden=Math.PI*(3-Math.sqrt(5));
    for(let i=0;i<count;i++) {
      const y=1-(i/(count-1))*2, rr=Math.sqrt(1-y*y), theta=golden*i;
      const dir=new THREE.Vector3(Math.cos(theta)*rr,y,Math.sin(theta)*rr);
      const oxygen=dir.clone().multiplyScalar(r);
      const oxygenIndex=atoms.length;
      atoms.push({z:8,pos:oxygen,scale:1.1,noLabel:true});
      let tangent=new THREE.Vector3(-dir.z,0,dir.x);
      if(tangent.lengthSq()<1e-6)tangent=new THREE.Vector3(1,0,0); else tangent.normalize();
      const bisector=dir.clone();
      const halfAngle=52.25*Math.PI/180, ohWorld=4.0;
      const h1=oxygen.clone().add(bisector.clone().multiplyScalar(Math.cos(halfAngle)*ohWorld)).add(tangent.clone().multiplyScalar(Math.sin(halfAngle)*ohWorld));
      const h2=oxygen.clone().add(bisector.clone().multiplyScalar(Math.cos(halfAngle)*ohWorld)).add(tangent.clone().multiplyScalar(-Math.sin(halfAngle)*ohWorld));
      const h1Index=atoms.length; atoms.push({z:1,pos:h1,scale:.72,noLabel:true});
      const h2Index=atoms.length; atoms.push({z:1,pos:h2,scale:.72,noLabel:true});
      bonds.push({a:oxygenIndex,b:h1Index},{a:oxygenIndex,b:h2Index});
    }
    activateMaterial('solvation', atoms,
      { label:'Na⁺(aq)', melt:273.15, boil:373.15, pressure:'1 atm', model:'illustrative', applicablePhase:'liquid' },
      { name:'Na⁺ · SOLVATION', formula:'[Na(H₂O)₁₂]⁺', cls:'ION–DIPOLE', bonds:'Na⁺···O · 12×H₂O · ∠HOH=104.5°', enthalpy:null, dipole:'H₂O 1.85 D', stability:'ILLUSTRATION', note:'N(H₂O)=12 · MODEL ≠ FIXED COORDINATION' },
      0.958/4.0, 4.2, bonds);
  }

  function formElement(z, fromCenter) {
    clearMaterialSelection();
    isDnaMode = false;
    activeCollisionMode = 'chemical';
    const el = EL[z] || EL[1];
    activeStructureId = `element-${z}`;
    activeThermalProfile = {
      label: el.s,
      melt: Number.isFinite(Number(el.melt)) && Number(el.melt) > 0 ? Number(el.melt) : null,
      boil: Number.isFinite(Number(el.boil)) && Number(el.boil) > 0 ? Number(el.boil) : null,
      pressure: '1 atm',
      model: 'educational'
    };
    measurementScaleVerified = false;
    const hasPhaseData = window.NULLA_THERMODYNAMICS?.hasUsablePhaseProfile(activeThermalProfile) === true;
    setThermalControlEnabled(hasPhaseData);
    activeBondCutoffWorld = null;
    const atoms = getElementAtoms(z, new THREE.Vector3(0, 0, 0), fromCenter);
    
    spawnAtoms(atoms);
    
    const symbol = el.s;

    if (['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn'].includes(symbol) || (el.cat && el.cat.includes('noble'))) {
      generateAtomicOrbitalCloud(z);
    }
    updateTelemetry(
      `${el.s} · Z=${z}`,
      `m=${typeof el.m === 'number' ? el.m.toFixed(3) : el.m} u · χ=${Number.isFinite(el.electronegativity) ? el.electronegativity : tr('dataUnavailable')}`,
      `${tr('stateLabel')}: ${phaseAtTemperature(activeThermalProfile,temperatureK).label} · ρ=${Number.isFinite(el.density) ? el.density + ' g/cm³' : tr('dataUnavailable')}`,
      `Tm=${Number.isFinite(el.melt) ? el.melt + ' K' : 'N/D'} · Tb=${Number.isFinite(el.boil) ? el.boil + ' K' : 'N/D'}`,
      `CONFIG: ${el.sh} · STRUCTURE: ` + (
        ['He','Ne','Ar','Kr','Xe','Rn'].includes(symbol) ? 'MONATOMIC' :
        symbol === 'B' ? 'B₁₂ · I_h' :
        ['Hg','Ga','Cs','Rb','Fr'].includes(symbol) ? 'DISORDERED PACKING ILLUSTRATION' :
        ['Br','I'].includes(symbol) ? `${symbol}₂` :
        ['Se','Te'].includes(symbol) ? 'HELICAL' :
        ['As','Sb','Bi'].includes(symbol) ? 'LAYERED' :
        symbol === 'Po' ? 'SC' : symbol === 'P' ? 'P₄ · T_d' : symbol === 'S' ? 'S₈' :
        symbol === 'C' ? 'GRAPHITE · HEX' : ['Si','Ge','Sn'].includes(symbol) ? 'DIAMOND · sp³' :
        ['Li','Na','K','V','Cr','Fe','Rb','Nb','Mo','Cs','Ba','Ta','W','Eu'].includes(symbol) ? 'BCC' :
        ['Be','Mg','Ti','Co','Zn','Y','Zr','Ru','Cd','Gd','Tb','Dy','Ho','Er','Tm','Lu','Hf','Re','Os','Tl'].includes(symbol) ? 'HCP' : 'FCC'
      )
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // FORM COMPOUND FROM REACTION
  // ═══════════════════════════════════════════════════════════════
  function getExplicitCompoundBonds(name, atomCount) {
    const star = (outerCount, order = 1) => Array.from({length:outerCount}, (_, index) => ({a:0,b:index+1,order}));
    if (['Water','Hydrogen Sulfide'].includes(name)) return star(2,1);
    if (name === 'Sulfur Dioxide') return star(2,2);
    if (['Carbon Dioxide','Carbon Disulfide'].includes(name)) return star(2,2);
    if (name === 'Hydrogen Cyanide') return [{a:0,b:1,order:1},{a:1,b:2,order:3}];
    if (name === 'Nitric Oxide') return [{a:0,b:1,order:2}];
    if (['Hydrogen Chloride','Hydrogen Fluoride','Hydrogen Bromide','Hydrogen Iodide'].includes(name)) return [{a:0,b:1,order:1}];
    if (name === 'Ammonia') return star(3,1);
    if (['Methane','Carbon Tetrachloride','Carbon Tetrafluoride','Titanium Tetrachloride'].includes(name)) return star(4,1);
    if (['Magnesium Chloride','Calcium Chloride','Zinc Chloride'].includes(name)) return star(2,1);
    if (['Aluminium Chloride','Iron Chloride'].includes(name)) return star(3,1);
    if (name === 'Silicon Dioxide') return star(2,1);
    if (name === 'Silicon Carbide') return [{a:0,b:1,order:1}];
    if (name === 'Octasulfur Ring' && atomCount === 8) return Array.from({length:8},(_,i)=>({a:i,b:(i+1)%8,order:1}));
    if (name === 'White Phosphorus' && atomCount === 4) {
      const bonds=[]; for(let i=0;i<4;i++) for(let j=i+1;j<4;j++) bonds.push({a:i,b:j,order:1}); return bonds;
    }
    if (name === 'Phosphorus(V) Oxide' && atomCount === 14) {
      const phosphorusPairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
      const bridgeBonds=phosphorusPairs.flatMap(([a,b],index) => [{a,b:4+index,order:1},{a:b,b:4+index,order:1}]);
      const terminalBonds=Array.from({length:4},(_,index) => ({a:index,b:10+index,order:2}));
      return [...bridgeBonds,...terminalBonds];
    }
    const diatomicOrder = {'Hydrogen Gas':1,'Oxygen Gas':2,'Nitrogen Gas':3,'Fluorine Gas':1,'Chlorine Gas':1,'Bromine Gas':1,'Iodine Molecule':1};
    if (diatomicOrder[name]) return [{a:0,b:1,order:diatomicOrder[name]}];
    return null;
  }

  function formCompound(reaction) {
    clearMaterialSelection();
    isDnaMode = false;
    const hasNaclReference = reaction.formula === 'NaCl';
    activeThermalProfile = hasNaclReference
      ? { label:'NaCl', melt:1074, boil:1738, pressure:'1 atm', model:'catalogued reference' }
      : { label:reaction.formula, melt:null, boil:null, pressure:reaction.pressure || '1 atm', model:'data unavailable' };
    measurementScaleVerified = false;
    setThermalControlEnabled(hasNaclReference);
    const atoms = [];
    const name = reaction.name;

    if (name === 'Water' || name === 'Hydrogen Sulfide' || name === 'Sulfur Dioxide') {
      const centralZ = reaction.atoms[0].z; 
      const outerZ = reaction.atoms[1].z;   
      atoms.push({ z: centralZ, pos: new THREE.Vector3(0, 2.0, 0), scale: 1.8 });
      atoms.push({ z: outerZ, pos: new THREE.Vector3(-4.8, -1.8, 0), scale: 1.4 });
      atoms.push({ z: outerZ, pos: new THREE.Vector3(4.8, -1.8, 0), scale: 1.4 });
    }
    else if (['Carbon Dioxide', 'Nitric Oxide', 'Hydrogen Chloride', 'Hydrogen Fluoride', 'Hydrogen Bromide', 'Carbon Disulfide', 'Hydrogen Cyanide'].includes(name)) {
      if (name === 'Hydrogen Cyanide') {
        atoms.push({ z: 1, pos: new THREE.Vector3(-5.0, 0, 0), scale: 1.3 }); // H
        atoms.push({ z: 6, pos: new THREE.Vector3(0, 0, 0), scale: 1.7 });    // C
        atoms.push({ z: 7, pos: new THREE.Vector3(4.5, 0, 0), scale: 1.7 });   // N
      } else if (reaction.atoms.length === 2 && reaction.atoms[0].c === 1 && reaction.atoms[1].c === 1) {
        atoms.push({ z: reaction.atoms[0].z, pos: new THREE.Vector3(-3.5, 0, 0), scale: 1.7 });
        atoms.push({ z: reaction.atoms[1].z, pos: new THREE.Vector3(3.5, 0, 0), scale: 1.7 });
      } else {
        const centralZ = reaction.atoms[0].z; 
        const outerZ = reaction.atoms[1].z;   
        atoms.push({ z: centralZ, pos: new THREE.Vector3(0, 0, 0), scale: 1.7 });
        atoms.push({ z: outerZ, pos: new THREE.Vector3(-6.0, 0, 0), scale: 1.6 });
        atoms.push({ z: outerZ, pos: new THREE.Vector3(6.0, 0, 0), scale: 1.6 });
      }
    }
    else if (name === 'Ammonia') {
      const centralZ = reaction.atoms[0].z; 
      const outerZ = reaction.atoms[1].z;   
      atoms.push({ z: centralZ, pos: new THREE.Vector3(0, 1.5, 0), scale: 1.7 });
      atoms.push({ z: outerZ, pos: new THREE.Vector3(0, -1.5, 5.0), scale: 1.3 });
      atoms.push({ z: outerZ, pos: new THREE.Vector3(-4.3, -1.5, -2.5), scale: 1.3 });
      atoms.push({ z: outerZ, pos: new THREE.Vector3(4.3, -1.5, -2.5), scale: 1.3 });
    }
    else if (['Methane', 'Carbon Tetrachloride', 'Carbon Tetrafluoride', 'Titanium Tetrachloride'].includes(name)) {
      const centralZ = reaction.atoms[0].z; 
      const outerZ = reaction.atoms[1].z;   
      atoms.push({ z: centralZ, pos: new THREE.Vector3(0, 0, 0), scale: 1.7 });
      const d = 4.8;
      const vertices = [
        new THREE.Vector3(d, d, d),
        new THREE.Vector3(-d, -d, d),
        new THREE.Vector3(-d, d, -d),
        new THREE.Vector3(d, -d, -d)
      ];
      vertices.forEach(v => atoms.push({ z: outerZ, pos: v, scale: 1.3 }));
    }
    else if (
      ['Sodium Chloride', 'Potassium Chloride', 'Sodium Fluoride', 'Calcium Oxide', 'Magnesium Oxide'].includes(name)
      || /rock[- ]salt|cubic fcc lattice/i.test(reaction.geom || '')
    ) {
      const zA = reaction.atoms[0].z;
      const zB = reaction.atoms[1].z;
      const d = 4.0;
      // 6³ finite rock-salt specimen: dense enough to expose the octahedral
      // coordination while remaining below the default 650-atom DNA budget.
      for (let ix = 0; ix < 6; ix++) {
        for (let iy = 0; iy < 6; iy++) {
          for (let iz = 0; iz < 6; iz++) {
            const isA = (ix + iy + iz) % 2 === 0;
            atoms.push({
              z: isA ? zA : zB,
              pos: new THREE.Vector3((ix - 2.5) * d, (iy - 2.5) * d, (iz - 2.5) * d),
              scale: isA ? 1.8 : 1.5
            });
          }
        }
      }
    }
    else if (name === 'Sodium Oxide' || name === 'Lithium Oxide' || name === 'Silver Oxide') {
      const zMetal = reaction.atoms[0].z; 
      const zO = reaction.atoms[1].z;     
      const d = 6.5;
      const oPos = [
        new THREE.Vector3(-d, -d, -d), new THREE.Vector3(d, d, -d),
        new THREE.Vector3(d, -d, d), new THREE.Vector3(-d, d, d)
      ];
      oPos.forEach(p => atoms.push({ z: zO, pos: p, scale: 1.8 }));
      const h = d * 0.5;
      for (let dx of [-h, h]) {
        for (let dy of [-h, h]) {
          for (let dz of [-h, h]) {
            atoms.push({ z: zMetal, pos: new THREE.Vector3(dx, dy, dz), scale: 1.3 });
          }
        }
      }
    }
    else if (name === 'Silicon Carbide' || name === 'Silicon Dioxide') {
      const zSi = 14;
      const zOther = name === 'Silicon Carbide' ? 6 : 8; 
      const d = 5.0;
      atoms.push({ z: zSi, pos: new THREE.Vector3(0, 0, 0), scale: 1.8 });
      if (name === 'Silicon Dioxide') {
        atoms.push({ z:zOther, pos:new THREE.Vector3(-d,0,0), scale:1.4 });
        atoms.push({ z:zOther, pos:new THREE.Vector3(d,0,0), scale:1.4 });
      } else {
        atoms.push({ z:zOther, pos:new THREE.Vector3(d,0,0), scale:1.4 });
      }
    }
    else if (name === 'Iron(III) Oxide' || name === 'Aluminium Oxide') {
      const zMetal = reaction.atoms[0].z; 
      const zO = reaction.atoms[1].z;     
      const r = 5.5;
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2;
        const h = (i % 2 === 0 ? 1.8 : -1.8);
        atoms.push({ z: zO, pos: new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), h), scale: 1.5 });
      }
      atoms.push({ z: zMetal, pos: new THREE.Vector3(0, 2.5, 4.0), scale: 1.7 });
      atoms.push({ z: zMetal, pos: new THREE.Vector3(0, -2.5, -4.0), scale: 1.7 });
      atoms.push({ z: zMetal, pos: new THREE.Vector3(-2.5, 0, 1.0), scale: 1.7 });
      atoms.push({ z: zMetal, pos: new THREE.Vector3(2.5, 0, -1.0), scale: 1.7 });
    }
    else if (name === 'Copper Oxide' || name === 'Lead Oxide') {
      const zMetal = reaction.atoms[0].z; 
      const zO = reaction.atoms[1].z;     
      const d = 5.5;
      for (let ix = 0; ix < 4; ix++) {
        for (let iy = 0; iy < 4; iy++) {
          const isMetal = (ix + iy) % 2 === 0;
          atoms.push({
            z: isMetal ? zMetal : zO,
            pos: new THREE.Vector3((ix - 1.5) * d, (iy - 1.5) * d, (isMetal ? 0.8 : -0.8)),
            scale: isMetal ? 1.7 : 1.5
          });
        }
      }
    }
    else if (name === 'Calcium Carbide') {
      const zCa = 20;
      const zC = 6;
      const d = 6.0;
      for (let dx of [-d, d]) {
        for (let dy of [-d, d]) {
          atoms.push({ z: zCa, pos: new THREE.Vector3(dx, dy, 0), scale: 1.8 });
        }
      }
      const cDumbbells = [
        new THREE.Vector3(0, -d, 0),
        new THREE.Vector3(d, 0, 0),
        new THREE.Vector3(0, d, 0),
        new THREE.Vector3(-d, 0, 0)
      ];
      cDumbbells.forEach(center => {
        atoms.push({ z: zC, pos: center.clone().add(new THREE.Vector3(0, 0, -1.5)), scale: 1.5 });
        atoms.push({ z: zC, pos: center.clone().add(new THREE.Vector3(0, 0, 1.5)), scale: 1.5 });
      });
    }
    else if (name === 'Phosphorus(V) Oxide') {
      const zP = 15;
      const zO = 8;
      const d = 6.0;
      const pVertices = [
        new THREE.Vector3(d, d, d),
        new THREE.Vector3(-d, -d, d),
        new THREE.Vector3(-d, d, -d),
        new THREE.Vector3(d, -d, -d)
      ];
      pVertices.forEach(v => atoms.push({ z: zP, pos: v, scale: 1.7 }));
      for (let i = 0; i < pVertices.length; i++) {
        for (let j = i + 1; j < pVertices.length; j++) {
          const mid = pVertices[i].clone().add(pVertices[j]).multiplyScalar(0.5);
          atoms.push({ z: zO, pos: mid, scale: 1.4 });
        }
      }
      pVertices.forEach(v => {
        const terminal = v.clone().normalize().multiplyScalar(v.length() + 3.0);
        atoms.push({ z: zO, pos: terminal, scale: 1.4 });
      });
    }
    else if (name === 'Aluminium Chloride' || name === 'Iron Chloride') {
      const zMetal = reaction.atoms[0].z; 
      const zCl = 17;
      atoms.push({ z: zMetal, pos: new THREE.Vector3(0, 0, 0), scale: 1.8 });
      const d = 5.8;
      const clPos = [0,1,2].map(i => {
        const angle = i * Math.PI * 2 / 3;
        return new THREE.Vector3(Math.cos(angle) * d, Math.sin(angle) * d, 0);
      });
      clPos.forEach(p => atoms.push({ z: zCl, pos: p, scale: 1.5 }));
    }
    else if (name === 'Magnesium Chloride' || name === 'Calcium Chloride') {
      const zMetal = reaction.atoms[0].z; 
      const zCl = 17;
      atoms.push({ z: zMetal, pos: new THREE.Vector3(0, 0, 0), scale: 1.8 });
      const d = 6.0;
      const clPos = [new THREE.Vector3(-d,0,0), new THREE.Vector3(d,0,0)];
      clPos.forEach(p => atoms.push({ z: zCl, pos: p, scale: 1.5 }));
    }
    else if (name === 'Copper Chloride') {
      const zCu = 29;
      const zCl = 17;
      const spacing = 6.0;
      for (let i = -1; i <= 1; i++) {
        const x = i * spacing;
        atoms.push({ z: zCu, pos: new THREE.Vector3(x, 0, 0), scale: 1.7 });
        atoms.push({ z: zCl, pos: new THREE.Vector3(x + spacing*0.5, 3.5, 1.5), scale: 1.5 });
        atoms.push({ z: zCl, pos: new THREE.Vector3(x + spacing*0.5, -3.5, -1.5), scale: 1.5 });
      }
    }
    else if (name === 'Zinc Chloride') {
      const zZn = 30;
      const zCl = 17;
      const d = 5.0;
      atoms.push({ z: zZn, pos: new THREE.Vector3(0, 0, 0), scale: 1.8 });
      const clPos = [new THREE.Vector3(-d,0,0), new THREE.Vector3(d,0,0)];
      clPos.forEach(p => atoms.push({ z: zCl, pos: p, scale: 1.5 }));
    }
    else if (name === 'Zinc Oxide') {
      const zZn = 30;
      const zO = 8;
      const r = 5.8;
      const h = 4.0;
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2;
        const isZn = i % 2 === 0;
        atoms.push({ z: isZn ? zZn : zO, pos: new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), -h), scale: 1.6 });
      }
      atoms.push({ z: zZn, pos: new THREE.Vector3(0, 0, -h), scale: 1.7 });
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const isZn = i % 2 !== 0;
        atoms.push({ z: isZn ? zZn : zO, pos: new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), h), scale: 1.6 });
      }
      atoms.push({ z: zO, pos: new THREE.Vector3(0, 0, h), scale: 1.5 });
    }
    else if (name === 'Gold Oxide') {
      const zAu = 79;
      const zO = 8;
      const d = 5.2;
      atoms.push({ z:zAu, pos:new THREE.Vector3(-d,0,0), scale:1.8 });
      atoms.push({ z:zAu, pos:new THREE.Vector3(d,0,0), scale:1.8 });
      atoms.push({ z:zO, pos:new THREE.Vector3(0,d,0), scale:1.4 });
      atoms.push({ z:zO, pos:new THREE.Vector3(0,-d,0), scale:1.4 });
      atoms.push({ z:zO, pos:new THREE.Vector3(0,0,d), scale:1.4 });
    }
    else if (['Hydrogen Gas', 'Oxygen Gas', 'Nitrogen Gas', 'Fluorine Gas', 'Chlorine Gas', 'Bromine Gas', 'Iodine Molecule'].includes(name)) {
      const zGas = reaction.atoms[0].z;
      atoms.push({ z: zGas, pos: new THREE.Vector3(-2.8, 0, 0), scale: 1.6 });
      atoms.push({ z: zGas, pos: new THREE.Vector3(2.8, 0, 0), scale: 1.6 });
    }
    else if (name === 'Octasulfur Ring') {
      const r = 7.0;
      const h = 2.0;
      for (let i = 0; i < 8; i++) {
        const theta = (i / 8) * Math.PI * 2;
        const z_coord = (i % 2 === 0) ? h : -h;
        atoms.push({ z: 16, pos: new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), z_coord), scale: 1.6 });
      }
    }
    else if (name === 'White Phosphorus') {
      const d = 4.5;
      const vertices = [
        new THREE.Vector3(d, d, d),
        new THREE.Vector3(-d, -d, d),
        new THREE.Vector3(-d, d, -d),
        new THREE.Vector3(d, -d, -d)
      ];
      vertices.forEach(v => atoms.push({ z: 15, pos: v, scale: 1.7 }));
    }
    else if (name === 'Graphite') {
      const r = 5.5;
      // Sheet 1
      atoms.push({ z: 6, pos: new THREE.Vector3(0, 0, -3.5), scale: 1.7 });
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2;
        atoms.push({ z: 6, pos: new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), -3.5), scale: 1.6 });
      }
      // Sheet 2
      atoms.push({ z: 6, pos: new THREE.Vector3(0, 0, 3.5), scale: 1.7 });
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2 + Math.PI / 6;
        atoms.push({ z: 6, pos: new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), 3.5), scale: 1.6 });
      }
    }
    else {
      let totalAtoms = 0;
      reaction.atoms.forEach(group => { totalAtoms += group.c; });
      let idx = 0;
      reaction.atoms.forEach(group => {
        for (let a = 0; a < group.c; a++) {
          const gridSize = Math.ceil(Math.cbrt(totalAtoms * 3));
          const ix = idx % gridSize, iy = Math.floor(idx / gridSize) % gridSize, iz = Math.floor(idx / (gridSize*gridSize));
          const d = 5.0;
          const pos = new THREE.Vector3((ix - gridSize/2) * d, (iy - gridSize/2) * d, (iz - gridSize/2) * d);
          atoms.push({ z: group.z, pos, scale: 1.6 });
          idx++;
        }
      });
    }

    let nearestDistance = Infinity;
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const distance = atoms[i].pos.distanceTo(atoms[j].pos);
        if (distance > 0.1 && distance < nearestDistance) nearestDistance = distance;
      }
    }
    activeBondCutoffWorld = Number.isFinite(nearestDistance) ? nearestDistance * 1.18 : null;
    if (hasNaclReference) {
      angstromPerWorldUnit = 2.82 / 4.0;
      measurementScaleVerified = true;
    }
    const explicitCompoundBonds = getExplicitCompoundBonds(name, atoms.length);
    spawnAtoms(atoms, explicitCompoundBonds);
    activeStructureId = `compound-${reaction.formula}`;
    const evidenceLabel = reaction.evidenceLevel === 'CATALOGUED'
      ? `${tr('cataloguedCompound')} · ${tr('referenceModel')}`
      : tr('referenceModel');
    const bondOrderCounts = (explicitCompoundBonds || []).reduce((counts,bond) => {
      const order = bond.order || 1;
      counts[order] = (counts[order] || 0) + 1;
      return counts;
    },{});
    const topologyLabel = explicitCompoundBonds
      ? `GRAPH V=${atoms.length} · E=${explicitCompoundBonds.length} · ${Object.entries(bondOrderCounts).map(([order,count]) => `BO${order}×${count}`).join(' · ')}`
      : `GRAPH V=${atoms.length} · rcut=${activeBondCutoffWorld?.toFixed(2) || 'N/D'} world`;
    updateTelemetry(
      `${reaction.formula} · ${evidenceLabel}`,
      `${tr('formulaLabel')}: ${reaction.formula} | ${reaction.atoms.map(g => EL[g.z].s + '×' + g.c).join(' + ')}`,
      `${reaction.evidenceLevel} · COMPOSITION MODEL`,
      topologyLabel,
      hasNaclReference ? 'Tm=1074 K · Tb=1738 K · p≈1 atm' : 'T/P: N/D',
      reaction.enthalpy ? (reaction.enthalpy < 0 ? `${reaction.enthalpy} kJ/mol (EXOTHERMIC)` : `${reaction.enthalpy} kJ/mol (ENDOTHERMIC)`) : '—',
      reaction.dipole !== undefined ? `${reaction.dipole} Debye (${reaction.dipole > 0 ? 'POLAR' : 'NON-POLAR'})` : tr('dataUnavailable'),
      reaction.stabilityScore ? `${reaction.stabilityScore}%` : tr('dataUnavailable'),
      evidenceLabel
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // FORM INERT MIXTURE (Alloy / Non-reactive heterogeneous cluster)
  // ═══════════════════════════════════════════════════════════════
  function formInertMixture(zA, zB) {
    isDnaMode = false;
    activeCollisionMode = 'chemical';
    const atomicNumbers = (Array.isArray(zA) ? zA : [zA,zB]).filter(z => Number.isInteger(z) && EL[z]);
    if (atomicNumbers.length < 2) return;
    const combinedList = [];
    const radius = Math.max(14,atomicNumbers.length * 7);
    atomicNumbers.forEach((z,index) => {
      const angle = atomicNumbers.length === 2 ? index * Math.PI : index / atomicNumbers.length * Math.PI * 2;
      const offset = new THREE.Vector3(Math.cos(angle) * radius,Math.sin(angle) * radius * 0.42,(index % 2 ? 1 : -1) * 4);
      combinedList.push(...getElementAtoms(z,offset));
    });
    // A physical-mixture scene has no evaluated bond graph. Passing an
    // explicit empty graph prevents the generic distance heuristic from
    // drawing or reporting bonds that this model does not scientifically claim.
    spawnAtoms(combinedList, []);
    const symbols = atomicNumbers.map(z => EL[z].s);
    activeStructureId = `mixture-${symbols.join('-')}`;
    activeThermalProfile = null;
    measurementScaleVerified = false;
    setThermalControlEnabled(false);
    updateTelemetry(
      `${tr('mixtureTitle')} · ${symbols.join(' + ')}`,
      `${symbols.join(' // ')} · ${tr('mixtureNoFormula')}`,
      `MIXTURE MODEL · ${tr('mixtureCoexist')}`,
      tr('mixtureNoBonds'),
      `ILLUSTRATION · ${tr('mixtureDisclaimer')}`
    );
    window.dispatchEvent(new CustomEvent('nulla:mixture',{detail:{symbols}}));
  }

  function attemptPhysicalMixture() {
    if (selectedReactants.length < 2) {
      updateTelemetry(tr('mixtureTitle'),selectedReactants.length ? `${selectedReactants[0].sym} + ?` : tr('selectFusion'),tr('selectTwoSpecies'),tr('mixtureNoFormula'),tr('waiting'));
      return;
    }
    playTone(520,'sine',0.16);
    formInertMixture(selectedReactants.map(item => item.z));
  }

  // ═══════════════════════════════════════════════════════════════
  // COLLISION FUSION ENGINE & EXPLOSION SHADERS
  // ═══════════════════════════════════════════════════════════════
  function getElementAtoms(z, offset, fromCenter) {
    const el = EL[z] || EL[1];
    const atoms = [];
    const symbol = el.s;
    const startPos = fromCenter ? new THREE.Vector3(0, 0, 0) : null;

    function makeRepeatedLattice(z, basis, cellSize, scale, nx=2, ny=2, nz=2) {
      const latticeAtoms = [];
      const seen = new Set();
      const cx = (nx - 1) * cellSize * 0.5;
      const cy = (ny - 1) * cellSize * 0.5;
      const cz = (nz - 1) * cellSize * 0.5;
      for (let ix = 0; ix <= nx; ix++) {
        for (let iy = 0; iy <= ny; iy++) {
          for (let iz = 0; iz <= nz; iz++) {
            basis.forEach(b => {
              if (ix + b.x > nx || iy + b.y > ny || iz + b.z > nz) return;
              const px = (ix + b.x) * cellSize - cx;
              const py = (iy + b.y) * cellSize - cy;
              const pz = (iz + b.z) * cellSize - cz;
              const key = `${Math.round(px*100)},${Math.round(py*100)},${Math.round(pz*100)}`;
              if (!seen.has(key)) {
                seen.add(key);
                latticeAtoms.push({
                  z,
                  pos: offset.clone().add(new THREE.Vector3(px, py, pz)),
                  startPos: startPos,
                  scale: scale
                });
              }
            });
          }
        }
      }
      return latticeAtoms;
    }

    function getHcpAtoms(z, a, c, nx=2, ny=2, nz=2) {
      const hcpAtoms = [];
      const seen = new Set();
      const cx = (nx - 0.5) * a * 0.5;
      const cy = (ny - 0.5) * a * Math.sqrt(3) * 0.25;
      const cz = (nz - 0.5) * c * 0.5;
      const basis = [
        { x: 0, y: 0, z: 0 },
        { x: 2/3, y: 1/3, z: 0.5 }
      ];
      for (let ix = 0; ix <= nx; ix++) {
        for (let iy = 0; iy <= ny; iy++) {
          for (let iz = 0; iz <= nz; iz++) {
            basis.forEach(b => {
              if (ix + b.x > nx || iy + b.y > ny || iz + b.z > nz) return;
              const ux = ix + b.x;
              const uy = iy + b.y;
              const uz = iz + b.z;
              const px = (ux + uy * 0.5) * a - cx;
              const py = (uy * Math.sqrt(3) * 0.5) * a - cy;
              const pz = uz * c - cz;
              const key = `${Math.round(px*100)},${Math.round(py*100)},${Math.round(pz*100)}`;
              if (!seen.has(key)) {
                seen.add(key);
                hcpAtoms.push({
                  z,
                  pos: offset.clone().add(new THREE.Vector3(px, py, pz)),
                  startPos: startPos,
                  scale: 1.5
                });
              }
            });
          }
        }
      }
      return hcpAtoms;
    }

    if (symbol === 'He' || symbol === 'Ne' || symbol === 'Ar' || symbol === 'Kr' || symbol === 'Xe' || symbol === 'Rn') {
      // 1. MONATOMIC NOBLE GAS
      const nucleus = { z, pos: offset.clone(), startPos: startPos, scale: 2.2 };
      atoms.push(nucleus);
      
      const electrons = Math.min(z, 20);
      for (let e = 0; e < electrons; e++) {
        const shell = Math.floor(e / 8);
        const shellR = 6.0 + shell * 4.0;
        const angle = (e / Math.max(1, Math.min(8, electrons - shell*8))) * Math.PI * 2;
        const tiltX = (Math.random() - 0.5) * 0.8;
        const tiltY = (Math.random() - 0.5) * 0.8;
        const orbitSpeed = 1.5 + Math.random() * 1.5;
        atoms.push({
          z: 1,
          isElectron: true,
          noLabel: true,
          col: 0x00FFFF,
          scale: 0.35,
          parent: nucleus,
          orbitR: shellR,
          orbitAngle: angle,
          orbitSpeed: orbitSpeed,
          tiltX: tiltX,
          tiltY: tiltY
        });
      }
    }
    else if (symbol === 'B') {
      // 2. BORON B12 ICOSAHEDRON
      const phi = (1 + Math.sqrt(5)) / 2;
      const scaleFactor = 4.8;
      const baseVertices = [
        new THREE.Vector3(0, 1, phi),
        new THREE.Vector3(0, 1, -phi),
        new THREE.Vector3(0, -1, phi),
        new THREE.Vector3(0, -1, -phi),
        new THREE.Vector3(1, phi, 0),
        new THREE.Vector3(1, -phi, 0),
        new THREE.Vector3(-1, phi, 0),
        new THREE.Vector3(-1, -phi, 0),
        new THREE.Vector3(phi, 0, 1),
        new THREE.Vector3(phi, 0, -1),
        new THREE.Vector3(-phi, 0, 1),
        new THREE.Vector3(-phi, 0, -1)
      ];
      baseVertices.forEach(v => {
        atoms.push({ z, pos: offset.clone().add(v.multiplyScalar(scaleFactor)), startPos: startPos, scale: 1.6 });
      });
    }
    else if (['Hg', 'Ga', 'Cs', 'Rb', 'Fr'].includes(symbol)) {
      // 3. DISORDERED PACKING ILLUSTRATION; phase label remains temperature-dependent.
      const numLiquidAtoms = 12;
      for (let i = 0; i < numLiquidAtoms; i++) {
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        const r_val = 2.0 + Math.random() * 6.0;
        const pos = offset.clone().add(new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * r_val,
          Math.sin(phi) * Math.sin(theta) * r_val,
          Math.cos(phi) * r_val
        ));
        atoms.push({ z, pos: pos.clone(), basePos: pos.clone().sub(offset), startPos: startPos, scale: 1.6 });
      }
    }
    else if (symbol === 'Br') {
      // 4. DIATOMIC LIQUID DROPLET
      const numPairs = 6;
      for (let i = 0; i < numPairs; i++) {
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        const r_val = 2.0 + Math.random() * 6.0;
        const pairCenter = offset.clone().add(new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * r_val,
          Math.sin(phi) * Math.sin(theta) * r_val,
          Math.cos(phi) * r_val
        ));
        const bondPhi = Math.acos(2 * Math.random() - 1);
        const bondTheta = Math.random() * Math.PI * 2;
        const dir = new THREE.Vector3(
          Math.sin(bondPhi) * Math.cos(bondTheta),
          Math.sin(bondPhi) * Math.sin(bondTheta),
          Math.cos(bondPhi)
        ).multiplyScalar(3.2);
        
        const pos1 = pairCenter.clone().sub(dir);
        const pos2 = pairCenter.clone().add(dir);
        atoms.push({ z, pos: pos1, basePos: pos1.clone().sub(offset), startPos: startPos, scale: 1.6 });
        atoms.push({ z, pos: pos2, basePos: pos2.clone().sub(offset), startPos: startPos, scale: 1.6 });
      }
    }
    else if (symbol === 'H' || symbol === 'N' || symbol === 'O' || symbol === 'F' || symbol === 'Cl') {
      // 5. DIATOMIC GAS MOLECULES (inside a bouncing chamber, velocity initialized)
      const offsets = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-14, 10, -10),
        new THREE.Vector3(14, -10, 10)
      ];
      offsets.forEach((off, idx) => {
        const theta = idx * 1.5;
        const dir = new THREE.Vector3(Math.cos(theta), Math.sin(theta), Math.cos(theta*2)).normalize().multiplyScalar(3.2);
        const pos1 = offset.clone().add(off).sub(dir);
        const pos2 = offset.clone().add(off).add(dir);
        const vel = new THREE.Vector3((Math.random()-0.5)*15, (Math.random()-0.5)*15, (Math.random()-0.5)*15);
        atoms.push({ z, pos: pos1, startPos: startPos, scale: 1.6, velocity: vel.clone() });
        atoms.push({ z, pos: pos2, startPos: startPos, scale: 1.6, velocity: vel.clone() });
      });
    }
    else if (symbol === 'I') {
      // 6. SOLID DIATOMIC IODINE (I2 Molecular network)
      const spacing = 9.0;
      const bondDist = 2.8;
      const directions = [
        new THREE.Vector3(1, 0.5, 0.2).normalize(),
        new THREE.Vector3(-1, 0.5, -0.2).normalize(),
        new THREE.Vector3(0.2, 1, 0.5).normalize(),
        new THREE.Vector3(-0.2, -1, 0.5).normalize(),
        new THREE.Vector3(0.5, 0.2, 1).normalize(),
        new THREE.Vector3(0.5, -0.2, -1).normalize()
      ];
      const pairCenters = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(spacing, 0, spacing*0.5),
        new THREE.Vector3(-spacing, 0, -spacing*0.5),
        new THREE.Vector3(0, spacing, spacing*0.5),
        new THREE.Vector3(0, -spacing, -spacing*0.5),
        new THREE.Vector3(spacing*0.5, spacing*0.5, spacing)
      ];
      for (let i = 0; i < 6; i++) {
        const pCenter = pairCenters[i];
        const dir = directions[i].multiplyScalar(bondDist * 0.5);
        atoms.push({ z, pos: offset.clone().add(pCenter).sub(dir), startPos: startPos, scale: 1.6 });
        atoms.push({ z, pos: offset.clone().add(pCenter).add(dir), startPos: startPos, scale: 1.6 });
      }
    }
    else if (symbol === 'Se' || symbol === 'Te') {
      // 7. HELICAL CHAINS
      const radius = 5.0;
      const pitch = 1.8;
      const numAtoms = 12;
      for (let i = 0; i < numAtoms; i++) {
        const theta = (i - numAtoms/2) * 1.2;
        const pos = offset.clone().add(new THREE.Vector3(
          radius * Math.cos(theta),
          radius * Math.sin(theta),
          pitch * theta
        ));
        atoms.push({ z, pos, startPos: startPos, scale: 1.7 });
      }
    }
    else if (symbol === 'As' || symbol === 'Sb' || symbol === 'Bi') {
      // 8. PUCKERED LAYERS (chair conformation rings)
      const spacing = 5.5;
      const pucker = 1.5;
      const coords = [
        {x: 0, y: 0, z: pucker},
        {x: spacing, y: 0, z: -pucker},
        {x: spacing * 1.5, y: spacing * 0.86, z: pucker},
        {x: spacing, y: spacing * 1.73, z: -pucker},
        {x: 0, y: spacing * 1.73, z: pucker},
        {x: -spacing * 0.5, y: spacing * 0.86, z: -pucker},
        {x: spacing * 2, y: 0, z: pucker},
        {x: spacing * 2.5, y: spacing * 0.86, z: -pucker},
        {x: spacing * 2, y: spacing * 1.73, z: pucker},
        {x: spacing * 0.5, y: -spacing * 0.86, z: -pucker},
        {x: -spacing, y: 0, z: pucker},
        {x: -spacing * 1.5, y: spacing * 0.86, z: -pucker}
      ];
      const centerShift = new THREE.Vector3(spacing * 0.75, spacing * 0.43, 0);
      coords.forEach(c => {
        atoms.push({
          z,
          pos: offset.clone().add(new THREE.Vector3(c.x, c.y, c.z).sub(centerShift)),
          startPos: startPos,
          scale: 1.6
        });
      });
    }
    else if (symbol === 'Po') {
      // 9. SIMPLE CUBIC LATTICE (SC) - repeating
      const scBasis = [{x:0, y:0, z:0}];
      atoms.push(...makeRepeatedLattice(z, scBasis, 7.0, 1.7));
    }
    else if (symbol === 'P') {
      // 10. WHITE PHOSPHORUS (P4 Tetrahedron)
      const d = 4.5;
      const vertices = [
        new THREE.Vector3(d, d, d),
        new THREE.Vector3(-d, -d, d),
        new THREE.Vector3(-d, d, -d),
        new THREE.Vector3(d, -d, -d)
      ];
      vertices.forEach(v => atoms.push({ z, pos: offset.clone().add(v), startPos: startPos, scale: 1.7 }));
    }
    else if (symbol === 'S') {
      // 11. OCTASULFUR (S8 Crown Ring)
      const r = 7.0;
      const h = 2.0;
      for (let i = 0; i < 8; i++) {
        const theta = (i / 8) * Math.PI * 2;
        const z_coord = (i % 2 === 0) ? h : -h;
        atoms.push({
          z,
          pos: offset.clone().add(new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), z_coord)),
          startPos: startPos,
          scale: 1.6
        });
      }
    }
    else if (symbol === 'C') {
      // 12. GRAPHITE LAYERS FOR CARBON
      const r = 5.5;
      // Sheet 1 (z = -3.5)
      atoms.push({ z, pos: offset.clone().add(new THREE.Vector3(0, 0, -3.5)), startPos: startPos, scale: 1.7 });
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2;
        atoms.push({
          z,
          pos: offset.clone().add(new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), -3.5)),
          startPos: startPos,
          scale: 1.6
        });
      }
      // Sheet 2 (z = 3.5, rotated by 30 deg)
      atoms.push({ z, pos: offset.clone().add(new THREE.Vector3(0, 0, 3.5)), startPos: startPos, scale: 1.7 });
      for (let i = 0; i < 6; i++) {
        const theta = (i / 6) * Math.PI * 2 + Math.PI / 6;
        atoms.push({
          z,
          pos: offset.clone().add(new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), 3.5)),
          startPos: startPos,
          scale: 1.6
        });
      }
    }
    else if (symbol === 'Si' || symbol === 'Ge' || symbol === 'Sn') {
      // 13. COVALENT DIAMOND LATTICE - repeating
      const diamondBasis = [
        {x:0, y:0, z:0}, {x:0.5, y:0.5, z:0}, {x:0.5, y:0, z:0.5}, {x:0, y:0.5, z:0.5},
        {x:0.25, y:0.25, z:0.25}, {x:0.75, y:0.75, z:0.25}, {x:0.75, y:0.25, z:0.75}, {x:0.25, y:0.75, z:0.75}
      ];
      atoms.push(...makeRepeatedLattice(z, diamondBasis, 9.5, 1.6));
    }
    else if (['Li', 'Na', 'K', 'V', 'Cr', 'Fe', 'Rb', 'Nb', 'Mo', 'Cs', 'Ba', 'Ta', 'W', 'Eu'].includes(symbol)) {
      // 14. BODY-CENTERED CUBIC LATTICE (BCC) - repeating
      const bccBasis = [{x:0, y:0, z:0}, {x:0.5, y:0.5, z:0.5}];
      atoms.push(...makeRepeatedLattice(z, bccBasis, 8.5, 1.6));
    }
    else if (['Be', 'Mg', 'Ti', 'Co', 'Zn', 'Y', 'Zr', 'Ru', 'Cd', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Lu', 'Hf', 'Re', 'Os', 'Tl'].includes(symbol)) {
      // 15. HEXAGONAL CLOSE-PACKED LATTICE (HCP) - repeating
      atoms.push(...getHcpAtoms(z, 8.0, 6.5));
    }
    else {
      // 16. FACE-CENTERED CUBIC LATTICE (FCC) - Default for metals, repeating
      const fccBasis = [{x:0, y:0, z:0}, {x:0.5, y:0.5, z:0}, {x:0.5, y:0, z:0.5}, {x:0, y:0.5, z:0.5}];
      atoms.push(...makeRepeatedLattice(z, fccBasis, 9.0, 1.6));
    }
    return atoms;
  }

  // ═══════════════════════════════════════════════════════════════
  // CHEMICAL / NUCLEAR COLLISION VISUAL EFFECTS
  // ═══════════════════════════════════════════════════════════════
  function createExplosion(pos, color1, color2) {
    playCollisionSound();
    const standardParticleCount = activeCollisionMode === 'chemical' ? 600 : activeCollisionMode === 'fusion' ? 1500 : 1800;
    const particleCount = prefersReducedMotion?.matches ? Math.max(120, Math.round(standardParticleCount * 0.2)) : standardParticleCount;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    explosionVelocities = [];

    const c1 = new THREE.Color(color1 || 0x00FFFF);
    const c2 = new THREE.Color(color2 || 0xFF00AA);
    const whiteHot = new THREE.Color(0xFFFFFF);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const nuclearBoost = activeCollisionMode === 'chemical' ? 1 : activeCollisionMode === 'fusion' ? 1.7 : 2.2;
      const speed = (12 + Math.random() * 25) * nuclearBoost;
      
      // Kinetic particle velocity with subtle tangential swirl (vortex)
      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.sin(phi) * Math.sin(theta) * speed;
      const vz = Math.cos(phi) * speed;
      
      explosionVelocities.push(new THREE.Vector3(
        vx + (Math.random() - 0.5) * 0.4,
        vy + (Math.random() - 0.5) * 0.4,
        vz + (Math.random() - 0.5) * 0.4
      ));

      // Core particles are white-hot, outer particles transition c1 -> c2
      const isCore = Math.random() < 0.25;
      const mixedColor = isCore 
        ? whiteHot.clone().lerp(c1, Math.random() * 0.5)
        : c1.clone().lerp(c2, Math.random());
        
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: activeCollisionMode === 'chemical' ? 1.6 : 1.25,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    explosionParticles = new THREE.Points(geometry, material);
    scene.add(explosionParticles);
    explosionTimer = 0.75;

    // --- Dual Shockwave Rings & Core Volumetric Flash ---
    if (shockwaveRing) { scene.remove(shockwaveRing); shockwaveRing.geometry.dispose(); shockwaveRing.material.dispose(); }
    if (shockwaveRing2) { scene.remove(shockwaveRing2); shockwaveRing2.geometry.dispose(); shockwaveRing2.material.dispose(); }
    if (fusionFlashSphere) { scene.remove(fusionFlashSphere); fusionFlashSphere.geometry.dispose(); fusionFlashSphere.material.dispose(); }
    if (fusionFlashLight) { scene.remove(fusionFlashLight); fusionFlashLight.dispose?.(); }

    // 1. Primary Equatorial Ring
    const ringGeo1 = new THREE.RingGeometry(0.5, 3.5, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: color1 || 0x00FFFF,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    shockwaveRing = new THREE.Mesh(ringGeo1, ringMat1);
    shockwaveRing.position.copy(pos);
    shockwaveRing.rotation.x = Math.PI * 0.5;
    scene.add(shockwaveRing);

    // 2. Secondary Polar Ring (90 deg offset)
    const ringGeo2 = new THREE.RingGeometry(0.3, 2.8, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: color2 || 0xFF00AA,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    shockwaveRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    shockwaveRing2.position.copy(pos);
    shockwaveRing2.rotation.y = Math.PI * 0.5;
    scene.add(shockwaveRing2);

    // 3. Volumetric Plasma Flash Core Sphere
    const flashGeo = new THREE.SphereGeometry(4.0, 32, 32);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    fusionFlashSphere = new THREE.Mesh(flashGeo, flashMat);
    fusionFlashSphere.position.copy(pos);
    scene.add(fusionFlashSphere);

    fusionFlashLight = new THREE.PointLight(color1 || 0x00FFFF, activeCollisionMode === 'chemical' ? 5 : 12, 130, 2);
    fusionFlashLight.position.copy(pos);
    scene.add(fusionFlashLight);

    shockwaveScale = 0.1;
    shockwaveOpacity = 1.0;
  }

  // ═══════════════════════════════════════════════════════════════
  // VALENCE ENGINE & VSEPR GEOMETRY COMPILER
  // ═══════════════════════════════════════════════════════════════
  const VALENCE_MAP = {
    1: 1, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: -3, 8: -2, 9: -1, 10: 0,
    11: 1, 12: 2, 13: 3, 14: 4, 15: -3, 16: -2, 17: -1, 18: 0,
    19: 1, 20: 2, 21: 3, 22: 4, 23: 5, 24: 3, 25: 2, 26: 3, 27: 2, 28: 2, 29: 2, 30: 2,
    31: 3, 32: 4, 33: -3, 34: -2, 35: -1, 36: 0,
    37: 1, 38: 2, 39: 3, 40: 4, 41: 5, 42: 6, 43: 7, 44: 4, 45: 3, 46: 2, 47: 1, 48: 2,
    49: 3, 50: 4, 51: -3, 52: -2, 53: -1, 54: 0,
    55: 1, 56: 2, 72: 4, 73: 5, 74: 6, 75: 7, 76: 4, 77: 4, 78: 4, 79: 3, 80: 2,
    81: 3, 82: 4, 83: 3, 84: -2, 85: -1, 86: 0
  };

  function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

  function triggerFusionCollision(zA, zB, reaction) {
    isDnaMode = false;
    activeCollisionMode = 'chemical';
    if (!reaction) {
      updateTelemetry(
        'COMBINACIÓN QUÍMICA NO CATALOGADA',
        `${EL[zA]?.s || zA} + ${EL[zB]?.s || zB}`,
        'Sin ecuación balanceada verificada',
        'No se generará un compuesto inventado',
        'BLOCKED · SELECT A CATALOGUED PATH'
      );
      return;
    }
    
    const posA = new THREE.Vector3(-25, 0, 0);
    const posB = new THREE.Vector3(25, 0, 0);
    const atomsA = getElementAtoms(zA, posA);
    const atomsB = getElementAtoms(zB, posB);
    const combinedList = [...atomsA, ...atomsB];
    targetCamZ = window.innerWidth < 700 ? 118 : 82;
    targetRotX = 0;
    targetRotY = 0;
    
    spawnAtoms(combinedList);

    fusionState = 'charging';
    fusionTimer = 0.9;
    fusionChargeDuration = fusionTimer;
    fusionReactantA = zA;
    fusionReactantB = zB;

    fusionTargetReaction = reaction;

    const isCatalogued = reaction.evidenceLevel === 'CATALOGUED';
    updateTelemetry(
      `${tr('chemicalCombination')}: ${EL[zA].s} + ${EL[zB].s}`,
      tr('bringingReactants'),
      tr('chemicalVisualization'),
      isCatalogued ? tr('cataloguedBonding') : tr('referenceModel'),
      isCatalogued ? tr('cataloguedPath') : tr('referenceModel')
    );
  }

  function buildNucleusVisual(isotope, center, startCenter) {
    const atoms = [];
    // One instanced sphere per physical nucleon.  The renderer already sustains
    // 650 atoms in the default DNA scene, so the heaviest catalogue entry
    // (Cf-252) does not require scientifically misleading decimation.
    const visualCount = isotope.A;
    const protonCount = isotope.Z;
    const protonSlots = new Set(Array.from({length:protonCount},(_,slot) => Math.floor((slot + 0.5) * visualCount / Math.max(1,protonCount))));
    const radius = Math.max(1.8, Math.cbrt(isotope.A) * 1.25);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < visualCount; i++) {
      const y = 1 - (i / Math.max(1, visualCount - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      const shell = radius * Math.cbrt((i + 1) / visualCount);
      const local = new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring).multiplyScalar(shell);
      const isProton = protonSlots.has(i);
      atoms.push({
        z:1, col:isProton ? 0xFF315F : 0xB9D2E8,
        nucleonType:isProton ? 'p' : 'n',
        pos:center.clone().add(local),
        startPos:(startCenter || center).clone().add(local.clone().multiplyScalar(0.3)),
        scale:isotope.A <= 12 ? 1.35 : 0.78, noLabel:true, noBond:true,
        nuclearCenter:center.clone(), nuclearLocal:local.clone()
      });
    }
    return atoms;
  }

  function createNuclearChargeField(mode) {
    if (nuclearChargeField) {
      scene.remove(nuclearChargeField);
      nuclearChargeField.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }
    nuclearChargeField = new THREE.Group();
    const color = mode === 'fission' ? 0xFF5500 : 0x00F0FF;
    for (let i = 0; i < 4; i++) {
      const geometry = new THREE.TorusGeometry(7 + i * 2.4, 0.10 + i * 0.025, 10, 96);
      const material = new THREE.MeshBasicMaterial({
        color, transparent:true, opacity:0.48 - i * 0.07,
        blending:THREE.AdditiveBlending, depthWrite:false
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.set(i * 0.61, i * 0.83, i * 0.37);
      nuclearChargeField.add(ring);
    }
    scene.add(nuclearChargeField);
  }

  function startNuclearCollision(reaction, mode) {
    clearMaterialSelection();
    const nuclear = window.NULLA_NUCLEAR;
    const validation = nuclear && reaction ? nuclear.validateReaction(reaction) : null;
    if (!nuclear || !reaction || !validation?.valid) {
      updateTelemetry(tr('datasetError'), tr('reactionRejected'), 'A/Z', tr('noAnimation'), 'BLOCKED');
      return;
    }
    activeCollisionMode = mode;
    activePhysicalNucleonCount = validation.left.A;
    isDnaMode = false;
    activeStructureId = `nuclear-${reaction.id}-reactants`;
    activeThermalProfile = null;
    measurementScaleVerified = false;
    setThermalControlEnabled(false, 'nuclear');
    activeBondCutoffWorld = 1.9;
    const centers = mode === 'fusion'
      ? [new THREE.Vector3(-28,0,0), new THREE.Vector3(28,0,0)]
      : [new THREE.Vector3(0,0,0), new THREE.Vector3(34,0,0)];
    const atoms = [];
    reaction.reactants.forEach((id, index) => {
      const isotope = nuclear.isotopes[id];
      if (isotope) atoms.push(...buildNucleusVisual(isotope, centers[index] || centers[0], centers[index] || centers[0]));
    });
    targetCamZ = window.innerWidth < 700 ? 118 : 82;
    targetRotX = 0;
    targetRotY = 0;
    spawnAtoms(atoms);
    fusionState = 'charging';
    fusionTimer = mode === 'fusion' ? 1.6 : 1.25;
    fusionChargeDuration = fusionTimer;
    fusionReactantA = nuclear.isotopes[reaction.reactants[0]]?.Z || 1;
    fusionReactantB = nuclear.isotopes[reaction.reactants[1]]?.Z || 1;
    fusionTargetReaction = { isNuclear:true, nuclearMode:mode, nuclearReaction:reaction };
    createNuclearChargeField(mode);
    showCompatibility(window.NULLA_COMPATIBILITY?.nuclear({ reaction, isotopes:nuclear.isotopes }));
    const representedNucleons = reaction.reactants.reduce((sum,id) => sum + (nuclear.isotopes[id]?.A || 0),0);
    const physicalNucleons = validation.left.A;
    updateTelemetry(
      `${tr(mode === 'fusion' ? 'fusion' : 'fission')} · ${reaction.reactants.map(id => nuclear.isotopes[id].symbol).join(' + ')}`,
      `${reaction.reactants.map(id => nuclear.isotopes[id].symbol).join(' + ')} → ${reaction.products.map(([id,count]) => `${count > 1 ? count : ''}${nuclear.isotopes[id].symbol}`).join(' + ')}`,
      `${tr('nuclearReaction')} · A ${validation.left.A}→${validation.right.A} · Z ${validation.left.Z}→${validation.right.Z}`,
      `Q ≈ ${reaction.qMeV} MeV · ${tr(validation.qStatus === 'VERIFIED' ? 'massDerivedVerified' : 'massDataIncomplete')} · Avisual/Aphysical ${representedNucleons}/${physicalNucleons}`,
      mode === 'fusion' ? `V_C(r) · ${tr('confinementIllustration')}` : `β₂ · ${tr('scissionIllustration')}`,
      `${reaction.qMeV} MeV`, tr('dataUnavailable'), tr('conservationVerified'),
      tr('visualDisclaimer')
    );
  }

  function attemptNuclearFusion() {
    const selectedChannel = document.getElementById('nuclear-route-selector')?.value || 'auto';
    if (selectedChannel !== 'auto') {
      const explicitRoute = Object.values(window.NULLA_NUCLEAR?.fusion || {}).flat().find(route => route.id === selectedChannel);
      if (explicitRoute) {
        startNuclearCollision(explicitRoute, 'fusion');
        return;
      }
      updateTelemetry(tr('reactionRejected'),tr('fusionRouteMismatch'),selectedChannel,`${tr('fusion')} ≠ ${tr('fission')}`,tr('blockedDomainMismatch'));
      return;
    }
    if (selectedReactants.length === 0) {
      const defaultRoute = window.NULLA_NUCLEAR?.fusion['H+H']?.[0];
      if (defaultRoute) startNuclearCollision(defaultRoute, 'fusion');
      return;
    }
    if (selectedReactants.length !== 2) {
      updateTelemetry(tr('fusion'), tr('selectFusion'), tr('fusionRoutesHint'), tr('isotopesPreview'), tr('waiting'));
      return;
    }
    const key = selectedReactants.map(r => r.sym).sort().join('+');
    const routes = window.NULLA_NUCLEAR?.fusion[key];
    if (!routes?.length) {
      updateTelemetry(`${tr('fusion')} · ${tr('fusionRouteUncatalogued')}`, key, tr('noInventedNuclearProduct'), tr('tryFusionRoutes'), tr('blockedNoEvaluatedChannel'));
      return;
    }
    startNuclearCollision(routes[0], 'fusion');
  }

  function attemptNuclearFission() {
    const selectedChannel = document.getElementById('nuclear-route-selector')?.value || 'auto';
    if (selectedChannel !== 'auto') {
      const explicitRoute = Object.values(window.NULLA_NUCLEAR?.fission || {}).find(route => route.id === selectedChannel);
      if (explicitRoute) {
        startNuclearCollision(explicitRoute, 'fission');
        return;
      }
      updateTelemetry(tr('reactionRejected'),tr('fissionRouteMismatch'),selectedChannel,`${tr('fission')} ≠ ${tr('fusion')}`,tr('blockedDomainMismatch'));
      return;
    }
    if (selectedReactants.length === 0) {
      const defaultRoute = window.NULLA_NUCLEAR?.fission.U;
      if (defaultRoute) startNuclearCollision(defaultRoute, 'fission');
      return;
    }
    const heavy = selectedReactants.find(r => ['U','Pu','Cf'].includes(r.sym));
    if (selectedReactants.length > 1) {
      updateTelemetry(tr('fission'), tr('selectFission'), tr('singleIsotopePerChannel'), tr('extraReactantsPreserved'), tr('reactionRejected'));
      return;
    }
    if (!heavy) {
      updateTelemetry(tr('fission'), tr('selectFission'), tr('balancedRepresentativeChannels'), 'U-235+n · Pu-239+n · Cf-252', tr('waiting'));
      return;
    }
    startNuclearCollision(window.NULLA_NUCLEAR?.fission[heavy.sym], 'fission');
  }

  function formNuclearProducts(target) {
    const nuclear = window.NULLA_NUCLEAR;
    const reaction = target.nuclearReaction;
    const atoms = [];
    const products = [];
    reaction.products.forEach(([id, count]) => {
      for (let i = 0; i < count; i++) products.push(nuclear.isotopes[id]);
    });
    const spread = 18 + Math.cbrt(Math.max(...products.map(isotope => isotope.A))) * 2;
    const layout = nuclear.balancedProductLayout(reaction,spread);
    products.forEach((isotope,index) => {
      const center = new THREE.Vector3(layout[index].x,layout[index].y,layout[index].z);
      atoms.push(...buildNucleusVisual(isotope, center, new THREE.Vector3()));
    });
    spawnAtoms(atoms);
    activeStructureId = `nuclear-${reaction.id}`;
    const validation = nuclear.validateReaction(reaction);
    activePhysicalNucleonCount = validation.right.A;
    updateTelemetry(
      `${tr(target.nuclearMode === 'fusion' ? 'fusion' : 'fission')} · ${tr('completed')}`,
      `${reaction.reactants.map(id => nuclear.isotopes[id].symbol).join(' + ')} → ${reaction.products.map(([id,count]) => `${count > 1 ? count : ''}${nuclear.isotopes[id].symbol}`).join(' + ')}`,
      `${tr('evaluatedChannel')} · A ${validation.left.A}→${validation.right.A} · Z ${validation.left.Z}→${validation.right.Z}`,
      `A ${validation.left.A}=${validation.right.A} · Z ${validation.left.Z}=${validation.right.Z}`,
      `${tr('energyRelease')} Q ≈ ${reaction.qMeV} MeV · ${tr(validation.qStatus === 'VERIFIED' ? 'massDerivedVerified' : 'massDataIncomplete')}`,
      `${reaction.qMeV} MeV`, tr('dataUnavailable'), tr('conservationVerified'),
      tr('visualDisclaimer')
    );
  }

  let temperatureK = 298;
  if (tempSlider) {
    tempSlider.addEventListener('input', e => {
      temperatureK = parseInt(e.target.value);
      const c = temperatureK - 273;
      if (tempVal) tempVal.textContent = `${temperatureK} K (${c > 0 ? '+' + c : c}°C)`;
      updateThermalStatus();
      window.dispatchEvent(new CustomEvent('nulla:temperature',{detail:{temperatureK,phase:phaseAtTemperature(activeThermalProfile,temperatureK).key}}));
    });
  }

  function calculateSpectroscopyData(formula, bondType) {
    const str = String(formula || '');
    if (str.includes('B-DNA') || str.includes('TP53')) {
      return { lambdaMax:'≈260 nm', colorHex:'#00F0FF', irStretch:'MULTIBAND · CONTEXT DEPENDENT', region:'UV reference', model:true };
    }
    if (str.includes('H₂O') || str.includes('Water')) {
      return { lambdaMax:'≈185 nm', colorHex:'#00F0FF', irStretch:'≈3650 cm⁻¹ (O–H, gas reference)', region:'Vacuum-UV reference', model:true };
    } else if (str.includes('NaCl') || str.includes('CaO') || str.includes('Sodium Chloride')) {
      return { lambdaMax:null, colorHex:'#FFD700', irStretch:'≈550 cm⁻¹ (lattice reference)', region:null, model:true };
    } else if (str.includes('CO₂') || str.includes('Carbon Dioxide')) {
      return { lambdaMax:null, colorHex:'#00FF9D', irStretch:'≈2349 cm⁻¹ (asymmetric stretch)', region:null, model:true };
    } else if (str.includes('Fe₂O₃') || str.includes('CuO')) {
      return { lambdaMax:null, colorHex:'#FF7700', irStretch:'≈570 cm⁻¹ (metal–oxygen reference)', region:null, model:true };
    } else if (str.includes('KMnO₄')) {
      return { lambdaMax:'≈525 nm', colorHex:'#BF00FF', irStretch:'≈905 cm⁻¹ (Mn–O reference)', region:'visible reference', model:true };
    }
    return { lambdaMax:null, colorHex:'#8AA0B8', irStretch:null, region:null, model:false };
  }

  function generateTopCompoundSuggestions(reactantsArray) {
    if (!reactantsArray?.length) return [];
    const selected = new Set(reactantsArray.map(reactant => reactant.sym));
    const seenFormulas = new Set();
    const suggestions = [];
    for (const [path, reaction] of Object.entries(REACTIONS)) {
      if (reaction.evidenceLevel !== 'CATALOGUED') continue;
      const reactantSymbols = new Set(path.split('+'));
      if (![...selected].every(symbol => reactantSymbols.has(symbol))) continue;
      if (!reaction?.formula || seenFormulas.has(reaction.formula)) continue;
      seenFormulas.add(reaction.formula);
      suggestions.push({
        path,
        name:reaction.name,
        formula:reaction.formula,
        type:reaction.type,
        stability:reaction.stabilityScore ? `${reaction.stabilityScore}%` : 'CATALOGUED',
        enthalpy:Number.isFinite(reaction.enthalpy) ? `${reaction.enthalpy} kJ/mol` : 'DATA UNAVAILABLE',
        isExact:true,
        evidenceLevel:reaction.evidenceLevel || 'CATALOGUED'
      });
    }
    return suggestions.slice(0,5);
  }

  function updateTelemetry(name, formula, cls, bonds, epi, enthalpy, dipole, stability, note) {
    if (hudName) hudName.textContent = name || '—';
    if (hudFormula) hudFormula.textContent = formula || '—';
    if (hudClass) hudClass.textContent = cls || '—';
    if (hudBonds) hudBonds.textContent = bonds || '—';
    if (hudEpi) hudEpi.textContent = epi || '—';

    if (hudEnthalpy) hudEnthalpy.textContent = enthalpy !== undefined ? (typeof enthalpy === 'number' ? `${enthalpy} kJ/mol` : enthalpy) : '—';
    if (hudDipole) hudDipole.textContent = dipole !== undefined ? (typeof dipole === 'number' ? `${dipole} Debye` : dipole) : '—';
    
    if (hudStability) {
      const isNuclearTelemetry = typeof enthalpy === 'string' && enthalpy.includes('MeV');
      if (isNuclearTelemetry) {
        hudStability.textContent = String(stability || 'A/Z CONSERVED');
        hudStability.style.color = '#00FF9D';
      } else {
        const isNum = typeof stability === 'number';
        hudStability.textContent = isNum ? `${stability}%` : (stability || tr('dataUnavailable'));
        hudStability.style.color = stability === undefined || stability === null ? '#8AA0B8' : '#FFD166';
      }
    }

    if (hudNote) hudNote.textContent = note || tr('dataUnavailable');

    // Only catalogued reference bands are displayed; no generic values are fabricated.
    const spec = calculateSpectroscopyData(`${formula || ''} ${name || ''}`, cls || '');
    if (hudSpectrum) {
      hudSpectrum.textContent = spec.lambdaMax ? `${spec.lambdaMax} · ${spec.region} · ${tr('referenceModel')}` : tr('dataUnavailable');
      hudSpectrum.style.color = spec.colorHex;
    }
    if (hudIr) hudIr.textContent = spec.irStretch ? `${spec.irStretch} · ${tr('referenceModel')}` : tr('dataUnavailable');

    if (topBanner && name) {
      topBanner.textContent = String(name).toUpperCase();
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function calibratedGeometryExportAllowed() {
    if (activeCollisionMode === 'fusion' || activeCollisionMode === 'fission') {
      updateTelemetry(tr('exportNuclearBlocked'),'PROTON/NEUTRON VISUAL SCHEMA','CHEMICAL FILE FORMATS CANNOT REPRESENT THIS NUCLEON VIEW',tr('dataUnavailable'),'NO MISLABELLED FILE CREATED');
      return false;
    }
    if (!measurementScaleVerified || !Number.isFinite(angstromPerWorldUnit)) {
      updateTelemetry(tr('exportScaleBlocked'),'GEOMETRY SCALE: UNCALIBRATED','DIMENSIONAL COORDINATES REQUIRE AN EXPLICIT SCALE',tr('dataUnavailable'),'NO DIMENSIONAL DATA WAS INVENTED');
      return false;
    }
    return true;
  }

  function exportGLTFFile() {
    playTone(750, 'sine', 0.2);
    if (activeAtoms.length === 0) return;
    if (!calibratedGeometryExportAllowed()) return;
    const metersPerWorldUnit = angstromPerWorldUnit * 1e-10;

    const gltfStructure = {
      asset: { version: "2.0", generator: "NULLA-LABS calibrated coordinate exporter", extras:{representation:'coordinate nodes; no surface mesh',units:'metres'} },
      scenes: [{ nodes: activeAtoms.map((_, idx) => idx) }],
      nodes: activeAtoms.map((a, idx) => ({
        name: a.elData?.n || `Atom_${idx}`,
        translation: [a.currentPos.x * metersPerWorldUnit, a.currentPos.y * metersPerWorldUnit, a.currentPos.z * metersPerWorldUnit],
        extras:{element:a.elData?.s || 'X'}
      }))
    };

    const blob = new Blob([JSON.stringify(gltfStructure, null, 2)], { type: 'model/gltf+json' });
    downloadBlob(blob, 'calibrated_structure_coordinates.gltf');
  }

  function exportUSDZFile() {
    playTone(800, 'sine', 0.2);
    if (activeAtoms.length === 0) return;
    if (!calibratedGeometryExportAllowed()) return;

    let usdaContent = `#usda 1.0\n( defaultPrim = "Molecule" metersPerUnit = 1e-10 upAxis = "Y" )\n\ndef Xform "Molecule"\n{\n`;
    activeAtoms.forEach((a, i) => {
      const symbol = a.elData?.s || 'X';
      const xA = a.currentPos.x * angstromPerWorldUnit;
      const yA = a.currentPos.y * angstromPerWorldUnit;
      const zA = a.currentPos.z * angstromPerWorldUnit;
      usdaContent += `  def Sphere "${symbol}_${i}"\n  {\n    custom bool nulla:radiusIsIllustrative = true\n    double radius = 0.25\n    double3 xformOp:translate = (${xA.toFixed(4)}, ${yA.toFixed(4)}, ${zA.toFixed(4)})\n    uniform token[] xformOpOrder = ["xformOp:translate"]\n  }\n`;
    });
    usdaContent += `}\n`;

    const blob = new Blob([usdaContent], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, 'molecule_structure.usda');
  }

  function exportXYZFile() {
    playTone(880, 'sine', 0.2);
    if (activeAtoms.length === 0) return;
    if (activeCollisionMode === 'fusion' || activeCollisionMode === 'fission') {
      updateTelemetry(tr('xyzNuclearBlocked'),'PROTON/NEUTRON VISUAL SCHEMA','XYZ ELEMENT SYMBOLS CANNOT REPRESENT THIS NUCLEON VIEW','USE HD CAPTURE FOR THE VISUAL SCENE','NO MISLABELLED FILE CREATED');
      return;
    }
    if (!measurementScaleVerified || !Number.isFinite(angstromPerWorldUnit)) {
      updateTelemetry(tr('xyzScaleBlocked'),'GEOMETRY SCALE: UNCALIBRATED','XYZ COORDINATES REQUIRE AN EXPLICIT Å SCALE','SELECT A CALIBRATED MATERIAL','NO DIMENSIONAL DATA WAS INVENTED');
      return;
    }

    let xyzText = `${activeAtoms.length}\n`;
    xyzText += `Generated by NULLA-LABS · coordinates in angstrom · structure=${activeStructureId}\n`;

    activeAtoms.forEach(a => {
      const sym = a.elData?.s || 'X';
      const x = (a.currentPos.x * angstromPerWorldUnit).toFixed(4);
      const y = (a.currentPos.y * angstromPerWorldUnit).toFixed(4);
      const z = (a.currentPos.z * angstromPerWorldUnit).toFixed(4);
      xyzText += `${sym.padEnd(4)} ${x.padStart(10)} ${y.padStart(10)} ${z.padStart(10)}\n`;
    });

    const blob = new Blob([xyzText], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, 'molecule_structure_3d.xyz');
  }

  function showVerifiedSuggestions() {
    playTone(550, 'triangle', 0.15);
    const suggestionModal = document.getElementById('suggestion-modal');
    const suggestionList = document.getElementById('suggestion-list');

    if (!suggestionModal || !suggestionList) return;

    const suggestions = generateTopCompoundSuggestions(selectedReactants);
    suggestionList.innerHTML = '';

    if (suggestions.length === 0) {
      suggestionList.innerHTML = `<div style="font-size:9.5px; color:rgba(255,255,255,0.7); text-align:center; padding:8px;">${tr('noSuggestion')}</div>`;
    } else {
      suggestions.forEach((s) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = `
          padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.25);
          background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(18,24,36,0.85) 100%);
          display: flex; justify-content: space-between; align-items: center; cursor: pointer;
          transition: all 0.2s;
        `;
        itemDiv.innerHTML = `
          <div>
            <div style="font-size:10px; font-weight:700; color:#FFFFFF;">${s.name} (${s.formula})</div>
            <div style="font-size:8px; color:rgba(255,255,255,0.65);">${s.type} · ${s.stability}</div>
          </div>
          <button style="padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.4); background:rgba(255,255,255,0.15); color:#FFFFFF; font-size:8px; font-weight:700; cursor:pointer;">${tr('combine')}</button>
        `;
        itemDiv.addEventListener('click', () => {
          closeDialog(suggestionModal);
          const suggestedReactants = s.path.split('+').map(symbol => {
            const element = Object.values(EL).find(candidate => candidate.s === symbol);
            return element ? {z:element.z,sym:element.s} : null;
          }).filter(Boolean);
          if (suggestedReactants.length >= 2 && suggestedReactants.length <= MAX_REACTANTS) {
            selectedReactants = suggestedReactants;
            updateReactantsTrayHUD();
            renderSideBySidePreviewAtoms();
          }
          attemptMultiFusion();
        });
        suggestionList.appendChild(itemDiv);
      });
    }

    openDialog(suggestionModal, btnSuggest);
  }

  // ═══════════════════════════════════════════════════════════════
  // MULTI-ELEMENT REACTANT TRAY MANAGER (2 to 5 Elements)
  // ═══════════════════════════════════════════════════════════════
  let selectedReactants = [];
  let lastCompatibilityResult = null;
  const MAX_REACTANTS = 3;

  function translateCompatibilityItem(item) {
    const exact = {
      'ΔHf°, Ea and k(T): N/D':'thermochemistryUnavailable',
      'Products / competing pathways: N/D':'productsPathwaysUnavailable',
      'p° ≈ 1 atm · SOURCE: N/D':'pressureSourceUnavailable',
      'ISOTOPE CHANNEL: N/D':'isotopeChannelUnavailable',
      'σ(E) / products: N/D':'crossSectionProductsUnavailable',
      'nₜₕ + TARGET':'thermalNeutronTarget',
      'YIELDS = DISTRIBUTED · CHANNEL ≠ UNIQUE':'distributedYields',
      'BRANCH SET ≠ UNIQUE':'multipleBranches'
    };
    if (exact[item]) return tr(exact[item]);
    if (item === 'ΔHf°: N/D') return `ΔHf°: ${tr('dataUnavailable')}`;
    if (item === 'Ea / k(T): N/D') return `Ea / k(T): ${tr('dataUnavailable')}`;
    const temperatureMatch = /^T=(.+ K) · RANGE: N\/D$/.exec(item);
    if (temperatureMatch) return `T=${temperatureMatch[1]} · ${tr('rangeUnavailable')}`;
    return item;
  }

  function showCompatibility(result) {
    if (!result) return;
    lastCompatibilityResult = result;
    const statusKeys = {
      NO_CATALOGUED_PATH:'statusNoCataloguedPath',
      CATALOGUED_FAVORABLE:'statusCataloguedFavorable',
      CATALOGUED_CONDITION_DEPENDENT:'statusConditionDependent',
      CATALOGUED_INCOMPLETE_DATA:'statusIncompleteData',
      COMPOSITION_CATALOGUED_ROUTE_UNEVALUATED:'statusIncompleteData',
      REFERENCE_MODEL_INCOMPLETE_DATA:'statusReferenceModel',
      NO_EVALUATED_CHANNEL:'statusNoEvaluatedChannel',
      EXOENERGETIC_EVALUATED_CHANNEL:'statusExoenergetic',
      EXOENERGETIC_CHANNEL_KINETICS_UNEVALUATED:'statusExoenergetic',
      ENERGY_INPUT_REQUIRED:'statusEnergyInput'
    };
    if (hudCompatibility) {
      const score = typeof result.score === 'number' ? ` · ${tr('dataCoverage')} ${Math.round(result.score * 100)}%` : '';
      hudCompatibility.textContent = `${tr(statusKeys[result.status] || result.status)}${score}`;
      hudCompatibility.style.color = result.status.includes('NO_') ? '#FF6B4A' : result.status.includes('FAVORABLE') || result.status.includes('EXOENERGETIC') ? '#00FF9D' : '#FFD166';
    }
    if (hudConditions) {
      const requirements = result.requirements?.length ? result.requirements.map(translateCompatibilityItem).join(' · ') : tr('noAdditionalConditions');
      const risks = result.instability?.length ? ` | ${tr('instability')}: ${result.instability.map(translateCompatibilityItem).join(' · ')}` : '';
      hudConditions.textContent = `${requirements}${risks}`;
    }
  }

  function evaluateChemicalCompatibility(reaction) {
    const reactants = selectedReactants.map(item => ({
      z:item.z, symbol:item.sym, electronegativity:EL[item.z]?.electronegativity
    }));
    const result = window.NULLA_COMPATIBILITY?.chemical({ reactants, reaction, temperatureK });
    showCompatibility(result);
    return result;
  }

  function updateReactantsTrayHUD() {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]) {
        if (i < selectedReactants.length) {
          slots[i].textContent = selectedReactants[i].sym;
          const el = EL[selectedReactants[i].z];
          const colorStr = '#' + (el ? el.col : 0x00F0FF).toString(16).padStart(6, '0');
          slots[i].style.color = colorStr;
        } else {
          slots[i].textContent = '—';
          slots[i].style.color = '#00F0FF';
        }
      }
    }
  }

  function renderSideBySidePreviewAtoms() {
    if (selectedReactants.length === 0) return;
    clearMaterialSelection();
    
    isDnaMode = false;
    const atoms = [];
    const count = selectedReactants.length;

    // Wide horizontal separation (56+ units clearance) to eliminate any cluster overlap
    const offsets = [];
    if (count === 2) {
      offsets.push(new THREE.Vector3(-28.0, 0, 0));
      offsets.push(new THREE.Vector3(28.0, 0, 0));
    } else if (count === 3) {
      offsets.push(new THREE.Vector3(-32.0, -6.0, 0));
      offsets.push(new THREE.Vector3(0, 16.0, 0));
      offsets.push(new THREE.Vector3(32.0, -6.0, 0));
    } else if (count === 4) {
      offsets.push(new THREE.Vector3(-36.0, -8.0, 0));
      offsets.push(new THREE.Vector3(-14.0, 14.0, 0));
      offsets.push(new THREE.Vector3(14.0, 14.0, 0));
      offsets.push(new THREE.Vector3(36.0, -8.0, 0));
    } else {
      offsets.push(new THREE.Vector3(-40.0, -10.0, 0));
      offsets.push(new THREE.Vector3(-20.0, 12.0, 0));
      offsets.push(new THREE.Vector3(0, -6.0, 0));
      offsets.push(new THREE.Vector3(20.0, 12.0, 0));
      offsets.push(new THREE.Vector3(40.0, -10.0, 0));
    }

    selectedReactants.forEach((r, idx) => {
      const offset = offsets[idx] || new THREE.Vector3((idx - (count - 1) * 0.5) * 26.0, 0, 0);
      const elAtoms = getElementAtoms(r.z, offset);
      atoms.push(...elAtoms);
    });

    spawnAtoms(atoms);

    const symbolsStr = selectedReactants.map(r => r.sym).join(' + ');
    updateTelemetry(
      `Multi-Reactant Tray (${count}/${MAX_REACTANTS})`,
      symbolsStr,
      `State: ACTIVE INJECTION TRAY`,
      `Ready for Collision (Click ⚡ FUSE ALL)`,
      `Wide Horizontal 3D Quantum Separation`
    );
    const reactionKey = canonicalReactionKey(selectedReactants.map(r => r.sym));
    evaluateChemicalCompatibility(REACTIONS[reactionKey]);
  }

  function selectElementForTray(z) {
    playTone(400 + selectedReactants.length * 80, 'sine', 0.12);

    if (selectedReactants.length >= MAX_REACTANTS) {
      updateTelemetry(
        `Tray Maximum Reached (${MAX_REACTANTS}/${MAX_REACTANTS})`,
        `Catalogue arity capped at ${MAX_REACTANTS} species`,
        `Reaction State: TRAY FULL`,
        `Click ⚡ FUSE ALL or ↩ UNDO`,
        `No unlisted four- or five-species product will be invented`
      );
      return;
    }

    const sym = EL[z]?.s || 'X';
    selectedReactants.push({ z, sym });
    updateReactantsTrayHUD();

    if (selectedReactants.length === 1) {
      formElement(z);
    } else {
      renderSideBySidePreviewAtoms();
    }
  }

  function undoLastReactant() {
    playTone(300, 'triangle', 0.1);
    if (selectedReactants.length > 0) {
      selectedReactants.pop();
      updateReactantsTrayHUD();
      if (selectedReactants.length === 1) {
        formElement(selectedReactants[0].z);
      } else if (selectedReactants.length > 1) {
        renderSideBySidePreviewAtoms();
      } else {
        buildDNA();
      }
    }
  }

  function clearReactantTray() {
    playTone(200, 'sawtooth', 0.15);
    selectedReactants = [];
    updateReactantsTrayHUD();
  }

  function attemptMultiFusion() {
    if (selectedReactants.length < 2) {
      updateTelemetry(
        tr('chemicalCombination'),
        selectedReactants.length === 1 ? `${selectedReactants[0].sym} + ?` : tr('selectFusion'),
        tr('waiting'),
        tr('noAdditionalConditions'),
        tr('statusNoCataloguedPath')
      );
      return;
    }

    playTone(600, 'triangle', 0.2);
    const reactionKey = canonicalReactionKey(selectedReactants.map(r => r.sym));
    const reaction = REACTIONS[reactionKey];
    evaluateChemicalCompatibility(reaction);
    if (!reaction) {
      updateTelemetry(
        'COMBINACIÓN QUÍMICA NO CATALOGADA',
        selectedReactants.map(r => r.sym).join(' + '),
        'Sin ecuación balanceada verificada',
        'No se generará un compuesto inventado',
        'BLOCKED · SELECT A CATALOGUED PATH',
        undefined, undefined, 'NO DATA',
        'Usa SUGERIR para ver combinaciones disponibles para los elementos seleccionados.'
      );
      return;
    }

    if (selectedReactants.length === 2) {
      triggerFusionCollision(selectedReactants[0].z, selectedReactants[1].z, reaction);
    } else {
      isDnaMode = false;
      
      const atoms = [];
      const count = selectedReactants.length;
      const offsets = [];
      if (count === 3) {
        offsets.push(new THREE.Vector3(-32.0, -6.0, 0));
        offsets.push(new THREE.Vector3(0, 16.0, 0));
        offsets.push(new THREE.Vector3(32.0, -6.0, 0));
      } else if (count === 4) {
        offsets.push(new THREE.Vector3(-36.0, -8.0, 0));
        offsets.push(new THREE.Vector3(-14.0, 14.0, 0));
        offsets.push(new THREE.Vector3(14.0, 14.0, 0));
        offsets.push(new THREE.Vector3(36.0, -8.0, 0));
      } else {
        offsets.push(new THREE.Vector3(-40.0, -10.0, 0));
        offsets.push(new THREE.Vector3(-20.0, 12.0, 0));
        offsets.push(new THREE.Vector3(0, -6.0, 0));
        offsets.push(new THREE.Vector3(20.0, 12.0, 0));
        offsets.push(new THREE.Vector3(40.0, -10.0, 0));
      }

      selectedReactants.forEach((r, idx) => {
        const offset = offsets[idx] || new THREE.Vector3((idx - (count - 1) * 0.5) * 26.0, 0, 0);
        const elAtoms = getElementAtoms(r.z, offset);
        atoms.push(...elAtoms);
      });

      spawnAtoms(atoms);

      fusionState = 'charging';
      fusionTimer = 0.9;
      fusionChargeDuration = fusionTimer;
      fusionReactantA = selectedReactants[0].z;
      fusionReactantB = selectedReactants[1].z;

      fusionTargetReaction = reaction;

      updateTelemetry(
        `Multi-Reactant Collision (${selectedReactants.length} Elements)`,
        selectedReactants.map(r => r.sym).join(' + '),
        `Collision State: CONVERGING RADIANTS TO CENTROID`,
        `Preparing catalogued chemical pathway`,
        `Educational collision visualization`
      );
    }
  }

  const ptTooltip = document.getElementById('pt-tooltip');

  const periodicCells = [...document.querySelectorAll('.pt-el')];
  periodicCells.forEach((cell, cellIndex) => {
    const cellZ = parseInt(cell.dataset.z);
    const cellElement = EL[cellZ];
    cell.setAttribute('role', 'button');
    cell.setAttribute('tabindex', cellIndex === 0 ? '0' : '-1');
    if (cellElement) cell.setAttribute('aria-label', tr('elementAria',{name:cellElement.n,symbol:cellElement.s,z:cellZ}));

    const activateCell = () => {
      if (ptTooltip) ptTooltip.style.display = 'none';
      const z = parseInt(cell.dataset.z);
      if (z) selectElementForTray(z);
    };

    cell.addEventListener('mousemove', e => {
      const z = parseInt(cell.dataset.z);
      if (!z) return;
      const el = EL[z];
      if (!el) return;

      if (ptTooltip) {
        ptTooltip.style.display = 'block';
        ptTooltip.style.left = (e.clientX + 14) + 'px';
        ptTooltip.style.top = (e.clientY + 14) + 'px';

        const massStr = typeof el.m === 'number' ? el.m.toFixed(3) : el.m;
        ptTooltip.innerHTML = `
          <div class="tt-header">${el.n} (${el.s}) — Z=${z}</div>
          <div class="tt-row"><span class="tt-label">m:</span> <span>${massStr} u</span></div>
          <div class="tt-row"><span class="tt-label">${tr('stateLabel')}:</span> <span>${el.phase || tr('dataUnavailable')}</span></div>
          <div class="tt-row"><span class="tt-label">${tr('classLabel')}:</span> <span>${el.cat}</span></div>
          <div class="tt-row"><span class="tt-label">e⁻:</span> <span>${el.sh}</span></div>
        `;
      }
    });

    cell.addEventListener('mouseleave', () => {
      if (ptTooltip) ptTooltip.style.display = 'none';
    });

    cell.addEventListener('click', activateCell);
    cell.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activateCell();
        return;
      }
      const movement = {ArrowRight:1,ArrowDown:18,ArrowLeft:-1,ArrowUp:-18};
      if (!(event.key in movement) && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End'
        ? periodicCells.length - 1
        : Math.max(0, Math.min(periodicCells.length - 1, cellIndex + movement[event.key]));
      periodicCells.forEach((candidate,index) => candidate.tabIndex = index === nextIndex ? 0 : -1);
      periodicCells[nextIndex].focus();
    });
  });

  // FUSE Button
  if (btnFuse) {
    btnFuse.addEventListener('click', attemptMultiFusion);
  }
  if (btnMix) {
    btnMix.addEventListener('click', attemptPhysicalMixture);
  }
  const btnNuclearFusion = document.getElementById('btn-nuclear-fusion');
  const btnNuclearFission = document.getElementById('btn-nuclear-fission');
  if (btnNuclearFusion) btnNuclearFusion.addEventListener('click', attemptNuclearFusion);
  if (btnNuclearFission) btnNuclearFission.addEventListener('click', attemptNuclearFission);

  // SUGGEST Button
  if (btnSuggest) {
    btnSuggest.addEventListener('click', showVerifiedSuggestions);
  }

  const btnCloseSuggest = document.getElementById('btn-close-suggest');
  if (btnCloseSuggest) {
    btnCloseSuggest.addEventListener('click', () => {
      const suggestionModal = document.getElementById('suggestion-modal');
      closeDialog(suggestionModal);
    });
  }

  // TECHNICAL DOCUMENTATION MODAL
  const btnDocs = document.getElementById('btn-docs');
  const docsModal = document.getElementById('docs-modal');
  const btnCloseDocs = document.getElementById('btn-close-docs');

  if (btnDocs) {
    btnDocs.addEventListener('click', () => {
      playTone(600, 'sine', 0.15);
      openDialog(docsModal, btnDocs);
    });
  }

  if (btnCloseDocs) {
    btnCloseDocs.addEventListener('click', () => {
      closeDialog(docsModal);
    });
  }

  // EXPORT .XYZ Button
  if (btnExportXyz) {
    btnExportXyz.addEventListener('click', exportXYZFile);
  }

  // UNDO Button
  if (btnUndo) {
    btnUndo.addEventListener('click', undoLastReactant);
  }

  // CLEAR Button
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      clearReactantTray();
      buildDNA();
    });
  }

  // RESET to DNA
  if (btnReassemble) {
    btnReassemble.addEventListener('click', () => {
      playTone(330, 'sine', 0.15);
      clearReactantTray();
      buildDNA();
    });
  }

  const materialBuilders = {
    'btn-nacl': buildNaclCrystal,
    'btn-diamond': buildDiamondLattice,
    'btn-c60': buildFullereneC60,
    'btn-nanotube': buildCarbonNanotube,
    'btn-graphene': buildGrapheneSheet,
    'btn-solvation': buildSolvationShell
  };
  function clearMaterialSelection() {
    document.querySelectorAll('.material-grid .shader-btn').forEach(button => button.setAttribute('aria-pressed','false'));
  }
  Object.entries(materialBuilders).forEach(([id, builder]) => {
    const button = document.getElementById(id);
    if (!button) return;
    button.addEventListener('click', () => {
      playTone(620, 'triangle', 0.15);
      clearReactantTray();
      document.querySelectorAll('.material-grid .shader-btn').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      builder();
    });
  });

  // RANDOM SYNTHESIS chooses a real catalogue path instead of manufacturing a
  // mostly impossible random multi-element tray.
  if (btnRandom) {
    btnRandom.addEventListener('click', () => {
      playTone(440, 'triangle', 0.1);
      clearReactantTray();
      const candidates = Object.entries(REACTIONS).filter(([key,reaction]) =>
        reaction.evidenceLevel === 'CATALOGUED' && key.split('+').length >= 2 && key.split('+').length <= MAX_REACTANTS
      );
      const [path] = candidates[Math.floor(Math.random() * candidates.length)] || [];
      selectedReactants = String(path || 'Cl+Na').split('+').map(symbol => {
        const element = Object.values(EL).find(candidate => candidate.s === symbol);
        return {z:element.z,sym:element.s};
      });
      updateReactantsTrayHUD();
      renderSideBySidePreviewAtoms();
      setTimeout(() => {
        attemptMultiFusion();
      }, 500);
    });
  }

  let isMeasuringMode = false;
  let selectedMeasureAtoms = [];
  let laserLineMesh = null;

  function updateMeasurementAccessibility() {
    if (btnMeasure) btnMeasure.setAttribute('aria-pressed',String(isMeasuringMode));
    if (!canvas) return;
    canvas.setAttribute('aria-label',tr(isMeasuringMode ? 'measurementSceneLabel' : 'sceneLabel'));
    if (isMeasuringMode) canvas.setAttribute('aria-keyshortcuts','Enter Space');
    else canvas.removeAttribute('aria-keyshortcuts');
  }

  if (btnMeasure) {
    btnMeasure.addEventListener('click', () => {
      isMeasuringMode = !isMeasuringMode;
      selectedMeasureAtoms = [];
      btnMeasure.style.borderColor = isMeasuringMode ? '#00FF9D' : 'rgba(255,255,255,0.35)';
      btnMeasure.style.color = isMeasuringMode ? '#00FF9D' : '#FFFFFF';
      updateMeasurementAccessibility();
      if (isMeasuringMode) canvas?.focus({preventScroll:true});
      playTone(isMeasuringMode ? 700 : 350, 'triangle', 0.15);

      if (!isMeasuringMode && laserLineMesh) {
        scene.remove(laserLineMesh);
        laserLineMesh.geometry.dispose();
        laserLineMesh.material.dispose();
        laserLineMesh = null;
      }
    });
  }
  updateMeasurementAccessibility();

  // GRAPHICS QUALITY CONTROLS
  let currentQuality = 'MEDIUM';
  const btnQualLow = document.getElementById('btn-quality-low');
  const btnQualMed = document.getElementById('btn-quality-med');
  const btnQualUltra = document.getElementById('btn-quality-ultra');

  function setQualityPreset(level) {
    playTone(600, 'sine', 0.1);
    currentQuality = level;
    [btnQualLow, btnQualMed, btnQualUltra].forEach(b => {
      if (b) { b.style.borderColor = 'rgba(255,255,255,0.25)'; b.style.background = 'rgba(18,24,36,0.8)'; }
    });
    if (level === 'LOW' && btnQualLow) { btnQualLow.style.borderColor = '#00F0FF'; btnQualLow.style.background = 'rgba(0,240,255,0.2)'; }
    if (level === 'MEDIUM' && btnQualMed) { btnQualMed.style.borderColor = '#00F0FF'; btnQualMed.style.background = 'rgba(0,240,255,0.2)'; }
    if (level === 'ULTRA' && btnQualUltra) { btnQualUltra.style.borderColor = '#00F0FF'; btnQualUltra.style.background = 'rgba(0,240,255,0.2)'; }
    const ratio = level === 'LOW' ? 0.75 : level === 'MEDIUM' ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateTelemetry(tr('graphicsQualityApplied'), level, `${tr('pixelRatio')}: ${ratio.toFixed(2)}`, tr('rendererResolutionUpdated'), tr('activeStatus'));
  }

  if (btnQualLow) btnQualLow.addEventListener('click', () => setQualityPreset('LOW'));
  if (btnQualMed) btnQualMed.addEventListener('click', () => setQualityPreset('MEDIUM'));
  if (btnQualUltra) btnQualUltra.addEventListener('click', () => setQualityPreset('ULTRA'));

  // EDUCATIONAL QUIZ MODAL
  const btnQuiz = document.getElementById('btn-quiz');
  const quizModal = document.getElementById('quiz-modal');
  const btnCloseQuiz = document.getElementById('btn-close-quiz');
  const quizQuestion = document.getElementById('quiz-question');
  const quizOptions = document.getElementById('quiz-options');
  const quizExplanation = document.getElementById('quiz-explanation');
  const quizProgress = document.getElementById('quiz-progress');
  const btnNextQuiz = document.getElementById('btn-next-quiz');

  let currentQuizIdx = 0;
  let quizScore = 0;
  let quizAnswered = false;

  function loadQuizQuestion(idx) {
    const questions = window.NULLA_QUIZ?.get(window.NULLA_I18N?.locale);
    if (!questions?.length) return;
    const q = questions[idx % questions.length];
    quizAnswered = false;
    if (quizQuestion) quizQuestion.textContent = q.question;
    if (quizExplanation) quizExplanation.style.display = 'none';
    if (quizProgress) quizProgress.textContent = `${idx + 1} / ${questions.length} · ✓ ${quizScore}`;
    if (btnNextQuiz) {
      btnNextQuiz.style.display = 'none';
      btnNextQuiz.textContent = idx === questions.length - 1
        ? (getEducationContent()?.ui.done || '✓')
        : (getEducationContent()?.ui.next || 'NEXT');
    }

    if (quizOptions) {
      quizOptions.innerHTML = '';
      q.options.forEach((opt, optIdx) => {
        const btn = document.createElement('button');
        btn.style.cssText = `
          padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3);
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(18,24,36,0.9) 100%);
          color: #FFFFFF; font-family: 'Orbitron', sans-serif; font-size: 9px; font-weight: 700;
          text-align: left; cursor: pointer; transition: all 0.2s;
        `;
        btn.textContent = `${optIdx + 1}. ${opt}`;
        btn.addEventListener('click', () => {
          if (quizAnswered) return;
          quizAnswered = true;
          const optionButtons = [...quizOptions.querySelectorAll('button')];
          optionButtons.forEach((optionButton, index) => {
            optionButton.disabled = true;
            optionButton.style.cursor = 'default';
            optionButton.style.opacity = index === q.correct || index === optIdx ? '1' : '0.62';
            if (index === q.correct) {
              optionButton.style.borderColor = '#00FF9D';
              optionButton.style.background = 'rgba(0,255,157,0.25)';
            }
          });
          if (optIdx === q.correct) {
            quizScore++;
            playTone(880, 'sine', 0.2);
          } else {
            playTone(220, 'sawtooth', 0.2);
            btn.style.borderColor = '#FF0055';
            btn.style.background = 'rgba(255,0,85,0.25)';
          }
          if (quizExplanation) {
            quizExplanation.textContent = q.explanation;
            quizExplanation.style.display = 'block';
          }
          if (quizProgress) quizProgress.textContent = `${idx + 1} / ${questions.length} · ✓ ${quizScore}`;
          if (btnNextQuiz) btnNextQuiz.style.display = 'block';
        });
        quizOptions.appendChild(btn);
      });
    }
  }

  if (btnQuiz) {
    btnQuiz.addEventListener('click', () => {
      playTone(650, 'triangle', 0.15);
      currentQuizIdx = 0;
      quizScore = 0;
      loadQuizQuestion(currentQuizIdx);
      openDialog(quizModal, btnQuiz);
    });
  }

  if (btnCloseQuiz) {
    btnCloseQuiz.addEventListener('click', () => {
      closeDialog(quizModal);
    });
  }

  // URL STATE SHARING (#reactants=11,17)
  const btnShareUrl = document.getElementById('btn-share-url');
  if (btnShareUrl) {
    btnShareUrl.addEventListener('click', async () => {
      playTone(700, 'sine', 0.15);
      const zList = selectedReactants.map(r => r.z).join(',');
      const params = new URLSearchParams();
      if (zList) params.set('reactants', zList);
      params.set('structure', activeStructureId);
      params.set('temp', String(temperatureK));
      params.set('mode', window.NULLA_EXPERIENCE?.mode || 'basic');
      const shareUrl = `${location.origin}${location.pathname}#${params.toString()}`;
      try {
        if (navigator.share) {
          await navigator.share({ title:tr('shareTitle'), url:shareUrl });
          updateTelemetry(tr('shareSheetOpened'), shareUrl, tr('stateUrl'), tr('sharedStateContents'), tr('sharedStatus'));
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          updateTelemetry(tr('shareUrlCopied'), shareUrl, tr('stateUrl'), tr('sharedStateContents'), tr('copiedStatus'));
        } else {
          window.prompt(tr('copyShareUrlPrompt'), shareUrl);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') window.prompt(tr('copyShareUrlPrompt'), shareUrl);
      }
    });
  }

  if (btnNextQuiz) {
    btnNextQuiz.addEventListener('click', () => {
      const questions = window.NULLA_QUIZ?.get(window.NULLA_I18N?.locale) || [];
      if (!quizAnswered || !questions.length) return;
      if (currentQuizIdx >= questions.length - 1) {
        closeDialog(quizModal);
        return;
      }
      currentQuizIdx++;
      loadQuizQuestion(currentQuizIdx);
    });
  }

  // Read URL Hash on init
  if (location.hash && location.hash.includes('reactants=')) {
    try {
      const zStr = location.hash.split('reactants=')[1].split('&')[0];
      const zs = zStr.split(',').map(n => parseInt(n)).filter(n => !isNaN(n));
      if (zs.length > 0) {
        setTimeout(() => {
          zs.forEach(z => selectElementForTray(z));
          const shared = new URLSearchParams(location.hash.slice(1));
          const structure = shared.get('structure') || '';
          if (structure.startsWith('nuclear-')) {
            const reactionId = structure.slice('nuclear-'.length);
            const nuclear = window.NULLA_NUCLEAR;
            const fusionReaction = Object.values(nuclear?.fusion || {}).flat().find(reaction => reaction.id === reactionId);
            const fissionReaction = Object.values(nuclear?.fission || {}).find(reaction => reaction.id === reactionId);
            if (fusionReaction) startNuclearCollision(fusionReaction, 'fusion');
            else if (fissionReaction) startNuclearCollision(fissionReaction, 'fission');
            else updateTelemetry(tr('datasetError'), reactionId, tr('reactionRejected'), tr('noAnimation'), 'BLOCKED');
          } else {
            attemptMultiFusion();
          }
        }, 800);
      }
    } catch (e) { console.warn('Hash parse error:', e); }
  }

  if (location.hash) {
    const shared = new URLSearchParams(location.hash.slice(1));
    const sharedTemp = Number(shared.get('temp'));
    if (Number.isFinite(sharedTemp) && sharedTemp >= 0 && sharedTemp <= 5000) {
      temperatureK = sharedTemp;
      if (tempSlider) tempSlider.value = String(sharedTemp);
      if (tempVal) tempVal.textContent = `${sharedTemp} K (${Math.round(sharedTemp - 273.15)}°C)`;
    }
    const sharedBuilders = {
      nacl: buildNaclCrystal, diamond: buildDiamondLattice, c60: buildFullereneC60,
      nanotube: buildCarbonNanotube, graphene: buildGrapheneSheet, solvation: buildSolvationShell
    };
    const sharedBuilder = sharedBuilders[shared.get('structure')];
    if (sharedBuilder && !shared.get('reactants')) setTimeout(sharedBuilder, 500);
  }

  if (btnExportGltf) {
    btnExportGltf.addEventListener('click', exportGLTFFile);
  }

  const btnExportUsdz = document.getElementById('btn-export-usdz');
  if (btnExportUsdz) {
    btnExportUsdz.addEventListener('click', exportUSDZFile);
  }

  // WEBGPU / WEBGL2 AUTOMATIC CAPABILITY DETECTOR
  const gpuStatusBadge = document.getElementById('gpu-status-badge');
  if (navigator.gpu && gpuStatusBadge) {
    navigator.gpu.requestAdapter().then(adapter => {
      if (adapter) {
        gpuStatusBadge.textContent = '⚡ WEBGPU HIGH-PERF · 118 ELEMENTS';
        gpuStatusBadge.style.color = '#00FF9D';
        gpuStatusBadge.style.borderColor = 'rgba(0,255,157,0.5)';
      }
    }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════
  // INTERACTIVE GUIDED ONBOARDING TUTORIAL ENGINE
  // ═══════════════════════════════════════════════════════════════
  let currentTutorialStep = 0;
  const onboardingStorageKey = 'nulla-tutorial-state-v2';
  let onboardingTimer = null;
  let tutorialStartingMode = 'basic';
  let tutorialStartTemperature = temperatureK;
  let highlightedTutorialTarget = null;
  let tutorialReviewedScientificPanel = false;
  const tutorialVisitedModes = new Set();
  const btnTutorial = document.getElementById('btn-tutorial');
  const onboardingOverlay = document.getElementById('onboarding-overlay');
  const onboardingTitle = document.getElementById('onboarding-title');
  const onboardingInstruction = document.getElementById('onboarding-instruction');
  const onboardingObjective = document.getElementById('onboarding-objective');
  const onboardingAnnouncement = document.getElementById('onboarding-announcement');
  const onboardingStepIndicator = document.getElementById('onboarding-step-indicator');
  const btnNextOnboarding = document.getElementById('btn-next-onboarding');
  const btnPrevOnboarding = document.getElementById('btn-prev-onboarding');
  const btnCloseOnboarding = document.getElementById('btn-close-onboarding');

  const getEducationContent = () => {
    const locale = window.NULLA_I18N?.locale;
    const base = window.NULLA_EDUCATION?.get(locale);
    const advanced = window.NULLA_ADVANCED_TUTORIAL?.get(locale);
    if (!base) return advanced;
    return advanced ? {...base,ui:{...base.ui,...advanced.ui,skip:advanced.ui.exit},tutorial:advanced.tutorial} : base;
  };

  function renderEducationContent() {
    const education = getEducationContent();
    if (!education) return;
    const docsTitle = document.getElementById('docs-modal-title');
    const quizTitle = document.getElementById('quiz-modal-title');
    const suggestionTitle = document.getElementById('suggestion-modal-title');
    const docsContent = document.getElementById('docs-modal-content');
    if (docsTitle) docsTitle.textContent = education.ui.docs;
    if (quizTitle) quizTitle.textContent = education.ui.quiz;
    if (suggestionTitle) suggestionTitle.textContent = education.ui.suggest;
    if (btnCloseOnboarding) btnCloseOnboarding.textContent = education.ui.skip;
    if (docsContent) {
      docsContent.replaceChildren(...education.docs.map(([title,body], index) => {
        const section = document.createElement('details');
        const heading = document.createElement('summary');
        const paragraph = document.createElement('p');
        const colors = ['#FFD700','#00FF9D','#BF00FF','#FF0055'];
        section.open = index === 0;
        section.style.cssText = 'padding:8px 10px;border:1px solid rgba(255,255,255,.14);border-radius:9px;background:rgba(255,255,255,.025);';
        heading.style.cssText = `color:${colors[index % colors.length]}; font-size:10.5px; font-family:'Orbitron',sans-serif; cursor:pointer;`;
        paragraph.style.cssText = 'margin-top:7px;';
        heading.textContent = title;
        paragraph.textContent = body;
        section.append(heading, paragraph);
        return section;
      }));
    }
  }

  function tutorialObjectiveComplete(step) {
    if (!step) return false;
    if (step.verify === 'mode') return tutorialVisitedModes.size >= 3 && window.NULLA_EXPERIENCE?.mode === 'basic';
    if (step.verify === 'element') return selectedReactants.length >= 1;
    if (step.verify === 'chemical') return activeStructureId.startsWith('compound-') || activeStructureId.startsWith('mixture-');
    if (step.verify === 'thermal') return ['nacl','diamond','c60','nanotube','graphene','solvation'].includes(activeStructureId) && temperatureK !== tutorialStartTemperature && !tempSlider?.disabled;
    if (step.verify === 'nuclear') return activeStructureId.startsWith('nuclear-');
    if (step.verify === 'measurement') return selectedMeasureAtoms.length >= 2 && measurementScaleVerified;
    if (step.verify === 'review') return window.NULLA_EXPERIENCE?.mode === 'science' && tutorialReviewedScientificPanel;
    return false;
  }

  function updateTutorialObjective() {
    const education = getEducationContent();
    const step = education?.tutorial?.[currentTutorialStep];
    if (!step || !onboardingObjective) return;
    const complete = tutorialObjectiveComplete(step);
    const objectiveText = `${complete ? education.ui.verified : education.ui.pending} · ${step.objective}`;
    onboardingObjective.dataset.complete = String(complete);
    if (onboardingObjective.textContent !== objectiveText) {
      onboardingObjective.textContent = objectiveText;
      if (onboardingAnnouncement) {
        const announcement = `${step.title}. ${step.instruction} ${objectiveText}`;
        onboardingAnnouncement.textContent = '';
        requestAnimationFrame(() => {
          if (onboardingOverlay?.style.display === 'block') onboardingAnnouncement.textContent = announcement;
        });
      }
    }
    if (btnNextOnboarding) btnNextOnboarding.disabled = !complete;
  }

  function closeTutorial(completed = false) {
    if (onboardingTimer) clearInterval(onboardingTimer);
    onboardingTimer = null;
    highlightedTutorialTarget?.classList.remove('tutorial-highlight');
    highlightedTutorialTarget = null;
    if (onboardingOverlay) onboardingOverlay.style.display = 'none';
    window.NULLA_EXPERIENCE?.set(tutorialStartingMode,{persist:false});
    try {
      localStorage.setItem(onboardingStorageKey,JSON.stringify({schema:2,step:currentTutorialStep,completed,dismissed:!completed,updatedAt:new Date().toISOString()}));
    } catch (_) {}
    btnTutorial?.focus({preventScroll:true});
  }

  function showTutorialStep(idx) {
    if (!onboardingOverlay) return;
    const opening = onboardingOverlay.style.display !== 'block';
    const education = getEducationContent();
    const steps = education?.tutorial || [];
    if (!steps.length) return;
    currentTutorialStep = Math.max(0,Math.min(steps.length - 1,idx));
    const s = steps[currentTutorialStep];
    window.NULLA_EXPERIENCE?.set(s.mode,{persist:false});

    if (onboardingTitle) onboardingTitle.textContent = s.title;
    if (onboardingInstruction) onboardingInstruction.textContent = s.instruction;
    if (onboardingStepIndicator) onboardingStepIndicator.textContent = education.ui.step.replace('{n}', s.step).replace('{total}',steps.length);

    if (btnNextOnboarding) btnNextOnboarding.textContent = s.step === steps.length ? education.ui.done : education.ui.next;
    if (btnPrevOnboarding) {
      btnPrevOnboarding.textContent = education.ui.previous;
      btnPrevOnboarding.disabled = currentTutorialStep === 0;
    }

    onboardingOverlay.style.display = 'block';
    if (opening) onboardingTitle?.focus({preventScroll:true});

    highlightedTutorialTarget?.classList.remove('tutorial-highlight');
    const targetEl = document.getElementById(s.targetId);
    if (targetEl) {
      highlightedTutorialTarget = targetEl;
      targetEl.classList.add('tutorial-highlight');
    }
    updateTutorialObjective();
  }

  if (btnTutorial) {
    btnTutorial.addEventListener('click', () => {
      playTone(700, 'sine', 0.15);
      tutorialStartingMode = window.NULLA_EXPERIENCE?.mode || 'basic';
      tutorialStartTemperature = temperatureK;
      tutorialVisitedModes.clear();
      tutorialVisitedModes.add(tutorialStartingMode);
      tutorialReviewedScientificPanel = false;
      let resumeStep = 0;
      try {
        const state = JSON.parse(localStorage.getItem(onboardingStorageKey) || 'null');
        if (state?.schema === 2 && !state.completed) resumeStep = Number(state.step) || 0;
      } catch (_) {}
      showTutorialStep(resumeStep);
      if (onboardingTimer) clearInterval(onboardingTimer);
      onboardingTimer = setInterval(updateTutorialObjective,350);
    });
  }

  if (btnNextOnboarding) {
    btnNextOnboarding.addEventListener('click', () => {
      playTone(600, 'sine', 0.1);
      const stepCount = getEducationContent()?.tutorial?.length || 0;
      if (currentTutorialStep >= stepCount - 1) {
        closeTutorial(true);
      } else {
        showTutorialStep(currentTutorialStep + 1);
      }
    });
  }

  if (btnPrevOnboarding) btnPrevOnboarding.addEventListener('click',() => showTutorialStep(currentTutorialStep - 1));

  if (btnCloseOnboarding) {
    btnCloseOnboarding.addEventListener('click', () => {
      closeTutorial(false);
    });
  }

  window.addEventListener('nulla:experience',event => {
    if (onboardingOverlay?.style.display !== 'block') return;
    tutorialVisitedModes.add(event.detail?.mode);
    updateTutorialObjective();
  });
  hudPanel?.addEventListener('click',() => {
    const step = getEducationContent()?.tutorial?.[currentTutorialStep];
    if (onboardingOverlay?.style.display === 'block' && step?.verify === 'review') {
      tutorialReviewedScientificPanel = true;
      updateTutorialObjective();
    }
  });
  hudPanel?.addEventListener('keydown',event => {
    const step = getEducationContent()?.tutorial?.[currentTutorialStep];
    if (onboardingOverlay?.style.display === 'block' && step?.verify === 'review' && ['Enter',' '].includes(event.key)) {
      event.preventDefault();
      tutorialReviewedScientificPanel = true;
      updateTutorialObjective();
    }
  });
  document.addEventListener('keydown',event => {
    if (event.key === 'Escape' && onboardingOverlay?.style.display === 'block' && !activeDialog) {
      event.preventDefault();
      closeTutorial(false);
    }
  });

  // The tutorial is deliberately opt-in.  A modal that opens on first load can
  // cover the synthesis controls and make working buttons appear broken.

  // WEBXR / VR VIRTUAL REALITY SESSION BUTTON
  const btnWebxr = document.getElementById('btn-webxr');
  if (btnWebxr) {
    btnWebxr.addEventListener('click', async () => {
      playTone(720, 'sine', 0.2);
      if (!navigator.xr || !renderer.xr) {
        updateTelemetry(tr('webxrUnavailable'), tr('immersiveApiUnavailable'), tr('webxrCompatibleEnvironment'), tr('noSessionStarted'), tr('unavailableStatus'));
        return;
      }
      try {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        if (!supported) {
          updateTelemetry(tr('webxrUnavailable'), tr('immersiveVrUnsupported'), tr('compatibleHeadsetMissing'), tr('noSessionStarted'), tr('unavailableStatus'));
          return;
        }
        const session = await navigator.xr.requestSession('immersive-vr', {optionalFeatures:['local-floor']});
        renderer.xr.enabled = true;
        await renderer.xr.setSession(session);
        renderer.setAnimationLoop(animate);
        updateTelemetry(tr('webxrMode'), tr('immersiveSessionStarted'), tr('stereoRenderingEnabled'), tr('headsetSessionConnected'), tr('activeXrSession'));
        session.addEventListener('end', () => {
          renderer.setAnimationLoop(null);
          requestAnimationFrame(animate);
          updateTelemetry(tr('webxrMode'), tr('immersiveSessionEnded'), tr('desktopRenderingRestored'), tr('headsetDisconnected'), tr('sessionEnded'));
        }, {once:true});
      } catch (error) {
        updateTelemetry(tr('webxrNotStarted'), error?.name || tr('sessionRequestFailed'), tr('webxrRequirementsNotMet'), tr('noActiveVrSession'), tr('unavailableStatus'));
      }
    });
  }

  // ATOMIC ORBITALS Button
  if (btnOrbitals) {
    btnOrbitals.addEventListener('click', () => {
      playTone(520, 'sine', 0.2);
      const targetZ = selectedSlotA ? selectedSlotA.z : (activeAtoms.length > 0 ? activeAtoms[0].z : 6);
      generateAtomicOrbitalCloud(targetZ);
    });
  }

  // AUDIO TOGGLE Button
  if (btnAudio) {
    if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
      audioEnabled = !window.NULLA_AUDIO.isMuted();
      btnAudio.textContent = tr(audioEnabled ? 'audioOn' : 'audioOff');
      btnAudio.style.color = audioEnabled ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
    }
    btnAudio.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.NULLA_AUDIO) {
        const muted = window.NULLA_AUDIO.toggleMute();
        audioEnabled = !muted;
      } else {
        audioEnabled = !audioEnabled;
      }
      btnAudio.textContent = tr(audioEnabled ? 'audioOn' : 'audioOff');
      btnAudio.style.color = audioEnabled ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
    });
  }

  // EXPORT HD SCREENSHOT Button
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      playTone(880, 'sine', 0.2);
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'nulla-labs-synthesis-3d.png';
      link.href = dataUrl;
      link.click();
    });
  }

  renderEducationContent();

  function translateVisibleRuntimeValues() {
    const i18n = window.NULLA_I18N;
    const target = i18n?.messages?.[i18n.locale];
    if (!target) return;
    const replacements = [];
    for (const [key, translated] of Object.entries(target)) {
      if (typeof translated !== 'string' || translated.length < 4) continue;
      for (const catalog of Object.values(i18n.messages)) {
        const previous = catalog?.[key];
        if (typeof previous === 'string' && previous.length >= 4 && previous !== translated) {
          replacements.push([previous, translated]);
        }
      }
    }
    replacements.sort((a,b) => b[0].length - a[0].length);
    [hudName,hudFormula,hudClass,hudBonds,hudEnthalpy,hudDipole,hudStability,hudSpectrum,hudIr,hudEpi,hudNote,tempVal,atomCountEl]
      .filter(Boolean)
      .forEach(node => {
        let value = node.textContent || '';
        replacements.forEach(([previous,translated]) => { value = value.split(previous).join(translated); });
        node.textContent = value;
      });
  }

  window.addEventListener('nulla:locale', () => {
    renderEducationContent();
    translateVisibleRuntimeValues();
    periodicCells.forEach(cell => {
      const z = parseInt(cell.dataset.z);
      const element = EL[z];
      if (element) cell.setAttribute('aria-label',tr('elementAria',{name:element.n,symbol:element.s,z}));
    });
    updateMeasurementAccessibility();
    if (lastCompatibilityResult) showCompatibility(lastCompatibilityResult);
    if (btnAudio) btnAudio.textContent = tr(audioEnabled ? 'audioOn' : 'audioOff');
    updateThermalStatus();
    if (onboardingOverlay?.style.display === 'block') showTutorialStep(currentTutorialStep);
    if (quizModal?.style.display === 'block') loadQuizQuestion(currentQuizIdx);
  });

  const btnRecord = document.getElementById('btn-record');
  let mediaRecorder = null;
  let recordedChunks = [];
  if (btnRecord) {
    if (!window.MediaRecorder || !renderer.domElement.captureStream) {
      btnRecord.disabled = true;
      btnRecord.textContent = tr('recordUnavailable');
    } else {
      btnRecord.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          return;
        }
        const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
        const mimeType = mimeCandidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
        const stream = renderer.domElement.captureStream(60);
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
        mediaRecorder.ondataavailable = event => { if (event.data.size) recordedChunks.push(event.data); };
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type:mediaRecorder.mimeType || 'video/webm' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `nulla-labs-${activeStructureId}-${Date.now()}.webm`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          stream.getTracks().forEach(track => track.stop());
          btnRecord.textContent = tr('record');
          btnRecord.style.color = '#FFFFFF';
        };
        mediaRecorder.start(1000);
        btnRecord.textContent = tr('recordStop');
        btnRecord.style.color = '#FF0055';
      });
    }
  }



  // ═══════════════════════════════════════════════════════════════
  // MOUSE ORBIT & RAYCAST SELECTION
  // ═══════════════════════════════════════════════════════════════
  const raycaster = new THREE.Raycaster();
  const mouseScreen = new THREE.Vector2();

  let isDragging = false, prevMouse = {x:0,y:0};
  let targetRotX = 0, targetRotY = 0, curRotX = 0, curRotY = 0;
  let hoveredAtomObj = null, selectedAtomObj = null;

  canvas.addEventListener('pointermove', e => {
    mouseScreen.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseScreen.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouseScreen, camera);
    const hits = raycaster.intersectObjects(activeInstancedMeshes);

    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const hitIdx = hits[0].instanceId;
      const hit = activeAtoms.find(a => a.instancedMesh === hitMesh && a.instIdx === hitIdx && !a.removing);

      if (hit) {
        if (hoveredAtomObj && hoveredAtomObj !== hit && hoveredAtomObj !== selectedAtomObj) {
          hoveredAtomObj.targetScale = hoveredAtomObj.isElectron ? 0.35 : (1.2 + (hoveredAtomObj.elData.r || 1.0) * 0.4);
        }
        hoveredAtomObj = hit;
        if (hit !== selectedAtomObj) {
          hit.targetScale = (hit.isElectron ? 0.35 : (1.2 + (hit.elData.r || 1.0) * 0.4)) * 1.4;
        }
        document.body.style.cursor = 'pointer';
      } else {
        resetHover();
      }
    } else {
      resetHover();
    }

    function resetHover() {
      if (hoveredAtomObj && hoveredAtomObj !== selectedAtomObj) {
        hoveredAtomObj.targetScale = hoveredAtomObj.isElectron ? 0.35 : (1.2 + (hoveredAtomObj.elData.r || 1.0) * 0.4);
      }
      hoveredAtomObj = null;
      document.body.style.cursor = 'default';
    }

    if (isDragging) {
      targetRotY += (e.clientX - prevMouse.x) * 0.006;
      targetRotX += (e.clientY - prevMouse.y) * 0.006;
      prevMouse = {x:e.clientX, y:e.clientY};
    }
  });

  canvas.addEventListener('pointerdown', e => {
    isDragging = true;
    prevMouse = {x:e.clientX, y:e.clientY};
    mouseScreen.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseScreen.y = -(e.clientY / window.innerHeight) * 2 + 1;
    canvas.setPointerCapture?.(e.pointerId);
  });
  const stopCanvasDrag = e => {
    isDragging = false;
    if (e?.pointerId !== undefined && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', stopCanvasDrag);
  canvas.addEventListener('pointercancel', stopCanvasDrag);
  canvas.addEventListener('pointerleave', e => { if (e.buttons === 0) stopCanvasDrag(e); });

  // Smooth Mouse Wheel Camera Zooming
  let targetCamZ = 75;
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    targetCamZ += e.deltaY * 0.05;
    targetCamZ = Math.max(15, Math.min(220, targetCamZ));
  }, { passive:false });

  canvas.addEventListener('click', e => {
    let hit = e.detail?.measurementHit || null;
    if (!hit) {
      raycaster.setFromCamera(mouseScreen, camera);
      const hits = raycaster.intersectObjects(activeInstancedMeshes);
      if (hits.length > 0) {
      const hitMesh = hits[0].object;
      const hitIdx = hits[0].instanceId;
        hit = activeAtoms.find(a => a.instancedMesh === hitMesh && a.instIdx === hitIdx && !a.removing);
      }
    }

    if (hit) {
        if (isMeasuringMode) {
          playTone(600 + selectedMeasureAtoms.length * 150, 'sine', 0.12);
          if (selectedMeasureAtoms.length >= 3) selectedMeasureAtoms = [];
          selectedMeasureAtoms.push(hit);

          if (laserLineMesh) {
            scene.remove(laserLineMesh);
            laserLineMesh.geometry.dispose();
            laserLineMesh.material.dispose();
            laserLineMesh = null;
          }

          if (selectedMeasureAtoms.length >= 2) {
            const posA = selectedMeasureAtoms[0].currentPos;
            const posB = selectedMeasureAtoms[1].currentPos;
            const measurement = window.NULLA_MEASUREMENT?.distance(posA,posB,measurementScaleVerified ? angstromPerWorldUnit : 1);
            if (!measurement) return;
            const distAngstrom = measurementScaleVerified ? measurement.angstrom.toFixed(2) : null;
            const distPicometer = measurementScaleVerified ? measurement.picometer.toFixed(0) : null;

            const points = [posA, posB];
            let angleStr = '';

            if (selectedMeasureAtoms.length === 3) {
              const posC = selectedMeasureAtoms[2].currentPos;
              points.push(posC, posA);
              const angleDeg = window.NULLA_MEASUREMENT?.angleDegrees(posA,posB,posC);
              if (Number.isFinite(angleDeg)) angleStr = ` | ${tr('geometricAngle')}: ${angleDeg.toFixed(1)}°`;
            }

            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x00FF9D, linewidth: 2 });
            laserLineMesh = new THREE.Line(lineGeo, lineMat);
            scene.add(laserLineMesh);

            const distanceLabel = measurementScaleVerified
              ? `Distance: ${distAngstrom} Å (${distPicometer} pm)`
              : `Distance: ${measurement.world.toFixed(2)} MODEL UNITS · ${tr('dataUnavailable')}`;
            updateTelemetry(
              `Laser 3D Measurement Mode`,
              `${distanceLabel}${angleStr}`,
              `3D distance and geometric-angle tool`,
              `Selected: ${selectedMeasureAtoms.map(a => a.elData.s).join(' — ')}`,
              `Active Laser Vector`
            );
          } else {
            updateTelemetry(
              `Laser 3D Measurement Mode`,
              `Atom 1 Selected (${hit.elData.s})`,
              `Click 2nd atom to measure distance in Ångströms`,
              `Click 3rd atom to measure bond angle (°)`,
              `Laser Target Locked`
            );
          }
        } else {
          if (selectedAtomObj) {
            selectedAtomObj.targetScale = selectedAtomObj.isElectron ? 0.35 : (1.2 + (selectedAtomObj.elData.r || 1.0) * 0.4);
          }

          selectedAtomObj = hit;
          hit.targetScale = (hit.isElectron ? 0.35 : (1.2 + (hit.elData.r || 1.0) * 0.4)) * 1.8;
          selectRing.position.copy(hit.currentPos);
          selectRing.visible = true;

          updateTelemetry(
            `${hit.elData.n} (${hit.elData.s}) — Z = ${hit.z}`,
            `Atomic Mass: ${hit.elData.m} u`,
            `Category: ${hit.elData.cat}`,
            `Electron Config: ${hit.elData.sh}`,
            `Individual Atom Selected`
          );
        }
    }
  });

  canvas.addEventListener('keydown',event => {
    if (!isMeasuringMode || !['Enter',' '].includes(event.key)) return;
    event.preventDefault();
    const candidates = activeAtoms.filter(atom => !atom.removing && !atom.isElectron && atom.instancedMesh);
    if (!candidates.length) return;
    const nextAtom = candidates[selectedMeasureAtoms.length % candidates.length];
    canvas.dispatchEvent(new CustomEvent('click',{detail:{measurementHit:nextAtom}}));
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ═══════════════════════════════════════════════════════════════
  // RENDER LOOP — Educational phase motion and fail-safe guard engine
  // ═══════════════════════════════════════════════════════════════
  let frameCount = 0, lastTime = performance.now(), lastAnimationTime = performance.now();
  let lastThermalPhaseKey = null;
  let phaseTransitionStartedAt = 0;

  function getDiagnosticsSnapshot() {
    const liveAtoms = activeAtoms.filter(atom => !atom.removing);
    const liveBonds = activeBonds.filter(bond => !bond.removing);
    const isNuclearMode = activeCollisionMode === 'fusion' || activeCollisionMode === 'fission';
    const degree = new Array(liveAtoms.length).fill(0);
    const elementCounts = {};
    const nucleonCounts = {p:0,n:0};
    const bondOrderHistogram = {};
    liveAtoms.forEach(atom => {
      if (isNuclearMode) {
        if (atom.nucleonType === 'p' || atom.nucleonType === 'n') nucleonCounts[atom.nucleonType]++;
      } else {
        const symbol = EL[atom.z]?.s || (atom.z === 0 ? 'n' : `Z${atom.z}`);
        elementCounts[symbol] = (elementCounts[symbol] || 0) + 1;
      }
    });
    liveBonds.forEach(bond => {
      if (Number.isInteger(bond.aIdx) && degree[bond.aIdx] !== undefined) degree[bond.aIdx]++;
      if (Number.isInteger(bond.bIdx) && degree[bond.bIdx] !== undefined) degree[bond.bIdx]++;
      bondOrderHistogram[bond.order] = (bondOrderHistogram[bond.order] || 0) + 1;
    });
    const degreeHistogram = degree.reduce((histogram,value) => {
      histogram[value] = (histogram[value] || 0) + 1;
      return histogram;
    },{});
    return {
      structure:activeStructureId,
      collisionMode:activeCollisionMode,
      fusionState,
      atomCount:liveAtoms.length,
      particleCount:liveAtoms.length,
      bondCount:activeBonds.filter(bond => !bond.removing).length,
      bondCutoffWorld:activeBondCutoffWorld,
      spawnGeneration,
      instancedMeshes:activeInstancedMeshes.length,
      orbitLines:activeOrbitLines.length,
      measurementScaleVerified,
      scientific:{
        particleKind:isNuclearMode ? 'nucleon' : 'atom',
        physicalA:isNuclearMode ? activePhysicalNucleonCount : null,
        visualParticles:liveAtoms.length,
        elementCounts,
        nucleonCounts:isNuclearMode ? nucleonCounts : null,
        degreeHistogram,
        bondOrderHistogram,
        finite:liveAtoms.every(atom => [atom.currentPos.x,atom.currentPos.y,atom.currentPos.z,atom.currentScale].every(Number.isFinite))
      },
      thermal:{
        enabled:!tempSlider?.disabled,
        temperatureK,
        phase:phaseAtTemperature(activeThermalProfile,temperatureK).key,
        profile:activeThermalProfile ? {...activeThermalProfile} : null
      },
      renderer:{
        geometries:renderer.info.memory.geometries,
        textures:renderer.info.memory.textures,
        calls:renderer.info.render.calls,
        triangles:renderer.info.render.triangles
      },
      runtimeHealth:{...window.NULLA_RUNTIME_HEALTH}
    };
  }

  function sanitizeVector(v) {
    if (!v) return;
    if (isNaN(v.x) || !isFinite(v.x)) v.x = 0;
    if (isNaN(v.y) || !isFinite(v.y)) v.y = 0;
    if (isNaN(v.z) || !isFinite(v.z)) v.z = 0;
  }

  function phaseAtTemperature(profile, tempK) {
    const key = window.NULLA_THERMODYNAMICS?.phaseAtTemperature(profile,tempK) || 'unknown';
    const labelKey = key === 'unknown' ? (profile ? 'phaseUnavailable' : 'phaseUnknown') : `phase${key[0].toUpperCase()}${key.slice(1)}`;
    return {key,label:tr(labelKey)};
  }

  function lennardJonesForceMagnitude(distance, epsilon = 0.003, sigma = 3.0) {
    return window.NULLA_THERMODYNAMICS?.lennardJonesForceMagnitude(distance,epsilon,sigma) || 0;
  }

  function applyLennardJonesStep(atoms, dt) {
    const particles = atoms.filter(a => !a.isElectron && !a.removing);
    if (particles.length > 220) return;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      if (!a.velocity) a.velocity = new THREE.Vector3();
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        if (!b.velocity) b.velocity = new THREE.Vector3();
        const delta = new THREE.Vector3().subVectors(b.targetPos, a.targetPos);
        const distance = delta.length();
        const force = THREE.MathUtils.clamp(lennardJonesForceMagnitude(distance), -0.08, 0.08);
        if (!force || distance <= 0.01) continue;
        delta.multiplyScalar(force * dt / distance);
        a.velocity.sub(delta);
        b.velocity.add(delta);
      }
    }
  }

  function animate(now) {
    if (!renderer.xr?.isPresenting) requestAnimationFrame(animate);

    try {
      const elapsedSeconds = Math.min(1, Math.max(0.001, (now - lastAnimationTime) / 1000));
      lastAnimationTime = now;
      frameCount++;
      if (now - lastTime >= 1000) {
        if (fpsVal) fpsVal.textContent = frameCount + ' FPS';
        if (runtimeDiagnostics) runtimeDiagnostics.textContent = JSON.stringify(getDiagnosticsSnapshot());
        frameCount = 0;
        lastTime = now;
      }

      const t = now * 0.001;

      // Smooth atom morphing and modelled phase-dependent motion
    const dummy = new THREE.Object3D();
    const instUpdateList = new Set();
    const activePhase = phaseAtTemperature(activeThermalProfile, temperatureK);
    if (activePhase.key !== lastThermalPhaseKey) {
      lastThermalPhaseKey = activePhase.key;
      phaseTransitionStartedAt = now;
      if (activePhase.key === 'gas') {
        activeAtoms.forEach(atom => { if (!atom.isElectron) atom.velocity = null; });
      }
    }
    const phaseMorphing = now - phaseTransitionStartedAt < 1200;
    if (activeCollisionMode === 'chemical' && fusionState === 'idle' && (activePhase.key === 'liquid' || activePhase.key === 'gas')) {
      applyLennardJonesStep(activeAtoms, Math.min(0.033, elapsedSeconds));
    }

    // Real-time 3D laser measurement vector line update
    if (isMeasuringMode && selectedMeasureAtoms.length >= 2) {
      try {
        const points = selectedMeasureAtoms.map(a => a.currentPos);
        if (selectedMeasureAtoms.length === 3) points.push(selectedMeasureAtoms[0].currentPos);
        if (laserLineMesh) {
          laserLineMesh.geometry.dispose();
          laserLineMesh.geometry = new THREE.BufferGeometry().setFromPoints(points);
        }
      } catch (e) {
        console.warn('Laser line update error:', e);
      }
    }

    for (let i = activeAtoms.length - 1; i >= 0; i--) {
      const a = activeAtoms[i];
      
      // Educational thermal motion using structure-specific transition data.
      if (activeCollisionMode === 'chemical' && fusionState === 'idle' && !a.removing && !a.isElectron) {
        const phase = activePhase;
        if (phase.key === 'unknown') {
          if (a.basePos) a.targetPos.copy(a.basePos);
          if (hudEpi && i === 0) hudEpi.textContent = tr('phaseUnavailable');
        } else if (phase.key === 'solid') {
          const referenceTm = Number(activeThermalProfile?.melt) || Number(activeThermalProfile?.boil) || 1000;
          const solidVibScale = Math.min(1.5, temperatureK / Math.max(1, referenceTm));
          const vibX = Math.sin(t * 12.0 + a.instIdx) * (0.35 * solidVibScale);
          const vibY = Math.cos(t * 14.0 + a.instIdx) * (0.35 * solidVibScale);
          const vibZ = Math.sin(t * 10.0 + a.instIdx) * (0.35 * solidVibScale);
          if (a.basePos) a.targetPos.copy(a.basePos).add(new THREE.Vector3(vibX, vibY, vibZ));
          if (hudEpi && i === 0) hudEpi.textContent = `${phase.label} (${temperatureK} K // ${Math.round(temperatureK - 273.15)}°C) · ${tr('solidMotionModel')}`;
        } else if (phase.key === 'liquid') {
          const range = Math.max(1, activeThermalProfile.boil - activeThermalProfile.melt);
          const liqScale = ((temperatureK - activeThermalProfile.melt) / range) * 0.8 + 0.4;
          const liqWobbleX = Math.sin(t * 3.5 + (a.basePos ? a.basePos.y : a.instIdx) * 0.4) * liqScale;
          const liqWobbleY = Math.cos(t * 4.2 + (a.basePos ? a.basePos.x : a.instIdx) * 0.4) * liqScale;
          const liqWobbleZ = Math.sin(t * 2.8 + (a.basePos ? a.basePos.z : a.instIdx) * 0.4) * liqScale;
          if (a.basePos) a.targetPos.copy(a.basePos).add(new THREE.Vector3(liqWobbleX, liqWobbleY, liqWobbleZ));
          if (a.velocity) {
            a.targetPos.addScaledVector(a.velocity, 0.02);
            a.velocity.multiplyScalar(0.985);
          }
          if (hudEpi && i === 0) hudEpi.textContent = `${phase.label} (${temperatureK} K // ${Math.round(temperatureK - 273.15)}°C) · ${tr('liquidMotionModel')}`;
        } else {
          const thermalVelocity = Math.sqrt(temperatureK / Math.max(1, activeThermalProfile.boil || 373.15)) * 2.2;
          if (!a.velocity || a.velocity.lengthSq() < 0.01) {
            a.velocity = new THREE.Vector3(
              (Math.random() - 0.5) * thermalVelocity,
              (Math.random() - 0.5) * thermalVelocity,
              (Math.random() - 0.5) * thermalVelocity
            );
          }
          a.targetPos.addScaledVector(a.velocity, 0.02 * thermalVelocity);
          const limit = 30.0;
          if (Math.abs(a.targetPos.x) > limit) { a.velocity.x *= -0.95; a.targetPos.x = Math.sign(a.targetPos.x) * limit; }
          if (Math.abs(a.targetPos.y) > limit) { a.velocity.y *= -0.95; a.targetPos.y = Math.sign(a.targetPos.y) * limit; }
          if (Math.abs(a.targetPos.z) > limit) { a.velocity.z *= -0.95; a.targetPos.z = Math.sign(a.targetPos.z) * limit; }
          if (hudEpi && i === 0) hudEpi.textContent = `${phase.label} (${temperatureK} K // ${Math.round(temperatureK - 273.15)}°C) · ${tr('gasMotionModel')}`;
        }
      }

      // Orbit motion for noble gas electrons
      if (a.isElectron && a.parent && fusionState === 'idle' && !a.removing) {
        const parentAtom = activeAtoms.find(other => other === a.parent);
        const parentPos = parentAtom ? parentAtom.currentPos : a.parent.pos;
        
        const angle = a.orbitAngle + t * a.orbitSpeed;
        const localPos = new THREE.Vector3(Math.cos(angle) * a.orbitR, 0, Math.sin(angle) * a.orbitR);
        localPos.applyAxisAngle(new THREE.Vector3(1, 0, 0), a.tiltX);
        localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), a.tiltY);
        a.targetPos.copy(parentPos).add(localPos);
      }

      // Lerp position and scale
      a.currentPos.lerp(a.targetPos, phaseMorphing ? 0.035 : 0.06);
      a.currentScale += (a.targetScale - a.currentScale) * 0.08;
      
      dummy.position.copy(a.currentPos);
      dummy.scale.setScalar(Math.max(0.001, a.currentScale));
      dummy.updateMatrix();
      
      if (a.instancedMesh) {
        a.instancedMesh.setMatrixAt(a.instIdx, dummy.matrix);
        instUpdateList.add(a.instancedMesh);
      }

      if (a.labelSprite) {
        a.labelSprite.position.copy(a.currentPos);
        a.labelSprite.position.y += a.currentScale * 1.15 + 0.4;
        a.labelSprite.scale.setScalar(Math.max(0.001, a.currentScale * 3.8));
      }

      // Remove fully shrunk atoms
      if (a.removing && a.currentScale < 0.05) {
        disposeLabelSprite(a.labelSprite);
        a.labelSprite = null;
        activeAtoms.splice(i, 1);
      }
    }

    instUpdateList.forEach(im => {
      im.instanceMatrix.needsUpdate = true;
    });

    // Update noble gas orbit ring positions
    activeOrbitLines.forEach(line => {
      const nucleus = activeAtoms.find(other => other.targetPos === line.userData.nucleusPos);
      if (nucleus) {
        line.position.copy(nucleus.currentPos);
      }
    });

    // Update bonds inside the single InstancedMesh
    if (activeBondInstancedMesh) {
      activeBonds.forEach(b => {
        if (b.removing) {
          for (let o = 0; o < b.order; o++) {
            dummy.position.set(0, 0, 0);
            dummy.scale.setScalar(0.001);
            dummy.updateMatrix();
            activeBondInstancedMesh.setMatrixAt(b.startIdx + o, dummy.matrix);
          }
          return;
        }

        const atomA = activeAtoms[b.aIdx];
        const atomB = activeAtoms[b.bIdx];
        
        if (atomA && atomB) {
          const start = atomA.currentPos;
          const end = atomB.currentPos;
          const dist = start.distanceTo(end);
          const center = start.clone().add(end).multiplyScalar(0.5);
          const dir = end.clone().sub(start).normalize();
          
          let ortho = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
          if (ortho.lengthSq() < 0.01) {
            ortho = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
          }

          const scaleA = atomA.currentScale;
          const scaleB = atomB.currentScale;
          const bondScale = Math.min(scaleA, scaleB) * 0.3;

          for (let idx = 0; idx < b.order; idx++) {
            let pos = center.clone();
            if (b.order === 2) {
              const offsetDir = ortho.clone().multiplyScalar((idx === 0 ? 0.35 : -0.35));
              pos.add(offsetDir);
            } else if (b.order === 3) {
              if (idx === 1) pos.add(ortho.clone().multiplyScalar(0.5));
              if (idx === 2) pos.add(ortho.clone().multiplyScalar(-0.5));
            }
            
            dummy.position.copy(pos);
            dummy.scale.set(bondScale, dist, bondScale);
            dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            dummy.updateMatrix();
            activeBondInstancedMesh.setMatrixAt(b.startIdx + idx, dummy.matrix);
          }
        } else {
          for (let o = 0; o < b.order; o++) {
            dummy.position.set(0, 0, 0);
            dummy.scale.setScalar(0.001);
            dummy.updateMatrix();
            activeBondInstancedMesh.setMatrixAt(b.startIdx + o, dummy.matrix);
          }
        }
      });
      activeBondInstancedMesh.instanceMatrix.needsUpdate = true;
    }

    // Camera shake effect
    if (camShakeTimer > 0) {
      const shakeStrength = Math.min(1, camShakeTimer / 0.42);
      camera.position.x = (Math.random() - 0.5) * shakeStrength * 3.5;
      camera.position.y = (Math.random() - 0.5) * shakeStrength * 3.5;
      camShakeTimer = Math.max(0, camShakeTimer - elapsedSeconds);
      if (camShakeTimer === 0) {
        camera.position.set(0, 0, 75);
      }
    }

    if (nuclearChargeField) {
      const chargeProgress = fusionState === 'charging' ? Math.max(0, fusionTimer / Math.max(0.001, fusionChargeDuration)) : 0;
      nuclearChargeField.children.forEach((ring, index) => {
        ring.rotation.x += (0.012 + index * 0.003) * elapsedSeconds * 60;
        ring.rotation.y -= (0.009 + index * 0.002) * elapsedSeconds * 60;
        ring.scale.setScalar(0.72 + chargeProgress * 0.5 + Math.sin(t * 5 + index) * 0.04);
        ring.material.opacity = fusionState === 'idle' ? ring.material.opacity * Math.pow(0.86, elapsedSeconds * 60) : 0.22 + (1 - chargeProgress) * 0.5;
      });
      if (fusionState === 'idle' && nuclearChargeField.children[0].material.opacity < 0.01) {
        scene.remove(nuclearChargeField);
        nuclearChargeField.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        nuclearChargeField = null;
      }
    }

    // Fusion state machine
    if (fusionState === 'charging') {
      fusionTimer = Math.max(0, fusionTimer - elapsedSeconds);
      const chargeProgress = 1 - fusionTimer / Math.max(0.001, fusionChargeDuration);
      const easedCharge = chargeProgress * chargeProgress * (3 - 2 * chargeProgress);
      activeAtoms.forEach(atom => {
        if (atom.nuclearCenter && atom.nuclearLocal) {
          atom.targetPos.copy(atom.nuclearLocal).addScaledVector(atom.nuclearCenter, 1 - easedCharge);
        } else if (activeCollisionMode === 'chemical') {
          if (!atom.collisionStartPos) atom.collisionStartPos = atom.targetPos.clone();
          const start = atom.collisionStartPos;
          const tangent = new THREE.Vector3(-start.y, start.x, start.z * 0.12);
          if (tangent.lengthSq() > 0.001) tangent.normalize();
          const handedness = (atom.z + Math.round(start.x)) % 2 === 0 ? 1 : -1;
          const spiralEnvelope = Math.sin(Math.PI * chargeProgress) * 2.8 * handedness;
          atom.targetPos.copy(start).multiplyScalar(1 - easedCharge).addScaledVector(tangent, spiralEnvelope);
        }
      });
      if (fusionTimer <= 0) {
        fusionState = 'colliding';
        fusionTimer = 0.36;
        activeAtoms.forEach(a => {
          if (activeCollisionMode === 'fusion' && a.nuclearLocal) {
            a.targetPos.copy(a.nuclearLocal).multiplyScalar(0.32);
          } else if (activeCollisionMode === 'fission' && a.nuclearLocal) {
            const isIncidentNeutron = Math.abs(a.nuclearCenter?.x || 0) > 10;
            if (isIncidentNeutron) a.targetPos.set(0, 0, 0);
            else a.targetPos.set(a.nuclearLocal.x * 1.8, a.nuclearLocal.y * 0.68, a.nuclearLocal.z * 0.68);
          } else {
            a.targetPos.set(0, 0, 0);
          }
        });
      }
    } else if (fusionState === 'colliding') {
      fusionTimer = Math.max(0, fusionTimer - elapsedSeconds);
      if (fusionTimer <= 0) {
        fusionState = 'idle';
        
        const isFiss = activeCollisionMode === 'fission';
        const isNuclearFusion = activeCollisionMode === 'fusion';
        const col1 = isFiss ? 0xFF3300 : isNuclearFusion ? 0x00F0FF : EL[fusionReactantA].col;
        const col2 = isFiss ? 0xFFCC00 : isNuclearFusion ? 0xBF00FF : EL[fusionReactantB].col;
        
        createExplosion(new THREE.Vector3(0,0,0), col1, col2);
        camShakeTimer = prefersReducedMotion?.matches ? 0 : 0.42;
        
        if (fusionTargetReaction) {
          if (fusionTargetReaction.isNuclear) {
            formNuclearProducts(fusionTargetReaction);
          } else if (fusionTargetReaction.isInert) {
            formInertMixture(fusionTargetReaction.zA, fusionTargetReaction.zB);
          } else {
            formCompound(fusionTargetReaction);
          }
        } else {
          activeAtoms.forEach(a => { a.targetScale = 0.0; a.removing = true; });
          activeBonds.forEach(b => { b.removing = true; });
          updateTelemetry(
            `No Stable Reaction: ${EL[fusionReactantA].s} + ${EL[fusionReactantB].s}`,
            `${EL[fusionReactantA].s} + ${EL[fusionReactantB].s} collided at high kinetic energy`,
            'Chemical collision: DISSOCIATED',
            'No standard stable bond arrangement formed',
            'Try elements with stable reaction paths in the periodic table!'
          );
        }
      }
    }

    // Animate shockwave expansion rings & core flash
    if (shockwaveOpacity > 0.01) {
      shockwaveScale += (activeCollisionMode === 'chemical' ? 5.5 : 9.0) * elapsedSeconds;
      shockwaveOpacity *= Math.exp(-5.2 * elapsedSeconds);

      if (shockwaveRing) {
        shockwaveRing.scale.set(shockwaveScale, shockwaveScale, shockwaveScale);
        shockwaveRing.material.opacity = shockwaveOpacity;
      }
      if (shockwaveRing2) {
        shockwaveRing2.scale.set(shockwaveScale * 0.8, shockwaveScale * 0.8, shockwaveScale * 0.8);
        shockwaveRing2.material.opacity = shockwaveOpacity * 0.85;
      }
      if (fusionFlashSphere) {
        const flashScale = 1.0 + (1.0 - shockwaveOpacity) * 3.5;
        fusionFlashSphere.scale.set(flashScale, flashScale, flashScale);
        fusionFlashSphere.material.opacity = shockwaveOpacity * 0.9;
      }
      if (fusionFlashLight) fusionFlashLight.intensity = shockwaveOpacity * (activeCollisionMode === 'chemical' ? 5 : 12);

      if (shockwaveOpacity <= 0.01) {
        if (shockwaveRing) { scene.remove(shockwaveRing); shockwaveRing.geometry.dispose(); shockwaveRing.material.dispose(); shockwaveRing = null; }
        if (shockwaveRing2) { scene.remove(shockwaveRing2); shockwaveRing2.geometry.dispose(); shockwaveRing2.material.dispose(); shockwaveRing2 = null; }
        if (fusionFlashSphere) { scene.remove(fusionFlashSphere); fusionFlashSphere.geometry.dispose(); fusionFlashSphere.material.dispose(); fusionFlashSphere = null; }
        if (fusionFlashLight) { scene.remove(fusionFlashLight); fusionFlashLight.dispose?.(); fusionFlashLight = null; }
      }
    }

    // Animate explosion particles
    if (explosionParticles && explosionTimer > 0) {
      const positions = explosionParticles.geometry.attributes.position.array;
      for (let i = 0; i < explosionVelocities.length; i++) {
        const vel = explosionVelocities[i];
        positions[i * 3] += vel.x * elapsedSeconds;
        positions[i * 3 + 1] += vel.y * elapsedSeconds;
        positions[i * 3 + 2] += vel.z * elapsedSeconds;
        vel.multiplyScalar(Math.exp(-3.1 * elapsedSeconds));
      }
      explosionParticles.geometry.attributes.position.needsUpdate = true;
      explosionParticles.material.opacity = Math.min(1, explosionTimer / 0.75);
      explosionTimer = Math.max(0, explosionTimer - elapsedSeconds);
      
      if (explosionTimer <= 0) {
        scene.remove(explosionParticles);
        explosionParticles.geometry.dispose();
        explosionParticles.material.dispose();
        explosionParticles = null;
      }
    }

    // Selection ring follows selected atom
    if (selectRing.visible && selectedAtomObj && !selectedAtomObj.removing) {
      selectRing.position.copy(selectedAtomObj.currentPos);
      selectRing.rotation.x = t * 3.0;
      selectRing.rotation.y = t * 3.5;
    }

    curRotX += (targetRotX - curRotX) * 0.08;
    curRotY += (targetRotY - curRotY) * 0.08;
    if (camera) camera.position.z += (targetCamZ - camera.position.z) * 0.1;

    moleculeGroup.rotation.x = curRotX;
    moleculeGroup.rotation.y = curRotY + t * 0.3;

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  } catch (renderErr) {
    console.warn('Fail-Safe Render Guard caught exception:', renderErr);
  }
}

  // URL Query Parameters Auto-Loader (e.g. ?z=79 or ?fuse=C+F)
  if (paramZ && parseInt(paramZ) >= 1 && parseInt(paramZ) <= 118) {
    formElement(parseInt(paramZ));
  } else if (paramFuse && paramFuse.includes('+')) {
    const parts = paramFuse.split('+');
    const zA = Object.keys(EL).find(k => EL[k].s === parts[0]);
    const zB = Object.keys(EL).find(k => EL[k].s === parts[1]);
    if (zA && zB) {
      const key1 = parts[0] + '+' + parts[1];
      const key2 = parts[1] + '+' + parts[0];
      const reaction = REACTIONS[key1] || REACTIONS[key2];
      triggerFusionCollision(parseInt(zA), parseInt(zB), reaction);
    } else {
      buildDNA();
    }
  } else {
    buildDNA();
  }

  window.NULLA_DIAGNOSTICS = Object.freeze({
    snapshot:getDiagnosticsSnapshot
  });

  requestAnimationFrame(animate);
});
