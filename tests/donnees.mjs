// Données de test partagées par les tests unitaires et outils/verifier.mjs

// Sauvegarde v1 réaliste : telle que l'écrit la version d'origine (sans champ v)
export function sauvegardeV1() {
  const logs = {};
  for (let w = 1; w <= 6; w++) for (const [d, ex] of [['lun', 'bench'], ['mar', 'pullup_band'], ['jeu', 'squat']])
    for (let i = 0; i < 3; i++) logs[`${w}|${d}|${ex}|${i}`] = { w: String(50 + w * 2.5).replace('.', ','), r: String(6 + i), ok: true };
  logs['3|mar|pullup_band|b'] = { v: 'noir épais' };
  logs['6|lun|bench|2'] = { w: '60' }; // série saisie mais pas cochée
  return {
    view: 'year', week: 6, day: 'mar', start: '2026-09-14', logs, refs: { bench: '60×8', bw: '75,5' }, pinned: false,
    autoRest: false, timer: { end: 1790000000000, dur: 120, label: 'Rowing', next: '', kind: 'rest' },
    sessions: { '6|lun': { t0: 1789000000000, t1: 1789002700000 } },
  };
}
