/**
 * NULLA-LABS // LEGION COHORT VIII SOVEREIGN PROCEDURAL AUDIO SYNTHESIZER
 * Zero-dependency Web Audio API procedural tactile feedback engine.
 * Pure mathematical oscillator synthesis with ADSR micro-envelopes.
 * Compliant with LEGION_SKILL_SPEC_V1: SKILL-C08-003.
 */

(function(root) {
  'use strict';

  let audioCtx = null;
  let isMuted = false;

  try {
    isMuted = root.localStorage && root.localStorage.getItem('nulla_audio_muted') === 'true';
  } catch (e) {
    isMuted = false;
  }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = root.AudioContext || root.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function() {});
    }
    return audioCtx;
  }

  // Legion Cohort VIII Procedural Sound Specs
  const CUE_SPECS = {
    // Crisp tactile click on UI buttons and periodic cells (triangle wave)
    click: {
      oscType: 'triangle',
      freqStart: 1200,
      freqEnd: 400,
      attackMs: 2,
      decayMs: 20,
      gainPeak: 0.08
    },
    // Harmonious confirmation on chemical synthesis or quiz success (sine wave)
    confirm: {
      oscType: 'sine',
      freqStart: 880,
      freqEnd: 1320,
      attackMs: 4,
      decayMs: 75,
      gainPeak: 0.12
    },
    // Deep resonant acoustic pulse on nuclear fusion / fission (sine sub-bass)
    nuclear: {
      oscType: 'sine',
      freqStart: 220,
      freqEnd: 48,
      attackMs: 8,
      decayMs: 380,
      gainPeak: 0.22
    },
    // Crystalline harmonic pulse on material structure spawn (sine wave)
    material: {
      oscType: 'sine',
      freqStart: 660,
      freqEnd: 990,
      attackMs: 3,
      decayMs: 50,
      gainPeak: 0.09
    },
    // Dissonant feedback for uncatalogued reaction / collision error (sawtooth)
    error: {
      oscType: 'sawtooth',
      freqStart: 180,
      freqEnd: 85,
      attackMs: 3,
      decayMs: 130,
      gainPeak: 0.12
    }
  };

  function playCue(cueName) {
    if (isMuted) return false;
    const ctx = getAudioContext();
    if (!ctx) return false;

    const spec = CUE_SPECS[cueName] || CUE_SPECS.click;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = spec.oscType;
      osc.frequency.setValueAtTime(spec.freqStart, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(spec.freqEnd, 20), now + (spec.decayMs / 1000));

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(spec.gainPeak, now + (spec.attackMs / 1000));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (spec.decayMs / 1000));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + (spec.decayMs / 1000) + 0.05);
      return true;
    } catch (e) {
      return false;
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    try {
      if (root.localStorage) {
        root.localStorage.setItem('nulla_audio_muted', isMuted ? 'true' : 'false');
      }
    } catch (e) {}
    return isMuted;
  }

  function getMuted() {
    return isMuted;
  }

  function setMuted(state) {
    isMuted = Boolean(state);
    try {
      if (root.localStorage) {
        root.localStorage.setItem('nulla_audio_muted', isMuted ? 'true' : 'false');
      }
    } catch (e) {}
    return isMuted;
  }

  root.NULLA_AUDIO = {
    playCue: playCue,
    toggleMute: toggleMute,
    isMuted: getMuted,
    setMuted: setMuted,
    unlock: getAudioContext,
    CUE_SPECS: CUE_SPECS
  };
})(typeof window !== 'undefined' ? window : globalThis);
