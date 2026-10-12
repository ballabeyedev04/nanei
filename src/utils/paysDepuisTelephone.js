/**
 * Pays d'origine d'un colis, déduit de l'indicatif du téléphone de
 * l'expéditeur (enregistré au format international, ex. « +22376000000 »).
 *
 * Il n'existe pas de champ « pays » sur l'utilisateur. Avant, l'étiquette
 * affichait toujours « MALI », même pour un envoi depuis la France.
 * Indicatif inconnu ou absent → PAYS_ORIGINE_DEFAUT (MALI par défaut).
 */
const INDICATIFS = [
  // du plus long au plus court (« +1 » en dernier)
  ['223', 'MALI'], ['221', 'SÉNÉGAL'], ['225', "CÔTE D'IVOIRE"], ['224', 'GUINÉE'],
  ['226', 'BURKINA FASO'], ['227', 'NIGER'], ['228', 'TOGO'], ['229', 'BÉNIN'],
  ['222', 'MAURITANIE'], ['220', 'GAMBIE'], ['212', 'MAROC'], ['213', 'ALGÉRIE'],
  ['216', 'TUNISIE'], ['237', 'CAMEROUN'], ['241', 'GABON'], ['242', 'CONGO'],
  ['243', 'RD CONGO'], ['352', 'LUXEMBOURG'], ['33', 'FRANCE'], ['32', 'BELGIQUE'],
  ['41', 'SUISSE'], ['34', 'ESPAGNE'], ['39', 'ITALIE'], ['49', 'ALLEMAGNE'],
  ['44', 'ROYAUME-UNI'], ['1', 'ÉTATS-UNIS / CANADA'],
];

function paysDepuisTelephone(telephone) {
  const defaut = (process.env.PAYS_ORIGINE_DEFAUT || 'MALI').toUpperCase();
  const t = String(telephone || '').replace(/[\s.-]/g, '');
  let chiffres = null;
  if (t.startsWith('+')) chiffres = t.slice(1);
  else if (t.startsWith('00')) chiffres = t.slice(2);
  if (!chiffres || !/^\d{6,}$/.test(chiffres)) return defaut; // numéro local : pays inconnu
  const trouve = INDICATIFS.find(([indicatif]) => chiffres.startsWith(indicatif));
  return trouve ? trouve[1] : defaut;
}

module.exports = { paysDepuisTelephone };
