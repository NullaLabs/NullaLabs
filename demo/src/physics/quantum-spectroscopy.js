(function initQuantumSpectroscopy(root) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // FUNDAMENTAL PHYSICAL CONSTANTS (CODATA 2018 / 2022)
  // ═══════════════════════════════════════════════════════════════
  const RYDBERG_CONSTANT = 10973731.568508; // m⁻¹ (R_infinity)
  const SPEED_OF_LIGHT = 299792458;          // m/s (c)
  const PLANCK_CONSTANT = 6.62607015e-34;   // J·s (h)
  const EV_TO_JOULES = 1.602176634e-19;     // J/eV

  /**
   * Calculates Rydberg transition parameters for hydrogen-like species.
   * 1/λ = R_∞ · Z² · (1/n₁² - 1/n₂²)
   */
  function calculateRydbergTransition(n1, n2, Z = 1) {
    if (!Number.isInteger(n1) || !Number.isInteger(n2) || n1 < 1 || n2 <= n1 || !Number.isInteger(Z) || Z < 1) {
      return { valid: false, error: 'INVALID_QUANTUM_NUMBERS' };
    }
    const invLambda = RYDBERG_CONSTANT * (Z * Z) * ((1 / (n1 * n1)) - (1 / (n2 * n2)));
    const wavelengthM = 1 / invLambda;
    const wavelengthNm = wavelengthM * 1e9;
    const frequencyHz = SPEED_OF_LIGHT / wavelengthM;
    const energyJoules = PLANCK_CONSTANT * frequencyHz;
    const energyEv = energyJoules / EV_TO_JOULES;

    let seriesName = 'Higher Series';
    let spectralRegion = 'Far Infrared';
    if (n1 === 1) {
      seriesName = 'Lyman Series';
      spectralRegion = 'Ultraviolet (UV)';
    } else if (n1 === 2) {
      seriesName = 'Balmer Series';
      spectralRegion = 'Visible (VIS)';
    } else if (n1 === 3) {
      seriesName = 'Paschen Series';
      spectralRegion = 'Near Infrared (NIR)';
    } else if (n1 === 4) {
      seriesName = 'Brackett Series';
      spectralRegion = 'Infrared (IR)';
    } else if (n1 === 5) {
      seriesName = 'Pfund Series';
      spectralRegion = 'Mid Infrared (MIR)';
    }

    const rgb = wavelengthToRGB(wavelengthNm);

    return {
      valid: true,
      n1,
      n2,
      Z,
      wavelengthM: parseFloat(wavelengthM.toExponential(6)),
      wavelengthNm: parseFloat(wavelengthNm.toFixed(3)),
      frequencyHz: parseFloat(frequencyHz.toExponential(6)),
      energyJoules: parseFloat(energyJoules.toExponential(6)),
      energyEv: parseFloat(energyEv.toFixed(4)),
      seriesName,
      spectralRegion,
      color: rgb
    };
  }

  /**
   * Physics-accurate physical wavelength-to-RGB conversion (CIE 1931 observer approximation).
   * Spans visible range 380 nm to 780 nm with physiological sensitivity roll-off and γ=0.8.
   */
  function wavelengthToRGB(wavelengthNm) {
    const w = Number(wavelengthNm);
    if (!Number.isFinite(w) || w < 380 || w > 780) {
      return { r: 0, g: 0, b: 0, hex: '#000000', css: 'rgb(0,0,0)', visible: false };
    }

    let r = 0;
    let g = 0;
    let b = 0;

    if (w >= 380 && w < 440) {
      r = -(w - 440) / (440 - 380);
      g = 0.0;
      b = 1.0;
    } else if (w >= 440 && w < 490) {
      r = 0.0;
      g = (w - 440) / (490 - 440);
      b = 1.0;
    } else if (w >= 490 && w < 510) {
      r = 0.0;
      g = 1.0;
      b = -(w - 510) / (510 - 490);
    } else if (w >= 510 && w < 580) {
      r = (w - 510) / (580 - 510);
      g = 1.0;
      b = 0.0;
    } else if (w >= 580 && w < 645) {
      r = 1.0;
      g = -(w - 645) / (645 - 580);
      b = 0.0;
    } else if (w >= 645 && w <= 780) {
      r = 1.0;
      g = 0.0;
      b = 0.0;
    }

    // Physiological intensity attenuation near the limits of human photoreceptors
    let factor = 0.0;
    if (w >= 380 && w < 420) {
      factor = 0.3 + 0.7 * (w - 380) / (420 - 380);
    } else if (w >= 420 && w < 700) {
      factor = 1.0;
    } else if (w >= 700 && w <= 780) {
      factor = 0.3 + 0.7 * (780 - w) / (780 - 700);
    }

    const gamma = 0.8;
    const finalR = Math.round(255 * Math.pow(Math.max(0, r * factor), gamma));
    const finalG = Math.round(255 * Math.pow(Math.max(0, g * factor), gamma));
    const finalB = Math.round(255 * Math.pow(Math.max(0, b * factor), gamma));
    const hex = '#' + [finalR, finalG, finalB].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();

    return {
      r: finalR,
      g: finalG,
      b: finalB,
      hex,
      css: `rgb(${finalR},${finalG},${finalB})`,
      visible: true
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // NIST ATOMIC SPECTRA DATABASE REFERENCE EMISSION LINES
  // ═══════════════════════════════════════════════════════════════
  const ELEMENT_EMISSION_SPECTRA = Object.freeze({
    H: {
      symbol: 'H',
      name: 'Hydrogen',
      lines: [
        { wavelengthNm: 656.28, transition: '3 → 2 (H-α)', relativeIntensity: 100 },
        { wavelengthNm: 486.13, transition: '4 → 2 (H-β)', relativeIntensity: 45 },
        { wavelengthNm: 434.05, transition: '5 → 2 (H-γ)', relativeIntensity: 20 },
        { wavelengthNm: 410.17, transition: '6 → 2 (H-δ)', relativeIntensity: 10 }
      ]
    },
    He: {
      symbol: 'He',
      name: 'Helium',
      lines: [
        { wavelengthNm: 447.15, transition: '4d ³D → 2p ³P', relativeIntensity: 40 },
        { wavelengthNm: 471.31, transition: '4s ³S → 2p ³P', relativeIntensity: 25 },
        { wavelengthNm: 492.19, transition: '4d ¹D → 2p ¹P', relativeIntensity: 30 },
        { wavelengthNm: 501.57, transition: '3p ¹P → 2s ¹S', relativeIntensity: 50 },
        { wavelengthNm: 587.56, transition: '3d ³D → 2p ³P', relativeIntensity: 100 },
        { wavelengthNm: 667.82, transition: '3d ¹D → 2p ¹P', relativeIntensity: 65 },
        { wavelengthNm: 706.52, transition: '3s ³S → 2p ³P', relativeIntensity: 35 }
      ]
    },
    Na: {
      symbol: 'Na',
      name: 'Sodium',
      lines: [
        { wavelengthNm: 588.995, transition: '3p ²P_{3/2} → 3s ²S_{1/2} (D₂)', relativeIntensity: 100 },
        { wavelengthNm: 589.592, transition: '3p ²P_{1/2} → 3s ²S_{1/2} (D₁)', relativeIntensity: 50 }
      ]
    },
    Hg: {
      symbol: 'Hg',
      name: 'Mercury',
      lines: [
        { wavelengthNm: 404.66, transition: '7s ³S₁ → 6p ³P₀', relativeIntensity: 45 },
        { wavelengthNm: 435.83, transition: '7s ³S₁ → 6p ³P₁', relativeIntensity: 85 },
        { wavelengthNm: 546.07, transition: '7s ³S₁ → 6p ³P₂', relativeIntensity: 100 },
        { wavelengthNm: 576.96, transition: '6d ³D₂ → 6p ¹P₁', relativeIntensity: 35 },
        { wavelengthNm: 579.07, transition: '6d ¹D₂ → 6p ¹P₁', relativeIntensity: 35 }
      ]
    },
    Ne: {
      symbol: 'Ne',
      name: 'Neon',
      lines: [
        { wavelengthNm: 585.25, transition: '3p → 3s', relativeIntensity: 60 },
        { wavelengthNm: 588.19, transition: '3p → 3s', relativeIntensity: 50 },
        { wavelengthNm: 603.00, transition: '3p → 3s', relativeIntensity: 40 },
        { wavelengthNm: 614.31, transition: '3p → 3s', relativeIntensity: 85 },
        { wavelengthNm: 640.22, transition: '3p → 3s', relativeIntensity: 100 },
        { wavelengthNm: 650.65, transition: '3p → 3s', relativeIntensity: 70 },
        { wavelengthNm: 703.24, transition: '3p → 3s', relativeIntensity: 55 }
      ]
    }
  });

  /**
   * Renders high-precision atomic emission or continuous spectrum on a 2D HTML Canvas.
   */
  function drawEmissionSpectrum(ctx, width, height, lines = [], options = {}) {
    if (!ctx || width <= 0 || height <= 0) return;
    const minW = options.minW || 380;
    const maxW = options.maxW || 750;
    const isAbsorption = options.absorption === true;

    // Draw baseline
    if (isAbsorption) {
      // Continuous spectrum background
      for (let x = 0; x < width; x++) {
        const w = minW + (x / width) * (maxW - minW);
        const rgb = wavelengthToRGB(w);
        ctx.fillStyle = rgb.css;
        ctx.fillRect(x, 0, 1, height);
      }
    } else {
      // Dark optical slit chamber
      ctx.fillStyle = '#06080c';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw spectral lines
    for (const line of lines) {
      const w = line.wavelengthNm;
      if (w < minW || w > maxW) continue;
      const x = ((w - minW) / (maxW - minW)) * width;
      const rgb = wavelengthToRGB(w);
      const intensity = (line.relativeIntensity || 100) / 100;

      if (isAbsorption) {
        // Dark absorption Fraunhofer line
        ctx.fillStyle = 'rgba(0,0,0,0.92)';
        ctx.fillRect(x - 1, 0, 2, height);
      } else {
        // Glowing emission slit line
        const gradient = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.9 * intensity})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - 3, 0, 6, height);

        // Core sharp center line
        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.fillRect(x - 0.5, 0, 1, height);
      }
    }
  }

  root.NULLA_QUANTUM_SPECTROSCOPY = Object.freeze({
    RYDBERG_CONSTANT,
    SPEED_OF_LIGHT,
    PLANCK_CONSTANT,
    EV_TO_JOULES,
    calculateRydbergTransition,
    wavelengthToRGB,
    ELEMENT_EMISSION_SPECTRA,
    drawEmissionSpectrum
  });
})(globalThis);
