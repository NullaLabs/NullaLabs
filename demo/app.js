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
  const btnExportCif = document.getElementById('btn-export-cif');
  const btnAudio = document.getElementById('btn-audio');
  const btnExport = document.getElementById('btn-export');
  const btnSuggest = document.getElementById('btn-suggest');

  const ptHudPanel = document.getElementById('pt-hud-panel');
  let activeDialog = null;
  let lastDialogFocus = null;
  const dialogBackgroundState = new Map();

  function setDialogBackgroundInert(dialog, inert) {
    for (const element of document.body.children) {
      if (element === dialog || element.tagName === 'SCRIPT' || element.id === 'nulla-minimized-dock') continue;
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

  // Hill-notation empirical formula (C, H first, then alphabetical) with Unicode subscripts
  const SUBSCRIPT_DIGITS = ['\u2080','\u2081','\u2082','\u2083','\u2084','\u2085','\u2086','\u2087','\u2088','\u2089'];
  function hillFormula(atoms) {
    const counts = new Map();
    for (const a of atoms) {
      const sym = a.symbol || a.s || a.elData?.s;
      if (!sym) continue;
      counts.set(sym, (counts.get(sym) || 0) + 1);
    }
    if (!counts.size) return '—';
    const keys = [...counts.keys()];
    const hasC = counts.has('C');
    keys.sort((x, y) => {
      if (hasC) {
        if (x === 'C') return -1; if (y === 'C') return 1;
        if (x === 'H') return -1; if (y === 'H') return 1;
      }
      return x.localeCompare(y);
    });
    return keys.map(k => {
      const n = counts.get(k);
      return n === 1 ? k : k + String(n).replace(/\d/g, d => SUBSCRIPT_DIGITS[d]);
    }).join('');
  }

  // Renders at most `limit` rows and appends a single overflow summary row
  const MAX_LIST_ROWS = 60;
  function appendOverflowRow(container, hidden) {
    if (hidden <= 0) return;
    const more = document.createElement('div');
    more.style.cssText = 'padding:3px 6px; color:rgba(255,255,255,0.55); font-size:7.5px; text-align:center;';
    more.textContent = `+${hidden} …`;
    container.appendChild(more);
  }

  function openDialog(dialog, trigger = null) {
    if (!dialog) return;
    if (activeDialog !== dialog) lastDialogFocus = trigger || document.activeElement;
    activeDialog = dialog;
    dialog.style.display = 'block';
    if (typeof window !== 'undefined' && window.NULLA_WINDOW_MANAGER) {
      window.NULLA_WINDOW_MANAGER.restoreWindow(dialog.id);
    }
    setDialogBackgroundInert(dialog,true);
    const focusTarget = dialog.querySelector('button, [href], select, input, [tabindex]:not([tabindex="-1"])');
    if (focusTarget) focusTarget.focus({preventScroll:true});
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    dialog.style.display = 'none';
    if (typeof window !== 'undefined' && window.NULLA_WINDOW_MANAGER) {
      window.NULLA_WINDOW_MANAGER.removeDockTab(dialog.id);
    }
    setDialogBackgroundInert(dialog,false);
    if (activeDialog === dialog) activeDialog = null;
    if (lastDialogFocus && typeof lastDialogFocus.focus === 'function') lastDialogFocus.focus({preventScroll:true});
  }

  // Window manager: a minimized window must release the page; restoring re-isolates it
  document.addEventListener('nulla:window-minimized', event => {
    const dialog = event.detail?.modal;
    if (!dialog) return;
    setDialogBackgroundInert(dialog,false);
    if (activeDialog === dialog) activeDialog = null;
    if (lastDialogFocus && typeof lastDialogFocus.focus === 'function') lastDialogFocus.focus({preventScroll:true});
  });
  document.addEventListener('nulla:window-restored', event => {
    const dialog = event.detail?.modal;
    if (!dialog) return;
    activeDialog = dialog;
    setDialogBackgroundInert(dialog,true);
  });

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
    document.getElementById('slot-2'),
    document.getElementById('slot-3')
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
  const MOLECULAR_SPECIES = window.NULLA_MOLECULAR_SPECIES || {};
  const MOLECULAR_REACTIONS = {};
  Object.entries(window.NULLA_MOLECULAR_REACTIONS || {}).forEach(([key, reaction]) => {
    MOLECULAR_REACTIONS[canonicalReactionKey(key.split('+'))] = {
      evidenceLevel:'CATALOGUED',
      isMolecularReaction:true,
      ...reaction
    };
  });
  const REACTIONS = {};
  Object.entries({...REACTION_LIBRARY, ...(window.NULLA_VERIFIED_REACTIONS || {}), ...MOLECULAR_REACTIONS}).forEach(([key, reaction]) => {
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

  // Studio Lighting (3-Point with Quantum Specular Accent)
  scene.add(new THREE.DirectionalLight(0x00F0FF, 2.0).translateX(50).translateY(60).translateZ(50));
  const rimLight = new THREE.DirectionalLight(0x8A2BE2, 1.4);
  rimLight.position.set(-50, -40, -30);
  scene.add(rimLight);
  const fillLight = new THREE.PointLight(0x00FF88, 0.75, 160);
  fillLight.position.set(0, 35, 45);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(0xFFFFFF, 0.75));

  // Quantum Nebula Particle Field (Depth & Cinematic Space)
  const nebulaCount = 450;
  const nebulaGeo = new THREE.BufferGeometry();
  const nebulaPos = new Float32Array(nebulaCount * 3);
  const nebulaCols = new Float32Array(nebulaCount * 3);
  const nebulaPalette = [
    new THREE.Color(0x00F0FF),
    new THREE.Color(0xBF00FF),
    new THREE.Color(0x00FF88),
    new THREE.Color(0x4361EE),
    new THREE.Color(0xFFD700)
  ];
  for (let i = 0; i < nebulaCount; i++) {
    const r = 90 + Math.random() * 140;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    nebulaPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    nebulaPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    nebulaPos[i * 3 + 2] = r * Math.cos(phi);
    const col = nebulaPalette[Math.floor(Math.random() * nebulaPalette.length)];
    nebulaCols[i * 3] = col.r;
    nebulaCols[i * 3 + 1] = col.g;
    nebulaCols[i * 3 + 2] = col.b;
  }
  nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPos, 3));
  nebulaGeo.setAttribute('color', new THREE.BufferAttribute(nebulaCols, 3));
  const nebulaMat = new THREE.PointsMaterial({
    size: 1.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const quantumNebula = new THREE.Points(nebulaGeo, nebulaMat);
  scene.add(quantumNebula);

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
  let activeReactionRef = null;
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
  // ATOMIC ORBITAL DENSITY CLOUD GENERATOR (Spherical Harmonics Y_l^m & ±ψ Phase)
  // ═══════════════════════════════════════════════════════════════
  let orbitalParticleSystem = null;
  let orbitalCycleIndex = 0;
  let molecularHOMOLUMOSystem = null;
  let molecularMEPSystem = null;
  let molecularDipoleArrow = null;

  function generateAtomicOrbitalCloud(z) {
    if (orbitalParticleSystem) {
      moleculeGroup.remove(orbitalParticleSystem);
      orbitalParticleSystem.geometry.dispose();
      orbitalParticleSystem.material.dispose();
      orbitalParticleSystem = null;
    }

    const count = 4200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const el = EL[z] || EL[1];
    const posPhaseColor = new THREE.Color(0x00F0FF); // +ψ wavefunction lobe (Electric Cyan)
    const negPhaseColor = new THREE.Color(0xFF007F); // -ψ wavefunction lobe (Quantum Magenta)
    const nodeGlowColor = new THREE.Color(0xFFD700); // Nodal boundary accent

    // Determine quantum orbital symmetry (n, l, m_l) from atomic number Z + interactive cycle
    let orbitalLabel = '1s · Y₀⁰ (l=0, m=0)';
    let mode = '1s';
    if (z <= 2) {
      mode = orbitalCycleIndex % 2 === 0 ? '1s' : '2s';
      orbitalLabel = mode === '1s' ? '1s · Y₀⁰ (l=0, m=0 · Simetría Esférica)' : '2s · Y₀⁰ (Nodo Radial r=r₀ · ±ψ)';
    } else if (z <= 10 || (z >= 13 && z <= 18)) {
      mode = orbitalCycleIndex % 2 === 0 ? '2pz' : '2px';
      orbitalLabel = mode === '2pz' ? '2p_z · Y₁⁰ ∝ cos(θ) (Plano Nodal z=0 · ±ψ)' : '2p_x · Y₁±¹ ∝ sin(θ)cos(φ) (±ψ)';
    } else if (z >= 57 && z <= 71 || z >= 89) {
      mode = '4fxyz';
      orbitalLabel = '4f_xyz · Y₃±² ∝ sin²(θ)cos(θ)sin(2φ) (8 Octantes ±ψ)';
    } else {
      mode = orbitalCycleIndex % 2 === 0 ? '3dx2y2' : '3dz2';
      orbitalLabel = mode === '3dx2y2'
        ? '3d_(x²-y²) · Y₂±² ∝ sin²(θ)cos(2φ) (4 Lóbulos ±ψ)'
        : '3d_z² · Y₂⁰ ∝ (3cos²θ - 1) (Lóbulos Polares +ψ / Toro Ecuatorial -ψ)';
    }
    orbitalCycleIndex++;

    let accepted = 0;
    let attempts = 0;
    while (accepted < count && attempts < count * 18) {
      attempts++;
      const u = Math.random();
      const v = Math.random();
      const phi = u * 2.0 * Math.PI;
      const cosTheta = 2.0 * v - 1.0;
      const sinTheta = Math.sqrt(Math.max(0, 1.0 - cosTheta * cosTheta));
      const r = Math.pow(Math.random(), 0.72) * 18.0;

      let psi = 1.0;
      if (mode === '1s') {
        psi = Math.exp(-r / 5.5);
      } else if (mode === '2s') {
        psi = (1.0 - r / 6.5) * Math.exp(-r / 6.5);
      } else if (mode === '2pz') {
        psi = (r / 5.0) * Math.exp(-r / 5.8) * cosTheta;
      } else if (mode === '2px') {
        psi = (r / 5.0) * Math.exp(-r / 5.8) * sinTheta * Math.cos(phi);
      } else if (mode === '3dz2') {
        psi = (r * r / 28.0) * Math.exp(-r / 5.2) * (3.0 * cosTheta * cosTheta - 1.0) * 0.65;
      } else if (mode === '3dx2y2') {
        psi = (r * r / 26.0) * Math.exp(-r / 5.2) * (sinTheta * sinTheta * Math.cos(2.0 * phi));
      } else {
        // 4f_xyz octupolar
        psi = (r * r * r / 120.0) * Math.exp(-r / 4.8) * (sinTheta * sinTheta * cosTheta * Math.sin(2.0 * phi)) * 1.6;
      }

      const prob = psi * psi;
      if (Math.random() > Math.min(1.0, prob * 3.2)) continue;

      const x = r * sinTheta * Math.cos(phi);
      const y = r * cosTheta;
      const zPos = r * sinTheta * Math.sin(phi);

      positions[accepted * 3] = x;
      positions[accepted * 3 + 1] = y;
      positions[accepted * 3 + 2] = zPos;

      const phaseColor = Math.abs(psi) < 0.04
        ? nodeGlowColor
        : (psi >= 0 ? posPhaseColor : negPhaseColor);
      colors[accepted * 3] = phaseColor.r;
      colors[accepted * 3 + 1] = phaseColor.g;
      colors[accepted * 3 + 2] = phaseColor.b;
      accepted++;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.88,
      vertexColors: true,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    orbitalParticleSystem = new THREE.Points(geometry, material);
    moleculeGroup.add(orbitalParticleSystem);

    updateTelemetry(
      `${el.s} · ORBITAL MOTIF · ${tr('referenceModel')}`,
      `Armónico Esférico: ${orbitalLabel} · N=${count}`,
      `CONFIG: ${el.sh} · Paridad de Fase: +ψ (Cian) / -ψ (Magenta)`,
      `|ψ(r,θ,φ)|² Monte Carlo Sampling`,
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

  let activeVisualMode = 'BALL_STICK';
  let activeVisualOverlays = [];

  function clearVisualOverlays() {
    activeVisualOverlays.forEach(obj => {
      moleculeGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    activeVisualOverlays = [];
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
    if (molecularHOMOLUMOSystem) {
      moleculeGroup.remove(molecularHOMOLUMOSystem);
      molecularHOMOLUMOSystem.geometry.dispose();
      molecularHOMOLUMOSystem.material.dispose();
      molecularHOMOLUMOSystem = null;
    }
    if (molecularMEPSystem) {
      moleculeGroup.remove(molecularMEPSystem);
      molecularMEPSystem.geometry.dispose();
      molecularMEPSystem.material.dispose();
      molecularMEPSystem = null;
    }
    if (molecularDipoleArrow) {
      moleculeGroup.remove(molecularDipoleArrow);
      molecularDipoleArrow = null;
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
      clearVisualOverlays();
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
            baseScale: scale,
            z: item.z,
            mass: item.mass || item.physicalMass || null,
            physicalMass: item.mass || item.physicalMass || null,
            isotopeName: item.isotopeName || null,
            col: grp.col,
            baseCol: grp.col,
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
        if (activeVisualMode !== 'BALL_STICK') {
          applyVisualRepresentationMode(false);
        }
      }

      if (atomCountEl) atomCountEl.textContent = formatParticleCount(activeAtoms.length);
    };

    if (spawnDelay === 0) {
      doSpawn();
    } else {
      setTimeout(doSpawn, spawnDelay);
    }
  }

  // Spawn chemical bonds using a single InstancedMesh with Pauling Δχ & bond-order color coding
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

    const tmpColor = new THREE.Color();
    let instIdx = 0;
    bondPairs.forEach(bp => {
      let order = bp.order || 1;
      let deltaEN = 0;
      if (!isDnaMode && activeAtoms[bp.a] && activeAtoms[bp.b]) {
        const zA = activeAtoms[bp.a].z;
        const zB = activeAtoms[bp.b].z;
        const elA = EL[zA] || EL[1];
        const elB = EL[zB] || EL[1];
        deltaEN = Math.abs((elA.electronegativity || 2.0) - (elB.electronegativity || 2.0));
        if (!bp.order) {
          const symA = elA.s;
          const symB = elB.s;
          if ((symA === 'O' && symB === 'O') || (symA === 'C' && symB === 'O') || (symA === 'O' && symB === 'C')) {
            order = 2;
          } else if (symA === 'N' && symB === 'N') {
            order = 3;
          }
        }
      }
      let bondHex = 0xE2EEFF;
      if (!isDnaMode) {
        if (order === 3) bondHex = 0xE066FF;
        else if (order === 2) bondHex = 0x00FFCC;
        else if (deltaEN >= 1.7) bondHex = 0xFFD166;
        else if (deltaEN >= 0.5) bondHex = 0x55E6FF;
      }
      tmpColor.setHex(bondHex);
      for (let c = 0; c < order; c++) {
        bondInstMesh.setColorAt(instIdx + c, tmpColor);
      }
      activeBonds.push({
        aIdx: bp.a,
        bIdx: bp.b,
        order,
        deltaEN,
        startIdx: instIdx,
        removing: false
      });
      instIdx += order;
    });
    if (bondInstMesh.instanceColor) {
      bondInstMesh.instanceColor.needsUpdate = true;
    }
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

  let activeStageableSpecies = null;
  const MATERIAL_TO_SPECIES_ID = {
    nacl:'NaCl',
    diamond:'Diamond',
    c60:'C60',
    graphene:'Graphene',
    nanotube:'SWCNT',
    solvation:'H2O'
  };

  // Shared material activation preserves one rendering path for all structures.
  function activateMaterial(id, atoms, profile, telemetry, scale, bondCutoff, explicitBonds = null) {
    isDnaMode = false;
    activeCollisionMode = 'chemical';
    activeStructureId = id;
    activeStageableSpecies = MATERIAL_TO_SPECIES_ID[id] || null;
    activeThermalProfile = profile;
    angstromPerWorldUnit = scale;
    measurementScaleVerified = Number.isFinite(scale) && scale > 0;
    setThermalControlEnabled(true);
    activeBondCutoffWorld = bondCutoff || null;
    selectedMeasureAtoms = [];
    spawnAtoms(atoms, explicitBonds);
    const reportedEnthalpy = telemetry.enthalpy == null
      ? tr('dataUnavailable')
      : typeof telemetry.enthalpy === 'number'
        ? `${telemetry.enthalpy} kJ/mol`
        : telemetry.enthalpy;
    const reportedDipole = telemetry.dipole == null
      ? tr('dataUnavailable')
      : typeof telemetry.dipole === 'number'
        ? `${telemetry.dipole} Debye (${telemetry.dipole > 0 ? 'POLAR' : 'NON-POLAR'})`
        : telemetry.dipole;
    const reportedStability = telemetry.stability == null
      ? tr('dataUnavailable')
      : typeof telemetry.stability === 'number'
        ? `${telemetry.stability}% · ${id === 'diamond' || id === 'c60' ? 'METAESTABLE' : 'ESTABLE'}`
        : telemetry.stability;
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
    activeReactionRef = reaction;
    const hasNaclReference = reaction.formula === 'NaCl';
    const hasCalibratedThermal = hasNaclReference || window.NULLA_THERMODYNAMICS?.hasUsablePhaseProfile?.(reaction) || (Number.isFinite(reaction.melt) && Number.isFinite(reaction.boil) && reaction.boil > reaction.melt);
    activeThermalProfile = hasCalibratedThermal
      ? {
          label: reaction.formula,
          melt: hasNaclReference ? 1074 : reaction.melt,
          boil: hasNaclReference ? 1738 : reaction.boil,
          transition: reaction.transition || 'melting',
          pressure: reaction.pressure || '1 atm',
          model: 'catalogued reference'
        }
      : { label:reaction.formula, melt:null, boil:null, pressure:reaction.pressure || '1 atm', model:'data unavailable' };
    measurementScaleVerified = false;
    setThermalControlEnabled(Boolean(hasCalibratedThermal));
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
    else if (name === 'Carbon Nanobud Heterostructure') {
      // Graphene hexagonal sheet at z = -5.5 covalently grafted to a C60 fullerene cage at z = +3.5
      const bond = 3.8;
      for (let row = -2; row <= 2; row++) {
        for (let col = -2; col <= 2; col++) {
          const x = Math.sqrt(3) * bond * (col + row * 0.5);
          const y = 1.5 * bond * row;
          atoms.push({ z: 6, pos: new THREE.Vector3(x, y, -5.5), scale: 1.35, noLabel: true });
          atoms.push({ z: 6, pos: new THREE.Vector3(x, y + bond, -5.5), scale: 1.35, noLabel: true });
        }
      }
      const verts = icosahedronVertices();
      verts.forEach(v => {
        atoms.push({ z: 6, pos: v.clone().normalize().multiplyScalar(5.8).add(new THREE.Vector3(0, 0, 2.2)), scale: 1.35 });
      });
    }
    else if (name === 'Carbon Nanopeapod (Endohedral SWCNT)') {
      // Outer SWCNT cylinder encapsulating two C60 cages at x = -7.5 and x = +7.5
      const nRing = 10;
      const radius = 7.8;
      for (let slice = -3; slice <= 3; slice++) {
        const x = slice * 4.2;
        for (let k = 0; k < nRing; k++) {
          const angle = (k / nRing) * Math.PI * 2 + (slice % 2) * (Math.PI / nRing);
          atoms.push({ z: 6, pos: new THREE.Vector3(x, Math.cos(angle) * radius, Math.sin(angle) * radius), scale: 1.15, noLabel: true });
        }
      }
      const verts = icosahedronVertices();
      [-6.5, 6.5].forEach(cx => {
        verts.forEach(v => {
          atoms.push({ z: 6, pos: v.clone().normalize().multiplyScalar(3.6).add(new THREE.Vector3(cx, 0, 0)), scale: 1.25 });
        });
      });
    }
    else if (name === 'Graphene / h-BN Moiré Heterostructure') {
      // Bottom h-BN sheet (B=5, N=7) at z = -3.8 and rotated Graphene sheet (C=6) at z = +3.8
      const r = 4.6;
      for (let ring = 1; ring <= 2; ring++) {
        const count = ring * 6;
        const rad = ring * r;
        for (let i = 0; i < count; i++) {
          const theta = (i / count) * Math.PI * 2;
          atoms.push({ z: i % 2 === 0 ? 5 : 7, pos: new THREE.Vector3(rad * Math.cos(theta), rad * Math.sin(theta), -3.8), scale: 1.45 });
          const thetaRot = theta + 0.12;
          atoms.push({ z: 6, pos: new THREE.Vector3(rad * Math.cos(thetaRot), rad * Math.sin(thetaRot), 3.8), scale: 1.45 });
        }
      }
      atoms.push({ z: 5, pos: new THREE.Vector3(0, 0, -3.8), scale: 1.5 });
      atoms.push({ z: 6, pos: new THREE.Vector3(0, 0, 3.8), scale: 1.5 });
    }
    else if (name === '3D Pillared Graphene–SWCNT Network') {
      // Top and bottom graphene sheets at y = +-8 connected by a vertical CNT pillar
      const r = 5.2;
      [-8.0, 8.0].forEach(py => {
        atoms.push({ z: 6, pos: new THREE.Vector3(0, py, 0), scale: 1.4 });
        for (let i = 0; i < 12; i++) {
          const rad = i < 6 ? r : r * 1.85;
          const theta = ((i % 6) / 6) * Math.PI * 2 + (i >= 6 ? Math.PI / 6 : 0);
          atoms.push({ z: 6, pos: new THREE.Vector3(rad * Math.cos(theta), py, rad * Math.sin(theta)), scale: 1.35 });
        }
      });
      for (let level = -1; level <= 1; level++) {
        const py = level * 4.0;
        for (let i = 0; i < 6; i++) {
          const theta = (i / 6) * Math.PI * 2;
          atoms.push({ z: 6, pos: new THREE.Vector3(3.4 * Math.cos(theta), py, 3.4 * Math.sin(theta)), scale: 1.35 });
        }
      }
    }
    else if (name === 'Diamond–SiC Superhard Composite') {
      // Core sp3 diamond lattice surrounded by epitaxial SiC shell
      const d = 4.6;
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          for (let iz = -1; iz <= 1; iz++) {
            const isCore = Math.abs(ix) + Math.abs(iy) + Math.abs(iz) <= 1;
            const zAtom = isCore ? 6 : ((ix + iy + iz) % 2 === 0 ? 14 : 6);
            atoms.push({ z: zAtom, pos: new THREE.Vector3(ix * d, iy * d, iz * d), scale: zAtom === 14 ? 1.7 : 1.45 });
          }
        }
      }
    }
    else if (['Barium Titanate Perovskite', 'Strontium Titanate Perovskite', 'YBCO High-Tc Superconductor'].includes(name)) {
      // ABO3 Perovskite unit cell: A-site corners, B-site body center, O6 face centers
      const zA = reaction.atoms.find(g => [56, 38, 39].includes(g.z))?.z || reaction.atoms[0].z;
      const zB = reaction.atoms.find(g => [22, 29].includes(g.z))?.z || 22;
      const d = 6.8;
      for (let dx of [-d, d]) {
        for (let dy of [-d, d]) {
          for (let dz of [-d, d]) {
            atoms.push({ z: zA, pos: new THREE.Vector3(dx, dy, dz), scale: 1.85 });
          }
        }
      }
      atoms.push({ z: zB, pos: new THREE.Vector3(0, 0, 0), scale: 1.75 });
      [
        new THREE.Vector3(d, 0, 0), new THREE.Vector3(-d, 0, 0),
        new THREE.Vector3(0, d, 0), new THREE.Vector3(0, -d, 0),
        new THREE.Vector3(0, 0, d), new THREE.Vector3(0, 0, -d)
      ].forEach(p => atoms.push({ z: 8, pos: p, scale: 1.4 }));
    }
    else if (name === 'Titanium Aluminium Carbide (MAX Phase)') {
      // Layered Ti3AlC2 MAX phase nanolaminate: Ti-C-Ti-C-Ti slabs interleaved with Al plane
      const r = 5.4;
      const layers = [
        { z: 22, h: -7.5 },
        { z: 6,  h: -5.0 },
        { z: 22, h: -2.5 },
        { z: 13, h:  0.0 },
        { z: 22, h:  2.5 },
        { z: 6,  h:  5.0 },
        { z: 22, h:  7.5 }
      ];
      layers.forEach((layer, idx) => {
        atoms.push({ z: layer.z, pos: new THREE.Vector3(0, layer.h, 0), scale: layer.z === 6 ? 1.35 : 1.65 });
        for (let i = 0; i < 6; i++) {
          const theta = (i / 6) * Math.PI * 2 + (idx % 2) * (Math.PI / 6);
          atoms.push({ z: layer.z, pos: new THREE.Vector3(r * Math.cos(theta), layer.h, r * Math.sin(theta)), scale: layer.z === 6 ? 1.35 : 1.6 });
        }
      });
    }
    else if (['Molybdenum Disulfide (2D TMD)', 'Tungsten Disulfide (2D TMD)', 'Boron Nitride', 'Titanium Diboride', 'Lithium Cobalt Oxide', 'Bismuth Telluride'].includes(name)) {
      // Hexagonal layered 2D / van der Waals / AlB2 sandwich crystal
      const zA = reaction.atoms[0].z;
      const zB = reaction.atoms[1]?.z || zA;
      const r = 5.2;
      [-3.4, 0, 3.4].forEach((h, layerIdx) => {
        const zLayer = layerIdx === 1 ? zA : zB;
        atoms.push({ z: zLayer, pos: new THREE.Vector3(0, 0, h), scale: layerIdx === 1 ? 1.75 : 1.45 });
        for (let i = 0; i < 6; i++) {
          const theta = (i / 6) * Math.PI * 2 + (layerIdx === 1 ? 0 : Math.PI / 6);
          atoms.push({ z: zLayer, pos: new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), h), scale: layerIdx === 1 ? 1.7 : 1.45 });
        }
      });
    }
    else if (name === 'Boron Carbide') {
      // B12 icosahedron + linear C-B-C chain
      const verts = icosahedronVertices();
      verts.forEach(v => atoms.push({ z: 5, pos: v.clone().normalize().multiplyScalar(5.6), scale: 1.55 }));
      atoms.push({ z: 6, pos: new THREE.Vector3(-8.5, 0, 0), scale: 1.5 });
      atoms.push({ z: 5, pos: new THREE.Vector3(0, 0, 0), scale: 1.5 });
      atoms.push({ z: 6, pos: new THREE.Vector3(8.5, 0, 0), scale: 1.5 });
    }
    else if (['Carbonic Acid', 'Sulfurous Acid', 'Calcium Carbonate', 'Calcium Silicate (Wollastonite)'].includes(name)) {
      // Oxoacid / Oxosalt trigonal-planar or tetrahedral core with outer cations/hydrogens
      const zCenter = reaction.atoms.find(g => [6, 14, 16].includes(g.z))?.z || 6;
      const zOuter = reaction.atoms.find(g => [1, 20].includes(g.z))?.z || 1;
      atoms.push({ z: zCenter, pos: new THREE.Vector3(0, 0, 0), scale: 1.7 });
      for (let i = 0; i < 3; i++) {
        const theta = (i / 3) * Math.PI * 2;
        atoms.push({ z: 8, pos: new THREE.Vector3(4.6 * Math.cos(theta), 4.6 * Math.sin(theta), 0), scale: 1.5 });
      }
      if (zOuter === 20) {
        atoms.push({ z: 20, pos: new THREE.Vector3(0, 0, 5.2), scale: 1.85 });
      } else {
        atoms.push({ z: 1, pos: new THREE.Vector3(-6.2, 3.2, 1.2), scale: 1.25 });
        atoms.push({ z: 1, pos: new THREE.Vector3(6.2, 3.2, -1.2), scale: 1.25 });
      }
    }
    else if (name === 'Ammonium Chloride') {
      // Tetrahedral NH4+ + Cl- ion pair
      atoms.push({ z: 7, pos: new THREE.Vector3(-3.0, 0, 0), scale: 1.7 });
      const d = 3.2;
      [
        new THREE.Vector3(-3.0 + d, d, d),
        new THREE.Vector3(-3.0 - d, -d, d),
        new THREE.Vector3(-3.0 - d, d, -d),
        new THREE.Vector3(-3.0 + d, -d, -d)
      ].forEach(p => atoms.push({ z: 1, pos: p, scale: 1.25 }));
      atoms.push({ z: 17, pos: new THREE.Vector3(5.2, 0, 0), scale: 1.85 });
    }
    else if (name === 'Calcium Hydroxide') {
      // Layered brucite-type Ca(OH)2
      atoms.push({ z: 20, pos: new THREE.Vector3(0, 0, 0), scale: 1.85 });
      atoms.push({ z: 8, pos: new THREE.Vector3(-4.6, 0, 0), scale: 1.5 });
      atoms.push({ z: 8, pos: new THREE.Vector3(4.6, 0, 0), scale: 1.5 });
      atoms.push({ z: 1, pos: new THREE.Vector3(-7.4, 1.4, 0), scale: 1.2 });
      atoms.push({ z: 1, pos: new THREE.Vector3(7.4, -1.4, 0), scale: 1.2 });
    }
    else if (name === 'Hydrated Sodium Chloride Ion Pair') {
      // [Na(H2O)6]+ octahedral aqua complex + Cl- counterion
      atoms.push({ z: 11, pos: new THREE.Vector3(-3.2, 0, 0), scale: 1.75 });
      atoms.push({ z: 17, pos: new THREE.Vector3(7.8, 0, 0), scale: 1.85 });
      const oct = [
        new THREE.Vector3(5.2, 0, 0), new THREE.Vector3(-5.2, 0, 0),
        new THREE.Vector3(0, 5.2, 0), new THREE.Vector3(0, -5.2, 0),
        new THREE.Vector3(0, 0, 5.2), new THREE.Vector3(0, 0, -5.2)
      ];
      oct.forEach(dir => {
        const oPos = new THREE.Vector3(-3.2, 0, 0).add(dir);
        atoms.push({ z: 8, pos: oPos, scale: 1.4 });
        const norm = dir.clone().normalize();
        const perp = Math.abs(norm.x) < 0.9 ? new THREE.Vector3(1, 0, 0).cross(norm).normalize() : new THREE.Vector3(0, 1, 0).cross(norm).normalize();
        atoms.push({ z: 1, pos: oPos.clone().add(norm.clone().multiplyScalar(1.6)).add(perp.clone().multiplyScalar(1.8)), scale: 1.05 });
        atoms.push({ z: 1, pos: oPos.clone().add(norm.clone().multiplyScalar(1.6)).add(perp.clone().multiplyScalar(-1.8)), scale: 1.05 });
      });
    }
    else if (reaction.isDynamicSynthesis || /Intermetallic|Superalloy|Brass|Bronze|Cementite|Supermagnet|Mullite/i.test(name)) {
      // Ordered 3x3x3 B2 / L1_2 / Interstitial / Composite superlattice
      const speciesZ = reaction.atoms.map(g => g.z);
      const d = 4.6;
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          for (let iz = -1; iz <= 1; iz++) {
            const parity = Math.abs(ix + iy + iz) % speciesZ.length;
            const zAtom = speciesZ[parity];
            atoms.push({
              z: zAtom,
              pos: new THREE.Vector3(ix * d, iy * d, iz * d),
              scale: [5, 6, 7, 8].includes(zAtom) ? 1.35 : 1.68
            });
          }
        }
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
    } else if (Number.isFinite(reaction.bondLengthA) && Number.isFinite(nearestDistance) && nearestDistance > 0.1) {
      angstromPerWorldUnit = reaction.bondLengthA / nearestDistance;
      measurementScaleVerified = true;
    }
    const isotopeMap = new Map();
    selectedReactants.forEach(r => {
      if (r.z && (r.mass || r.physicalMass)) {
        isotopeMap.set(r.z, { mass: r.mass || r.physicalMass, isotopeName: r.isotopeName });
      }
    });
    if (isotopeMap.size > 0) {
      atoms.forEach(a => {
        const iso = isotopeMap.get(a.z);
        if (iso) {
          a.mass = iso.mass;
          a.physicalMass = iso.mass;
          a.isotopeName = iso.isotopeName;
        }
      });
    }
    const explicitCompoundBonds = getExplicitCompoundBonds(name, atoms.length);
    spawnAtoms(atoms, explicitCompoundBonds);
    setTimeout(refreshFtirSpectroscopy, 50);
    activeStructureId = `compound-${reaction.formula}`;
    const matchedSpeciesKey = Object.keys(MOLECULAR_SPECIES).find(k =>
      MOLECULAR_SPECIES[k].formula === reaction.formula || k === reaction.formula
    );
    activeStageableSpecies = matchedSpeciesKey || {
      id: reaction.formula,
      sym: reaction.formula,
      name: reaction.name,
      formula: reaction.formula,
      isMolecule: true,
      atoms: reaction.atoms
    };
    const evidenceLabel = reaction.evidenceLevel === 'CATALOGUED'
      ? `${tr('cataloguedCompound')} · ${tr('referenceModel')}`
      : tr('referenceModel');
    const bondOrderCounts = (explicitCompoundBonds || []).reduce((counts,bond) => {
      const order = bond.order || 1;
      counts[order] = (counts[order] || 0) + 1;
      return counts;
    },{});
    const d0Label = Number.isFinite(reaction.bondLengthA) ? ` · d₀=${reaction.bondLengthA} Å` : '';
    const sgLabel = reaction.spaceGroup ? ` · SG: ${reaction.spaceGroup}` : '';
    const topologyLabel = explicitCompoundBonds
      ? `GRAPH V=${atoms.length} · E=${explicitCompoundBonds.length} · ${Object.entries(bondOrderCounts).map(([order,count]) => `BO${order}×${count}`).join(' · ')}${d0Label}${sgLabel}`
      : `${reaction.bonds || 'BOND GRAPH'} · V=${atoms.length} · rcut=${activeBondCutoffWorld?.toFixed(2) || 'N/D'}${d0Label}${sgLabel}`;
    const verdictTag = reaction.stabilityVerdict === 'METASTABLE'
      ? 'METAESTABLE'
      : reaction.stabilityVerdict === 'UNSTABLE' || reaction.stabilityVerdict === 'UNSTABLE_BOND'
        ? 'INESTABLE'
        : reaction.stabilityVerdict === 'STABLE_COMPOSITE'
          ? 'COMPÓSITO ESTABLE'
          : 'ESTABLE';
    const stabilityDisplay = reaction.stabilityScore
      ? `${reaction.stabilityScore}% · ${verdictTag}`
      : (reaction.stabilityVerdict ? verdictTag : tr('dataUnavailable'));
    const formulaWithEq = reaction.equation
      ? `${reaction.equation} | ${reaction.atoms.map(g => (EL[g.z]?.s || g.z) + '×' + g.c).join(' + ')}`
      : `${tr('formulaLabel')}: ${reaction.formula} | ${reaction.atoms.map(g => (EL[g.z]?.s || g.z) + '×' + g.c).join(' + ')}`;
    const mechTag = Number.isFinite(reaction.bulkModulusGPa)
      ? ` · B₀=${reaction.bulkModulusGPa} GPa${reaction.vickersGPa ? ` · HV=${reaction.vickersGPa} GPa` : ''}${Number.isFinite(reaction.bandgapEv) ? ` · Eg=${reaction.bandgapEv} eV` : ''}`
      : '';
    const thermalEpi = hasNaclReference
      ? `Tm=1074 K · Tb=1738 K · p≈1 atm${mechTag}`
      : hasCalibratedThermal
        ? `Tm=${reaction.melt ?? '—'} K · ${reaction.transition === 'sublimation' ? 'Tsub' : 'Tb'}=${reaction.boil} K${mechTag}`
        : `${reaction.state || 'T/P: 298 K · 1 atm'}${mechTag}`;
    const freeEnergyKJmol = window.NULLA_COMPATIBILITY?.evaluateFreeEnergyKJmol?.(reaction.enthalpy, reaction.entropyJmolK, temperatureK);
    const dGTag = freeEnergyKJmol !== null && freeEnergyKJmol !== undefined ? ` · ΔG°(${temperatureK}K)=${freeEnergyKJmol} kJ/mol` : '';
    const enthalpyDisplay = reaction.enthalpy !== undefined && reaction.enthalpy !== null
      ? (reaction.enthalpy < 0 ? `${reaction.enthalpy} kJ/mol (EXO)${dGTag}` : `${reaction.enthalpy} kJ/mol (ENDO)${dGTag}`)
      : '—';
    updateTelemetry(
      `${reaction.formula} · ${reaction.name}`,
      formulaWithEq,
      `${reaction.type || 'COMPOUND'} · ${reaction.evidenceLevel}`,
      topologyLabel,
      thermalEpi,
      enthalpyDisplay,
      reaction.dipole !== undefined && reaction.dipole !== null ? `${reaction.dipole} Debye (${reaction.dipole > 0 ? 'POLAR' : 'NON-POLAR'})` : tr('dataUnavailable'),
      stabilityDisplay,
      reaction.note ? `${reaction.note} · ${evidenceLabel}` : `${evidenceLabel}`
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

  function getMoleculeClusterAtoms(species, offset) {
    const id = species.id || species.sym || '';
    const atoms = [];
    const bonds = [];
    const add = (z, x, y, zCoord, scale = 1.45) => {
      const idx = atoms.length;
      atoms.push({ z, pos: offset.clone().add(new THREE.Vector3(x, y, zCoord)), scale });
      return idx;
    };
    if (id === 'H2O' || id === 'SO2') {
      const cZ = id === 'H2O' ? 8 : 16;
      const oZ = id === 'H2O' ? 1 : 8;
      const c = add(cZ, 0, 1.4, 0, 1.65);
      const a1 = add(oZ, -3.4, -1.2, 0, 1.3);
      const a2 = add(oZ, 3.4, -1.2, 0, 1.3);
      bonds.push({ a: c, b: a1, order: id === 'SO2' ? 2 : 1 }, { a: c, b: a2, order: id === 'SO2' ? 2 : 1 });
    } else if (id === 'CO2') {
      const c = add(6, 0, 0, 0, 1.6);
      const o1 = add(8, -4.2, 0, 0, 1.45);
      const o2 = add(8, 4.2, 0, 0, 1.45);
      bonds.push({ a: c, b: o1, order: 2 }, { a: c, b: o2, order: 2 });
    } else if (id === 'NH3') {
      const n = add(7, 0, 1.2, 0, 1.65);
      const h1 = add(1, 0, -1.2, 3.4, 1.2);
      const h2 = add(1, -2.9, -1.2, -1.7, 1.2);
      const h3 = add(1, 2.9, -1.2, -1.7, 1.2);
      bonds.push({ a: n, b: h1, order: 1 }, { a: n, b: h2, order: 1 }, { a: n, b: h3, order: 1 });
    } else if (id === 'CH4') {
      const c = add(6, 0, 0, 0, 1.65);
      const d = 2.8;
      [[d,d,d],[-d,-d,d],[-d,d,-d],[d,-d,-d]].forEach(([x,y,z]) => {
        const h = add(1, x, y, z, 1.2);
        bonds.push({ a: c, b: h, order: 1 });
      });
    } else if (id === 'HCl') {
      const cl = add(17, -2.2, 0, 0, 1.65);
      const h = add(1, 2.2, 0, 0, 1.25);
      bonds.push({ a: cl, b: h, order: 1 });
    } else if (id === 'C60') {
      const verts = icosahedronVertices();
      verts.forEach(v => {
        const p = v.clone().normalize().multiplyScalar(5.2);
        add(6, p.x, p.y, p.z, 1.25);
      });
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          if (atoms[i].pos.distanceTo(atoms[j].pos) < 6.2) bonds.push({ a: i, b: j, order: 1 });
        }
      }
    } else if (id === 'Graphene' || id === 'BN') {
      const zA = id === 'BN' ? 5 : 6;
      const zB = id === 'BN' ? 7 : 6;
      const r = 4.2;
      const c = add(zA, 0, 0, 0, 1.35);
      const ring = [];
      for (let i = 0; i < 6; i++) {
        const th = (i / 6) * Math.PI * 2;
        const idx = add(i % 2 === 0 ? zB : zA, r * Math.cos(th), r * Math.sin(th), 0, 1.35);
        ring.push(idx);
        bonds.push({ a: c, b: idx, order: 1 });
      }
      for (let i = 0; i < 6; i++) bonds.push({ a: ring[i], b: ring[(i + 1) % 6], order: 1 });
    } else if (id === 'SWCNT') {
      const r = 4.2;
      for (let slice = -1; slice <= 1; slice++) {
        for (let k = 0; k < 6; k++) {
          const th = (k / 6) * Math.PI * 2;
          add(6, slice * 3.4, r * Math.cos(th), r * Math.sin(th), 1.25);
        }
      }
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          if (atoms[i].pos.distanceTo(atoms[j].pos) < 4.8) bonds.push({ a: i, b: j, order: 1 });
        }
      }
    } else {
      const specAtoms = species.atoms || MOLECULAR_SPECIES[id]?.atoms || [{ z: 6, c: 2 }, { z: 8, c: 2 }];
      const zList = [];
      specAtoms.forEach(g => { for (let k = 0; k < Math.min(g.c, 4); k++) zList.push(g.z); });
      while (zList.length < 8) zList.push(...zList.slice(0, 2));
      const d = 3.6;
      let idx = 0;
      for (let ix = 0; ix < 2; ix++) {
        for (let iy = 0; iy < 2; iy++) {
          for (let iz = 0; iz < 2; iz++) {
            add(zList[idx % zList.length], (ix - 0.5) * d, (iy - 0.5) * d, (iz - 0.5) * d, 1.45);
            idx++;
          }
        }
      }
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          if (atoms[i].pos.distanceTo(atoms[j].pos) < d * 1.15) bonds.push({ a: i, b: j, order: 1 });
        }
      }
    }
    return { atoms, bonds };
  }

  function formMolecularMixture(reactantsList) {
    isDnaMode = false;
    activeCollisionMode = 'chemical';
    const combinedList = [];
    const explicitBonds = [];
    const radius = Math.max(18, reactantsList.length * 9);
    reactantsList.forEach((r, index) => {
      const angle = reactantsList.length === 2 ? index * Math.PI : (index / reactantsList.length) * Math.PI * 2;
      const offset = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.45, (index % 2 ? 1 : -1) * 4);
      const baseIndex = combinedList.length;
      if (r.isMolecule) {
        const cluster = getMoleculeClusterAtoms(r, offset);
        combinedList.push(...cluster.atoms);
        cluster.bonds.forEach(b => explicitBonds.push({ a: baseIndex + b.a, b: baseIndex + b.b, order: b.order || 1 }));
      } else if (r.z && EL[r.z]) {
        combinedList.push(...getElementAtoms(r.z, offset));
      }
    });
    spawnAtoms(combinedList, explicitBonds);
    const symbols = reactantsList.map(r => r.formula || r.sym);
    activeStructureId = `mixture-${symbols.join('-')}`;
    activeThermalProfile = null;
    measurementScaleVerified = false;
    setThermalControlEnabled(false);
    const multi = evaluateChemicalCompatibility(null);
    updateTelemetry(
      `${tr('mixtureTitle')} · ${symbols.join(' + ')}`,
      `${symbols.join(' // ')} · ${tr('mixtureNoFormula')}`,
      `MULTIPHASE MIXTURE · ${multi?.combinationMode || tr('mixtureCoexist')}`,
      `INTRAMOLECULAR BONDS PRESERVED · INTER-SPECIES E=0`,
      `COEXISTENCE @ ${temperatureK} K`,
      '0 kJ/mol (PHYSICAL MIXING)',
      tr('dataUnavailable'),
      multi?.stabilityVerdict || 'COEXISTENCIA FÍSICA ESTABLE',
      multi?.engineeringSummary || `ILLUSTRATION · ${tr('mixtureDisclaimer')}`
    );
    window.dispatchEvent(new CustomEvent('nulla:mixture', { detail: { symbols } }));
  }

  function attemptPhysicalMixture() {
    if (selectedReactants.length < 2) {
      updateTelemetry(tr('mixtureTitle'),selectedReactants.length ? `${selectedReactants[0].sym} + ?` : tr('selectFusion'),tr('selectTwoSpecies'),tr('mixtureNoFormula'),tr('waiting'));
      return;
    }
    playTone(520,'sine',0.16);
    if (selectedReactants.some(item => item.isMolecule)) {
      formMolecularMixture(selectedReactants);
      return;
    }
    formInertMixture(selectedReactants.map(item => item.z));
    const multi = evaluateChemicalCompatibility(null);
    if (multi && hudStability) {
      hudStability.textContent = `MEZCLA FÍSICA · ${multi.stabilityVerdict || 'COEXISTENCIA'}`;
      hudStability.style.color = '#00F0FF';
    }
    if (multi && hudNote) {
      hudNote.textContent = multi.engineeringSummary || hudNote.textContent;
    }
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
      if (activeReactionRef && activeStructureId.startsWith('compound-')) {
        const freeEnergyKJmol = window.NULLA_COMPATIBILITY?.evaluateFreeEnergyKJmol?.(
          activeReactionRef.enthalpy,
          activeReactionRef.entropyJmolK,
          temperatureK
        );
        if (hudEnthalpy && activeReactionRef.enthalpy !== undefined && activeReactionRef.enthalpy !== null) {
          const dGTag = freeEnergyKJmol !== null && freeEnergyKJmol !== undefined ? ` · ΔG°(${temperatureK}K)=${freeEnergyKJmol} kJ/mol` : '';
          hudEnthalpy.textContent = activeReactionRef.enthalpy < 0
            ? `${activeReactionRef.enthalpy} kJ/mol (EXO)${dGTag}`
            : `${activeReactionRef.enthalpy} kJ/mol (ENDO)${dGTag}`;
        }
        evaluateChemicalCompatibility(activeReactionRef);
      }
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
    const selected = new Set((reactantsArray || []).map(reactant => reactant.sym));
    const seenFormulas = new Set();
    const suggestions = [];
    for (const [path, reaction] of Object.entries(REACTIONS)) {
      if (reaction.evidenceLevel !== 'CATALOGUED') continue;
      const reactantSymbols = new Set(path.split('+'));
      if (selected.size > 0 && ![...selected].every(symbol => reactantSymbols.has(symbol))) continue;
      if (!reaction?.formula || seenFormulas.has(reaction.formula)) continue;
      seenFormulas.add(reaction.formula);
      const verdictTag = reaction.stabilityVerdict === 'METASTABLE' ? 'METAESTABLE' : 'ESTABLE';
      suggestions.push({
        path,
        name:reaction.name,
        formula:reaction.formula,
        type:reaction.type,
        stability:reaction.stabilityScore ? `${reaction.stabilityScore}% · ${verdictTag}` : verdictTag,
        enthalpy:Number.isFinite(reaction.enthalpy) ? `${reaction.enthalpy} kJ/mol` : 'DATA UNAVAILABLE',
        isExact:true,
        evidenceLevel:reaction.evidenceLevel || 'CATALOGUED'
      });
    }
    return suggestions.slice(0, 8);
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

  function exportCIFFile() {
    playTone(920, 'sine', 0.2);
    if (activeAtoms.length === 0) return;
    if (!calibratedGeometryExportAllowed()) return;

    const coordsA = activeAtoms.map(a => ({
      sym: a.elData?.s || 'X',
      x: a.currentPos.x * angstromPerWorldUnit,
      y: a.currentPos.y * angstromPerWorldUnit,
      z: a.currentPos.z * angstromPerWorldUnit
    }));
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    coordsA.forEach(p => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
    });
    const padA = Number.isFinite(activeReactionRef?.latticeA) ? activeReactionRef.latticeA : 4.0;
    const cellA = Math.max(padA, (maxX - minX) + 3.5);
    const cellB = Math.max(padA, (maxY - minY) + 3.5);
    const cellC = Math.max(padA, (maxZ - minZ) + 3.5);
    const formulaStr = activeReactionRef?.formula || activeStructureId;
    const spaceGroup = activeReactionRef?.spaceGroup || 'P 1';
    const seal = window.NULLA_COMPATIBILITY?.computeChronolithSeal?.(`${formulaStr}|${temperatureK}|${activeAtoms.length}`) || 'CHR-VERIFIED';

    let cifText = `data_NULLA_LABS_${String(activeStructureId).replace(/[^A-Za-z0-9_]/g, '_')}\n`;
    cifText += `_audit_creation_method            'NULLA-LABS Crystallographic & Molecular Synthesis Engine v101.2'\n`;
    cifText += `_chemical_formula_sum             '${formulaStr}'\n`;
    cifText += `_cell_measurement_temperature     ${temperatureK}\n`;
    cifText += `_symmetry_space_group_name_H-M    '${spaceGroup}'\n`;
    cifText += `_nulla_chronolith_integrity_seal  '${seal}'\n`;
    cifText += `_cell_length_a                    ${cellA.toFixed(4)}\n`;
    cifText += `_cell_length_b                    ${cellB.toFixed(4)}\n`;
    cifText += `_cell_length_c                    ${cellC.toFixed(4)}\n`;
    cifText += `_cell_angle_alpha                 90.0000\n`;
    cifText += `_cell_angle_beta                  90.0000\n`;
    cifText += `_cell_angle_gamma                 90.0000\n\n`;
    cifText += `loop_\n`;
    cifText += `  _atom_site_label\n`;
    cifText += `  _atom_site_type_symbol\n`;
    cifText += `  _atom_site_fract_x\n`;
    cifText += `  _atom_site_fract_y\n`;
    cifText += `  _atom_site_fract_z\n`;
    cifText += `  _atom_site_Cartn_x\n`;
    cifText += `  _atom_site_Cartn_y\n`;
    cifText += `  _atom_site_Cartn_z\n`;

    coordsA.forEach((p, idx) => {
      const fx = ((p.x - minX + 1.75) / cellA).toFixed(5);
      const fy = ((p.y - minY + 1.75) / cellB).toFixed(5);
      const fz = ((p.z - minZ + 1.75) / cellC).toFixed(5);
      cifText += `  ${(p.sym + (idx + 1)).padEnd(6)} ${p.sym.padEnd(4)} ${fx} ${fy} ${fz} ${p.x.toFixed(4)} ${p.y.toFixed(4)} ${p.z.toFixed(4)}\n`;
    });

    const blob = new Blob([cifText], { type: 'chemical/x-cif;charset=utf-8' });
    downloadBlob(blob, `${String(activeStructureId).replace(/[^A-Za-z0-9_-]/g, '_')}.cif`);
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
            if (MOLECULAR_SPECIES[symbol]) {
              const mol = MOLECULAR_SPECIES[symbol];
              return { id: mol.id, sym: mol.id, formula: mol.formula, name: mol.name, isMolecule: true, atoms: mol.atoms, z: mol.atoms?.[0]?.z || 6 };
            }
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
  // MULTI-ELEMENT & MOLECULAR REACTANT TRAY MANAGER (2 to 4 Species)
  // ═══════════════════════════════════════════════════════════════
  let selectedReactants = [];
  let lastCompatibilityResult = null;
  const MAX_REACTANTS = 4;

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
      if (result.stabilityVerdict) {
        hudCompatibility.textContent = result.stabilityVerdict;
        hudCompatibility.style.color = result.stabilityClass === 'STABLE' || result.stabilityClass === 'STABLE_COMPOSITE'
          ? '#00FF9D'
          : result.stabilityClass === 'METASTABLE'
            ? '#FFD166'
            : '#FF6B4A';
      } else {
        const score = typeof result.score === 'number' ? ` · ${tr('dataCoverage')} ${Math.round(result.score * 100)}%` : '';
        hudCompatibility.textContent = `${tr(statusKeys[result.status] || result.status)}${score}`;
        hudCompatibility.style.color = result.status.includes('NO_') ? '#FF6B4A' : result.status.includes('FAVORABLE') || result.status.includes('EXOENERGETIC') ? '#00FF9D' : '#FFD166';
      }
    }
    if (hudConditions) {
      if (result.physicalConditions) {
        hudConditions.textContent = result.physicalConditions;
      } else {
        const requirements = result.requirements?.length ? result.requirements.map(translateCompatibilityItem).join(' · ') : tr('noAdditionalConditions');
        const risks = result.instability?.length ? ` | ${tr('instability')}: ${result.instability.map(translateCompatibilityItem).join(' · ')}` : '';
        hudConditions.textContent = `${requirements}${risks}`;
      }
    }
  }

  function evaluateChemicalCompatibility(reaction) {
    const reactants = selectedReactants.map(item => ({
      z: item.z || item.atoms?.[0]?.z || 6,
      symbol: item.sym,
      sym: item.sym,
      name: item.name || item.formula || item.sym,
      formula: item.formula || item.sym,
      isMolecule: Boolean(item.isMolecule),
      electronegativity: item.isMolecule ? undefined : EL[item.z]?.electronegativity
    }));
    const multiFn = window.NULLA_COMPATIBILITY?.multidisciplinary || window.NULLA_COMPATIBILITY?.chemical;
    const result = multiFn?.call(window.NULLA_COMPATIBILITY, {
      reactants,
      reaction: reaction?.isMolecularReaction ? null : reaction,
      molecularReaction: reaction?.isMolecularReaction ? reaction : null,
      temperatureK
    });
    showCompatibility(result);
    return result;
  }

  function updateReactantsTrayHUD() {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]) {
        if (i < selectedReactants.length) {
          const item = selectedReactants[i];
          slots[i].textContent = item.isotopeName || item.formula || item.sym;
          const el = EL[item.z || item.atoms?.[0]?.z];
          const colorStr = item.isMolecule
            ? '#00FF9D'
            : '#' + (el ? el.col : 0x00F0FF).toString(16).padStart(6, '0');
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
    const explicitBonds = [];
    const hasMolecule = selectedReactants.some(r => r.isMolecule);
    const count = selectedReactants.length;

    const offsets = [];
    if (count === 1) {
      offsets.push(new THREE.Vector3(0, 0, 0));
    } else if (count === 2) {
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
      const baseIndex = atoms.length;
      if (r.isMolecule) {
        const cluster = getMoleculeClusterAtoms(r, offset);
        atoms.push(...cluster.atoms);
        cluster.bonds.forEach(b => explicitBonds.push({ a: baseIndex + b.a, b: baseIndex + b.b, order: b.order || 1 }));
      } else {
        const elAtoms = getElementAtoms(r.z, offset);
        atoms.push(...elAtoms);
      }
    });

    spawnAtoms(atoms, hasMolecule ? explicitBonds : null);

    const symbolsStr = selectedReactants.map(r => r.formula || r.sym).join(' + ');
    const reactionKey = canonicalReactionKey(selectedReactants.map(r => r.sym));
    const reaction = REACTIONS[reactionKey];
    const multi = evaluateChemicalCompatibility(reaction);
    const stabilityText = reaction?.stabilityScore
      ? `${reaction.stabilityScore}% · ${reaction.stabilityVerdict === 'METASTABLE' ? 'METAESTABLE' : 'ESTABLE'}`
      : multi?.stabilityVerdict || tr('dataUnavailable');
    updateTelemetry(
      `BANDEJA DE SÍNTESIS (${count}/${MAX_REACTANTS}) · ${symbolsStr}`,
      reaction ? `${symbolsStr} → ${reaction.formula} (${reaction.name})` : `${symbolsStr} → ${multi?.combinationMode || '?'}`,
      reaction ? `${reaction.type} · ${reaction.evidenceLevel}` : `${multi?.combinationMode || 'FASE MULTICOMPONENTE'} · ${multi?.stabilityClass || 'PREVIEW'}`,
      multi?.bondingRegime || reaction?.bonds || 'Pulsa 🧪 COMBINAR o ◌ MEZCLAR',
      `SEPARACIÓN CUÁNTICA 3D · T=${temperatureK} K`,
      reaction?.enthalpy !== undefined ? `${reaction.enthalpy} kJ/mol` : (multi?.enthalpy != null ? `≈${multi.enthalpy} kJ/mol` : '—'),
      reaction?.dipole !== undefined ? `${reaction.dipole} Debye` : tr('dataUnavailable'),
      stabilityText,
      multi?.engineeringSummary || reaction?.note || 'Pulsa 🧪 COMBINAR para sintetizar o ◌ MEZCLAR para coexistencia física.'
    );
  }

  function selectMoleculeForTray(molIdOrSpec) {
    playTone(440 + selectedReactants.length * 75, 'sine', 0.12);
    if (selectedReactants.length >= MAX_REACTANTS) {
      updateTelemetry(
        `Tray Maximum Reached (${MAX_REACTANTS}/${MAX_REACTANTS})`,
        `Catalogue arity capped at ${MAX_REACTANTS} species`,
        `Reaction State: TRAY FULL`,
        `Click 🧪 COMBINAR, ◌ MEZCLAR or ↩ UNDO`,
        `Maximum of ${MAX_REACTANTS} species in tray`
      );
      return;
    }
    const spec = typeof molIdOrSpec === 'string'
      ? (MOLECULAR_SPECIES[molIdOrSpec] || { id: molIdOrSpec, sym: molIdOrSpec, formula: molIdOrSpec, name: molIdOrSpec, atoms: [{ z: 6, c: 2 }] })
      : molIdOrSpec;
    if (!spec) return;
    selectedReactants.push({
      id: spec.id || spec.sym,
      sym: spec.id || spec.sym,
      formula: spec.formula || spec.sym,
      name: spec.name || spec.formula || spec.sym,
      isMolecule: true,
      atoms: spec.atoms || [{ z: 6, c: 2 }],
      z: spec.atoms?.[0]?.z || 6
    });
    updateReactantsTrayHUD();
    renderSideBySidePreviewAtoms();
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
      if (selectedReactants.length === 1 && !selectedReactants[0].isMolecule) {
        formElement(selectedReactants[0].z);
      } else if (selectedReactants.length >= 1) {
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
        selectedReactants.length === 1 ? `${selectedReactants[0].formula || selectedReactants[0].sym} + ?` : tr('selectFusion'),
        tr('waiting'),
        tr('noAdditionalConditions'),
        tr('statusNoCataloguedPath')
      );
      return;
    }

    playTone(600, 'triangle', 0.2);
    const reactionKey = canonicalReactionKey(selectedReactants.map(r => r.sym));
    let reaction = REACTIONS[reactionKey];
    const multi = evaluateChemicalCompatibility(reaction);
    if (!reaction) {
      if (multi && multi.canCombine) {
        const mergedAtomMap = new Map();
        selectedReactants.forEach(r => {
          if (r.isMolecule && Array.isArray(r.atoms)) {
            r.atoms.forEach(g => mergedAtomMap.set(g.z, (mergedAtomMap.get(g.z) || 0) + g.c));
          } else if (r.z) {
            mergedAtomMap.set(r.z, (mergedAtomMap.get(r.z) || 0) + 2);
          }
        });
        const dynamicAtoms = [...mergedAtomMap.entries()].map(([z, c]) => ({ z, c }));
        reaction = {
          name: `${multi.combinationMode} (${selectedReactants.map(r => r.formula || r.sym).join('–')})`,
          formula: selectedReactants.map(r => r.formula || r.sym).join('·'),
          atoms: dynamicAtoms.length ? dynamicAtoms : [{ z: 6, c: 4 }],
          type: multi.bondingRegime || 'Multidisciplinary Phase',
          bonds: multi.bondingRegime || 'Metallic / Interstitial / Composite',
          state: `Solid / Composite Phase (${temperatureK} K)`,
          geom: '3D Superlattice',
          enthalpy: multi.enthalpy ?? null,
          dipole: 0,
          stabilityScore: multi.stabilityClass === 'STABLE' || multi.stabilityClass === 'STABLE_COMPOSITE' ? 88 : 74,
          stabilityVerdict: multi.stabilityClass || 'METASTABLE',
          evidenceLevel: 'CATALOGUED',
          isDynamicSynthesis: true,
          note: `${multi.stabilityVerdict} · ${multi.engineeringSummary}`
        };
      } else {
        updateTelemetry(
          'COMBINACIÓN QUÍMICA NO CATALOGADA',
          selectedReactants.map(r => r.formula || r.sym).join(' + '),
          multi?.stabilityVerdict || 'Sin ecuación balanceada verificada',
          multi?.bondingRegime || 'No se generará un compuesto inventado',
          'BLOCKED · SELECT A CATALOGUED PATH',
          undefined,
          undefined,
          multi?.stabilityVerdict || 'INESTABLE / NO DATA',
          multi?.engineeringSummary || 'Usa SUGERIR para ver combinaciones disponibles o MEZCLAR para coexistencia física.'
        );
        return;
      }
    }

    const hasMolecule = selectedReactants.some(r => r.isMolecule);
    if (selectedReactants.length === 2 && !hasMolecule && !reaction.isDynamicSynthesis) {
      triggerFusionCollision(selectedReactants[0].z, selectedReactants[1].z, reaction);
    } else {
      isDnaMode = false;
      activeCollisionMode = 'chemical';
      const atoms = [];
      const count = selectedReactants.length;
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
        if (r.isMolecule) {
          atoms.push(...getMoleculeClusterAtoms(r, offset).atoms);
        } else {
          atoms.push(...getElementAtoms(r.z, offset));
        }
      });

      spawnAtoms(atoms);

      fusionState = 'charging';
      fusionTimer = 0.9;
      fusionChargeDuration = fusionTimer;
      fusionReactantA = selectedReactants[0].z || 6;
      fusionReactantB = selectedReactants[1]?.z || 8;

      fusionTargetReaction = reaction;

      updateTelemetry(
        `SÍNTESIS MULTIESPECIE (${selectedReactants.length} Reactivos)`,
        `${selectedReactants.map(r => r.formula || r.sym).join(' + ')} → ${reaction.formula}`,
        `Collision State: CONVERGING RADIANTS TO CENTROID`,
        reaction.bonds || `Preparing chemical pathway`,
        `Educational collision visualization`,
        reaction.enthalpy,
        reaction.dipole,
        reaction.stabilityScore ? `${reaction.stabilityScore}% · ${reaction.stabilityVerdict || 'ESTABLE'}` : 'ESTABLE',
        reaction.note
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

  // ═══════════════════════════════════════════════════════════════
  // SEGRÈ NUCLIDE CHART & VALLEY OF STABILITY CONTROLLER
  // ═══════════════════════════════════════════════════════════════
  const btnSegreChart = document.getElementById('btn-segre-chart');
  const segreModal = document.getElementById('segre-modal');
  const btnCloseSegre = document.getElementById('btn-close-segre');
  const segreCanvas = document.getElementById('segre-chart-canvas');
  const astonCanvas = document.getElementById('aston-curve-canvas');
  const segreTooltip = document.getElementById('segre-canvas-tooltip');

  let activeSegreFilter = 'all';
  let selectedSegreNuclide = null;
  let activeCascadeInterval = null;
  let activeCascadeStep = 0;

  function initSegreChart() {
    const nuclides = window.NULLA_NUCLEAR?.SEGRE_NUCLIDES || [];
    if (!selectedSegreNuclide && nuclides.length) {
      selectedSegreNuclide = nuclides.find(n => n.id === 'Fe56') || nuclides[0];
    }
    updateSegreInspector(selectedSegreNuclide);
    drawSegreChart();
    drawAstonCurve(selectedSegreNuclide);
  }

  function updateSegreInspector(nuc) {
    if (!nuc) return;
    const elSym = document.getElementById('segre-nuc-sym');
    const elMode = document.getElementById('segre-nuc-mode');
    const elZ = document.getElementById('segre-nuc-z');
    const elN = document.getElementById('segre-nuc-n');
    const elA = document.getElementById('segre-nuc-a');
    const elHL = document.getElementById('segre-nuc-hl');
    const elBE = document.getElementById('segre-nuc-be');
    const elDesc = document.getElementById('segre-nuc-desc');

    if (elSym) elSym.textContent = nuc.symbol;
    if (elZ) elZ.textContent = nuc.Z;
    if (elN) elN.textContent = nuc.N;
    if (elA) elA.textContent = nuc.A;
    if (elHL) elHL.textContent = nuc.halfLife;
    if (elDesc) elDesc.textContent = nuc.desc;

    const semf = window.NULLA_NUCLEAR?.calculateSEMF ? window.NULLA_NUCLEAR.calculateSEMF(nuc.A, nuc.Z) : { perNucleonMeV: nuc.expBE };
    if (elBE) elBE.textContent = `${semf.perNucleonMeV || nuc.expBE} MeV / nucleón`;

    const modeLabels = {
      stable: { text: 'ESTABLE', bg: '#1b2432', col: '#FFD700', border: '#FFD700' },
      beta_minus: { text: 'BETA⁻ (n→p)', bg: '#082536', col: '#00D4FF', border: '#00D4FF' },
      beta_plus: { text: 'BETA⁺ / EC (p→n)', bg: '#360d16', col: '#FF3366', border: '#FF3366' },
      alpha: { text: 'ALFA (⁴He)', bg: '#382806', col: '#FFB700', border: '#FFB700' },
      fission: { text: 'FISIÓN ESP.', bg: '#2b0938', col: '#BF00FF', border: '#BF00FF' }
    };
    const modeMeta = modeLabels[nuc.decayMode] || modeLabels.stable;
    if (elMode) {
      elMode.textContent = modeMeta.text;
      elMode.style.background = modeMeta.bg;
      elMode.style.color = modeMeta.col;
      elMode.style.borderColor = modeMeta.border;
    }
  }

  function getNuclideCanvasCoords(nuc, width, height) {
    const padX = 40, padY = 30;
    const plotW = width - padX - 20;
    const plotH = height - padY - 20;
    const maxN = 160;
    const maxZ = 100;
    const x = padX + (nuc.N / maxN) * plotW;
    const y = (height - padY) - (nuc.Z / maxZ) * plotH;
    return { x, y };
  }

  function drawSegreChart() {
    if (!segreCanvas) return;
    const ctx = segreCanvas.getContext('2d');
    const width = segreCanvas.width;
    const height = segreCanvas.height;
    const nuclides = window.NULLA_NUCLEAR?.SEGRE_NUCLIDES || [];
    const magic = window.NULLA_NUCLEAR?.MAGIC_NUMBERS || { Z: [2,8,20,28,50,82], N: [2,8,20,28,50,82,126] };

    ctx.fillStyle = '#070e18';
    ctx.fillRect(0, 0, width, height);

    const padX = 40, padY = 30;
    const plotW = width - padX - 20;
    const plotH = height - padY - 20;
    const maxN = 160;
    const maxZ = 100;

    // Grid lines for Magic Numbers
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.lineWidth = 1;
    magic.Z.forEach(z => {
      const y = (height - padY) - (z / maxZ) * plotH;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.font = '7px Orbitron, sans-serif';
      ctx.fillText(`Z=${z}`, padX + 3, y - 2);
    });
    magic.N.forEach(n => {
      const x = padX + (n / maxN) * plotW;
      ctx.beginPath();
      ctx.moveTo(x, height - padY);
      ctx.lineTo(x, 20);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.font = '7px Orbitron, sans-serif';
      ctx.fillText(`N=${n}`, x + 2, height - padY - 3);
    });

    // Reference line N = Z (dashed green)
    ctx.strokeStyle = 'rgba(0, 255, 157, 0.45)';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    const originX = padX;
    const originY = height - padY;
    const endZ = 95;
    const endN = 95;
    const endX = padX + (endN / maxN) * plotW;
    const endY = (height - padY) - (endZ / maxZ) * plotH;
    ctx.moveTo(originX, originY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0, 255, 157, 0.7)';
    ctx.font = '8px Orbitron, sans-serif';
    ctx.fillText('N = Z', endX - 25, endY - 6);

    // Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, 15);
    ctx.lineTo(padX, height - padY);
    ctx.lineTo(width - 15, height - padY);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '9px Orbitron, sans-serif';
    ctx.fillText('N (NEUTRONES) ➔', width / 2 - 25, height - 10);
    ctx.save();
    ctx.translate(14, height / 2 + 30);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Z (PROTONES) ➔', 0, 0);
    ctx.restore();

    // Decay Chain trajectory arrows if cascade is playing
    const cascadeChain = window.NULLA_NUCLEAR?.URANIUM_DECAY_CHAIN || [];
    if (activeCascadeStep > 0) {
      for (let s = 0; s < Math.min(activeCascadeStep, cascadeChain.length); s++) {
        const step = cascadeChain[s];
        const fromNuc = nuclides.find(n => n.id === step.from);
        const toNuc = nuclides.find(n => n.id === step.to);
        if (fromNuc && toNuc) {
          const p1 = getNuclideCanvasCoords(fromNuc, width, height);
          const p2 = getNuclideCanvasCoords(toNuc, width, height);
          ctx.strokeStyle = step.mode === 'alpha' ? '#FFB700' : '#00D4FF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // Draw Nuclides
    nuclides.forEach(nuc => {
      let isVisible = true;
      if (activeSegreFilter === 'stable' && nuc.decayMode !== 'stable') isVisible = false;
      if (activeSegreFilter === 'fusion' && nuc.A > 20) isVisible = false;
      if (activeSegreFilter === 'fission' && (nuc.A < 85 && nuc.A > 1)) isVisible = false;

      const { x, y } = getNuclideCanvasCoords(nuc, width, height);
      const isSelected = selectedSegreNuclide && selectedSegreNuclide.id === nuc.id;
      const size = isSelected ? 9 : 6.5;

      let fillColor = '#1b2432';
      let strokeColor = '#FFD700';
      if (nuc.decayMode === 'beta_minus') { fillColor = '#00D4FF'; strokeColor = '#FFFFFF'; }
      else if (nuc.decayMode === 'beta_plus') { fillColor = '#FF3366'; strokeColor = '#FFFFFF'; }
      else if (nuc.decayMode === 'alpha') { fillColor = '#FFB700'; strokeColor = '#FFFFFF'; }
      else if (nuc.decayMode === 'fission') { fillColor = '#BF00FF'; strokeColor = '#FFFFFF'; }

      ctx.globalAlpha = isVisible ? 1.0 : 0.15;
      ctx.fillStyle = fillColor;
      ctx.fillRect(x - size / 2, y - size / 2, size, size);

      ctx.strokeStyle = isSelected ? '#00FF9D' : strokeColor;
      ctx.lineWidth = isSelected ? 2 : 0.75;
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);

      if (isSelected) {
        ctx.strokeStyle = 'rgba(0, 255, 157, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1.0;
  }

  function drawAstonCurve(nuc) {
    if (!astonCanvas) return;
    const ctx = astonCanvas.getContext('2d');
    const width = astonCanvas.width;
    const height = astonCanvas.height;
    const semfFn = window.NULLA_NUCLEAR?.calculateSEMF;

    ctx.fillStyle = '#101a28';
    ctx.fillRect(0, 0, width, height);

    const padL = 30, padB = 22, padT = 12, padR = 15;
    const plotW = width - padL - padR;
    const plotH = height - padB - padT;

    const toX = A => padL + (A / 240) * plotW;
    const toY = be => (height - padB) - (be / 10) * plotH;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    [2, 4, 6, 8, 10].forEach(val => {
      const y = toY(val);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(width - padR, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '7px Orbitron, sans-serif';
      ctx.fillText(val, padL - 14, y + 2);
    });

    // Aston Curve Path
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let A = 2; A <= 240; A += 2) {
      const Z = Math.round(A / (2 + 0.015 * Math.pow(A, 2 / 3)));
      const semf = semfFn ? semfFn(A, Z) : { perNucleonMeV: 8 };
      const px = toX(A);
      const py = toY(semf.perNucleonMeV);
      if (A === 2) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Mark Iron-56 Peak (8.79 MeV)
    const feX = toX(56);
    const feY = toY(8.79);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(feX, feY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.font = '7.5px Orbitron, sans-serif';
    ctx.fillText('⁵⁶Fe', feX - 8, feY - 7);

    // Mark currently selected nuclide
    if (nuc && nuc.A > 0) {
      const semf = semfFn ? semfFn(nuc.A, nuc.Z) : { perNucleonMeV: nuc.expBE };
      const nx = toX(nuc.A);
      const ny = toY(semf.perNucleonMeV || nuc.expBE);

      ctx.strokeStyle = 'rgba(0, 255, 157, 0.4)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(nx, height - padB);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#00FF9D';
      ctx.beginPath();
      ctx.arc(nx, ny, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px Orbitron, sans-serif';
      ctx.fillText(nuc.symbol, nx + 6, ny + 3);
    }

    // Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, height - padB);
    ctx.lineTo(width - padR, height - padB);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '7.5px Orbitron, sans-serif';
    ctx.fillText('A (Masa) ➔', width / 2 - 15, height - 5);
  }

  function handleSegreCanvasClick(event) {
    if (!segreCanvas) return;
    const rect = segreCanvas.getBoundingClientRect();
    const scaleX = segreCanvas.width / rect.width;
    const scaleY = segreCanvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    const nuclides = window.NULLA_NUCLEAR?.SEGRE_NUCLIDES || [];
    let closest = null;
    let minD2 = 144; // 12px radius threshold

    nuclides.forEach(nuc => {
      const p = getNuclideCanvasCoords(nuc, segreCanvas.width, segreCanvas.height);
      const d2 = (p.x - clickX) * (p.x - clickX) + (p.y - clickY) * (p.y - clickY);
      if (d2 < minD2) {
        minD2 = d2;
        closest = nuc;
      }
    });

    if (closest) {
      selectedSegreNuclide = closest;
      playTone(550, 'sine', 0.1);
      updateSegreInspector(closest);
      drawSegreChart();
      drawAstonCurve(closest);
    }
  }

  function handleSegreCanvasMouseMove(event) {
    if (!segreCanvas || !segreTooltip) return;
    const rect = segreCanvas.getBoundingClientRect();
    const scaleX = segreCanvas.width / rect.width;
    const scaleY = segreCanvas.height / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    const nuclides = window.NULLA_NUCLEAR?.SEGRE_NUCLIDES || [];
    let hovered = null;
    let minD2 = 100;

    nuclides.forEach(nuc => {
      const p = getNuclideCanvasCoords(nuc, segreCanvas.width, segreCanvas.height);
      const d2 = (p.x - mouseX) * (p.x - mouseX) + (p.y - mouseY) * (p.y - mouseY);
      if (d2 < minD2) {
        minD2 = d2;
        hovered = nuc;
      }
    });

    if (hovered) {
      segreTooltip.style.display = 'block';
      segreTooltip.style.left = `${(event.clientX - rect.left) + 12}px`;
      segreTooltip.style.top = `${(event.clientY - rect.top) - 16}px`;
      segreTooltip.textContent = `${hovered.symbol} (Z=${hovered.Z}, N=${hovered.N}) · ${hovered.halfLife}`;
    } else {
      segreTooltip.style.display = 'none';
    }
  }

  function playUraniumCascade() {
    const chain = window.NULLA_NUCLEAR?.URANIUM_DECAY_CHAIN || [];
    const nuclides = window.NULLA_NUCLEAR?.SEGRE_NUCLIDES || [];
    if (!chain.length) return;

    if (activeCascadeInterval) {
      clearInterval(activeCascadeInterval);
      activeCascadeInterval = null;
    }
    activeCascadeStep = 1;
    activeSegreFilter = 'all';

    const stepFn = () => {
      if (activeCascadeStep > chain.length) {
        clearInterval(activeCascadeInterval);
        activeCascadeInterval = null;
        return;
      }
      const item = chain[activeCascadeStep - 1];
      const targetNuclide = nuclides.find(n => n.id === item.to);
      if (targetNuclide) {
        selectedSegreNuclide = targetNuclide;
        playTone(item.mode === 'alpha' ? 380 : 620, 'triangle', 0.12);
        updateSegreInspector(targetNuclide);
        drawSegreChart();
        drawAstonCurve(targetNuclide);
      }
      activeCascadeStep++;
    };

    stepFn();
    activeCascadeInterval = setInterval(stepFn, 700);
  }

  // Hook up Segrè Modal controls
  if (btnSegreChart) {
    btnSegreChart.addEventListener('click', () => {
      playTone(520, 'sine', 0.15);
      openDialog(segreModal, btnSegreChart);
      setTimeout(initSegreChart, 60);
    });
  }
  if (btnCloseSegre) {
    btnCloseSegre.addEventListener('click', () => {
      if (activeCascadeInterval) {
        clearInterval(activeCascadeInterval);
        activeCascadeInterval = null;
      }
      closeDialog(segreModal);
    });
  }
  if (segreCanvas) {
    segreCanvas.addEventListener('click', handleSegreCanvasClick);
    segreCanvas.addEventListener('mousemove', handleSegreCanvasMouseMove);
    segreCanvas.addEventListener('mouseleave', () => {
      if (segreTooltip) segreTooltip.style.display = 'none';
    });
  }
  const btnCascade = document.getElementById('btn-segre-play-chain');
  if (btnCascade) {
    btnCascade.addEventListener('click', playUraniumCascade);
  }
  const filterBtns = {
    all: document.getElementById('btn-segre-filter-all'),
    stable: document.getElementById('btn-segre-filter-stable'),
    fusion: document.getElementById('btn-segre-filter-fusion'),
    fission: document.getElementById('btn-segre-filter-fission')
  };
  Object.entries(filterBtns).forEach(([key, btn]) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      activeSegreFilter = key;
      Object.values(filterBtns).forEach(b => b?.classList.remove('active'));
      btn.classList.add('active');
      drawSegreChart();
    });
  });

  const btnSegreInjectIsotope = document.getElementById('btn-segre-inject-isotope');
  if (btnSegreInjectIsotope) {
    btnSegreInjectIsotope.addEventListener('click', () => {
      if (!selectedSegreNuclide) return;
      injectNuclideIntoSynthesis(selectedSegreNuclide);
    });
  }

  const btnInspectInSegre = document.getElementById('btn-inspect-in-segre');
  if (btnInspectInSegre) {
    btnInspectInSegre.addEventListener('click', () => {
      inspectCurrentInSegreChart();
    });
  }

  function injectNuclideIntoSynthesis(nuc) {
    if (!nuc || nuc.Z <= 0 || nuc.Z > 118) return;
    playTone(540, 'triangle', 0.2);

    const matchingAtoms = activeAtoms.filter(a => a.z === nuc.Z && !a.isElectron && !a.removing);
    if (matchingAtoms.length > 0) {
      matchingAtoms.forEach(a => {
        a.mass = nuc.A;
        a.physicalMass = nuc.A;
        a.isotopeName = nuc.symbol;
      });

      closeDialog(segreModal);
      refreshFtirSpectroscopy();

      updateTelemetry(
        `ISÓTOPO SUSTITUIDO // ${nuc.symbol} (A=${nuc.A})`,
        `Efecto isotópico activo: masa nuclear actualizada a ${nuc.A} u`,
        `Frecuencia FT-IR recalculada: ν̃ ∝ √(k/μ)`,
        `Periodo de semidesintegración: ${nuc.halfLife}`,
        `Energía de enlace SEMF: ${nuc.expBE || '—'} MeV/nucleón`
      );
    } else {
      if (selectedReactants.length >= MAX_REACTANTS) {
        selectedReactants.shift();
      }
      const sym = nuc.element || EL[nuc.Z]?.s || 'X';
      selectedReactants.push({
        z: nuc.Z,
        sym,
        mass: nuc.A,
        physicalMass: nuc.A,
        isotopeName: nuc.symbol,
        name: nuc.name || nuc.symbol
      });

      updateReactantsTrayHUD();
      closeDialog(segreModal);

      if (selectedReactants.length === 1) {
        formElement(nuc.Z);
        if (activeAtoms[0]) {
          activeAtoms[0].mass = nuc.A;
          activeAtoms[0].physicalMass = nuc.A;
          activeAtoms[0].isotopeName = nuc.symbol;
        }
      } else {
        renderSideBySidePreviewAtoms();
      }

      updateTelemetry(
        `ISÓTOPO EN BANDEJA // ${nuc.symbol}`,
        `Z=${nuc.Z} (${sym}) · N=${nuc.N} · A=${nuc.A} (${nuc.mode || 'ESTABLE'})`,
        `Preparado para síntesis química o canal nuclear`,
        `Masa nuclear: ${nuc.A} u · ${nuc.halfLife}`,
        `Pulsa 🧪 COMBINAR para sintetizar con este isótopo`
      );
    }
  }

  function inspectCurrentInSegreChart() {
    playTone(490, 'sine', 0.15);
    const nuclides = window.NULLA_NUCLEAR?.SEGRE_NUCLIDES || [];
    let targetZ = 26;
    let targetA = null;

    const realAtom = activeAtoms.find(a => !a.isElectron && !a.removing);
    if (realAtom) {
      targetZ = realAtom.z;
      targetA = realAtom.mass || realAtom.physicalMass || null;
    } else if (selectedReactants.length > 0) {
      targetZ = selectedReactants[0].z || 26;
      targetA = selectedReactants[0].mass || null;
    }

    let found = null;
    if (targetA) {
      found = nuclides.find(n => n.Z === targetZ && n.A === targetA);
    }
    if (!found) {
      found = nuclides.find(n => n.Z === targetZ && n.mode === 'stable') ||
              nuclides.find(n => n.Z === targetZ) ||
              nuclides.find(n => n.id === 'Fe56');
    }

    if (found) {
      selectedSegreNuclide = found;
      openDialog(segreModal, btnInspectInSegre);
      setTimeout(initSegreChart, 60);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FT-IR VIBRATIONAL SPECTROSCOPY & QUANTUM NORMAL MODES CONTROLLER
  // ═══════════════════════════════════════════════════════════════
  const btnFtir = document.getElementById('btn-ftir');
  const ftirModal = document.getElementById('ftir-modal');
  const btnCloseFtir = document.getElementById('btn-close-ftir');
  const ftirCanvas = document.getElementById('ftir-spectrum-canvas');
  const ftirTooltip = document.getElementById('ftir-canvas-tooltip');
  const btnFtirToggleVib = document.getElementById('btn-ftir-toggle-vib');
  const ftirAmpSlider = document.getElementById('ftir-amplitude-slider');

  let activeFtirData = null;
  let activeFtirModeId = 'all'; // 'all', 'sym', 'bend', 'asym'
  let isFtirVibrating = false;
  let ftirAmplitude = 1.0;
  let hoveredFtirWavenumber = null;

  function refreshFtirSpectroscopy() {
    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (!realAtoms.length) return;

    if (window.NULLA_COMPATIBILITY?.computeFTIRVibrationalSpectrum) {
      activeFtirData = window.NULLA_COMPATIBILITY.computeFTIRVibrationalSpectrum(realAtoms, activeBonds, temperatureK);
    }

    if (!activeFtirData) return;

    const elFormula = document.getElementById('ftir-mol-formula');
    const elAtomCount = document.getElementById('ftir-atom-count');
    const elBondCount = document.getElementById('ftir-bond-count');
    const elModeCount = document.getElementById('ftir-mode-count');
    const elTemp = document.getElementById('ftir-temp-k');
    const elBandsList = document.getElementById('ftir-bands-list');

    const formulaStr = activeReactionRef?.formula || hillFormula(realAtoms);
    if (elFormula) elFormula.textContent = formulaStr;
    if (elAtomCount) elAtomCount.textContent = activeFtirData.atomCount;
    if (elBondCount) elBondCount.textContent = activeFtirData.bondCount;
    const nAtoms = activeFtirData.atomCount;
    const modeCountTheoretical = nAtoms >= 3 ? Math.max(1, (3 * nAtoms) - 6) : 1;
    if (elModeCount) elModeCount.textContent = `${activeFtirData.modes.length} (${modeCountTheoretical} calc)`;
    if (elTemp) elTemp.textContent = `${temperatureK} K (${Math.round(temperatureK - 273.15)}°C)`;

    if (elBandsList) {
      elBandsList.innerHTML = '';
      if (!activeFtirData.modes.length) {
        elBandsList.innerHTML = '<div style="color:rgba(255,255,255,0.5);">Sin enlaces covalentes vibracionales activos.</div>';
      } else {
        const bandGroups = new Map();
        for (const mode of activeFtirData.modes) {
          const key = `${mode.wavenumberCm1}|${mode.name}`;
          const g = bandGroups.get(key);
          if (g) g.count++; else bandGroups.set(key, { mode, count: 1 });
        }
        const groupedBands = [...bandGroups.values()].sort((a, b) => b.mode.wavenumberCm1 - a.mode.wavenumberCm1);
        groupedBands.slice(0, MAX_LIST_ROWS).forEach(({ mode: m, count }) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:3px 6px; border-radius:4px; background:rgba(255,255,255,0.06); cursor:pointer;';
          row.title = `Fuerza k=${m.forceConstantNm} N/m · Masa reducida μ=${m.reducedMassU} u`;
          row.innerHTML = `<span style="color:#00F0FF; font-weight:700;">${m.wavenumberCm1} cm⁻¹</span> <span style="color:#FFF; font-size:7.5px;">${m.name}${count > 1 ? ` <b style="color:#BF00FF;">×${count}</b>` : ''}</span> <span style="color:#FFD700; font-size:7px;">${m.transmittancePct}% T</span>`;
          row.addEventListener('click', () => {
            activeFtirModeId = m.type === 'bend' ? 'bend' : 'sym';
            isFtirVibrating = true;
            updateFtirVibrationButtonState();
            playTone(m.wavenumberCm1 * 0.25, 'sine', 0.15);
            drawFtirSpectrum();
          });
          elBandsList.appendChild(row);
        });
        appendOverflowRow(elBandsList, groupedBands.length - MAX_LIST_ROWS);
      }
    }

    drawFtirSpectrum();
  }

  function drawFtirSpectrum() {
    if (!ftirCanvas || !activeFtirData) return;
    const ctx = ftirCanvas.getContext('2d');
    const w = ftirCanvas.width;
    const h = ftirCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const m = { top: 32, right: 28, bottom: 36, left: 46 };
    const plotW = w - m.left - m.right;
    const plotH = h - m.top - m.bottom;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#091220');
    bgGrad.addColorStop(1, '#04070d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    function nuToX(nu) {
      return m.left + ((4000 - nu) / (4000 - 400)) * plotW;
    }
    function tToY(tPct) {
      return m.top + ((100 - tPct) / 100) * plotH;
    }

    const diagnosticZones = [
      { start: 3650, end: 3200, label: 'O-H / N-H', color: 'rgba(0, 240, 255, 0.08)', border: 'rgba(0, 240, 255, 0.25)' },
      { start: 3050, end: 2850, label: 'C-H', color: 'rgba(0, 255, 157, 0.08)', border: 'rgba(0, 255, 157, 0.25)' },
      { start: 2260, end: 2100, label: 'C≡C / C≡N', color: 'rgba(255, 215, 0, 0.08)', border: 'rgba(255, 215, 0, 0.25)' },
      { start: 1750, end: 1680, label: 'C=O', color: 'rgba(255, 0, 85, 0.08)', border: 'rgba(255, 0, 85, 0.25)' },
      { start: 1400, end: 400, label: 'HUELLA DACTILAR', color: 'rgba(191, 0, 255, 0.06)', border: 'rgba(191, 0, 255, 0.2)' }
    ];

    diagnosticZones.forEach(z => {
      const x1 = nuToX(z.start);
      const x2 = nuToX(z.end);
      const zw = x2 - x1;
      ctx.fillStyle = z.color;
      ctx.fillRect(x1, m.top, zw, plotH);
      ctx.strokeStyle = z.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(x1, m.top, zw, plotH);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = '7.5px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.label, x1 + zw / 2, m.top + 12);
    });

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    [100, 80, 60, 40, 20, 0].forEach(tVal => {
      const y = tToY(tVal);
      ctx.beginPath();
      ctx.moveTo(m.left, y);
      ctx.lineTo(m.left + plotW, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '8px "Fira Code", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${tVal}%`, m.left - 6, y + 3);
    });

    [4000, 3500, 3000, 2500, 2000, 1500, 1000, 500].forEach(nuVal => {
      const x = nuToX(nuVal);
      ctx.beginPath();
      ctx.moveTo(x, m.top);
      ctx.lineTo(x, m.top + plotH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '8px "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${nuVal}`, x, m.top + plotH + 14);
    });

    ctx.fillStyle = '#00F0FF';
    ctx.font = '9px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NÚMERO DE ONDA ν̃ (cm⁻¹) ◄ ESCALA INVERTIDA IUPAC', m.left + plotW / 2, h - 8);

    ctx.save();
    ctx.translate(14, m.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#BF00FF';
    ctx.fillText('TRANSMITANCIA (%T)', 0, 0);
    ctx.restore();

    const curve = activeFtirData.spectrumCurve;
    if (curve && curve.length > 1) {
      ctx.save();
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#00FFCF';
      ctx.lineWidth = 2.2;
      ctx.beginPath();

      curve.forEach((pt, idx) => {
        const x = nuToX(pt.wavenumber);
        const y = tToY(pt.transmittancePct);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    activeFtirData.modes.forEach(mode => {
      const px = nuToX(mode.wavenumberCm1);
      const py = tToY(mode.transmittancePct);

      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px + 4, py);
      ctx.lineTo(px, py + 5);
      ctx.lineTo(px - 4, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '7.5px "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${mode.wavenumberCm1}`, px, py + 14);
    });

    if (hoveredFtirWavenumber !== null) {
      const hx = nuToX(hoveredFtirWavenumber);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#BF00FF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx, m.top);
      ctx.lineTo(hx, m.top + plotH);
      ctx.stroke();
      ctx.restore();
    }
  }

  function handleFtirCanvasMouseMove(e) {
    if (!ftirCanvas || !activeFtirData) return;
    const rect = ftirCanvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const scaleX = ftirCanvas.width / rect.width;
    const scaleY = ftirCanvas.height / rect.height;
    const canvasX = clientX * scaleX;
    const canvasY = clientY * scaleY;

    const m = { top: 32, right: 28, bottom: 36, left: 46 };
    const plotW = ftirCanvas.width - m.left - m.right;
    const plotH = ftirCanvas.height - m.top - m.bottom;

    if (canvasX < m.left || canvasX > m.left + plotW || canvasY < m.top || canvasY > m.top + plotH) {
      if (ftirTooltip) ftirTooltip.style.display = 'none';
      hoveredFtirWavenumber = null;
      drawFtirSpectrum();
      return;
    }

    const frac = (canvasX - m.left) / plotW;
    const nu = Math.round(4000 - frac * (4000 - 400));
    hoveredFtirWavenumber = nu;

    const pt = activeFtirData.spectrumCurve.find(p => Math.abs(p.wavenumber - nu) <= 4) || { transmittancePct: 95 };
    const closestPeak = activeFtirData.modes.find(mode => Math.abs(mode.wavenumberCm1 - nu) < 65);

    if (ftirTooltip) {
      ftirTooltip.style.display = 'block';
      ftirTooltip.style.left = `${clientX + 14}px`;
      ftirTooltip.style.top = `${clientY - 12}px`;
      if (closestPeak) {
        ftirTooltip.innerHTML = `<strong>ν̃ = ${closestPeak.wavenumberCm1} cm⁻¹</strong> (${closestPeak.transmittancePct}% T)<br><span style="color:#00FF9D;">${closestPeak.name}</span><br><span style="color:#FFD700;">k=${closestPeak.forceConstantNm} N/m · μ=${closestPeak.reducedMassU} u</span>`;
      } else {
        ftirTooltip.innerHTML = `ν̃ = <strong>${nu} cm⁻¹</strong><br>Transmitancia: <strong>${pt.transmittancePct}%</strong>`;
      }
    }

    drawFtirSpectrum();
  }

  function handleFtirCanvasClick(e) {
    if (!ftirCanvas || !activeFtirData) return;
    const rect = ftirCanvas.getBoundingClientRect();
    const scaleX = ftirCanvas.width / rect.width;
    const canvasX = (e.clientX - rect.left) * scaleX;

    const m = { top: 32, right: 28, bottom: 36, left: 46 };
    const plotW = ftirCanvas.width - m.left - m.right;
    const frac = (canvasX - m.left) / plotW;
    const nu = Math.round(4000 - frac * (4000 - 400));

    const closestPeak = activeFtirData.modes.find(mode => Math.abs(mode.wavenumberCm1 - nu) < 90);
    if (closestPeak) {
      activeFtirModeId = closestPeak.type === 'bend' ? 'bend' : 'sym';
      isFtirVibrating = true;
      updateFtirVibrationButtonState();
      playTone(closestPeak.wavenumberCm1 * 0.25, 'sine', 0.2);
      drawFtirSpectrum();
    }
  }

  function updateFtirVibrationButtonState() {
    if (!btnFtirToggleVib) return;
    if (isFtirVibrating) {
      btnFtirToggleVib.textContent = '▶ VIBRACIÓN 3D: ACTIVA';
      btnFtirToggleVib.style.color = '#00FFCF';
      btnFtirToggleVib.style.borderColor = 'rgba(0, 255, 157, 0.72)';
    } else {
      btnFtirToggleVib.textContent = '⏸ VIBRACIÓN 3D: PAUSADA';
      btnFtirToggleVib.style.color = '#FFAA00';
      btnFtirToggleVib.style.borderColor = 'rgba(255, 170, 0, 0.72)';
    }
  }

  if (btnFtir) {
    btnFtir.addEventListener('click', () => {
      playTone(480, 'sine', 0.15);
      isFtirVibrating = true;
      updateFtirVibrationButtonState();
      openDialog(ftirModal, btnFtir);
      setTimeout(refreshFtirSpectroscopy, 60);
    });
  }
  if (btnCloseFtir) {
    btnCloseFtir.addEventListener('click', () => {
      closeDialog(ftirModal);
    });
  }
  if (btnFtirToggleVib) {
    btnFtirToggleVib.addEventListener('click', () => {
      isFtirVibrating = !isFtirVibrating;
      updateFtirVibrationButtonState();
      playTone(isFtirVibrating ? 600 : 320, 'sine', 0.12);
    });
  }
  if (ftirAmpSlider) {
    ftirAmpSlider.addEventListener('input', () => {
      ftirAmplitude = parseFloat(ftirAmpSlider.value) || 1.0;
    });
  }
  if (ftirCanvas) {
    ftirCanvas.addEventListener('click', handleFtirCanvasClick);
    ftirCanvas.addEventListener('mousemove', handleFtirCanvasMouseMove);
    ftirCanvas.addEventListener('mouseleave', () => {
      if (ftirTooltip) ftirTooltip.style.display = 'none';
      hoveredFtirWavenumber = null;
      drawFtirSpectrum();
    });
  }

  const ftirModeBtns = {
    all: document.getElementById('btn-ftir-mode-all'),
    sym: document.getElementById('btn-ftir-mode-sym'),
    bend: document.getElementById('btn-ftir-mode-bend'),
    asym: document.getElementById('btn-ftir-mode-asym')
  };
  Object.entries(ftirModeBtns).forEach(([key, btn]) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      activeFtirModeId = key;
      isFtirVibrating = true;
      updateFtirVibrationButtonState();
      Object.values(ftirModeBtns).forEach(b => b?.classList.remove('active'));
      btn.classList.add('active');
      playTone(550, 'sine', 0.1);
      drawFtirSpectrum();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FRONTIER MOLECULAR ORBITALS (HOMO / LUMO) & QUANTUM REACTIVITY
  // ═══════════════════════════════════════════════════════════════
  const btnHomoLumo = document.getElementById('btn-homo-lumo');
  const homoLumoModal = document.getElementById('homo-lumo-modal');
  const btnCloseHomoLumo = document.getElementById('btn-close-homo-lumo');
  const orbitalCanvas = document.getElementById('orbital-levels-canvas');
  const orbitalTooltip = document.getElementById('orbital-canvas-tooltip');
  const orbitalIsoSlider = document.getElementById('orbital-isovalue-slider');

  let activeHomoLumoData = null;
  let activeOrbitalMode = 'homo'; // 'none', 'homo', 'lumo', 'both'
  let orbitalIsovalue = 1.0;
  let hoveredOrbitalLevel = null;

  function clearMolecularHOMOLUMOCloud() {
    if (molecularHOMOLUMOSystem) {
      moleculeGroup.remove(molecularHOMOLUMOSystem);
      molecularHOMOLUMOSystem.geometry.dispose();
      molecularHOMOLUMOSystem.material.dispose();
      molecularHOMOLUMOSystem = null;
    }
  }

  function generateMolecularHOMOLUMOCloud(mode = activeOrbitalMode, isovalue = orbitalIsovalue) {
    clearMolecularHOMOLUMOCloud();
    if (mode === 'none') return;

    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (!realAtoms.length) return;

    const formulaStr = activeReactionRef?.formula || hillFormula(realAtoms);
    if (!activeHomoLumoData || activeHomoLumoData.formula !== formulaStr.replace(/[^A-Za-z0-9]/g, '')) {
      if (window.NULLA_COMPATIBILITY?.computeHOMOLUMOProperties) {
        activeHomoLumoData = window.NULLA_COMPATIBILITY.computeHOMOLUMOProperties(realAtoms, activeBonds, formulaStr, temperatureK);
      }
    }
    if (!activeHomoLumoData) return;

    const count = 3800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const homoPosColor = new THREE.Color(0x00F0FF); // +ψ HOMO (Cyan)
    const homoNegColor = new THREE.Color(0x3b59ff); // -ψ HOMO (Deep Blue/Violet)
    const lumoPosColor = new THREE.Color(0xFFD700); // +ψ LUMO (Gold)
    const lumoNegColor = new THREE.Color(0xFF4500); // -ψ LUMO (Orange/Crimson)
    const nodeColor = new THREE.Color(0xFFFFFF);    // Nodal interface

    let accepted = 0;
    let attempts = 0;
    const maxAttempts = count * 22;

    while (accepted < count && attempts < maxAttempts) {
      attempts++;
      // Pick an atom center weighted by electronegativity and role
      const atomIdx = Math.floor(Math.random() * realAtoms.length);
      const atom = realAtoms[atomIdx];
      const z = Number(atom.z) || 1;
      const el = EL[z] || EL[1];
      const en = el?.electronegativity || 2.2;

      // Determine if this point represents HOMO or LUMO
      let isHomo = true;
      if (mode === 'homo') isHomo = true;
      else if (mode === 'lumo') isHomo = false;
      else if (mode === 'both') isHomo = Math.random() < 0.5;

      // Weighting: HOMO concentrates on high EN (nucleophilic); LUMO on low EN / electropositive centers
      const homoWeight = Math.max(0.2, (en - 1.2) / 2.6);
      const lumoWeight = Math.max(0.2, (4.0 - en) / 2.6);
      const affinity = isHomo ? homoWeight : lumoWeight;
      if (Math.random() > affinity) continue;

      // Spherical coordinates around chosen atom
      const u = Math.random();
      const v = Math.random();
      const phi = u * 2.0 * Math.PI;
      const cosTheta = 2.0 * v - 1.0;
      const sinTheta = Math.sqrt(Math.max(0, 1.0 - cosTheta * cosTheta));
      const radiusScale = (el.radius || 35) / 38.0;
      const r = Math.pow(Math.random(), 0.75) * (7.5 * radiusScale);

      // Orbital wavefunction lobe: p-like directional or s-like
      let psi = 0;
      if (isHomo) {
        // Lone pair / pi lobe directed outwards or along z-axis
        psi = Math.exp(-r / (2.6 * isovalue)) * (cosTheta + 0.3 * Math.sin(phi));
      } else {
        // LUMO anti-bonding lobe with clear nodal plane (cosTheta changes sign sharply)
        psi = (r / 2.2) * Math.exp(-r / (2.8 * isovalue)) * (cosTheta * Math.cos(phi));
      }

      const prob = psi * psi;
      if (Math.random() > Math.min(1.0, prob * 2.8 * isovalue)) continue;

      const lx = r * sinTheta * Math.cos(phi);
      const ly = r * cosTheta;
      const lz = r * sinTheta * Math.sin(phi);

      const basePos = atom.mesh?.position || atom.basePos || new THREE.Vector3(0, 0, 0);
      positions[accepted * 3] = basePos.x + lx;
      positions[accepted * 3 + 1] = basePos.y + ly;
      positions[accepted * 3 + 2] = basePos.z + lz;

      let ptColor = nodeColor;
      if (Math.abs(psi) < 0.05) {
        ptColor = nodeColor;
      } else if (isHomo) {
        ptColor = psi >= 0 ? homoPosColor : homoNegColor;
      } else {
        ptColor = psi >= 0 ? lumoPosColor : lumoNegColor;
      }

      colors[accepted * 3] = ptColor.r;
      colors[accepted * 3 + 1] = ptColor.g;
      colors[accepted * 3 + 2] = ptColor.b;
      accepted++;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.95,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    molecularHOMOLUMOSystem = new THREE.Points(geometry, material);
    moleculeGroup.add(molecularHOMOLUMOSystem);
  }

  function refreshHOMOLUMOSpectroscopy() {
    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (!realAtoms.length) return;

    const formulaStr = activeReactionRef?.formula || hillFormula(realAtoms);
    if (window.NULLA_COMPATIBILITY?.computeHOMOLUMOProperties) {
      activeHomoLumoData = window.NULLA_COMPATIBILITY.computeHOMOLUMOProperties(realAtoms, activeBonds, formulaStr, temperatureK);
    }
    if (!activeHomoLumoData) return;

    const elFormula = document.getElementById('homo-lumo-mol-formula');
    const elRegime = document.getElementById('homo-lumo-regime-badge');
    const elHomo = document.getElementById('homo-energy-val');
    const elLumo = document.getElementById('lumo-energy-val');
    const elEg = document.getElementById('bandgap-energy-val');
    const elHardness = document.getElementById('pearson-hardness-val');
    const elPot = document.getElementById('chemical-potential-val');
    const elElectrophilicity = document.getElementById('parr-electrophilicity-val');
    const elSites = document.getElementById('homo-lumo-reactive-sites');

    if (elFormula) elFormula.textContent = formulaStr;
    if (elRegime) {
      elRegime.textContent = activeHomoLumoData.regime.replace(/_/g, ' ');
      if (activeHomoLumoData.bandgapEv < 0.3) {
        elRegime.style.color = '#00FF9D';
        elRegime.style.borderColor = '#00FF9D';
      } else if (activeHomoLumoData.bandgapEv <= 4.0) {
        elRegime.style.color = '#00F0FF';
        elRegime.style.borderColor = '#00F0FF';
      } else {
        elRegime.style.color = '#FFD700';
        elRegime.style.borderColor = '#FFD700';
      }
    }
    if (elHomo) elHomo.textContent = `${activeHomoLumoData.homoEv.toFixed(2)} eV`;
    if (elLumo) elLumo.textContent = `${activeHomoLumoData.lumoEv.toFixed(2)} eV`;
    if (elEg) elEg.textContent = `${activeHomoLumoData.bandgapEv.toFixed(2)} eV`;
    if (elHardness) elHardness.textContent = `${activeHomoLumoData.hardnessEtaEv.toFixed(2)} eV`;
    if (elPot) elPot.textContent = `${activeHomoLumoData.chemicalPotentialEv.toFixed(2)} eV`;
    if (elElectrophilicity) elElectrophilicity.textContent = `${activeHomoLumoData.electrophilicityOmegaEv.toFixed(2)} eV`;

    if (elSites) {
      elSites.innerHTML = '';
      const allSites = [
        ...activeHomoLumoData.nucleophilicSites.map(s => ({ ...s, tag: 'NUCLEÓFILO (HOMO)', tagCol: '#00F0FF' })),
        ...activeHomoLumoData.electrophilicSites.map(s => ({ ...s, tag: 'ELECTRÓFILO (LUMO)', tagCol: '#FF5500' }))
      ];
      if (!allSites.length) {
        elSites.innerHTML = '<div style="color:rgba(255,255,255,0.5);">Sin sitios frontera diferenciados.</div>';
      } else {
        const siteGroups = new Map();
        for (const site of allSites) {
          const key = `${site.symbol}|${site.tag}|${site.role}`;
          const g = siteGroups.get(key);
          if (g) g.count++; else siteGroups.set(key, { ...site, count: 1 });
        }
        const groupedSites = [...siteGroups.values()];
        groupedSites.slice(0, MAX_LIST_ROWS).forEach(s => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:3px 6px; border-radius:4px; background:rgba(255,255,255,0.06); cursor:pointer;';
          row.title = `Átomo ${s.symbol} (Z=${s.z}) · Electronegatividad χ=${s.electronegativity}`;
          row.innerHTML = `<span style="color:${s.tagCol}; font-weight:700;">${s.symbol}${s.count > 1 ? ` ×${s.count}` : ''}</span> <span style="color:#FFF; font-size:7.5px;">${s.role}</span> <span style="color:#FFD700; font-size:7px;">χ=${s.electronegativity}</span>`;
          row.addEventListener('click', () => {
            activeOrbitalMode = s.tag.includes('HOMO') ? 'homo' : 'lumo';
            updateHomoLumoButtons();
            generateMolecularHOMOLUMOCloud(activeOrbitalMode, orbitalIsovalue);
            playTone(450, 'sine', 0.1);
          });
          elSites.appendChild(row);
        });
        appendOverflowRow(elSites, groupedSites.length - MAX_LIST_ROWS);
      }
    }

    drawOrbitalEnergyLadder();
    generateMolecularHOMOLUMOCloud(activeOrbitalMode, orbitalIsovalue);
  }

  function drawOrbitalEnergyLadder() {
    if (!orbitalCanvas || !activeHomoLumoData) return;
    const ctx = orbitalCanvas.getContext('2d');
    const w = orbitalCanvas.width;
    const h = orbitalCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const m = { top: 32, right: 36, bottom: 32, left: 54 };
    const plotW = w - m.left - m.right;
    const plotH = h - m.top - m.bottom;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#091220');
    bgGrad.addColorStop(1, '#04070d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const eMin = -16.0;
    const eMax = 0.0;
    function eToY(ev) {
      const clamped = Math.max(eMin, Math.min(eMax, ev));
      return m.top + ((eMax - clamped) / (eMax - eMin)) * plotH;
    }

    // Grid ticks & energy scale (-16 to 0 eV)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let ev = 0; ev >= eMin; ev -= 2) {
      const y = eToY(ev);
      ctx.beginPath();
      ctx.moveTo(m.left, y);
      ctx.lineTo(m.left + plotW, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = '8px "Fira Code", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${ev} eV`, m.left - 8, y + 3);
    }

    // Vacuum Level (0 eV)
    const vacY = eToY(0.0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.left, vacY);
    ctx.lineTo(m.left + plotW, vacY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '7.5px "Orbitron", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NIVEL DE VACÍO (Evac = 0 eV)', m.left + 8, vacY - 4);

    // Fermi Level line (dotted violet)
    const ef = activeHomoLumoData.chemicalPotentialEv;
    const efY = eToY(ef);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#BF00FF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.left, efY);
    ctx.lineTo(m.left + plotW, efY);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#BF00FF';
    ctx.font = '8px "Fira Code", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Ef ≈ ${ef.toFixed(2)} eV (Fermi)`, m.left + 8, efY - 4);

    // Bandgap bracket between HOMO and LUMO
    const homoY = eToY(activeHomoLumoData.homoEv);
    const lumoY = eToY(activeHomoLumoData.lumoEv);
    const bracketX = m.left + plotW - 40;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bracketX - 10, lumoY);
    ctx.lineTo(bracketX, lumoY);
    ctx.lineTo(bracketX, homoY);
    ctx.lineTo(bracketX - 10, homoY);
    ctx.stroke();

    const gapMidY = (lumoY + homoY) / 2;
    ctx.fillStyle = '#FFD700';
    ctx.font = '8.5px "Orbitron", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Eg = ${activeHomoLumoData.bandgapEv.toFixed(2)} eV`, bracketX - 14, gapMidY + 3);

    // Render individual orbital levels
    const barW = 200;
    const barX1 = m.left + 90;
    const barX2 = barX1 + barW;

    activeHomoLumoData.energyLevels.forEach(lvl => {
      const y = eToY(lvl.energy);
      const isHomo = lvl.type === 'frontier_homo';
      const isLumo = lvl.type === 'frontier_lumo';
      const isHovered = hoveredOrbitalLevel && hoveredOrbitalLevel.id === lvl.id;

      let strokeCol = lvl.occupied ? '#00F0FF' : '#FF5500';
      if (isHomo) strokeCol = '#00FFCF';
      if (isLumo) strokeCol = '#FFAA00';

      ctx.save();
      ctx.lineWidth = isHomo || isLumo ? 3.5 : (isHovered ? 3 : 2);
      ctx.strokeStyle = strokeCol;
      ctx.beginPath();
      ctx.moveTo(barX1, y);
      ctx.lineTo(barX2, y);
      ctx.stroke();
      ctx.restore();

      // Electron spin arrows (⥮ paired for occupied)
      if (lvl.occupied) {
        ctx.fillStyle = '#00F0FF';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⥮', (barX1 + barX2) / 2, y + 3);
      } else {
        ctx.fillStyle = 'rgba(255, 85, 0, 0.7)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('○', (barX1 + barX2) / 2, y + 3);
      }

      // Orbital label (left of bar)
      ctx.fillStyle = isHomo ? '#00FFCF' : (isLumo ? '#FFAA00' : 'rgba(255, 255, 255, 0.85)');
      ctx.font = isHomo || isLumo ? '8px "Orbitron", sans-serif' : '7.5px "Orbitron", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(lvl.label, barX1 - 10, y + 3);

      // Energy value (right of bar)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '8px "Fira Code", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${lvl.energy.toFixed(2)} eV`, barX2 + 10, y + 3);
    });
  }

  function handleOrbitalCanvasMouseMove(e) {
    if (!orbitalCanvas || !activeHomoLumoData) return;
    const rect = orbitalCanvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const scaleX = orbitalCanvas.width / rect.width;
    const scaleY = orbitalCanvas.height / rect.height;
    const canvasY = clientY * scaleY;

    const m = { top: 32, right: 36, bottom: 32, left: 54 };
    const plotH = orbitalCanvas.height - m.top - m.bottom;
    const eMin = -16.0;
    const eMax = 0.0;

    let closest = null;
    let minDy = 12;

    activeHomoLumoData.energyLevels.forEach(lvl => {
      const y = m.top + ((eMax - lvl.energy) / (eMax - eMin)) * plotH;
      const dy = Math.abs(y - canvasY);
      if (dy < minDy) {
        minDy = dy;
        closest = lvl;
      }
    });

    hoveredOrbitalLevel = closest;

    if (orbitalTooltip) {
      if (closest) {
        orbitalTooltip.style.display = 'block';
        orbitalTooltip.style.left = `${clientX + 14}px`;
        orbitalTooltip.style.top = `${clientY - 12}px`;
        const role = closest.occupied
          ? (closest.type === 'frontier_homo' ? 'HOMO (Dador Nucleófilo · Par Libre / π)' : 'Orbital Enlazante Ocupado (2 e⁻)')
          : (closest.type === 'frontier_lumo' ? 'LUMO (Aceptor Electrófilo · Antienlazante σ*/π*)' : 'Orbital Antienlazante Vacío (0 e⁻)');
        orbitalTooltip.innerHTML = `<strong>${closest.label}</strong>: <strong>${closest.energy.toFixed(2)} eV</strong><br><span style="color:#00FFCF;">${role}</span>`;
      } else {
        orbitalTooltip.style.display = 'none';
      }
    }

    drawOrbitalEnergyLadder();
  }

  function handleOrbitalCanvasClick(e) {
    if (!hoveredOrbitalLevel) return;
    playTone(520, 'sine', 0.15);
    if (hoveredOrbitalLevel.type === 'frontier_homo') {
      activeOrbitalMode = 'homo';
    } else if (hoveredOrbitalLevel.type === 'frontier_lumo') {
      activeOrbitalMode = 'lumo';
    } else {
      activeOrbitalMode = hoveredOrbitalLevel.occupied ? 'homo' : 'lumo';
    }
    updateHomoLumoButtons();
    generateMolecularHOMOLUMOCloud(activeOrbitalMode, orbitalIsovalue);
  }

  const homoModeBtns = {
    none: document.getElementById('btn-homo-mode-none'),
    homo: document.getElementById('btn-homo-mode-homo'),
    lumo: document.getElementById('btn-homo-mode-lumo'),
    both: document.getElementById('btn-homo-mode-both')
  };

  function updateHomoLumoButtons() {
    Object.entries(homoModeBtns).forEach(([key, btn]) => {
      if (!btn) return;
      if (key === activeOrbitalMode) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  Object.entries(homoModeBtns).forEach(([key, btn]) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      activeOrbitalMode = key;
      updateHomoLumoButtons();
      playTone(560, 'sine', 0.1);
      generateMolecularHOMOLUMOCloud(activeOrbitalMode, orbitalIsovalue);
    });
  });

  if (btnHomoLumo) {
    btnHomoLumo.addEventListener('click', () => {
      playTone(580, 'sine', 0.15);
      openDialog(homoLumoModal, btnHomoLumo);
      setTimeout(refreshHOMOLUMOSpectroscopy, 60);
    });
  }
  if (btnCloseHomoLumo) {
    btnCloseHomoLumo.addEventListener('click', () => {
      closeDialog(homoLumoModal);
    });
  }
  if (orbitalIsoSlider) {
    orbitalIsoSlider.addEventListener('input', () => {
      orbitalIsovalue = parseFloat(orbitalIsoSlider.value) || 1.0;
      generateMolecularHOMOLUMOCloud(activeOrbitalMode, orbitalIsovalue);
    });
  }
  if (orbitalCanvas) {
    orbitalCanvas.addEventListener('click', handleOrbitalCanvasClick);
    orbitalCanvas.addEventListener('mousemove', handleOrbitalCanvasMouseMove);
    orbitalCanvas.addEventListener('mouseleave', () => {
      if (orbitalTooltip) orbitalTooltip.style.display = 'none';
      hoveredOrbitalLevel = null;
      drawOrbitalEnergyLadder();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // MOLECULAR ELECTROSTATIC POTENTIAL (MEP / ESP) & DIPOLE ENGINE
  // ═══════════════════════════════════════════════════════════════
  const btnMep = document.getElementById('btn-mep');
  const mepModal = document.getElementById('mep-modal');
  const btnCloseMep = document.getElementById('btn-close-mep');
  const mepCanvas = document.getElementById('mep-canvas');
  const mepTooltip = document.getElementById('mep-canvas-tooltip');
  const mepOpacitySlider = document.getElementById('mep-opacity-slider');
  const mepProbeSlider = document.getElementById('mep-probe-slider');
  const btnToggleMepSurface = document.getElementById('btn-toggle-mep-surface');
  const btnToggleMepDipole = document.getElementById('btn-toggle-mep-dipole');

  let activeMEPData = null;
  let isMEPSurfaceActive = true;
  let isMEPDipoleActive = true;
  let mepOpacity = 0.75;
  let mepProbeRadius = 1.2;
  let hoveredMEPPotential = null;

  function clearMEPSurface() {
    if (molecularMEPSystem) {
      moleculeGroup.remove(molecularMEPSystem);
      molecularMEPSystem.geometry.dispose();
      molecularMEPSystem.material.dispose();
      molecularMEPSystem = null;
    }
  }

  function clearDipoleArrow() {
    if (molecularDipoleArrow) {
      moleculeGroup.remove(molecularDipoleArrow);
      molecularDipoleArrow = null;
    }
  }

  // Smooth RGB diverging colormap for electrostatic potential V (in eV)
  // Red (V < -1.5) -> Yellow (V ~ -0.5) -> Green (V = 0) -> Cyan (V ~ +0.8) -> Blue (V > +1.5)
  function getMEPColor(v) {
    const clamped = Math.max(-2.5, Math.min(2.5, v));
    let r = 0, g = 0, b = 0;
    if (clamped < 0) {
      // Negative potential: Red to Light Green
      const t = (clamped + 2.5) / 2.5; // 0 (pure red) to 1 (green)
      r = 1.0 - t * 0.9;
      g = t * 0.9 + (1.0 - t) * 0.09;
      b = (1.0 - t) * 0.26 + t * 0.46;
    } else {
      // Positive potential: Light Green to Royal Blue
      const t = clamped / 2.5; // 0 (green) to 1 (royal blue)
      r = (1.0 - t) * 0.1 + t * 0.16;
      g = (1.0 - t) * 0.9 + t * 0.47;
      b = (1.0 - t) * 0.46 + t * 1.0;
    }
    return { r, g, b };
  }

  function generateMEPSurface(opacity = mepOpacity, probeScale = mepProbeRadius) {
    clearMEPSurface();
    if (!isMEPSurfaceActive) return;

    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (!realAtoms.length) return;

    if (window.NULLA_COMPATIBILITY?.computeMolecularElectrostaticPotential) {
      activeMEPData = window.NULLA_COMPATIBILITY.computeMolecularElectrostaticPotential(realAtoms, activeBonds, temperatureK);
    }
    if (!activeMEPData || !activeMEPData.surfacePoints.length) return;

    const count = activeMEPData.surfacePoints.length;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    activeMEPData.surfacePoints.forEach((pt, idx) => {
      // Surface position scaled by probe scale
      const parentAtom = realAtoms[pt.parentAtomIndex] || realAtoms[0];
      const basePos = parentAtom.mesh?.position || parentAtom.basePos || new THREE.Vector3(0, 0, 0);

      // Relative displacement from parent atom
      const dx = (pt.x - (Number(parentAtom.x) || 0)) * probeScale;
      const dy = (pt.y - (Number(parentAtom.y) || 0)) * probeScale;
      const dz = (pt.z - (Number(parentAtom.zCoord !== undefined ? parentAtom.zCoord : 0))) * probeScale;

      positions[idx * 3] = basePos.x + dx;
      positions[idx * 3 + 1] = basePos.y + dy;
      positions[idx * 3 + 2] = basePos.z + dz;

      const col = getMEPColor(pt.vEv);
      colors[idx * 3] = col.r;
      colors[idx * 3 + 1] = col.g;
      colors[idx * 3 + 2] = col.b;
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.15,
      vertexColors: true,
      transparent: true,
      opacity: Math.max(0.15, Math.min(1.0, opacity)),
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    molecularMEPSystem = new THREE.Points(geometry, material);
    moleculeGroup.add(molecularMEPSystem);
  }

  function generateDipoleArrow() {
    clearDipoleArrow();
    if (!isMEPDipoleActive || !activeMEPData) return;
    if (activeMEPData.dipoleDebye < 0.12) return;

    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (!realAtoms.length) return;

    // Calculate center of mass in 3D scene space
    const origin = new THREE.Vector3(0, 0, 0);
    let totalWeight = 0;
    realAtoms.forEach(a => {
      const pos = a.mesh?.position || a.basePos || new THREE.Vector3(0, 0, 0);
      const mass = Number(a.mass) || Number(a.m) || 12.0;
      origin.addScaledVector(pos, mass);
      totalWeight += mass;
    });
    origin.divideScalar(Math.max(1e-5, totalWeight));

    const dir = new THREE.Vector3(
      activeMEPData.dipoleVector.x,
      activeMEPData.dipoleVector.y,
      activeMEPData.dipoleVector.z
    );
    if (dir.lengthSq() < 1e-4) return;
    dir.normalize();

    const arrowLength = Math.max(4.5, Math.min(22.0, activeMEPData.dipoleDebye * 4.2));
    molecularDipoleArrow = new THREE.ArrowHelper(dir, origin, arrowLength, 0xFFD700, 2.2, 1.4);
    moleculeGroup.add(molecularDipoleArrow);
  }

  function refreshMEPSpectroscopy() {
    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (!realAtoms.length) return;

    if (window.NULLA_COMPATIBILITY?.computeMolecularElectrostaticPotential) {
      activeMEPData = window.NULLA_COMPATIBILITY.computeMolecularElectrostaticPotential(realAtoms, activeBonds, temperatureK);
    }
    if (!activeMEPData) return;

    const elFormula = document.getElementById('mep-mol-formula');
    const elPolarity = document.getElementById('mep-polarity-badge');
    const elDipole = document.getElementById('mep-dipole-val');
    const elDipoleVector = document.getElementById('mep-dipole-vector');
    const elVmin = document.getElementById('mep-vmin-val');
    const elVmax = document.getElementById('mep-vmax-val');
    const elVmean = document.getElementById('mep-vmean-val');
    const elVariance = document.getElementById('mep-variance-val');
    const elHbond = document.getElementById('mep-hbond-sites');

    const formulaStr = activeReactionRef?.formula || hillFormula(activeAtoms.filter(a => !a.isElectron && !a.removing));
    if (elFormula) elFormula.textContent = formulaStr;
    if (elPolarity) {
      elPolarity.textContent = activeMEPData.polarityRegime.replace(/_/g, ' ');
      if (activeMEPData.dipoleDebye >= 2.0) {
        elPolarity.style.color = '#FF1744';
        elPolarity.style.borderColor = '#FF1744';
      } else if (activeMEPData.dipoleDebye >= 0.8) {
        elPolarity.style.color = '#00F0FF';
        elPolarity.style.borderColor = '#00F0FF';
      } else {
        elPolarity.style.color = '#00FF9D';
        elPolarity.style.borderColor = '#00FF9D';
      }
    }
    if (elDipole) elDipole.textContent = `${activeMEPData.dipoleDebye.toFixed(2)} D`;
    if (elDipoleVector) {
      elDipoleVector.textContent = `(${activeMEPData.dipoleVector.x.toFixed(2)}, ${activeMEPData.dipoleVector.y.toFixed(2)}, ${activeMEPData.dipoleVector.z.toFixed(2)}) D`;
    }
    if (elVmin) elVmin.textContent = `${activeMEPData.vMinEv.toFixed(2)} eV`;
    if (elVmax) elVmax.textContent = `${activeMEPData.vMaxEv.toFixed(2)} eV`;
    if (elVmean) elVmean.textContent = `${activeMEPData.vMeanEv.toFixed(2)} eV`;
    if (elVariance) elVariance.textContent = `${activeMEPData.varianceEv2.toFixed(2)} eV²`;

    if (elHbond) {
      elHbond.innerHTML = '';
      const allSites = [
        ...activeMEPData.hydrogenBondAcceptors.map(s => ({ ...s, tag: 'ACEPTOR (ROJO)', tagCol: '#FF1744' })),
        ...activeMEPData.hydrogenBondDonors.map(s => ({ ...s, tag: 'DADOR (AZUL)', tagCol: '#2979FF' }))
      ];
      if (!allSites.length) {
        elHbond.innerHTML = '<div style="color:rgba(255,255,255,0.5);">Sin sitios activos de puente de hidrógeno.</div>';
      } else {
        const siteGroups = new Map();
        for (const site of allSites) {
          const key = `${site.symbol}|${site.tag}|${site.role}`;
          const g = siteGroups.get(key);
          if (g) g.count++; else siteGroups.set(key, { ...site, count: 1 });
        }
        const groupedSites = [...siteGroups.values()];
        groupedSites.slice(0, MAX_LIST_ROWS).forEach(s => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:3px 6px; border-radius:4px; background:rgba(255,255,255,0.06); cursor:pointer;';
          row.title = `Átomo ${s.symbol} (Z=${s.z}) · Carga q=${s.charge} e`;
          row.innerHTML = `<span style="color:${s.tagCol}; font-weight:700;">${s.symbol}${s.count > 1 ? ` ×${s.count}` : ''}</span> <span style="color:#FFF; font-size:7.5px;">${s.role}</span> <span style="color:#FFD700; font-size:7px;">q=${s.charge > 0 ? '+' : ''}${s.charge} e</span>`;
          elHbond.appendChild(row);
        });
      }
    }

    drawMEPCanvas();
    generateMEPSurface(mepOpacity, mepProbeRadius);
    generateDipoleArrow();
  }

  function drawMEPCanvas() {
    if (!mepCanvas || !activeMEPData) return;
    const ctx = mepCanvas.getContext('2d');
    const w = mepCanvas.width;
    const h = mepCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const m = { top: 32, right: 30, bottom: 36, left: 48 };
    const plotW = w - m.left - m.right;
    const plotH = h - m.top - m.bottom;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#091220');
    bgGrad.addColorStop(1, '#04070d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const vMinAxis = -6.0;
    const vMaxAxis = 6.0;
    function vToX(v) {
      return m.left + ((v - vMinAxis) / (vMaxAxis - vMinAxis)) * plotW;
    }

    const curve = activeMEPData.mepDistributionCurve || [];
    const maxDensity = Math.max(1, ...curve.map(c => c.densityPct));
    function dToY(pct) {
      return m.top + ((maxDensity - pct) / maxDensity) * plotH;
    }

    // Grid ticks (V from -6 to +6 eV)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let v = -6; v <= 6; v += 2) {
      const x = vToX(v);
      ctx.beginPath();
      ctx.moveTo(x, m.top);
      ctx.lineTo(x, m.top + plotH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.font = '8px "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${v > 0 ? '+' : ''}${v} eV`, x, m.top + plotH + 14);
    }

    // Zero-potential line (V = 0 eV, Neutral boundary)
    const zeroX = vToX(0.0);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#00E676';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(zeroX, m.top);
    ctx.lineTo(zeroX, m.top + plotH);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#00E676';
    ctx.font = '7.5px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POTENCIAL NEUTRO (V = 0 eV)', zeroX, m.top + 12);

    // Color gradient fill under the distribution curve
    if (curve.length > 1) {
      const grad = ctx.createLinearGradient(m.left, 0, m.left + plotW, 0);
      grad.addColorStop(0.0, '#FF1744');  // -6 eV
      grad.addColorStop(0.35, '#FF9100'); // -2 eV
      grad.addColorStop(0.5, '#00E676');  // 0 eV
      grad.addColorStop(0.65, '#00E5FF'); // +2 eV
      grad.addColorStop(1.0, '#2979FF');  // +6 eV

      ctx.beginPath();
      ctx.moveTo(vToX(curve[0].vEv), m.top + plotH);
      curve.forEach(pt => {
        ctx.lineTo(vToX(pt.vEv), dToY(pt.densityPct));
      });
      ctx.lineTo(vToX(curve[curve.length - 1].vEv), m.top + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Curve stroke
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      curve.forEach((pt, i) => {
        const x = vToX(pt.vEv);
        const y = dToY(pt.densityPct);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Min and Max potential indicators
    const minX = vToX(activeMEPData.vMinEv);
    ctx.fillStyle = '#FF1744';
    ctx.font = '8px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`V(min)=${activeMEPData.vMinEv} eV`, minX, m.top + plotH - 8);

    const maxX = vToX(activeMEPData.vMaxEv);
    ctx.fillStyle = '#2979FF';
    ctx.font = '8px "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`V(max)=+${activeMEPData.vMaxEv} eV`, maxX, m.top + 24);

    // Hovered potential line
    if (hoveredMEPPotential !== null) {
      const hx = vToX(hoveredMEPPotential);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx, m.top);
      ctx.lineTo(hx, m.top + plotH);
      ctx.stroke();
      ctx.restore();
    }
  }

  function handleMEPCanvasMouseMove(e) {
    if (!mepCanvas || !activeMEPData) return;
    const rect = mepCanvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const scaleX = mepCanvas.width / rect.width;
    const canvasX = clientX * scaleX;

    const m = { top: 32, right: 30, bottom: 36, left: 48 };
    const plotW = mepCanvas.width - m.left - m.right;

    if (canvasX < m.left || canvasX > m.left + plotW) {
      if (mepTooltip) mepTooltip.style.display = 'none';
      hoveredMEPPotential = null;
      drawMEPCanvas();
      return;
    }

    const frac = (canvasX - m.left) / plotW;
    const v = Number((-6.0 + frac * 12.0).toFixed(2));
    hoveredMEPPotential = v;

    const closestPoint = activeMEPData.mepDistributionCurve.find(c => Math.abs(c.vEv - v) <= 0.25) || { densityPct: 0 };

    if (mepTooltip) {
      mepTooltip.style.display = 'block';
      mepTooltip.style.left = `${clientX + 14}px`;
      mepTooltip.style.top = `${clientY - 12}px`;
      const region = v < -0.8 ? '<span style="color:#FF1744;">Región Electronegativa (Aceptor H-Bond)</span>'
        : (v > 0.8 ? '<span style="color:#2979FF;">Región Electropositiva (Dador H-Bond)</span>'
        : '<span style="color:#00E676;">Región Neutra</span>');
      mepTooltip.innerHTML = `<strong>V = ${v > 0 ? '+' : ''}${v} eV</strong> (${closestPoint.densityPct}% superficie)<br>${region}`;
    }

    drawMEPCanvas();
  }

  if (btnMep) {
    btnMep.addEventListener('click', () => {
      playTone(620, 'sine', 0.15);
      openDialog(mepModal, btnMep);
      setTimeout(refreshMEPSpectroscopy, 60);
    });
  }
  if (btnCloseMep) {
    btnCloseMep.addEventListener('click', () => {
      closeDialog(mepModal);
    });
  }
  if (btnToggleMepSurface) {
    btnToggleMepSurface.addEventListener('click', () => {
      isMEPSurfaceActive = !isMEPSurfaceActive;
      btnToggleMepSurface.textContent = isMEPSurfaceActive ? '▶ SUPERFICIE MEP 3D: ACTIVA' : '⏸ SUPERFICIE MEP 3D: PAUSADA';
      btnToggleMepSurface.style.color = isMEPSurfaceActive ? '#00FFCF' : '#FFAA00';
      if (isMEPSurfaceActive) generateMEPSurface(mepOpacity, mepProbeRadius);
      else clearMEPSurface();
      playTone(isMEPSurfaceActive ? 580 : 340, 'sine', 0.1);
    });
  }
  if (btnToggleMepDipole) {
    btnToggleMepDipole.addEventListener('click', () => {
      isMEPDipoleActive = !isMEPDipoleActive;
      btnToggleMepDipole.textContent = isMEPDipoleActive ? '⚡ VECTOR DIPOLAR μ: ACTIVO' : '⏸ VECTOR DIPOLAR μ: PAUSADO';
      btnToggleMepDipole.style.color = isMEPDipoleActive ? '#FFD700' : '#888888';
      if (isMEPDipoleActive) generateDipoleArrow();
      else clearDipoleArrow();
      playTone(isMEPDipoleActive ? 640 : 360, 'sine', 0.1);
    });
  }
  if (mepOpacitySlider) {
    mepOpacitySlider.addEventListener('input', () => {
      mepOpacity = parseFloat(mepOpacitySlider.value) || 0.75;
      if (isMEPSurfaceActive) generateMEPSurface(mepOpacity, mepProbeRadius);
    });
  }
  if (mepProbeSlider) {
    mepProbeSlider.addEventListener('input', () => {
      mepProbeRadius = parseFloat(mepProbeSlider.value) || 1.2;
      if (isMEPSurfaceActive) generateMEPSurface(mepOpacity, mepProbeRadius);
    });
  }
  if (mepCanvas) {
    mepCanvas.addEventListener('mousemove', handleMEPCanvasMouseMove);
    mepCanvas.addEventListener('mouseleave', () => {
      if (mepTooltip) mepTooltip.style.display = 'none';
      hoveredMEPPotential = null;
      drawMEPCanvas();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ATOMIC EMISSION SPECTROSCOPY (BOHR / RYDBERG) CONTROLLER
  // ═══════════════════════════════════════════════════════════════
  const btnSpectroscopy = document.getElementById('btn-spectroscopy');
  const spectroscopyModal = document.getElementById('spectroscopy-modal');
  const btnCloseSpectroscopy = document.getElementById('btn-close-spectroscopy');
  const spectroscopyCanvas = document.getElementById('spectroscopy-canvas');
  const spectroscopyLinesList = document.getElementById('spectroscopy-lines-list');
  const rydbergN1 = document.getElementById('rydberg-input-n1');
  const rydbergN2 = document.getElementById('rydberg-input-n2');
  const rydbergCalcLambda = document.getElementById('rydberg-calc-lambda');
  const rydbergCalcEnergy = document.getElementById('rydberg-calc-energy');
  const rydbergCalcSeries = document.getElementById('rydberg-calc-series');
  const rydbergCalcRegion = document.getElementById('rydberg-calc-region');

  let currentSpecElement = 'H';
  let isSpecAbsorption = false;

  function refreshSpectroscopyView() {
    if (!spectroscopyCanvas || !window.NULLA_QUANTUM_SPECTROSCOPY) return;
    const qs = window.NULLA_QUANTUM_SPECTROSCOPY;
    const ctx = spectroscopyCanvas.getContext('2d');
    const w = spectroscopyCanvas.width;
    const h = spectroscopyCanvas.height;

    const elemData = qs.ELEMENT_EMISSION_SPECTRA[currentSpecElement] || qs.ELEMENT_EMISSION_SPECTRA.H;
    const lines = elemData.lines || [];

    qs.drawEmissionSpectrum(ctx, w, h, lines, { absorption: isSpecAbsorption });

    if (spectroscopyLinesList) {
      spectroscopyLinesList.innerHTML = '';
      lines.forEach(l => {
        const rgb = qs.wavelengthToRGB(l.wavelengthNm);
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:3px 6px; border-radius:4px; background:rgba(255,255,255,0.06);';
        row.innerHTML = `<span style="display:inline-flex; align-items:center; gap:5px;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${rgb.hex}; box-shadow:0 0 6px ${rgb.hex};"></span><strong style="color:#FFF;">${l.wavelengthNm.toFixed(2)} nm</strong></span> <span style="color:#00FFCF; font-size:7.5px;">${l.transition}</span> <span style="color:#FFD700; font-size:7px;">I = ${l.relativeIntensity}%</span>`;
        spectroscopyLinesList.appendChild(row);
      });
    }

    const n1 = parseInt(rydbergN1 ? rydbergN1.value : 2, 10) || 2;
    const n2 = parseInt(rydbergN2 ? rydbergN2.value : 3, 10) || 3;
    const trans = qs.calculateRydbergTransition(n1, n2, 1);
    if (trans.valid) {
      if (rydbergCalcLambda) {
        rydbergCalcLambda.textContent = `${trans.wavelengthNm} nm`;
        rydbergCalcLambda.style.color = trans.color.hex || '#FFD700';
      }
      if (rydbergCalcEnergy) rydbergCalcEnergy.textContent = `${trans.energyEv} eV`;
      if (rydbergCalcSeries) rydbergCalcSeries.textContent = trans.seriesName;
      if (rydbergCalcRegion) rydbergCalcRegion.textContent = trans.spectralRegion;
    }
  }

  if (btnSpectroscopy) {
    btnSpectroscopy.addEventListener('click', () => {
      playTone(660, 'sine', 0.15);
      openDialog(spectroscopyModal, btnSpectroscopy);
      setTimeout(refreshSpectroscopyView, 50);
    });
  }
  if (btnCloseSpectroscopy) {
    btnCloseSpectroscopy.addEventListener('click', () => {
      closeDialog(spectroscopyModal);
    });
  }

  const specElemButtons = [
    { id: 'btn-spec-elem-h', elem: 'H' },
    { id: 'btn-spec-elem-he', elem: 'He' },
    { id: 'btn-spec-elem-na', elem: 'Na' },
    { id: 'btn-spec-elem-hg', elem: 'Hg' },
    { id: 'btn-spec-elem-ne', elem: 'Ne' }
  ];
  specElemButtons.forEach(b => {
    const btn = document.getElementById(b.id);
    if (btn) {
      btn.addEventListener('click', () => {
        currentSpecElement = b.elem;
        specElemButtons.forEach(x => {
          const el = document.getElementById(x.id);
          if (el) el.classList.toggle('active', x.id === b.id);
        });
        playTone(520, 'sine', 0.08);
        refreshSpectroscopyView();
      });
    }
  });

  const btnSpecEmission = document.getElementById('btn-spec-mode-emission');
  const btnSpecAbsorption = document.getElementById('btn-spec-mode-absorption');
  if (btnSpecEmission) {
    btnSpecEmission.addEventListener('click', () => {
      isSpecAbsorption = false;
      btnSpecEmission.classList.add('active');
      if (btnSpecAbsorption) btnSpecAbsorption.classList.remove('active');
      playTone(540, 'sine', 0.08);
      refreshSpectroscopyView();
    });
  }
  if (btnSpecAbsorption) {
    btnSpecAbsorption.addEventListener('click', () => {
      isSpecAbsorption = true;
      btnSpecAbsorption.classList.add('active');
      if (btnSpecEmission) btnSpecEmission.classList.remove('active');
      playTone(480, 'sine', 0.08);
      refreshSpectroscopyView();
    });
  }

  if (rydbergN1) rydbergN1.addEventListener('input', refreshSpectroscopyView);
  if (rydbergN2) rydbergN2.addEventListener('input', refreshSpectroscopyView);

  // ═══════════════════════════════════════════════════════════════
  // VSEPR 3D MOLECULAR GEOMETRY & HYBRIDIZATION CONTROLLER
  // ═══════════════════════════════════════════════════════════════
  const btnVsepr = document.getElementById('btn-vsepr');
  const vseprModal = document.getElementById('vsepr-modal');
  const btnCloseVsepr = document.getElementById('btn-close-vsepr');
  const vseprCanvas = document.getElementById('vsepr-canvas');
  const vseprFormulaTitle = document.getElementById('vsepr-formula-title');
  const vseprCodeBadge = document.getElementById('vsepr-code-badge');
  const vseprSnVal = document.getElementById('vsepr-sn-val');
  const vseprHybVal = document.getElementById('vsepr-hyb-val');
  const vseprBpVal = document.getElementById('vsepr-bp-val');
  const vseprLpVal = document.getElementById('vsepr-lp-val');
  const vseprEgVal = document.getElementById('vsepr-eg-val');
  const vseprMgVal = document.getElementById('vsepr-mg-val');
  const vseprAngleVal = document.getElementById('vsepr-angle-val');
  const vseprBondLenVal = document.getElementById('vsepr-bond-len-val');

  let currentVseprMol = 'H2O';
  let vseprRotAngle = 0.45;

  function refreshVseprView() {
    if (!vseprCanvas || !window.NULLA_VSEPR) return;
    const vsepr = window.NULLA_VSEPR;
    const mol = vsepr.VSEPR_MOLECULAR_DATABASE[currentVseprMol] || vsepr.VSEPR_MOLECULAR_DATABASE.H2O;
    const geom = vsepr.generateVSEPR3DCoordinates(mol.bp, mol.lp, mol.bondLengthA);
    if (!geom.valid) return;

    if (vseprFormulaTitle) vseprFormulaTitle.textContent = mol.formula;
    if (vseprCodeBadge) vseprCodeBadge.textContent = geom.classification.code;
    if (vseprSnVal) vseprSnVal.textContent = geom.classification.stericNumber;
    if (vseprHybVal) vseprHybVal.textContent = geom.classification.hybridization;
    if (vseprBpVal) vseprBpVal.textContent = geom.classification.bondingDomains;
    if (vseprLpVal) vseprLpVal.textContent = geom.classification.lonePairs;
    if (vseprEgVal) vseprEgVal.textContent = geom.classification.electronGeometry;
    if (vseprMgVal) vseprMgVal.textContent = geom.classification.molecularGeometry;
    if (vseprAngleVal) vseprAngleVal.textContent = `${geom.classification.idealAngleDegrees}°`;
    if (vseprBondLenVal) vseprBondLenVal.textContent = `${mol.bondLengthA} Å`;

    drawVseprCanvas(geom, mol);
  }

  function drawVseprCanvas(geom, mol) {
    const ctx = vseprCanvas.getContext('2d');
    const w = vseprCanvas.width;
    const h = vseprCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
    bgGrad.addColorStop(0, '#10061a');
    bgGrad.addColorStop(1, '#050208');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = 75;

    const cosA = Math.cos(vseprRotAngle);
    const sinA = Math.sin(vseprRotAngle);
    const cosB = Math.cos(0.35);
    const sinB = Math.sin(0.35);

    function project(x, y, z) {
      const x1 = x * cosA - z * sinA;
      const z1 = x * sinA + z * cosA;
      const y1 = y * cosB - z1 * sinB;
      const z2 = y * sinB + z1 * cosB;
      return {
        px: cx + x1 * scale,
        py: cy - y1 * scale,
        depth: z2
      };
    }

    (geom.lonePairLobes || []).forEach(lp => {
      const p = project(lp.tipX, lp.tipY, lp.tipZ);
      const lobeGrad = ctx.createRadialGradient(p.px, p.py, 4, p.px, p.py, 28);
      lobeGrad.addColorStop(0, 'rgba(255, 0, 110, 0.7)');
      lobeGrad.addColorStop(0.5, 'rgba(191, 0, 255, 0.35)');
      lobeGrad.addColorStop(1, 'rgba(191, 0, 255, 0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.px, p.py);
      ctx.strokeStyle = 'rgba(255, 0, 110, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(p.px, p.py, 22, 0, Math.PI * 2);
      ctx.fillStyle = lobeGrad;
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.px - 5, p.py, 2.5, 0, Math.PI * 2);
      ctx.arc(p.px + 5, p.py, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    (geom.ligandAtoms || []).forEach(lig => {
      const p = project(lig.x, lig.y, lig.z);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.px, p.py);
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.px, p.py);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    (geom.ligandAtoms || []).forEach(lig => {
      const p = project(lig.x, lig.y, lig.z);
      const rad = 14;
      const grad = ctx.createRadialGradient(p.px - 4, p.py - 4, 2, p.px, p.py, rad);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.3, '#00FFCF');
      grad.addColorStop(1, '#005577');

      ctx.beginPath();
      ctx.arc(p.px, p.py, rad, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(mol.ligands || 'X', p.px, p.py);
    });

    const cRad = 20;
    const cGrad = ctx.createRadialGradient(cx - 6, cy - 6, 3, cx, cy, cRad);
    cGrad.addColorStop(0, '#FFFFFF');
    cGrad.addColorStop(0.3, '#BF00FF');
    cGrad.addColorStop(1, '#3b005e');

    ctx.beginPath();
    ctx.arc(cx, cy, cRad, 0, Math.PI * 2);
    ctx.fillStyle = cGrad;
    ctx.fill();
    ctx.strokeStyle = '#FF00CF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mol.central || 'A', cx, cy);
  }

  if (btnVsepr) {
    btnVsepr.addEventListener('click', () => {
      playTone(640, 'sine', 0.15);
      openDialog(vseprModal, btnVsepr);
      setTimeout(refreshVseprView, 50);
    });
  }
  if (btnCloseVsepr) {
    btnCloseVsepr.addEventListener('click', () => {
      closeDialog(vseprModal);
    });
  }

  const vseprMolButtons = document.querySelectorAll('#vsepr-molecule-selectors button');
  vseprMolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const molKey = btn.getAttribute('data-vsepr-mol');
      if (molKey) {
        currentVseprMol = molKey;
        vseprMolButtons.forEach(b => b.classList.toggle('active', b === btn));
        playTone(560, 'sine', 0.08);
        refreshVseprView();
      }
    });
  });

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

  // EXPORT .XYZ & .CIF Buttons
  if (btnExportXyz) {
    btnExportXyz.addEventListener('click', exportXYZFile);
  }
  if (btnExportCif) {
    btnExportCif.addEventListener('click', exportCIFFile);
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

  // ═══════════════════════════════════════════════════════════════
  // THEORIA-NULLA & INYEKTOR: POLYMORPH PHASE TRANSITION ENGINE (P, T)
  // ═══════════════════════════════════════════════════════════════
  let activePolymorphFamily = 'C';
  let activePolymorphId = null;

  function buildPolymorphAtoms(poly) {
    const atoms = [];
    const bonds = [];
    const zA = poly.atoms[0]?.z || 6;
    const zB = poly.atoms[1]?.z || zA;
    const gType = poly.geomType;

    if (gType === 'hex_layered') {
      const r = 4.6;
      [-5.2, 0, 5.2].forEach((py, layerIdx) => {
        const shiftX = (layerIdx % 2) * 1.4;
        const cIdx = atoms.length;
        atoms.push({ z: zA, pos: new THREE.Vector3(shiftX, py, 0), scale: 1.45 });
        const ring = [];
        for (let i = 0; i < 6; i++) {
          const th = (i / 6) * Math.PI * 2;
          const idx = atoms.length;
          atoms.push({ z: i % 2 === 0 ? zB : zA, pos: new THREE.Vector3(shiftX + r * Math.cos(th), py, r * Math.sin(th)), scale: 1.4 });
          ring.push(idx);
          bonds.push({ a: cIdx, b: idx, order: 1 });
        }
        for (let i = 0; i < 6; i++) bonds.push({ a: ring[i], b: ring[(i + 1) % 6], order: 1 });
      });
    } else if (gType === 'diamond_cubic') {
      const d = 5.4;
      const centers = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(d, d, 0),
        new THREE.Vector3(-d, d, 0),
        new THREE.Vector3(0, -d, d),
        new THREE.Vector3(0, -d, -d)
      ];
      centers.forEach((cPos, cIdx) => {
        const iCenter = atoms.length;
        atoms.push({ z: zA, pos: cPos.clone(), scale: 1.6 });
        const t = 3.2 * (cIdx % 2 === 0 ? 1 : -1);
        [
          new THREE.Vector3(t, t, t),
          new THREE.Vector3(-t, -t, t),
          new THREE.Vector3(-t, t, -t),
          new THREE.Vector3(t, -t, -t)
        ].forEach(v => {
          const iSub = atoms.length;
          atoms.push({ z: zB, pos: cPos.clone().add(v), scale: 1.4 });
          bonds.push({ a: iCenter, b: iSub, order: 1 });
        });
      });
    } else if (gType === 'wurtzite_hex') {
      const r = 5.0;
      [-4.8, 0, 4.8].forEach((py, lIdx) => {
        const rot = (lIdx % 2) * (Math.PI / 6);
        const cIdx = atoms.length;
        atoms.push({ z: zA, pos: new THREE.Vector3(0, py, 0), scale: 1.6 });
        for (let i = 0; i < 6; i++) {
          const th = (i / 6) * Math.PI * 2 + rot;
          const idx = atoms.length;
          atoms.push({ z: i % 2 === 0 ? zB : zA, pos: new THREE.Vector3(r * Math.cos(th), py + (i % 2) * 1.1, r * Math.sin(th)), scale: 1.45 });
          bonds.push({ a: cIdx, b: idx, order: 1 });
        }
      });
    } else if (gType === 'rutile_oct' || gType === 'anatase_oct') {
      const d = gType === 'rutile_oct' ? 6.0 : 5.4;
      const tilt = gType === 'anatase_oct' ? 1.4 : 0.0;
      [new THREE.Vector3(-d, -tilt, 0), new THREE.Vector3(0, tilt, 0), new THREE.Vector3(d, -tilt, 0)].forEach(cPos => {
        const mIdx = atoms.length;
        atoms.push({ z: zA, pos: cPos.clone(), scale: 1.75 });
        [
          new THREE.Vector3(3.4, 0, 0), new THREE.Vector3(-3.4, 0, 0),
          new THREE.Vector3(0, 3.4, 0), new THREE.Vector3(0, -3.4, 0),
          new THREE.Vector3(0, 0, 3.4), new THREE.Vector3(0, 0, -3.4)
        ].forEach(oVec => {
          const oIdx = atoms.length;
          atoms.push({ z: zB, pos: cPos.clone().add(oVec), scale: 1.35 });
          bonds.push({ a: mIdx, b: oIdx, order: 1 });
        });
      });
    } else if (gType === 'quartz_tetra') {
      const r = 5.6;
      for (let k = 0; k < 6; k++) {
        const th = (k / 6) * Math.PI * 2;
        const py = (k - 2.5) * 2.4;
        const siIdx = atoms.length;
        const siPos = new THREE.Vector3(r * Math.cos(th), py, r * Math.sin(th));
        atoms.push({ z: zA, pos: siPos, scale: 1.65 });
        const o1 = atoms.length;
        atoms.push({ z: zB, pos: siPos.clone().add(new THREE.Vector3(0, 2.2, 0)), scale: 1.35 });
        const o2 = atoms.length;
        atoms.push({ z: zB, pos: siPos.clone().multiplyScalar(0.65), scale: 1.35 });
        bonds.push({ a: siIdx, b: o1, order: 1 }, { a: siIdx, b: o2, order: 1 });
        if (k > 0) bonds.push({ a: siIdx, b: siIdx - 3, order: 1 });
      }
    } else if (gType === 'bcc_lattice') {
      const d = 5.4;
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          for (let iz = -1; iz <= 1; iz++) {
            atoms.push({ z: zA, pos: new THREE.Vector3(ix * d, iy * d, iz * d), scale: 1.65 });
          }
        }
      }
      atoms.push({ z: zA, pos: new THREE.Vector3(d * 0.5, d * 0.5, d * 0.5), scale: 1.75 });
      atoms.push({ z: zA, pos: new THREE.Vector3(-d * 0.5, -d * 0.5, -d * 0.5), scale: 1.75 });
    } else {
      const d = 4.8;
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          for (let iz = -1; iz <= 1; iz++) {
            const zAtom = (Math.abs(ix + iy + iz) % 2 === 0) ? zA : zB;
            atoms.push({ z: zAtom, pos: new THREE.Vector3(ix * d, iy * d, iz * d), scale: zAtom === zA ? 1.7 : 1.4 });
          }
        }
      }
    }
    return { atoms, bonds: bonds.length ? bonds : null };
  }

  function triggerPolymorphTransition() {
    playTone(710, 'triangle', 0.18);
    if (activeCollisionMode === 'fusion' || activeCollisionMode === 'fission') return;

    const families = window.NULLA_COMPATIBILITY?.POLYMORPH_FAMILIES || {};
    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    const uniqueZ = [...new Set(realAtoms.map(a => a.z))].sort((a, b) => a - b);

    // Determine if the active structure belongs to a polymorphic crystal family
    let matchedFamily = null;
    if (activeReactionRef?.formula && families[activeReactionRef.formula]) {
      matchedFamily = activeReactionRef.formula;
    } else if (uniqueZ.length === 1 && uniqueZ[0] === 6) {
      matchedFamily = 'C';
    } else if (uniqueZ.length === 1 && uniqueZ[0] === 26) {
      matchedFamily = 'Fe';
    } else if (uniqueZ.length === 2 && uniqueZ[0] === 5 && uniqueZ[1] === 7) {
      matchedFamily = 'BN';
    } else if (uniqueZ.length === 2 && uniqueZ[0] === 8 && uniqueZ[1] === 22) {
      matchedFamily = 'TiO₂';
    } else if (uniqueZ.length === 2 && uniqueZ[0] === 8 && uniqueZ[1] === 14) {
      matchedFamily = 'SiO₂';
    } else if (uniqueZ.length === 2 && uniqueZ[0] === 8 && uniqueZ[1] === 40) {
      matchedFamily = 'ZrO₂';
    }

    // If the current molecule/compound does not belong to a multi-polymorph solid family,
    // evaluate its thermodynamic (P, T) phase stability in-place without replacing the molecule!
    if (!matchedFamily) {
      const phaseObj = phaseAtTemperature(activeThermalProfile, temperatureK);
      const freeEnergyKJmol = activeReactionRef
        ? window.NULLA_COMPATIBILITY?.evaluateFreeEnergyKJmol?.(activeReactionRef.enthalpy, activeReactionRef.entropyJmolK, temperatureK)
        : null;
      const dGStr = freeEnergyKJmol !== null && freeEnergyKJmol !== undefined
        ? `ΔG°(${temperatureK}K) = ${freeEnergyKJmol} kJ/mol`
        : `T = ${temperatureK} K`;
      if (hudCompatibility) {
        hudCompatibility.textContent = `FASE TERMODINÁMICA ACTIVA: ${ String(phaseObj?.key || 'solid').toUpperCase() } (${dGStr})`;
        hudCompatibility.style.color = '#FFD166';
      }
      if (hudConditions) {
        const meltStr = activeThermalProfile?.melt ? `Tm = ${activeThermalProfile.melt} K · ` : '';
        const boilStr = activeThermalProfile?.boil ? `Tb = ${activeThermalProfile.boil} K · ` : '';
        hudConditions.textContent = `Equilibrio de Fases P–T: ${meltStr}${boilStr}${dGStr} · (Polimorfos de alta presión disponibles en C, BN, TiO₂, SiO₂, ZrO₂, Fe)`;
      }
      return;
    }

    isDnaMode = false;
    activeCollisionMode = 'chemical';
    const list = families[matchedFamily];
    const currentIdx = list.findIndex(item => item.id === activePolymorphId);
    const nextIdx = (currentIdx + 1) % list.length;
    const poly = list[nextIdx];

    activePolymorphFamily = matchedFamily;
    activePolymorphId = poly.id;
    activeReactionRef = poly;
    activeStructureId = `polymorph-${poly.id}`;

    const built = buildPolymorphAtoms(poly);
    let nearestDistance = Infinity;
    for (let i = 0; i < built.atoms.length; i++) {
      for (let j = i + 1; j < built.atoms.length; j++) {
        const dist = built.atoms[i].pos.distanceTo(built.atoms[j].pos);
        if (dist > 0.1 && dist < nearestDistance) nearestDistance = dist;
      }
    }
    activeBondCutoffWorld = Number.isFinite(nearestDistance) ? nearestDistance * 1.22 : 5.5;
    angstromPerWorldUnit = Number.isFinite(poly.bondLengthA) && Number.isFinite(nearestDistance)
      ? poly.bondLengthA / nearestDistance
      : 0.35;
    measurementScaleVerified = true;

    activeThermalProfile = {
      label: `${poly.formula} (${poly.id})`,
      melt: poly.melt,
      boil: poly.boil,
      transition: poly.transition || 'melting',
      pressure: poly.pWindow,
      model: 'catalogued reference'
    };
    setThermalControlEnabled(Boolean(window.NULLA_THERMODYNAMICS?.hasUsablePhaseProfile?.(activeThermalProfile)));
    spawnAtoms(built.atoms, built.bonds);

    const freeEnergyKJmol = window.NULLA_COMPATIBILITY?.evaluateFreeEnergyKJmol?.(poly.enthalpy, poly.entropyJmolK, temperatureK);
    const dGTag = freeEnergyKJmol !== null ? ` · ΔG°(${temperatureK}K)=${freeEnergyKJmol} kJ/mol` : '';

    updateTelemetry(
      `${poly.formula} · ${poly.name}`,
      `${poly.formula} | Grupo Espacial IUCr: ${poly.spaceGroup} (Polimorfo ${nextIdx + 1}/${list.length})`,
      `FASE CRISTALINA · P ∈ [${poly.pWindow}] · T ∈ [${poly.tWindow}]`,
      `d₀ = ${poly.bondLengthA} Å · B₀ = ${poly.bulkModulusGPa} GPa · HV = ${poly.vickersGPa} GPa · Eg = ${poly.bandgapEv} eV`,
      `T = ${temperatureK} K · Tb/Tsub = ${poly.boil} K`,
      `${poly.enthalpy} kJ/mol${dGTag}`,
      '0 Debye (RED CRISTALINA)',
      `99% · POLIMORFO CRISTALOGRÁFICO VERIFICADO`,
      poly.note
    );
    if (hudCompatibility) {
      hudCompatibility.textContent = `FASE CRISTALINA [${nextIdx + 1}/${list.length}]: ${poly.name} (${poly.spaceGroup})`;
      hudCompatibility.style.color = '#FFD166';
    }
    if (hudConditions) {
      hudConditions.textContent = `Ventana de estabilidad P–T: P ∈ [${poly.pWindow}] · T ∈ [${poly.tWindow}]${dGTag}`;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // REAL 3D POTENTIAL ENERGY MINIMIZATION & FORCE-FIELD RELAXATION (∇U → 0)
  // Operates computationally in-place on the active atomic structure
  // without overwriting chemical identity (ASSEMBLY, FORMULA, ENTHALPY)
  // ═══════════════════════════════════════════════════════════════
  let relaxationPassCount = 0;

  function triggerSynkroniaPulse() {
    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (realAtoms.length < 2) return;
    relaxationPassCount++;
    playTone(760 + (relaxationPassCount % 4) * 45, 'sine', 0.16);

    const scaleA = angstromPerWorldUnit || 0.42;
    const atomsInput = realAtoms.map(a => ({
      z: a.z,
      x: a.targetPos.x,
      y: a.targetPos.y,
      zCoord: a.targetPos.z,
      electronegativity: a.elData?.electronegativity || 2.0
    }));

    const rel = window.NULLA_COMPATIBILITY?.relaxAtomicStructure?.(atomsInput, scaleA, temperatureK);
    if (!rel || !Array.isArray(rel.relaxedPositions)) return;

    // Apply the relaxed minimum-energy coordinates in-place to the active 3D atoms
    realAtoms.forEach((a, idx) => {
      const rp = rel.relaxedPositions[idx];
      if (rp && Number.isFinite(rp.x) && Number.isFinite(rp.y) && Number.isFinite(rp.z)) {
        a.targetPos.set(rp.x, rp.y, rp.z);
        if (a.basePos) a.basePos.set(rp.x, rp.y, rp.z);
      }
    });

    if (activeVisualMode !== 'BALL_STICK') {
      applyVisualRepresentationMode(false);
    }

    if (hudCompatibility) {
      hudCompatibility.textContent = `EQUILIBRIO MECÁNICO 3D (ΔU = ${rel.deltaEnergyKJmol} kJ/mol · |∇U|_rms = ${rel.rmsForceEvA} eV/Å)`;
      hudCompatibility.style.color = '#00FF9D';
    }
    if (hudConditions) {
      hudConditions.textContent = `Relajación 3D (Lennard-Jones 12-6 + Coulomb) · d̄_eq = ${rel.meanBondLengthA} Å · Eg_est = ${rel.estimatedBandgapEv} eV · T = ${temperatureK} K`;
    }
  }

  const btnPolymorph = document.getElementById('btn-polymorph');
  if (btnPolymorph) {
    btnPolymorph.addEventListener('click', triggerPolymorphTransition);
  }
  const btnSynkronia = document.getElementById('btn-synkronia');
  if (btnSynkronia) {
    btnSynkronia.addEventListener('click', triggerSynkroniaPulse);
  }

  // ═══════════════════════════════════════════════════════════════
  // 4-MODE SCIENTIFIC 3D VISUALIZATION ENGINE + BRAGG XRD + COLLAPSIBLE CRYSTAL PANELS
  // ═══════════════════════════════════════════════════════════════
  const VISUAL_MODES = ['BALL_STICK', 'VDW_CPK', 'POLYHEDRA_CELL', 'CHARGE_MAP'];
  const VISUAL_MODE_DICTIONARIES = {
    es: { BALL_STICK: '👁️ VISTA: BALL & STICK', VDW_CPK: '👁️ VISTA: VDW ESPACIAL (CPK)', POLYHEDRA_CELL: '👁️ VISTA: POLIEDROS + CELDA', CHARGE_MAP: '👁️ VISTA: MAPA CARGA (δ+/δ-)' },
    en: { BALL_STICK: '👁️ VIEW: BALL & STICK', VDW_CPK: '👁️ VIEW: SPACE-FILLING (CPK)', POLYHEDRA_CELL: '👁️ VIEW: POLYHEDRA + CELL', CHARGE_MAP: '👁️ VIEW: CHARGE MAP (δ+/δ-)' },
    ja: { BALL_STICK: '👁️ 表示: 球棒モデル', VDW_CPK: '👁️ 表示: 空間充填 (CPK)', POLYHEDRA_CELL: '👁️ 表示: 多面体 + 単位胞', CHARGE_MAP: '👁️ 表示: 電荷マップ (δ+/δ-)' },
    ru: { BALL_STICK: '👁️ ВИД: ШАР И СТЕРЖЕНЬ', VDW_CPK: '👁️ ВИД: СФЕРЫ ВАН-ДЕР-ВААЛЬСА', POLYHEDRA_CELL: '👁️ ВИД: ПОЛИЭДРЫ + ЯЧЕЙКА', CHARGE_MAP: '👁️ ВИД: КАРТА ЗАРЯДОВ (δ+/δ-)' },
    zh: { BALL_STICK: '👁️ 视图：球棍模型', VDW_CPK: '👁️ 视图：空间填充 (CPK)', POLYHEDRA_CELL: '👁️ 视图：多面体 + 晶胞', CHARGE_MAP: '👁️ 视图：电荷分布 (δ+/δ-)' },
    fr: { BALL_STICK: '👁️ VUE : BOULES ET BÂTONNETS', VDW_CPK: '👁️ VUE : REMPLISSAGE (CPK)', POLYHEDRA_CELL: '👁️ VUE : POLYÈDRES + MAILLE', CHARGE_MAP: '👁️ VUE : CARTE CHARGES (δ+/δ-)' },
    it: { BALL_STICK: '👁️ VISTA: SFERE E ASTE', VDW_CPK: '👁️ VISTA: SPAZIALE (CPK)', POLYHEDRA_CELL: '👁️ VISTA: POLIEDRI + CELLA', CHARGE_MAP: '👁️ VISTA: MAPPA CARICHE (δ+/δ-)' },
    de: { BALL_STICK: '👁️ ANSICHT: KUGEL-STAB', VDW_CPK: '👁️ ANSICHT: KALOTTEN (CPK)', POLYHEDRA_CELL: '👁️ ANSICHT: POLYEDER + ZELLE', CHARGE_MAP: '👁️ ANSICHT: LADUNGSKARTE (δ+/δ-)' },
    pt: { BALL_STICK: '👁️ VISTA: ESFERA E BASTÃO', VDW_CPK: '👁️ VISTA: ESPACIAL (CPK)', POLYHEDRA_CELL: '👁️ VISTA: POLIEDROS + CÉLULA', CHARGE_MAP: '👁️ VISTA: MAPA CARGA (δ+/δ-)' },
    ko: { BALL_STICK: '👁️ 보기: 공-막대 모델', VDW_CPK: '👁️ 보기: 공간 채움 (CPK)', POLYHEDRA_CELL: '👁️ 보기: 다면체 + 단위포', CHARGE_MAP: '👁️ 보기: 전하 지도 (δ+/δ-)' },
    ar: { BALL_STICK: '👁️ العرض: كرات وعصي', VDW_CPK: '👁️ العرض: ملء الفراغ (CPK)', POLYHEDRA_CELL: '👁️ العرض: متعدد السطوح + خلية', CHARGE_MAP: '👁️ العرض: خريطة الشحنة (δ+/δ-)' }
  };
  function getVisualModeLabel(mode) {
    const locale = window.NULLA_I18N?.locale || 'es';
    const dict = VISUAL_MODE_DICTIONARIES[locale] || VISUAL_MODE_DICTIONARIES.es;
    return dict[mode] || VISUAL_MODE_DICTIONARIES.es[mode] || mode;
  }

  function applyVisualRepresentationMode(announce = true) {
    clearVisualOverlays();
    const btnVis = document.getElementById('btn-visual-mode');
    if (btnVis) {
      btnVis.textContent = getVisualModeLabel(activeVisualMode);
    }

    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (realAtoms.length === 0) return;

    // Restore base material colors & instance colors first
    const whiteCol = new THREE.Color(0xFFFFFF);
    activeInstancedMeshes.forEach(im => {
      if (im.userData && im.userData.col !== undefined && im.material) {
        im.material.color.setHex(im.userData.col);
      }
      if (im.instanceColor) {
        for (let i = 0; i < im.count; i++) {
          im.setColorAt(i, whiteCol);
        }
        im.instanceColor.needsUpdate = true;
      }
    });

    if (activeVisualMode === 'BALL_STICK') {
      realAtoms.forEach(a => {
        a.targetScale = a.baseScale || (1.2 + (a.elData?.r || 1.0) * 0.4);
      });
      if (activeBondInstancedMesh) activeBondInstancedMesh.visible = true;
      if (announce && hudConditions) {
        hudConditions.textContent = 'VISTA 3D: Ball & Stick (Radios Covalentes + Enlaces Polarizados Δχ)';
      }
    } else if (activeVisualMode === 'VDW_CPK') {
      realAtoms.forEach(a => {
        const base = a.baseScale || (1.2 + (a.elData?.r || 1.0) * 0.4);
        a.targetScale = base * 1.92;
      });
      if (activeBondInstancedMesh) activeBondInstancedMesh.visible = false;
      if (announce && hudConditions) {
        hudConditions.textContent = 'VISTA 3D: CPK / Van der Waals Space-Filling (Volumen Estérico Electrónico Real)';
      }
    } else if (activeVisualMode === 'POLYHEDRA_CELL') {
      realAtoms.forEach(a => {
        const base = a.baseScale || (1.2 + (a.elData?.r || 1.0) * 0.4);
        a.targetScale = base * 0.9;
      });
      if (activeBondInstancedMesh) activeBondInstancedMesh.visible = true;

      // 1. Build 3D Crystallographic Unit Cell Bounding Box (a × b × c)
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      realAtoms.forEach(a => {
        const p = a.targetPos;
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (p.z > maxZ) maxZ = p.z;
      });
      const pad = 1.6;
      const sizeX = Math.max(4.0, (maxX - minX) + pad * 2);
      const sizeY = Math.max(4.0, (maxY - minY) + pad * 2);
      const sizeZ = Math.max(4.0, (maxZ - minZ) + pad * 2);
      const center = new THREE.Vector3((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);

      const boxGeo = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
      const edgesGeo = new THREE.EdgesGeometry(boxGeo);
      boxGeo.dispose();
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0x00F0FF,
        transparent: true,
        opacity: 0.62
      });
      const cellWireframe = new THREE.LineSegments(edgesGeo, edgesMat);
      cellWireframe.position.copy(center);
      moleculeGroup.add(cellWireframe);
      activeVisualOverlays.push(cellWireframe);

      // Crystallographic Axes (a = Red, b = Green, c = Blue) at unit cell origin corner
      const originCorner = new THREE.Vector3(center.x - sizeX * 0.5, center.y - sizeY * 0.5, center.z - sizeZ * 0.5);
      const axisSpecs = [
        { dir: new THREE.Vector3(Math.min(sizeX * 0.45, 10), 0, 0), col: 0xFF3366 },
        { dir: new THREE.Vector3(0, Math.min(sizeY * 0.45, 10), 0), col: 0x00FF9D },
        { dir: new THREE.Vector3(0, 0, Math.min(sizeZ * 0.45, 10)), col: 0x38BDF8 }
      ];
      axisSpecs.forEach(ax => {
        const axGeo = new THREE.BufferGeometry().setFromPoints([originCorner, originCorner.clone().add(ax.dir)]);
        const axMat = new THREE.LineBasicMaterial({ color: ax.col, transparent: true, opacity: 0.95 });
        const axLine = new THREE.Line(axGeo, axMat);
        moleculeGroup.add(axLine);
        activeVisualOverlays.push(axLine);
      });

      // 2. Build VESTA-Style Translucent Coordination Polyhedra ([MO6] / [MO4])
      let polyhedraBuilt = 0;
      for (let i = 0; i < realAtoms.length && polyhedraBuilt < 14; i++) {
        const centerAtom = realAtoms[i];
        const neighbors = [];
        for (let j = 0; j < realAtoms.length; j++) {
          if (i === j) continue;
          const d = centerAtom.targetPos.distanceTo(realAtoms[j].targetPos);
          if (d > 0.5 && d <= 11.2) {
            neighbors.push({ atom: realAtoms[j], dist: d });
          }
        }
        neighbors.sort((a, b) => a.dist - b.dist);
        const coordNeighbors = neighbors.slice(0, 6);
        if (coordNeighbors.length >= 4) {
          const avgDist = coordNeighbors.reduce((s, n) => s + n.dist, 0) / coordNeighbors.length;
          const polyRadius = avgDist * 0.78;
          const polyGeo = coordNeighbors.length >= 6
            ? new THREE.OctahedronGeometry(polyRadius, 0)
            : new THREE.TetrahedronGeometry(polyRadius, 0);
          const polyMat = new THREE.MeshPhysicalMaterial({
            color: centerAtom.baseCol || 0x00F0FF,
            transparent: true,
            opacity: 0.24,
            roughness: 0.12,
            metalness: 0.1,
            clearcoat: 1.0,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          const polyMesh = new THREE.Mesh(polyGeo, polyMat);
          polyMesh.position.copy(centerAtom.targetPos);
          moleculeGroup.add(polyMesh);
          activeVisualOverlays.push(polyMesh);

          const polyEdgesGeo = new THREE.EdgesGeometry(polyGeo);
          const polyEdgesMat = new THREE.LineBasicMaterial({
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.48
          });
          const polyEdges = new THREE.LineSegments(polyEdgesGeo, polyEdgesMat);
          polyEdges.position.copy(centerAtom.targetPos);
          moleculeGroup.add(polyEdges);
          activeVisualOverlays.push(polyEdges);
          polyhedraBuilt++;
        }
      }

      const scaleA = angstromPerWorldUnit || 0.42;
      const cellStr = `a=${(sizeX * scaleA).toFixed(2)} Å · b=${(sizeY * scaleA).toFixed(2)} Å · c=${(sizeZ * scaleA).toFixed(2)} Å`;
      if (announce && hudConditions) {
        hudConditions.textContent = `VISTA 3D: Celda Unidad (${cellStr}) + ${polyhedraBuilt} Poliedros de Coordinación VESTA`;
      }
    } else if (activeVisualMode === 'CHARGE_MAP') {
      realAtoms.forEach(a => {
        const base = a.baseScale || (1.2 + (a.elData?.r || 1.0) * 0.4);
        a.targetScale = base * 1.15;
      });
      if (activeBondInstancedMesh) activeBondInstancedMesh.visible = true;

      // Set base material color to white so per-instance Pauling charge color renders accurately
      activeInstancedMeshes.forEach(im => {
        if (im.material) im.material.color.setHex(0xFFFFFF);
      });

      const meanEN = realAtoms.reduce((acc, a) => acc + (a.elData?.electronegativity || 2.0), 0) / Math.max(1, realAtoms.length);
      const tmpColor = new THREE.Color();
      realAtoms.forEach(a => {
        const atomEN = a.elData?.electronegativity || 2.0;
        const chargeData = window.NULLA_COMPATIBILITY && window.NULLA_COMPATIBILITY.computePaulingPartialCharge
          ? window.NULLA_COMPATIBILITY.computePaulingPartialCharge(atomEN, meanEN)
          : { q: 0, hexColor: 0xE2E8F0 };
        tmpColor.setHex(chargeData.hexColor);
        if (a.instancedMesh) {
          a.instancedMesh.setColorAt(a.instIdx, tmpColor);
        }
      });
      activeInstancedMeshes.forEach(im => {
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      });
      if (announce && hudConditions) {
        hudConditions.textContent = `VISTA 3D: Mapa Electrostático de Carga Parcial de Pauling (Azul δ+ Electrofílico · Rojo δ- Nucleofílico · χ̄=${meanEN.toFixed(2)})`;
      }
    }
  }

  function cycleVisualRepresentationMode() {
    playTone(680, 'sine', 0.12, 0.08);
    const idx = VISUAL_MODES.indexOf(activeVisualMode);
    activeVisualMode = VISUAL_MODES[(idx + 1) % VISUAL_MODES.length];
    applyVisualRepresentationMode(true);
  }

  function triggerBraggXRDAnalysis() {
    if (!window.NULLA_COMPATIBILITY || !window.NULLA_COMPATIBILITY.computeBraggXRDPattern) return;
    const realAtoms = activeAtoms.filter(a => !a.isElectron && !a.removing);
    if (realAtoms.length < 2) return;
    playTone(820, 'triangle', 0.18, 0.10);

    const scaleA = angstromPerWorldUnit || 0.42;
    const coordsAngstrom = realAtoms.map(a => ({
      z: a.z,
      x: a.targetPos.x * scaleA,
      y: a.targetPos.y * scaleA,
      zCoord: a.targetPos.z * scaleA
    }));

    const xrd = window.NULLA_COMPATIBILITY.computeBraggXRDPattern(coordsAngstrom, 1.5406);
    if (!xrd || !xrd.peaks || xrd.peaks.length === 0) return;

    // Render 3D Debye-Scherrer diffraction rings around the crystal center
    clearVisualOverlays();
    xrd.peaks.slice(0, 4).forEach((pk, idx) => {
      const ringRadius = 10.0 + idx * 3.8;
      const ringGeo = new THREE.RingGeometry(ringRadius, ringRadius + 0.18 + (pk.intensity / 450), 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: idx === 0 ? 0x38BDF8 : (idx === 1 ? 0x00FF9D : 0xC084FC),
        transparent: true,
        opacity: Math.max(0.22, (pk.intensity / 100) * 0.55),
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI * 0.32;
      moleculeGroup.add(ringMesh);
      activeVisualOverlays.push(ringMesh);
    });

    const peakSummary = xrd.peaks
      .map(p => `2θ=${p.twoThetaDeg}° (d=${p.dSpacingA}Å, I=${p.intensity}%)`)
      .join(' · ');

    if (hudConditions) {
      hudConditions.textContent = `📊 XRD BRAGG (${xrd.radiation}): ${peakSummary}`;
    }
    if (hudCompatibility) {
      hudCompatibility.textContent = `PICO PRINCIPAL 2θ = ${xrd.peaks[0].twoThetaDeg}° (d = ${xrd.peaks[0].dSpacingA} Å)`;
      hudCompatibility.style.color = '#38BDF8';
    }
  }

  const btnVisualMode = document.getElementById('btn-visual-mode');
  if (btnVisualMode) {
    btnVisualMode.addEventListener('click', cycleVisualRepresentationMode);
  }
  const btnXrd = document.getElementById('btn-xrd');
  if (btnXrd) {
    btnXrd.addEventListener('click', triggerBraggXRDAnalysis);
  }

  // Collapsible Left Telemetry Panel & Bottom Periodic Table Panel (3D Solid Crystal Drawer Tabs)
  const leftHudPanel = document.getElementById('molecular-hud');
  const btnRestoreLeftHud = document.getElementById('btn-restore-left-hud');
  const ptHudCollapsePanel = document.getElementById('pt-hud-panel');
  const btnRestorePtHud = document.getElementById('btn-restore-pt-hud');

  function updateDrawerTabs() {
    const isLeftCollapsed = document.body.classList.contains('hud-left-collapsed');
    const isPtCollapsed = document.body.classList.contains('hud-pt-collapsed');

    if (btnRestoreLeftHud) {
      btnRestoreLeftHud.textContent = tr(isLeftCollapsed ? 'restoreLeft' : 'collapseLeft');
      btnRestoreLeftHud.title = tr(isLeftCollapsed ? 'restoreLeft' : 'collapseLeft');
      btnRestoreLeftHud.setAttribute('aria-expanded', !isLeftCollapsed);
    }
    if (btnRestorePtHud) {
      btnRestorePtHud.textContent = tr(isPtCollapsed ? 'restorePt' : 'collapsePt');
      btnRestorePtHud.title = tr(isPtCollapsed ? 'restorePt' : 'collapsePt');
      btnRestorePtHud.setAttribute('aria-expanded', !isPtCollapsed);
      if (!isPtCollapsed && ptHudCollapsePanel) {
        const h = ptHudCollapsePanel.offsetHeight || 380;
        btnRestorePtHud.style.bottom = `${h + 20}px`;
      } else {
        btnRestorePtHud.style.bottom = '';
      }
    }
  }

  function toggleLeftHud(forceState) {
    if (!leftHudPanel) return;
    const shouldCollapse = forceState !== undefined ? forceState : !document.body.classList.contains('hud-left-collapsed');
    if (shouldCollapse) {
      leftHudPanel.classList.add('hud-collapsed-left');
      document.body.classList.add('hud-left-collapsed');
    } else {
      leftHudPanel.classList.remove('hud-collapsed-left');
      document.body.classList.remove('hud-left-collapsed');
    }
    updateDrawerTabs();
  }

  function togglePtHud(forceState) {
    if (!ptHudCollapsePanel) return;
    const shouldCollapse = forceState !== undefined ? forceState : !document.body.classList.contains('hud-pt-collapsed');
    if (shouldCollapse) {
      ptHudCollapsePanel.classList.add('hud-collapsed-bottom');
      document.body.classList.add('hud-pt-collapsed');
    } else {
      ptHudCollapsePanel.classList.remove('hud-collapsed-bottom');
      document.body.classList.remove('hud-pt-collapsed');
    }
    updateDrawerTabs();
  }

  if (btnRestoreLeftHud) {
    btnRestoreLeftHud.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLeftHud();
    });
  }
  if (btnRestorePtHud) {
    btnRestorePtHud.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePtHud();
    });
  }
  window.addEventListener('resize', () => {
    if (!document.body.classList.contains('hud-pt-collapsed')) {
      updateDrawerTabs();
    }
  });
  updateDrawerTabs();

  document.querySelectorAll('#molecular-tray-bar [data-mol-id]').forEach(chip => {
    chip.addEventListener('click', () => {
      const molId = chip.getAttribute('data-mol-id');
      if (molId) selectMoleculeForTray(molId);
    });
  });

  const btnStageActive = document.getElementById('btn-stage-active');
  if (btnStageActive) {
    btnStageActive.addEventListener('click', () => {
      if (activeStageableSpecies) {
        selectMoleculeForTray(activeStageableSpecies);
      } else {
        selectMoleculeForTray('H2O');
      }
    });
  }

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
        if (MOLECULAR_SPECIES[symbol]) {
          const mol = MOLECULAR_SPECIES[symbol];
          return { id: mol.id, sym: mol.id, formula: mol.formula, name: mol.name, isMolecule: true, atoms: mol.atoms, z: mol.atoms?.[0]?.z || 6 };
        }
        const element = Object.values(EL).find(candidate => candidate.s === symbol);
        return element ? {z:element.z,sym:element.s} : null;
      }).filter(Boolean);
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
    updateDrawerTabs();
    applyVisualRepresentationMode(false);
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
          if (isFtirVibrating && activeFtirData && activeFtirData.modes.length > 0) {
            let vibDx = 0, vibDy = 0, vibDz = 0;
            const amp = ftirAmplitude * 0.65;
            if (activeFtirModeId === 'all') {
              activeFtirData.modes.forEach((mode, mIdx) => {
                const disp = mode.displacements?.[i];
                if (disp) {
                  const freq = 10.0 + (mIdx * 3.2);
                  const phaseVal = (mIdx * 1.57) + i * 0.4;
                  const sinFactor = Math.sin(t * freq + phaseVal) * amp;
                  vibDx += disp.dx * sinFactor;
                  vibDy += disp.dy * sinFactor;
                  vibDz += disp.dz * sinFactor;
                }
              });
            } else {
              const targetMode = activeFtirData.modes.find(m => {
                if (activeFtirModeId === 'sym') return m.type === 'stretch';
                if (activeFtirModeId === 'bend') return m.type === 'bend';
                if (activeFtirModeId === 'asym') return m.type === 'stretch';
                return false;
              }) || activeFtirData.modes[0];
              const disp = targetMode?.displacements?.[i];
              if (disp) {
                const freq = 14.0;
                const sinFactor = Math.sin(t * freq + (activeFtirModeId === 'asym' ? (i % 2 === 0 ? 0 : Math.PI) : 0)) * amp;
                vibDx = disp.dx * sinFactor;
                vibDy = disp.dy * sinFactor;
                vibDz = disp.dz * sinFactor;
              }
            }
            if (a.basePos) a.targetPos.copy(a.basePos).add(new THREE.Vector3(vibDx, vibDy, vibDz));
            if (hudEpi && i === 0) hudEpi.textContent = `FT-IR 3D // ${activeFtirModeId.toUpperCase()} (${temperatureK} K) · Oscilador Armónico Cuántico k/μ`;
          } else {
            const referenceTm = Number(activeThermalProfile?.melt) || Number(activeThermalProfile?.boil) || 1000;
            const solidVibScale = Math.min(1.5, temperatureK / Math.max(1, referenceTm));
            const vibX = Math.sin(t * 12.0 + a.instIdx) * (0.35 * solidVibScale);
            const vibY = Math.cos(t * 14.0 + a.instIdx) * (0.35 * solidVibScale);
            const vibZ = Math.sin(t * 10.0 + a.instIdx) * (0.35 * solidVibScale);
            if (a.basePos) a.targetPos.copy(a.basePos).add(new THREE.Vector3(vibX, vibY, vibZ));
            if (hudEpi && i === 0) hudEpi.textContent = `${phase.label} (${temperatureK} K // ${Math.round(temperatureK - 273.15)}°C) · ${tr('solidMotionModel')}`;
          }
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

    if (quantumNebula) {
      quantumNebula.rotation.y = t * 0.015;
      quantumNebula.rotation.x = Math.sin(t * 0.01) * 0.03;
    }

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
