// Charge le bloc « logique pure » d'index.html (entre les balises @pur:debut et @pur:fin)
// dans un contexte Node isolé, sans DOM ni stockage. Zéro dépendance.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function charger() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const a = html.indexOf('/* @pur:debut'), b = html.indexOf('/* @pur:fin */');
  if (a < 0 || b < a) throw new Error('Balises @pur:debut / @pur:fin introuvables dans index.html');
  const code = html.slice(a, b);
  // Noms déclarés au premier niveau du bloc (fonctions et constantes en début de ligne)
  const noms = [...new Set([...code.matchAll(/^(?:async\s+)?(?:function|const|let)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]))];
  return vm.runInNewContext(`${code}\n;({${noms.join(',')}})`, {}, { filename: 'index.html (bloc pur)' });
}

// Les objets créés dans le contexte isolé n'ont pas le même prototype : on compare des copies JSON
export const brut = x => JSON.parse(JSON.stringify(x));
