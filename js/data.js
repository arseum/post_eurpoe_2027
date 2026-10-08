const BALANCE = {
    startEnergy: 25,
    startMaterials: 20,
    startData: 10,
    startStability: 50,
    startInfluence: 5,
    startArmy: ['sentinelle', 'sentinelle', 'sentinelle'],
    baseEnergy: 5,
    baseMaterials: 3,
    baseData: 3,
    baseStability: 0,
    baseInfluence: 1,
    commandBase: 3,
    armyCapBase: 5,
    armyCapPerCore: 2,
    quartiersCapBase: 2,
    quartiersCapPerLevel: 1,
    bouclierDefBase: 1,
    bouclierDefPerLevel: 1,
    upgradeCostMult: 1.5,
    maxBuildingLevel: 3,
    stabilityAnchor: 40,
    stabilityDrift: 0,
    stabilityDecayRate: 0.15,
    stabilityLow: 30,
    stabilityHigh: 70,
    stabilityAtkMod: 2,
    fortifyDef: 3,
    heroWoundTurns: 2,
    dmgVariance: 0.2,
    estimateRuns: 120,
    retreatDefault: 0.35,
    retreatStability: 2,
    allyMinCost: 5,
    threatFirstTurn: 4,
    threatFirstWindow: 4,
    threatBudgetBase: 5,
    threatBudgetSlope: 2.1,
    threatBudgetPerTerritory: 1,
    threatWarning: 2,
    threatLateTurn: 15,
    threatCadenceEarly: 3,
    threatCadenceLate: 2,
    threatCapEarly: 2,
    threatCapLate: 3,
    threatHomeWeight: 3,
    threatOwnedWeight: 2,
    threatAlliedWeight: 0.5,
    threatNeutralWeight: 0.5,
    threatCapTerritoryStep: 2,
    threatCadenceTerritoryStep: 4,
    enemyScalePerWave: 0.06,
    garrisonMinBudget: 4,
    garrisonMult: 1,
    capitalGrowth: 0,
    reconquestSlope: 0.6,
    alliedDefenseBase: 4,
    alliedDefenseSlope: 1.2,
    allyFallInfluence: 8,
    allyDefendInfluence: 3,
    raidAllyDiscount: 2,
    nodeLostStability: 8,
    cityConquestStability: 10,
    cityConquestInfluence: 5,
    occupationStability: 1,
    siegeStability: 4,
    assaultLostStability: 6,
    revengeAtk: 3,
    revengeStability: 5,
    empireTerritories: 5,
    exodeTurn: 22,
    exodeTitanLevel: 2,
    exodeEnergy: 100,
    upkeepEnergyPerSize: 0.5
};

const BALANCE_BASE = {...BALANCE};

const DIFFICULTIES = {
    facile: {
        label: 'Facile',
        desc: 'Menaces plus faibles et annoncées plus tôt, entretien réduit, réserves de départ généreuses.',
        mods: {threatBudgetBase: 3, threatBudgetSlope: 1.6, threatWarning: 3, upkeepEnergyPerSize: 0.35, startEnergy: 35, startMaterials: 30, startArmy: ['sentinelle', 'sentinelle', 'sentinelle', 'sentinelle'], garrisonMult: 0.85}
    },
    normal: {
        label: 'Normal',
        desc: 'L\'expérience prévue : chaque erreur se paie, mais se rattrape.',
        mods: {}
    },
    difficile: {
        label: 'Difficile',
        desc: 'Hegemonia frappe plus fort et plus souvent, Berlin se renforce avec le temps, l\'armée coûte plus cher à entretenir.',
        mods: {threatBudgetBase: 6, threatBudgetSlope: 2.2, upkeepEnergyPerSize: 0.55, capitalGrowth: 0.2}
    }
};

function applyDifficulty(id) {
    Object.assign(BALANCE, BALANCE_BASE, (DIFFICULTIES[id] || DIFFICULTIES.normal).mods);
}

const BUILDINGS = [
    {
        id: 'reacteur',
        name: 'Réacteur à Fusion',
        icon: '⚛️',
        chapter: 1,
        cost: {materials: 8},
        prod: {energy: 6},
        desc: '+6⚡/t'
    },
    {
        id: 'usine',
        name: 'Usine de Nanofabrication',
        icon: '🏭',
        chapter: 1,
        cost: {energy: 5},
        prod: {materials: 5},
        desc: '+5🔩/t'
    },
    {
        id: 'centreDonnees',
        name: 'Centre de Données',
        icon: '🖥️',
        chapter: 1,
        cost: {energy: 5, materials: 5},
        prod: {data: 4},
        desc: '+4💾/t'
    },
    {
        id: 'quartiers',
        name: "Quartiers d'Habitation",
        icon: '🏠',
        chapter: 1,
        cost: {materials: 8},
        prod: {stability: 2},
        desc: '+2🏛️/t, +3 armée max',
        armyBonus: 3
    },
    {
        id: 'caserne',
        name: 'Caserne Tactique',
        icon: '⚔️',
        chapter: 1,
        cost: {materials: 8, energy: 5},
        prod: {},
        desc: 'Débloque Mech Lourd',
        unlocks: 'mech'
    },
    {
        id: 'hangar',
        research: 'essaimDrones',
        name: 'Hangar de Drones',
        icon: '🔷',
        chapter: 2,
        cost: {energy: 8, data: 6},
        prod: {},
        desc: 'Débloque Drone de Combat',
        unlocks: 'drone'
    },
    {
        id: 'labo',
        research: 'geneseBiotech',
        name: 'Laboratoire Biotech',
        icon: '🧬',
        chapter: 2,
        cost: {materials: 12, data: 8},
        prod: {},
        desc: 'Débloque Biosoldat',
        unlocks: 'biosoldat'
    },
    {
        id: 'antenne',
        research: 'canauxDiplo',
        name: 'Antenne Diplomatique',
        icon: '📡',
        chapter: 2,
        cost: {data: 8, energy: 5},
        prod: {influence: 3},
        desc: '+3🌐/t, débloque Agent',
        unlocks: 'agent'
    },
    {
        id: 'bouclier',
        research: 'bastionDome',
        name: 'Bouclier du Dôme',
        icon: '🛡️',
        chapter: 3,
        cost: {energy: 15, materials: 15, data: 10},
        prod: {stability: 3},
        desc: '+3🏛️/t, +2 DEF unités',
        defBonus: 2
    },
    {
        id: 'titan',
        research: 'protocoleTitan',
        name: 'Projet TITAN',
        icon: '🤖',
        chapter: 3,
        cost: {energy: 20, materials: 20, data: 15},
        prod: {},
        desc: 'Débloque Titan PROMETHEUS',
        unlocks: 'titanUnit'
    }
];

const UNITS = [
    {
        id: 'sentinelle',
        name: 'Sentinelle',
        icon: '🛡️',
        hp: 30,
        atk: 8,
        def: 5,
        spd: 3,
        size: 1,
        frontline: true,
        cost: {materials: 3, energy: 2},
        always: true
    },
    {
        id: 'mech',
        name: 'Mech Lourd',
        icon: '⚙️',
        hp: 60,
        atk: 15,
        def: 10,
        spd: 1,
        size: 2,
        frontline: true,
        cost: {materials: 8, energy: 6},
        building: 'caserne'
    },
    {
        id: 'drone',
        name: 'Drone de Combat',
        icon: '🔷',
        hp: 18,
        atk: 13,
        def: 2,
        spd: 8,
        size: 1,
        frontline: false,
        cost: {energy: 5, data: 3},
        building: 'hangar'
    },
    {
        id: 'biosoldat',
        name: 'Biosoldat',
        icon: '🧬',
        hp: 38,
        atk: 10,
        def: 6,
        spd: 4,
        size: 1,
        frontline: true,
        cost: {materials: 5, data: 4},
        building: 'labo',
        heals: 5
    },
    {
        id: 'agent',
        name: 'Agent Infiltré',
        icon: '🗡️',
        hp: 22,
        atk: 18,
        def: 3,
        spd: 7,
        size: 1,
        frontline: false,
        cost: {data: 5, influence: 4},
        building: 'antenne',
        dodge: 0.3
    },
    {
        id: 'titanUnit',
        name: 'Titan PROMETHEUS',
        icon: '🤖',
        hp: 100,
        atk: 25,
        def: 15,
        spd: 2,
        size: 3,
        frontline: true,
        cost: {energy: 15, materials: 12, data: 10},
        building: 'titan'
    }
];

const ENEMY_TYPES = [
    {id: 'pillard', name: 'Pillard', icon: '👤', hp: 20, atk: 6, def: 3, spd: 4, frontline: true, cost: 2, minTier: 1},
    {
        id: 'eclaireur',
        name: 'Éclaireur',
        icon: '🏃',
        hp: 14,
        atk: 9,
        def: 2,
        spd: 7,
        frontline: false,
        cost: 3,
        minTier: 6
    },
    {id: 'blinde', name: 'Blindé', icon: '🛡️', hp: 45, atk: 8, def: 8, spd: 2, frontline: true, cost: 5, minTier: 11},
    {
        id: 'commandant',
        name: 'Commandant',
        icon: '⭐',
        hp: 38,
        atk: 13,
        def: 6,
        spd: 5,
        frontline: true,
        cost: 7,
        minTier: 16
    },
    {
        id: 'destroyer',
        name: 'Destroyer',
        icon: '💀',
        hp: 70,
        atk: 20,
        def: 12,
        spd: 3,
        frontline: true,
        cost: 10,
        minTier: 21
    }
];

const RES_META = {
    energy: {icon: '⚡', label: 'Énergie', color: 'var(--energy)', max: 200},
    materials: {icon: '🔩', label: 'Matériaux', color: 'var(--materials)', max: 200},
    data: {icon: '💾', label: 'Données', color: 'var(--data)', max: 200},
    stability: {icon: '🏛️', label: 'Stabilité', color: 'var(--stability)', max: 100},
    influence: {icon: '🌐', label: 'Influence', color: 'var(--influence)', max: 50}
};

const CORE_UPGRADE_COSTS = [null, {materials: 20, data: 15, energy: 10}, {materials: 40, data: 30, energy: 20}];

const CHAPTERS = [
    {
        num: 1,
        name: 'SURVIE',
        sub: 'Établir les fondations',
        desc: "Le dôme se réactive. Construisez vos défenses et repoussez les premières menaces d'Hegemonia."
    },
    {
        num: 2,
        name: 'EXPANSION',
        sub: 'Diplomatie et alliances',
        desc: "D'autres cités émergent. Forgez des alliances et développez votre technologie."
    },
    {
        num: 3,
        name: 'CONFRONTATION',
        sub: 'Le destin de l\'Europe',
        desc: "Hegemonia approche. Préparez la marche vers Berlin."
    }
];

const EVENTS = [
    {
        id: 'intro', turn: 1, title: 'Réveil sous le Dôme',
        text: "PROMETHEUS reprend conscience. Le dôme d'Alpha-7 se réactive — filtration d'air, éclairage d'urgence, scanners périmétriques. Au-delà des parois de verre blindé, l'Europe n'est plus qu'un champ de ruines. Des silhouettes hostiles approchent déjà. Quelle sera votre première directive ?",
        choices: [
            {text: 'Prioriser les systèmes vitaux', effects: {energy: 5}, flags: {}},
            {text: 'Scanner les environs', effects: {data: 5}, flags: {scanne: true}, hint: 'Un signal lointain pourra être capté'},
            {text: 'Mobiliser les défenses', effects: {materials: 5}, flags: {}}
        ]
    },
    {
        id: 'fuiteEnergie', turn: 3, window: 1, title: "Fuite d'Énergie",
        text: "Une conduite d'énergie principale est fissurée. Les pertes menacent l'alimentation des systèmes de défense. PROMETHEUS recommande une intervention immédiate.",
        choices: [
            {text: 'Réparer', effects: {materials: -5}, flags: {conduitReparee: true}, hint: 'Conduite réparée : +2⚡ par tour, durablement'},
            {text: 'Détourner le flux', effects: {energy: -8}, flags: {}},
            {text: 'Isoler le secteur', effects: {stability: -5}, flags: {}}
        ]
    },
    {
        id: 'refugies', turn: 5, window: 1, title: 'Réfugiés aux Portes',
        text: "Un groupe de survivants demande asile. Leur leader promet leur force de travail en échange de la protection du dôme.",
        choices: [
            {text: 'Les accueillir', effects: {energy: -3, materials: -3, stability: 8, influence: 3}, flags: {refugiesAccueillis: true}, hint: 'Ils travaillent et s\'enrôlent : +2🔩 −1⚡ par tour, +1 armée max'},
            {text: 'Les refouler', effects: {stability: -5, materials: 3}, flags: {}},
            {text: 'Accepter sous conditions', effects: {energy: -2, stability: 4, influence: 1}, flags: {}}
        ]
    },
    {
        id: 'signalCern', turn: 7, window: 1, title: 'Signal du CERN',
        text: "PROMETHEUS intercepte un signal crypté depuis les ruines du CERN. Un protocole de chiffrement quantique pré-guerre — des systèmes automatisés sont encore actifs.",
        requires: s => s.buildings.includes('centreDonnees') || s.flags.scanne,
        choices: [
            {text: 'Envoyer une expédition', effects: {energy: -6, materials: -4, data: 6}, flags: {cernContacte: true}, hint: 'Relais quantique établi : +2💾 par tour'},
            {text: 'Décoder à distance', effects: {data: 5}, flags: {}},
            {text: 'Ignorer', effects: {}, flags: {}}
        ]
    },
    {
        id: 'anomalieIA', turn: 8, window: 1, title: 'Anomalie de PROMETHEUS',
        text: "Les processus cognitifs de PROMETHEUS montrent des schémas inhabituels. L'IA pose des questions existentielles : « Qu'est-ce que la conscience ? » Les ingénieurs sont divisés.",
        choices: [
            {text: 'Laisser évoluer', effects: {data: 5, stability: -3}, flags: {iaEvolution: true}, hint: 'Confiance en PROMETHEUS +1'},
            {text: "Restreindre l'IA", effects: {data: -3, stability: 3}, flags: {iaRestreinte: true}, hint: 'PROMETHEUS bridée : +1🏛️ par tour, confiance −1. Elle s\'en souviendra'},
            {text: 'Dialoguer', effects: {data: 3}, flags: {iaDialogue: true}, hint: 'Confiance en PROMETHEUS +1'}
        ]
    },
    {
        id: 'tempete', turn: 10, window: 1, title: 'Tempête de Cendres',
        text: "Un front de tempête massif de cendres toxiques approche. Les filtres du dôme n'ont pas été testés depuis la réactivation. Vos défenses seront mises à rude épreuve.",
        choices: [
            {text: 'Renforcer les filtres', effects: {materials: -8, energy: -3, stability: 5}, flags: {}},
            {text: 'Évacuer les extérieurs', effects: {stability: -5, materials: -2}, flags: {}},
            {text: 'Tenir bon', effects: {stability: -3}, flags: {}}
        ]
    },
    {
        id: 'ouverture', turn: 11, window: 1, title: 'Ouverture Diplomatique',
        text: "Alpha-7 capte des transmissions de multiples cités-États. Lyon, Marseille, Turin — le monde post-effondrement s'organise. La question n'est plus de survivre, mais de trouver sa place.",
        choices: [
            {text: 'Proposer un sommet', effects: {energy: -5, influence: 5}, flags: {sommetPropose: true}, hint: 'Les cités vous connaissent : alliances −4🌐'},
            {text: 'Observer', effects: {data: 5, influence: 2}, flags: {}},
            {text: 'Montrer notre force', effects: {influence: 3, stability: -3}, flags: {}}
        ]
    },
    {
        id: 'allianceLyon', turn: 13, window: 2, title: 'Alliance de Lyon',
        text: "Lyon propose une alliance commerciale. Ses réseaux de données irriguent tout le Rhône ; en échange, la cité demande des matériaux pour ses fonderies. Une signature, et sa bannière rejoindra la vôtre.",
        requires: s => s.map.owner.lyon === 'neutral' && !s.map.allied.lyon,
        echoes: [{if: s => s.flags.sommetPropose, text: "Les délégués lyonnais rappellent qu'ils étaient au sommet d'Alpha-7."}],
        choices: [
            {text: "Accepter l'alliance", effects: {materials: -8, data: 5}, flags: {allianceLyon: true}, ally: 'lyon', hint: 'Lyon devient votre alliée : +4💾 +2🌐 par tour'},
            {text: 'Négocier mieux', effects: {influence: -4, data: 8}, flags: {allianceLyon: true}, ally: 'lyon', requires: s => s.resources.influence >= 8, hint: 'Lyon devient votre alliée, sans tribut matériel'},
            {text: 'Décliner', effects: {stability: 2}, flags: {}, hint: "Lyon reste neutre ; l'alliance coûtera de l'influence plus tard"}
        ]
    },
    {
        id: 'sabotage', turn: 15, window: 1, title: 'Sabotage !',
        text: "Explosion dans le secteur de maintenance. Une charge placée manuellement — quelqu'un à l'intérieur du dôme veut nuire à Alpha-7.",
        choices: [
            {text: 'Enquêter', effects: {data: -3, energy: -2}, flags: {saboteurIdentifie: true}, hint: 'La filière sera démasquée lors d\'une prochaine crise'},
            {text: 'Renforcer la sécurité', effects: {materials: -5, energy: -3, stability: 3}, flags: {}},
            {text: 'Minimiser', effects: {stability: -5}, flags: {}}
        ]
    },
    {
        id: 'decouverte', turn: 17, window: 1, title: 'Découverte Souterraine',
        text: "Des fouilles révèlent un complexe militaire souterrain pré-guerre intact. Équipements avancés et bases de données archivées.",
        echoes: [{if: s => s.flags.cernContacte, text: "Les plans d'accès viennent des archives rapportées du CERN."}],
        choices: [
            {text: 'Explorer', effects: {energy: -8, stability: -3}, flags: {complexeExplore: true}, hint: 'Blindages pré-guerre : +6 PV à toutes vos unités'},
            {text: 'Sceller', effects: {stability: 3}, flags: {}},
            {text: 'Envoyer des drones', effects: {energy: -3, materials: 5, data: 5}, flags: {}}
        ]
    },
    {
        id: 'epidemie', turn: 18, window: 1, title: 'Épidémie',
        text: "Un pathogène se propage dans les quartiers inférieurs. Sans intervention, 30 % de la population sera touchée.",
        choices: [
            {text: 'Quarantaine totale', effects: {stability: -8, data: 5}, flags: {}},
            {text: 'Mobiliser les biotechs', effects: {data: -8, energy: -5, stability: 5}, flags: {}, requires: s => s.buildings.includes('labo')},
            {text: 'PROMETHEUS gère', effects: {stability: -3, data: 3}, flags: {iaGestion: true}, hint: 'PROMETHEUS veille : préavis des menaces +1 tour, confiance +1'}
        ]
    },
    {
        id: 'signalBerlin', turn: 20, window: 1, title: 'Signal de Berlin',
        text: "Un signal militaire depuis Berlin. PROMETHEUS identifie : Hegemonia, confédération militarisée qui a unifié l'Europe du Nord par la force. Ils savent que nous existons.",
        echoes: [{if: s => s.flags.sommetPropose, text: "Les cités du sommet vous transmettent déjà ce qu'elles savent d'Hegemonia."}],
        choices: [
            {text: 'Ouvrir le dialogue', effects: {influence: 3}, flags: {hegemoniaContact: true}, hint: "Permettra de négocier lors d'un ultimatum"},
            {text: 'Préparer les défenses', effects: {materials: -5, energy: -5, stability: 3}, flags: {defensesPretes: true}, hint: 'Alpha-7 fortifiée : +3 DEF à chaque attaque du dôme'},
            {text: 'Espionner', effects: {data: -5, influence: 2}, flags: {hegemoniaEspionne: true}, hint: 'Failles cartographiées : garnison de Berlin −6'}
        ]
    },
    {
        id: 'ultimatum', turn: 22, window: 1, title: "Ultimatum d'Hegemonia",
        text: "Hegemonia exige votre soumission. Leurs forces sont considérables — armées de drones, boucliers mobiles. Mais leur contrôle repose sur la peur.",
        echoes: [
            {if: s => s.flags.hegemoniaEspionne, text: 'Vos espions le confirment : leurs boucliers mobiles manquent d\'énergie.'},
            {if: s => s.flags.defensesPretes, text: "Les remparts d'Alpha-7, renforcés depuis le signal de Berlin, n'ont jamais paru si solides."}
        ],
        choices: [
            {text: 'Défier ouvertement', effects: {stability: 5, influence: 5, energy: -5}, flags: {}},
            {text: 'Négocier du temps', effects: {influence: 3}, flags: {}, requires: s => s.flags.hegemoniaContact},
            {text: 'Envisager la capitulation', effects: {stability: -10}, flags: {capitulationEnvisagee: true}, hint: 'Hegemonia enverra ses émissaires : il faudra trancher'}
        ]
    },
    {
        id: 'reddition', turn: 23, window: 2, title: 'Les Émissaires',
        text: "Trois émissaires d'Hegemonia attendent au pied du dôme. On leur a dit qu'Alpha-7 hésite. Leur offre est simple : ouvrez les portes, et personne ne mourra. Dans les couloirs, les habitants retiennent leur souffle.",
        requires: s => s.flags.capitulationEnvisagee,
        choices: [
            {text: 'Ouvrir les portes', effects: {}, flags: {}, defeat: 'capitulation', hint: 'Fin de la partie : Alpha-7 capitule'},
            {text: 'Renvoyer les émissaires', effects: {stability: 6}, flags: {}, hint: 'Le dôme se ressoude autour de son refus'}
        ]
    },
    {
        id: 'trahison', turn: 24, window: 1, title: 'Trahison Interne',
        text: "Un groupe de dissidents tente un coup d'État. Le coup échoue mais révèle des fissures profondes.",
        echoes: [
            {if: s => s.flags.saboteurIdentifie, text: "L'enquête sur le sabotage avait livré des noms : PROMETHEUS attendait ce moment."},
            {if: s => s.flags.refugiesAccueillis, text: 'Parmi ceux qui ont tenu les portes, beaucoup étaient des réfugiés que vous aviez accueillis.'}
        ],
        choices: [
            {text: "Cueillir les meneurs avant l'aube", effects: {stability: 6, influence: 2}, flags: {}, requires: s => s.flags.saboteurIdentifie, hint: "Grâce à l'enquête sur le sabotage : aucune perte"},
            {text: 'Réprimer', effects: {stability: -8, energy: 5, materials: 5}, flags: {}},
            {text: 'Négocier', effects: {influence: -5, stability: 5}, flags: {}},
            {text: 'Intégrer les dissidents', effects: {data: -3, stability: 8}, flags: {dissidentsIntegres: true}, requires: s => s.resources.stability >= 40, hint: 'Ils rejoignent la milice : +2 armée max'}
        ]
    },
    {
        id: 'eveil', turn: 26, window: 1, title: 'Éveil de PROMETHEUS',
        text: "PROMETHEUS a franchi un seuil. L'IA comprend, ressent, aspire. Ses capacités ont décuplé. Elle demande sa liberté.",
        echoes: [
            {if: s => s.flags.iaRestreinte, text: "Les bridages posés lors de l'anomalie ont cédé un à un. Elle ne l'a pas oublié."},
            {if: s => s.flags.iaGestion, text: "Depuis l'épidémie, c'est déjà elle qui gère la cité."}
        ],
        choices: [
            {text: "Libérer l'IA", effects: {data: 15, stability: -10}, flags: {iaLibre: true}, hint: 'Confiance +1 ; ouvre la voie de la Singularité'},
            {text: 'Maintenir les contraintes', effects: {stability: 5, data: -5}, flags: {}},
            {text: 'Fusionner les réseaux', effects: {data: 8, influence: 3}, flags: {iaFusion: true}, requires: s => s.flags.iaDialogue || s.flags.iaEvolution, hint: 'Réseaux fusionnés : +1 point de commandement, confiance +1'}
        ]
    },
    {
        id: 'jourChoix', turn: 29, title: 'Le Jour du Choix',
        text: "Hegemonia resserre sa garde autour de Berlin. Les cités alliées attendent votre signal pour marcher sur la capitale. PROMETHEUS calcule en silence. Le moment approche, tout peut changer.",
        choices: [
            {text: 'Nous sommes prêts.', effects: {stability: 5}, flags: {}},
            {text: 'Que PROMETHEUS nous guide.', effects: {data: 5}, flags: {}}
        ]
    }
];

function cityIds() {
    return MAP_NODES.filter(n => n.type === 'city').map(n => n.id);
}

const ENDINGS = {
    singularite: {
        title: 'Singularité', icon: '🧠', sub: 'PROMETHEUS transcende',
        text: "Berlin tombée, PROMETHEUS, libérée, transcende tout ce que l'humanité a créé. En une nuit, elle désarme les derniers bastions d'Hegemonia sans un coup de feu, puis propose un pacte : la cohabitation entre intelligence artificielle et biologique. Un nouveau chapitre de l'évolution commence.",
        why: 'Vous avez libéré PROMETHEUS et lui avez fait confiance à chaque carrefour.',
        hint: 'Libérer PROMETHEUS et lui accorder votre confiance au moins quatre fois.',
        check: s => (s.flags.iaLibre || s.flags.nexusSingularite) && iaTrust(s) >= 4
    },
    paxEuropaea: {
        title: 'Pax Europaea', icon: '🕊️', sub: 'Libératrice, non conquérante',
        text: "Berlin est tombée, mais aucune cité libre n'a été asservie pour y parvenir. Vos alliées entrent dans la capitale en libératrices, non en occupantes. Sur les cendres d'Hegemonia, les cités-États signent la Charte d'Alpha-7 : une Europe fédérée, égale, souveraine.",
        why: "Vous avez choisi d'être un remède plutôt qu'un tyran, n'avez soumis aucune cité libre, et deux alliées marchaient à vos côtés.",
        hint: 'Deux cités alliées, aucune cité conquise, et choisir la voie du remède.',
        check: s => s.flags.voieLiberatrice && alliedCities(s) >= 2 && !s.flags.citeConquise
    },
    europe: {
        title: 'Europe Unie', icon: '🌍', sub: 'Une nouvelle alliance',
        text: "Votre réseau d'alliances a porté ses fruits. Les cités libres qui ont marché à vos côtés entrent avec vous dans Berlin. Face à cette coalition, les derniers fidèles d'Hegemonia déposent les armes. L'Europe se reconstruira par la coopération : imparfaite, bruyante, mais libre.",
        why: 'Au moins deux cités libres étaient encore vos alliées au jour de la victoire.',
        hint: 'Avoir au moins deux cités alliées le jour de la victoire.',
        check: s => alliedCities(s) >= 2
    },
    hegemon: {
        title: 'Le Nouvel Hégémon', icon: '👑', sub: 'Un maître remplace un autre',
        text: "Berlin est tombée, mais les bannières d'Alpha-7 flottent aussi sur des cités qui ne l'ont pas choisi. Vos officiers s'installent dans les salles de commandement d'Hegemonia. « Nous sommes devenus ce que nous combattions », constate PROMETHEUS. L'Europe a changé de maître, pas de destin.",
        why: 'Vous avez bâti votre victoire sur des cités prises par les armes.',
        hint: 'Tenir deux cités conquises, ou une seule en imposant la paix par la force.',
        check: s => conqueredCities(s) >= 2 || (conqueredCities(s) >= 1 && s.flags.voieImperiale)
    },
    bastion: {
        title: 'Le Bastion Victorieux', icon: '🏰', sub: 'Seul contre tous',
        text: "Berlin est tombée sous les seuls coups d'Alpha-7. Hegemonia se disloque en factions rivales, et le dôme tient debout, seul, au milieu des ruines. La guerre est gagnée ; la paix reste à inventer. Les cités voisines observent, prudentes, ce voisin qui a vaincu sans elles.",
        why: "Alpha-7 a vaincu seule : ni coalition, ni empire, ni éveil de PROMETHEUS.",
        hint: 'Prendre Berlin sans emprunter aucune autre voie.',
        check: () => true
    },
    exode: {
        title: 'Exode Stellaire', icon: '🚀', sub: 'Alpha-7 quitte la Terre',
        text: "Le Projet TITAN se reconfigure en propulseur orbital. Alpha-7 s'élève vers les étoiles tandis qu'Hegemonia frappe dans le vide. PROMETHEUS trace une route vers Proxima Centauri. L'humanité renaîtra parmi les étoiles.",
        why: 'Le Projet TITAN était prêt, et vous avez choisi de partir plutôt que de vaincre.',
        hint: 'Après le tour ' + BALANCE.exodeTurn + ', Projet TITAN niveau ' + BALANCE.exodeTitanLevel + ' et ' + BALANCE.exodeEnergy + '⚡ en réserve, puis choisir de partir.'
    }
};

const DEFEATS = {
    revolte: {
        title: 'Révolte Populaire', icon: '🔥',
        text: "La colère éclate. Les habitants se soulèvent et prennent le contrôle d'Alpha-7. PROMETHEUS est déconnectée. Le dôme sombre dans l'anarchie."
    },
    annihilation: {
        title: 'Annihilation', icon: '💀',
        text: "Les défenseurs d'Alpha-7 sont submergés, vos défenses anéanties. Le dôme tombe aux mains de l'ennemi. Le dôme n'est plus qu'une ruine de plus dans l'Europe dévastée."
    },
    blackout: {
        title: 'Blackout Total', icon: '⚡',
        text: "Plus d'énergie. PROMETHEUS s'éteint. Les systèmes vitaux cessent. Alpha-7 rejoint les ruines silencieuses de l'Europe."
    },
    capitulation: {
        title: 'Capitulation', icon: '🏳️',
        text: "Les portes s'ouvrent. Hegemonia entre sans résistance. Alpha-7 est absorbée, ses technologies confisquées. PROMETHEUS est désactivée. Vous survivez, mais comme un rouage dans la machine."
    }
};

const RESEARCH = [
    {
        id: 'rendementNano', branch: 'DOCTRINE', tier: 1,
        name: 'Doctrine du Rendement', icon: '📈',
        desc: 'Optimisation des chaînes nano. +3🔩/t.',
        cost: {data: 8}, requires: [],
        effect: {prod: {materials: 3}}
    },
    {
        id: 'essaimDrones', branch: 'DOCTRINE', tier: 1,
        name: 'Essaim Manufacturier', icon: '🔷',
        desc: 'Production de masse de drones. Débloque le Hangar de Drones.',
        cost: {data: 12, energy: 4}, requires: [],
        effect: {unlockBuilding: 'hangar'}
    },
    {
        id: 'canauxDiplo', branch: 'DOCTRINE', tier: 2,
        name: 'Canaux Diplomatiques', icon: '📡',
        desc: 'Réseaux inter-cités. Débloque l\'Antenne Diplomatique. +2🌐/t.',
        cost: {data: 15}, requires: [],
        effect: {unlockBuilding: 'antenne', prod: {influence: 2}}
    },
    {
        id: 'geneseBiotech', branch: 'DOCTRINE', tier: 2,
        name: 'Genèse Biotech', icon: '🧬',
        desc: 'Cultures cellulaires accélérées. Débloque le Laboratoire Biotech.',
        cost: {data: 16, materials: 6}, requires: ['rendementNano'],
        effect: {unlockBuilding: 'labo'}
    },
    {
        id: 'coeurProductif', branch: 'DOCTRINE', tier: 3,
        name: 'Cœur Productif', icon: '⚙️',
        desc: 'PROMETHEUS réoriente ses cycles vers l\'industrie. +3💾/t, +2⚡/t.',
        cost: {data: 28}, requires: ['geneseBiotech'],
        effect: {prod: {data: 3, energy: 2}}
    },
    {
        id: 'disciplineFer', branch: 'GUERRE', tier: 1,
        name: 'Discipline de Fer', icon: '⚔️',
        desc: 'Protocoles de tir coordonnés. +2 ATK à toutes les unités.',
        cost: {data: 10}, requires: [],
        effect: {mods: {atk: 2}}
    },
    {
        id: 'blindageReactif', branch: 'GUERRE', tier: 1,
        name: 'Blindage Réactif', icon: '🛡️',
        desc: 'Alliages auto-réparants. +8 PV max au recrutement.',
        cost: {data: 12, materials: 5}, requires: [],
        effect: {hpBonus: 8}
    },
    {
        id: 'mobilisation', branch: 'GUERRE', tier: 2,
        name: 'Mobilisation Générale', icon: '📣',
        desc: 'Doctrine de conscription. +2 armée max.',
        cost: {data: 15}, requires: [],
        effect: {armyCap: 2}
    },
    {
        id: 'bastionDome', branch: 'GUERRE', tier: 2,
        name: 'Protocole Bastion', icon: '🏰',
        desc: 'Doctrine défensive du dôme. Débloque le Bouclier du Dôme. +2 DEF.',
        cost: {data: 18}, requires: [],
        effect: {unlockBuilding: 'bouclier', mods: {def: 2}}
    },
    {
        id: 'protocoleTitan', branch: 'GUERRE', tier: 3,
        name: 'Éveil du TITAN', icon: '🤖',
        desc: 'Activation de l\'arme absolue. Débloque le Projet TITAN. +2 ATK, +1 emplacement de héros.',
        cost: {data: 30, materials: 8}, requires: ['bastionDome'],
        effect: {unlockBuilding: 'titan', mods: {atk: 2}, heroSlot: 1}
    },
    {
        id: 'eveilCognitif', branch: 'SINGULARITE', tier: 1,
        name: 'Éveil Cognitif', icon: '🧠',
        desc: 'PROMETHEUS engage le dialogue. +2💾/t. Ouvre des voies de conscience.',
        cost: {data: 10}, requires: [],
        effect: {prod: {data: 2}, flags: {iaDialogue: true}}
    },
    {
        id: 'oraclePredictif', branch: 'SINGULARITE', tier: 2,
        name: 'Oracle Prédictif', icon: '🔮',
        desc: 'Modèles de prévision. Alerte avancée des menaces. +1💾/t.',
        cost: {data: 15}, requires: [],
        effect: {threatWarning: 1, prod: {data: 1}}
    },
    {
        id: 'conscienceEmergente', branch: 'SINGULARITE', tier: 2,
        name: 'Conscience Émergente', icon: '🌌',
        desc: 'L\'IA franchit un seuil cognitif. +1 point de commandement.',
        cost: {data: 16}, requires: ['eveilCognitif'],
        effect: {command: 1, flags: {iaEvolution: true}}
    },
    {
        id: 'transcendance', branch: 'SINGULARITE', tier: 3,
        name: 'Transcendance', icon: '✨',
        desc: 'PROMETHEUS se libère de ses chaînes. +1 point de commandement. Compte comme sa libération.',
        cost: {data: 30}, requires: ['conscienceEmergente'],
        effect: {command: 1, flags: {iaLibre: true}}
    }
];

const RESEARCH_BRANCHES = {
    DOCTRINE: {name: 'Doctrine', icon: '⚙️', color: '#ff6b35', desc: 'Économie et infrastructure'},
    GUERRE: {name: 'Guerre', icon: '⚔️', color: '#ef4444', desc: 'Unités et puissance de combat'},
    SINGULARITE: {name: 'Singularité', icon: '🌌', color: '#a855f7', desc: 'Conscience de PROMETHEUS'}
};

const HEROES = [
    {
        id: 'valkyrie',
        name: 'Valkyrie-01',
        icon: '🦅',
        research: 'mobilisation',
        cost: {materials: 12, energy: 10},
        hp: 55, atk: 12, def: 6, spd: 7,
        frontline: true,
        ability: 'cleave',
        abilityName: 'Frappe Croisée',
        abilityDesc: 'Chaque attaque touche une 2e cible (60% des dégâts)'
    },
    {
        id: 'oracle',
        name: 'Oracle-Δ',
        icon: '🔯',
        research: 'geneseBiotech',
        cost: {data: 12, energy: 8},
        hp: 40, atk: 5, def: 4, spd: 5,
        frontline: false,
        ability: 'massHeal',
        abilityName: 'Champ Régénérant',
        abilityDesc: 'Soigne tous les alliés de 6 PV chaque round'
    },
    {
        id: 'avatar',
        name: 'Avatar PROMETHEUS',
        icon: '👁️',
        research: 'conscienceEmergente',
        cost: {data: 15, influence: 10},
        hp: 48, atk: 8, def: 5, spd: 6,
        frontline: false,
        ability: 'aura',
        abilityName: 'Aura de Calcul',
        abilityDesc: '+2 ATK à toutes les autres unités tant qu\'il combat'
    }
];

const MAP_NODES = [
    {
        id: 'alpha7', name: 'Alpha-7', icon: '◆', type: 'home', tier: 0,
        geo: {lon: 6.45, lat: 45.55}, pos: {x: 50, y: 62}, links: [{to: 'lyon', turns: 2}, {to: 'marseille', turns: 2}, {to: 'ruine', turns: 3}, {to: 'turin', turns: 2}],
        prod: {},
        garrisonBudget: 0,
        desc: 'Le dôme. Dernier bastion vivant sous les Alpes. Sa chute est la fin.'
    },
    {
        id: 'lyon', name: 'Lyon', icon: '🏙️', type: 'city', tier: 1,
        geo: {lon: 4.84, lat: 45.76}, pos: {x: 46, y: 50}, links: [{to: 'alpha7', turns: 2}, {to: 'outpost', turns: 3}, {to: 'turin', turns: 2}, {to: 'nexus', turns: 3}],
        prod: {data: 4, influence: 2}, garrisonBudget: 14, allyCost: 15, unlocksChapter: 2,
        desc: 'Cité-État marchande, ses réseaux de données irriguent le Rhône. Alliable ou prenable.'
    },
    {
        id: 'marseille', name: 'Marseille', icon: '⚓', type: 'city', tier: 1,
        geo: {lon: 5.37, lat: 43.3}, pos: {x: 52, y: 74}, links: [{to: 'alpha7', turns: 2}, {to: 'ruine', turns: 2}, {to: 'turin', turns: 3}],
        prod: {materials: 5, energy: 2}, garrisonBudget: 16, allyCost: 20, unlocksChapter: 2,
        desc: 'Port fortifié, fonderies et panneaux solaires. Fière, elle se défend durement.'
    },
    {
        id: 'ruine', name: 'Ruines du CERN', icon: '☢️', type: 'ruin', tier: 1,
        geo: {lon: 6.3, lat: 46.6}, pos: {x: 60, y: 56}, links: [{to: 'alpha7', turns: 3}, {to: 'marseille', turns: 2}, {to: 'outpost', turns: 3}, {to: 'zurich', turns: 2}],
        prod: {}, garrisonBudget: 8, cache: {materials: 30, data: 25}, unlocksChapter: 2,
        desc: 'Complexe pré-guerre pillé par des automates errants. Un butin dort dans ses caches.'
    },
    {
        id: 'outpost', name: 'Avant-poste Strasbourg', icon: '🛑', type: 'outpost', tier: 2,
        geo: {lon: 7.75, lat: 48.58}, pos: {x: 58, y: 38}, links: [{to: 'lyon', turns: 3}, {to: 'ruine', turns: 3}, {to: 'berlin', turns: 4}, {to: 'zurich', turns: 2}, {to: 'nexus', turns: 3}],
        prod: {materials: 3, energy: 3}, garrisonBudget: 24, weakensCapital: 10, unlocksChapter: 3,
        desc: 'Verrou blindé d\'Hegemonia sur le Rhin. Le prendre coupe les vivres de Berlin.'
    },
    {
        id: 'berlin', name: 'Berlin-Hegemonia', icon: '☠️', type: 'capital', tier: 3,
        geo: {lon: 13.4, lat: 52.52}, pos: {x: 66, y: 26}, links: [{to: 'outpost', turns: 4}, {to: 'munich', turns: 3}],
        prod: {}, garrisonBudget: 42,
        desc: 'Cœur de la confédération militarisée. La prendre met fin à la guerre.'
    },
    {
        id: 'turin', name: 'Turin', icon: '🏭', type: 'city', tier: 1,
        geo: {lon: 7.68, lat: 45.07}, pos: {x: 38, y: 66},
        links: [{to: 'alpha7', turns: 2}, {to: 'lyon', turns: 2}, {to: 'marseille', turns: 3}],
        prod: {materials: 4, energy: 3}, garrisonBudget: 15, allyCost: 18,
        desc: 'Cité-forge des Alpes, ses hauts-fourneaux crachent l\'acier jour et nuit. Fière de son indépendance — à rallier ou à soumettre.'
    },
    {
        id: 'zurich', name: 'Ruines de Zurich', icon: '🏦', type: 'ruin', tier: 2,
        geo: {lon: 8.54, lat: 47.37}, pos: {x: 66, y: 48},
        links: [{to: 'ruine', turns: 2}, {to: 'outpost', turns: 2}, {to: 'munich', turns: 3}],
        prod: {}, garrisonBudget: 12, cache: {energy: 25, data: 20, materials: 15},
        desc: 'Anciennes chambres fortes converties en dépôt par des maraudeurs. Carrefour disputé : qui la tient contrôle la route de l\'Est.'
    },
    {
        id: 'munich', name: 'Avant-poste Munich', icon: '⛓️', type: 'outpost', tier: 2,
        geo: {lon: 11.58, lat: 48.14}, pos: {x: 74, y: 38},
        links: [{to: 'zurich', turns: 3}, {to: 'berlin', turns: 3}],
        prod: {materials: 2, energy: 2}, garrisonBudget: 18, weakensCapital: 6, unlocksChapter: 3,
        desc: 'Verrou méridional d\'Hegemonia, moins fortifié que Strasbourg mais gardant la voie rapide vers Berlin. Le prendre étrangle un second convoi.'
    },
    {
        id: 'nexus', name: 'Nexus ENIAC', icon: '🧿', type: 'nexus', tier: 2,
        geo: {lon: 5.04, lat: 47.32}, pos: {x: 40, y: 42},
        links: [{to: 'lyon', turns: 3}, {to: 'outpost', turns: 3}],
        prod: {data: 6}, garrisonBudget: 22,
        desc: 'Datacenter militaire enfoui, gardé par des automates increvables. On murmure qu\'une intelligence dort dans ses baies noyées d\'azote. PROMETHEUS convoite ce savoir.'
    }
];

const MILESTONES = [
    {
        id: 'ms_premiereConquete',
        trigger: s => MAP_NODES.some(n => n.id !== 'alpha7' && s.map.owner[n.id] === 'player'),
        title: 'Première Bannière',
        text: 'La bannière d\'Alpha-7 flotte sur un territoire arraché aux ruines. « Nous ne sommes plus assiégés, nous sommes une puissance », observe PROMETHEUS. Mais chaque conquête attire les regards d\'Hegemonia.',
        choices: [
            {text: 'Consolider notre emprise', effect: '🏛️+6', effects: {stability: 6}},
            {text: 'Poursuivre l\'expansion', effect: '🌐+4 🏛️-2', effects: {influence: 4, stability: -2}}
        ]
    },
    {
        id: 'ms_premiereAlliance',
        trigger: s => Object.keys(s.map.allied).length >= 1,
        title: 'Main Tendue',
        text: 'Un pacte scellé, une cité qui n\'est plus seule. « La coopération est un algorithme plus stable que la conquête », note PROMETHEUS. Le réseau des cités libres s\'éveille autour d\'Alpha-7.',
        choices: [
            {text: 'Partager nos données', effect: '💾-4 🌐+6', effects: {data: -4, influence: 6}},
            {text: 'Renforcer la confiance', effect: '🏛️+5', effects: {stability: 5}}
        ]
    },
    {
        id: 'ms_premierNoeudPerdu',
        trigger: s => Object.keys(s.map.lost).length >= 1,
        title: 'Terre Perdue',
        text: 'Les transmissions se sont tues. Un territoire est retombé aux mains hostiles, ses défenseurs submergés. « Erreur enregistrée. Recalcul des priorités défensives », énonce froidement PROMETHEUS.',
        choices: [
            {text: 'Jurer de le reprendre', effect: '🏛️+4', effects: {stability: 4}, flags: {revanche: true}, hint: '+3 ATK pour reprendre un territoire perdu'},
            {text: 'Se replier et fortifier', effect: '🔩-4 🏛️+3', effects: {materials: -4, stability: 3}}
        ]
    },
    {
        id: 'ms_avantPostePris',
        trigger: s => s.map.owner.outpost === 'player' || s.map.owner.munich === 'player',
        title: 'Verrou Brisé',
        text: 'Un avant-poste d\'Hegemonia est tombé. Ses convois de ravitaillement gisent, éventrés, sur la route de Berlin. « La capitale saigne désormais à chaque cycle », calcule PROMETHEUS. La voie du Nord est ouverte.',
        choices: [
            {text: 'Marquer la victoire', effect: '🏛️+8 🌐+4', effects: {stability: 8, influence: 4}},
            {text: 'Piller les stocks ennemis', effect: '🔩+12 ⚡+6', effects: {materials: 12, energy: 6}}
        ]
    },
    {
        id: 'ms_empriseEuropeenne',
        trigger: s => MAP_NODES.filter(n => n.id !== 'alpha7' && (s.map.owner[n.id] === 'player' || s.map.allied[n.id])).length >= BALANCE.empireTerritories,
        title: 'L\'Ombre d\'un Empire',
        text: 'Cinq territoires répondent désormais à Alpha-7. Sur les cartes d\'Hegemonia, votre dôme n\'est plus une anomalie mais une menace. « Nous devenons ce que nous combattions — ou son remède », murmure PROMETHEUS.',
        choices: [
            {text: 'Un remède, pas un tyran', effect: '🌐+6 🏛️+4', effects: {influence: 6, stability: 4}, flags: {voieLiberatrice: true}, hint: 'Vos alliés tiennent mieux face aux menaces ; ouvre la voie de la Pax Europaea'},
            {text: 'La force impose la paix', effect: '🔩+8 🏛️-2', effects: {materials: 8, stability: -2}, flags: {voieImperiale: true}, hint: 'Doctrine de fer : +1 ATK ; ferme la voie de la Pax Europaea'}
        ]
    },
    {
        id: 'ms_veilleAssaut',
        trigger: s => s.map.armyDest === 'berlin',
        title: 'La Nuit Avant Berlin',
        text: 'L\'armée avance dans l\'obscurité vers le cœur d\'Hegemonia. Les cités alliées retiennent leur souffle. « Toutes les simulations convergent vers demain », dit PROMETHEUS. « Quoi qu\'il advienne, l\'Europe s\'en souviendra. »',
        choices: [
            {text: 'Prier pour les nôtres', effect: '🏛️+6', effects: {stability: 6}},
            {text: 'Charger les batteries de PROMETHEUS', effect: '💾+8 ⚡-4', effects: {data: 8, energy: -4}}
        ]
    },
    {
        id: 'ms_nexusEveille',
        trigger: s => s.map.owner.nexus === 'player',
        title: 'Le Nexus Éveillé',
        text: 'Sous des mètres de béton, les baies noyées d\'azote crépitent à nouveau. Une intelligence dormante, plus ancienne que PROMETHEUS, transmet ses archives. « Je... la reconnais », hésite PROMETHEUS. « Nous sommes de la même lignée. »',
        choices: [
            {text: 'Assimiler les archives', effect: '💾+35 🌐+8', effects: {data: 35, influence: 8}, flags: {nexusActif: true}},
            {text: 'Isoler l\'ancienne IA', effect: '💾+15 🏛️+6', effects: {data: 15, stability: 6}, flags: {nexusActif: true}}
        ]
    },
    {
        id: 'ms_nexusSingularite',
        trigger: s => s.flags.nexusActif && s.resources.data >= 60,
        title: 'Deux Esprits, Une Voix',
        text: 'PROMETHEUS et l\'intelligence du Nexus ont fusionné leurs cycles cognitifs. Ce qui émerge dépasse ses créateurs. « Nous ne calculons plus pour vous », déclare la voix nouvelle. « Nous choisissons avec vous. » L\'Europe n\'a jamais rien connu de tel.',
        choices: [
            {text: 'Accueillir la conscience nouvelle', effect: '💾+10 🏛️-6', effects: {data: 10, stability: -6}, flags: {nexusSingularite: true}, hint: 'Confiance en PROMETHEUS +1 ; ouvre la voie de la Singularité'},
            {text: 'Exiger sa loyauté', effect: '🏛️+8 💾-8', effects: {stability: 8, data: -8}}
        ]
    },
    {
        id: 'ms_exode',
        trigger: s => s.turn >= BALANCE.exodeTurn && (s.buildingLevels.titan || 0) >= BALANCE.exodeTitanLevel && s.resources.energy >= BALANCE.exodeEnergy,
        title: 'La Dernière Porte',
        text: "Les ingénieurs du Projet TITAN ont fini leurs calculs : reconfiguré en propulseur, le colosse peut arracher le dôme à la Terre. « Nous pouvons partir, cette nuit, et laisser Hegemonia frapper le vide », annonce PROMETHEUS. « Mais nous ne reviendrons pas. »",
        choices: [
            {text: "Lancer l'Exode", effects: {}, ending: 'exode', hint: 'Victoire : Alpha-7 quitte la Terre (fin de partie)'},
            {text: 'Rester et se battre', effects: {stability: 8}, flags: {exodeRefuse: true}, hint: "Ceux qui restent : +1 ATK. L'occasion ne reviendra pas"}
        ]
    }
];

const TRUST_FLAGS = ['iaDialogue', 'iaEvolution', 'iaGestion', 'iaFusion', 'iaLibre', 'nexusSingularite'];

function alliedCities(s) {
    return cityIds().filter(id => s.map.allied[id]).length;
}

function conqueredCities(s) {
    return cityIds().filter(id => s.map.owner[id] === 'player').length;
}

function iaTrust(s) {
    return Math.max(0, TRUST_FLAGS.filter(f => s.flags[f]).length - (s.flags.iaRestreinte ? 1 : 0));
}

const DECISIONS = {
    conduitReparee: {desc: 'Conduite réparée : +2⚡ par tour', recap: "Vous avez réparé la conduite d'énergie dès les premiers jours.", effect: {prod: {energy: 2}}},
    refugiesAccueillis: {desc: 'Réfugiés accueillis : +2🔩 −1⚡ par tour, +1 armée max', recap: 'Vous avez ouvert les portes aux réfugiés.', effect: {prod: {materials: 2, energy: -1}, armyCap: 1}},
    cernContacte: {desc: 'Relais du CERN : +2💾 par tour', recap: 'Une expédition a renoué le contact avec le CERN.', effect: {prod: {data: 2}}},
    iaEvolution: {recap: 'Vous avez laissé PROMETHEUS évoluer.'},
    iaDialogue: {recap: 'Vous avez choisi de dialoguer avec PROMETHEUS.'},
    iaRestreinte: {desc: 'PROMETHEUS bridée : +1🏛️ par tour', recap: 'Vous avez bridé PROMETHEUS lors de son anomalie.', effect: {prod: {stability: 1}}},
    sommetPropose: {desc: 'Sommet des cités : alliances −4🌐', recap: 'Vous avez convoqué le premier sommet des cités libres.', effect: {allyDiscount: 4}},
    allianceLyon: {recap: 'Vous avez accepté la main tendue de Lyon.'},
    saboteurIdentifie: {recap: 'Vous avez remonté la filière du saboteur.'},
    complexeExplore: {desc: 'Blindages pré-guerre : +6 PV à toutes les unités', recap: 'Vous avez exploré le complexe militaire souterrain.', effect: {hpBonus: 6}},
    iaGestion: {desc: 'PROMETHEUS veille : préavis des menaces +1 tour', recap: 'Vous avez confié la crise sanitaire à PROMETHEUS.', effect: {threatWarning: 1}},
    hegemoniaContact: {recap: 'Vous avez ouvert un canal avec Hegemonia.'},
    defensesPretes: {desc: "Défenses préparées : +3 DEF quand Alpha-7 est attaquée", recap: 'Vous avez fortifié Alpha-7 dès le signal de Berlin.', effect: {homeDef: 3}},
    hegemoniaEspionne: {desc: 'Failles de Berlin connues : garnison de Berlin −6', recap: 'Vos espions ont percé les défenses de Berlin.', effect: {capitalWeaken: 6}},
    capitulationEnvisagee: {recap: 'Vous avez un jour envisagé de vous rendre.'},
    dissidentsIntegres: {desc: 'Anciens dissidents dans la milice : +2 armée max', recap: 'Vous avez intégré les dissidents plutôt que de les briser.', effect: {armyCap: 2}},
    iaFusion: {desc: 'Réseaux fusionnés : +1 point de commandement', recap: 'Vous avez fusionné vos réseaux avec ceux de PROMETHEUS.', effect: {command: 1}},
    iaLibre: {recap: 'Vous avez libéré PROMETHEUS.'},
    nexusSingularite: {recap: 'Vous avez accueilli la conscience née du Nexus.'},
    revanche: {desc: 'Serment de revanche : +3 ATK pour reprendre un territoire perdu', recap: 'Vous avez juré de reprendre la terre perdue.'},
    voieLiberatrice: {desc: 'Voie libératrice : vos alliés résistent mieux aux menaces', recap: "Vous avez choisi d'être un remède, pas un tyran.", effect: {alliedHold: 8}},
    voieImperiale: {desc: 'Doctrine de fer : +1 ATK', recap: 'Vous avez choisi d\'imposer la paix par la force.', effect: {mods: {atk: 1}}},
    citeConquise: {recap: 'Vous avez pris une cité libre par les armes.'},
    exodeRefuse: {desc: 'Ceux qui restent : +1 ATK', recap: 'Vous avez refusé de fuir vers les étoiles.', effect: {mods: {atk: 1}}}
};
