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

test('repRange : fourchettes du programme', () => {
  eq(L.repRange('6-10'), [6, 10]); eq(L.repRange('8-12 / jambe'), [8, 12]); eq(L.repRange('4-6'), [4, 6]);
  assert.equal(L.repRange('max ×3 puis 3 nég. ×2'), null); assert.equal(L.repRange(''), null);
  for (const n in L.EX) if (!/max/.test(L.EX[n].reps)) assert.ok(L.repRange(L.EX[n].reps), `${n} : ${L.EX[n].reps}`);
});

test('setFlag : cochée sans reps, sous la fourchette', () => {
  assert.equal(L.setFlag({ w: '60', ok: true }, '6-10'), 'norep');
  assert.equal(L.setFlag({ w: '60', r: '5', ok: true }, '6-10'), 'under');
  assert.equal(L.setFlag({ w: '60', r: '6', ok: true }, '6-10'), '');
  assert.equal(L.setFlag({ w: '60', r: '3' }, '6-10'), '', 'non cochée : rien à signaler');
  assert.equal(L.setFlag({ r: '2', ok: true }, 'max ×3 puis 3 nég. ×2'), '', 'pas de fourchette');
});

test('deloadLoad : −15 % arrondi au 0,5 kg', () => {
  assert.equal(L.deloadLoad(60), 51); assert.equal(L.deloadLoad(62.5), 53); assert.equal(L.deloadLoad(20), 17);
});

test('ceilingHit : toutes les séries au plafond, même prescription, hors décharge', () => {
  const now = L.prescribed(3, 'lun', 'bench'); // bloc 1 : 3 × 6-10
  const sets = r => r.map(x => ({ w: '60', r: String(x), ok: true }));
  const lt = r => ({ w: 2, d: 'lun', dl: false, sets: sets(r) });
  const then = L.prescribed(2, 'lun', 'bench');
  assert.equal(L.ceilingHit(lt([10, 10, 10]), then, now), true);
  assert.equal(L.ceilingHit(lt([10, 10, 9]), then, now), false, 'une série sous le plafond');
  assert.equal(L.ceilingHit(lt([10, 10]), then, now), false, 'série manquante');
  assert.equal(L.ceilingHit({ ...lt([10, 10, 10]), dl: true }, then, now), false, 'la dernière fois était une décharge');
  assert.equal(L.ceilingHit(lt([10, 10, 10]), then, L.prescribed(6, 'lun', 'bench')), false, 'aujourd\'hui : décharge');
  assert.equal(L.ceilingHit(lt([12, 12, 12, 12]), L.prescribed(8, 'lun', 'bench'), L.prescribed(15, 'lun', 'bench')), false, 'la fourchette a changé de bloc');
  const nonCoche = lt([10, 10, 10]); nonCoche.sets[2].ok = false;
  assert.equal(L.ceilingHit(nonCoche, then, now), false, 'série non cochée');
  assert.equal(L.prescribed(3, 'mer', 'bench'), null);
});

test('bestSetsIn : meilleure série cochée par semaine, sur le 1RM estimé', () => {
  const logs = {
    '2|lun|bench|0': { w: '60', r: '10', ok: true },  // e1RM 80
    '2|lun|bench|1': { w: '65', r: '6', ok: true },   // e1RM 78
    '2|lun|bench|2': { w: '90', r: '1' },             // non cochée : ignorée
    '3|lun|bench|0': { w: '62,5', ok: true },         // sans reps
    '6|lun|bench|0': { w: '51', r: '8', ok: true },   // décharge
    '2|lun|bench|b': { v: 'x' },
  };
  const r = L.bestSetsIn(logs, 'bench');
  eq(r.pts.map(([w, s]) => [w, s.w, s.r, s.dl]), [[2, 60, 10, false], [6, 51, 8, true]]);
  assert.equal(r.sansReps, 1);
  assert.equal(Math.round(L.e1rm(60, 10)), 80); assert.equal(L.e1rm(100, 1), 100);
});

test('targetFor / targetStatus : cibles chiffrées du tableau, charge ET reps', () => {
  eq(L.targetFor('bench', 1), { w: 55, r: 8, txt: '55 × 8' });
  eq(L.targetFor('squat', 7), { w: 100, r: 5, txt: '100 × 5' });
  assert.equal(L.targetFor('rdl', 1), null, 'pas de ligne pour cet exercice');
  const b1 = L.BLOCKS[0];
  const st = L.targetStatus({ '3|lun|bench|0': { w: '55', r: '7', ok: true }, '4|lun|bench|0': { w: '57,5', r: '6', ok: true } }, 'bench', b1);
  assert.equal(st.hit, false, '55 × 7 et 57,5 × 6 ne valent pas 55 × 8');
  const ok = L.targetStatus({ '5|lun|bench|0': { w: '55', r: '8', ok: true }, '9|lun|bench|0': { w: '70', r: '10', ok: true } }, 'bench', b1);
  assert.equal(ok.hit, true); eq(ok.best, { w: 55, r: 8 }, 'la S9 est hors du bloc 1');
});
