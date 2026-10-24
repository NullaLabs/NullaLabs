(function exposeNuclearData(root) {
  'use strict';

  const isotopes = {
    p: { id:'p', symbol:'¹H', name:'Proton', Z:1, A:1, massU:1.00782503223 },
    D: { id:'D', symbol:'²H', name:'Deuterium', Z:1, A:2, massU:2.01410177812 },
    T: { id:'T', symbol:'³H', name:'Tritium', Z:1, A:3, massU:3.0160492779 },
    n: { id:'n', symbol:'n', name:'Neutron', Z:0, A:1, massU:1.00866491595 },
    He3: { id:'He3', symbol:'³He', name:'Helium-3', Z:2, A:3, massU:3.0160293201 },
    He4: { id:'He4', symbol:'⁴He', name:'Helium-4', Z:2, A:4, massU:4.00260325413 },
    B11: { id:'B11', symbol:'¹¹B', name:'Boron-11', Z:5, A:11, massU:11.00930536 },
    C12: { id:'C12', symbol:'¹²C', name:'Carbon-12', Z:6, A:12, massU:12 },
    Ne20: { id:'Ne20', symbol:'²⁰Ne', name:'Neon-20', Z:10, A:20, massU:19.9924401762 },
    Na23: { id:'Na23', symbol:'²³Na', name:'Sodium-23', Z:11, A:23, massU:22.9897692820 },
    Mg24: { id:'Mg24', symbol:'²⁴Mg', name:'Magnesium-24', Z:12, A:24 },
    U235: { id:'U235', symbol:'²³⁵U', name:'Uranium-235', Z:92, A:235 },
    U238: { id:'U238', symbol:'²³⁸U', name:'Uranium-238', Z:92, A:238 },
    Pu239: { id:'Pu239', symbol:'²³⁹Pu', name:'Plutonium-239', Z:94, A:239 },
    Cf252: { id:'Cf252', symbol:'²⁵²Cf', name:'Californium-252', Z:98, A:252 },
    Kr92: { id:'Kr92', symbol:'⁹²Kr', name:'Krypton-92', Z:36, A:92 },
    Ba141: { id:'Ba141', symbol:'¹⁴¹Ba', name:'Barium-141', Z:56, A:141 },
    Xe140: { id:'Xe140', symbol:'¹⁴⁰Xe', name:'Xenon-140', Z:54, A:140 },
    Xe134: { id:'Xe134', symbol:'¹³⁴Xe', name:'Xenon-134', Z:54, A:134 },
    Zr103: { id:'Zr103', symbol:'¹⁰³Zr', name:'Zirconium-103', Z:40, A:103 },
    Sr94: { id:'Sr94', symbol:'⁹⁴Sr', name:'Strontium-94', Z:38, A:94 },
    Zr100: { id:'Zr100', symbol:'¹⁰⁰Zr', name:'Zirconium-100', Z:40, A:100 },
    Cs140: { id:'Cs140', symbol:'¹⁴⁰Cs', name:'Caesium-140', Z:55, A:140 },
    Ru110: { id:'Ru110', symbol:'¹¹⁰Ru', name:'Ruthenium-110', Z:44, A:110 }
  };

  const fusion = {
    'H+H': [
      { id:'dt', reactants:['D','T'], products:[['He4',1],['n',1]], qMeV:17.589, label:'Deuterium–Tritium fusion', branch:'dominant laboratory route' },
      { id:'ddn', reactants:['D','D'], products:[['He3',1],['n',1]], qMeV:3.269, label:'Deuterium–Deuterium fusion', branch:'neutron branch ≈50%' },
      { id:'ddp', reactants:['D','D'], products:[['T',1],['p',1]], qMeV:4.033, label:'Deuterium–Deuterium fusion', branch:'proton branch ≈50%' }
    ],
    'B+H': [
      { id:'pb11', reactants:['p','B11'], products:[['He4',3]], qMeV:8.68, label:'Proton–Boron-11 fusion', branch:'aneutronic idealized final products' }
    ],
    'He+He': [
      { id:'he3he3', reactants:['He3','He3'], products:[['He4',1],['p',2]], qMeV:12.86, label:'Helium-3 fusion', branch:'solar-chain branch' }
    ],
    'C+C': [
      { id:'c12c12a', reactants:['C12','C12'], products:[['Ne20',1],['He4',1]], qMeV:4.617, label:'Carbon burning', branch:'alpha branch' },
      { id:'c12c12p', reactants:['C12','C12'], products:[['Na23',1],['p',1]], qMeV:2.241, label:'Carbon burning', branch:'proton branch' }
    ]
  };

  const fission = {
    U: { id:'u235-thermal', reactants:['U235','n'], products:[['Kr92',1],['Ba141',1],['n',3]], qMeV:200, label:'Thermal-neutron fission of Uranium-235', note:'Representative yield channel; real fission has a product distribution.' },
    Pu: { id:'pu239-thermal', reactants:['Pu239','n'], products:[['Xe134',1],['Zr103',1],['n',3]], qMeV:207, label:'Thermal-neutron fission of Plutonium-239', note:'Representative mass-balanced channel, not a unique deterministic split.' },
    Cf: { id:'cf252-spontaneous', reactants:['Cf252'], products:[['Ru110',1],['Xe140',1],['n',2]], qMeV:200, label:'Spontaneous fission of Californium-252', note:'Illustrative mass-balanced channel; measured yields are distributed.' }
  };

  function totals(entries) {
    return entries.reduce((sum, [id, count = 1]) => {
      const isotope = isotopes[id];
      return { A:sum.A + isotope.A * count, Z:sum.Z + isotope.Z * count };
    }, { A:0, Z:0 });
  }

  function validateReaction(reaction) {
    const left = totals(reaction.reactants.map(id => [id, 1]));
    const right = totals(reaction.products);
    const leftMass = reaction.reactants.reduce((sum,id) => sum + (isotopes[id]?.massU ?? NaN),0);
    const rightMass = reaction.products.reduce((sum,[id,count=1]) => sum + (isotopes[id]?.massU ?? NaN) * count,0);
    const qCalculatedMeV = Number.isFinite(leftMass) && Number.isFinite(rightMass)
      ? (leftMass - rightMass) * 931.49410242 : null;
    const qDeltaMeV = Number.isFinite(qCalculatedMeV) ? Math.abs(qCalculatedMeV - reaction.qMeV) : null;
    const conservationValid = left.A === right.A && left.Z === right.Z;
    const qStatus = qDeltaMeV == null ? 'UNVERIFIED' : qDeltaMeV <= 0.03 ? 'VERIFIED' : 'INCONSISTENT';
    const qValid = qStatus === 'VERIFIED';
    const fullyValidated = conservationValid && qValid;
    return {
      valid:conservationValid && qStatus !== 'INCONSISTENT',
      conservationValid,
      qValid,
      qStatus,
      fullyValidated,
      left,
      right,
      qCalculatedMeV,
      qDeltaMeV
    };
  }

  function balancedProductLayout(reaction, spread = 1) {
    const products = reaction.products.flatMap(([id,count=1]) => Array.from({length:count},() => isotopes[id]));
    const count = products.length;
    const directions = products.map((_,index) => {
      if (count === 1) return {x:0,y:0,z:0};
      if (count === 2) return {x:index === 0 ? -1 : 1,y:0,z:0};
      if (count === 3) {
        const angle = index * Math.PI * 2 / 3;
        return {x:Math.cos(angle),y:Math.sin(angle),z:0};
      }
      const y = 1 - (index / Math.max(1,count - 1)) * 2;
      const ring = Math.sqrt(Math.max(0,1-y*y));
      const theta = Math.PI * (3-Math.sqrt(5)) * index;
      return {x:Math.cos(theta)*ring,y,z:Math.sin(theta)*ring};
    });
    const totalA = products.reduce((sum,isotope) => sum + isotope.A,0);
    const center = directions.reduce((sum,direction,index) => ({
      x:sum.x + direction.x * products[index].A,
      y:sum.y + direction.y * products[index].A,
      z:sum.z + direction.z * products[index].A
    }),{x:0,y:0,z:0});
    center.x /= Math.max(1,totalA);
    center.y /= Math.max(1,totalA);
    center.z /= Math.max(1,totalA);
    return products.map((isotope,index) => ({
      id:isotope.id,
      A:isotope.A,
      Z:isotope.Z,
      x:(directions[index].x-center.x)*spread,
      y:(directions[index].y-center.y)*spread,
      z:(directions[index].z-center.z)*spread
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // SEGRÈ CHART & VALLEY OF STABILITY DATASET (AME2020 / NNDC STANDARDS)
  // ═══════════════════════════════════════════════════════════════
  const MAGIC_NUMBERS = Object.freeze({
    Z: [2, 8, 20, 28, 50, 82],
    N: [2, 8, 20, 28, 50, 82, 126]
  });

  function calculateSEMF(A, Z) {
    if (!Number.isFinite(A) || !Number.isFinite(Z) || A <= 0 || Z < 0 || Z > A) {
      return { bindingEnergyMeV: 0, perNucleonMeV: 0 };
    }
    if (A === 1) return { bindingEnergyMeV: 0, perNucleonMeV: 0 };
    const N = A - Z;
    const a_v = 15.75; // Volumen (MeV)
    const a_s = 17.8;  // Superficie (MeV)
    const a_c = 0.711; // Coulomb (MeV)
    const a_a = 23.7;  // Asimetría (MeV)
    let delta = 0;     // Apareamiento (MeV)
    if (Z % 2 === 0 && N % 2 === 0) delta = 34.0 / Math.pow(A, 0.75);
    else if (Z % 2 !== 0 && N % 2 !== 0) delta = -34.0 / Math.pow(A, 0.75);

    const vol = a_v * A;
    const surf = a_s * Math.pow(A, 2 / 3);
    const coul = a_c * (Z * (Z - 1)) / Math.pow(A, 1 / 3);
    const asym = a_a * Math.pow(A - 2 * Z, 2) / A;
    const be = Math.max(0, vol - surf - coul - asym + delta);
    return {
      bindingEnergyMeV: parseFloat(be.toFixed(2)),
      perNucleonMeV: parseFloat((be / A).toFixed(3))
    };
  }

  const SEGRE_NUCLIDES = Object.freeze([
    // Z = 0
    { id:'n', symbol:'n', element:'n', Z:0, N:1, A:1, halfLife:'10.2 min', decayMode:'beta_minus', expBE:0, desc:'Neutrón libre; decae por desintegración beta negativa a protón.' },
    // Z = 1
    { id:'H1', symbol:'¹H', element:'H', Z:1, N:0, A:1, halfLife:'Estable', decayMode:'stable', expBE:0, desc:'Protón solitario; núcleo del hidrógeno ordinario.' },
    { id:'H2', symbol:'²H', element:'H', Z:1, N:1, A:2, halfLife:'Estable', decayMode:'stable', expBE:1.11, desc:'Deuterio; combustible clave de reactores de fusión.' },
    { id:'H3', symbol:'³H', element:'H', Z:1, N:2, A:3, halfLife:'12.32 a', decayMode:'beta_minus', expBE:2.83, desc:'Tritio; emisor beta de baja energía, componente de la reacción D-T.' },
    // Z = 2 (He)
    { id:'He3', symbol:'³He', element:'He', Z:2, N:1, A:3, halfLife:'Estable', decayMode:'stable', expBE:2.57, desc:'Helio-3; isótopo raro, producto de decaimiento del tritio.' },
    { id:'He4', symbol:'⁴He', element:'He', Z:2, N:2, A:4, halfLife:'Estable', decayMode:'stable', expBE:7.07, desc:'Partícula alfa; núcleo doblemente mágico (Z=2, N=2) ultra-estable.' },
    { id:'He6', symbol:'⁶He', element:'He', Z:2, N:4, A:6, halfLife:'806.7 ms', decayMode:'beta_minus', expBE:4.88, desc:'Núcleo halo con dos neutrones periféricos.' },
    // Z = 3 (Li)
    { id:'Li6', symbol:'⁶Li', element:'Li', Z:3, N:3, A:6, halfLife:'Estable', decayMode:'stable', expBE:5.33, desc:'Litio-6; usado como manto reproductor de tritio en fusión.' },
    { id:'Li7', symbol:'⁷Li', element:'Li', Z:3, N:4, A:7, halfLife:'Estable', decayMode:'stable', expBE:5.61, desc:'Litio-7; el isótopo más abundante del litio natural (92.5%).' },
    // Z = 4 (Be)
    { id:'Be9', symbol:'⁹Be', element:'Be', Z:4, N:5, A:9, halfLife:'Estable', decayMode:'stable', expBE:6.46, desc:'Berilio-9; multiplicador de neutrones (n, 2n).' },
    // Z = 5 (B)
    { id:'B10', symbol:'¹⁰B', element:'B', Z:5, N:5, A:10, halfLife:'Estable', decayMode:'stable', expBE:6.48, desc:'Boro-10; capturador masivo de neutrones térmicos (3837 barns).' },
    { id:'B11', symbol:'¹¹B', element:'B', Z:5, N:6, A:11, halfLife:'Estable', decayMode:'stable', expBE:6.93, desc:'Boro-11; combustible para fusión aneutrónica p-¹¹B.' },
    // Z = 6 (C)
    { id:'C11', symbol:'¹¹C', element:'C', Z:6, N:5, A:11, halfLife:'20.36 min', decayMode:'beta_plus', expBE:6.68, desc:'Emisor de positrones empleado en radiotrazadores PET.' },
    { id:'C12', symbol:'¹²C', element:'C', Z:6, N:6, A:12, halfLife:'Estable', decayMode:'stable', expBE:7.68, desc:'Patrón de la unidad de masa atómica unificada (u).' },
    { id:'C13', symbol:'¹³C', element:'C', Z:6, N:7, A:13, halfLife:'Estable', decayMode:'stable', expBE:7.47, desc:'Núcleo con espín 1/2 activo para RMN de carbono.' },
    { id:'C14', symbol:'¹⁴C', element:'C', Z:6, N:8, A:14, halfLife:'5730 a', decayMode:'beta_minus', expBE:7.52, desc:'Datación radiocarbónica; decae por beta a nitrógeno-14.' },
    // Z = 7 (N)
    { id:'N13', symbol:'¹³N', element:'N', Z:7, N:6, A:13, halfLife:'9.97 min', decayMode:'beta_plus', expBE:7.24, desc:'Trazador de perfusión miocárdica PET.' },
    { id:'N14', symbol:'¹⁴N', element:'N', Z:7, N:7, A:14, halfLife:'Estable', decayMode:'stable', expBE:7.48, desc:'Nitrógeno primordial (99.6% abundancia).' },
    { id:'N15', symbol:'¹⁵N', element:'N', Z:7, N:8, A:15, halfLife:'Estable', decayMode:'stable', expBE:7.70, desc:'Mágico en neutrones (N=8); espín nuclear 1/2.' },
    // Z = 8 (O)
    { id:'O15', symbol:'¹⁵O', element:'O', Z:8, N:7, A:15, halfLife:'122 s', decayMode:'beta_plus', expBE:7.46, desc:'Emisor de positrones rápido en flujo sanguíneo cerebral.' },
    { id:'O16', symbol:'¹⁶O', element:'O', Z:8, N:8, A:16, halfLife:'Estable', decayMode:'stable', expBE:7.98, desc:'Doblemente mágico (Z=8, N=8); núcleo excepcionalmente rígido.' },
    { id:'O17', symbol:'¹⁷O', element:'O', Z:8, N:9, A:17, halfLife:'Estable', decayMode:'stable', expBE:7.75, desc:'Isótopo estable con espín nuclear no nulo (5/2).' },
    { id:'O18', symbol:'¹⁸O', element:'O', Z:8, N:10, A:18, halfLife:'Estable', decayMode:'stable', expBE:7.77, desc:'Usado en paleoclimatología y síntesis de ¹⁸F.' },
    // Z = 9 (F)
    { id:'F18', symbol:'¹⁸F', element:'F', Z:9, N:9, A:18, halfLife:'109.8 min', decayMode:'beta_plus', expBE:7.63, desc:'Radioisótopo médico estándar (FDG en tomografía PET).' },
    { id:'F19', symbol:'¹⁹F', element:'F', Z:9, N:10, A:19, halfLife:'Estable', decayMode:'stable', expBE:7.78, desc:'Único isótopo estable del flúor; 100% monoisotópico.' },
    // Z = 10 (Ne)
    { id:'Ne20', symbol:'²⁰Ne', element:'Ne', Z:10, N:10, A:20, halfLife:'Estable', decayMode:'stable', expBE:8.03, desc:'Producto común en la combustión estelar de carbono.' },
    { id:'Ne22', symbol:'²²Ne', element:'Ne', Z:10, N:12, A:22, halfLife:'Estable', decayMode:'stable', expBE:8.08, desc:'Fuente de neutrones en nucleosíntesis estelar (proceso s).' },
    // Z = 11 (Na)
    { id:'Na22', symbol:'²²Na', element:'Na', Z:11, N:11, A:22, halfLife:'2.60 a', decayMode:'beta_plus', expBE:7.91, desc:'Fuente de calibración de laboratorio para positrones.' },
    { id:'Na23', symbol:'²³Na', element:'Na', Z:11, N:12, A:23, halfLife:'Estable', decayMode:'stable', expBE:8.11, desc:'Sodio natural monoisotópico.' },
    // Z = 12 (Mg)
    { id:'Mg24', symbol:'²⁴Mg', element:'Mg', Z:12, N:12, A:24, halfLife:'Estable', decayMode:'stable', expBE:8.26, desc:'Isótopo alfa par-par muy estable (79% abundancia).' },
    // Z = 13 (Al)
    { id:'Al27', symbol:'²⁷Al', element:'Al', Z:13, N:14, A:27, halfLife:'Estable', decayMode:'stable', expBE:8.33, desc:'Aluminio natural estable.' },
    // Z = 14 (Si)
    { id:'Si28', symbol:'²⁸Si', element:'Si', Z:14, N:14, A:28, halfLife:'Estable', decayMode:'stable', expBE:8.45, desc:'Base de semiconductores; núcleo alfa par-par.' },
    // Z = 15 (P)
    { id:'P31', symbol:'³¹P', element:'P', Z:15, N:16, A:31, halfLife:'Estable', decayMode:'stable', expBE:8.48, desc:'Fósforo natural biológico estable.' },
    { id:'P32', symbol:'³²P', element:'P', Z:15, N:17, A:32, halfLife:'14.26 d', decayMode:'beta_minus', expBE:8.42, desc:'Trazador beta histórico en biología molecular (DNA/RNA).' },
    // Z = 16 (S)
    { id:'S32', symbol:'³²S', element:'S', Z:16, N:16, A:32, halfLife:'Estable', decayMode:'stable', expBE:8.49, desc:'Azufre primordial dominante (95%).' },
    // Z = 17 (Cl)
    { id:'Cl35', symbol:'³⁵Cl', element:'Cl', Z:17, N:18, A:35, halfLife:'Estable', decayMode:'stable', expBE:8.52, desc:'Isótopo de cloro mayoritario (76%).' },
    { id:'Cl37', symbol:'³⁷Cl', element:'Cl', Z:17, N:20, A:37, halfLife:'Estable', decayMode:'stable', expBE:8.57, desc:'Mágico en neutrones (N=20); estable (24%).' },
    // Z = 18 (Ar)
    { id:'Ar40', symbol:'⁴⁰Ar', element:'Ar', Z:18, N:22, A:40, halfLife:'Estable', decayMode:'stable', expBE:8.60, desc:'Argón atmosférico originado por decaimiento del ⁴⁰K.' },
    // Z = 19 (K)
    { id:'K39', symbol:'³⁹K', element:'K', Z:19, N:20, A:39, halfLife:'Estable', decayMode:'stable', expBE:8.56, desc:'Mágico en neutrones (N=20); potasio natural (93%).' },
    { id:'K40', symbol:'⁴⁰K', element:'K', Z:19, N:21, A:40, halfLife:'1.25 × 10⁹ a', decayMode:'beta_minus', expBE:8.54, desc:'Radionucleido primordial en el cuerpo humano y rocas.' },
    // Z = 20 (Ca)
    { id:'Ca40', symbol:'⁴⁰Ca', element:'Ca', Z:20, N:20, A:40, halfLife:'Estable', decayMode:'stable', expBE:8.55, desc:'Doblemente mágico (Z=20, N=20); calcio más abundante.' },
    { id:'Ca48', symbol:'⁴⁸Ca', element:'Ca', Z:20, N:28, A:48, halfLife:'6 × 10¹⁹ a', decayMode:'stable', expBE:8.67, desc:'Doblemente mágico (Z=20, N=28); proyectil para síntesis de superpesados.' },
    // Z = 26 (Fe) - THE IRON PEAK
    { id:'Fe56', symbol:'⁵⁶Fe', element:'Fe', Z:26, N:30, A:56, halfLife:'Estable', decayMode:'stable', expBE:8.79, desc:'Cúspide de la curva de Aston; punto de máxima estabilidad nuclear por nucleón.' },
    // Z = 27 (Co)
    { id:'Co60', symbol:'⁶⁰Co', element:'Co', Z:27, N:33, A:60, halfLife:'5.27 a', decayMode:'beta_minus', expBE:8.75, desc:'Fuente gamma industrial de alta energía para esterilización y radioterapia.' },
    // Z = 28 (Ni)
    { id:'Ni58', symbol:'⁵⁸Ni', element:'Ni', Z:28, N:30, A:58, halfLife:'Estable', decayMode:'stable', expBE:8.73, desc:'Níquel primordial más abundante (68%).' },
    { id:'Ni62', symbol:'⁶²Ni', element:'Ni', Z:28, N:34, A:62, halfLife:'Estable', decayMode:'stable', expBE:8.795, desc:'El núcleo con mayor energía de enlace por nucleón de todo el Universo (8.7946 MeV).' },
    // Z = 29 (Cu)
    { id:'Cu63', symbol:'⁶³Cu', element:'Cu', Z:29, N:34, A:63, halfLife:'Estable', decayMode:'stable', expBE:8.75, desc:'Cobre natural abundante (69%).' },
    // Z = 30 (Zn)
    { id:'Zn64', symbol:'⁶⁴Zn', element:'Zn', Z:30, N:34, A:64, halfLife:'Estable', decayMode:'stable', expBE:8.74, desc:'Cinc par-par muy estable (49%).' },
    // Z = 36 (Kr)
    { id:'Kr92', symbol:'⁹²Kr', element:'Kr', Z:36, N:56, A:92, halfLife:'1.84 s', decayMode:'beta_minus', expBE:8.51, desc:'Fragmento de fisión típico rico en neutrones del ²³⁵U.' },
    // Z = 38 (Sr)
    { id:'Sr88', symbol:'⁸⁸Sr', element:'Sr', Z:38, N:50, A:88, halfLife:'Estable', decayMode:'stable', expBE:8.73, desc:'Mágico en neutrones (N=50); estroncio más estable (82.6%).' },
    { id:'Sr90', symbol:'⁹⁰Sr', element:'Sr', Z:38, N:52, A:90, halfLife:'28.79 a', decayMode:'beta_minus', expBE:8.68, desc:'Emisor beta puro de fisión nuclear; bioacumulable en huesos.' },
    // Z = 40 (Zr)
    { id:'Zr90', symbol:'⁹⁰Zr', element:'Zr', Z:40, N:50, A:90, halfLife:'Estable', decayMode:'stable', expBE:8.71, desc:'Mágico en neutrones (N=50); base de aleaciones de zircaloy nuclear.' },
    // Z = 44 (Ru)
    { id:'Ru110', symbol:'¹¹⁰Ru', element:'Ru', Z:44, N:66, A:110, halfLife:'11.6 s', decayMode:'beta_minus', expBE:8.52, desc:'Fragmento de fisión espontánea de transuránicos.' },
    // Z = 47 (Ag)
    { id:'Ag107', symbol:'¹⁰⁷Ag', element:'Ag', Z:47, N:60, A:107, halfLife:'Estable', decayMode:'stable', expBE:8.55, desc:'Plata natural estable.' },
    // Z = 50 (Sn)
    { id:'Sn118', symbol:'¹¹⁸Sn', element:'Sn', Z:50, N:68, A:118, halfLife:'Estable', decayMode:'stable', expBE:8.52, desc:'Mágico en protones (Z=50); el elemento con más isótopos estables (10).' },
    // Z = 53 (I)
    { id:'I127', symbol:'¹²⁷I', element:'I', Z:53, N:74, A:127, halfLife:'Estable', decayMode:'stable', expBE:8.45, desc:'Único isótopo estable del yodo (100%).' },
    { id:'I131', symbol:'¹³¹I', element:'I', Z:53, N:78, A:131, halfLife:'8.02 d', decayMode:'beta_minus', expBE:8.41, desc:'Terapia de cáncer de tiroides y marcador nuclear.' },
    // Z = 54 (Xe)
    { id:'Xe134', symbol:'¹³⁴Xe', element:'Xe', Z:54, N:80, A:134, halfLife:'Estable', decayMode:'stable', expBE:8.41, desc:'Gas noble producto de fisión.' },
    { id:'Xe140', symbol:'¹⁴⁰Xe', element:'Xe', Z:54, N:86, A:140, halfLife:'13.6 s', decayMode:'beta_minus', expBE:8.30, desc:'Emisor beta de vida corta en fisiones.' },
    // Z = 55 (Cs)
    { id:'Cs133', symbol:'¹³³Cs', element:'Cs', Z:55, N:78, A:133, halfLife:'Estable', decayMode:'stable', expBE:8.41, desc:'Base del segundo atómico estándar en el Sistema Internacional.' },
    { id:'Cs137', symbol:'¹³⁷Cs', element:'Cs', Z:55, N:82, A:137, halfLife:'30.17 a', decayMode:'beta_minus', expBE:8.39, desc:'Mágico en neutrones (N=82); principal emisor de calor en residuos nucleares.' },
    // Z = 56 (Ba)
    { id:'Ba138', symbol:'¹³⁸Ba', element:'Ba', Z:56, N:82, A:138, halfLife:'Estable', decayMode:'stable', expBE:8.39, desc:'Mágico en neutrones (N=82); bario dominante (71.7%).' },
    { id:'Ba141', symbol:'¹⁴¹Ba', element:'Ba', Z:56, N:85, A:141, halfLife:'18.27 min', decayMode:'beta_minus', expBE:8.31, desc:'Fragmento primario de fisión del ²³⁵U.' },
    // Z = 79 (Au)
    { id:'Au197', symbol:'¹⁹⁷Au', element:'Au', Z:79, N:118, A:197, halfLife:'Estable', decayMode:'stable', expBE:7.92, desc:'Oro monoisotópico; diana histórica de Rutherford.' },
    // Z = 82 (Pb)
    { id:'Pb206', symbol:'²⁰⁶Pb', element:'Pb', Z:82, N:124, A:206, halfLife:'Estable', decayMode:'stable', expBE:7.88, desc:'Fin de la cadena de desintegración del Uranio-238.' },
    { id:'Pb208', symbol:'²⁰⁸Pb', element:'Pb', Z:82, N:126, A:208, halfLife:'Estable', decayMode:'stable', expBE:7.87, desc:'DOBLEMENTE MÁGICO (Z=82, N=126); el núcleo pesado más estable del Universo.' },
    { id:'Pb210', symbol:'²¹⁰Pb', element:'Pb', Z:82, N:128, A:210, halfLife:'22.2 a', decayMode:'beta_minus', expBE:7.84, desc:'Paso intermedio en la cadena del uranio.' },
    { id:'Pb214', symbol:'²¹⁴Pb', element:'Pb', Z:82, N:132, A:214, halfLife:'26.8 min', decayMode:'beta_minus', expBE:7.78, desc:'Descendiente directo del radón-222.' },
    // Z = 83 (Bi)
    { id:'Bi209', symbol:'²⁰⁹Bi', element:'Bi', Z:83, N:126, A:209, halfLife:'2 × 10¹⁹ a', decayMode:'alpha', expBE:7.85, desc:'Mágico en neutrones (N=126); considerado estable hasta 2003.' },
    { id:'Bi210', symbol:'²¹⁰Bi', element:'Bi', Z:83, N:127, A:210, halfLife:'5.01 d', decayMode:'beta_minus', expBE:7.82, desc:'Intermedio de la cadena del uranio.' },
    { id:'Bi214', symbol:'²¹⁴Bi', element:'Bi', Z:83, N:131, A:214, halfLife:'19.9 min', decayMode:'beta_minus', expBE:7.77, desc:'Fuerte emisor de rayos gamma en la cadena 4n+2.' },
    // Z = 84 (Po)
    { id:'Po210', symbol:'²¹⁰Po', element:'Po', Z:84, N:126, A:210, halfLife:'138.38 d', decayMode:'alpha', expBE:7.83, desc:'Emisor alfa de calor intenso descubierto por Marie Curie.' },
    { id:'Po214', symbol:'²¹⁴Po', element:'Po', Z:84, N:130, A:214, halfLife:'164.3 µs', decayMode:'alpha', expBE:7.77, desc:'Decaimiento alfa ultrarrápido a plomo-210.' },
    { id:'Po218', symbol:'²¹⁸Po', element:'Po', Z:84, N:134, A:218, halfLife:'3.10 min', decayMode:'alpha', expBE:7.71, desc:'Primer hijo del radón en el aire.' },
    // Z = 86 (Rn)
    { id:'Rn222', symbol:'²²²Rn', element:'Rn', Z:86, N:136, A:222, halfLife:'3.82 d', decayMode:'alpha', expBE:7.69, desc:'Gas noble radiactivo natural; causa principal de radiación ambiental terrestre.' },
    // Z = 88 (Ra)
    { id:'Ra226', symbol:'²²⁶Ra', element:'Ra', Z:88, N:138, A:226, halfLife:'1600 a', decayMode:'alpha', expBE:7.66, desc:'Radio histórico purificado por los Curie; define el Curie (Ci).' },
    // Z = 90 (Th)
    { id:'Th230', symbol:'²³⁰Th', element:'Th', Z:90, N:140, A:230, halfLife:'75380 a', decayMode:'alpha', expBE:7.63, desc:'Ionio; eslabón de larga vida media en la cadena del uranio.' },
    { id:'Th232', symbol:'²³²Th', element:'Th', Z:90, N:142, A:232, halfLife:'14.05 × 10⁹ a', decayMode:'alpha', expBE:7.61, desc:'Combustible fértil del ciclo nuclear del Torio.' },
    { id:'Th234', symbol:'²³⁴Th', element:'Th', Z:90, N:144, A:234, halfLife:'24.1 d', decayMode:'beta_minus', expBE:7.60, desc:'Hijo directo del uranio-238 tras emitir una partícula alfa.' },
    // Z = 91 (Pa)
    { id:'Pa234', symbol:'²³⁴Pa', element:'Pa', Z:91, N:143, A:234, halfLife:'6.70 h', decayMode:'beta_minus', expBE:7.60, desc:'Primer caso histórico de isomería nuclear (Hahn, 1921).' },
    // Z = 92 (U)
    { id:'U234', symbol:'²³⁴U', element:'U', Z:92, N:142, A:234, halfLife:'245500 a', decayMode:'alpha', expBE:7.60, desc:'Isótopo minoritario del uranio natural en equilibrio secular.' },
    { id:'U235', symbol:'²³⁵U', element:'U', Z:92, N:143, A:235, halfLife:'703.8 × 10⁶ a', decayMode:'alpha', expBE:7.59, desc:'Principal isótopo nuclear fisible térmico en reactores nucleares.' },
    { id:'U238', symbol:'²³⁸U', element:'U', Z:92, N:146, A:238, halfLife:'4.468 × 10⁹ a', decayMode:'alpha', expBE:7.57, desc:'Uranio dominante (99.3%); cabeza de la cadena radiactiva 4n+2.' },
    // Z = 94 (Pu)
    { id:'Pu239', symbol:'²³⁹Pu', element:'Pu', Z:94, N:145, A:239, halfLife:'24110 a', decayMode:'alpha', expBE:7.56, desc:'Isótopo fisible artificial creado por captura neutrónica en ²³⁸U.' },
    // Z = 95 (Am)
    { id:'Am241', symbol:'²⁴¹Am', element:'Am', Z:95, N:146, A:241, halfLife:'432.2 a', decayMode:'alpha', expBE:7.54, desc:'Emisor alfa y gamma en detectores de humo domésticos.' },
    // Z = 98 (Cf)
    { id:'Cf252', symbol:'²⁵²Cf', element:'Cf', Z:98, N:154, A:252, halfLife:'2.645 a', decayMode:'fission', expBE:7.46, desc:'Potente emisor de neutrones por fisión espontánea (3.1% de los decaimientos).' }
  ]);

  const URANIUM_DECAY_CHAIN = Object.freeze([
    { step:1, from:'U238', to:'Th234', mode:'alpha', dZ:-2, dN:-2, particle:'⁴He (4.2 MeV)' },
    { step:2, from:'Th234', to:'Pa234', mode:'beta_minus', dZ:+1, dN:-1, particle:'e⁻ + ν̄_e' },
    { step:3, from:'Pa234', to:'U234', mode:'beta_minus', dZ:+1, dN:-1, particle:'e⁻ + ν̄_e' },
    { step:4, from:'U234', to:'Th230', mode:'alpha', dZ:-2, dN:-2, particle:'⁴He (4.8 MeV)' },
    { step:5, from:'Th230', to:'Ra226', mode:'alpha', dZ:-2, dN:-2, particle:'⁴He (4.7 MeV)' },
    { step:6, from:'Ra226', to:'Rn222', mode:'alpha', dZ:-2, dN:-2, particle:'⁴He (Gas Radón)' },
    { step:7, from:'Rn222', to:'Po218', mode:'alpha', dZ:-2, dN:-2, particle:'⁴He (5.5 MeV)' },
    { step:8, from:'Po218', to:'Pb214', mode:'alpha', dZ:-2, dN:-2, particle:'⁴He (6.0 MeV)' },
    { step:9, from:'Pb214', to:'Bi214', mode:'beta_minus', dZ:+1, dN:-1, particle:'e⁻ + ν̄_e' },
    { step:10, from:'Bi214', to:'Po214', mode:'beta_minus', dZ:+1, dN:-1, particle:'e⁻ + ν̄_e' },
    { step:11, from:'Po214', to:'Pb210', mode:'alpha', dZ:-2, dN:-2, particle:'⁴He (7.7 MeV)' },
    { step:12, from:'Pb210', to:'Bi210', mode:'beta_minus', dZ:+1, dN:-1, particle:'e⁻ + ν̄_e' },
    { step:13, from:'Bi210', to:'Po210', mode:'beta_minus', dZ:+1, dN:-1, particle:'e⁻ + ν̄_e' },
    { step:14, from:'Po210', to:'Pb206', mode:'alpha', dZ:-2, dN:-2, particle:'⁴He (5.3 MeV) → Estable' }
  ]);

  function getNuclide(Z, N) {
    return SEGRE_NUCLIDES.find(nuc => nuc.Z === Z && nuc.N === N) || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // AME2020 / CODATA NUCLEAR DECAY & MASS DEFECT SUITE
  // ═══════════════════════════════════════════════════════════════
  const U_TO_MEV = 931.49410242; // CODATA 2018/2022 unified atomic mass constant (MeV/c²)

  function calculateMassDefectAndQ(reactantIds, productEntries) {
    if (!Array.isArray(reactantIds) || !Array.isArray(productEntries)) {
      return { valid: false, error: 'INVALID_INPUT_ARRAYS' };
    }
    let leftMassU = 0;
    let rightMassU = 0;
    let leftA = 0;
    let leftZ = 0;
    let rightA = 0;
    let rightZ = 0;

    for (const rId of reactantIds) {
      const iso = isotopes[rId];
      if (!iso) return { valid: false, error: `UNKNOWN_REACTANT_${rId}` };
      leftA += iso.A;
      leftZ += iso.Z;
      if (Number.isFinite(iso.massU)) leftMassU += iso.massU;
      else leftMassU = NaN;
    }

    for (const entry of productEntries) {
      const pId = Array.isArray(entry) ? entry[0] : entry.id;
      const count = Array.isArray(entry) ? (entry[1] || 1) : (entry.count || 1);
      const iso = isotopes[pId];
      if (!iso) return { valid: false, error: `UNKNOWN_PRODUCT_${pId}` };
      rightA += iso.A * count;
      rightZ += iso.Z * count;
      if (Number.isFinite(iso.massU)) rightMassU += iso.massU * count;
      else rightMassU = NaN;
    }

    const conservationValid = (leftA === rightA) && (leftZ === rightZ);
    const massDefectU = (Number.isFinite(leftMassU) && Number.isFinite(rightMassU)) ? (leftMassU - rightMassU) : null;
    const qMeV = massDefectU !== null ? massDefectU * U_TO_MEV : null;

    return {
      valid: conservationValid,
      conservationValid,
      leftA,
      leftZ,
      rightA,
      rightZ,
      leftMassU: Number.isFinite(leftMassU) ? parseFloat(leftMassU.toFixed(8)) : null,
      rightMassU: Number.isFinite(rightMassU) ? parseFloat(rightMassU.toFixed(8)) : null,
      massDefectU: massDefectU !== null ? parseFloat(massDefectU.toFixed(8)) : null,
      qMeV: qMeV !== null ? parseFloat(qMeV.toFixed(4)) : null,
      isExoenergetic: qMeV !== null ? qMeV > 0 : null
    };
  }

  function getStabilityLineN(Z) {
    if (!Number.isFinite(Z) || Z < 0) return 0;
    if (Z === 0) return 1;
    if (Z <= 20) return Z; // N = Z for light stable nuclei up to ⁴⁰Ca
    // Calibrated beta-stability valley curve above Calcium (reaches ²⁰⁸Pb N=126 and ²³⁸U N=146)
    return parseFloat((20 + (Z - 20) * 1.75).toFixed(2));
  }

  function predictDecayMode(Z, N) {
    if (!Number.isFinite(Z) || !Number.isFinite(N) || Z < 0 || N < 0) return 'unknown';
    if (Z === 0 && N === 1) return 'beta_minus';
    if (Z === 1 && N === 0) return 'stable';
    const known = getNuclide(Z, N);
    if (known && known.decayMode) return known.decayMode;

    const A = Z + N;
    if (A > 208 || Z > 82) return 'alpha'; // Heavy nuclei decay primarily via alpha emission or fission
    const nStable = getStabilityLineN(Z);
    const deltaN = N - nStable;
    if (deltaN > 1.4) return 'beta_minus'; // Excess neutrons: n → p + e⁻ + ν̄_e
    if (deltaN < -1.4) return 'beta_plus';  // Deficit neutrons (excess protons): p → n + e⁺ + ν_e
    return 'stable';
  }

  function calculateRadioactiveDecayRemaining(N0, halfLifeSeconds, elapsedTimeSeconds) {
    if (![N0, halfLifeSeconds, elapsedTimeSeconds].every(Number.isFinite) || N0 < 0 || halfLifeSeconds <= 0 || elapsedTimeSeconds < 0) {
      return { remaining: 0, decayed: 0, fractionRemaining: 0, elapsedHalfLives: 0 };
    }
    const lambda = Math.LN2 / halfLifeSeconds;
    const remaining = N0 * Math.exp(-lambda * elapsedTimeSeconds);
    const decayed = N0 - remaining;
    const fractionRemaining = remaining / Math.max(1e-12, N0);
    const elapsedHalfLives = elapsedTimeSeconds / halfLifeSeconds;
    return {
      remaining: parseFloat(remaining.toFixed(6)),
      decayed: parseFloat(decayed.toFixed(6)),
      fractionRemaining: parseFloat(fractionRemaining.toFixed(6)),
      elapsedHalfLives: parseFloat(elapsedHalfLives.toFixed(3))
    };
  }

  function simulateDecayStep(nuclideId) {
    const chainStep = URANIUM_DECAY_CHAIN.find(s => s.from === nuclideId);
    if (chainStep) {
      return {
        found: true,
        parent: chainStep.from,
        daughter: chainStep.to,
        mode: chainStep.mode,
        deltaZ: chainStep.dZ,
        deltaN: chainStep.dN,
        particle: chainStep.particle
      };
    }
    const nuc = SEGRE_NUCLIDES.find(n => n.id === nuclideId || n.symbol === nuclideId);
    if (!nuc) return { found: false, error: 'NUCLIDE_NOT_FOUND' };
    if (nuc.decayMode === 'stable') {
      return { found: true, parent: nuc.id, daughter: nuc.id, mode: 'stable', deltaZ: 0, deltaN: 0, particle: 'Estable' };
    }
    let dZ = 0;
    let dN = 0;
    let particle = '';
    if (nuc.decayMode === 'alpha') {
      dZ = -2; dN = -2; particle = '⁴He (α)';
    } else if (nuc.decayMode === 'beta_minus') {
      dZ = +1; dN = -1; particle = 'e⁻ + ν̄_e (β⁻)';
    } else if (nuc.decayMode === 'beta_plus') {
      dZ = -1; dN = +1; particle = 'e⁺ + ν_e (β⁺)';
    } else if (nuc.decayMode === 'fission') {
      return { found: true, parent: nuc.id, daughter: 'Fission Fragments', mode: 'fission', deltaZ: 0, deltaN: 0, particle: 'Neutrones rápidos + Fragmentos' };
    }
    const daughter = getNuclide(nuc.Z + dZ, nuc.N + dN);
    return {
      found: true,
      parent: nuc.id,
      daughter: daughter ? daughter.id : `Z${nuc.Z + dZ}_N${nuc.N + dN}`,
      mode: nuc.decayMode,
      deltaZ: dZ,
      deltaN: dN,
      particle
    };
  }

  root.NULLA_NUCLEAR = Object.freeze({
    isotopes,
    fusion,
    fission,
    totals,
    validateReaction,
    balancedProductLayout,
    MAGIC_NUMBERS,
    SEGRE_NUCLIDES,
    URANIUM_DECAY_CHAIN,
    calculateSEMF,
    getNuclide,
    U_TO_MEV,
    calculateMassDefectAndQ,
    getStabilityLineN,
    predictDecayMode,
    calculateRadioactiveDecayRemaining,
    simulateDecayStep
  });
})(globalThis);
