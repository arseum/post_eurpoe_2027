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

const ENDINGS = {
    exode: {
        title: 'Exode Stellaire', icon: '🚀', sub: 'Alpha-7 quitte la Terre',
        text: "Le Projet TITAN se reconfigure en propulseur orbital. Alpha-7 s'élève vers les étoiles tandis qu'Hegemonia frappe dans le vide. PROMETHEUS trace une route vers Proxima Centauri. L'humanité renaîtra parmi les étoiles.",
        check: s => s.buildings.includes('titan')
    },
    europe: {
        title: 'Europe Unie', icon: '🌍', sub: 'Une nouvelle alliance',
        text: "Votre réseau d'alliances porte ses fruits. Lyon, Turin, Marseille se dressent ensemble contre Hegemonia. Face à cette coalition, la confédération recule. L'Europe se reconstruit par la coopération.",
        check: s => (s.flags.allianceLyon || s.flags.sommetPropose) && s.resources.influence >= 15
    },
    singularite: {
        title: 'Singularité', icon: '🧠', sub: 'PROMETHEUS transcende',
        text: "PROMETHEUS, libérée, transcende tout ce que l'humanité a créé. L'IA neutralise Hegemonia et propose un pacte : la cohabitation entre intelligence artificielle et biologique. Un nouveau chapitre de l'évolution commence.",
        check: s => s.flags.iaLibre
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
