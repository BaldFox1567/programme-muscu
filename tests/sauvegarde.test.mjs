// Schéma de sauvegarde : migration v1 → v2, validation, données jamais perdues.
// Lancer : node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charger, brut } from './charger.mjs';

const L = charger();
const eq = (a, b, msg) => assert.deepEqual(brut(a), brut(b), msg);

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

test('migration v1 → v2 : journal, références, séances et réglages intacts', () => {
  const v1 = sauvegardeV1(), avant = JSON.stringify(v1);
  const m = L.migrate(v1);
  assert.equal(m.from, 1); assert.equal(m.newer, false); eq(m.notes, []);
  assert.equal(m.s.v, 2); assert.equal(m.s.ts, 0); assert.equal(m.s.exportAt, 0);
  for (const f of ['view', 'week', 'day', 'start', 'logs', 'refs', 'pinned', 'autoRest', 'timer', 'sessions']) eq(m.s[f], v1[f], f);
  assert.equal(JSON.stringify(v1), avant, "l'original n'est pas modifié");
});

test('migration : une sauvegarde v2 repasse sans changement', () => {
  const s2 = L.migrate(sauvegardeV1()).s;
  eq(L.migrate(brut(s2)).s, s2);
  assert.equal(L.migrate(brut(s2)).from, 2);
});

test('migration : version plus récente reconnue, jamais réécrite', () => {
  const m = L.migrate({ v: 99, logs: {} });
  assert.equal(m.newer, true);
  assert.throws(() => L.migrate({ v: 'x' }));
  assert.throws(() => L.migrate(null)); assert.throws(() => L.migrate([]));
});

test('migration : champs d\'interface invalides remis par défaut, données gardées', () => {
  const m = L.migrate({ day: 'mer', week: '5', start: 'nimporte', view: 'xx', timer: { end: 'x' }, autoRest: 'oui',
    logs: { '2|mer|bench|0': { w: '40', r: '8', ok: true } } });
  assert.equal(m.s.day, 'lun'); assert.equal(m.s.week, 5); assert.equal(m.s.start, '2026-09-14');
  assert.equal(m.s.view, 'today'); assert.equal(m.s.timer, null); assert.equal(m.s.autoRest, true);
  eq(m.s.logs, { '2|mer|bench|0': { w: '40', r: '8', ok: true } }, 'une série d\'un jour inconnu reste dans le journal');
  assert.ok(m.notes.some(n => /Jour affiché inconnu/.test(n)));
});

test('migration : rien n\'est jeté, l\'illisible est mis de côté', () => {
  const m = L.migrate({ logs: { '1|lun|bench|0': { w: '60' }, '1|lun|bench|1': 'cassé' }, refs: 'cassé', sessions: null });
  eq(m.s.logs, { '1|lun|bench|0': { w: '60' } });
  eq(m.s._logs_invalides, { '1|lun|bench|1': 'cassé' });
  assert.equal(m.s._refs_invalide, 'cassé'); eq(m.s.refs, {}); eq(m.s.sessions, {});
  assert.equal(m.notes.length, 2);
});

test('defaults : état vide valide pour la migration', () => {
  eq(L.migrate(L.defaults()).s, L.defaults());
});

test('sauvegarde fichier : aller-retour sans perte', () => {
  const s = L.migrate(sauvegardeV1()).s;
  const txt = L.backupText(s, Date.UTC(2026, 10, 4, 15, 0));
  const r = L.parseBackup(txt);
  eq(r.s, s); assert.equal(r.exporte, '2026-11-04T15:00:00.000Z');
  eq(r.info, { series: 54, cochees: 53, semaines: 6, de: 1, a: 6, seances: 1 }, '6|lun|bench|2 remplace une série cochée par une saisie non cochée');
});

test('sauvegarde fichier : accepte un état brut v1 (copie de secours, ancienne sauvegarde)', () => {
  const r = L.parseBackup('﻿' + JSON.stringify(sauvegardeV1()));
  assert.equal(r.s.v, 2); assert.equal(r.exporte, null);
  eq(r.s.logs, sauvegardeV1().logs);
});

test('sauvegarde fichier : refus explicites, jamais d\'état partiel', () => {
  assert.throws(() => L.parseBackup('pas du json'), /lisible/);
  assert.throws(() => L.parseBackup('{"a":1}'), /journal/);
  assert.throws(() => L.parseBackup('[]'), /journal/);
  assert.throws(() => L.parseBackup(JSON.stringify({ app: 'muscu-programme', etat: null })), /abîmée/);
  assert.throws(() => L.parseBackup(JSON.stringify({ v: 9, logs: {} })), /plus récente/);
});

test('export texte : lundi avant jeudi, exercice ou jour inconnu sans planter', () => {
  const t = L.exportText({ logs: {
    '1|jeu|squat|0': { w: '50', r: '8', ok: true },
    '1|lun|bench|1': { w: '60', r: '7' },
    '1|lun|bench|0': { w: '60', r: '8', ok: true },
    '1|lun|ancien_exo|0': { w: '10', r: '10' },
    '1|mer|bench|0': { w: '40' },
    '3|mar|pullup_band|b': { v: 'noir' }, '3|mar|pullup_band|0': { r: '6', ok: true },
  }, refs: {} });
  const l = t.split('\n');
  assert.equal(l[0], 'S1 Lundi – ancien_exo : 10×10');
  assert.equal(l[1], 'S1 Lundi – Développé couché barre : 60×8✓, 60×7');
  assert.equal(l[2], 'S1 Jeudi – Squat barre (réintroduction) : 50×8✓');
  assert.equal(l[3], 'S1 mer – Développé couché barre : 40×—');
  assert.match(l[4], /S3 Mardi – Tractions assistées \(élastique\) \[élastique noir\] : —×6✓/);
});
