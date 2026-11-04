// Vérification de bout en bout dans un vrai navigateur (Chromium, écran d'iPhone 13) :
// rejoue les scénarios de l'audit (perte de données, semaine, hors ligne, saisie) sur une version de l'app.
//
// Usage :  node outils/verifier.mjs [dossier] [--captures dossier]
//   dossier    contient index.html (et sw.js s'il existe). Par défaut : la racine du dépôt.
//   --captures écrit des captures d'écran des écrans principaux.
// Demande Playwright (npm i -D playwright, puis npx playwright install chromium).
// L'app elle-même n'en dépend pas : c'est un outil de vérification, comme les tests (node --test).
import http from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { sauvegardeV1 } from '../tests/donnees.mjs';

let pw;
try { pw = await import('playwright'); } catch { try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = null; } }
if (!pw) {
  console.error('Playwright est introuvable : npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}
const { chromium, devices } = pw;
const args = process.argv.slice(2);
const ic = args.indexOf('--captures');
const CAPT = ic >= 0 ? path.resolve(args.splice(ic, 2)[1]) : null;
const DIR = path.resolve(args[0] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const KEY = 'muscu_bloc1_v1';
const TEL = devices['iPhone 13'];
if (!existsSync(path.join(DIR, 'index.html'))) { console.error('Pas d\'index.html dans ' + DIR); process.exit(2); }
if (CAPT) await mkdir(CAPT, { recursive: true });

// Serveur statique minimal : 404 si le fichier manque (sw.js absent = cas réel)
const serveur = http.createServer(async (q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
  try {
    const d = await readFile(path.join(DIR, path.normalize(f)));
    r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' }); r.end(d);
  } catch { r.writeHead(404); r.end(); }
});
await new Promise(ok => serveur.listen(0, '127.0.0.1', ok));
const URL = `http://localhost:${serveur.address().port}/`;
const nav = await chromium.launch();
const tmp = await mkdtemp(path.join(tmpdir(), 'muscu-'));

// Ouvre l'app dans un contexte neuf (téléphone vierge), avec un journal et une date éventuels
async function ouvrir({ etat, brut, heure, avant } = {}) {
  const ctx = await nav.newContext({ ...TEL, acceptDownloads: true });
  if (avant) await ctx.addInitScript(avant);
  const p = await ctx.newPage(); p.erreurs = [];
  p.on('pageerror', e => p.erreurs.push(e.message));
  if (heure) await p.clock.install({ time: new Date(heure) });
  await p.goto(URL);
  if (etat || brut) {
    await p.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [KEY, brut ?? JSON.stringify(etat)]);
    await p.reload();
  }
  await p.waitForTimeout(300);
  return p;
}
const lire = (p, k = KEY) => p.evaluate(k => localStorage.getItem(k), k);
const fermer = p => p.context().close();
const capture = async (p, nom) => { if (CAPT) await p.screenshot({ path: path.join(CAPT, nom + '.png') }); };
const passer = async p => { const b = p.locator('#timer .tbtns .acc'); if (await b.isVisible()) await b.click(); };

const scenarios = [
  ['Lecture de la sauvegarde en échec (artifact sans réseau) : la coche n\'écrase rien', async () => {
    const p = await ouvrir({ avant: () => { window.__ecrit = []; window.storage = { get: async () => { throw new Error('hors ligne'); }, set: async k => { window.__ecrit.push(k); }, list: async () => { throw new Error('hors ligne'); } }; } });
    await p.locator('.chk').first().click(); await p.waitForTimeout(700);
    const n = await p.evaluate(() => window.__ecrit.length); await fermer(p);
    return [n === 0, `${n} écriture(s)`];
  }],
  ['Sauvegarde illisible : intacte après des taps', async () => {
    const brut = JSON.stringify({ week: 3, logs: { '2|lun|bench|0': { w: '60', r: '8', ok: true } } }).slice(0, -5);
    const p = await ouvrir({ brut });
    await p.locator('.seg button').nth(1).click(); await p.locator('.chk').first().click(); await p.waitForTimeout(700);
    await capture(p, 'verrou-sauvegarde-illisible');
    const ok = (await lire(p)) === brut; await fermer(p);
    return [ok, ok ? 'octet pour octet' : 'écrasée'];
  }],
  ['Stockage plein : l\'échec est signalé', async () => {
    const p = await ouvrir();
    await p.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('plein', 'QuotaExceededError'); }; });
    await p.locator('.chk').first().click(); await p.waitForTimeout(800);
    const t = (await p.locator('.toast').allInnerTexts()).join(' / '); await fermer(p);
    return [/Sauvegarde impossible/.test(t), t || 'aucun message'];
  }],
  ['Jour inconnu dans la sauvegarde : pas d\'écran blanc', async () => {
    const p = await ouvrir({ etat: { day: 'mer', logs: { '1|mer|bench|0': { w: '40' } } } });
    const e = p.erreurs.slice(); const txt = await p.locator('#v-today').innerText(); await fermer(p);
    return [!e.length && txt.length > 50, e.join(' / ') || 'affichage normal'];
  }],
  ['Export texte avec un exercice inconnu', async () => {
    const p = await ouvrir({ etat: { logs: { '1|lun|bench|0': { w: '60', r: '8', ok: true }, '1|lun|ancien_exo|0': { w: '10', r: '10' } } } });
    await p.locator('#recap .acc').click(); await p.waitForTimeout(300);
    const v = await p.locator('#exp').isVisible(); const e = p.erreurs.slice(); await fermer(p);
    return [v && !e.length, e.join(' / ') || 'texte affiché'];
  }],
  ['Migration v1 → v2 : copie d\'origine gardée, journal intact après une coche', async () => {
    const v1 = sauvegardeV1(); v1.view = 'today'; v1.timer = null; const brut = JSON.stringify(v1);
    const p = await ouvrir({ brut, heure: '2026-10-21T18:00:00' });
    await p.waitForTimeout(300);
    const copie = await lire(p, KEY + '__avant_v2');
    await p.locator('.poste:not(.done) .chk').first().click(); await p.waitForTimeout(700);
    const s = JSON.parse(await lire(p)); await fermer(p);
    const intact = Object.entries(v1.logs).every(([k, x]) => JSON.stringify(s.logs[k]) === JSON.stringify(x));
    const ok = copie === brut && s.v === 2 && intact && JSON.stringify(s.refs) === JSON.stringify(v1.refs) 
      && Object.entries(v1.sessions).every(([k, x]) => JSON.stringify(s.sessions[k]) === JSON.stringify(x)); // la coche en ajoute une
    return [ok, `copie v1 ${copie === brut ? 'identique' : 'absente'}, v=${s.v}, ${Object.keys(v1.logs).length} séries ${intact ? 'intactes' : 'modifiées'}`];
  }],
  ['Sauvegarde fichier → restauration sur un téléphone vierge', async () => {
    const v1 = sauvegardeV1(); v1.view = 'year'; v1.timer = null;
    const p = await ouvrir({ etat: v1 });
    await p.locator('#bkT').scrollIntoViewIfNeeded(); await capture(p, 'plan-sauvegarde');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.bk [data-act=bkSave]').click()]);
    const f = path.join(tmp, 'sauvegarde.json'); await dl.saveAs(f); await fermer(p);
    const q = await ouvrir();
    await q.locator('#tab-year').click(); await q.locator('[data-act=bkOpen]').click(); await q.waitForTimeout(300);
    await q.locator('#bkFile').setInputFiles(f); await q.waitForTimeout(400); await capture(q, 'apercu-restauration');
    await q.locator('[data-act=bkDoImport]').click(); await q.waitForTimeout(600);
    const s = JSON.parse(await lire(q)); await fermer(q);
    const ok = JSON.stringify(s.logs) === JSON.stringify(v1.logs) && JSON.stringify(s.refs) === JSON.stringify(v1.refs);
    return [ok, ok ? 'journal et références identiques' : 'différences'];
  }],
  ['Fichier invalide : refusé, journal inchangé', async () => {
    const f = path.join(tmp, 'mauvais.json'); await writeFile(f, '{"bonjour":1}');
    const p = await ouvrir({ etat: { view: 'year', logs: { '1|lun|bench|0': { w: '60', r: '8', ok: true } } } });
    const avant = await lire(p);
    await p.locator('[data-act=bkOpen]').click(); await p.waitForTimeout(300);
    await p.locator('#bkFile').setInputFiles(f); await p.waitForTimeout(400);
    const msg = await p.locator('#shB').innerText(); const ok = (await lire(p)) === avant; await fermer(p);
    return [ok && /journal/.test(msg), msg.split('\n')[0]];
  }],
  ['Choisir la semaine en cours ne fige pas l\'app', async () => {
    const p = await ouvrir({ heure: '2026-10-15T10:00:00' });
    await p.selectOption('#wk', '5'); await p.clock.setSystemTime(new Date('2026-10-19T10:00:00')); await p.reload(); await p.waitForTimeout(300);
    const w = await p.evaluate(() => state.week); await fermer(p);
    return [w === 6, `lundi suivant : semaine ${w}`];
  }],
  ['App restée ouverte du jeudi au lundi : la coche va dans la bonne semaine', async () => {
    const p = await ouvrir({ heure: '2026-10-15T10:00:00' });
    await p.clock.setSystemTime(new Date('2026-10-19T10:00:00'));
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(300); await p.locator('.seg button').nth(0).click(); await p.locator('.chk').first().click(); await p.waitForTimeout(500);
    const k = await p.evaluate(() => Object.keys(state.logs)); await fermer(p);
    return [k.length === 1 && k[0].startsWith('6|'), k.join(', ')];
  }],
  ['Deux onglets ouverts : aucune série perdue', async () => {
    const ctx = await nav.newContext(TEL); const a = await ctx.newPage(), b = await ctx.newPage();
    await a.goto(URL); await b.goto(URL); await a.waitForTimeout(300);
    await a.locator('.chk').nth(0).click(); await a.waitForTimeout(700);
    await b.locator('.chk').nth(1).click(); await b.waitForTimeout(700);
    const n = Object.keys(JSON.parse(await lire(a)).logs).length; await ctx.close();
    return [n === 2, `${n} série(s) en stockage sur 2`];
  }],
  ['Décharge : charge indiquée −15 %, enregistrée telle quelle', async () => {
    const p = await ouvrir({ etat: { week: 6, pinned: true, logs: { '5|lun|bench|0': { w: '60', r: '10', ok: true } } } });
    const ph = await p.locator('#w-bench-0').getAttribute('placeholder');
    await p.locator('.chk').first().click(); await p.waitForTimeout(400); await passer(p);
    await p.locator('.poste').first().scrollIntoViewIfNeeded(); await capture(p, 'decharge');
    const w = await p.evaluate(() => state.logs['6|lun|bench|0'].w); await fermer(p);
    return [ph === '51' && w === '51', `indiqué ${ph}, enregistré ${w} (dernière fois 60)`];
  }],
  ['Coche sans reps : signalée sur la ligne et en fin de séance', async () => {
    const p = await ouvrir({ etat: { week: 3, pinned: true, logs: { '2|lun|bench|0': { w: '60', r: '8', ok: true } } } });
    await p.locator('.chk').first().click(); await p.waitForTimeout(400); await passer(p);
    await p.locator('.poste').first().scrollIntoViewIfNeeded(); await capture(p, 'reps-manquantes');
    const c = await p.evaluate(() => document.querySelector('.set[data-ex=bench][data-i="0"]').className);
    const r = await p.locator('#rcWarn').innerText().catch(() => ''); await fermer(p);
    return [/norep/.test(c) && /sans reps/.test(r), r || 'rien de signalé'];
  }],
  ['Heure réelle enregistrée à la coche', async () => {
    const p = await ouvrir({ heure: '2026-10-13T18:42:00' });
    await p.locator('.chk').first().click(); await p.waitForTimeout(400);
    const t = await p.evaluate(() => Object.values(state.logs)[0].t); await fermer(p);
    return [typeof t === 'number', t ? new Date(t).toLocaleString('fr-FR') : 'aucune heure'];
  }],
  ['Rechargement en séance : la série en cours est visible', async () => {
    const logs = {}; for (let i = 0; i < 4; i++) logs['5|mar|pullup_band|' + i] = { r: '7', ok: true }; logs['5|mar|bb_row|0'] = { w: '60', r: '10', ok: true };
    const p = await ouvrir({ heure: '2026-10-13T18:20:00', etat: { week: 5, day: 'mar', logs, sessions: { '5|mar': { t0: Date.parse('2026-10-13T18:05:00') } } } });
    await p.waitForTimeout(300); await capture(p, 'ouverture-en-seance');
    const v = await p.evaluate(() => { const n = nextSet(), r = document.querySelector(`.set[data-ex="${n[0].ex}"][data-i="${n[1]}"]`).getBoundingClientRect(); return r.bottom <= document.getElementById('dock').getBoundingClientRect().top; });
    await fermer(p);
    return [v, v ? 'au-dessus du dock' : 'cachée sous le dock'];
  }],
  ['Hors ligne : l\'app se recharge sans réseau', async () => {
    if (!existsSync(path.join(DIR, 'sw.js'))) return [false, 'pas de sw.js'];
    const p = await ouvrir({ etat: { week: 8, pinned: true, logs: { '7|lun|bench|0': { w: '60', r: '8', ok: true } } } });
    await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(300);
    await p.context().setOffline(true);
    let ok = true; try { await p.reload({ timeout: 8000 }); await p.waitForTimeout(300); } catch { ok = false; }
    const j = ok && /60×8/.test(await p.locator('.last').first().innerText()); await fermer(p);
    return [j, ok ? (j ? 'app et journal affichés' : 'app affichée, journal absent') : 'page d\'erreur'];
  }],
  ['Parcours complet sans erreur JavaScript', async () => {
    const p = await ouvrir({ heure: '2026-10-13T18:00:00', etat: { logs: sauvegardeV1().logs, week: 6, pinned: true } });
    await capture(p, 'aujourdhui');
    for (let k = 0; k < 3; k++) { await p.locator('.poste:not(.done) .chk').first().click(); await p.waitForTimeout(120); }
    await passer(p);
    await p.locator('.poste:not(.done) .fiche').first().click(); await p.waitForTimeout(400); await capture(p, 'fiche'); await p.locator('#sheet .shhd button').click();
    await p.locator('#tab-year').click(); await p.waitForTimeout(300); await capture(p, 'plan');
    await p.locator('#tab-prog').click(); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.spks').scrollIntoView()); await capture(p, 'progression');
    await p.locator('#tab-today').click(); await p.waitForTimeout(300);
    const e = p.erreurs.slice(); await fermer(p);
    return [!e.length, e.join(' / ') || 'aucune erreur'];
  }],
];

let ko = 0;
console.log(`Vérification de ${path.join(DIR, 'index.html')}\n`);
for (const [nom, f] of scenarios) {
  let r; try { r = await f(); } catch (e) { r = [false, 'échec : ' + String(e.message).split('\n')[0]]; }
  if (!r[0]) ko++;
  console.log(`${r[0] ? '✓' : '✗'} ${nom}\n    ${r[1]}`);
}
console.log(`\n${scenarios.length - ko}/${scenarios.length} scénarios passent.` + (CAPT ? ` Captures : ${CAPT}` : ''));
await nav.close(); serveur.close();
process.exit(ko ? 1 : 0);
