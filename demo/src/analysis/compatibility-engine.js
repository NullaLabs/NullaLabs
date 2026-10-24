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

  root.NULLA_COMPATIBILITY = Object.freeze({
    chemical,
    nuclear,
    multidisciplinary,
    computeGoldschmidtTolerance,
    evaluateFreeEnergyKJmol,
    computeChronolithSeal
  });
})(globalThis);
