(function initThermodynamics(root) {
  'use strict';
  function phaseAtTemperature(profile, temperatureK) {
    if (!profile || !Number.isFinite(Number(temperatureK)) || Number(temperatureK) < 0) return 'unknown';
    const tm = Number(profile.melt);
    const tb = Number(profile.boil);
    if (profile.transition === 'sublimation') {
      return Number.isFinite(tb) && temperatureK >= tb ? 'gas' : 'solid';
    }
    if (!Number.isFinite(tm) || !Number.isFinite(tb) || tm < 0 || tb <= tm) return 'unknown';
    if (temperatureK < tm) return 'solid';
    if (temperatureK < tb) return 'liquid';
    return 'gas';
  }

  function hasUsablePhaseProfile(profile) {
    if (!profile) return false;
    const tm = Number(profile.melt);
    const tb = Number(profile.boil);
    if (profile.transition === 'sublimation') return Number.isFinite(tb) && tb > 0;
    return Number.isFinite(tm) && Number.isFinite(tb) && tm >= 0 && tb > tm;
  }

  function phaseStatus(profile, temperatureK) {
    if (!hasUsablePhaseProfile(profile) || !Number.isFinite(Number(temperatureK)) || temperatureK < 0) {
      return {key:'unknown',progress:null,nextTransitionK:null,atTransition:false,transition:'unknown'};
    }
    const key = phaseAtTemperature(profile,temperatureK);
    const tm = Number(profile.melt);
    const tb = Number(profile.boil);
    if (profile.transition === 'sublimation') {
      const atTransition = Math.abs(temperatureK - tb) < 0.5;
      return {
        key,
        progress:Math.max(0,Math.min(1,temperatureK / tb)),
        nextTransitionK:key === 'solid' ? tb : null,
        atTransition,
        transition:key === 'solid' ? 'sublimation' : 'gas',
        boundaryTransition:atTransition ? 'sublimation' : null,
        boundaryK:atTransition ? tb : null
      };
    }
    const atMelting = Math.abs(temperatureK - tm) < 0.5;
    const atBoiling = Math.abs(temperatureK - tb) < 0.5;
    const boundaryTransition = atMelting ? 'melting' : atBoiling ? 'boiling' : null;
    const progress = key === 'solid'
      ? temperatureK / Math.max(1,tm)
      : key === 'liquid'
        ? (temperatureK - tm) / Math.max(1,tb - tm)
        : 1;
    return {
      key,
      progress:Math.max(0,Math.min(1,progress)),
      nextTransitionK:key === 'solid' ? tm : key === 'liquid' ? tb : null,
      atTransition:atMelting || atBoiling,
      transition:key === 'solid' ? 'melting' : key === 'liquid' ? 'boiling' : 'gas',
      boundaryTransition,
      boundaryK:boundaryTransition === 'melting' ? tm : boundaryTransition === 'boiling' ? tb : null
    };
  }

  function lennardJonesForceMagnitude(distance, epsilon = 0.003, sigma = 3) {
    if (![distance,epsilon,sigma].every(Number.isFinite) || distance <= 0.01 || epsilon <= 0 || sigma <= 0 || distance > sigma * 2.5) return 0;
    const sr6 = Math.pow(sigma / distance, 6);
    return (24 * epsilon / distance) * (2 * sr6 * sr6 - sr6);
  }

  function reducedLennardJonesPotential(distance, epsilon = 0.003, sigma = 3) {
    if (![distance,epsilon,sigma].every(Number.isFinite) || distance <= 0 || epsilon <= 0 || sigma <= 0) return null;
    const sr6 = Math.pow(sigma / distance, 6);
    return 4 * epsilon * (sr6 * sr6 - sr6);
  }

  // ═══════════════════════════════════════════════════════════════
  // CHEMICAL THERMODYNAMICS & EYRING / ARRHENIUS KINETICS
  // ═══════════════════════════════════════════════════════════════
  const GAS_CONSTANT_R = 8.314462618;     // J/(mol·K)
  const BOLTZMANN_K = 1.380649e-23;       // J/K
  const PLANCK_H = 6.62607015e-34;         // J·s

  function calculateGibbsFreeEnergy(deltaH_kJ_mol, deltaS_J_mol_K, temperatureK) {
    if (![deltaH_kJ_mol, deltaS_J_mol_K, temperatureK].every(Number.isFinite) || temperatureK <= 0) {
      return { valid: false, error: 'INVALID_THERMODYNAMIC_INPUTS' };
    }
    const deltaG = deltaH_kJ_mol - temperatureK * (deltaS_J_mol_K / 1000.0);
    let regime = 'DYNAMIC_EQUILIBRIUM';
    let isSpontaneous = false;
    if (deltaG < -0.1) {
      regime = 'EXERGONIC_SPONTANEOUS';
      isSpontaneous = true;
    } else if (deltaG > 0.1) {
      regime = 'ENDERGONIC_NON_SPONTANEOUS';
      isSpontaneous = false;
    }
    const tEquilibriumK = Math.abs(deltaS_J_mol_K) > 1e-6 ? (deltaH_kJ_mol * 1000.0) / deltaS_J_mol_K : null;

    return {
      valid: true,
      deltaH_kJ_mol: parseFloat(deltaH_kJ_mol.toFixed(3)),
      deltaS_J_mol_K: parseFloat(deltaS_J_mol_K.toFixed(3)),
      temperatureK: parseFloat(temperatureK.toFixed(2)),
      deltaG_kJ_mol: parseFloat(deltaG.toFixed(3)),
      regime,
      isSpontaneous,
      tEquilibriumK: (tEquilibriumK !== null && tEquilibriumK > 0) ? parseFloat(tEquilibriumK.toFixed(2)) : null
    };
  }

  function calculateEquilibriumConstant(deltaG_kJ_mol, temperatureK) {
    if (![deltaG_kJ_mol, temperatureK].every(Number.isFinite) || temperatureK <= 0) {
      return { valid: false, error: 'INVALID_INPUTS' };
    }
    const exponent = -(deltaG_kJ_mol * 1000.0) / (GAS_CONSTANT_R * temperatureK);
    // Guard against arithmetic overflow/underflow
    const clampedExp = Math.max(-100, Math.min(100, exponent));
    const keq = Math.exp(clampedExp);

    return {
      valid: true,
      deltaG_kJ_mol,
      temperatureK,
      keq: parseFloat(keq.toExponential(4)),
      lnKeq: parseFloat(exponent.toFixed(4)),
      favorProducts: keq > 1.0
    };
  }

  function calculateArrheniusRate(preExponentialA, activationEnergy_kJ_mol, temperatureK) {
    if (![preExponentialA, activationEnergy_kJ_mol, temperatureK].every(Number.isFinite) || preExponentialA <= 0 || activationEnergy_kJ_mol < 0 || temperatureK <= 0) {
      return { valid: false, error: 'INVALID_INPUTS' };
    }
    const exponent = -(activationEnergy_kJ_mol * 1000.0) / (GAS_CONSTANT_R * temperatureK);
    const rateConstantK = preExponentialA * Math.exp(Math.max(-100, Math.min(100, exponent)));

    return {
      valid: true,
      preExponentialA,
      activationEnergy_kJ_mol,
      temperatureK,
      rateConstantK: parseFloat(rateConstantK.toExponential(4))
    };
  }

  function calculateEyringRate(deltaH_act_kJ_mol, deltaS_act_J_mol_K, temperatureK) {
    if (![deltaH_act_kJ_mol, deltaS_act_J_mol_K, temperatureK].every(Number.isFinite) || temperatureK <= 0) {
      return { valid: false, error: 'INVALID_INPUTS' };
    }
    const preFactor = (BOLTZMANN_K * temperatureK) / PLANCK_H;
    const entropyTerm = Math.exp(deltaS_act_J_mol_K / GAS_CONSTANT_R);
    const enthalpyTerm = Math.exp(-(deltaH_act_kJ_mol * 1000.0) / (GAS_CONSTANT_R * temperatureK));
    const rateK = preFactor * entropyTerm * enthalpyTerm;

    return {
      valid: true,
      temperatureK,
      deltaH_act_kJ_mol,
      deltaS_act_J_mol_K,
      rateConstantK: parseFloat(rateK.toExponential(4))
    };
  }

  function generateReactionCoordinateCurve(reactantsH, activationBarrierH, productsH, steps = 100) {
    const points = [];
    const r = Number.isFinite(reactantsH) ? reactantsH : 0;
    const ts = Number.isFinite(activationBarrierH) ? activationBarrierH : r + 50;
    const p = Number.isFinite(productsH) ? productsH : r - 30;

    for (let i = 0; i <= steps; i++) {
      const xi = i / steps; // Reaction progress [0, 1]
      // Smooth bell curve with peak at xi=0.5 representing transition state
      const baseInterpolation = (1 - xi) * r + xi * p;
      const barrier = (ts - Math.max(r, p)) * Math.exp(-Math.pow((xi - 0.5) / 0.18, 2));
      const energy = baseInterpolation + barrier;
      points.push({
        progress: parseFloat(xi.toFixed(3)),
        energy: parseFloat(energy.toFixed(3))
      });
    }

    return {
      reactantsH: r,
      transitionStateH: ts,
      productsH: p,
      activationEnergyForward: ts - r,
      activationEnergyReverse: ts - p,
      deltaHReaction: p - r,
      curve: points
    };
  }

  root.NULLA_THERMODYNAMICS = Object.freeze({
    phaseAtTemperature,
    hasUsablePhaseProfile,
    phaseStatus,
    lennardJonesForceMagnitude,
    reducedLennardJonesPotential,
    GAS_CONSTANT_R,
    BOLTZMANN_K,
    PLANCK_H,
    calculateGibbsFreeEnergy,
    calculateEquilibriumConstant,
    calculateArrheniusRate,
    calculateEyringRate,
    generateReactionCoordinateCurve
  });
})(globalThis);
