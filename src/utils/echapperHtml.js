/**
 * Échappe un texte avant de l'insérer dans un e-mail HTML.
 *
 * Les contenus saisis par les clients (formulaire public du support, prénom,
 * description de réclamation) ou par un admin ne doivent jamais être
 * interprétés comme du HTML : sinon n'importe qui peut faire envoyer, depuis
 * le domaine Nanei, un e-mail contenant des liens ou formulaires piégés.
 */
function echapperHtml(valeur) {
  if (valeur === null || valeur === undefined) return '';
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Texte sûr pour un sujet d'e-mail : une seule ligne, longueur bornée. */
function sujetEmail(valeur, max = 150) {
  return String(valeur ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

module.exports = { echapperHtml, sujetEmail };
