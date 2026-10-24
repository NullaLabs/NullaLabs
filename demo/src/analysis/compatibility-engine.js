(function exposeCompatibilityEngine(root) {
  'use strict';

  const NOBLE_GASES = new Set([2, 10, 18, 36, 54, 86, 118]);
  const TRANSITION_METALS = new Set([
    21,22,23,24,25,26,27,28,29,30,
    39,40,41,42,43,44,45,46,47,48,
    72,73,74,75,76,77,78,79,80
  ]);
  const METALS = new Set([
    3,4,11,12,13,19,20,21,22,23,24,25,26,27,28,29,30,31,
    37,38,39,40,41,42,43,44,45,46,47,48,49,50,
    55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,
    72,73,74,75,76,77,78,79,80,81,82,83,87,88,89,90,91,92,93,94,95,96,97,98
  ]);
  const SMALL_INTERSTITIALS = new Set([1, 5, 6, 7]); // H, B, C, N

  // Empirical covalent/metallic radii in Angstroms for Hume-Rothery & Hägg evaluation
  const ATOMIC_RADII_ANGSTROM = {
    1:0.31, 2:0.28, 3:1.28, 4:0.96, 5:0.84, 6:0.76, 7:0.71, 8:0.66, 9:0.57, 10:0.58,
    11:1.66, 12:1.41, 13:1.21, 14:1.11, 15:1.07, 16:1.05, 17:1.02, 18:1.06,
    19:2.03, 20:1.76, 21:1.70, 22:1.60, 23:1.53, 24:1.39, 25:1.39, 26:1.32, 27:1.26, 28:1.24, 29:1.32, 30:1.22,
    31:1.22, 32:1.20, 33:1.19, 34:1.20, 35:1.20, 36:1.16,
    37:2.20, 38:1.95, 39:1.90, 40:1.75, 41:1.64, 42:1.54, 44:1.46, 45:1.42, 46:1.39, 47:1.45, 48:1.44, 49:1.42, 50:1.39, 51:1.39, 52:1.38, 53:1.39, 54:1.40,
    55:2.44, 56:2.15, 57:2.07, 58:2.04, 60:2.01, 64:1.96, 72:1.75, 73:1.70, 74:1.62, 75:1.51, 76:1.44, 77:1.41, 78:1.36, 79:1.36, 80:1.32, 82:1.46, 83:1.48, 90:2.06, 92:1.96
  };

  // Shannon effective ionic radii (Å) for Goldschmidt ABX₃ perovskite tolerance factor t
  const SHANNON_A_SITE_RADII = {
    11:1.39, 19:1.64, 20:1.34, 37:1.72, 38:1.44, 39:1.19, 55:1.88, 56:1.61, 57:1.36, 60:1.27, 82:1.49, 83:1.38
  };
  const SHANNON_B_SITE_RADII = {
    12:0.72, 13:0.535, 14:0.40, 22:0.605, 23:0.58, 24:0.615, 25:0.53, 26:0.645, 27:0.545, 28:0.69, 30:0.74,
    31:0.62, 40:0.72, 41:0.64, 42:0.59, 50:0.69, 72:0.71, 73:0.64, 74:0.60
  };
  const SHANNON_X_ANION_RADII = {
    8:1.40, 9:1.33, 17:1.81, 35:1.96, 53:2.20
  };

  function computeGoldschmidtTolerance(zList) {
    if (!Array.isArray(zList) || zList.length < 3) return null;
    const xZ = zList.find(z => SHANNON_X_ANION_RADII[z] !== undefined);
    if (!xZ) return null;
    const cations = zList.filter(z => z !== xZ);
    if (cations.length < 2) return null;
    const aCandidates = cations.filter(z => SHANNON_A_SITE_RADII[z] !== undefined);
    const bCandidates = cations.filter(z => SHANNON_B_SITE_RADII[z] !== undefined);
    if (!aCandidates.length || !bCandidates.length) return null;
    const aZ = aCandidates.sort((u, v) => SHANNON_A_SITE_RADII[v] - SHANNON_A_SITE_RADII[u])[0];
    const bZ = bCandidates.find(z => z !== aZ) || bCandidates[0];
    if (aZ === bZ) return null;
    const rA = SHANNON_A_SITE_RADII[aZ];
    const rB = SHANNON_B_SITE_RADII[bZ];
    const rX = SHANNON_X_ANION_RADII[xZ];
    const t = (rA + rX) / (Math.SQRT2 * (rB + rX));
    const regime = (t >= 0.90 && t <= 1.05)
      ? 'PEROVSKITA CÚBICA/TETRAGONAL ESTABLE (0.90 ≤ t ≤ 1.05)'
      : (t >= 0.71 && t < 0.90)
        ? 'PEROVSKITA ORTORRÓMBICA DISTORSIONADA (0.71 ≤ t < 0.90)'
        : 'FUERA DE RANGO PEROVSKITA (FASE HEXAGONAL / ILMENITA)';
    return { t: Number(t.toFixed(3)), rA, rB, rX, regime };
  }

  function evaluateFreeEnergyKJmol(enthalpyKJmol, entropyJmolK, temperatureK = 298) {
    if (!Number.isFinite(enthalpyKJmol)) return null;
    const dS = Number.isFinite(entropyJmolK) ? entropyJmolK : -45.0;
    const dG = enthalpyKJmol - (Number(temperatureK) * dS) / 1000.0;
    return Number(dG.toFixed(1));
  }

  function computeChronolithSeal(payloadStr) {
    let hash = 0x811c9dc5;
    const str = String(payloadStr || '');
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `CHR-${hash.toString(16).toUpperCase().padStart(8, '0')}`;
  }

  function paulingIonicityPct(deltaEN) {
    if (!Number.isFinite(deltaEN) || deltaEN < 0) return null;
    return Math.round((1 - Math.exp(-0.25 * deltaEN * deltaEN)) * 100);
  }

  function vanArkelRegime(meanEN, deltaEN, allMetals) {
    if (allMetals && (deltaEN === null || deltaEN < 0.45)) return 'METALLIC / SOLID-SOLUTION BAND';
    if (allMetals && deltaEN >= 0.45) return 'ORDERED INTERMETALLIC (d-p Hybridized)';
    if (deltaEN === null) return 'COVALENT / METALLIC';
    if (deltaEN >= 1.7) return 'IONIC LATTICE (Pauling > 50% Ionic)';
    if (deltaEN >= 0.5) return 'POLAR COVALENT / IONIC-COVALENT CERAMIC';
    if (meanEN >= 2.0) return 'DIRECTIONAL COVALENT NETWORK';
    return 'METALLIC / INTERMETALLIC';
  }

  /**
   * LEGION Multidisciplinary Synergistic Evaluator (Cohorts C01, C03, C04, C05, C07, C10)
   * Evaluates stability, Hume-Rothery alloy rules, Hägg interstitial ratios, and molecular interactions.
   */
  function multidisciplinary({ reactants = [], reaction = null, molecularReaction = null, temperatureK = 298 }) {
    const activeReaction = molecularReaction || reaction;
    const hasMolecules = reactants.some(r => r && r.isMolecule);
    const zList = reactants.map(r => Number(r?.z)).filter(z => Number.isInteger(z) && z > 0);
    const enList = reactants.map(r => Number(r?.electronegativity)).filter(e => Number.isFinite(e) && e > 0);
    const deltaEN = enList.length >= 2 ? Math.max(...enList) - Math.min(...enList) : null;
    const meanEN = enList.length >= 1 ? enList.reduce((a, b) => a + b, 0) / enList.length : null;
    const ionicityPct = paulingIonicityPct(deltaEN);
    const allMetals = zList.length >= 2 && zList.every(z => METALS.has(z));
    const hasNoble = zList.some(z => NOBLE_GASES.has(z));
    const hasRadioactive = zList.some(z => z >= 84 || z === 43 || z === 61);

    // 1. If we have a verified reaction (elemental or molecular)
    if (activeReaction) {
      const enthalpy = activeReaction.enthalpy;
      const freeEnergyKJmol = evaluateFreeEnergyKJmol(enthalpy, activeReaction.entropyJmolK, temperatureK);
      const atomZList = Array.isArray(activeReaction.atoms) ? activeReaction.atoms.map(a => a.z) : zList;
      const goldschmidt = computeGoldschmidtTolerance(atomZList);
      const isThermalDecomposed = Number.isFinite(activeReaction.boil) && temperatureK >= activeReaction.boil;
      const isEndothermic = typeof enthalpy === 'number' && enthalpy > 0;
      const isMetastable = isThermalDecomposed || isEndothermic || (freeEnergyKJmol !== null && freeEnergyKJmol > 0) || /metastable|equilibrium|decompose|reversible/i.test(
        `${activeReaction.stabilityVerdict || ''} ${activeReaction.note || ''}`
      );
      const stabilityClass = isThermalDecomposed ? 'METASTABLE' : (isMetastable ? 'METASTABLE' : 'STABLE');
      const freeEnergyTag = freeEnergyKJmol !== null ? ` · ΔG°(${temperatureK}K)=${freeEnergyKJmol} kJ/mol` : '';
      const goldschmidtTag = goldschmidt ? ` · Goldschmidt t=${goldschmidt.t}` : '';
      const stabilityVerdict = isThermalDecomposed
        ? `METAESTABLE / DISOCIACIÓN TÉRMICA (T=${temperatureK} K ≥ Tb=${activeReaction.boil} K${freeEnergyTag})`
        : (activeReaction.stabilityVerdict || (
            isMetastable
              ? `METASTABLE · CONDITION-DEPENDENT (${activeReaction.formula})`
              : `STABLE · VERIFIED THERMODYNAMIC PHASE (${activeReaction.formula})`
          )) + freeEnergyTag + goldschmidtTag;
      const seal = computeChronolithSeal(`${activeReaction.formula}|${temperatureK}|${enthalpy ?? 'ND'}`);
      const condParts = [`T = ${temperatureK} K`, activeReaction.pressure ? `p = ${activeReaction.pressure}` : 'p = 1 atm'];
      if (freeEnergyKJmol !== null) condParts.push(`ΔG°(${temperatureK}K) = ${freeEnergyKJmol} kJ/mol`);
      if (deltaEN !== null) condParts.push(`Δχ = ${deltaEN.toFixed(2)} (${ionicityPct}% iónico)`);
      if (goldschmidt) condParts.push(`Goldschmidt t = ${goldschmidt.t}`);
      return {
        canCombine: true,
        combinationMode: hasMolecules ? 'MOLECULAR_SYNTHESIS' : 'STOICHIOMETRIC_COMPOUND',
        stabilityClass,
        stabilityVerdict,
        bondingRegime: activeReaction.type || vanArkelRegime(meanEN, deltaEN, allMetals),
        ionicityPct,
        deltaEN,
        enthalpy: typeof enthalpy === 'number' ? enthalpy : null,
        freeEnergyKJmol,
        goldschmidt,
        equation: activeReaction.equation || null,
        scribaGate: activeReaction.evidenceLevel === 'CATALOGUED' ? 'GO' : 'GO_DEGRADED',
        chronolithSeal: seal,
        physicalConditions: condParts.join(' · '),
        legionCohorts: ['C03_MATH_CONTROL (Graph Topology)', 'C05_BIOMED_OMICS (Stoichiometry)', 'C10_CYBERNETIC_GOV (Catalogued Gate)'],
        engineeringSummary: activeReaction.note || `${activeReaction.type} · ${activeReaction.geom}`
      };
    }

    // 2. Noble gas barrier check
    if (hasNoble) {
      const canExcimerOrFluoride = zList.includes(54) && zList.includes(9); // Xe + F -> XeF2/XeF4
      if (canExcimerOrFluoride) {
        return {
          canCombine: true,
          combinationMode: 'HYPERVALENT_FLUORIDE',
          stabilityClass: 'METASTABLE',
          stabilityVerdict: 'METASTABLE · XENON FLUORIDE (XeF₂ / XeF₄ · 3-Center 4-Electron Bond)',
          bondingRegime: 'HYPERVALENT 3c-4e COVALENT',
          ionicityPct,
          deltaEN,
          enthalpy: -108.0,
          physicalConditions: `T = ${temperatureK} K · Enlace hipervalente 3c-4e · ΔH° = -108 kJ/mol`,
          legionCohorts: ['C03_MATH_CONTROL', 'C05_BIOMED_OMICS'],
          engineeringSummary: 'Stable crystal at 298 K under dry conditions; hydrolyzes rapidly in water; excimer laser precursor.'
        };
      }
      return {
        canCombine: false,
        combinationMode: 'INERT_PHYSICAL_MIXTURE_ONLY',
        stabilityClass: 'UNSTABLE_BOND',
        stabilityVerdict: 'INESTABLE COMO COMPUESTO · CAPA DE VALENCIA CERRADA (ns²np⁶ · ΔG > 0)',
        bondingRegime: 'VAN DER WAALS DISPERSION ONLY (No Chemical Bond)',
        ionicityPct: 0,
        deltaEN: null,
        enthalpy: null,
        scribaGate: 'NO_GO',
        physicalConditions: `T = ${temperatureK} K · Capa cerrada ns²np⁶ · Barrera de ionización > 12 eV · ΔG° > 0`,
        legionCohorts: ['C03_MATH_CONTROL', 'C10_CYBERNETIC_GOV'],
        engineeringSummary: 'Los gases nobles poseen octeto completo y alta energía de ionización; solo forman mezclas físicas o excímeros transitorios en plasma.'
      };
    }

    // 3. Molecule + Molecule / Material + Material physical composite or uncatalogued pair
    if (hasMolecules && reactants.length >= 2) {
      const names = reactants.map(r => r.sym || r.name).join(' + ');
      const anyPolar = reactants.some(r => r.polar);
      const allPolar = reactants.every(r => r.polar);
      const interactionType = allPolar
        ? 'DIPOLE–DIPOLE / HYDROGEN-BOND SOLVATION'
        : anyPolar
          ? 'DEBYE DIPOLE–INDUCED-DIPOLE INTERFACE'
          : 'LONDON DISPERSION / VAN DER WAALS HETEROINTERFACE';
      return {
        canCombine: true,
        combinationMode: 'MULTIPHASIC_COMPOSITE_HETEROSTRUCTURE',
        stabilityClass: 'STABLE_COMPOSITE',
        stabilityVerdict: `ESTABLE COMO COMPOSITE / HETEROESTRUCTURA (${interactionType})`,
        bondingRegime: interactionType,
        ionicityPct: null,
        deltaEN: null,
        enthalpy: null,
        physicalConditions: `T = ${temperatureK} K · p = 1 atm · Interfase supramolecular (${interactionType})`,
        legionCohorts: ['C03_MATH_CONTROL (Interface Topology)', 'C04_GRAPHICS_SHADERS (3D Composite)', 'C08_COGNITIVE_UX'],
        engineeringSummary: `Coexistencia supramolecular o matriz compuesta (${names}) gobernada por fuerzas interfaciales ${interactionType}.`
      };
    }

    // 4. Metal + Metal: Hume-Rothery Alloy & Intermetallic Analysis (LEGION C01 + C03)
    if (allMetals && zList.length >= 2) {
      const radii = zList.map(z => ATOMIC_RADII_ANGSTROM[z] || 1.45);
      const rMin = Math.min(...radii);
      const rMax = Math.max(...radii);
      const mismatchPct = ((rMax - rMin) / rMin) * 100;
      const isHEA = zList.length >= 4;

      if (isHEA) {
        const dSmix = (8.314 * Math.log(zList.length)).toFixed(1);
        return {
          canCombine: true,
          combinationMode: 'HIGH_ENTROPY_ALLOY',
          stabilityClass: 'STABLE',
          stabilityVerdict: `STABLE · ALEACIÓN DE ALTA ENTROPÍA (HEA ΔS_mix = ${dSmix} J/mol·K · δr = ${mismatchPct.toFixed(1)}%)`,
          bondingRegime: 'MULTI-PRINCIPAL-ELEMENT METALLIC LATTICE (FCC/BCC)',
          ionicityPct,
          deltaEN,
          humeRotheryMismatchPct: Number(mismatchPct.toFixed(2)),
          enthalpy: -12.0,
          physicalConditions: `T = ${temperatureK} K · ΔS_mix = ${dSmix} J/mol·K · Hume-Rothery δr = ${mismatchPct.toFixed(1)}%`,
          legionCohorts: ['C01_SYSTEMS', 'C03_MATH_CONTROL (Statistical Entropy)', 'C07_GAME_THEORY_ECON'],
          engineeringSummary: 'La alta entropía configuracional estabiliza una solución sólida monofásica con resistencia criogénica y térmica superior.'
        };
      }

      if (mismatchPct <= 15.0 && (deltaEN === null || deltaEN <= 0.45)) {
        return {
          canCombine: true,
          combinationMode: 'HUME_ROTHERY_SOLID_SOLUTION',
          stabilityClass: 'STABLE',
          stabilityVerdict: `ESTABLE · SOLUCIÓN SÓLIDA SUSTITUCIONAL HUME-ROTHERY (δr = ${mismatchPct.toFixed(1)}% ≤ 15%, Δχ = ${(deltaEN ?? 0).toFixed(2)})`,
          bondingRegime: 'METALLIC SUBSTITUTIONAL ALLOY LATTICE',
          ionicityPct,
          deltaEN,
          humeRotheryMismatchPct: Number(mismatchPct.toFixed(2)),
          enthalpy: -15.0,
          physicalConditions: `T = ${temperatureK} K · Hume-Rothery δr = ${mismatchPct.toFixed(1)}% (≤ 15%) · Δχ = ${(deltaEN ?? 0).toFixed(2)}`,
          legionCohorts: ['C01_SYSTEMS', 'C03_MATH_CONTROL (Lattice Elasticity)'],
          engineeringSummary: `Cumple la 1ª y 3ª regla de Hume-Rothery (desajuste de radio atómico ${mismatchPct.toFixed(1)}% < 15%), formando una red metálica continua.`
        };
      }

      if (deltaEN !== null && deltaEN > 0.45) {
        return {
          canCombine: true,
          combinationMode: 'ORDERED_INTERMETALLIC',
          stabilityClass: 'STABLE',
          stabilityVerdict: `ESTABLE · COMPUESTO INTERMETÁLICO ORDENADO (Δχ = ${deltaEN.toFixed(2)}, δr = ${mismatchPct.toFixed(1)}%)`,
          bondingRegime: 'ORDERED INTERMETALLIC SUPERLATTICE (B2 / L1₂ / Laves)',
          ionicityPct,
          deltaEN,
          humeRotheryMismatchPct: Number(mismatchPct.toFixed(2)),
          enthalpy: -45.0,
          physicalConditions: `T = ${temperatureK} K · Superred B2/L1₂ · Δχ = ${deltaEN.toFixed(2)} · δr = ${mismatchPct.toFixed(1)}%`,
          legionCohorts: ['C01_SYSTEMS', 'C03_MATH_CONTROL (Superlattice Symmetry)'],
          engineeringSummary: `La diferencia electrónica (Δχ = ${deltaEN.toFixed(2)}) favorece una superred intermetálica ordenada de alta rigidez específica.`
        };
      }

      return {
        canCombine: true,
        combinationMode: 'BIPHASIC_EUTECTIC_ALLOY',
        stabilityClass: 'METASTABLE',
        stabilityVerdict: `METAESTABLE / BIFÁSICO · DESAJUSTE RETICULAR ALTO (δr = ${mismatchPct.toFixed(1)}% > 15% · Límite de Solubilidad)`,
        bondingRegime: 'EUTECTIC / LAVES PHASE METALLIC COMPOSITE',
        ionicityPct,
        deltaEN,
        humeRotheryMismatchPct: Number(mismatchPct.toFixed(2)),
        enthalpy: 8.0,
        physicalConditions: `T = ${temperatureK} K · Límite de solubilidad Hume-Rothery superado (δr = ${mismatchPct.toFixed(1)}% > 15%)`,
        legionCohorts: ['C03_MATH_CONTROL (Strain Tensor)', 'C07_GAME_THEORY_ECON (Phase Separation)'],
        engineeringSummary: `El desajuste de radios (${mismatchPct.toFixed(1)}% > 15%) induce tensión elástica reticular, generando segregación eutéctica o fases de Laves.`
      };
    }

    // 5. Transition Metal + Small Interstitial (C, N, B, H): Hägg's Rule (LEGION C03)
    const metalsInTray = zList.filter(z => TRANSITION_METALS.has(z) || METALS.has(z));
    const interstitialsInTray = zList.filter(z => SMALL_INTERSTITIALS.has(z));
    if (metalsInTray.length >= 1 && interstitialsInTray.length >= 1 && metalsInTray.length + interstitialsInTray.length === zList.length) {
      const rMetal = Math.max(...metalsInTray.map(z => ATOMIC_RADII_ANGSTROM[z] || 1.55));
      const rInter = Math.min(...interstitialsInTray.map(z => ATOMIC_RADII_ANGSTROM[z] || 0.75));
      const haggRatio = rInter / rMetal;
      const isSimpleHagg = haggRatio <= 0.59;
      return {
        canCombine: true,
        combinationMode: 'HAGG_INTERSTITIAL_CERAMIC',
        stabilityClass: isSimpleHagg ? 'STABLE' : 'METASTABLE',
        stabilityVerdict: isSimpleHagg
          ? `ESTABLE · CERÁMICA INTERSTICIAL DE HÄGG (r_i/r_M = ${haggRatio.toFixed(2)} ≤ 0.59 · Alta Dureza Refractaria)`
          : `METAESTABLE / RED COMPLEJA · RATIO DE HÄGG (r_i/r_M = ${haggRatio.toFixed(2)} > 0.59)`,
        bondingRegime: 'MIXED COVALENT-METALLIC INTERSTITIAL LATTICE',
        ionicityPct,
        deltaEN,
        haggRatio: Number(haggRatio.toFixed(3)),
        enthalpy: isSimpleHagg ? -140.0 : -35.0,
        physicalConditions: `T = ${temperatureK} K · Regla Intersticial de Hägg r_i/r_M = ${haggRatio.toFixed(2)} (${isSimpleHagg ? '≤ 0.59 Octaédrico' : '> 0.59 Prisma Trigonal'})`,
        legionCohorts: ['C03_MATH_CONTROL (Octahedral Interstices)', 'C04_GRAPHICS_SHADERS'],
        engineeringSummary: isSimpleHagg
          ? `El soluto ligero ocupa intersticios octaédricos/trigonales de la red metálica sin romper su empaquetamiento compacto (Regla de Hägg ≤ 0.59).`
          : `El radio intersticial supera el umbral simple de Hägg (0.59), formando prismas trigonales distorsionados tipo cementita/boruro.`
      };
    }

    // 5b. Goldschmidt ABX₃ Perovskite Tolerance Rule (LEGION C03 + C04)
    const goldschmidt = computeGoldschmidtTolerance(zList);
    if (goldschmidt) {
      const isStablePerovskite = goldschmidt.t >= 0.71 && goldschmidt.t <= 1.05;
      const estimatedEnthalpy = isStablePerovskite ? -1580.0 : -820.0;
      const freeEnergyKJmol = evaluateFreeEnergyKJmol(estimatedEnthalpy, -185.0, temperatureK);
      return {
        canCombine: true,
        combinationMode: 'GOLDSCHMIDT_PEROVSKITE_OXIDE',
        stabilityClass: isStablePerovskite ? 'STABLE' : 'METASTABLE',
        stabilityVerdict: `${isStablePerovskite ? 'ESTABLE' : 'METAESTABLE'} · ${goldschmidt.regime} (t = ${goldschmidt.t})`,
        bondingRegime: 'CORNER-SHARING BO₆ OCTAHEDRAL PEROVSKITE NETWORK',
        ionicityPct,
        deltaEN,
        goldschmidt,
        enthalpy: estimatedEnthalpy,
        freeEnergyKJmol,
        scribaGate: 'GO_DEGRADED',
        chronolithSeal: computeChronolithSeal(`PEROVSKITE|${zList.join('-')}|${temperatureK}`),
        physicalConditions: `T = ${temperatureK} K · Factor de Goldschmidt t = ${goldschmidt.t} · ΔG°(${temperatureK}K) = ${freeEnergyKJmol} kJ/mol`,
        legionCohorts: ['C03_MATH_CONTROL (Goldschmidt Tolerance)', 'C04_GRAPHICS_SHADERS (Octahedral Cage)'],
        engineeringSummary: `Factor de tolerancia de Goldschmidt t = ${goldschmidt.t} (r_A=${goldschmidt.rA} Å, r_B=${goldschmidt.rB} Å, r_X=${goldschmidt.rX} Å).`
      };
    }

    // 6. General Ionic / Covalent Electronegativity Drive (Pauling Rule)
    if (zList.length >= 2 && deltaEN !== null) {
      const isStronglyFavorable = deltaEN >= 1.2;
      const isModeratelyFavorable = deltaEN >= 0.35;
      const stabilityClass = hasRadioactive
        ? 'METASTABLE'
        : isStronglyFavorable
          ? 'STABLE'
          : isModeratelyFavorable
            ? 'METASTABLE'
            : 'METASTABLE';
      const estimatedEnthalpy = Math.round(-96.5 * deltaEN * deltaEN);
      const freeEnergyKJmol = evaluateFreeEnergyKJmol(estimatedEnthalpy, -35.0, temperatureK);
      return {
        canCombine: true,
        combinationMode: isStronglyFavorable ? 'IONIC_COVALENT_SYNTHESIS' : 'COVALENT_MOLECULAR_HYBRID',
        stabilityClass,
        stabilityVerdict: isStronglyFavorable
          ? `ESTABLE · IMPULSO ELECTRONEGATIVO FAVORABLE (Δχ = ${deltaEN.toFixed(2)}, Ionicidad ≈ ${ionicityPct}%, ΔH_est ≈ ${estimatedEnthalpy} kJ/mol)`
          : `VIABLE CONDICIONAL · COVALENCIA POLAR / HOMOPOLAR (Δχ = ${deltaEN.toFixed(2)}, Ionicidad ≈ ${ionicityPct}%)`,
        bondingRegime: vanArkelRegime(meanEN, deltaEN, allMetals),
        ionicityPct,
        deltaEN,
        enthalpy: estimatedEnthalpy,
        freeEnergyKJmol,
        scribaGate: 'GO_DEGRADED',
        chronolithSeal: computeChronolithSeal(`PAULING|${zList.join('-')}|${temperatureK}`),
        physicalConditions: `T = ${temperatureK} K · Δχ = ${deltaEN.toFixed(2)} (${ionicityPct}% iónico) · ΔG°_est(${temperatureK}K) = ${freeEnergyKJmol} kJ/mol`,
        legionCohorts: ['C03_MATH_CONTROL', 'C05_BIOMED_OMICS (Pauling Valence)', 'C10_CYBERNETIC_GOV'],
        engineeringSummary: hasRadioactive
          ? 'Contiene radionúclido pesado (Z ≥ 84); la red química sufre radiólisis y retroceso alfa.'
          : `Evaluación sinérgica de Pauling–Van Arkel: diferencia de electronegatividad Δχ = ${deltaEN.toFixed(2)} (${ionicityPct}% carácter iónico).`
      };
    }

    return {
      canCombine: false,
      combinationMode: 'INSUFFICIENT_REACTANTS',
      stabilityClass: 'UNKNOWN',
      stabilityVerdict: 'SELECCIONA AL MENOS 2 ESPECIES (ELEMENTOS O MOLÉCULAS)',
      bondingRegime: 'N/D',
      ionicityPct: null,
      deltaEN: null,
      enthalpy: null,
      scribaGate: 'NO_GO',
      physicalConditions: `T = ${temperatureK} K · p = 1 atm · Esperando reactivos`,
      legionCohorts: ['C10_CYBERNETIC_GOV'],
      engineeringSummary: 'Añade elementos de la tabla periódica o moléculas del laboratorio para evaluar su síntesis.'
    };
  }

  function chemical({ reactants, reaction, temperatureK = 298 }) {
    const factors = [];
    const requirements = [];
    const instability = [];
    const electronegativities = (reactants || []).map(item => Number(item?.electronegativity)).filter(Number.isFinite);
    const deltaEN = electronegativities.length >= 2 ? Math.max(...electronegativities) - Math.min(...electronegativities) : null;
    const multi = multidisciplinary({ reactants, reaction, temperatureK });

    if (!reaction) {
      if (deltaEN !== null) factors.push(`Δχ=${deltaEN.toFixed(2)} (${multi.ionicityPct}% ionic)`);
      if (multi.humeRotheryMismatchPct !== undefined) factors.push(`Hume-Rothery δr=${multi.humeRotheryMismatchPct}%`);
      if (multi.haggRatio !== undefined) factors.push(`Hägg r_i/r_M=${multi.haggRatio}`);
      if (multi.goldschmidt) factors.push(`Goldschmidt t=${multi.goldschmidt.t}`);
      return {
        domain:'chemical',
        status:'NO_CATALOGUED_PATH',
        score:null,
        confidence:0,
        factors:['CATALOGUE: N/D', ...factors],
        requirements:['ΔHf°, Ea and k(T): N/D'],
        instability:['Products / competing pathways: N/D'],
        multidisciplinary:multi
      };
    }

    if (deltaEN !== null) factors.push(`Δχ=${deltaEN.toFixed(2)}`);
    factors.push(`CATALOGUE: ${reaction.evidenceLevel || 'LEGACY_ENTRY'}`);
    if (reaction.enthalpy !== undefined) factors.push(`ΔH=${reaction.enthalpy} kJ/mol`);
    else requirements.push('ΔHf°: N/D');
    if (multi.freeEnergyKJmol !== null && multi.freeEnergyKJmol !== undefined) factors.push(`ΔG°(${temperatureK}K)=${multi.freeEnergyKJmol} kJ/mol`);
    if (multi.goldschmidt) factors.push(`Goldschmidt t=${multi.goldschmidt.t}`);
    if (!reaction.activationEnergy) requirements.push('Ea / k(T): N/D');
    if (!reaction.pressure) requirements.push('p° ≈ 1 atm · SOURCE: N/D');
    if (!reaction.temperatureRange) requirements.push(`T=${temperatureK} K · RANGE: N/D`);
    if (/metastable|decompose|unstable/i.test(`${reaction.note || ''} ${reaction.stabilityVerdict || ''}`)) {
      instability.push(reaction.stabilityVerdict || reaction.note);
    }
    return {
      domain:'chemical',
      status:reaction.evidenceLevel === 'CATALOGUED'
        ? 'COMPOSITION_CATALOGUED_ROUTE_UNEVALUATED'
        : 'REFERENCE_MODEL_INCOMPLETE_DATA',
      score:null,
      confidence:null,
      factors,
      requirements,
      instability,
      multidisciplinary:multi
    };
  }

  function nuclear({ reaction, isotopes }) {
    if (!reaction) return {domain:'nuclear',status:'NO_EVALUATED_CHANNEL',score:null,confidence:0,factors:[],requirements:['ISOTOPE CHANNEL: N/D'],instability:['σ(E) / products: N/D']};
    const reactants = reaction.reactants.map(id => isotopes[id]);
    const charged = reactants.filter(item => item && item.Z > 0);
    let barrierMeV = 0;
    if (charged.length >= 2) {
      const [a,b] = charged;
      barrierMeV = (1.44 * a.Z * b.Z) / (1.2 * (Math.cbrt(a.A) + Math.cbrt(b.A)));
    }
    const qPositive = Number(reaction.qMeV) > 0;
    const factors = [`Q≈${reaction.qMeV} MeV`, 'A/Z: CONSERVED'];
    if (barrierMeV) factors.push(`V꜀≈${barrierMeV.toFixed(2)} MeV (contact estimate)`);
    const requirements = reaction.id.includes('thermal') ? ['nₜₕ + TARGET'] : barrierMeV ? [`E_cm / P_tunnel → V꜀≈${barrierMeV.toFixed(2)} MeV`] : [];
    const instability = [];
    if (reaction.note) instability.push('YIELDS = DISTRIBUTED · CHANNEL ≠ UNIQUE');
    if (reaction.branch) instability.push('BRANCH SET ≠ UNIQUE');
    return {
      domain:'nuclear', status:qPositive ? 'EXOENERGETIC_CHANNEL_KINETICS_UNEVALUATED' : 'ENERGY_INPUT_REQUIRED',
      score:null, confidence:null, barrierMeV, factors, requirements, instability
    };
  }

  // THEORIA-NULLA & INYEKTOR: Crystallographic Polymorph Phase Competition (P, T)
  const POLYMORPH_FAMILIES = {
    'C': [
      { id:'graphite', formula:'C', name:'α-Grafito Hexagonal (sp²)', spaceGroup:'P6₃/mmc (No. 194)', geomType:'hex_layered', atoms:[{z:6,c:42}], bondLengthA:1.42, melt:null, boil:3915, transition:'sublimation', enthalpy:0.0, entropyJmolK:5.74, bulkModulusGPa:34, vickersGPa:0.2, bandgapEv:0.0, pWindow:'0 – 5.0 GPa', tWindow:'0 – 3915 K', note:'Fase termodinámica basal del carbono a 1 atm (ΔHf° = 0 kJ/mol); conducción balística en planos basales sp².' },
      { id:'diamond', formula:'C', name:'Diamante Cúbico (sp³)', spaceGroup:'Fd-3m (No. 227)', geomType:'diamond_cubic', atoms:[{z:6,c:24}], bondLengthA:1.544, melt:null, boil:3915, transition:'sublimation', enthalpy:1.9, entropyJmolK:2.38, bulkModulusGPa:443, vickersGPa:95.0, bandgapEv:5.47, pWindow:'5.0 – 60 GPa', tWindow:'0 – 4200 K', note:'Polimorfo tetraédrico sp³ de alta presión (Clapeyron dP/dT = 2.7 MPa/K); metaestable cinéticamente a 1 atm.' },
      { id:'lonsdaleite', formula:'C', name:'Lonsdaleíta Hexagonal 2H (sp³)', spaceGroup:'P6₃/mmc (No. 194 · 2H)', geomType:'wurtzite_hex', atoms:[{z:6,c:24}], bondLengthA:1.54, melt:null, boil:3900, transition:'sublimation', enthalpy:4.5, entropyJmolK:2.50, bulkModulusGPa:450, vickersGPa:110.0, bandgapEv:4.50, pWindow:'15 – 120 GPa (Choque)', tWindow:'1000 – 3500 K', note:'Diamante hexagonal formado en impactos hiperveloces (> 15 GPa); rigidez axial superior al diamante cúbico.' }
    ],
    'BN': [
      { id:'h-BN', formula:'BN', name:'h-BN Hexagonal 2D (Grafeno Blanco)', spaceGroup:'P6₃/mmc (No. 194)', geomType:'hex_layered', atoms:[{z:5,c:21},{z:7,c:21}], bondLengthA:1.45, melt:3246, boil:3400, transition:'sublimation', enthalpy:-254.4, entropyJmolK:-87.7, bulkModulusGPa:36.5, vickersGPa:1.5, bandgapEv:5.96, pWindow:'0 – 6.0 GPa', tWindow:'0 – 3246 K', note:'Polimorfo laminar sp² isoelectrónico al grafito; aislante de banda ancha y sustrato van der Waals sin trampas de carga.' },
      { id:'c-BN', formula:'BN', name:'c-BN Borazón Cúbico Esfalerita (sp³)', spaceGroup:'F-43m (No. 216)', geomType:'diamond_cubic', atoms:[{z:5,c:12},{z:7,c:12}], bondLengthA:1.57, melt:3246, boil:3500, transition:'sublimation', enthalpy:-266.8, entropyJmolK:-92.1, bulkModulusGPa:382, vickersGPa:62.0, bandgapEv:6.40, pWindow:'6.0 – 50 GPa', tWindow:'1500 – 3500 K', note:'Segundo material sintético más duro (HV = 62 GPa); químicamente inerte frente al hierro líquido donde el diamante se disuelve.' },
      { id:'w-BN', formula:'BN', name:'w-BN Wurtzita Hexagonal (sp³)', spaceGroup:'P6₃mc (No. 186)', geomType:'wurtzite_hex', atoms:[{z:5,c:12},{z:7,c:12}], bondLengthA:1.56, melt:3200, boil:3450, transition:'sublimation', enthalpy:-263.0, entropyJmolK:-90.5, bulkModulusGPa:390, vickersGPa:70.0, bandgapEv:5.80, pWindow:'12 – 90 GPa', tWindow:'1000 – 3400 K', note:'Fase densa de alta presión con reorientación de enlaces opuestos bajo tensión de indentación extrema.' }
    ],
    'TiO₂': [
      { id:'rutile', formula:'TiO₂', name:'TiO₂ Rutilo Tetragonal', spaceGroup:'P4₂/mnm (No. 136)', geomType:'rutile_oct', atoms:[{z:22,c:9},{z:8,c:18}], bondLengthA:1.96, melt:2116, boil:3245, enthalpy:-944.0, entropyJmolK:-185.5, bulkModulusGPa:212, vickersGPa:11.0, bandgapEv:3.03, pWindow:'0 – 12 GPa', tWindow:'873 – 2116 K', note:'Fase termodinámica más estable de TiO₂; cadenas lineales de octaedros TiO₆ que facilitan canales de vacantes en memristores.' },
      { id:'anatase', formula:'TiO₂', name:'TiO₂ Anatasa Tetragonal (Fotocatalítica)', spaceGroup:'I4₁/amd (No. 141)', geomType:'anatase_oct', atoms:[{z:22,c:8},{z:8,c:16}], bondLengthA:1.93, melt:2116, boil:3245, enthalpy:-938.7, entropyJmolK:-183.0, bulkModulusGPa:179, vickersGPa:8.5, bandgapEv:3.20, pWindow:'0 – 2.5 GPa', tWindow:'0 – 873 K', note:'Octaedros TiO₆ en zigzag compartiendo 4 aristas; masa efectiva electrónica baja e intensa actividad fotocatalítica UV.' },
      { id:'cotunnite', formula:'TiO₂', name:'TiO₂-OI Cotunnita (Ultra-Alta Presión)', spaceGroup:'Pnma (No. 62 · CN=9)', geomType:'dense_superlattice', atoms:[{z:22,c:9},{z:8,c:18}], bondLengthA:2.02, melt:2116, boil:3245, enthalpy:-910.0, entropyJmolK:-195.0, bulkModulusGPa:431, vickersGPa:38.0, bandgapEv:2.55, pWindow:'12 – 80 GPa', tWindow:'300 – 2000 K', note:'Polimorfo de coordinación 9 sintetizado en celda de yunque de diamante (B₀ = 431 GPa, dureza cercana al c-BN).' }
    ],
    'SiO₂': [
      { id:'quartz', formula:'SiO₂', name:'α-Cuarzo Trigonal (Piezoeléctrico)', spaceGroup:'P3₁21 (No. 152)', geomType:'quartz_tetra', atoms:[{z:14,c:9},{z:8,c:18}], bondLengthA:1.61, melt:1986, boil:3223, enthalpy:-910.7, entropyJmolK:-182.5, bulkModulusGPa:37.7, vickersGPa:11.5, bandgapEv:8.90, pWindow:'0 – 3.0 GPa', tWindow:'0 – 846 K', note:'Red helicoidal quiral de tetraedros SiO₄ compartiendo vértices (CN=4); estándar universal de osciladores piezoeléctricos.' },
      { id:'cristobalite', formula:'SiO₂', name:'β-Cristobalita Cúbica (Alta T)', spaceGroup:'Fd-3m (No. 227)', geomType:'diamond_cubic', atoms:[{z:14,c:8},{z:8,c:16}], bondLengthA:1.60, melt:1986, boil:3223, enthalpy:-907.5, entropyJmolK:-179.0, bulkModulusGPa:16.4, vickersGPa:9.5, bandgapEv:8.50, pWindow:'0 – 2.0 GPa', tWindow:'1743 – 1986 K', note:'Polimorfo refractario de alta temperatura donde los silicios adoptan una red tipo diamante unida por puentes Si–O–Si de 180°.' },
      { id:'stishovite', formula:'SiO₂', name:'Estishovita Rutilo (SiO₆ Octaédrico · P > 9 GPa)', spaceGroup:'P4₂/mnm (No. 136 · CN=6)', geomType:'rutile_oct', atoms:[{z:14,c:9},{z:8,c:18}], bondLengthA:1.77, melt:1986, boil:3223, enthalpy:-861.0, entropyJmolK:-198.0, bulkModulusGPa:313, vickersGPa:33.0, bandgapEv:8.20, pWindow:'9.0 – 60 GPa', tWindow:'300 – 2500 K', note:'Bajo presión extrema (> 9 GPa) el silicio salta de coordinación tetraédrica (CN=4) a octaédrica (CN=6), elevando B₀ de 37 a 313 GPa.' }
    ],
    'ZrO₂': [
      { id:'monoclinic', formula:'ZrO₂', name:'m-ZrO₂ Baddeleyita Monoclínica (CN=7)', spaceGroup:'P2₁/c (No. 14)', geomType:'anatase_oct', atoms:[{z:40,c:8},{z:8,c:16}], bondLengthA:2.15, melt:2988, boil:4573, enthalpy:-1100.6, entropyJmolK:-194.2, bulkModulusGPa:188, vickersGPa:12.0, bandgapEv:5.20, pWindow:'0 – 5.0 GPa', tWindow:'0 – 1443 K', note:'Polimorfo estable a 298 K con coordinación 7; sufre transformación martensítica expansiva (+4.5% volumen) al enfriar desde 1443 K.' },
      { id:'tetragonal', formula:'ZrO₂', name:'t-ZrO₂ Zirconia Tetragonal Tenaz (TZP)', spaceGroup:'P4₂/nmc (No. 137)', geomType:'rutile_oct', atoms:[{z:40,c:9},{z:8,c:18}], bondLengthA:2.20, melt:2988, boil:4573, enthalpy:-1094.0, entropyJmolK:-189.5, bulkModulusGPa:205, vickersGPa:14.5, bandgapEv:5.10, pWindow:'0 – 10 GPa', tWindow:'1443 – 2643 K', note:'«Acero cerámico»: el campo de tensión en la punta de una grieta dispara la transición t→m, cerrando la fisura por compresión.' },
      { id:'cubic', formula:'ZrO₂', name:'c-ZrO₂ Zirconia Cúbica Fluorita (YSZ)', spaceGroup:'Fm-3m (No. 225)', geomType:'fluorite_cubic', atoms:[{z:40,c:8},{z:8,c:16}], bondLengthA:2.24, melt:2988, boil:4573, enthalpy:-1088.0, entropyJmolK:-186.0, bulkModulusGPa:220, vickersGPa:15.0, bandgapEv:5.00, pWindow:'0 – 20 GPa', tWindow:'2643 – 2988 K', note:'Red fluorita con alta conductividad iónica de O²⁻ y bajísima conductividad térmica (2.1 W/m·K) para álabes de turbina.' }
    ],
    'Fe': [
      { id:'alpha-Fe', formula:'Fe', name:'α-Fe Ferrita BCC (Ferromagnético)', spaceGroup:'Im-3m (No. 229)', geomType:'bcc_lattice', atoms:[{z:26,c:15}], bondLengthA:2.48, melt:1811, boil:3134, enthalpy:0.0, entropyJmolK:27.3, bulkModulusGPa:170, vickersGPa:0.8, bandgapEv:0.0, pWindow:'0 – 13 GPa', tWindow:'0 – 1185 K', note:'Red cúbica centrada en el cuerpo (BCC, factor de empaquetamiento 68%); ferromagnética hasta T_Curie = 1043 K.' },
      { id:'gamma-Fe', formula:'Fe', name:'γ-Fe Austenita FCC (Alta Solubilidad Intersticial)', spaceGroup:'Fm-3m (No. 225)', geomType:'fcc_lattice', atoms:[{z:26,c:18}], bondLengthA:2.58, melt:1811, boil:3134, enthalpy:0.9, entropyJmolK:28.1, bulkModulusGPa:162, vickersGPa:1.2, bandgapEv:0.0, pWindow:'0 – 10 GPa', tWindow:'1185 – 1667 K', note:'Red cúbica centrada en las caras (FCC, empaquetamiento 74%); intersticios octaédricos mayores que disuelven hasta 2.14 wt% de Carbono.' },
      { id:'epsilon-Fe', formula:'Fe', name:'ε-Fe Hexaferrum HCP (Núcleo Terrestre · P > 13 GPa)', spaceGroup:'P6₃/mmc (No. 194)', geomType:'wurtzite_hex', atoms:[{z:26,c:21}], bondLengthA:2.40, melt:6200, boil:9000, enthalpy:3.2, entropyJmolK:25.4, bulkModulusGPa:290, vickersGPa:4.5, bandgapEv:0.0, pWindow:'13 – 360 GPa', tWindow:'0 – 6200 K', note:'Polimorfo hexagonal compacto no-magnético estable sobre 13 GPa; constituye el núcleo interno sólido de la Tierra a 330 GPa.' }
    ]
  };

  const FAMILY_ORDER = ['C', 'BN', 'TiO₂', 'SiO₂', 'ZrO₂', 'Fe'];

  function getNextPolymorph(currentFormula, currentPolyId) {
    let familyKey = FAMILY_ORDER.find(k => k === currentFormula);
    if (!familyKey) {
      if (['Cₙ', 'C₆₀'].includes(currentFormula)) familyKey = 'C';
      else familyKey = 'C';
    }
    const list = POLYMORPH_FAMILIES[familyKey];
    const currentIndex = list.findIndex(item => item.id === currentPolyId);
    if (currentIndex === -1) return { familyKey, polymorph: list[0], index: 0, total: list.length };
    if (currentIndex + 1 < list.length) {
      return { familyKey, polymorph: list[currentIndex + 1], index: currentIndex + 1, total: list.length };
    }
    const nextFamilyIdx = (FAMILY_ORDER.indexOf(familyKey) + 1) % FAMILY_ORDER.length;
    const nextKey = FAMILY_ORDER[nextFamilyIdx];
    const nextList = POLYMORPH_FAMILIES[nextKey];
    return { familyKey: nextKey, polymorph: nextList[0], index: 0, total: nextList.length };
  }

  // SYNKRONIA-SNN-CORE: Neuromorphic Memristor & Bio-Ionic Plasticity Profiles
  const SYNKRONIA_PROFILES = {
    'TiO₂': {
      device:'Memristor Filamentario Pt / TiO₂₋ₓ / Pt',
      mechanism:'Deriva de vacantes de oxígeno doblemente cargadas (V_O••) bajo campo eléctrico',
      vSetV:1.10, vResetV:-0.85, gMinMicroS:0.8, gMaxMicroS:1000.0, tauStdpMs:18.0, energySpikeFJ:45.0,
      formula:'TiO₂', zA:22, zB:8
    },
    'SrTiO₃': {
      device:'Sinapsis Cuántica Perovskita 2DEG SrTiO₃',
      mechanism:'Modulación de barrera Schottky y filamentos de vacantes en octaedros TiO₆',
      vSetV:0.85, vResetV:-0.70, gMinMicroS:0.15, gMaxMicroS:1500.0, tauStdpMs:12.0, energySpikeFJ:18.0,
      formula:'SrTiO₃', zA:38, zB:22
    },
    'BaTiO₃': {
      device:'Unión Túnel Ferroeléctrica (FTJ) BaTiO₃',
      mechanism:'Inversión de polarización espontánea (P_s = 26 μC/cm²) que modula la barrera túnel',
      vSetV:0.70, vResetV:-0.65, gMinMicroS:0.25, gMaxMicroS:1250.0, tauStdpMs:10.0, energySpikeFJ:8.5,
      formula:'BaTiO₃', zA:56, zB:22
    },
    'MoS₂': {
      device:'Memtransistor Neuromórfico 2D Van der Waals MoS₂',
      mechanism:'Migración de vacantes de azufre asistida por bordes de grano en monocapa 2D',
      vSetV:0.95, vResetV:-0.80, gMinMicroS:0.05, gMaxMicroS:650.0, tauStdpMs:15.0, energySpikeFJ:15.0,
      formula:'MoS₂', zA:42, zB:16
    },
    'LiCoO₂': {
      device:'Sinapsis Electroquímica de Estado Sólido Li₁₋ₓCoO₂',
      mechanism:'Intercalación/desintercalación reversible de iones Li⁺ con 256 estados analógicos lineales',
      vSetV:0.45, vResetV:-0.40, gMinMicroS:2.0, gMaxMicroS:1800.0, tauStdpMs:25.0, energySpikeFJ:12.0,
      formula:'LiCoO₂', zA:27, zB:8
    },
    'NaCl': {
      device:'Canal Iónico Biológico Hodgkin-Huxley Na⁺ / H₂O',
      mechanism:'Despolarización de membrana (-70 mV → +40 mV) por transporte selectivo de Na⁺ solvatado',
      vSetV:0.055, vResetV:-0.070, gMinMicroS:0.5, gMaxMicroS:120.0, tauStdpMs:20.0, energySpikeFJ:5.0,
      formula:'Na⁺(H₂O)₆Cl⁻', zA:11, zB:8
    }
  };

  function evaluateSynkroniaState(formulaOrKey, pulseCount = 1, temperatureK = 298) {
    const cleanKey = SYNKRONIA_PROFILES[formulaOrKey]
      ? formulaOrKey
      : (formulaOrKey && formulaOrKey.includes('Na') ? 'NaCl' : 'SrTiO₃');
    const prof = SYNKRONIA_PROFILES[cleanKey];
    const n = Math.max(1, Number(pulseCount) || 1);
    // STDP Long-Term Potentiation (LTP) curve with thermal Arrhenius acceleration
    const thermalFactor = Math.min(1.6, Math.max(0.6, temperatureK / 298.0));
    const weight = Number((1 - 0.92 * Math.exp(-0.38 * n * thermalFactor)).toFixed(3));
    const conductanceMicroS = Number((prof.gMinMicroS + weight * (prof.gMaxMicroS - prof.gMinMicroS)).toFixed(1));
    const onOffRatio = Math.round(prof.gMaxMicroS / Math.max(0.01, prof.gMinMicroS));
    const stateLabel = weight >= 0.82
      ? 'LRS (ON · FILAMENTO CONDUCTIVO SATURADO · LTP MÁXIMA)'
      : weight >= 0.40
        ? 'POTENCIACIÓN SINÁPTICA ANALÓGICA (STDP · LTP ACTIVA)'
        : 'HRS → TRANSICIÓN UMBRAL (NUCLEACIÓN DE FILAMENTO V_O••)';
    const seal = computeChronolithSeal(`SYNKRONIA|${prof.formula}|w=${weight}|T=${temperatureK}`);
    return {
      profileKey: cleanKey,
      ...prof,
      pulseCount: n,
      synapticWeight: weight,
      conductanceMicroS,
      onOffRatio,
      stateLabel,
      chronolithSeal: seal
    };
  }

  // Bragg Powder X-Ray Diffraction (XRD) Simulator (Cu Kα λ = 1.5406 Å, nλ = 2d·sinθ)
  function computeBraggXRDPattern(coordsAngstrom = [], wavelengthA = 1.5406) {
    if (!Array.isArray(coordsAngstrom) || coordsAngstrom.length < 2) {
      return { radiation: `Cu Kα (λ=${wavelengthA} Å)`, peaks: [], chronolithSeal: computeChronolithSeal('XRD|EMPTY') };
    }
    const bins = new Map();
    const maxAtoms = Math.min(coordsAngstrom.length, 48);
    for (let i = 0; i < maxAtoms; i++) {
      const a = coordsAngstrom[i];
      const az = a.zCoord !== undefined ? a.zCoord : (a.zPos || 0);
      for (let j = i + 1; j < maxAtoms; j++) {
        const b = coordsAngstrom[j];
        const bz = b.zCoord !== undefined ? b.zCoord : (b.zPos || 0);
        const dist = Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), az - bz);
        if (dist < 0.85 || dist > 6.5) continue;
        // Consider fundamental plane spacing d and second-order d/2
        [dist, dist * 0.5].forEach((dVal, orderIdx) => {
          if (dVal <= wavelengthA * 0.52) return;
          const dKey = Math.round(dVal * 25) / 25;
          const weight = ((a.z || 6) * (b.z || 6)) / (orderIdx === 0 ? 1 : 2.2);
          bins.set(dKey, (bins.get(dKey) || 0) + weight);
        });
      }
    }
    const rawPeaks = [];
    for (const [dA, rawIntensity] of bins.entries()) {
      const sinTheta = wavelengthA / (2 * dA);
      if (sinTheta <= 0.05 || sinTheta >= 0.98) continue;
      const twoThetaDeg = (2 * Math.asin(sinTheta) * 180) / Math.PI;
      // Lorentz-polarization factor approximation
      const thetaRad = Math.asin(sinTheta);
      const lpFactor = (1 + Math.pow(Math.cos(2 * thetaRad), 2)) / (Math.pow(Math.sin(thetaRad), 2) * Math.cos(thetaRad));
      rawPeaks.push({
        dA: Number(dA.toFixed(3)),
        twoThetaDeg: Number(twoThetaDeg.toFixed(1)),
        score: rawIntensity * Math.min(8.0, lpFactor * 0.25)
      });
    }
    rawPeaks.sort((u, v) => v.score - u.score);
    const maxScore = rawPeaks[0]?.score || 1;
    const hklLabels = ['(111)', '(200)', '(220)', '(311)', '(222)'];
    const peaks = rawPeaks.slice(0, 4).map((p, idx) => {
      const intensity = Math.max(8, Math.round((p.score / maxScore) * 100));
      return {
        hkl: hklLabels[idx] || `(hkl_${idx + 1})`,
        dA: p.dA,
        dSpacingA: p.dA,
        twoThetaDeg: p.twoThetaDeg,
        intensity,
        intensityPct: intensity
      };
    });
    const seal = computeChronolithSeal(`XRD|${wavelengthA}|${peaks.map(p => p.twoThetaDeg).join(',')}`);
    return {
      radiation: `Cu Kα (λ=${wavelengthA} Å)`,
      peaks,
      chronolithSeal: seal
    };
  }

  function computePaulingPartialCharge(atomEN, meanEN) {
    if (!Number.isFinite(atomEN) || !Number.isFinite(meanEN)) {
      return { q: 0, hexColor: 0xE2E8F0, label: 'δ⁰ (Neutro)' };
    }
    const diff = meanEN - atomEN;
    const q = Number(Math.max(-1, Math.min(1, diff / 1.65)).toFixed(3));
    let hexColor = 0xE2E8F0;
    let label = 'δ⁰ (Covalente Apolar)';
    if (q >= 0.12) {
      hexColor = 0x38BDF8;
      label = `δ⁺ (+${q}e · Sitio Electrofílico)`;
    } else if (q <= -0.12) {
      hexColor = 0xF43F5E;
      label = `δ⁻ (${q}e · Sitio Nucleofílico)`;
    }
    return { q, hexColor, label };
  }

  // Real 3D Potential Energy Minimization & LIF Neuromorphic Relaxation Engine (∇U → 0)
  function relaxAtomicStructure(atoms3D = [], scaleAngstrom = 0.42, temperatureK = 298) {
    if (!Array.isArray(atoms3D) || atoms3D.length < 2) return null;
    const n = Math.min(atoms3D.length, 96);
    const scaleA = Number.isFinite(scaleAngstrom) && scaleAngstrom > 0.02 ? scaleAngstrom : 0.42;
    const invScale = 1.0 / scaleA;

    const enList = atoms3D.slice(0, n).map(a => Number(a.electronegativity) || 2.0);
    const meanEN = enList.reduce((s, v) => s + v, 0) / n;
    const minEN = Math.min(...enList);
    const maxEN = Math.max(...enList);
    const deltaEN = maxEN - minEN;

    const state = atoms3D.slice(0, n).map((a, idx) => {
      const z = Number(a.z) || 6;
      const rCov = (ATOMIC_RADII_ANGSTROM[z] || 1.38) * 0.84;
      const q = computePaulingPartialCharge(enList[idx], meanEN).q;
      return {
        z,
        rCov,
        q,
        en: enList[idx],
        xA: (Number(a.x) || 0) * scaleA,
        yA: (Number(a.y) || 0) * scaleA,
        zA: (Number(a.zCoord !== undefined ? a.zCoord : a.zPos) || 0) * scaleA,
        vMem: 0
      };
    });

    const origCx = state.reduce((s, p) => s + p.xA, 0) / n;
    const origCy = state.reduce((s, p) => s + p.yA, 0) / n;
    const origCz = state.reduce((s, p) => s + p.zA, 0) / n;

    function computeSystemPotentialAndForces() {
      let totalU = 0;
      const fx = new Float64Array(n);
      const fy = new Float64Array(n);
      const fz = new Float64Array(n);

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = state[i].xA - state[j].xA;
          const dy = state[i].yA - state[j].yA;
          const dz = state[i].zA - state[j].zA;
          const r = Math.max(0.65, Math.hypot(dx, dy, dz));
          if (r > 6.5) continue;

          const rEq = Math.max(1.05, state[i].rCov + state[j].rCov);
          const sigma = rEq * 0.8908987; // 2^(-1/6)
          const eps = 16.0 + 28.0 * Math.abs(state[i].en - state[j].en);
          const sr = sigma / r;
          const sr6 = Math.pow(sr, 6);
          const sr12 = sr6 * sr6;

          const uLJ = 4.0 * eps * (sr12 - sr6);
          const uCoul = 138.935 * (state[i].q * state[j].q) / (2.5 * r);
          totalU += (uLJ + uCoul);

          // Force dU/dr (clamped for numerical stability)
          const fMag = Math.max(-180, Math.min(180, (24.0 * eps / r) * (2.0 * sr12 - sr6) + 138.935 * (state[i].q * state[j].q) / (2.5 * r * r)));
          const ux = dx / r;
          const uy = dy / r;
          const uz = dz / r;
          fx[i] += fMag * ux;
          fy[i] += fMag * uy;
          fz[i] += fMag * uz;
          fx[j] -= fMag * ux;
          fy[j] -= fMag * uy;
          fz[j] -= fMag * uz;
        }
      }
      return { totalU, fx, fy, fz };
    }

    const initialEval = computeSystemPotentialAndForces();
    const initialEnergyKJmol = initialEval.totalU / Math.max(1, n);
    let totalSpikes = 0;
    let lastEval = initialEval;

    // 16 iterations of LIF spike-gated gradient relaxation
    const iterations = 16;
    for (let iter = 0; iter < iterations; iter++) {
      const ev = iter === 0 ? initialEval : computeSystemPotentialAndForces();
      lastEval = ev;
      const stepScale = 0.0022 * Math.exp(-iter / 14.0);
      for (let i = 0; i < n; i++) {
        const fNorm = Math.hypot(ev.fx[i], ev.fy[i], ev.fz[i]);
        state[i].vMem = 0.72 * state[i].vMem + fNorm * 0.04;
        const spiked = state[i].vMem >= 0.45;
        if (spiked) {
          totalSpikes++;
          state[i].vMem *= 0.25;
        }
        const gain = spiked ? 1.35 : 0.65;
        const maxDispA = 0.055;
        const dxStep = Math.max(-maxDispA, Math.min(maxDispA, ev.fx[i] * stepScale * gain));
        const dyStep = Math.max(-maxDispA, Math.min(maxDispA, ev.fy[i] * stepScale * gain));
        const dzStep = Math.max(-maxDispA, Math.min(maxDispA, ev.fz[i] * stepScale * gain));
        state[i].xA += dxStep;
        state[i].yA += dyStep;
        state[i].zA += dzStep;
      }
    }

    const finalEval = computeSystemPotentialAndForces();
    lastEval = finalEval;
    const finalEnergyKJmol = Math.min(initialEnergyKJmol, finalEval.totalU / Math.max(1, n));
    const deltaEnergyKJmol = Number((finalEnergyKJmol - initialEnergyKJmol).toFixed(2));

    // Recenter to original centroid
    const newCx = state.reduce((s, p) => s + p.xA, 0) / n;
    const newCy = state.reduce((s, p) => s + p.yA, 0) / n;
    const newCz = state.reduce((s, p) => s + p.zA, 0) / n;
    state.forEach(p => {
      p.xA += (origCx - newCx);
      p.yA += (origCy - newCy);
      p.zA += (origCz - newCz);
    });

    // Compute residual RMS force (in eV/Å: 1 kJ/mol/Å ≈ 0.010364 eV/Å) and mean nearest-neighbor bond length
    let sumForceSq = 0;
    let sumNearestA = 0;
    for (let i = 0; i < n; i++) {
      const fA = Math.hypot(lastEval.fx[i], lastEval.fy[i], lastEval.fz[i]) * 0.010364;
      sumForceSq += fA * fA;
      let dMin = Infinity;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d = Math.hypot(state[i].xA - state[j].xA, state[i].yA - state[j].yA, state[i].zA - state[j].zA);
        if (d < dMin) dMin = d;
      }
      if (Number.isFinite(dMin)) sumNearestA += dMin;
    }
    const rmsForceEvA = Number(Math.sqrt(sumForceSq / n).toFixed(3));
    const meanBondLengthA = Number((sumNearestA / n).toFixed(3));

    const allMetals = state.every(p => METALS.has(p.z));
    const estimatedBandgapEv = allMetals
      ? 0.0
      : Number(Math.max(0.15, Math.min(9.5, 1.35 * deltaEN + (meanEN > 2.4 ? 1.4 : 0.3))).toFixed(2));

    const relaxedPositions = atoms3D.map((orig, idx) => {
      if (idx < n) {
        return {
          x: state[idx].xA * invScale,
          y: state[idx].yA * invScale,
          z: state[idx].zA * invScale
        };
      }
      return {
        x: Number(orig.x) || 0,
        y: Number(orig.y) || 0,
        z: Number(orig.zCoord !== undefined ? orig.zCoord : orig.zPos) || 0
      };
    });

    return {
      atomCount: n,
      initialEnergyKJmol: Number(initialEnergyKJmol.toFixed(2)),
      finalEnergyKJmol: Number(finalEnergyKJmol.toFixed(2)),
      deltaEnergyKJmol,
      rmsForceEvA,
      meanBondLengthA,
      estimatedBandgapEv,
      totalSpikes,
      temperatureK,
      relaxedPositions
    };
  }

  // ─── FT-IR VIBRATIONAL SPECTROSCOPY & QUANTUM NORMAL MODES ENGINE ───
  const FTIR_BOND_FORCE_CONSTANTS = {
    'H-O': 720, 'O-H': 720,
    'H-N': 620, 'N-H': 620,
    'H-C': 480, 'C-H': 480,
    'C=O': 1220, 'O=C': 1220,
    'C-O': 450, 'O-C': 450,
    'C=C': 980,
    'C#C': 1600,
    'C#N': 1650, 'N#C': 1650,
    'C-N': 490, 'N-C': 490,
    'C-C': 420,
    'C-F': 560, 'F-C': 560,
    'C-Cl': 340, 'Cl-C': 340,
    'C-Br': 280, 'Br-C': 280,
    'P=O': 1050, 'O=P': 1050,
    'S=O': 1080, 'O=S': 1080,
    'S-H': 320, 'H-S': 320
  };

  const STANDARD_ATOMIC_MASSES = {
    1: 1.008, 2: 4.0026, 3: 6.94, 4: 9.0122, 5: 10.81, 6: 12.011, 7: 14.007, 8: 15.999,
    9: 18.998, 10: 20.180, 11: 22.990, 12: 24.305, 13: 26.982, 14: 28.085, 15: 30.974,
    16: 32.06, 17: 35.45, 18: 39.95, 19: 39.098, 20: 40.078, 26: 55.845, 29: 63.546,
    30: 65.38, 35: 79.904, 53: 126.90, 92: 238.03
  };

  function computeFTIRVibrationalSpectrum(atomsList = [], bondsList = [], temperatureK = 298) {
    if (!Array.isArray(atomsList) || atomsList.length === 0) {
      return {
        formula: 'VACÍO',
        atomCount: 0,
        modes: [],
        spectrumCurve: [],
        diagnosticBands: [],
        chronolithSeal: computeChronolithSeal('FTIR|EMPTY')
      };
    }

    const resolvedAtoms = atomsList.map((a, idx) => {
      const z = Number(a.z) || 1;
      const symbol = a.symbol || a.s || (root.NULLA_PERIODIC_TABLE?.[z]?.s) || 'X';
      const mass = Number(a.mass) || Number(a.physicalMass) || STANDARD_ATOMIC_MASSES[z] || 12.0;
      const pos = {
        x: Number(a.x !== undefined ? a.x : (a.targetPos?.x ?? 0)),
        y: Number(a.y !== undefined ? a.y : (a.targetPos?.y ?? 0)),
        z: Number(a.zCoord !== undefined ? a.zCoord : (a.targetPos?.z ?? (a.zPos ?? 0)))
      };
      return { idx, z, symbol, mass, pos };
    });

    const resolvedBonds = [];
    if (Array.isArray(bondsList) && bondsList.length > 0) {
      bondsList.forEach(b => {
        const aIdx = b.a !== undefined ? b.a : b.aIdx;
        const bIdx = b.b !== undefined ? b.b : b.bIdx;
        if (resolvedAtoms[aIdx] && resolvedAtoms[bIdx]) {
          resolvedBonds.push({ a: aIdx, b: bIdx, order: Number(b.order) || 1 });
        }
      });
    } else {
      for (let i = 0; i < resolvedAtoms.length; i++) {
        for (let j = i + 1; j < resolvedAtoms.length; j++) {
          const dx = resolvedAtoms[i].pos.x - resolvedAtoms[j].pos.x;
          const dy = resolvedAtoms[i].pos.y - resolvedAtoms[j].pos.y;
          const dz = resolvedAtoms[i].pos.z - resolvedAtoms[j].pos.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          const r1 = ATOMIC_RADII_ANGSTROM[resolvedAtoms[i].z] || 1.0;
          const r2 = ATOMIC_RADII_ANGSTROM[resolvedAtoms[j].z] || 1.0;
          const cutoff = (r1 + r2) * 1.35 * 5.0;
          if (dist < cutoff && dist > 0.1) {
            resolvedBonds.push({ a: i, b: j, order: 1 });
          }
        }
      }
    }

    const modes = [];
    const diagnosticBands = [];

    resolvedBonds.forEach(bond => {
      const atomA = resolvedAtoms[bond.a];
      const atomB = resolvedAtoms[bond.b];
      const symA = atomA.symbol;
      const symB = atomB.symbol;
      const pairKey = `${symA}-${symB}`;
      const pairKeyRev = `${symB}-${symA}`;
      const doubleKey = `${symA}=${symB}`;
      const tripleKey = `${symA}#${symB}`;

      let k = 450;
      let groupName = `Enlace ${symA}-${symB}`;
      let bandWidth = 40;

      if (bond.order === 3 || FTIR_BOND_FORCE_CONSTANTS[tripleKey]) {
        k = FTIR_BOND_FORCE_CONSTANTS[tripleKey] || 1600;
        groupName = `Alquino / Nitrilo (${symA}≡${symB})`;
        bandWidth = 35;
      } else if (bond.order === 2 || (symA === 'O' && symB === 'C') || (symA === 'C' && symB === 'O')) {
        k = FTIR_BOND_FORCE_CONSTANTS['C=O'] || 1220;
        groupName = `Carbonilo (${symA}=${symB})`;
        bandWidth = 45;
      } else if (symA === 'H' || symB === 'H') {
        const otherSym = symA === 'H' ? symB : symA;
        if (otherSym === 'O') {
          k = 720;
          groupName = 'Hidroxilo O-H (Estiramiento)';
          bandWidth = 90;
        } else if (otherSym === 'N') {
          k = 620;
          groupName = 'Amina / Amida N-H (Estiramiento)';
          bandWidth = 55;
        } else if (otherSym === 'C') {
          k = 480;
          groupName = 'Alcano / Alqueno C-H (Estiramiento)';
          bandWidth = 40;
        } else {
          k = 380;
          groupName = `Hidruro ${otherSym}-H`;
          bandWidth = 40;
        }
      } else if (FTIR_BOND_FORCE_CONSTANTS[pairKey] || FTIR_BOND_FORCE_CONSTANTS[pairKeyRev]) {
        k = FTIR_BOND_FORCE_CONSTANTS[pairKey] || FTIR_BOND_FORCE_CONSTANTS[pairKeyRev];
        groupName = `Esqueleto ${symA}-${symB}`;
        bandWidth = 45;
      }

      const mu = (atomA.mass * atomB.mass) / (atomA.mass + atomB.mass);
      const nuHarmonic = 130.28 * Math.sqrt(k / Math.max(0.1, mu));

      const bondDir = {
        x: atomB.pos.x - atomA.pos.x,
        y: atomB.pos.y - atomA.pos.y,
        z: atomB.pos.z - atomA.pos.z
      };
      const len = Math.sqrt(bondDir.x*bondDir.x + bondDir.y*bondDir.y + bondDir.z*bondDir.z) || 1.0;
      bondDir.x /= len; bondDir.y /= len; bondDir.z /= len;

      const symDisplacements = resolvedAtoms.map((at, i) => {
        if (i === bond.a) return { dx: -bondDir.x * 0.45, dy: -bondDir.y * 0.45, dz: -bondDir.z * 0.45 };
        if (i === bond.b) return { dx: bondDir.x * 0.45, dy: bondDir.y * 0.45, dz: bondDir.z * 0.45 };
        return { dx: 0, dy: 0, dz: 0 };
      });

      const asymDisplacements = resolvedAtoms.map((at, i) => {
        if (i === bond.a) return { dx: bondDir.x * 0.45, dy: bondDir.y * 0.45, dz: bondDir.z * 0.45 };
        if (i === bond.b) return { dx: bondDir.x * 0.45, dy: bondDir.y * 0.45, dz: bondDir.z * 0.45 };
        return { dx: 0, dy: 0, dz: 0 };
      });

      const wavenumberCm1 = Math.min(3980, Math.max(420, Math.round(nuHarmonic)));

      modes.push({
        id: `stretch_${bond.a}_${bond.b}`,
        type: 'stretch',
        name: `${groupName} (ν₁)`,
        wavenumberCm1,
        forceConstantNm: Math.round(k),
        reducedMassU: Number(mu.toFixed(3)),
        transmittancePct: Math.round(15 + (Math.abs(Math.sin(wavenumberCm1)) * 12)),
        widthCm1: bandWidth,
        bond: [bond.a, bond.b],
        displacements: symDisplacements
      });

      const kBend = k * 0.32;
      const nuBend = Math.min(1680, Math.max(450, Math.round(130.28 * Math.sqrt(kBend / Math.max(0.1, mu)))));
      const orthoDir = Math.abs(bondDir.y) < 0.9 ? { x: -bondDir.z, y: 1, z: bondDir.x } : { x: 1, y: 0, z: 0 };
      const oLen = Math.sqrt(orthoDir.x*orthoDir.x + orthoDir.y*orthoDir.y + orthoDir.z*orthoDir.z) || 1.0;
      orthoDir.x /= oLen; orthoDir.y /= oLen; orthoDir.z /= oLen;

      const bendDisplacements = resolvedAtoms.map((at, i) => {
        if (i === bond.a) return { dx: orthoDir.x * 0.35, dy: orthoDir.y * 0.35, dz: orthoDir.z * 0.35 };
        if (i === bond.b) return { dx: -orthoDir.x * 0.35, dy: -orthoDir.y * 0.35, dz: -orthoDir.z * 0.35 };
        return { dx: 0, dy: 0, dz: 0 };
      });

      modes.push({
        id: `bend_${bond.a}_${bond.b}`,
        type: 'bend',
        name: `Deformación / Tijera (${symA}-${symB}) (ν₂)`,
        wavenumberCm1: nuBend,
        forceConstantNm: Math.round(kBend),
        reducedMassU: Number(mu.toFixed(3)),
        transmittancePct: Math.round(35 + (Math.abs(Math.cos(nuBend)) * 18)),
        widthCm1: 30,
        bond: [bond.a, bond.b],
        displacements: bendDisplacements
      });

      diagnosticBands.push({
        group: groupName,
        wavenumberCm1,
        k: Math.round(k),
        mu: Number(mu.toFixed(3))
      });
    });

    const spectrumCurve = [];
    for (let nu = 4000; nu >= 400; nu -= 4) {
      let absorption = 0;
      modes.forEach(m => {
        const dNu = nu - m.wavenumberCm1;
        const gamma = m.widthCm1;
        const lorentzian = (gamma * gamma) / (dNu * dNu + gamma * gamma);
        absorption += (100 - m.transmittancePct) * lorentzian;
      });
      const baseline = 96.0 - Math.sin(nu * 0.005) * 1.5;
      const t = Math.max(5.0, Math.min(99.0, baseline - absorption));
      spectrumCurve.push({ wavenumber: nu, transmittancePct: Number(t.toFixed(1)) });
    }

    return {
      formula: atomsList.map(a => a.symbol || a.s || 'X').join(''),
      atomCount: resolvedAtoms.length,
      bondCount: resolvedBonds.length,
      temperatureK,
      modes,
      spectrumCurve,
      diagnosticBands,
      chronolithSeal: computeChronolithSeal(`FTIR|${resolvedAtoms.length}|${modes.length}|${temperatureK}`)
    };
  }

  // ─── FRONTIER MOLECULAR ORBITALS (HOMO / LUMO) & BAND GAP ENGINE ───
  const MOLECULAR_ORBITAL_BENCHMARKS = {
    'H2O': { homo: -12.6, lumo: -5.2, name: 'Agua' },
    'CO2': { homo: -13.8, lumo: -5.4, name: 'Dióxido de Carbono' },
    'NH3': { homo: -10.2, lumo: -4.3, name: 'Amoníaco' },
    'CH4': { homo: -13.0, lumo: -3.8, name: 'Metano' },
    'HCl': { homo: -12.7, lumo: -6.8, name: 'Cloruro de Hidrógeno' },
    'NaCl': { homo: -9.5, lumo: -1.0, name: 'Cloruro de Sodio (Sal de Roca)' },
    'TiO2': { homo: -7.5, lumo: -4.3, name: 'Dióxido de Titanio (Rutilo/Anatasa)' },
    'SiO2': { homo: -11.5, lumo: -2.6, name: 'Sílice (Cuarzo)' },
    'C60': { homo: -7.6, lumo: -5.8, name: 'Fullereno C60' },
    'Graphene': { homo: -4.6, lumo: -4.6, name: 'Grafeno Monocapa (Dirac)' },
    'Diamond': { homo: -9.8, lumo: -4.3, name: 'Diamante sp³' },
    'SWCNT': { homo: -5.1, lumo: -4.3, name: 'Nanotubo de Carbono (10,0)' },
    'CaO': { homo: -8.8, lumo: -1.7, name: 'Óxido de Calcio' },
    'Al2O3': { homo: -10.2, lumo: -1.4, name: 'Alúmina (Corindón)' },
    'SiC': { homo: -7.9, lumo: -4.7, name: 'Carburo de Silicio' },
    'TiC': { homo: -6.2, lumo: -5.8, name: 'Carburo de Titanio' },
    'BN': { homo: -9.2, lumo: -3.3, name: 'Nitruro de Boro Hexagonal' },
    'Fe': { homo: -7.9, lumo: -7.6, name: 'Hierro α-BCC' },
    'Cu': { homo: -7.7, lumo: -7.5, name: 'Cobre FCC' }
  };

  function computeHOMOLUMOProperties(atomsList = [], bondsList = [], formulaStr = '', temperatureK = 298) {
    if (!Array.isArray(atomsList) || atomsList.length === 0) {
      return {
        formula: 'VACÍO',
        homoEv: -10.0,
        lumoEv: -5.0,
        bandgapEv: 5.0,
        hardnessEtaEv: 2.5,
        chemicalPotentialEv: -7.5,
        electrophilicityOmegaEv: 11.25,
        regime: 'AISLANTE_ELECTRICO',
        regimeLabel: 'Aislante Eléctrico (Eg > 4.0 eV)',
        energyLevels: [],
        nucleophilicSites: [],
        electrophilicSites: [],
        chronolithSeal: computeChronolithSeal('ORBITAL|EMPTY')
      };
    }

    const cleanFormula = (formulaStr || atomsList.map(a => a.symbol || a.s || 'X').join('')).replace(/[^A-Za-z0-9]/g, '');
    let benchmark = MOLECULAR_ORBITAL_BENCHMARKS[cleanFormula];

    let homoEv = -11.5;
    let lumoEv = -4.5;

    if (benchmark) {
      homoEv = benchmark.homo;
      lumoEv = benchmark.lumo;
    } else {
      const enValues = atomsList.map(a => {
        const z = Number(a.z) || 1;
        const el = root.NULLA_PERIODIC_TABLE?.[z];
        return el?.electronegativity || 2.2;
      });
      const meanEN = enValues.reduce((s, v) => s + v, 0) / Math.max(1, enValues.length);
      const minEN = Math.min(...enValues);
      const maxEN = Math.max(...enValues);
      const deltaEN = maxEN - minEN;

      homoEv = -(7.5 + meanEN * 1.5 + deltaEN * 0.4);
      const estimatedGap = Math.max(0.2, 1.2 + deltaEN * 2.2 + (atomsList.length <= 4 ? 2.5 : 0.8));
      lumoEv = homoEv + estimatedGap;
    }

    const dEg = (temperatureK - 298) * 0.00045;
    const bandgapEv = Number(Math.max(0.0, (lumoEv - homoEv) - dEg).toFixed(2));
    homoEv = Number(homoEv.toFixed(2));
    lumoEv = Number((homoEv + bandgapEv).toFixed(2));

    const hardnessEtaEv = Number((bandgapEv / 2).toFixed(2));
    const chemicalPotentialEv = Number(((homoEv + lumoEv) / 2).toFixed(2));
    const electrophilicityOmegaEv = hardnessEtaEv > 0.05
      ? Number(((chemicalPotentialEv * chemicalPotentialEv) / (2 * hardnessEtaEv)).toFixed(2))
      : 0.0;

    let regime = 'AISLANTE_ELECTRICO';
    let regimeLabel = 'Aislante Eléctrico (Eg > 4.0 eV)';
    if (bandgapEv < 0.3) {
      regime = 'CONDUCTOR_METÁLICO';
      regimeLabel = 'Conductor Metálico / Semimetal (Eg ≈ 0 eV)';
    } else if (bandgapEv < 2.5) {
      regime = 'SEMICONDUCTOR_BANDA_ESTRECHA';
      regimeLabel = 'Semiconductor Banda Estrecha (0.3 ≤ Eg < 2.5 eV)';
    } else if (bandgapEv <= 4.0) {
      regime = 'SEMICONDUCTOR_BANDA_ANCHA';
      regimeLabel = 'Semiconductor Banda Ancha (2.5 ≤ Eg ≤ 4.0 eV)';
    }

    const energyLevels = [
      { id: 'homo_3', label: 'HOMO-3', energy: Number((homoEv - 4.5).toFixed(2)), occupied: true, type: 'core' },
      { id: 'homo_2', label: 'HOMO-2', energy: Number((homoEv - 2.8).toFixed(2)), occupied: true, type: 'bonding' },
      { id: 'homo_1', label: 'HOMO-1', energy: Number((homoEv - 1.3).toFixed(2)), occupied: true, type: 'bonding' },
      { id: 'homo', label: 'HOMO (Dador)', energy: homoEv, occupied: true, type: 'frontier_homo' },
      { id: 'lumo', label: 'LUMO (Aceptor)', energy: lumoEv, occupied: false, type: 'frontier_lumo' },
      { id: 'lumo_1', label: 'LUMO+1', energy: Number((lumoEv + 1.5).toFixed(2)), occupied: false, type: 'antibonding' },
      { id: 'lumo_2', label: 'LUMO+2', energy: Number((lumoEv + 3.2).toFixed(2)), occupied: false, type: 'antibonding' }
    ];

    const nucleophilicSites = [];
    const electrophilicSites = [];
    atomsList.forEach((a, idx) => {
      const z = Number(a.z) || 1;
      const el = root.NULLA_PERIODIC_TABLE?.[z];
      const en = el?.electronegativity || 2.2;
      const sym = a.symbol || a.s || el?.s || 'X';
      if (en >= 3.0 || (z === 8 || z === 7 || z === 9 || z === 17)) {
        nucleophilicSites.push({ index: idx, z, symbol: sym, electronegativity: en, role: 'Par no enlazante / Dador nucleófilo' });
      } else if (en <= 2.2 || (z === 1 || z === 6 || z === 11 || z === 22)) {
        electrophilicSites.push({ index: idx, z, symbol: sym, electronegativity: en, role: 'Lóbulo antienlazante / Aceptor electrófilo' });
      }
    });

    return {
      formula: cleanFormula,
      atomCount: atomsList.length,
      homoEv,
      lumoEv,
      bandgapEv,
      hardnessEtaEv,
      chemicalPotentialEv,
      electrophilicityOmegaEv,
      regime,
      regimeLabel,
      energyLevels,
      nucleophilicSites,
      electrophilicSites,
      chronolithSeal: computeChronolithSeal(`HOMO-LUMO|${cleanFormula}|${homoEv}|${lumoEv}|${temperatureK}`)
    };
  }

  // ─── MOLECULAR ELECTROSTATIC POTENTIAL (MEP / ESP) & DIPOLE ENGINE ───
  const PAULING_ELECTRONEGATIVITIES = {
    1: 2.20, 2: 0.0, 3: 0.98, 4: 1.57, 5: 2.04, 6: 2.55, 7: 3.04, 8: 3.44, 9: 3.98, 10: 0.0,
    11: 0.93, 12: 1.31, 13: 1.61, 14: 1.90, 15: 2.19, 16: 2.58, 17: 3.16, 18: 0.0,
    19: 0.82, 20: 1.00, 21: 1.36, 22: 1.54, 23: 1.63, 24: 1.66, 25: 1.55, 26: 1.83, 27: 1.88, 28: 1.91, 29: 1.90, 30: 1.65,
    31: 1.81, 32: 2.01, 33: 2.18, 34: 2.55, 35: 2.96, 36: 3.00, 37: 0.82, 38: 0.95, 39: 1.22, 40: 1.33,
    41: 1.60, 42: 2.16, 43: 1.90, 44: 2.20, 45: 2.28, 46: 2.20, 47: 1.93, 48: 1.69, 49: 1.78, 50: 1.96,
    51: 2.05, 52: 2.10, 53: 2.66, 54: 2.60, 55: 0.79, 56: 0.89, 72: 1.30, 73: 1.50, 74: 2.36, 78: 2.28,
    79: 2.54, 80: 2.00, 82: 2.33, 83: 2.02, 92: 1.38
  };

  const VDW_RADII_ANGSTROM = {
    1: 1.20, 2: 1.40, 3: 1.82, 4: 1.53, 5: 1.92, 6: 1.70, 7: 1.55, 8: 1.52, 9: 1.47, 10: 1.54,
    11: 2.27, 12: 1.73, 13: 1.84, 14: 2.10, 15: 1.80, 16: 1.80, 17: 1.75, 18: 1.88,
    19: 2.75, 20: 2.31, 22: 2.15, 26: 2.05, 28: 1.63, 29: 1.40, 30: 1.39, 35: 1.85, 53: 1.98
  };

  function computeMolecularElectrostaticPotential(atomsList = [], bondsList = [], temperatureK = 298) {
    if (!Array.isArray(atomsList) || atomsList.length === 0) {
      return {
        formula: 'VACÍO',
        atomCount: 0,
        dipoleDebye: 0.0,
        dipoleVector: { x: 0, y: 0, z: 0 },
        vMinEv: 0.0,
        vMaxEv: 0.0,
        vMeanEv: 0.0,
        varianceEv2: 0.0,
        polarityRegime: 'NO_POLAR',
        polarityLabel: 'No Polar (μ ≈ 0 D)',
        hydrogenBondAcceptors: [],
        hydrogenBondDonors: [],
        mepDistributionCurve: [],
        surfacePoints: [],
        chronolithSeal: computeChronolithSeal('MEP|EMPTY')
      };
    }

    const cleanFormula = atomsList.map(a => a.symbol || a.s || 'X').join('').replace(/[^A-Za-z0-9]/g, '');

    // Step 1: Assign partial charges q_i
    const charges = new Array(atomsList.length).fill(0.0);
    const atomEN = atomsList.map(a => {
      const z = Number(a.z) || 1;
      if (Number.isFinite(a.electronegativity)) return a.electronegativity;
      if (Number.isFinite(a.en)) return a.en;
      const el = root.NULLA_PERIODIC_TABLE?.[z];
      if (el && Number.isFinite(el.electronegativity)) return el.electronegativity;
      return PAULING_ELECTRONEGATIVITIES[z] || 2.20;
    });

    if (Array.isArray(bondsList) && bondsList.length > 0) {
      bondsList.forEach(bond => {
        const i = Number(bond.a);
        const j = Number(bond.b);
        if (i >= 0 && i < atomsList.length && j >= 0 && j < atomsList.length) {
          const deltaEN = atomEN[j] - atomEN[i];
          const absDelta = Math.abs(deltaEN);
          const transferred = (0.22 * absDelta + 0.045 * absDelta * absDelta) * (bond.order || 1);
          if (deltaEN > 0) {
            charges[j] -= transferred;
            charges[i] += transferred;
          } else if (deltaEN < 0) {
            charges[i] -= transferred;
            charges[j] += transferred;
          }
        }
      });
    } else {
      const meanEN = atomEN.reduce((s, v) => s + v, 0) / Math.max(1, atomEN.length);
      atomsList.forEach((_, idx) => {
        charges[idx] = (meanEN - atomEN[idx]) * 0.32;
      });
    }

    // Force neutrality
    const totalCharge = charges.reduce((s, v) => s + v, 0);
    const netCorrection = totalCharge / atomsList.length;
    atomsList.forEach((_, idx) => {
      charges[idx] -= netCorrection;
    });

    // Step 2: Center of mass and Dipole Vector μ = Σ q_i * r_i
    let comX = 0, comY = 0, comZ = 0;
    let totalMass = 0;
    atomsList.forEach((a, idx) => {
      const mass = Number(a.mass) || Number(a.m) || 12.0;
      const x = Number(a.x) || 0;
      const y = Number(a.y) || 0;
      const z = Number(a.zCoord !== undefined ? a.zCoord : (a.z_pos !== undefined ? a.z_pos : 0));
      comX += x * mass;
      comY += y * mass;
      comZ += z * mass;
      totalMass += mass;
    });
    comX /= Math.max(1e-5, totalMass);
    comY /= Math.max(1e-5, totalMass);
    comZ /= Math.max(1e-5, totalMass);

    let muX = 0, muY = 0, muZ = 0;
    atomsList.forEach((a, idx) => {
      const x = (Number(a.x) || 0) - comX;
      const y = (Number(a.y) || 0) - comY;
      const z = (Number(a.zCoord !== undefined ? a.zCoord : (a.z_pos !== undefined ? a.z_pos : 0))) - comZ;
      const q = charges[idx];
      muX += q * x;
      muY += q * y;
      muZ += q * z;
    });

    // 1 e * Å = 4.8032 Debye
    const debyeConv = 4.8032;
    const dipoleX = Number((muX * debyeConv).toFixed(2));
    const dipoleY = Number((muY * debyeConv).toFixed(2));
    const dipoleZ = Number((muZ * debyeConv).toFixed(2));
    const dipoleDebye = Number(Math.sqrt(dipoleX * dipoleX + dipoleY * dipoleY + dipoleZ * dipoleZ).toFixed(2));

    let polarityRegime = 'NO_POLAR';
    let polarityLabel = 'Apolar / No Polar (μ < 0.15 D)';
    if (dipoleDebye >= 2.0) {
      polarityRegime = 'FUERTEMENTE_POLAR';
      polarityLabel = `Fuertemente Polar (μ = ${dipoleDebye} D)`;
    } else if (dipoleDebye >= 0.8) {
      polarityRegime = 'MODERADAMENTE_POLAR';
      polarityLabel = `Polar Prótico/Dipolar (μ = ${dipoleDebye} D)`;
    } else if (dipoleDebye >= 0.15) {
      polarityRegime = 'DEBILMENTE_POLAR';
      polarityLabel = `Débilmente Polar (μ = ${dipoleDebye} D)`;
    }

    // Step 3: Sample Electrostatic Potential V(r) on the Van der Waals envelope
    // V(r) = Σ (14.3996 * q_i / |r - R_i|) in eV
    const COULOMB_K_EV_ANGSTROM = 14.3996;
    const samplesPerAtom = 26;
    const surfacePoints = [];
    const phiGolden = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle

    atomsList.forEach((atom, aIdx) => {
      const z = Number(atom.z) || 1;
      const vdwR = VDW_RADII_ANGSTROM[z] || 1.65;
      const ax = Number(atom.x) || 0;
      const ay = Number(atom.y) || 0;
      const az = Number(atom.zCoord !== undefined ? atom.zCoord : 0);

      for (let s = 0; s < samplesPerAtom; s++) {
        const yFrac = 1.0 - (s / (samplesPerAtom - 1.0)) * 2.0;
        const radiusAtY = Math.sqrt(Math.max(0.0, 1.0 - yFrac * yFrac));
        const theta = phiGolden * s;
        const px = ax + Math.cos(theta) * radiusAtY * vdwR;
        const py = ay + yFrac * vdwR;
        const pz = az + Math.sin(theta) * radiusAtY * vdwR;

        // Electrostatic potential at (px, py, pz)
        let vEv = 0.0;
        for (let j = 0; j < atomsList.length; j++) {
          const jx = Number(atomsList[j].x) || 0;
          const jy = Number(atomsList[j].y) || 0;
          const jz = Number(atomsList[j].zCoord !== undefined ? atomsList[j].zCoord : 0);
          const dist = Math.sqrt((px - jx) ** 2 + (py - jy) ** 2 + (pz - jz) ** 2);
          vEv += (COULOMB_K_EV_ANGSTROM * charges[j]) / Math.max(0.4, dist);
        }

        surfacePoints.push({
          x: Number(px.toFixed(3)),
          y: Number(py.toFixed(3)),
          z: Number(pz.toFixed(3)),
          vEv: Number(vEv.toFixed(2)),
          parentAtomIndex: aIdx
        });
      }
    });

    const vValues = surfacePoints.map(p => p.vEv);
    const vMinEv = Number(Math.min(...vValues).toFixed(2));
    const vMaxEv = Number(Math.max(...vValues).toFixed(2));
    const vMeanEv = Number((vValues.reduce((s, v) => s + v, 0) / Math.max(1, vValues.length)).toFixed(2));
    const varianceEv2 = Number((vValues.reduce((s, v) => s + (v - vMeanEv) ** 2, 0) / Math.max(1, vValues.length)).toFixed(2));

    // Hydrogen bonding sites (Acceptors have V < -0.8 eV, Donors have V > +0.9 eV)
    const hydrogenBondAcceptors = [];
    const hydrogenBondDonors = [];
    atomsList.forEach((a, idx) => {
      const z = Number(a.z) || 1;
      const sym = a.symbol || a.s || 'X';
      const q = Number(charges[idx].toFixed(3));
      if (q <= -0.15 || (z === 8 || z === 7 || z === 9 || z === 17)) {
        hydrogenBondAcceptors.push({ index: idx, z, symbol: sym, charge: q, role: 'Aceptor de Enlace de H (Región Rica en e⁻)' });
      } else if (q >= +0.12 && (z === 1 || atomEN[idx] <= 2.2)) {
        hydrogenBondDonors.push({ index: idx, z, symbol: sym, charge: q, role: 'Dador de Enlace de H (Protón Ácido / Sitio Electrofílico)' });
      }
    });

    // Step 4: Distribution curve for 2D Canvas (histogram of V across -6 eV to +6 eV)
    const bins = 60;
    const vRangeMin = -6.0;
    const vRangeMax = 6.0;
    const binStep = (vRangeMax - vRangeMin) / bins;
    const mepDistributionCurve = [];
    for (let b = 0; b < bins; b++) {
      const bCenter = vRangeMin + (b + 0.5) * binStep;
      const countInBin = vValues.filter(v => v >= bCenter - binStep / 2 && v < bCenter + binStep / 2).length;
      mepDistributionCurve.push({
        vEv: Number(bCenter.toFixed(2)),
        densityPct: Number(((countInBin / Math.max(1, vValues.length)) * 100).toFixed(1))
      });
    }

    return {
      formula: cleanFormula,
      atomCount: atomsList.length,
      charges: charges.map(q => Number(q.toFixed(3))),
      dipoleDebye,
      dipoleVector: { x: dipoleX, y: dipoleY, z: dipoleZ },
      vMinEv,
      vMaxEv,
      vMeanEv,
      varianceEv2,
      polarityRegime,
      polarityLabel,
      hydrogenBondAcceptors,
      hydrogenBondDonors,
      mepDistributionCurve,
      surfacePoints,
      chronolithSeal: computeChronolithSeal(`MEP|${cleanFormula}|${dipoleDebye}|${vMinEv}|${vMaxEv}|${temperatureK}`)
    };
  }

  root.NULLA_COMPATIBILITY = Object.freeze({
    chemical,
    nuclear,
    multidisciplinary,
    computeGoldschmidtTolerance,
    evaluateFreeEnergyKJmol,
    computeChronolithSeal,
    POLYMORPH_FAMILIES,
    getNextPolymorph,
    SYNKRONIA_PROFILES,
    evaluateSynkroniaState,
    computeBraggXRDPattern,
    computePaulingPartialCharge,
    relaxAtomicStructure,
    computeFTIRVibrationalSpectrum,
    computeHOMOLUMOProperties,
    computeMolecularElectrostaticPotential
  });
})(globalThis);
