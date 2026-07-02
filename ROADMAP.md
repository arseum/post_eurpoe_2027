# Post-Europe 2147 — Roadmap

## Interface / UX
- [x] Tooltip au survol des unités avec description complète
- [x] Animation de transition entre phase de préparation et combat
- [x] Indicateur visuel quand la stabilité est critique (clignotement, alerte)
- [ ] Son / effets sonores (Web Audio API)
- [ ] Historique des vagues passées (résultats, pertes)

## Gameplay / équilibrage
- [ ] Système de difficulté (facile / normal / difficile) qui scale le budget des vagues
- [ ] Unités ennemies avec capacités spéciales (soin, bouclier, AoE)
- [ ] Compétences actives pour les unités joueur (utilisables manuellement avant le combat)
- [ ] Système d'expérience : les unités qui survivent gagnent des niveaux entre les vagues
- [ ] Événements aléatoires entre vagues (pas seulement scriptés)

## Stratégie / profondeur
- [ ] Arbre de technologies (débloquer des améliorations passives via les données)
- [ ] Positions sur le champ de bataille (ligne avant / arrière configurables par le joueur)
- [ ] Système d'équipement ou d'améliorations achetables par unité
- [ ] Événements qui ont des conséquences permanentes sur les stats (pas seulement les ressources)
- [ ] Mode "siège" : certaines vagues attaquent plusieurs tours de suite

## Contenu narratif
- [ ] Fins multiples avec épilogue illustré (texte + visuel CSS)
- [ ] Journaux audio de PROMETHEUS entre les chapitres
- [ ] Événements conditionnels selon les bâtiments construits (plus de `requires`)
- [ ] Mémoire narrative : les choix passés modifient le texte des événements suivants

## Technique
- [ ] Sauvegarde multiple (3 slots)
- [ ] Export / import de sauvegarde (JSON en base64)
- [ ] Mode hors-ligne complet (PWA / manifest)
- [ ] Statistiques de fin de partie plus détaillées (dégâts infligés, unités perdues, etc.)
