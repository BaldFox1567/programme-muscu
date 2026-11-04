// Logique du programme : semaines, blocs, décharges, ordre des séries, supersets, historique.
// Lancer : node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charger, brut } from './charger.mjs';

const L = charger();
const D = s => new Date(s);
const eq = (a, b, msg) => assert.deepEqual(brut(a), brut(b), msg);

test('weekOf : semaine du programme depuis le lundi de début', () => {
  const st = '2026-09-14';
  assert.equal(L.weekOf(st, D('2026-09-14T00:00:00')), 1);
  assert.equal(L.weekOf(st, D('2026-09-20T23:59:00')), 1);
  assert.equal(L.weekOf(st, D('2026-09-21T00:00:00')), 2);
  assert.equal(L.weekOf(st, D('2026-10-15T10:00:00')), 5);
  assert.equal(L.weekOf(st, D('2026-01-01T10:00:00')), 1, 'avant le début : semaine 1');
  assert.equal(L.weekOf(st, D('2028-01-01T10:00:00')), 52, 'après la fin : semaine 52');
  assert.equal(L.weekOf('', D('2026-10-15T10:00:00')), 1, 'date vide : semaine 1');
});

test('blockOf : chaque semaine appartient à un seul bloc, la décharge ferme chaque bloc', () => {
  for (let w = 1; w <= 52; w++) {
    const n = L.BLOCKS.filter(b => w >= b.w[0] && w <= b.w[1]).length;
    assert.equal(n, 1, `semaine ${w}`);
  }
  assert.equal(L.blockOf(6).n, 1); assert.equal(L.blockOf(7).n, 2); assert.equal(L.blockOf(52).n, 7);
  eq(L.DELOADS, L.BLOCKS.map(b => b.w[1]));
});

test('plan : chaque exercice existe, aucun exercice deux fois dans une séance', () => {
  // Le journal est indexé semaine|jour|exercice|série : un doublon dans une séance mélangerait deux postes
  for (const n in L.PLAN) for (const d of L.DAYS) {
    const xs = L.PLAN[n][d].flatMap(it => (it.ss || [it]).map(x => typeof x === 'string' ? x : x.ex));
    xs.forEach(x => assert.ok(L.EX[x], `bloc ${n} ${d} : ${x} inconnu`));
    assert.equal(new Set(xs).size, xs.length, `bloc ${n} ${d} : doublon`);
  }
});

test('mergedEx : surcharges du bloc, décharge = séries ÷ 2 arrondi au-dessus et RIR 4, fiche intacte', () => {
  const sq = L.mergedEx(L.PLAN[1].jeu[0], 3);
  assert.equal(sq.sets, 4); assert.equal(sq.reps, '5-8'); assert.equal(sq.deload, undefined);
  const dl = L.mergedEx(L.PLAN[1].jeu[0], 6);
  assert.equal(dl.sets, 2); assert.equal(dl.rir, '4'); assert.equal(dl.deload, true);
  assert.equal(L.mergedEx('bench', 6).sets, 2, '3 séries → 2');
  assert.equal(L.EX.bench.sets, 3, 'la fiche n\'est pas modifiée');
});

test('buildModel : postes, repères de superset et repos', () => {
  const M = L.buildModel(1, 'lun');
  assert.equal(M.length, 4);
  assert.equal(M[2].ss, true); assert.equal(M[2].rest, 75);
  eq(M[2].exs.map(m => m.tag), ['3·A1', '3·A2']);
  assert.equal(M[0].rest, 150, 'poste simple : repos de la fiche');
});

test('seqOf : un superset alterne A1, A2, A1, A2', () => {
  const P = { ss: true, exs: [{ ex: 'a', sets: 3 }, { ex: 'b', sets: 2 }] };
  eq(L.seqOf(P).map(([m, i]) => m.ex + i), ['a0', 'b0', 'a1', 'b1', 'a2']);
  const S = { ss: false, exs: [{ ex: 'a', sets: 2 }] };
  eq(L.seqOf(S).map(([m, i]) => m.ex + i), ['a0', 'a1']);
});

test('progressOf : séries cochées de la séance seulement', () => {
  const M = L.buildModel(2, 'lun');
  const logs = { '2|lun|bench|0': { ok: true }, '2|lun|bench|1': { w: '60' }, '2|mar|bench|0': { ok: true } };
  eq(L.progressOf(M, logs, 2, 'lun'), { done: 1, total: 15 }, 'bloc 1 lundi : 3+3+3+3+3 séries');
});

test('lastTimeIn : semaine précédente la plus récente, hors décharge, même jour à égalité', () => {
  const logs = {
    '4|lun|bench|0': { w: '60', r: '8' },
    '5|lun|bench|0': { w: '62,5', r: '8' }, '5|lun|bench|1': { w: '62,5', r: '7' },
    '6|lun|bench|0': { w: '50', r: '5' },       // décharge
    '8|lun|bench|0': { w: '70', r: '6' },       // semaine future
    '5|lun|pullup_band|b': { v: 'noir' },
  };
  const lt = L.lastTimeIn(logs, 'bench', 7, 'lun');
  assert.equal(lt.w, 5, 'la décharge S6 passe après S5');
  assert.equal(lt.sets.filter(Boolean).length, 2);
  assert.equal(L.lastTimeIn(logs, 'bench', 6, 'lun').w, 5);
  assert.equal(L.lastTimeIn(logs, 'bench', 1, 'lun'), null);
  assert.equal(L.lastTimeIn({ '6|lun|bench|0': { w: '50' } }, 'bench', 7, 'lun').dl, true, 'à défaut, une décharge');
  assert.equal(L.lastBandIn(logs, 'pullup_band', 7), 'noir');
});

test('restAfter : règle des supersets', () => {
  const M = L.buildModel(1, 'lun'); // poste 3 : incline_db (A1) + lat_raise (A2), 75 s
  const ok = set => (ex, i) => set.has(ex + i);
  assert.equal(L.restAfter(M, ok(new Set(['incline_db0'])), 'incline_db', 0), null, 'rien entre A1 et A2');
  const r = L.restAfter(M, ok(new Set(['incline_db0', 'lat_raise0'])), 'lat_raise', 0);
  assert.equal(r.sec, 75); assert.match(r.label, /\+/);
  assert.equal(L.restAfter(M, ok(new Set(['lat_raise0', 'incline_db0'])), 'incline_db', 0).sec, 75, 'A2 déjà fait : repos après A1');
  assert.equal(L.restAfter(M, ok(new Set()), 'bench', 0).sec, 150, 'poste simple');
});
