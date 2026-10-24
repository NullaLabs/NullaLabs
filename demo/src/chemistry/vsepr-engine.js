(function initVSEPREngine(root) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // VALENCE SHELL ELECTRON PAIR REPULSION (VSEPR) CATALOGUE
  // ═══════════════════════════════════════════════════════════════
  const VSEPR_CLASSES = Object.freeze({
    AX2: {
      code: 'AX2',
      stericNumber: 2,
      bondingDomains: 2,
      lonePairs: 0,
      hybridization: 'sp',
      electronGeometry: 'Linear',
      molecularGeometry: 'Linear',
      idealAngleDegrees: 180,
      example: 'CO₂, BeCl₂'
    },
    AX3: {
      code: 'AX3',
      stericNumber: 3,
      bondingDomains: 3,
      lonePairs: 0,
      hybridization: 'sp²',
      electronGeometry: 'Trigonal Planar',
      molecularGeometry: 'Trigonal Planar',
      idealAngleDegrees: 120,
      example: 'BF₃, SO₃'
    },
    AX2E1: {
      code: 'AX2E1',
      stericNumber: 3,
      bondingDomains: 2,
      lonePairs: 1,
      hybridization: 'sp²',
      electronGeometry: 'Trigonal Planar',
      molecularGeometry: 'Bent / Angular',
      idealAngleDegrees: 118,
      example: 'SO₂, NO₂⁻'
    },
    AX4: {
      code: 'AX4',
      stericNumber: 4,
      bondingDomains: 4,
      lonePairs: 0,
      hybridization: 'sp³',
      electronGeometry: 'Tetrahedral',
      molecularGeometry: 'Tetrahedral',
      idealAngleDegrees: 109.47,
      example: 'CH₄, SiF₄'
    },
    AX3E1: {
      code: 'AX3E1',
      stericNumber: 4,
      bondingDomains: 3,
      lonePairs: 1,
      hybridization: 'sp³',
      electronGeometry: 'Tetrahedral',
      molecularGeometry: 'Trigonal Pyramidal',
      idealAngleDegrees: 107.3,
      example: 'NH₃, PCl₃'
    },
    AX2E2: {
      code: 'AX2E2',
      stericNumber: 4,
      bondingDomains: 2,
      lonePairs: 2,
      hybridization: 'sp³',
      electronGeometry: 'Tetrahedral',
      molecularGeometry: 'Bent / Angular',
      idealAngleDegrees: 104.5,
      example: 'H₂O, H₂S'
    },
    AX5: {
      code: 'AX5',
      stericNumber: 5,
      bondingDomains: 5,
      lonePairs: 0,
      hybridization: 'sp³d',
      electronGeometry: 'Trigonal Bipyramidal',
      molecularGeometry: 'Trigonal Bipyramidal',
      idealAngleDegrees: 90, // Also 120 (eq) and 180 (ax)
      example: 'PCl₅, AsF₅'
    },
    AX4E1: {
      code: 'AX4E1',
      stericNumber: 5,
      bondingDomains: 4,
      lonePairs: 1,
      hybridization: 'sp³d',
      electronGeometry: 'Trigonal Bipyramidal',
      molecularGeometry: 'Seesaw',
      idealAngleDegrees: 117, // equatorial: 117°, axial-eq: 87°
      example: 'SF₄, TeCl₄'
    },
    AX3E2: {
      code: 'AX3E2',
      stericNumber: 5,
      bondingDomains: 3,
      lonePairs: 2,
      hybridization: 'sp³d',
      electronGeometry: 'Trigonal Bipyramidal',
      molecularGeometry: 'T-Shaped',
      idealAngleDegrees: 87.5,
      example: 'ClF₃, BrF₃'
    },
    AX2E3: {
      code: 'AX2E3',
      stericNumber: 5,
      bondingDomains: 2,
      lonePairs: 3,
      hybridization: 'sp³d',
      electronGeometry: 'Trigonal Bipyramidal',
      molecularGeometry: 'Linear',
      idealAngleDegrees: 180,
      example: 'XeF₂, I₃⁻'
    },
    AX6: {
      code: 'AX6',
      stericNumber: 6,
      bondingDomains: 6,
      lonePairs: 0,
      hybridization: 'sp³d²',
      electronGeometry: 'Octahedral',
      molecularGeometry: 'Octahedral',
      idealAngleDegrees: 90,
      example: 'SF₆, SeF₆'
    },
    AX5E1: {
      code: 'AX5E1',
      stericNumber: 6,
      bondingDomains: 5,
      lonePairs: 1,
      hybridization: 'sp³d²',
      electronGeometry: 'Octahedral',
      molecularGeometry: 'Square Pyramidal',
      idealAngleDegrees: 85,
      example: 'BrF₅, IF₅'
    },
    AX4E2: {
      code: 'AX4E2',
      stericNumber: 6,
      bondingDomains: 4,
      lonePairs: 2,
      hybridization: 'sp³d²',
      electronGeometry: 'Octahedral',
      molecularGeometry: 'Square Planar',
      idealAngleDegrees: 90,
      example: 'XeF₄, ICl₄⁻'
    }
  });

  function classifyStericGeometry(bondingDomains, lonePairs = 0) {
    if (!Number.isInteger(bondingDomains) || bondingDomains < 1 || !Number.isInteger(lonePairs) || lonePairs < 0) {
      return { valid: false, error: 'INVALID_ELECTRON_DOMAIN_COUNTS' };
    }
    const code = lonePairs > 0 ? `AX${bondingDomains}E${lonePairs}` : `AX${bondingDomains}`;
    const entry = VSEPR_CLASSES[code];
    if (!entry) {
      return { valid: false, error: `UNSUPPORTED_VSEPR_COMBINATION_${code}` };
    }
    return {
      valid: true,
      ...entry
    };
  }

  /**
   * Generates exact 3D Cartesian coordinates (in Angstroms) according to Gillespie-Nyholm VSEPR.
   * Central atom placed at (0, 0, 0). Returns central atom, ligand coordinates and lone pair vectors.
   */
  function generateVSEPR3DCoordinates(bondingDomains, lonePairs = 0, bondLengthA = 1.0) {
    const classification = classifyStericGeometry(bondingDomains, lonePairs);
    if (!classification.valid) return { valid: false, error: classification.error };

    const L = Math.max(0.1, Number(bondLengthA) || 1.0);
    const steric = classification.stericNumber;
    let candidatePositions = [];

    if (steric === 2) {
      // Linear: along Z
      candidatePositions = [
        { x: 0, y: 0, z: L, isLonePair: false },
        { x: 0, y: 0, z: -L, isLonePair: false }
      ];
    } else if (steric === 3) {
      // Trigonal planar on XY plane
      for (let i = 0; i < 3; i++) {
        const theta = (i * 2 * Math.PI) / 3 - Math.PI / 2;
        candidatePositions.push({
          x: parseFloat((L * Math.cos(theta)).toFixed(5)),
          y: parseFloat((L * Math.sin(theta)).toFixed(5)),
          z: 0,
          isLonePair: i === 0 && lonePairs > 0
        });
      }
    } else if (steric === 4) {
      // Tetrahedral
      const norm = L / Math.sqrt(3);
      const tet = [
        { x: norm, y: norm, z: norm },
        { x: norm, y: -norm, z: -norm },
        { x: -norm, y: norm, z: -norm },
        { x: -norm, y: -norm, z: norm }
      ];
      candidatePositions = tet.map((p, idx) => ({
        x: parseFloat(p.x.toFixed(5)),
        y: parseFloat(p.y.toFixed(5)),
        z: parseFloat(p.z.toFixed(5)),
        isLonePair: idx < lonePairs
      }));
    } else if (steric === 5) {
      // Trigonal Bipyramidal:
      // Equatorial sites (0, 1, 2) on XY plane; Lone pairs occupy equatorial sites first!
      const eqSites = [];
      for (let i = 0; i < 3; i++) {
        const theta = (i * 2 * Math.PI) / 3;
        eqSites.push({
          x: parseFloat((L * Math.cos(theta)).toFixed(5)),
          y: parseFloat((L * Math.sin(theta)).toFixed(5)),
          z: 0,
          isLonePair: i < lonePairs
        });
      }
      // Axial sites along Z
      const axSites = [
        { x: 0, y: 0, z: L, isLonePair: false },
        { x: 0, y: 0, z: -L, isLonePair: false }
      ];
      candidatePositions = [...eqSites, ...axSites];
    } else if (steric === 6) {
      // Octahedral: ±X, ±Y, ±Z
      // Trans lone pairs occupy opposite axial positions (±Z) first!
      candidatePositions = [
        { x: 0, y: 0, z: L, isLonePair: lonePairs >= 1 },
        { x: 0, y: 0, z: -L, isLonePair: lonePairs >= 2 },
        { x: L, y: 0, z: 0, isLonePair: false },
        { x: -L, y: 0, z: 0, isLonePair: false },
        { x: 0, y: L, z: 0, isLonePair: false },
        { x: 0, y: -L, z: 0, isLonePair: false }
      ];
    }

    const ligandAtoms = candidatePositions.filter(p => !p.isLonePair).map((p, index) => ({
      index,
      x: p.x,
      y: p.y,
      z: p.z
    }));

    const lonePairLobes = candidatePositions.filter(p => p.isLonePair).map((p, index) => {
      const mag = Math.hypot(p.x, p.y, p.z) || 1;
      return {
        index,
        dirX: parseFloat((p.x / mag).toFixed(5)),
        dirY: parseFloat((p.y / mag).toFixed(5)),
        dirZ: parseFloat((p.z / mag).toFixed(5)),
        tipX: parseFloat((p.x * 0.9).toFixed(5)),
        tipY: parseFloat((p.y * 0.9).toFixed(5)),
        tipZ: parseFloat((p.z * 0.9).toFixed(5))
      };
    });

    return {
      valid: true,
      classification,
      centralAtom: { x: 0, y: 0, z: 0 },
      ligandAtoms,
      lonePairLobes
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // CURATED VSEPR MOLECULAR DATABASE
  // ═══════════════════════════════════════════════════════════════
  const VSEPR_MOLECULAR_DATABASE = Object.freeze({
    CO2: { formula: 'CO₂', central: 'C', ligands: 'O', bp: 2, lp: 0, bondLengthA: 1.16, code: 'AX2' },
    BeCl2: { formula: 'BeCl₂', central: 'Be', ligands: 'Cl', bp: 2, lp: 0, bondLengthA: 1.77, code: 'AX2' },
    BF3: { formula: 'BF₃', central: 'B', ligands: 'F', bp: 3, lp: 0, bondLengthA: 1.31, code: 'AX3' },
    SO2: { formula: 'SO₂', central: 'S', ligands: 'O', bp: 2, lp: 1, bondLengthA: 1.43, code: 'AX2E1' },
    CH4: { formula: 'CH₄', central: 'C', ligands: 'H', bp: 4, lp: 0, bondLengthA: 1.09, code: 'AX4' },
    NH3: { formula: 'NH₃', central: 'N', ligands: 'H', bp: 3, lp: 1, bondLengthA: 1.01, code: 'AX3E1' },
    H2O: { formula: 'H₂O', central: 'O', ligands: 'H', bp: 2, lp: 2, bondLengthA: 0.96, code: 'AX2E2' },
    PCl5: { formula: 'PCl₅', central: 'P', ligands: 'Cl', bp: 5, lp: 0, bondLengthA: 2.04, code: 'AX5' },
    SF4: { formula: 'SF₄', central: 'S', ligands: 'F', bp: 4, lp: 1, bondLengthA: 1.64, code: 'AX4E1' },
    ClF3: { formula: 'ClF₃', central: 'Cl', ligands: 'F', bp: 3, lp: 2, bondLengthA: 1.60, code: 'AX3E2' },
    XeF2: { formula: 'XeF₂', central: 'Xe', ligands: 'F', bp: 2, lp: 3, bondLengthA: 1.98, code: 'AX2E3' },
    SF6: { formula: 'SF₆', central: 'S', ligands: 'F', bp: 6, lp: 0, bondLengthA: 1.56, code: 'AX6' },
    BrF5: { formula: 'BrF₅', central: 'Br', ligands: 'F', bp: 5, lp: 1, bondLengthA: 1.77, code: 'AX5E1' },
    XeF4: { formula: 'XeF₄', central: 'Xe', ligands: 'F', bp: 4, lp: 2, bondLengthA: 1.95, code: 'AX4E2' }
  });

  root.NULLA_VSEPR = Object.freeze({
    VSEPR_CLASSES,
    classifyStericGeometry,
    generateVSEPR3DCoordinates,
    VSEPR_MOLECULAR_DATABASE
  });
})(globalThis);
