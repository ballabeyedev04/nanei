/**
 * Mode de transport d'un colis, sous forme canonique SANS accent :
 * 'aerien' | 'maritime' (valeur attendue par les gabarits étiquette / ZPL /
 * suivi public).
 *
 * Source : colonne colis.type_transport (renseignée depuis la création du
 * colis). Pour les colis plus anciens, on tente de la déduire de type_colis
 * (certaines versions y mettaient le mode de transport) ; à défaut 'aerien'.
 */
function normaliser(valeur) {
  const t = String(valeur || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (t === 'aerien') return 'aerien';
  if (t === 'maritime') return 'maritime';
  return null;
}

function typeTransportDuColis(colis) {
  if (!colis) return 'aerien';
  return normaliser(colis.type_transport) || normaliser(colis.type_colis) || 'aerien';
}

module.exports = { normaliserTypeTransport: normaliser, typeTransportDuColis };
