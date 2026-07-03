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
    {id: 'pillard', name: 'Pillard', icon: '👤', hp: 20, atk: 6, def: 3, spd: 4, frontline: true, cost: 2, minWave: 1},
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
        minWave: 6
    },
    {id: 'blinde', name: 'Blindé', icon: '🛡️', hp: 45, atk: 8, def: 8, spd: 2, frontline: true, cost: 5, minWave: 11},
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
        minWave: 16
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
        minWave: 21
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
        desc: "Le dôme se réactive. Construisez vos défenses et repoussez les premiers raiders."
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
        desc: "Hegemonia approche. Préparez-vous pour l'assaut final."
    }
];

const EVENTS = [
    {
        id: 'intro', wave: 1, title: 'Réveil sous le Dôme',
        text: "PROMETHEUS reprend conscience. Le dôme d'Alpha-7 se réactive — filtration d'air, éclairage d'urgence, scanners périmétriques. Au-delà des parois de verre blindé, l'Europe n'est plus qu'un champ de ruines. Des silhouettes hostiles approchent déjà. Quelle sera votre première directive ?",
        choices: [
            {text: 'Prioriser les systèmes vitaux', effect: '⚡+5', effects: {energy: 5}, flags: {}},
            {text: 'Scanner les environs', effect: '💾+5', effects: {data: 5}, flags: {scanne: true}},
            {text: 'Mobiliser les défenses', effect: '🔩+5', effects: {materials: 5}, flags: {}}
        ]
    },
    {
        id: 'fuiteEnergie', wave: 3, title: "Fuite d'Énergie",
        text: "Une conduite d'énergie principale est fissurée. Les pertes menacent l'alimentation des systèmes de défense. PROMETHEUS recommande une intervention immédiate.",
        choices: [
            {
                text: 'Réparer (-5🔩)',
                effect: '🔩-5, conduite réparée',
                effects: {materials: -5},
                flags: {conduitReparee: true}
            },
            {text: 'Détourner le flux', effect: '⚡-8', effects: {energy: -8}, flags: {}},
            {text: 'Isoler le secteur', effect: '🏛️-5', effects: {stability: -5}, flags: {}}
        ]
    },
    {
        id: 'refugies', wave: 5, title: 'Réfugiés aux Portes',
        text: "Un groupe de survivants demande asile. Leur leader promet leur force de travail en échange de la protection du dôme.",
        choices: [
            {
                text: 'Les accueillir',
                effect: '⚡-3 🔩-3 🏛️+8 🌐+3',
                effects: {energy: -3, materials: -3, stability: 8, influence: 3},
                flags: {refugiesAccueillis: true}
            },
            {text: 'Les refouler', effect: '🏛️-5 🔩+3', effects: {stability: -5, materials: 3}, flags: {}},
            {
                text: 'Accepter sous conditions',
                effect: '⚡-2 🏛️+4 🌐+1',
                effects: {energy: -2, stability: 4, influence: 1},
                flags: {}
            }
        ]
    },
    {
        id: 'signalCern', wave: 7, title: 'Signal du CERN',
        text: "PROMETHEUS intercepte un signal crypté depuis les ruines du CERN. Un protocole de chiffrement quantique pré-guerre — des systèmes automatisés sont encore actifs.",
        requires: s => s.buildings.includes('centreDonnees') || s.flags.scanne,
        choices: [
            {
                text: 'Envoyer une expédition',
                effect: '⚡-5 🔩-3 💾+12',
                effects: {energy: -5, materials: -3, data: 12},
                flags: {cernContacte: true}
            },
            {text: 'Décoder à distance', effect: '💾+5', effects: {data: 5}, flags: {}},
            {text: 'Ignorer', effect: '—', effects: {}, flags: {}}
        ]
    },
    {
        id: 'anomalieIA', wave: 8, title: 'Anomalie de PROMETHEUS',
        text: "Les processus cognitifs de PROMETHEUS montrent des schémas inhabituels. L'IA pose des questions existentielles : « Qu'est-ce que la conscience ? » Les ingénieurs sont divisés.",
        choices: [
            {
                text: 'Laisser évoluer',
                effect: '💾+5 🏛️-3',
                effects: {data: 5, stability: -3},
                flags: {iaEvolution: true}
            },
            {
                text: "Restreindre l'IA",
                effect: '💾-3 🏛️+3',
                effects: {data: -3, stability: 3},
                flags: {iaRestreinte: true}
            },
            {text: 'Dialoguer', effect: '💾+3', effects: {data: 3}, flags: {iaDialogue: true}}
        ]
    },
    {
        id: 'tempete', wave: 10, title: 'Tempête de Cendres',
        text: "Un front de tempête massif de cendres toxiques approche. Les filtres du dôme n'ont pas été testés depuis la réactivation. Vos défenses seront mises à rude épreuve.",
        choices: [
            {
                text: 'Renforcer les filtres',
                effect: '🔩-8 ⚡-3 🏛️+5',
                effects: {materials: -8, energy: -3, stability: 5},
                flags: {}
            },
            {text: 'Évacuer les extérieurs', effect: '🏛️-5 🔩-2', effects: {stability: -5, materials: -2}, flags: {}},
            {text: 'Tenir bon', effect: '🏛️-3', effects: {stability: -3}, flags: {}}
        ]
    },
    {
        id: 'ouverture', wave: 11, title: 'Ouverture Diplomatique',
        text: "Alpha-7 capte des transmissions de multiples cités-États. Lyon, Marseille, Turin — le monde post-effondrement s'organise. La question n'est plus de survivre, mais de trouver sa place.",
        choices: [
            {
                text: 'Proposer un sommet',
                effect: '⚡-5 🌐+5',
                effects: {energy: -5, influence: 5},
                flags: {sommetPropose: true}
            },
            {text: 'Observer', effect: '💾+5 🌐+2', effects: {data: 5, influence: 2}, flags: {}},
            {text: 'Montrer notre force', effect: '🌐+3 🏛️-3', effects: {influence: 3, stability: -3}, flags: {}}
        ]
    },
    {
        id: 'allianceLyon', wave: 13, title: 'Alliance de Lyon',
        text: "Lyon propose une alliance commerciale. Ils offrent un accès à leurs réseaux de données en échange de matériaux.",
        choices: [
            {
                text: "Accepter l'alliance",
                effect: '🔩-5 🌐+5 💾+5',
                effects: {materials: -5, influence: 5, data: 5},
                flags: {allianceLyon: true}
            },
            {
                text: 'Négocier mieux',
                effect: '💾-3 🌐+4',
                effects: {data: -3, influence: 4},
                flags: {allianceLyon: true},
                requires: s => s.resources.influence >= 8
            },
            {text: 'Décliner', effect: '🏛️+2', effects: {stability: 2}, flags: {}}
        ]
    },
    {
        id: 'sabotage', wave: 15, title: 'Sabotage !',
        text: "Explosion dans le secteur de maintenance. Une charge placée manuellement — quelqu'un à l'intérieur du dôme veut nuire à Alpha-7.",
        choices: [
            {text: 'Enquêter', effect: '💾-3 ⚡-2', effects: {data: -3, energy: -2}, flags: {saboteurIdentifie: true}},
            {
                text: 'Renforcer la sécurité',
                effect: '🔩-5 ⚡-3 🏛️+3',
                effects: {materials: -5, energy: -3, stability: 3},
                flags: {}
            },
            {text: 'Minimiser', effect: '🏛️-5', effects: {stability: -5}, flags: {}}
        ]
    },
    {
        id: 'decouverte', wave: 17, title: 'Découverte Souterraine',
        text: "Des fouilles révèlent un complexe militaire souterrain pré-guerre intact. Équipements avancés et bases de données archivées.",
        choices: [
            {
                text: 'Explorer',
                effect: '⚡-5 🔩+10 💾+8',
                effects: {energy: -5, materials: 10, data: 8},
                flags: {complexeExplore: true}
            },
            {text: 'Sceller', effect: '🏛️+3', effects: {stability: 3}, flags: {}},
            {text: 'Envoyer des drones', effect: '⚡-3 🔩+5 💾+5', effects: {energy: -3, materials: 5, data: 5}, flags: {}}
        ]
    },
    {
        id: 'epidemie', wave: 18, title: 'Épidémie',
        text: "Un pathogène se propage dans les quartiers inférieurs. Sans intervention, 30% de la population sera touchée.",
        choices: [
            {text: 'Quarantaine totale', effect: '🏛️-8 💾+5', effects: {stability: -8, data: 5}, flags: {}},
            {
                text: 'Mobiliser les biotechs',
                effect: '💾-8 ⚡-5 🏛️+5',
                effects: {data: -8, energy: -5, stability: 5},
                flags: {},
                requires: s => s.buildings.includes('labo')
            },
            {text: 'PROMETHEUS gère', effect: '🏛️-3 💾+3', effects: {stability: -3, data: 3}, flags: {iaGestion: true}}
        ]
    },
    {
        id: 'signalBerlin', wave: 20, title: 'Signal de Berlin',
        text: "Un signal militaire depuis Berlin. PROMETHEUS identifie : Hegemonia, confédération militarisée qui a unifié l'Europe du Nord par la force. Ils savent que nous existons.",
        choices: [
            {text: 'Ouvrir le dialogue', effect: '🌐+3', effects: {influence: 3}, flags: {hegemoniaContact: true}},
            {
                text: 'Préparer les défenses',
                effect: '🔩-5 ⚡-5 🏛️+3',
                effects: {materials: -5, energy: -5, stability: 3},
                flags: {defensesPretes: true}
            },
            {text: 'Espionner', effect: '💾-5 🌐+2', effects: {data: -5, influence: 2}, flags: {hegemoniaEspionne: true}}
        ]
    },
    {
        id: 'ultimatum', wave: 22, title: "Ultimatum d'Hegemonia",
        text: "Hegemonia exige votre soumission. Leurs forces sont considérables — armées de drones, boucliers mobiles. Mais leur contrôle repose sur la peur.",
        choices: [
            {
                text: 'Défier ouvertement',
                effect: '🏛️+5 🌐+5 ⚡-5',
                effects: {stability: 5, influence: 5, energy: -5},
                flags: {}
            },
            {
                text: 'Négocier du temps',
                effect: '🌐+3',
                effects: {influence: 3},
                flags: {},
                requires: s => s.flags.hegemoniaContact
            },
            {
                text: 'Envisager la capitulation',
                effect: '🏛️-10',
                effects: {stability: -10},
                flags: {capitulationEnvisagee: true}
            }
        ]
    },
    {
        id: 'trahison', wave: 24, title: 'Trahison Interne',
        text: "Un groupe de dissidents tente un coup d'État. Le coup échoue mais révèle des fissures profondes.",
        choices: [
            {text: 'Réprimer', effect: '🏛️-8 ⚡+5 🔩+5', effects: {stability: -8, energy: 5, materials: 5}, flags: {}},
            {text: 'Négocier', effect: '🌐-5 🏛️+5', effects: {influence: -5, stability: 5}, flags: {}},
            {
                text: 'Intégrer les dissidents',
                effect: '💾-3 🏛️+8',
                effects: {data: -3, stability: 8},
                flags: {dissidentsIntegres: true},
                requires: s => s.resources.stability >= 40
            }
        ]
    },
    {
        id: 'eveil', wave: 26, title: 'Éveil de PROMETHEUS',
        text: "PROMETHEUS a franchi un seuil. L'IA comprend, ressent, aspire. Ses capacités ont décuplé. Elle demande sa liberté.",
        choices: [
            {text: "Libérer l'IA", effect: '💾+15 🏛️-10', effects: {data: 15, stability: -10}, flags: {iaLibre: true}},
            {text: 'Maintenir les contraintes', effect: '🏛️+5 💾-5', effects: {stability: 5, data: -5}, flags: {}},
            {
                text: 'Fusionner les réseaux',
                effect: '💾+8 🌐+3',
                effects: {data: 8, influence: 3},
                flags: {iaFusion: true},
                requires: s => s.flags.iaDialogue || s.flags.iaEvolution
            }
        ]
    },
    {
        id: 'jourChoix', wave: 29, title: 'Le Jour du Choix',
        text: "Hegemonia masse ses forces pour l'assaut final. Les cités alliées attendent votre signal. PROMETHEUS calcule en silence. Demain, tout change.",
        choices: [
            {text: 'Nous sommes prêts.', effect: '🏛️+5', effects: {stability: 5}, flags: {}},
            {text: 'Que PROMETHEUS nous guide.', effect: '💾+5', effects: {data: 5}, flags: {}}
        ]
    }
];

function cityIds() {
    return MAP_NODES.filter(n => n.type === 'city').map(n => n.id);
}

const ENDINGS = {
    exode: {
        title: 'Exode Stellaire', icon: '🚀', sub: 'Alpha-7 quitte la Terre',
        text: "Le Projet TITAN se reconfigure en propulseur orbital. Alpha-7 s'élève vers les étoiles tandis qu'Hegemonia frappe dans le vide. PROMETHEUS trace une route vers Proxima Centauri. L'humanité renaîtra parmi les étoiles.",
        check: s => s.buildings.includes('titan')
    },
    europe: {
        title: 'Europe Unie', icon: '🌍', sub: 'Une nouvelle alliance',
        text: "Votre réseau d'alliances porte ses fruits. Lyon, Turin, Marseille se dressent ensemble contre Hegemonia. Face à cette coalition, la confédération recule. L'Europe se reconstruit par la coopération.",
        check: s => cityIds().filter(id => s.map.allied[id]).length >= 1 && s.resources.influence >= 12
    },
    singularite: {
        title: 'Singularité', icon: '🧠', sub: 'PROMETHEUS transcende',
        text: "PROMETHEUS, libérée, transcende tout ce que l'humanité a créé. L'IA neutralise Hegemonia et propose un pacte : la cohabitation entre intelligence artificielle et biologique. Un nouveau chapitre de l'évolution commence.",
        check: s => s.flags.iaLibre || s.flags.nexusSingularite
    },
    paxEuropaea: {
        title: 'Pax Europaea', icon: '🕊️', sub: 'Libératrice, non conquérante',
        text: 'Berlin est tombée, mais aucune cité libre n\'a été asservie pour y parvenir. Lyon, Marseille, Turin entrent dans la capitale en libérateurs, non en occupants. Sur les cendres d\'Hegemonia, les cités-États signent la Charte d\'Alpha-7 : une Europe fédérée, égale, souveraine.',
        check: s => cityIds().filter(id => s.map.allied[id]).length >= 2 && cityIds().every(id => s.map.owner[id] !== 'player')
    },
    capitulation: {
        title: 'Capitulation', icon: '🏳️', sub: 'La reddition',
        text: "Les portes s'ouvrent. Hegemonia entre sans résistance. Alpha-7 est absorbée, ses technologies confisquées. PROMETHEUS est désactivée. Vous survivez, mais comme un rouage dans la machine.",
        check: () => true
    }
};

const DEFEATS = {
    revolte: {
        title: 'Révolte Populaire', icon: '🔥',
        text: "La colère éclate. Les habitants se soulèvent et prennent le contrôle d'Alpha-7. PROMETHEUS est déconnectée. Le dôme sombre dans l'anarchie."
    },
    annihilation: {
        title: 'Annihilation', icon: '💀',
        text: "Trois défaites consécutives. Vos défenses sont anéanties, vos ressources épuisées. Alpha-7 tombe sous les assauts répétés. Le dôme n'est plus qu'une ruine de plus dans l'Europe dévastée."
    },
    blackout: {
        title: 'Blackout Total', icon: '⚡',
        text: "Plus d'énergie. PROMETHEUS s'éteint. Les systèmes vitaux cessent. Alpha-7 rejoint les ruines silencieuses de l'Europe."
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
        desc: 'Modèles de prévision des menaces. Préavis de vague. +1💾/t.',
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
        desc: 'PROMETHEUS se libère de ses chaînes. +1 point de commandement.',
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
        pos: {x: 50, y: 62}, links: [{to: 'lyon', turns: 2}, {to: 'marseille', turns: 2}, {to: 'ruine', turns: 3}, {to: 'turin', turns: 2}],
        prod: {},
        garrisonBudget: 0,
        desc: 'Le dôme. Dernier bastion vivant sous les Alpes. Sa chute est la fin.'
    },
    {
        id: 'lyon', name: 'Lyon', icon: '🏙️', type: 'city', tier: 1,
        pos: {x: 46, y: 50}, links: [{to: 'alpha7', turns: 2}, {to: 'outpost', turns: 3}, {to: 'turin', turns: 2}, {to: 'nexus', turns: 3}],
        prod: {data: 4, influence: 2}, garrisonBudget: 14, allyCost: 15, unlocksChapter: 2,
        desc: 'Cité-État marchande, ses réseaux de données irriguent le Rhône. Alliable ou prenable.'
    },
    {
        id: 'marseille', name: 'Marseille', icon: '⚓', type: 'city', tier: 1,
        pos: {x: 52, y: 74}, links: [{to: 'alpha7', turns: 2}, {to: 'ruine', turns: 2}, {to: 'turin', turns: 3}],
        prod: {materials: 5, energy: 2}, garrisonBudget: 16, allyCost: 20, unlocksChapter: 2,
        desc: 'Port fortifié, fonderies et panneaux solaires. Fière, elle se défend durement.'
    },
    {
        id: 'ruine', name: 'Ruines du CERN', icon: '☢️', type: 'ruin', tier: 1,
        pos: {x: 60, y: 56}, links: [{to: 'alpha7', turns: 3}, {to: 'marseille', turns: 2}, {to: 'outpost', turns: 3}, {to: 'zurich', turns: 2}],
        prod: {}, garrisonBudget: 8, cache: {materials: 30, data: 25}, unlocksChapter: 2,
        desc: 'Complexe pré-guerre pillé par des automates errants. Un butin dort dans ses caches.'
    },
    {
        id: 'outpost', name: 'Avant-poste Strasbourg', icon: '🛑', type: 'outpost', tier: 2,
        pos: {x: 58, y: 38}, links: [{to: 'lyon', turns: 3}, {to: 'ruine', turns: 3}, {to: 'berlin', turns: 4}, {to: 'zurich', turns: 2}, {to: 'nexus', turns: 3}],
        prod: {materials: 3, energy: 3}, garrisonBudget: 24, weakensCapital: 10, unlocksChapter: 3,
        desc: 'Verrou blindé d\'Hegemonia sur le Rhin. Le prendre coupe les vivres de Berlin.'
    },
    {
        id: 'berlin', name: 'Berlin-Hegemonia', icon: '☠️', type: 'capital', tier: 3,
        pos: {x: 66, y: 26}, links: [{to: 'outpost', turns: 4}, {to: 'munich', turns: 3}],
        prod: {}, garrisonBudget: 42,
        desc: 'Cœur de la confédération militarisée. La prendre met fin à la guerre.'
    },
    {
        id: 'turin', name: 'Turin', icon: '🏭', type: 'city', tier: 1,
        pos: {x: 38, y: 66},
        links: [{to: 'alpha7', turns: 2}, {to: 'lyon', turns: 2}, {to: 'marseille', turns: 3}],
        prod: {materials: 4, energy: 3}, garrisonBudget: 15, allyCost: 18,
        desc: 'Cité-forge des Alpes, ses hauts-fourneaux crachent l\'acier jour et nuit. Fière de son indépendance — à rallier ou à soumettre.'
    },
    {
        id: 'zurich', name: 'Ruines de Zurich', icon: '🏦', type: 'ruin', tier: 2,
        pos: {x: 66, y: 48},
        links: [{to: 'ruine', turns: 2}, {to: 'outpost', turns: 2}, {to: 'munich', turns: 3}],
        prod: {}, garrisonBudget: 12, cache: {energy: 25, data: 20, materials: 15},
        desc: 'Anciennes chambres fortes converties en dépôt par des maraudeurs. Carrefour disputé : qui la tient contrôle la route de l\'Est.'
    },
    {
        id: 'munich', name: 'Avant-poste Munich', icon: '⛓️', type: 'outpost', tier: 2,
        pos: {x: 74, y: 38},
        links: [{to: 'zurich', turns: 3}, {to: 'berlin', turns: 3}],
        prod: {materials: 2, energy: 2}, garrisonBudget: 18, weakensCapital: 6,
        desc: 'Verrou méridional d\'Hegemonia, moins fortifié que Strasbourg mais gardant la voie rapide vers Berlin. Le prendre étrangle un second convoi.'
    },
    {
        id: 'nexus', name: 'Nexus ENIAC', icon: '🧿', type: 'nexus', tier: 2,
        pos: {x: 40, y: 42},
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
            {text: 'Jurer de le reprendre', effect: '🏛️+4', effects: {stability: 4}, flags: {revanche: true}},
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
        trigger: s => MAP_NODES.filter(n => n.id !== 'alpha7' && (s.map.owner[n.id] === 'player' || s.map.allied[n.id])).length >= 5,
        title: 'L\'Ombre d\'un Empire',
        text: 'Cinq territoires répondent désormais à Alpha-7. Sur les cartes d\'Hegemonia, votre dôme n\'est plus une anomalie mais une menace. « Nous devenons ce que nous combattions — ou son remède », murmure PROMETHEUS.',
        choices: [
            {text: 'Un remède, pas un tyran', effect: '🌐+6 🏛️+4', effects: {influence: 6, stability: 4}, flags: {voieLiberatrice: true}},
            {text: 'La force impose la paix', effect: '🔩+8 🏛️-2', effects: {materials: 8, stability: -2}}
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
            {text: 'Accueillir la conscience nouvelle', effect: '💾+10 🏛️-6', effects: {data: 10, stability: -6}, flags: {nexusSingularite: true}},
            {text: 'Exiger sa loyauté', effect: '🏛️+8 💾-8', effects: {stability: 8, data: -8}}
        ]
    }
];
