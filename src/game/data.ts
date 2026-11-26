import {
  AchievementDef,
  BattlePassTierDef,
  BossDef,
  BossId,
  BossPhaseDef,
  CharacterBoosterDef,
  CharacterDef,
  CompanionDroneDef,
  CosmeticItem,
  DistrictDef,
  DistrictId,
  EnemyClass,
  FreeRunConfig,
  GemExchangePack,
  LeaderboardEntry,
  LiveEventDef,
  MissionDef,
  ProfileAvatarDef,
  SkillNode,
  SpecialShopItem,
  StoryChapterDef,
  TutorialTopicDef,
  VehicleDef,
  VehicleId,
} from './types';

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'kai',
    name: 'KAI',
    title: 'Corredor Fantasma',
    origin: 'Neon Downtown',
    bio: 'Criado en los viaductos elevados de Neon Downtown, Kai domina el desplazamiento espectral y las fintas instantáneas sobre raíles.',
    abilityCategory: 'phase_blink',
    abilityName: 'Desfase Espectral',
    abilityDesc: 'Intangibilidad de fase por 4.2s: atraviesa barreras y proyectiles lanzando cortes al cambiar de carril.',
    abilityCooldown: 18,
    abilityDuration: 4.2,
    bossInteractionDesc: 'Atraviesa láseres y proyectiles del jefe sin recibir daño y lanza un corte de fase al jefe cercano.',
    mpInterferenceDesc: 'Emite un pulso disruptor que nubla brevemente la señal del carril en rivales cercanos (2.2s).',
    passiveName: 'Paso Espectral',
    passiveDesc: 'Cambios de carril un 28% más rápidos y radar pasivo de carriles de jefe.',
    secondaryAbilityName: 'Impulso de Pared',
    secondaryAbilityDesc: 'Cada Wall-Run recarga un 18% su Habilidad Activa.',
    vehicleAbilityName: 'Aceleración Espectral',
    vehicleAbilityDesc: 'Al activar vehículo entra en fase invulnerable 3s y destruye obstáculos frontales sin gastar energía extra.',
    vehicleAbilityKind: 'phase_rush',
    activeAllowedInParkour: false,
    parkourRestrictionReason: 'Intangibilidad espectral deshabilitada en Parkour Extremo para preservar saltos puros.',
    unlockCostCoins: 0,
    unlockCostGems: 0,
    stats: { speed: 8, agility: 9, jump: 8, tech: 6 },
    colors: {
      skin: '#d99b78',
      jacket: '#f97316',
      accent: '#22d3ee',
      pants: '#1e293b',
      hair: '#18181b',
      visor: '#06b6d4',
      sneakers: '#fb923c',
    },
    hairStyle: 'spiky',
    silhouetteGear: 'blade_pack',
    voicePitch: 1.0,
    quote: 'La gravedad es solo una sugerencia en Neon City.',
    modelFileKey: 'cesium_man',
  },
  {
    id: 'nova',
    name: 'NOVA',
    title: 'Hacker Urbana',
    origin: 'Cyber Underground',
    bio: 'Ex-arquitecta de redes del metro subterráneo. Hackea drones enemigos y convierte trampas en energía de vehículo.',
    abilityCategory: 'drone_hijack',
    abilityName: 'Secuestro de Red',
    abilityDesc: 'Sobrecarga drones y torretas en 38m convirtiéndolos en créditos y +18% energía de vehículo.',
    abilityCooldown: 20,
    abilityDuration: 4.5,
    bossInteractionDesc: 'Desactiva temporalmente los drones de apoyo del jefe y drena su escudo de ataque.',
    mpInterferenceDesc: 'Invierte brevemente la barra de brújula/combo rival durante 2.4s (con enfriamiento protector).',
    passiveName: 'Sifón de Datos',
    passiveDesc: 'Recoger baterías otorga +25% energía adicional y mejora precisión del radar.',
    secondaryAbilityName: 'Sobrecarga EMP',
    secondaryAbilityDesc: 'Las celdas EMP contra jefes otorgan +22 monedas y energía de habilidad.',
    vehicleAbilityName: 'Pulso Hacker Vehicular',
    vehicleAbilityDesc: 'Al activar vehículo neutraliza drones cercanos y convierte trampas próximas en energía de batería.',
    vehicleAbilityKind: 'overcharge_emp',
    activeAllowedInParkour: true,
    unlockCostCoins: 0,
    unlockCostGems: 0,
    stats: { speed: 7, agility: 8, jump: 7, tech: 10 },
    colors: {
      skin: '#e8beac',
      jacket: '#6366f1',
      accent: '#ec4899',
      pants: '#0f172a',
      hair: '#c084fc',
      visor: '#f472b6',
      sneakers: '#38bdf8',
    },
    hairStyle: 'hood',
    silhouetteGear: 'drone_rig',
    voicePitch: 1.24,
    quote: 'Cada semáforo y cada láser ya tiene mi firma.',
    modelFileKey: 'astronaut_a',
  },
  {
    id: 'blaze',
    name: 'BLAZE',
    title: 'Rey del Derrape',
    origin: 'Industrial Core',
    bio: 'Piloto clandestino de turbinas térmicas. Libera cañones de plasma al frente para abrir brechas entre tráfico pesado.',
    abilityCategory: 'energy_blast',
    abilityName: 'Cañón Térmico',
    abilityDesc: 'Dispara una ráfaga frontal de plasma que incinera hasta 6 obstáculos en tu carril y eleva el combo.',
    abilityCooldown: 20,
    abilityDuration: 3.6,
    bossInteractionDesc: 'Impacta proyectiles del jefe en pleno vuelo y daña drones de apoyo.',
    mpInterferenceDesc: 'Deja un muro térmico pasajero (2s) en el carril trasero que ralentiza levemente al perseguidor.',
    passiveName: 'Suelas Térmicas',
    passiveDesc: 'Deslizamientos un 25% más rápidos y menor pérdida de velocidad al impactar obstáculos destructibles.',
    secondaryAbilityName: 'Impacto Nitro',
    secondaryAbilityDesc: 'Destruir robots terrestres otorga +40 puntos extra.',
    vehicleAbilityName: 'Ariete Ígneo',
    vehicleAbilityDesc: 'Al activar vehículo lanza una llamarada frontal de 35m que incinera barreras y dispara la velocidad inicial.',
    vehicleAbilityKind: 'flame_ram',
    activeAllowedInParkour: true,
    unlockCostCoins: 6800,
    unlockCostGems: 95,
    unlockRequirement: {
      type: 'missions',
      target: 3,
      label: 'Completa 3 misiones',
    },
    stats: { speed: 10, agility: 7, jump: 7, tech: 7 },
    colors: {
      skin: '#8d5524',
      jacket: '#ef4444',
      accent: '#facc15',
      pants: '#1c1917',
      hair: '#f59e0b',
      visor: '#fde047',
      sneakers: '#ef4444',
    },
    hairStyle: 'mohawk',
    silhouetteGear: 'exo_frame',
    voicePitch: 0.9,
    quote: 'Si no salen chispas de las suelas, vas demasiado lento.',
    modelFileKey: 'soldier',
  },
  {
    id: 'mika',
    name: 'MIKA',
    title: 'Águila de Azoteas',
    origin: 'Skyline Zero',
    bio: 'Campeona de escalada vertical con alas vectoriales estabilizadas para planear y manipular el impulso aéreo.',
    abilityCategory: 'gravity_well',
    abilityName: 'Corriente Ascendente',
    abilityDesc: 'Genera un vórtice vertical con planeo extendido (5.5s) y +1 carga extra de doble salto.',
    abilityCooldown: 17,
    abilityDuration: 5.5,
    bossInteractionDesc: 'Permite permanecer en el plano superior esquivando ondas sísmicas terrestres.',
    mpInterferenceDesc: 'Emite una onda de turbulencia lateral suave a corredores cercanos.',
    passiveName: 'Pluma Aérea',
    passiveDesc: '+18% impulso vertical en doble salto y descenso amortiguado en saltos altos.',
    secondaryAbilityName: 'Maestra de Tirolina',
    secondaryAbilityDesc: 'Las tirolinas otorgan multiplicador +2 automático.',
    vehicleAbilityName: 'Elevación Vectorial',
    vehicleAbilityDesc: 'Al activar vehículo multiplica la elevación aérea y atrae anillos de monedas de altura.',
    vehicleAbilityKind: 'aero_lift',
    activeAllowedInParkour: false,
    parkourRestrictionReason: 'Corriente Ascendente restringida en Parkour Extremo para evitar saltar plataformas completas.',
    unlockCostCoins: 8500,
    unlockCostGems: 120,
    unlockRequirement: {
      type: 'distance',
      target: 6000,
      label: 'Recorre 6.000m acumulados',
    },
    stats: { speed: 8, agility: 10, jump: 10, tech: 6 },
    colors: {
      skin: '#f1c27d',
      jacket: '#10b981',
      accent: '#a3e635',
      pants: '#1e293b',
      hair: '#0f172a',
      visor: '#bef264',
      sneakers: '#34d399',
    },
    hairStyle: 'ponytail',
    silhouetteGear: 'twin_wings',
    voicePitch: 1.32,
    quote: 'El suelo es para los que tienen miedo a mirar abajo.',
    modelFileKey: 'astronaut_b',
  },
  {
    id: 'cipher',
    name: 'CIPHER',
    title: 'Leyenda del Raíl',
    origin: 'Old Metropolis',
    bio: 'Mensajero técnico cuyos guantes sifón absorben energía electromagnética para neutralizar obstáculos y recargar escudo.',
    abilityCategory: 'emp_siphon',
    abilityName: 'Sifón Electromagnético',
    abilityDesc: 'Atrae recursos a gran alcance durante 6s y convierte barreras eléctricas cercanas en energía de vehículo.',
    abilityCooldown: 19,
    abilityDuration: 6.0,
    bossInteractionDesc: 'Amplifica la atracción hacia celdas EMP y destruye orbes eléctricos próximos.',
    mpInterferenceDesc: 'Drena brevemente 5% de momentum rival cercano sin detener su control.',
    passiveName: 'Guantes Inductivos',
    passiveDesc: '+2.2m radio de atracción pasiva para monedas y baterías.',
    secondaryAbilityName: 'Bono de Colección',
    secondaryAbilityDesc: 'Cada 20 monedas acelera un 12% la recarga de Habilidad.',
    vehicleAbilityName: 'Sobrecarga Magnética',
    vehicleAbilityDesc: 'Al activar vehículo libera un campo magnético gigante durante toda la conducción.',
    vehicleAbilityKind: 'mag_surge',
    activeAllowedInParkour: true,
    unlockCostCoins: 10500,
    unlockCostGems: 150,
    unlockRequirement: {
      type: 'missions',
      target: 6,
      label: 'Completa 6 misiones',
    },
    stats: { speed: 8, agility: 9, jump: 8, tech: 9 },
    colors: {
      skin: '#a5694f',
      jacket: '#eab308',
      accent: '#a855f7',
      pants: '#18181b',
      hair: '#27272a',
      visor: '#c084fc',
      sneakers: '#facc15',
    },
    hairStyle: 'visorcap',
    silhouetteGear: 'tech_halo',
    voicePitch: 1.05,
    quote: 'Cada tejado antiguo guarda un atajo secreto.',
    modelFileKey: 'xbot',
  },
  {
    id: 'valkyrie',
    name: 'VALKYRIE',
    title: 'Rompe-Muros',
    origin: 'Neon Beach',
    bio: 'Ex-agente blindada con cúpula Aegis capaz de reflejar impactos y detonar ondas sónicas en área.',
    abilityCategory: 'aegis_dome',
    abilityName: 'Cúpula Aegis',
    abilityDesc: 'Despliega un domo defensivo durante 5s que refleja proyectiles y libera un estallido sónico al terminar.',
    abilityCooldown: 22,
    abilityDuration: 5.0,
    bossInteractionDesc: 'Bloquea un ataque completo del jefe y limpia drones cercanos al estallar.',
    mpInterferenceDesc: 'Pulso de empuje defensivo que desplaza 1 carril lateral al rival si invade tu posición.',
    passiveName: 'Blindaje Reactivo',
    passiveDesc: '+20% radio en explosiones de escudo y -1.5s enfriamiento de escudo.',
    secondaryAbilityName: 'Aterrizaje Sónico',
    secondaryAbilityDesc: 'Al hacer Dive [S en aire] genera micro-onda aturdidora.',
    vehicleAbilityName: 'Blindaje Aegis Total',
    vehicleAbilityDesc: 'Al activar vehículo regenera tu Escudo Defensivo y envuelve la carrocería con impacto reflector.',
    vehicleAbilityKind: 'aegis_ram',
    activeAllowedInParkour: true,
    unlockCostCoins: 13200,
    unlockCostGems: 185,
    unlockRequirement: {
      type: 'bosses',
      target: 2,
      label: 'Derrota a 2 Jefes de ciudad',
    },
    stats: { speed: 9, agility: 7, jump: 8, tech: 8 },
    colors: {
      skin: '#e0ac69',
      jacket: '#e11d48',
      accent: '#38bdf8',
      pants: '#334155',
      hair: '#f8fafc',
      visor: '#38bdf8',
      sneakers: '#f43f5e',
    },
    hairStyle: 'visorcap',
    silhouetteGear: 'heavy_pauldrons',
    voicePitch: 1.12,
    quote: 'Nadie cierra el horizonte cuando corro.',
    modelFileKey: 'robot',
  },
  {
    id: 'zero',
    name: 'ZERO',
    title: 'Espectro Cuántico',
    origin: 'Future District',
    bio: 'Sujeto experimental que manipula ventanas temporales localizadas para frenar trampas móviles sin perder velocidad propia.',
    abilityCategory: 'chrono_pulse',
    abilityName: 'Ancla Cronométrica',
    abilityDesc: 'Congela obstáculos móviles, trenes y proyectiles cercanos en una burbuja temporal durante 4.5s.',
    abilityCooldown: 23,
    abilityDuration: 4.5,
    bossInteractionDesc: 'Ralentiza un 45% los proyectiles y ataques de fase del jefe en pantalla.',
    mpInterferenceDesc: 'Aplica distorsión visual cromática moderada de 1.8s en los bordes del HUD rival.',
    passiveName: 'Crono-Reserva',
    passiveDesc: 'El Slow-Mo [C] consume 30% menos energía y recarga más rápido.',
    secondaryAbilityName: 'Salto de Fase',
    secondaryAbilityDesc: 'Esquivar proyectiles en Slow-Mo recarga energía del vehículo.',
    vehicleAbilityName: 'Distorsión Temporal',
    vehicleAbilityDesc: 'Al activar vehículo frena un 40% los proyectiles y trenes durante 4 segundos.',
    vehicleAbilityKind: 'chrono_warp',
    activeAllowedInParkour: false,
    parkourRestrictionReason: 'Ancla Cronométrica restringida en Parkour Extremo para mantener el reto de sincronización.',
    unlockCostCoins: 16500,
    unlockCostGems: 230,
    unlockRequirement: {
      type: 'bosses',
      target: 4,
      label: 'Derrota a 4 Jefes de ciudad',
    },
    stats: { speed: 8, agility: 8, jump: 8, tech: 10 },
    colors: {
      skin: '#cbd5e1',
      jacket: '#0f172a',
      accent: '#2dd4bf',
      pants: '#020617',
      hair: '#e2e8f0',
      visor: '#14b8a6',
      sneakers: '#2dd4bf',
    },
    hairStyle: 'cyberhelm',
    silhouetteGear: 'cloak_fins',
    voicePitch: 0.82,
    quote: 'Entre un segundo y el siguiente cabe una ciudad entera.',
    modelFileKey: 'brain_stem',
  },
  {
    id: 'kage',
    name: 'KAGE',
    title: 'Sombra Cortante',
    origin: 'Skyfall Towers',
    bio: 'Asesino acrobático que proyecta cuchillas de vacío en abanico capaces de destruir barreras en 3 carriles.',
    abilityCategory: 'sonic_cleave',
    abilityName: 'Corte del Vacío',
    abilityDesc: 'Lanza 3 ondas cortantes paralelas que seccionan obstáculos destructibles y aturden drones.',
    abilityCooldown: 20,
    abilityDuration: 3.8,
    bossInteractionDesc: 'Corta en el aire ondas de proyectiles y destruye drones escudo del jefe.',
    mpInterferenceDesc: 'Proyecta una sombra señuelo temporal en la pista rival (2.0s).',
    passiveName: 'Paso Silencioso',
    passiveDesc: '+20% duración de combo y menor inercia lateral.',
    secondaryAbilityName: 'Despegue Sombra',
    secondaryAbilityDesc: 'Los saltos dobles ganan precisión de aterrizaje.',
    vehicleAbilityName: 'Cuchillas de Raíl',
    vehicleAbilityDesc: 'Al activar vehículo proyecta dos ráfagas laterales que limpian drones y barreras contiguas.',
    vehicleAbilityKind: 'void_rail_cut',
    activeAllowedInParkour: true,
    unlockCostCoins: 21000,
    unlockCostGems: 290,
    unlockRequirement: {
      type: 'level',
      target: 6,
      label: 'Alcanza Nivel 6 de corredor',
    },
    stats: { speed: 9, agility: 10, jump: 9, tech: 8 },
    colors: {
      skin: '#c68642',
      jacket: '#1e1b4b',
      accent: '#818cf8',
      pants: '#09090b',
      hair: '#312e81',
      visor: '#e879f9',
      sneakers: '#818cf8',
    },
    hairStyle: 'hood',
    silhouetteGear: 'stealth_cape',
    voicePitch: 0.95,
    quote: 'Silencio, impulso y desaparición.',
    modelFileKey: 'cesium_man',
  },
  {
    id: 'valkor',
    name: 'VALKOR',
    title: 'Soberano Overdrive',
    origin: 'Future District',
    bio: 'Corredor de élite exclusivo del Nivel 50 del Pase de Corredor. Su armadura de corona energética canaliza descargas orbitales.',
    abilityCategory: 'nova_overdrive',
    abilityName: 'Tormenta Overdrive',
    abilityDesc: 'Desata una cascada radial de energía carmesí (5s): limpia trampas en 28m, recarga +25% vehículo y multiplica combo.',
    abilityCooldown: 24,
    abilityDuration: 5.0,
    bossInteractionDesc: 'Inflige interferencia directa a los drones de apoyo y corta ráfagas de fases avanzadas.',
    mpInterferenceDesc: 'Marca temporalmente el carril del rival con estática neón equilibrada (2.2s).',
    passiveName: 'Corona Cinética',
    passiveDesc: 'Comienza cada partida con +28% de batería de vehículo cargada.',
    secondaryAbilityName: 'Pulso Soberano',
    secondaryAbilityDesc: 'Sobrevivir a fases de jefe otorga +2 gemas adicionales.',
    vehicleAbilityName: 'Bombardeo Overdrive',
    vehicleAbilityDesc: 'Al activar vehículo dispara una salva de misiles de pulso que abren brecha en toda la pista.',
    vehicleAbilityKind: 'overdrive_barrage',
    activeAllowedInParkour: false,
    parkourRestrictionReason: 'Tormenta Overdrive restringida en Parkour Extremo para mantener el equilibrio competitivo.',
    passExclusiveTier: 50,
    unlockCostCoins: 0,
    unlockCostGems: 9999,
    stats: { speed: 10, agility: 9, jump: 9, tech: 10 },
    colors: {
      skin: '#d2a679',
      jacket: '#9f1239',
      accent: '#fbbf24',
      pants: '#18181b',
      hair: '#fef08a',
      visor: '#fb7185',
      sneakers: '#f59e0b',
    },
    hairStyle: 'spiky',
    silhouetteGear: 'overdrive_crown',
    voicePitch: 0.86,
    quote: 'El caos no se esquiva. Se gobierna.',
    modelFileKey: 'brain_stem',
  },
];

export const DISTRICTS: DistrictDef[] = [
  {
    id: 'downtown',
    name: 'Neon Downtown',
    subtitle: 'Metrópolis Holográfica (3 Carriles)',
    description: 'Rascacielos reales, anuncios holográficos colosales, viaductos de monorraíl elevados, túneles subterráneos aleatorios y tráfico rápido.',
    laneCount: 3,
    unlockCostCoins: 0,
    unlockLevel: 1,
    difficulty: 2,
    gravityMultiplier: 1.0,
    speedBonus: 1.0,
    colors: {
      skyTop: '#060a18',
      skyHorizon: '#141e3c',
      fog: '#0f1730',
      ground: '#0c1222',
      railGlow: '#06b6d4',
      primaryNeon: '#22d3ee',
      secondaryNeon: '#ec4899',
      buildingBase: '#111b33',
      sunLight: '#c7d2fe',
    },
    isUnderground: false,
    defaultWeather: 'rain',
    defaultTimeOfDay: 'night',
    musicBpm: 132,
    musicRootHz: 110,
    specialFeature: 'Viaductos elevados de monorraíl, túneles metro y autopistas de 5 carriles por evento',
    signatureEnemies: ['scout', 'pursuit', 'surveillance'],
    signatureBoss: 'titan_drone',
    landmarkType: 'holotower',
  },
  {
    id: 'oldcity',
    name: 'Old Metropolis',
    subtitle: 'Ciudad Histórica y Mercados (3 Carriles)',
    description: 'Calles de adoquines húmedos, arcos clásicos, mercados iluminados, callejones estrechos de 1-2 carriles y túneles de servicio.',
    laneCount: 3,
    unlockCostCoins: 0,
    unlockLevel: 1,
    difficulty: 3,
    gravityMultiplier: 1.0,
    speedBonus: 1.04,
    colors: {
      skyTop: '#160d18',
      skyHorizon: '#3c1e2e',
      fog: '#2b1522',
      ground: '#21181c',
      railGlow: '#f59e0b',
      primaryNeon: '#fbbf24',
      secondaryNeon: '#fb7185',
      buildingBase: '#3a242b',
      sunLight: '#fde68a',
    },
    isUnderground: false,
    defaultWeather: 'clear',
    defaultTimeOfDay: 'dusk',
    musicBpm: 126,
    musicRootHz: 103.83,
    specialFeature: 'Arcos históricos, callejones estrechos dinámicos y farolillos flotantes',
    signatureEnemies: ['ground_bot', 'security_bot', 'scout'],
    signatureBoss: 'cryo_leviathan',
    landmarkType: 'lanterns',
  },
  {
    id: 'industrial',
    name: 'Industrial Core',
    subtitle: 'Fundición, Grúas y Vapor (3 Carriles)',
    description: 'Fábricas titánicas, hangares reales, maquinaria móvil, tuberías de vapor, túneles blindados y plataformas metálicas.',
    laneCount: 3,
    unlockCostCoins: 1400,
    unlockLevel: 2,
    difficulty: 5,
    gravityMultiplier: 1.04,
    speedBonus: 1.08,
    colors: {
      skyTop: '#140c07',
      skyHorizon: '#381e0f',
      fog: '#26140a',
      ground: '#1d1815',
      railGlow: '#f97316',
      primaryNeon: '#fb923c',
      secondaryNeon: '#facc15',
      buildingBase: '#2d2420',
      sunLight: '#fed7aa',
    },
    isUnderground: false,
    defaultWeather: 'cyberfog',
    defaultTimeOfDay: 'afternoon',
    musicBpm: 142,
    musicRootHz: 87.31,
    specialFeature: 'Grúas pesadas, válvulas de vapor y tramos de autopista amplia',
    signatureEnemies: ['armored', 'ground_bot', 'security_bot'],
    signatureBoss: 'iron_hunter',
    landmarkType: 'crane',
  },
  {
    id: 'skyline',
    name: 'Skyline Zero',
    subtitle: 'Azoteas y Abismos Verticales (3 Carriles)',
    description: 'Ciudad suspendida en cumbres de rascacielos con saltos sobre abismos reales, puentes retráctiles, pasarelas y helipuertos.',
    laneCount: 3,
    unlockCostCoins: 2000,
    unlockLevel: 3,
    difficulty: 6,
    gravityMultiplier: 0.92,
    speedBonus: 1.12,
    colors: {
      skyTop: '#0a1028',
      skyHorizon: '#2a1d4f',
      fog: '#1e163d',
      ground: '#181e38',
      railGlow: '#a855f7',
      primaryNeon: '#c084fc',
      secondaryNeon: '#22d3ee',
      buildingBase: '#202b47',
      sunLight: '#e9d5ff',
    },
    isUnderground: false,
    defaultWeather: 'clear',
    defaultTimeOfDay: 'morning',
    musicBpm: 138,
    musicRootHz: 123.47,
    specialFeature: 'Azoteas suspendidas, abismos abiertos y tirolinas de altura',
    signatureEnemies: ['tactical', 'pursuit', 'swarm'],
    signatureBoss: 'volt_archon',
    landmarkType: 'skybridge',
  },
  {
    id: 'beach',
    name: 'Neon Beach',
    subtitle: 'Paseo Marítimo y Océano Luminoso (3 Carriles)',
    description: 'Bulevar costero junto a un océano animado en tiempo real con olas bioluminiscentes, hoteles turísticos, puertos y zonas de agua.',
    laneCount: 3,
    unlockCostCoins: 2400,
    unlockLevel: 4,
    difficulty: 5,
    gravityMultiplier: 0.96,
    speedBonus: 1.14,
    colors: {
      skyTop: '#171036',
      skyHorizon: '#7c2d58',
      fog: '#481b44',
      ground: '#1b263d',
      railGlow: '#2dd4bf',
      primaryNeon: '#2dd4bf',
      secondaryNeon: '#fb7185',
      buildingBase: '#243254',
      sunLight: '#fda4af',
    },
    isUnderground: false,
    defaultWeather: 'sunset',
    defaultTimeOfDay: 'dawn',
    musicBpm: 130,
    musicRootHz: 116.54,
    specialFeature: 'Océano animado en tiempo real, muelles y zonas costeras',
    signatureEnemies: ['scout', 'swarm', 'intervention'],
    signatureBoss: 'neon_wraith',
    landmarkType: 'palms',
  },
  {
    id: 'underground',
    name: 'Cyber Underground',
    subtitle: 'Túneles de Metro y Laboratorios (3 Carriles)',
    description: 'Red subterránea acorazada con bóvedas de hormigón, tuberías de energía, estaciones activas, láseres y trenes bala.',
    laneCount: 3,
    unlockCostCoins: 3000,
    unlockLevel: 5,
    difficulty: 7,
    gravityMultiplier: 1.0,
    speedBonus: 1.16,
    colors: {
      skyTop: '#030812',
      skyHorizon: '#091b2b',
      fog: '#071421',
      ground: '#0b121c',
      railGlow: '#38bdf8',
      primaryNeon: '#0ea5e9',
      secondaryNeon: '#f43f5e',
      buildingBase: '#131d2b',
      sunLight: '#7dd3fc',
    },
    isUnderground: true,
    defaultWeather: 'cyberfog',
    defaultTimeOfDay: 'midnight',
    musicBpm: 144,
    musicRootHz: 98,
    specialFeature: 'Bóvedas subterráneas profundas con estaciones de metro y eco acústico',
    signatureEnemies: ['surveillance', 'security_bot', 'tactical'],
    signatureBoss: 'overseer',
    landmarkType: 'tunnel',
  },
  {
    id: 'future',
    name: 'Future District',
    subtitle: 'Arquitectura Experimental Autónoma (3 Carriles)',
    description: 'Ciudad utópica de cerámica blanca y titanio, arcos paramétricos luminosos, reactores cuánticos y vehículos autónomos.',
    laneCount: 3,
    unlockCostCoins: 3800,
    unlockLevel: 6,
    difficulty: 8,
    gravityMultiplier: 0.84,
    speedBonus: 1.2,
    colors: {
      skyTop: '#08182b',
      skyHorizon: '#163c5e',
      fog: '#102b47',
      ground: '#16243a',
      railGlow: '#38bdf8',
      primaryNeon: '#60a5fa',
      secondaryNeon: '#e879f9',
      buildingBase: '#cbd5e1',
      sunLight: '#f8fafc',
    },
    isUnderground: false,
    defaultWeather: 'clear',
    defaultTimeOfDay: 'noon',
    musicBpm: 152,
    musicRootHz: 146.83,
    specialFeature: 'Baja gravedad experimental (0.84G), suelos móviles y láseres',
    signatureEnemies: ['elite', 'intervention', 'armored'],
    signatureBoss: 'the_sentinel',
    landmarkType: 'reactor',
  },
  {
    id: 'skyfall_towers',
    name: 'Cuidado si te caes',
    subtitle: 'Parkour en Rascacielos y Abismos (3 Carriles)',
    description: 'Pistas extremas suspendidas entre las cimas de rascacielos gigantes: plataformas flotantes, abismos profundos y tirolinas de altura.',
    laneCount: 3,
    unlockCostCoins: 4600,
    unlockLevel: 3,
    difficulty: 7,
    gravityMultiplier: 0.9,
    speedBonus: 1.16,
    colors: {
      skyTop: '#081124',
      skyHorizon: '#1f2b52',
      fog: '#162040',
      ground: '#18243d',
      railGlow: '#38bdf8',
      primaryNeon: '#38bdf8',
      secondaryNeon: '#f59e0b',
      buildingBase: '#1d2d4a',
      sunLight: '#e0f2fe',
    },
    isUnderground: false,
    defaultWeather: 'clear',
    defaultTimeOfDay: 'dusk',
    musicBpm: 140,
    musicRootHz: 110,
    specialFeature: 'Cimas de rascacielos, abismos letales entre azoteas, tirolinas y pasarelas estrechas',
    signatureEnemies: ['tactical', 'pursuit', 'elite'],
    signatureBoss: 'omega_core',
    landmarkType: 'skyfall',
  },
  {
    id: 'the_creation',
    name: 'La Creación',
    subtitle: 'Interior de Mega-Fábrica Robótica (3 Carriles)',
    description: 'Corre por el interior de la planta de ensamblaje automatizada: brazos robóticos articulados, engranajes gigantes, prensas hidráulicas y cintas.',
    laneCount: 3,
    unlockCostCoins: 5400,
    unlockLevel: 4,
    difficulty: 8,
    gravityMultiplier: 1.0,
    speedBonus: 1.18,
    colors: {
      skyTop: '#160d07',
      skyHorizon: '#2f1c0e',
      fog: '#211309',
      ground: '#1a1614',
      railGlow: '#fb923c',
      primaryNeon: '#f97316',
      secondaryNeon: '#22d3ee',
      buildingBase: '#2b241f',
      sunLight: '#fed7aa',
    },
    isUnderground: true,
    defaultWeather: 'cyberfog',
    defaultTimeOfDay: 'midnight',
    musicBpm: 146,
    musicRootHz: 92.5,
    specialFeature: 'Interior de fábrica cerrada con brazos robóticos, engranajes giratorios y láseres de montaje',
    signatureEnemies: ['ground_bot', 'security_bot', 'armored'],
    signatureBoss: 'iron_hunter',
    landmarkType: 'factory',
  },
  {
    id: 'dont_drown',
    name: 'No te ahogues',
    subtitle: 'Plataformas sobre Océano y Flota Marina (3 Carriles)',
    description: 'Pasarelas flotantes sobre mar abierto batidas por olas reales: lanchas interceptoras, drones acuáticos y turbinas marinas hostiles.',
    laneCount: 3,
    unlockCostCoins: 6200,
    unlockLevel: 5,
    difficulty: 8,
    gravityMultiplier: 0.96,
    speedBonus: 1.2,
    colors: {
      skyTop: '#041629',
      skyHorizon: '#0e3c5c',
      fog: '#092a42',
      ground: '#122b3e',
      railGlow: '#2dd4bf',
      primaryNeon: '#2dd4bf',
      secondaryNeon: '#f43f5e',
      buildingBase: '#18374f',
      sunLight: '#a5f3fc',
    },
    isUnderground: false,
    defaultWeather: 'storm',
    defaultTimeOfDay: 'morning',
    musicBpm: 144,
    musicRootHz: 103.83,
    specialFeature: 'Plataformas suspendidas sobre agua, barcos de asalto y drones marinos',
    signatureEnemies: ['swarm', 'intervention', 'scout'],
    signatureBoss: 'neon_wraith',
    landmarkType: 'ocean',
  },
];

export const ORDERED_BOSS_IDS: BossId[] = [
  'titan_drone',
  'iron_hunter',
  'overseer',
  'neon_wraith',
  'cryo_leviathan',
  'volt_archon',
  'the_sentinel',
  'omega_core',
];

export function isBossUnlocked(bossId: BossId, defeatedBosses: BossId[]): boolean {
  const idx = ORDERED_BOSS_IDS.indexOf(bossId);
  if (idx <= 0) return true;
  if (defeatedBosses.includes(bossId)) return true;
  const prevId = ORDERED_BOSS_IDS[idx - 1];
  return defeatedBosses.includes(prevId);
}

export function getUnlockedBossIds(defeatedBosses: BossId[]): BossId[] {
  return ORDERED_BOSS_IDS.filter((id) => isBossUnlocked(id, defeatedBosses));
}

export function getBossUnlockRequirement(bossId: BossId): BossDef | null {
  const idx = ORDERED_BOSS_IDS.indexOf(bossId);
  if (idx <= 0) return null;
  return BOSSES.find((b) => b.id === ORDERED_BOSS_IDS[idx - 1]) ?? null;
}

function getWarningDurationForPhase(phase: number): number {
  if (phase <= 2) return 2.0;
  if (phase <= 4) return 1.3;
  if (phase <= 6) return 0.9;
  return 0.6;
}

function buildPhasesList(
  bossRank: number, // 0..7
  phaseCount: number,
  primary: string,
  secondary: string,
  phaseTitles: string[],
  phaseDescs: string[],
  hasShieldGate = false,
): BossPhaseDef[] {
  const allPatterns: BossPhaseDef['patterns'] = [
    'lane_sweep',
    'dual_projectile',
    'predictive_snipe',
    'orbital_cross',
    'drone_barrage',
    'shockwave',
    'homing_burst',
    'rail_overload',
  ];

  const palette = [primary, secondary, '#f59e0b', '#a855f7', '#2dd4bf', '#38bdf8', '#fb7185', '#f43f5e'];

  return Array.from({ length: phaseCount }, (_, idx) => {
    const phase = idx + 1;
    const warningDurationSec = getWarningDurationForPhase(phase);
    const supportDroneCount = Math.min(5, 1 + Math.floor((bossRank + phase) / 2.6));
    const droneAggression = Math.min(4, 1 + Math.floor((phase + bossRank * 0.4) / 2));
    const pStart = idx % allPatterns.length;
    const patterns: BossPhaseDef['patterns'] = [
      allPatterns[pStart],
      allPatterns[(pStart + 2) % allPatterns.length],
      allPatterns[(pStart + 4) % allPatterns.length],
      ...(phase >= 4 ? [allPatterns[(pStart + 5) % allPatterns.length]] : []),
    ];

    const hpUnits = hasShieldGate
      ? 4 + idx
      : Math.max(3, 3 + Math.floor(bossRank / 2) + Math.floor(idx / 2));

    return {
      phase,
      name: `Fase ${phase} · ${phaseTitles[idx] ?? `Secuencia ${phase}`}`,
      subtitle:
        phase <= 2
          ? 'Escaneo Inicial y Drones Exploradores'
          : phase <= 4
            ? 'Asedio Táctico y Ráfagas Cruzadas'
            : phase <= 6
              ? 'Sobrecarga Acelerada'
              : 'Colapso Crítico del Núcleo',
      description: phaseDescs[idx] ?? 'Patrones coordinados con alerta del radar pasivo.',
      hpUnits,
      attackCooldownSec: Math.max(1.25, 2.7 - bossRank * 0.05 - idx * 0.14),
      warningDurationSec,
      empSpawnSec: hasShieldGate ? 5.6 : Math.min(8.8, 6.6 + idx * 0.25),
      empEnergyGain: 1,
      supportDroneCount,
      droneAggression,
      auraColor: palette[idx % palette.length],
      envTint: palette[(idx + 1) % palette.length],
      scaleBoost: 1 + idx * 0.05,
      shieldMaxHp: hasShieldGate ? 2 + idx : undefined,
      shieldWindowSec: hasShieldGate ? Math.max(5.5, 7.5 - idx * 0.7) : undefined,
      patterns,
    };
  });
}

export const BOSSES: BossDef[] = [
  {
    id: 'titan_drone',
    name: 'TITAN DRONE',
    title: '01 · Fortaleza Aérea de Asalto (2 Fases)',
    introTitle: 'CENTINELA DE LOS VIADUCTOS',
    introQuote: 'PROTOCOLO DE EXTERMINIO AÉREO INICIADO. ARENA DESPEJADA.',
    cityId: 'downtown',
    description: 'Aeronave cuadri-turbina gigante que despeja Neon Downtown para un duelo introductorio equilibrado de 2 fases con drones visibles en pista.',
    hpSegments: 2,
    phaseCount: 2,
    phases: [
      'Fase 1 · Barrido Aéreo (2.0s Alerta)',
      'Fase 2 · Salva Doble de Turbinas (2.0s Alerta)',
    ],
    phaseDetails: [
      'Barre carriles anunciados en el radar pasivo mientras despliega 1 drone aliado.',
      'Dispara misiles de plasma paralelos y refuerza el escolta de drones.',
    ],
    phasesConfig: buildPhasesList(
      0,
      2,
      '#22d3ee',
      '#ef4444',
      ['Barrido Aéreo', 'Salva de Turbinas'],
      [
        'Barre carriles con haces telegrafiados en el suelo tras aviso de 2.0s.',
        'Lanza salvas dobles de plasma y drones escolta que cruzan carriles.',
      ],
    ),
    counterHint: 'Observa el radar superior y el brillo rojo del carril (2.0s de aviso) para esquivar y capturar celdas EMP.',
    rewardCoins: 1800,
    rewardGems: 22,
    primaryColor: '#22d3ee',
    secondaryColor: '#ef4444',
  },
  {
    id: 'iron_hunter',
    name: 'IRON HUNTER',
    title: '02 · Perseguidor de Fundición (2 Fases)',
    introTitle: 'BESTIA DE LA FUNDICIÓN',
    introQuote: 'BLINDAJE TÉRMICO SELLADO. NINGÚN CORREDOR CRUZA VIVO.',
    cityId: 'industrial',
    description: 'Bestia mecánica de fundición armada con embistes sísmicos y drones bombarderos visibles en 2 fases claras.',
    hpSegments: 2,
    phaseCount: 2,
    phases: [
      'Fase 1 · Embiste de Carril (2.0s Alerta)',
      'Fase 2 · Onda Sísmica Térmica (2.0s Alerta)',
    ],
    phaseDetails: [
      'Carga golpes terrestres sobre el carril iluminado por el radar.',
      'Combina ondas sísmicas de salto con ataques de drones de apoyo.',
    ],
    phasesConfig: buildPhasesList(
      1,
      2,
      '#f97316',
      '#facc15',
      ['Embiste de Carril', 'Onda Sísmica Térmica'],
      [
        'Fija un carril en el radar y embiste tras iluminar la calzada.',
        'Golpea el suelo enviando ondas bajas de salto mientras sus drones hostigan.',
      ],
    ),
    counterHint: 'Salta las ondas sísmicas y aprovecha los 2.0s de alerta del radar para cambiar de carril.',
    rewardCoins: 2100,
    rewardGems: 26,
    primaryColor: '#f97316',
    secondaryColor: '#facc15',
  },
  {
    id: 'overseer',
    name: 'OVERSEER',
    title: '03 · Núcleo Robótico de Vigilancia (3 Fases)',
    introTitle: 'EL OJO DEL SUBSUELO',
    introQuote: 'CONEXIÓN NEURAL INTERCEPTADA. SELLANDO TÚNELES.',
    cityId: 'underground',
    description: 'Ojo cibernético orbital con anillos giroscópicos que alterna láseres predictivos y enjambres visibles durante 3 fases.',
    hpSegments: 3,
    phaseCount: 3,
    phases: [
      'Fase 1 · Escaneo de Láser (2.0s)',
      'Fase 2 · Compuertas y Orbes (2.0s)',
      'Fase 3 · Matriz de Vigilancia (1.3s)',
    ],
    phaseDetails: [
      'Emite haces horizontales con amplia advertencia en pista.',
      'Combina haces láser con proyectiles de flanco.',
      'Acelera la ventana de aviso a 1.3s e incrementa los drones escolta.',
    ],
    phasesConfig: buildPhasesList(
      2,
      3,
      '#a855f7',
      '#38bdf8',
      ['Escaneo de Láser', 'Compuertas y Orbes', 'Matriz de Vigilancia'],
      [
        'Escanea tu carril predictivamente con haces de precisión.',
        'Combina haces de carril y orbes de energía paralelos.',
        'Acelera su cadencia a 1.3s de advertencia desplegando 2–3 drones activos.',
      ],
    ),
    counterHint: 'En Fase 3 el radar reduce el aviso a 1.3s: mantén el foco en los carriles libres.',
    rewardCoins: 2500,
    rewardGems: 32,
    primaryColor: '#a855f7',
    secondaryColor: '#38bdf8',
  },
  {
    id: 'neon_wraith',
    name: 'NEON WRAITH',
    title: '04 · Unidad Fantasma Supersónica (4 Fases)',
    introTitle: 'ESPECTRO DE MAREA',
    introQuote: 'DETECCIÓN ESPECTRAL ACTIVA. INICIANDO CAZA HIPERSÓNICA.',
    cityId: 'dont_drown',
    description: 'Interceptor humanoide flotante que cambia de carril velozmente con 4 fases crecientes y escuadrón marino visible.',
    hpSegments: 4,
    phaseCount: 4,
    phases: [
      'Fase 1 · Espejismo Doble (2.0s)',
      'Fase 2 · Cortes de Marea (2.0s)',
      'Fase 3 · Teletransporte Marino (1.3s)',
      'Fase 4 · Velocidad Hipersónica (1.3s)',
    ],
    phasesConfig: buildPhasesList(
      3,
      4,
      '#2dd4bf',
      '#fb7185',
      ['Espejismo Doble', 'Cortes de Marea', 'Teletransporte Marino', 'Velocidad Hipersónica'],
      [
        'Se desliza hacia tu flanco disparando cortes telegrafiados.',
        'Proyecta cuchillas paralelas dejando siempre al menos un carril seguro.',
        'Alterna saltos de fase con ataques de drones rápidos.',
        'Ráfagas encadenadas con 3 drones activos presionando en pantalla.',
      ],
    ),
    counterHint: 'El radar marca siempre los carriles afectados antes del impacto. Nunca bloquea toda la pista.',
    rewardCoins: 3000,
    rewardGems: 40,
    primaryColor: '#2dd4bf',
    secondaryColor: '#fb7185',
  },
  {
    id: 'cryo_leviathan',
    name: 'CRYO LEVIATHAN',
    title: '05 · Serpiente Criogénica Orbital (5 Fases)',
    introTitle: 'SIERPE DEL CERO ABSOLUTO',
    introQuote: 'TEMPERATURA CRÍTICA. CONGELANDO VECTORES DE HUIDA.',
    cityId: 'oldcity',
    description: 'Leviatán articulado de 5 fases progresivas que serpentea sobre los carriles alternando lanzas heladas y pulsos rasantes.',
    hpSegments: 5,
    phaseCount: 5,
    phases: [
      'Fase 1 · Coletazo Helado',
      'Fase 2 · Cristales de Escarcha',
      'Fase 3 · Tormenta Boreal',
      'Fase 4 · Congelación Súbita',
      'Fase 5 · Cero Absoluto',
    ],
    phasesConfig: buildPhasesList(
      4,
      5,
      '#38bdf8',
      '#a5f3fc',
      ['Coletazo Helado', 'Cristales Escarcha', 'Tormenta Boreal', 'Congelación Súbita', 'Cero Absoluto'],
      [
        'Serpentea en arcos amplios disparando lanzas de hielo.',
        'Alterna carriles laterales con ráfagas criogénicas.',
        'Emite pulsos rasantes de salto obligatorio (1.3s aviso).',
        'Aumenta la agresividad de los drones escolta criogénicos.',
        'Fase 5: ventana relámpago de 0.9s con secuencia acelerada.',
      ],
    ),
    counterHint: 'En Fase 5 el radar solo concede 0.9s de anticipación: reacciona apenas brille la calzada.',
    rewardCoins: 3600,
    rewardGems: 48,
    primaryColor: '#38bdf8',
    secondaryColor: '#a5f3fc',
  },
  {
    id: 'volt_archon',
    name: 'VOLT ARCHON',
    title: '06 · Arconte de Alta Tensión (6 Fases)',
    introTitle: 'SEÑOR DE LAS TORMENTAS',
    introQuote: 'SOBRECARGA DE MEGAVATIOS. NINGÚN CIRCUITO SOBREVIVE.',
    cityId: 'skyline',
    description: 'Centinela aéreo con bobinas Tesla giratorias y 6 fases escalonadas de voltaje y escolta coordinada.',
    hpSegments: 6,
    phaseCount: 6,
    phases: [
      'Fase 1 · Arco Voltaico',
      'Fase 2 · Bobinas Cruzadas',
      'Fase 3 · Descarga en Cadena',
      'Fase 4 · Interferencia Aérea',
      'Fase 5 · Alta Tensión',
      'Fase 6 · Tormenta Tesla',
    ],
    phasesConfig: buildPhasesList(
      5,
      6,
      '#facc15',
      '#6366f1',
      ['Arco Voltaico', 'Bobinas Cruzadas', 'Descarga Cadena', 'Interferencia Aérea', 'Alta Tensión', 'Tormenta Tesla'],
      [
        'Descargas eléctricas directas en un carril marcado.',
        'Esferas voltaicas cruzadas entre carriles.',
        'Combina pulsos de suelo con ráfagas teledirigidas.',
        'Escolta de 3 drones bombarderos interceptando tu trazada.',
        'Ventana rápida de 0.9s en el radar de carriles.',
        'Descarga continua de bobinas hasta agotar la última fase.',
      ],
    ),
    counterHint: 'Aprovecha tu Dron Acompañante [G] y celdas EMP para atravesar las 6 fases.',
    rewardCoins: 4200,
    rewardGems: 56,
    primaryColor: '#facc15',
    secondaryColor: '#6366f1',
  },
  {
    id: 'the_sentinel',
    name: 'THE SENTINEL',
    title: '07 · Guardián Cuántico (8 Fases Escaladas)',
    introTitle: 'CUSTODIO DE LA SINGULARIDAD',
    introQuote: 'INTRUSO DETECTADO. DESPLEGANDO 8 PROTOCOLOS DE CONTENCIÓN.',
    cityId: 'future',
    description: 'La máquina de defensa suprema de Future District: 8 fases únicas y cada una más feroz que la anterior con aviso del radar descendente hasta 0.6s.',
    hpSegments: 8,
    phaseCount: 8,
    phases: [
      'Fase 1 · Matriz Cuántica',
      'Fase 2 · Vectores Gemelos',
      'Fase 3 · Escuadrón Orbital',
      'Fase 4 · Ruptura de Segmentos',
      'Fase 5 · Tormenta de Proyectiles',
      'Fase 6 · Pulso Gravitatorio',
      'Fase 7 · Sobrecarga Letal (0.6s)',
      'Fase 8 · Protocolo Apocalipsis (0.6s)',
    ],
    phasesConfig: buildPhasesList(
      6,
      8,
      '#e879f9',
      '#60a5fa',
      [
        'Matriz Cuántica',
        'Vectores Gemelos',
        'Escuadrón Orbital',
        'Ruptura Segmentos',
        'Tormenta Proyectiles',
        'Pulso Gravitatorio',
        'Sobrecarga Letal',
        'Protocolo Apocalipsis',
      ],
      [
        'Ráfagas cuánticas iniciales calibradas con 2.0s de aviso.',
        'Barridos dobles alternos en dos carriles.',
        'Despliegue de drones escolta tácticos visibles frente al jefe.',
        'Láseres cruzados con 1.3s de advertencia en pista.',
        'Ondas sísmicas combinadas con esferas teledirigidas (0.9s).',
        'Sobrecarga de raíles con escolta agresiva.',
        'Fase 7: solo 0.6s de aviso en el radar pasivo.',
        'Fase 8 final: todas las mecánicas coordinadas al máximo nivel.',
      ],
    ),
    counterHint: '8 fases cada vez más rápidas. En Fases 7 y 8 el radar avisa con solo 0.6s antes del impacto.',
    rewardCoins: 6000,
    rewardGems: 85,
    primaryColor: '#e879f9',
    secondaryColor: '#60a5fa',
  },
  {
    id: 'omega_core',
    name: 'OMEGA CORE',
    title: '08 · Núcleo Blindado (Escudo Regenerativo)',
    introTitle: 'EL FIN DE NEON CITY',
    introQuote: 'ESCUDO SINGULARIDAD ACTIVO. NO RECIBO DAÑO MIENTRAS RESISTA LA BARRERA.',
    cityId: 'skyfall_towers',
    description: 'El jefe final absoluto: protegido por un Escudo de Singularidad impenetrable. Rompe primero su escudo con celdas EMP para abrir una breve ventana de vulnerabilidad sobre su vida real antes de que el escudo se regenere.',
    hpSegments: 3,
    phaseCount: 3,
    hasShieldGate: true,
    phases: [
      'Fase 1 · Barrera Omega (Rompe Escudo -> Daña Vida)',
      'Fase 2 · Colapso Blindado (Ventana Corta)',
      'Fase 3 · Singularidad Terminal (0.6s Alerta)',
    ],
    phasesConfig: buildPhasesList(
      7,
      3,
      '#f43f5e',
      '#fbbf24',
      ['Barrera Omega', 'Colapso Blindado', 'Singularidad Terminal'],
      [
        'Rompe su escudo azul con celdas EMP para exponer su barra de vida durante 7.5s.',
        'El escudo se regenera más resistente y la ventana de vulnerabilidad baja a 6.8s.',
        'Escolta máxima de drones y ataques con 0.9s/0.6s de aviso mientras proteges la ventana de daño.',
      ],
      true,
    ),
    counterHint: 'Inmune a daño mientras tenga escudo azul. Captura celdas EMP para romperlo y golpéalo rápido durante la ventana abierta.',
    rewardCoins: 8500,
    rewardGems: 130,
    primaryColor: '#f43f5e',
    secondaryColor: '#fbbf24',
  },
];

export const DRONE_CODEX: Record<
  EnemyClass,
  { name: string; role: string; danger: string; color: string }
> = {
  scout: {
    name: 'Drone Explorador',
    role: 'Patrulla con cono escáner que barre carriles e identifica al corredor.',
    danger: 'Medio',
    color: '#38bdf8',
  },
  pursuit: {
    name: 'Drone de Persecución',
    role: 'Interceptor veloz sincronizado con tu velocidad de carrera.',
    danger: 'Alto',
    color: '#f97316',
  },
  armored: {
    name: 'Drone Blindado',
    role: 'Acorazado pesado que vuela alto: deslízate por debajo o destrúyelo con escudo.',
    danger: 'Muy Alto',
    color: '#ef4444',
  },
  surveillance: {
    name: 'Drone de Vigilancia',
    role: 'Cámara flotante con haz de radar sincronizado en estaciones y túneles.',
    danger: 'Medio',
    color: '#0ea5e9',
  },
  swarm: {
    name: 'Enjambre de Drones',
    role: 'Escuadrón coordinado de micro-drones en formación en V.',
    danger: 'Medio',
    color: '#facc15',
  },
  ground_bot: {
    name: 'Robot Terrestre',
    role: 'Unidad bípeda de patrulla callejera que avanza por carriles bajos.',
    danger: 'Alto',
    color: '#fb923c',
  },
  security_bot: {
    name: 'Robot de Seguridad',
    role: 'Torreta andante con escudo frontal; salta por encima o cámbiale de carril.',
    danger: 'Alto',
    color: '#f43f5e',
  },
  intervention: {
    name: 'Unidad de Intervención',
    role: 'Cyborg aerodeslizador que bloquea rutas de alta velocidad.',
    danger: 'Muy Alto',
    color: '#ec4899',
  },
  tactical: {
    name: 'Drone Táctico',
    role: 'Cambia de carril periódicamente con telemetría predictiva.',
    danger: 'Alto',
    color: '#a855f7',
  },
  elite: {
    name: 'Perseguidor de Élite',
    role: 'Unidad experimental giroscópica rara. Esquivarlo otorga gemas y recarga habilidad.',
    danger: 'Extremo',
    color: '#e879f9',
  },
};

export const COMPANION_DRONES: CompanionDroneDef[] = [
  {
    id: 'drone_aegis_mk1',
    name: 'Centinela Aegis MK-1',
    title: 'Dron de Apoyo Inicial',
    description: 'Despliega un campo protector de imán y despeja 1 obstáculo cercano mientras sobrevuela tu hombro.',
    role: 'magnet_shield',
    activeDurationSec: 12,
    cooldownSec: 28,
    costCoins: 0,
    costGems: 0,
    rarity: 'Raro',
    primaryColor: '#22d3ee',
    accentColor: '#38bdf8',
    modelKey: 'turret',
  },
  {
    id: 'drone_emp_hunter',
    name: 'Cazador EMP V-4',
    title: 'Dron Antidrones y Jefes',
    description: 'Dispara micro-pulsos contra drones hostiles y recarga energía EMP adicional contra jefes.',
    role: 'emp_breaker',
    activeDurationSec: 14,
    cooldownSec: 26,
    costCoins: 5800,
    costGems: 65,
    rarity: 'Épico',
    primaryColor: '#a855f7',
    accentColor: '#f43f5e',
    modelKey: 'bomber',
  },
  {
    id: 'drone_gold_harvester',
    name: 'Recolector Prisma-9',
    title: 'Dron Magnético de Recursos',
    description: 'Duplica el radio de absorción de monedas y baterías mientras potencia tu combo acrobático.',
    role: 'coin_pulse',
    activeDurationSec: 15,
    cooldownSec: 25,
    costCoins: 7600,
    costGems: 90,
    rarity: 'Épico',
    primaryColor: '#facc15',
    accentColor: '#2dd4bf',
    modelKey: 'speeder',
  },
  {
    id: 'drone_sky_seraph',
    name: 'Serafín Orbital S-8',
    title: 'Dron Escolta Legendario',
    description: 'Escolta total: imán extendido, defensa activa frente a drones de jefe y recarga acelerada de habilidad.',
    role: 'aerial_guardian',
    activeDurationSec: 16,
    cooldownSec: 24,
    costCoins: 12500,
    costGems: 160,
    rarity: 'Legendario',
    primaryColor: '#38bdf8',
    accentColor: '#fbbf24',
    modelKey: 'bomber',
  },
];

export const CHARACTER_BOOSTERS: CharacterBoosterDef[] = [
  {
    id: 'boost_kinetic_core',
    name: 'Núcleo Cinético +8%',
    description: 'Incrementa un +8% la velocidad punta y acelera la recarga de tu habilidad activa un +10%.',
    rarity: 'Común',
    costCoins: 2200,
    costGems: 0,
    speedBonusPct: 8,
    jumpBonusPct: 0,
    shieldCooldownReductionPct: 0,
    abilityRechargeBonusPct: 10,
    vehicleChargeBonusPct: 0,
    coinBonusPct: 0,
    iconTag: 'VEL',
    accentColor: '#22d3ee',
  },
  {
    id: 'boost_aero_spring',
    name: 'Propulsores de Salto +12%',
    description: 'Otorga +12% altura de salto / doble salto y +6% velocidad lateral.',
    rarity: 'Raro',
    costCoins: 3600,
    costGems: 35,
    speedBonusPct: 4,
    jumpBonusPct: 12,
    shieldCooldownReductionPct: 0,
    abilityRechargeBonusPct: 5,
    vehicleChargeBonusPct: 0,
    coinBonusPct: 0,
    iconTag: 'ALT',
    accentColor: '#10b981',
  },
  {
    id: 'boost_aegis_capacitor',
    name: 'Condensador Escudo -20%',
    description: 'Reduce un 20% el tiempo de reutilización del Escudo tras romperse.',
    rarity: 'Raro',
    costCoins: 4200,
    costGems: 45,
    speedBonusPct: 0,
    jumpBonusPct: 0,
    shieldCooldownReductionPct: 20,
    abilityRechargeBonusPct: 8,
    vehicleChargeBonusPct: 0,
    coinBonusPct: 0,
    iconTag: 'DEF',
    accentColor: '#38bdf8',
  },
  {
    id: 'boost_turbo_dynamo',
    name: 'Dinamo Vehicular +22%',
    description: 'Acelera un +22% la carga de baterías para invocar tu vehículo antes.',
    rarity: 'Épico',
    costCoins: 5900,
    costGems: 68,
    speedBonusPct: 5,
    jumpBonusPct: 0,
    shieldCooldownReductionPct: 5,
    abilityRechargeBonusPct: 8,
    vehicleChargeBonusPct: 22,
    coinBonusPct: 0,
    iconTag: 'VEH',
    accentColor: '#f97316',
  },
  {
    id: 'boost_credit_siphon',
    name: 'Sifón de Créditos +20%',
    description: 'Aumenta un +20% las monedas obtenidas en pista y +10% recarga de habilidad.',
    rarity: 'Épico',
    costCoins: 6400,
    costGems: 75,
    speedBonusPct: 0,
    jumpBonusPct: 5,
    shieldCooldownReductionPct: 5,
    abilityRechargeBonusPct: 10,
    vehicleChargeBonusPct: 10,
    coinBonusPct: 20,
    iconTag: 'MON',
    accentColor: '#facc15',
  },
  {
    id: 'boost_omega_protocol',
    name: 'Chip Protocolo Skyline',
    description: 'Potenciador maestro: +8% velocidad, +8% salto, -15% cooldown escudo y +15% recarga de habilidad.',
    rarity: 'Legendario',
    costCoins: 11500,
    costGems: 145,
    speedBonusPct: 8,
    jumpBonusPct: 8,
    shieldCooldownReductionPct: 15,
    abilityRechargeBonusPct: 15,
    vehicleChargeBonusPct: 12,
    coinBonusPct: 10,
    iconTag: 'OME',
    accentColor: '#ec4899',
  },
];

export const PROFILE_AVATARS: ProfileAvatarDef[] = [
  {
    id: 'av_runner_core',
    name: 'Emblema Skyline Base',
    description: 'Insignia estándar de corredor de Metro Rush.',
    source: 'default',
    costCoins: 0,
    costGems: 0,
    rarity: 'Común',
    badgeGradient: 'linear-gradient(135deg, #0ea5e9, #1e293b)',
    accentColor: '#22d3ee',
    glyph: 'MR',
  },
  {
    id: 'av_neon_visage',
    name: 'Visor Fantasma Cian',
    description: 'Avatar holográfico inspirado en las azoteas de Downtown.',
    source: 'shop',
    costCoins: 1800,
    costGems: 0,
    rarity: 'Raro',
    badgeGradient: 'linear-gradient(135deg, #06b6d4, #6366f1)',
    accentColor: '#38bdf8',
    glyph: 'KF',
  },
  {
    id: 'av_cyber_fox',
    name: 'Fénix Cibernético',
    description: 'Reliquia visual de competición con halo neón.',
    source: 'shop',
    costCoins: 3200,
    costGems: 25,
    rarity: 'Épico',
    badgeGradient: 'linear-gradient(135deg, #f97316, #db2777)',
    accentColor: '#fb923c',
    glyph: 'NX',
  },
  {
    id: 'av_factory_gear',
    name: 'Núcleo La Creación',
    description: 'Sello metálico de ingeniero de la mega-fábrica.',
    source: 'shop',
    costCoins: 2900,
    costGems: 20,
    rarity: 'Épico',
    badgeGradient: 'linear-gradient(135deg, #d97706, #451a03)',
    accentColor: '#f59e0b',
    glyph: 'CR',
  },
  {
    id: 'av_ocean_crest',
    name: 'Ola Bioluminiscente',
    description: 'Distintivo oceánico de los muelles flotantes.',
    source: 'shop',
    costCoins: 4200,
    costGems: 35,
    rarity: 'Épico',
    badgeGradient: 'linear-gradient(135deg, #0d9488, #0f172a)',
    accentColor: '#2dd4bf',
    glyph: 'ND',
  },
  {
    id: 'av_skyline_crown',
    name: 'Corona Skyline 8.0',
    description: 'Avatar legendario reservado para veteranos de Neon City.',
    source: 'shop',
    costCoins: 6800,
    costGems: 85,
    rarity: 'Legendario',
    badgeGradient: 'linear-gradient(135deg, #eab308, #9f1239)',
    accentColor: '#fbbf24',
    glyph: 'SK',
  },
  {
    id: 'av_pass_v8_silver',
    name: 'Sello Protocolo Plata',
    description: 'Desbloqueable en el Pase de Corredor Skyline Protocol.',
    source: 'pass',
    costCoins: 0,
    costGems: 9999,
    rarity: 'Raro',
    badgeGradient: 'linear-gradient(135deg, #64748b, #0ea5e9)',
    accentColor: '#7dd3fc',
    glyph: 'SP',
  },
  {
    id: 'av_pass_v8_omega',
    name: 'Reactor Omega Dorado',
    description: 'Avatar exclusivo de niveles avanzados del Pase de Corredor.',
    source: 'pass',
    costCoins: 0,
    costGems: 9999,
    rarity: 'Legendario',
    badgeGradient: 'linear-gradient(135deg, #f43f5e, #fbbf24)',
    accentColor: '#fb7185',
    glyph: 'OM',
  },
  {
    id: 'av_mission_rookie',
    name: 'As del Circuito',
    description: 'Recompensa por completar misiones semanales del Protocolo Skyline.',
    source: 'mission',
    costCoins: 0,
    costGems: 9999,
    rarity: 'Épico',
    badgeGradient: 'linear-gradient(135deg, #10b981, #064e3b)',
    accentColor: '#34d399',
    glyph: 'MS',
  },
];

export const GEM_EXCHANGE_PACKS: GemExchangePack[] = [
  {
    id: 'gem_pack_small',
    name: 'Cambio Estándar (40 G → 800 M)',
    costGems: 40,
    grantCoins: 800,
    bonusLabel: 'Tasa 1 G = 20 M',
  },
  {
    id: 'gem_pack_medium',
    name: 'Lingote Corporativo (120 G → 2.600 M)',
    costGems: 120,
    grantCoins: 2600,
    bonusLabel: 'Tasa 1 G ≈ 21.6 M',
  },
  {
    id: 'gem_pack_vault',
    name: 'Bóveda Skyline (300 G → 7.000 M)',
    costGems: 300,
    grantCoins: 7000,
    bonusLabel: 'Tasa 1 G ≈ 23.3 M',
  },
];

export const LIVE_EVENTS: LiveEventDef[] = [
  {
    id: 'evt_neon_overdrive',
    title: 'Operación Apagón Neón',
    subtitle: 'Evento Especial · Neon Downtown',
    description: 'Asalto contra TITAN DRONE con gemas x2 al superar los 1.400m.',
    districtId: 'downtown',
    mode: 'bosschase',
    bossId: 'titan_drone',
    modifierTag: 'Jefe 2 Fases · Gemas x2',
    rewardCoins: 1800,
    rewardGems: 26,
    targetDistance: 1400,
    gravityScale: 1.0,
    droneIntensity: 1.35,
    gemMultiplier: 2,
  },
  {
    id: 'evt_creation_assembly',
    title: 'Sabotaje en La Creación',
    subtitle: 'Evento Fábrica · La Creación',
    description: 'Sobrevive dentro de la mega-fábrica enfrentando a IRON HUNTER en líneas automatizadas.',
    districtId: 'the_creation',
    mode: 'bosschase',
    bossId: 'iron_hunter',
    modifierTag: 'Fábrica Cerrada · Gemas x2',
    rewardCoins: 2400,
    rewardGems: 35,
    targetDistance: 1550,
    gravityScale: 1.0,
    droneIntensity: 1.3,
    gemMultiplier: 2,
  },
  {
    id: 'evt_skyfall_parkour',
    title: 'Tormenta en Cuidado si te caes',
    subtitle: 'Desafío Parkour · Rascacielos',
    description: 'Circuito de azoteas reales y abismos letales bajo lluvia eléctrica.',
    districtId: 'skyfall_towers',
    mode: 'parkour',
    modifierTag: 'Parkour Techo · Sin Vehículos',
    rewardCoins: 2200,
    rewardGems: 32,
    targetDistance: 1450,
    gravityScale: 0.9,
    droneIntensity: 1.2,
    gemMultiplier: 1.5,
  },
  {
    id: 'evt_ocean_omega',
    title: 'Marea Omega',
    subtitle: 'Evento Supremo · No te ahogues',
    description: 'Combate extremo sobre océano frente a OMEGA CORE con escudo regenerativo.',
    districtId: 'dont_drown',
    mode: 'bosschase',
    bossId: 'omega_core',
    modifierTag: 'Escudo Regenerativo · OMEGA CORE',
    rewardCoins: 4600,
    rewardGems: 68,
    targetDistance: 1850,
    gravityScale: 0.94,
    droneIntensity: 1.45,
    gemMultiplier: 2.5,
  },
];

export const COSMETICS: CosmeticItem[] = [
  { id: 'jacket_default', slot: 'jacket', name: 'Chaqueta Estándar', description: 'Tejido técnico urbano del corredor.', color: '#f97316', costCoins: 0, costGems: 0, rarity: 'Común' },
  { id: 'jacket_cybercyan', slot: 'jacket', name: 'Cazadora Ion Cian', description: 'Fibra conductiva con ribetes electroluminiscentes.', color: '#06b6d4', costCoins: 1800, costGems: 0, rarity: 'Raro' },
  { id: 'jacket_crimson', slot: 'jacket', name: 'Armadura Carmesí', description: 'Placas balísticas ligeras de competición.', color: '#e11d48', costCoins: 3400, costGems: 24, rarity: 'Épico' },
  { id: 'jacket_gold', slot: 'jacket', name: 'Edición Imperial Oro', description: 'Acabado metálico exclusivo del Future District.', color: '#eab308', costCoins: 6200, costGems: 55, rarity: 'Legendario' },
  { id: 'jacket_obsidian', slot: 'jacket', name: 'Sigilo Obsidiana', description: 'Polímero mate antirreflejo táctico.', color: '#0f172a', costCoins: 4200, costGems: 30, rarity: 'Épico' },

  { id: 'visor_default', slot: 'visor', name: 'Visor Táctico Base', description: 'Lentes polarizadas con telemetría básica.', color: '#22d3ee', costCoins: 0, costGems: 0, rarity: 'Común' },
  { id: 'visor_magenta', slot: 'visor', name: 'Gafas Pulse Neon', description: 'Lente panorámica con filtro de contraste nocturno.', color: '#ec4899', costCoins: 1400, costGems: 0, rarity: 'Raro' },
  { id: 'visor_emerald', slot: 'visor', name: 'Óptica Bio-Scanner', description: 'Visor espectral de contraste esmeralda.', color: '#10b981', costCoins: 2800, costGems: 18, rarity: 'Épico' },
  { id: 'visor_solar', slot: 'visor', name: 'Corona Solar', description: 'Cristal iridiscente de grado orbital.', color: '#facc15', costCoins: 5200, costGems: 42, rarity: 'Legendario' },

  { id: 'sneakers_default', slot: 'sneakers', name: 'Zapatillas Street', description: 'Suela de goma de alta tracción urbana.', color: '#fb923c', costCoins: 0, costGems: 0, rarity: 'Común' },
  { id: 'sneakers_mag', slot: 'sneakers', name: 'Botas Magnéticas X2', description: 'Suela electromagnética con iluminación inferior.', color: '#38bdf8', costCoins: 1900, costGems: 0, rarity: 'Raro' },
  { id: 'sneakers_plasma', slot: 'sneakers', name: 'Impulsoras Plasma', description: 'Amortiguación neumática de alto retorno.', color: '#c084fc', costCoins: 3600, costGems: 26, rarity: 'Épico' },
  { id: 'sneakers_hyper', slot: 'sneakers', name: 'Aero-Turbina Pro', description: 'Calzado prototipo con suela dorada.', color: '#facc15', costCoins: 5600, costGems: 46, rarity: 'Legendario' },

  { id: 'backpack_none', slot: 'backpack', name: 'Sin Mochila', description: 'Perfil aerodinámico minimalista.', color: '#334155', costCoins: 0, costGems: 0, rarity: 'Común' },
  { id: 'backpack_thruster', slot: 'backpack', name: 'Mochila Jet Compacta', description: 'Micro-propulsores estabilizadores dobles.', color: '#0ea5e9', costCoins: 2400, costGems: 14, rarity: 'Raro' },
  { id: 'backpack_wings', slot: 'backpack', name: 'Alas Vectoriales', description: 'Alerones plegables de fibra de carbono y neón.', color: '#ec4899', costCoins: 4600, costGems: 36, rarity: 'Épico' },
  { id: 'backpack_halo', slot: 'backpack', name: 'Reactor Cuántico', description: 'Anillo gravitacional flotante a la espalda.', color: '#a855f7', costCoins: 7400, costGems: 64, rarity: 'Legendario' },

  { id: 'hair_default', slot: 'hair', name: 'Estilo Base', description: 'Apariencia original del personaje.', color: '#18181b', styleVariant: 'default', costCoins: 0, costGems: 0, rarity: 'Común' },
  { id: 'hair_cyan', slot: 'hair', name: 'Tinte Ion Eléctrico', description: 'Reflejos cian reactivos a la velocidad.', color: '#22d3ee', styleVariant: 'spiky', costCoins: 1600, costGems: 0, rarity: 'Raro' },
  { id: 'hair_cyberhelm', slot: 'hair', name: 'Casco Integral Aero', description: 'Casco futurista aerodinámico con ventilación.', color: '#f8fafc', styleVariant: 'cyberhelm', costCoins: 4200, costGems: 32, rarity: 'Épico' },
  { id: 'hair_crimson', slot: 'hair', name: 'Cresta Carmesí', description: 'Estilo rebelde de alto voltaje.', color: '#f43f5e', styleVariant: 'mohawk', costCoins: 3000, costGems: 22, rarity: 'Épico' },

  { id: 'trail_cyan', slot: 'trail', name: 'Estela Ion Cian', description: 'Chispas digitales limpias de color azul eléctrico.', color: '#22d3ee', costCoins: 0, costGems: 0, rarity: 'Común' },
  { id: 'trail_solar', slot: 'trail', name: 'Llamarada Solar', description: 'Estela ardiente naranja y dorada al acelerar.', color: '#f97316', costCoins: 2200, costGems: 0, rarity: 'Raro' },
  { id: 'trail_plasma', slot: 'trail', name: 'Estela Plasma Violeta', description: 'Ondas energéticas de espectro púrpura.', color: '#d946ef', costCoins: 3900, costGems: 28, rarity: 'Épico' },
  { id: 'trail_emerald', slot: 'trail', name: 'Código Matrix Verde', description: 'Flujo de datos bioluminiscentes.', color: '#10b981', costCoins: 3400, costGems: 24, rarity: 'Épico' },
  { id: 'trail_gold', slot: 'trail', name: 'Polvo Estelar Dorado', description: 'Partículas brillantes de campeón.', color: '#facc15', costCoins: 6400, costGems: 54, rarity: 'Legendario' },
];

export const SKILL_TREE: SkillNode[] = [
  {
    id: 'momentum_mastery',
    name: 'Inercia Cinética',
    description: 'Aumenta la velocidad máxima y la conservación de Momentum tras saltos y deslizamientos.',
    maxLevel: 5,
    baseCost: 350,
    ticketCostPerLevel: 1,
    effectPerLevel: '+5% velocidad tope y +12% ganancia de Momentum',
  },
  {
    id: 'aerial_thrusters',
    name: 'Propulsión Aérea',
    description: 'Mejora la altura del doble salto y extiende la duración del Wall-Run.',
    maxLevel: 5,
    baseCost: 380,
    ticketCostPerLevel: 1,
    effectPerLevel: '+4% altura de salto y +0.3s de Wall-Run',
  },
  {
    id: 'chrono_capacitor',
    name: 'Condensador Temporal',
    description: 'Amplía la capacidad energética del Slow Motion y acelera su recarga.',
    maxLevel: 5,
    baseCost: 420,
    ticketCostPerLevel: 1,
    effectPerLevel: '+15% duración de Slow-Mo y +10% recarga',
  },
  {
    id: 'mag_collector',
    name: 'Atracción Magnética',
    description: 'Incrementa el radio pasivo de recogida de monedas y la duración de los imanes.',
    maxLevel: 5,
    baseCost: 320,
    ticketCostPerLevel: 1,
    effectPerLevel: '+0.6m radio pasivo y +1.5s duración de Imán',
  },
  {
    id: 'combo_multiplier',
    name: 'Flujo Acrobático',
    description: 'Extiende la ventana de tiempo para encadenar combos de parkour sin perder multiplicador.',
    maxLevel: 5,
    baseCost: 380,
    ticketCostPerLevel: 1,
    effectPerLevel: '+0.8s ventana de combo y +8% puntuación bonus',
  },
  {
    id: 'shield_matrix',
    name: 'Matriz Defensiva',
    description: 'Reduce el tiempo de reutilización del escudo tras su ruptura y mejora el radio de onda expansiva.',
    maxLevel: 5,
    baseCost: 450,
    ticketCostPerLevel: 1,
    effectPerLevel: '-1.0s enfriamiento de escudo y +1.1m radio de explosión',
  },
];

export const VEHICLES: VehicleDef[] = [
  {
    id: 'hover_bike',
    name: 'Valkyrie VX-01',
    category: 'Moto Repulsora (Terrestre)',
    description: 'Motocicleta antigravedad ágil diseñada para zigzags rápidos entre vagones y tráfico. Doble salto bloqueado en motos.',
    isShip: false,
    unlockCostCoins: 0,
    unlockCostGems: 0,
    defaultPaint: '#22d3ee',
    accentColor: '#38bdf8',
    baseStats: { speed: 7, handling: 9, shield: 6, boostDuration: 7.5 },
    maxUpgradeLevel: 5,
  },
  {
    id: 'cyber_coupe',
    name: 'Interceptor K-9',
    category: 'Coupé Supersónico (Terrestre)',
    description: 'Vehículo deportivo real de alta adherencia con cuatro turbinas de plasma capaz de pulverizar drones en línea recta.',
    isShip: false,
    unlockCostCoins: 7800,
    unlockCostGems: 85,
    unlockRequirement: {
      type: 'missions',
      target: 3,
      label: 'Completa 3 misiones',
    },
    defaultPaint: '#ec4899',
    accentColor: '#facc15',
    baseStats: { speed: 10, handling: 7, shield: 8, boostDuration: 8.5 },
    maxUpgradeLevel: 5,
  },
  {
    id: 'quantum_glider',
    name: 'Aero-Glider Q7',
    category: 'Nave Planeadora Aérea (Vuelo Alto)',
    description: 'Despega hacia el carril aéreo superior sobre la ciudad sorteando amenazas de altura y descendiendo al agotar su energía.',
    isShip: true,
    unlockCostCoins: 11200,
    unlockCostGems: 130,
    unlockRequirement: {
      type: 'distance',
      target: 8000,
      label: 'Recorre 8.000m acumulados',
    },
    defaultPaint: '#a855f7',
    accentColor: '#22d3ee',
    baseStats: { speed: 8, handling: 10, shield: 7, boostDuration: 10.0 },
    maxUpgradeLevel: 5,
  },
  {
    id: 'titan_rammer',
    name: 'Titan Rammer MK-IV',
    category: 'Ariete Blindado (Terrestre)',
    description: 'Blindaje pesado con pala frontal de energía que atraviesa bloqueos manteniendo máxima estabilidad.',
    isShip: false,
    unlockCostCoins: 14800,
    unlockCostGems: 170,
    unlockRequirement: {
      type: 'bosses',
      target: 2,
      label: 'Derrota a 2 Jefes',
    },
    defaultPaint: '#f97316',
    accentColor: '#fde047',
    baseStats: { speed: 8, handling: 6, shield: 10, boostDuration: 11.0 },
    maxUpgradeLevel: 5,
  },
  {
    id: 'star_viper',
    name: 'Star Viper S-12',
    category: 'Nave Caza Supersónica (Vuelo Alto)',
    description: 'Caza aeroespacial que se eleva al corredor aéreo superior con propulsión lateral y doble salto en altitud.',
    isShip: true,
    unlockCostCoins: 19500,
    unlockCostGems: 240,
    unlockRequirement: {
      type: 'bosses',
      target: 4,
      label: 'Derrota a 4 Jefes',
    },
    defaultPaint: '#38bdf8',
    accentColor: '#f43f5e',
    baseStats: { speed: 11, handling: 10, shield: 8, boostDuration: 10.5 },
    maxUpgradeLevel: 5,
  },
  {
    id: 'plasma_bomber',
    name: 'Nova Detonator X-25',
    category: 'Blindado Explosivo (Nivel 25 Pase)',
    description: 'Vehículo exclusivo del Nivel 25 del Pase de Corredor. Libera detonaciones de plasma al desplegarse y pulveriza obstáculos destructibles al impacto.',
    isShip: false,
    unlockCostCoins: 0,
    unlockCostGems: 9999,
    defaultPaint: '#f43f5e',
    accentColor: '#fbbf24',
    baseStats: { speed: 10, handling: 8, shield: 12, boostDuration: 11.5 },
    maxUpgradeLevel: 5,
  },
];

export const SPECIAL_SHOP_ITEMS: SpecialShopItem[] = [
  {
    id: 'revive_token_1',
    name: 'Token de Revivir (x1)',
    description: 'Permite continuar una carrera exacta (incluidos Jefes y Fases) tras un choque.',
    category: 'revive',
    costCoins: 1200,
    costGems: 0,
    grantReviveTokens: 1,
    rarity: 'Raro',
  },
  {
    id: 'revive_token_3',
    name: 'Lote Táctico Revivir (x3)',
    description: 'Reserva de 3 Tokens de Revivir para afrontar asaltos de jefes y récords de larga distancia.',
    category: 'revive',
    costCoins: 3200,
    costGems: 0,
    grantReviveTokens: 3,
    rarity: 'Épico',
  },
  {
    id: 'talisman_1',
    name: 'Talismán de Autorrevivir',
    description: 'Reliquia rara automática: al recibir un golpe letal te revive al instante con onda expansiva y escudo.',
    category: 'talisman',
    costCoins: 3800,
    costGems: 28,
    grantTalismans: 1,
    rarity: 'Legendario',
  },
  {
    id: 'ticket_pack_3',
    name: 'Pack 3 Tiques de Mejora',
    description: 'Tiques técnicos para mejorar vehículos del Garaje 3D y habilidades del árbol sin gastar monedas.',
    category: 'tickets',
    costCoins: 1400,
    costGems: 0,
    grantTickets: 3,
    rarity: 'Raro',
  },
  {
    id: 'ticket_pack_10',
    name: 'Maletín 10 Tiques Pro',
    description: 'Lote de ingeniería avanzada con 10 Tiques de Mejora para llevar vehículos y habilidades al máximo.',
    category: 'tickets',
    costCoins: 4200,
    costGems: 24,
    grantTickets: 10,
    rarity: 'Legendario',
  },
  {
    id: 'shield_charge_pack',
    name: 'Kit Supervivencia Urbana',
    description: 'Incluye 2 Tokens de Revivir + 2 Tiques de Mejora listos para cualquier distrito.',
    category: 'booster',
    costCoins: 3100,
    costGems: 0,
    grantReviveTokens: 2,
    grantTickets: 2,
    rarity: 'Épico',
  },
];

// Pase de Corredor 8.0 SKYLINE PROTOCOL: SOLO Moneda G (Gemas) — 50 niveles
export const BATTLE_PASS_PREMIUM_COST_COINS = 0;
export const BATTLE_PASS_PREMIUM_COST_GEMS = 280;
export const BATTLE_PASS_XP_PER_TIER = 700;
export const BATTLE_PASS_MAX_TIER = 50;

export function getBattlePassXpForTier(tier: number): number {
  const safeTier = Math.max(1, Math.min(BATTLE_PASS_MAX_TIER, Math.floor(tier)));
  return 580 + (safeTier - 1) * 70;
}

export const BATTLE_PASS_TIERS: BattlePassTierDef[] = Array.from(
  { length: BATTLE_PASS_MAX_TIER },
  (_, idx) => {
    const tier = idx + 1;
    const xpRequired = getBattlePassXpForTier(tier);

    const freeReward: BattlePassTierDef['freeReward'] =
      tier === 50
        ? { type: 'gems', amount: 35, label: '35 Gemas + Sello Skyline 8.0' }
        : tier === 25
          ? { type: 'talismans', amount: 2, label: '2 Talismanes Skyline' }
          : tier === 12
            ? { type: 'avatar', itemId: 'av_pass_v8_silver', label: 'Avatar Sello Protocolo Plata' }
            : tier === 10 || tier === 30 || tier === 40
              ? { type: 'reviveTokens', amount: 2, label: '2 Tokens Revivir' }
              : tier % 5 === 0
                ? { type: 'reviveTokens', amount: 1, label: '1 Token Revivir' }
                : tier % 4 === 0
                  ? { type: 'tickets', amount: 2, label: '2 Tiques Mejora' }
                  : tier === 7 || tier === 37 || tier === 47
                    ? { type: 'talismans', amount: 1, label: '1 Talismán' }
                    : tier % 8 === 4
                      ? { type: 'gems', amount: 4 + Math.floor(tier / 15), label: `${4 + Math.floor(tier / 15)} Gemas` }
                      : {
                          type: 'coins',
                          amount: 260 + tier * 24,
                          label: `${260 + tier * 24} Monedas`,
                        };

    const premiumReward: BattlePassTierDef['premiumReward'] =
      tier === 5
        ? { type: 'cosmetic', itemId: 'visor_emerald', label: 'Óptica Bio-Scanner' }
        : tier === 10
          ? { type: 'booster', itemId: 'boost_aero_spring', label: 'Potenciador Propulsores de Salto +12%' }
          : tier === 15
            ? { type: 'vehicle', itemId: 'quantum_glider', label: 'Nave Aero-Glider Q7' }
            : tier === 20
              ? { type: 'drone', itemId: 'drone_emp_hunter', label: 'Dron Acompañante Cazador EMP V-4' }
              : tier === 25
                ? {
                    type: 'vehicle',
                    itemId: 'plasma_bomber',
                    label: 'Nova Detonator X-25 (Vehículo Explosivo)',
                  }
                : tier === 30
                  ? { type: 'cosmetic', itemId: 'jacket_crimson', label: 'Armadura Carmesí' }
                  : tier === 35
                    ? { type: 'vehicle', itemId: 'star_viper', label: 'Nave Star Viper S-12' }
                    : tier === 40
                      ? { type: 'avatar', itemId: 'av_pass_v8_omega', label: 'Avatar Reactor Omega Dorado' }
                      : tier === 45
                        ? {
                            type: 'cosmetic',
                            itemId: 'backpack_halo',
                            label: 'Reactor Cuántico + 2 Talismanes',
                            amount: 2,
                          }
                        : tier === 50
                          ? {
                              type: 'character',
                              itemId: 'valkor',
                              label: 'VALKOR · Soberano Overdrive (Personaje Exclusivo)',
                            }
                          : tier % 5 === 2
                            ? { type: 'talismans', amount: 1, label: '1 Talismán' }
                            : tier % 2 === 1
                              ? { type: 'tickets', amount: 2 + Math.floor(tier / 12), label: `${2 + Math.floor(tier / 12)} Tiques Mejora` }
                              : { type: 'gems', amount: 6 + Math.floor(tier / 4), label: `${6 + Math.floor(tier / 4)} Gemas` };

    return {
      tier,
      xpRequired,
      freeReward,
      premiumReward,
    };
  },
);

export const STORY_CHAPTERS: StoryChapterDef[] = [
  {
    chapter: 1,
    title: 'Capítulo 1: Señal en Downtown',
    districtId: 'downtown',
    targetDistance: 950,
    objectiveType: 'distance',
    objectiveTarget: 950,
    objectiveLabel: 'Próxima Gran Actualización · Modo Historia en reconstrucción completa',
    briefing: 'Modo Historia bloqueado temporalmente para su reconstrucción completa en la siguiente gran actualización.',
    pursuerAggressive: false,
    rewardCoins: 750,
    rewardGems: 14,
    rewardTickets: 2,
    dialogueBeats: [],
  },
];

// --- 6-WEEK PROCEDURAL DAILY & CUMULATIVE WEEKLY MISSIONS ---
const DAILY_ARCHETYPES: Array<{
  type: MissionDef['type'];
  title: string;
  desc: (target: number) => string;
  baseTarget: number;
  stepTarget: number;
  difficulty: MissionDef['difficulty'];
}> = [
  { type: 'distance', title: 'Travesía Diaria', desc: (t) => `Recorre ${t.toLocaleString('es-ES')}m acumulados en cualquier distrito.`, baseTarget: 1800, stepTarget: 180, difficulty: 'Fácil' },
  { type: 'coins', title: 'Cosecha de Créditos', desc: (t) => `Recoge ${t} monedas en pista sin depender del banco.`, baseTarget: 140, stepTarget: 12, difficulty: 'Fácil' },
  { type: 'doubleJump', title: 'Salto Acrobático', desc: (t) => `Ejecuta ${t} dobles saltos limpios en el aire.`, baseTarget: 14, stepTarget: 2, difficulty: 'Media' },
  { type: 'obstacles', title: 'Evasión Precisa', desc: (t: number) => `Supera ${t} obstáculos y trampas sin colisionar.`, baseTarget: 35, stepTarget: 4, difficulty: 'Media' } as unknown as never,
  { type: 'ability', title: 'Pulso de Habilidad', desc: (t) => `Activa ${t} veces la habilidad especial de tu corredor.`, baseTarget: 8, stepTarget: 1, difficulty: 'Media' },
  { type: 'wallrun', title: 'Corredor de Muros', desc: (t) => `Completa ${t} Wall-Runs luminosos.`, baseTarget: 10, stepTarget: 1, difficulty: 'Media' },
  { type: 'enemies', title: 'Barrido Antidrones', desc: (t) => `Esquiva o neutraliza ${t} drones y robots hostiles.`, baseTarget: 24, stepTarget: 3, difficulty: 'Media' },
  { type: 'shieldBreak', title: 'Ruptura Táctica', desc: (t) => `Detona ${t} ondas expansivas rompiendo tu escudo.`, baseTarget: 4, stepTarget: 1, difficulty: 'Alta' },
  { type: 'vehicle', title: 'Piloto de Asalto', desc: (t) => `Activa o secuestra ${t} vehículos durante tus carreras.`, baseTarget: 3, stepTarget: 1, difficulty: 'Media' },
  { type: 'zipline', title: 'Cables de Altura', desc: (t) => `Engánchate a ${t} tirolinas o cables aéreos.`, baseTarget: 6, stepTarget: 1, difficulty: 'Media' },
];

export const DAILY_MISSIONS_POOL_42: MissionDef[] = Array.from({ length: 42 }, (_, dayIdx) => {
  const week = Math.floor(dayIdx / 7) + 1;
  const a1 = DAILY_ARCHETYPES[dayIdx % DAILY_ARCHETYPES.length];
  const validType: MissionDef['type'] = (a1.type as string) === 'obstacles' ? 'survivalTime' : a1.type;
  const title = (a1.type as string) === 'obstacles' ? 'Resistencia en Pista' : a1.title;
  const target = validType === 'survivalTime' ? 120 + week * 20 : a1.baseTarget + (dayIdx % 6) * a1.stepTarget;
  const description =
    validType === 'survivalTime'
      ? `Sobrevive ${target} segundos en carrera activa hoy.`
      : a1.desc(target);

  return {
    id: `daily_d${dayIdx + 1}`,
    title: `${title} · Día ${dayIdx + 1}`,
    description,
    type: validType,
    target,
    rewardCoins: 380 + week * 60,
    rewardGems: 5 + Math.floor(week / 2),
    rewardXp: 240 + week * 35,
    rewardTickets: dayIdx % 2 === 0 ? 1 : 0,
    rewardReviveTokens: dayIdx % 5 === 4 ? 1 : 0,
    rewardBpXp: 280 + week * 25,
    difficulty: a1.difficulty,
    category: 'daily',
  };
});

export const WEEKLY_MISSIONS_6_WEEKS: MissionDef[] = [
  // Semana 1
  { id: 'weekly_w1_dist', title: 'Semana 1 · Horizonte Skyline', description: 'Acumula 8.500m recorridos en cualquier modo.', type: 'distance', target: 8500, rewardCoins: 1450, rewardGems: 18, rewardXp: 850, rewardTickets: 2, rewardBpXp: 600, difficulty: 'Media', category: 'weekly', chapter: 1 },
  { id: 'weekly_w1_boss', title: 'Semana 1 · Caza de Centinelas', description: 'Supera 4 fases completas de Jefes de ciudad.', type: 'bossPhase', target: 4, rewardCoins: 1600, rewardGems: 22, rewardXp: 920, rewardTickets: 2, rewardBpXp: 650, difficulty: 'Alta', category: 'weekly', chapter: 1 },
  // Semana 2
  { id: 'weekly_w2_parkour', title: 'Semana 2 · Techo Sobre Techo', description: 'Completa 12 cadenas en azoteas / 2ª planta.', type: 'parkourChain', target: 12, rewardCoins: 1650, rewardGems: 24, rewardXp: 980, rewardTickets: 2, rewardReviveTokens: 1, rewardBpXp: 700, difficulty: 'Alta', category: 'weekly', chapter: 2 },
  { id: 'weekly_w2_enemies', title: 'Semana 2 · Limpieza de Pista', description: 'Evade o elimina 90 drones y unidades de seguridad.', type: 'enemies', target: 90, rewardCoins: 1700, rewardGems: 24, rewardXp: 1000, rewardTickets: 2, rewardBpXp: 700, difficulty: 'Media', category: 'weekly', chapter: 2 },
  // Semana 3
  { id: 'weekly_w3_skyfall', title: 'Semana 3 · Cuidado si te caes', description: 'Recorre 4.500m en el nuevo distrito de rascacielos.', type: 'distance', target: 4500, districtReq: 'skyfall_towers', rewardCoins: 1850, rewardGems: 28, rewardXp: 1100, rewardTickets: 3, rewardBpXp: 750, difficulty: 'Alta', category: 'weekly', chapter: 3 },
  { id: 'weekly_w3_five_lane', title: 'Semana 3 · Evento 5 Carriles', description: 'Recorre 3.000m en tramos de evento Autopista de 5 Carriles.', type: 'fiveLaneDist', target: 3000, rewardCoins: 1900, rewardGems: 28, rewardXp: 1150, rewardTickets: 3, rewardBpXp: 780, difficulty: 'Alta', category: 'weekly', chapter: 3 },
  // Semana 4
  { id: 'weekly_w4_creation', title: 'Semana 4 · Corazón de La Creación', description: 'Recorre 5.000m dentro de la mega-fábrica La Creación.', type: 'distance', target: 5000, districtReq: 'the_creation', rewardCoins: 2100, rewardGems: 32, rewardXp: 1250, rewardTickets: 3, rewardTalismans: 1, rewardBpXp: 820, difficulty: 'Alta', category: 'weekly', chapter: 4 },
  { id: 'weekly_w4_shield', title: 'Semana 4 · Onda de Escudo', description: 'Activa la destrucción en cadena por escudo 10 veces.', type: 'shieldBreak', target: 10, rewardCoins: 1950, rewardGems: 30, rewardXp: 1200, rewardTickets: 3, rewardBpXp: 800, difficulty: 'Alta', category: 'weekly', chapter: 4 },
  // Semana 5
  { id: 'weekly_w5_ocean', title: 'Semana 5 · Supervivencia Marítima', description: 'Recorre 5.500m en el distrito oceánico No te ahogues.', type: 'distance', target: 5500, districtReq: 'dont_drown', rewardCoins: 2300, rewardGems: 36, rewardXp: 1400, rewardTickets: 4, rewardBpXp: 900, difficulty: 'Alta', category: 'weekly', chapter: 5 },
  { id: 'weekly_w5_bosses', title: 'Semana 5 · Azote de Titanes', description: 'Derrota 3 Jefes completos de Neon City.', type: 'boss', target: 3, rewardCoins: 2600, rewardGems: 42, rewardXp: 1600, rewardTickets: 4, rewardTalismans: 1, rewardBpXp: 980, difficulty: 'Extrema', category: 'weekly', chapter: 5 },
  // Semana 6
  { id: 'weekly_w6_endurance', title: 'Semana 6 · Veterano de Skyline', description: 'Acumula 900 segundos de carrera activa durante la temporada.', type: 'survivalTime', target: 900, rewardCoins: 2800, rewardGems: 45, rewardXp: 1750, rewardTickets: 5, rewardBpXp: 1100, difficulty: 'Extrema', category: 'weekly', chapter: 6 },
  { id: 'weekly_w6_norevive', title: 'Semana 6 · Victoria Impecable', description: 'Logra 2 victorias limpias sin gastar Tokens ni Talismanes.', type: 'noReviveWin', target: 2, rewardCoins: 3000, rewardGems: 50, rewardXp: 1900, rewardTickets: 5, rewardTalismans: 1, unlockContentLabel: 'Avatar As del Circuito', rewardBpXp: 1200, difficulty: 'Extrema', category: 'weekly', chapter: 6 },
];

export const CORE_MISSIONS: MissionDef[] = [
  // Especiales
  { id: 'spec_slowmo', title: 'Maestro del Tiempo', description: 'Activa el Slow-Motion táctico a pie 18 veces en carrera.', type: 'slowmo', target: 18, rewardCoins: 1050, rewardGems: 16, rewardXp: 580, rewardTickets: 2, rewardBpXp: 420, difficulty: 'Media', category: 'special' },
  { id: 'spec_ability', title: 'Sobrecarga de Corredor', description: 'Desata 15 veces tu Habilidad Especial de personaje.', type: 'ability', target: 15, rewardCoins: 1150, rewardGems: 18, rewardXp: 620, rewardReviveTokens: 1, rewardBpXp: 450, difficulty: 'Media', category: 'special' },

  // Temporada 8.0
  { id: 'season_combo_12', title: 'Leyenda Skyline 8.0', description: 'Alcanza un combo x12 en una sola carrera.', type: 'combos', target: 12, rewardCoins: 2400, rewardGems: 38, rewardXp: 1500, rewardTickets: 4, rewardTalismans: 1, rewardBpXp: 1200, difficulty: 'Extrema', category: 'season' },
  { id: 'season_dist_18k', title: 'Maratón Protocolo Skyline', description: 'Acumula 18.000 metros totales durante la Temporada 8.0.', type: 'distance', target: 18000, rewardCoins: 2600, rewardGems: 40, rewardXp: 1650, rewardTickets: 4, rewardBpXp: 1350, difficulty: 'Alta', category: 'season' },

  // Combate / Exploración / Supervivencia / Personajes / Vehículos / Jefes
  { id: 'combat_shield_break', title: 'Onda Expansiva', description: 'Activa la destrucción en cadena por ruptura de escudo 6 veces.', type: 'shieldBreak', target: 6, rewardCoins: 1350, rewardGems: 22, rewardXp: 720, rewardTickets: 2, rewardBpXp: 520, difficulty: 'Media', category: 'combat' },
  { id: 'combat_enemies', title: 'Neutralización Táctica', description: 'Evade o destruye un total de 60 drones y robots de seguridad.', type: 'enemies', target: 60, rewardCoins: 1250, rewardGems: 18, rewardXp: 700, rewardTickets: 2, rewardBpXp: 480, difficulty: 'Media', category: 'combat' },
  { id: 'explore_secrets', title: 'Archivista de Datos', description: 'Descubre 6 Cubos de Datos secretos escondidos por los distritos.', type: 'secrets', target: 6, rewardCoins: 1400, rewardGems: 22, rewardXp: 780, rewardReviveTokens: 1, rewardBpXp: 520, difficulty: 'Alta', category: 'exploration' },
  { id: 'explore_parkour_chains', title: 'Arquitecto de Azoteas', description: 'Completa 10 cadenas de Parkour en tejados reales de 2ª planta.', type: 'parkourChain', target: 10, rewardCoins: 1650, rewardGems: 24, rewardXp: 880, rewardTickets: 3, rewardBpXp: 600, unlockContentLabel: 'Acelera desbloqueo de Mika / Kage', difficulty: 'Alta', category: 'exploration' },
  { id: 'survival_wallrun', title: 'Desafiando la Vertical', description: 'Completa 18 Wall-Runs en paredes magnéticas luminosas.', type: 'wallrun', target: 18, rewardCoins: 980, rewardGems: 14, rewardXp: 540, rewardTickets: 2, rewardBpXp: 420, difficulty: 'Media', category: 'survival' },
  { id: 'char_kai_run', title: 'Espectro de Downtown (Kai)', description: 'Recorre 3.000m jugando con KAI.', type: 'distance', target: 3000, characterReq: 'kai', rewardCoins: 1100, rewardGems: 16, rewardXp: 600, rewardTickets: 2, rewardBpXp: 450, difficulty: 'Media', category: 'character' },
  { id: 'char_nova_tech', title: 'Hackeo Maestro (Nova)', description: 'Usa 8 veces la habilidad Secuestro de Red jugando con NOVA.', type: 'ability', target: 8, characterReq: 'nova', rewardCoins: 1200, rewardGems: 18, rewardXp: 650, rewardTickets: 2, rewardBpXp: 480, difficulty: 'Media', category: 'character' },
  { id: 'veh_hijack_8', title: 'Piloto Clandestino', description: 'Activa o pilota 8 vehículos o naves en Neon City.', type: 'vehicle', target: 8, rewardCoins: 1500, rewardGems: 22, rewardXp: 900, rewardTickets: 2, rewardBpXp: 560, difficulty: 'Media', category: 'vehicle' },
  { id: 'boss_phases_12', title: 'Rompe-Fases', description: 'Supera 12 fases completas de Jefes de ciudad.', type: 'bossPhase', target: 12, rewardCoins: 2400, rewardGems: 35, rewardXp: 1300, rewardTickets: 3, rewardBpXp: 820, difficulty: 'Alta', category: 'boss' },
  { id: 'boss_slayer_4', title: 'Azote de Titanes 8.0', description: 'Derrota a 4 Jefes completos.', type: 'boss', target: 4, rewardCoins: 3600, rewardGems: 55, rewardXp: 2000, rewardTickets: 5, rewardTalismans: 1, rewardBpXp: 1400, difficulty: 'Extrema', category: 'boss' },
];

export const MISSIONS: MissionDef[] = [
  ...DAILY_MISSIONS_POOL_42,
  ...WEEKLY_MISSIONS_6_WEEKS,
  ...CORE_MISSIONS,
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function getSeasonDayIndex(seasonStartAtMs?: number, nowMs = Date.now()): number {
  const start = seasonStartAtMs && seasonStartAtMs > 0 ? seasonStartAtMs : nowMs;
  const diffDays = Math.max(0, Math.floor((nowMs - start) / DAY_MS));
  return diffDays % 42; // 6 weeks = 42 days cycle
}

export function getSeasonWeekIndex(seasonStartAtMs?: number, nowMs = Date.now()): number {
  const day = getSeasonDayIndex(seasonStartAtMs, nowMs);
  return Math.min(5, Math.floor(day / 7)); // 0..5 (6 weeks)
}

/**
 * Returns today's 3 procedural daily missions (changes every day over 6 weeks / 42 days).
 */
export function getDailyMissionsForDayIndex(dayIndex: number): MissionDef[] {
  const safeIdx = ((Math.floor(dayIndex) % 42) + 42) % 42;
  const m1 = DAILY_MISSIONS_POOL_42[safeIdx];
  const m2 = DAILY_MISSIONS_POOL_42[(safeIdx + 14) % 42];
  const m3 = DAILY_MISSIONS_POOL_42[(safeIdx + 28) % 42];
  return [m1, m2, m3];
}

/**
 * Weekly missions ACCUMULATE across the 6 weeks instead of disappearing when a new week arrives!
 */
export function getCumulativeWeeklyMissionsForWeek(weekIndex: number): MissionDef[] {
  const maxWeekNum = Math.max(1, Math.min(6, Math.floor(weekIndex) + 1));
  return WEEKLY_MISSIONS_6_WEEKS.filter((m) => (m.chapter ?? 1) <= maxWeekNum);
}

export function getAllActiveMissions(seasonStartAtMs?: number, nowMs = Date.now()): MissionDef[] {
  const dayIdx = getSeasonDayIndex(seasonStartAtMs, nowMs);
  const weekIdx = getSeasonWeekIndex(seasonStartAtMs, nowMs);
  return [
    ...getDailyMissionsForDayIndex(dayIdx),
    ...getCumulativeWeeklyMissionsForWeek(weekIdx),
    ...CORE_MISSIONS,
  ];
}

export interface ShopRotationCatalog {
  weekNumber: number; // 1..6
  label: string;
  featuredCharacterIds: string[];
  featuredVehicleIds: VehicleId[];
  rotatingCosmeticIds: string[];
  permanentCosmeticIds: string[];
  featuredDroneIds: string[];
  featuredBoosterIds: string[];
  featuredAvatarIds: string[];
}

const WEEKLY_ROTATION_COSMETICS: string[][] = [
  ['jacket_cybercyan', 'visor_magenta', 'trail_solar', 'hair_cyan'],
  ['jacket_crimson', 'sneakers_mag', 'backpack_thruster', 'trail_emerald'],
  ['jacket_obsidian', 'visor_emerald', 'sneakers_plasma', 'hair_crimson'],
  ['jacket_gold', 'backpack_wings', 'trail_plasma', 'hair_cyberhelm'],
  ['visor_solar', 'sneakers_hyper', 'backpack_halo', 'trail_gold'],
  ['jacket_crimson', 'visor_solar', 'backpack_wings', 'trail_plasma'],
];

const PERMANENT_COSMETIC_IDS = [
  'jacket_default',
  'visor_default',
  'sneakers_default',
  'backpack_none',
  'hair_default',
  'trail_cyan',
  'jacket_cybercyan',
  'visor_magenta',
  'sneakers_mag',
  'backpack_thruster',
];

export function getWeeklyShopRotation(weekIndex: number): ShopRotationCatalog {
  const w = ((Math.floor(weekIndex) % 6) + 6) % 6;
  const charPools = [
    ['blaze', 'mika', 'cipher'],
    ['mika', 'valkyrie', 'zero'],
    ['blaze', 'cipher', 'kage'],
    ['valkyrie', 'zero', 'kage'],
    ['cipher', 'mika', 'valkyrie'],
    ['blaze', 'zero', 'kage'],
  ];
  const vehPools: VehicleId[][] = [
    ['cyber_coupe', 'quantum_glider'],
    ['quantum_glider', 'titan_rammer'],
    ['cyber_coupe', 'star_viper'],
    ['titan_rammer', 'star_viper'],
    ['cyber_coupe', 'quantum_glider', 'titan_rammer'],
    ['quantum_glider', 'star_viper'],
  ];
  const dronePools = [
    ['drone_aegis_mk1', 'drone_emp_hunter'],
    ['drone_aegis_mk1', 'drone_gold_harvester'],
    ['drone_emp_hunter', 'drone_sky_seraph'],
    ['drone_gold_harvester', 'drone_sky_seraph'],
    ['drone_aegis_mk1', 'drone_emp_hunter', 'drone_gold_harvester'],
    ['drone_emp_hunter', 'drone_gold_harvester', 'drone_sky_seraph'],
  ];

  return {
    weekNumber: w + 1,
    label: `Rotación Tienda Semana ${w + 1}/6`,
    featuredCharacterIds: charPools[w],
    featuredVehicleIds: vehPools[w],
    rotatingCosmeticIds: WEEKLY_ROTATION_COSMETICS[w],
    permanentCosmeticIds: PERMANENT_COSMETIC_IDS,
    featuredDroneIds: dronePools[w],
    featuredBoosterIds: CHARACTER_BOOSTERS.map((b) => b.id),
    featuredAvatarIds: PROFILE_AVATARS.filter((a) => a.source === 'shop').map((a) => a.id),
  };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_first_run', title: 'Primer Salto', description: 'Completa tu primera carrera en Neon City.', rewardGems: 5, conditionText: '1 partida jugada' },
  { id: 'ach_speed_demon', title: 'Rompe-Barreras', description: 'Alcanza los 155 KM/H en una carrera.', rewardGems: 12, conditionText: '155 KM/H velocidad máxima' },
  { id: 'ach_combo_master', title: 'Coreografía Letal', description: 'Consigue un multiplicador de combo x10 o superior.', rewardGems: 14, conditionText: 'Combo x10' },
  { id: 'ach_collector', title: 'Magnate Callejero', description: 'Acumula 3.000 monedas recogidas en total.', rewardGems: 16, conditionText: '3.000 monedas totales' },
  { id: 'ach_explorer', title: 'Explorador de Secretos', description: 'Encuentra 5 Cubos de Datos secretos ocultos en la ciudad.', rewardGems: 22, conditionText: '5 secretos encontrados' },
  { id: 'ach_skywalker', title: 'Señor de los Cables', description: 'Realiza 25 enganches de gancho o tirolina.', rewardGems: 15, conditionText: '25 ganchos/tirolinas' },
  { id: 'ach_shield_nova', title: 'Escudo Explosivo', description: 'Detona 10 ondas expansivas por ruptura de escudo.', rewardGems: 20, conditionText: '10 explosiones de escudo' },
  { id: 'ach_parkour_king', title: 'Rey de la 2ª Planta', description: 'Completa 15 cadenas en circuitos de Parkour Extremo.', rewardGems: 24, conditionText: '15 cadenas de parkour' },
  { id: 'ach_drone_dodger', title: 'Intocable', description: 'Evade 35 drones y robots de seguridad en tus carreras.', rewardGems: 20, conditionText: '35 enemigos evadidos' },
  { id: 'ach_boss_slayer', title: 'Destructor de Titanes', description: 'Derrota al menos a 3 jefes distintos de Neon City.', rewardGems: 40, conditionText: '3 jefes distintos derrotados' },
];

export const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [];

export function normalizeDistrictId(id: string): DistrictId {
  const map: Record<string, DistrictId> = {
    downtown: 'downtown',
    oldcity: 'oldcity',
    industrial: 'industrial',
    skyline: 'skyline',
    beach: 'beach',
    underground: 'underground',
    future: 'future',
    skyfall_towers: 'skyfall_towers',
    the_creation: 'the_creation',
    dont_drown: 'dont_drown',
    cyber_port: 'dont_drown',
    obsidian_citadel: 'the_creation',
    crimson_metropolis: 'skyfall_towers',
    luxury: 'future',
    forest: 'beach',
    skyport: 'dont_drown',
    zero: 'future',
  };
  return map[id] ?? 'downtown';
}

export function getDistrictById(id: DistrictId | string): DistrictDef {
  const norm = normalizeDistrictId(id);
  return DISTRICTS.find((d) => d.id === norm) ?? DISTRICTS[0];
}

export function getCharacterById(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function getBossById(id: BossId): BossDef {
  return BOSSES.find((b) => b.id === id) ?? BOSSES[0];
}

export function getVehicleById(id: VehicleId | string): VehicleDef {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];
}

export function getCompanionDroneById(id: string | null | undefined): CompanionDroneDef | null {
  if (!id) return null;
  return COMPANION_DRONES.find((d) => d.id === id) ?? null;
}

export function getBoosterById(id: string | null | undefined): CharacterBoosterDef | null {
  if (!id) return null;
  return CHARACTER_BOOSTERS.find((b) => b.id === id) ?? null;
}

export function getAvatarById(id: string | null | undefined): ProfileAvatarDef {
  return PROFILE_AVATARS.find((a) => a.id === id) ?? PROFILE_AVATARS[0];
}

export const DEFAULT_FREE_RUN_CONFIG: FreeRunConfig = {
  randomCity: false,
  districtId: 'downtown',
  randomWeather: true,
  weather: 'clear',
  bossesEnabled: true,
  eventFrequency: 'normal',
  obstacleDensity: 'normal',
  difficulty: 'normal',
  powerupFrequency: 'normal',
  specialRule: 'none',
};

export const TUTORIAL_TOPICS: TutorialTopicDef[] = [
  { index: 1, id: 'tut_basic_move', category: 'movement', titleKey: 'tut.t1.title', descKey: 'tut.t1.desc', practiceHintKey: 'tut.t1.hint', demoAction: 'run', keyAction: 'sprint', requiresPractice: true },
  { index: 2, id: 'tut_lane_switch', category: 'movement', titleKey: 'tut.t2.title', descKey: 'tut.t2.desc', practiceHintKey: 'tut.t2.hint', demoAction: 'sprint', keyAction: 'left', requiresPractice: true },
  { index: 3, id: 'tut_jump', category: 'movement', titleKey: 'tut.t3.title', descKey: 'tut.t3.desc', practiceHintKey: 'tut.t3.hint', demoAction: 'jump', keyAction: 'jump', requiresPractice: true },
  { index: 4, id: 'tut_slide', category: 'movement', titleKey: 'tut.t4.title', descKey: 'tut.t4.desc', practiceHintKey: 'tut.t4.hint', demoAction: 'slide', keyAction: 'slide', requiresPractice: true },
  { index: 5, id: 'tut_double_jump', category: 'movement', titleKey: 'tut.t5.title', descKey: 'tut.t5.desc', practiceHintKey: 'tut.t5.hint', demoAction: 'doubleJump', keyAction: 'jump', requiresPractice: true },
  { index: 6, id: 'tut_shields', category: 'combat', titleKey: 'tut.t6.title', descKey: 'tut.t6.desc', practiceHintKey: 'tut.t6.hint', demoAction: 'run' },
  { index: 7, id: 'tut_abilities', category: 'combat', titleKey: 'tut.t7.title', descKey: 'tut.t7.desc', practiceHintKey: 'tut.t7.hint', demoAction: 'sprint', keyAction: 'ability', requiresPractice: true },
  { index: 8, id: 'tut_companion_drone', category: 'combat', titleKey: 'tut.t8.title', descKey: 'tut.t8.desc', practiceHintKey: 'tut.t8.hint', demoAction: 'run', keyAction: 'callDrone', requiresPractice: true },
];

export function getStoryChapterByNum(chapter: number): StoryChapterDef {
  return (
    STORY_CHAPTERS.find((c) => c.chapter === chapter) ?? STORY_CHAPTERS[0]
  );
}

export function pickWeightedRandomDistrict(
  unlocked: DistrictId[],
  exclude?: DistrictId,
): DistrictId {
  const pool = unlocked.length > 0 ? unlocked : (['downtown', 'oldcity'] as DistrictId[]);
  const candidates = pool.length > 1 && exclude ? pool.filter((d) => d !== exclude) : pool;
  const weighted: Array<{ id: DistrictId; weight: number }> = candidates.map((id) => ({
    id,
    weight: id === 'underground' || id === 'skyfall_towers' || id === 'the_creation' || id === 'dont_drown' ? 1.8 : 1.0,
  }));
  const total = weighted.reduce((acc, item) => acc + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.id;
  }
  return weighted[0]?.id ?? 'downtown';
}
