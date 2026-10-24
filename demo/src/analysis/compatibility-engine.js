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
        return {
          canCombine: true,
          combinationMode: 'HIGH_ENTROPY_ALLOY',
          stabilityClass: 'STABLE',
          stabilityVerdict: `STABLE · ALEACIÓN DE ALTA ENTROPÍA (HEA ΔS_mix = ${ (8.314 * Math.log(zList.length)).toFixed(1) } J/mol·K · δr = ${mismatchPct.toFixed(1)}%)`,
          bondingRegime: 'MULTI-PRINCIPAL-ELEMENT METALLIC LATTICE (FCC/BCC)',
          ionicityPct,
          deltaEN,
          humeRotheryMismatchPct: Number(mismatchPct.toFixed(2)),
          enthalpy: -12.0,
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
        freeEnergyKJmol: evaluateFreeEnergyKJmol(estimatedEnthalpy, -35.0, temperatureK),
        scribaGate: 'GO_DEGRADED',
        chronolithSeal: computeChronolithSeal(`PAULING|${zList.join('-')}|${temperatureK}`),
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
    evaluateSynkroniaState
  });
})(globalThis);
