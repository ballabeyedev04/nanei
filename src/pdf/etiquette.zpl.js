/**
 * Génère l'étiquette au format ZPL (Zebra Programming Language) — le
 * standard de l'industrie pour les imprimantes thermiques de transport
 * (pas seulement les Zebra, la quasi-totalité des imprimantes d'étiquettes
 * professionnelles le comprend). Contrairement au PDF (pensé pour une
 * impression bureau ou un affichage écran), le ZPL est du texte brut envoyé
 * directement à l'imprimante thermique, qui l'interprète pour dessiner
 * l'étiquette sur le rouleau adhésif — impression quasi instantanée, aucun
 * gâchis de papier A4.
 *
 * Format cible : 100 x 150 mm (standard transport), calculé pour une
 * imprimante 203 dpi (résolution la plus courante sur ce type de matériel —
 * 1 mm ≈ 8 dots). Adapter DPI_FACTOR si l'imprimante réelle est en 300 dpi.
 */

const DPI_FACTOR = 8; // dots par mm, pour une imprimante 203 dpi
const LARGEUR_MM = 100;
const HAUTEUR_MM = 150;
const LARGEUR_DOTS = LARGEUR_MM * DPI_FACTOR; // 800
const HAUTEUR_DOTS = HAUTEUR_MM * DPI_FACTOR; // 1200

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';

/** Échappe les caractères réservés ZPL (^ ~ \) dans un champ texte. */
function zplEscape(str) {
  return String(str ?? '').replace(/[\^~\\]/g, ' ');
}

/** Coupe une chaîne à une longueur max pour éviter qu'elle déborde de l'étiquette. */
function tronquer(str, max) {
  const s = zplEscape(str);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const masquerTel = (tel) => {
  if (!tel) return '-';
  const c = String(tel).replace(/\s/g, '');
  if (c.length <= 4) return '****';
  return c.slice(0, 2) + '****' + c.slice(-2);
};

/**
 * @param {object} colisData - mêmes données que etiquetteHtml() (etiquette.template.js)
 * @returns {string} Contenu ZPL brut, prêt à envoyer à une imprimante thermique
 */
function genererEtiquetteZPL(colisData) {
  const {
    reference,
    expediteurNom, expediteurPrenom, expediteurTelephone, expediteurPays,
    recepteurNom, recepteurPrenom, recepteurTelephone, recepteurPays,
    typeTransport, poids, createdAt,
  } = colisData;

  const transportLabel = typeTransport === 'aerien' ? 'AERIEN' : 'MARITIME';
  const dateStr = createdAt
    ? new Date(createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '-';
  const urlSuivi = `${BASE_URL}/nanei/suivi/${reference}`;

  const expediteurNomComplet = tronquer(`${expediteurPrenom || ''} ${expediteurNom || ''}`.trim(), 30);
  const recepteurNomComplet = tronquer(`${recepteurPrenom || ''} ${recepteurNom || ''}`.trim(), 30);

  return `^XA
^CI28
^PW${LARGEUR_DOTS}
^LL${HAUTEUR_DOTS}
^LH0,0

^FO0,0^GB${LARGEUR_DOTS},110,110^FS
^FO40,30^A0N,60,60^FDNANEI^FS

^FO40,140^A0N,28,28^FDRéférence colis^FS
^FO40,175^A0N,50,50^FD${zplEscape(reference)}^FS

^FO${(LARGEUR_DOTS - 200) / 2},250^BQN,2,5^FDMM,A${urlSuivi}^FS

^FO40,470^GB${LARGEUR_DOTS - 80},2,2^FS

^FO40,500^A0N,26,26^FDEXPEDITEUR^FS
^FO40,535^A0N,32,32^FD${expediteurNomComplet}^FS
^FO40,575^A0N,24,24^FDTel: ${zplEscape(masquerTel(expediteurTelephone))}^FS
^FO40,605^A0N,24,24^FD${tronquer(expediteurPays || '', 25)}^FS

^FO40,660^GB${LARGEUR_DOTS - 80},2,2^FS

^FO40,690^A0N,26,26^FDDESTINATAIRE^FS
^FO40,725^A0N,32,32^FD${recepteurNomComplet}^FS
^FO40,765^A0N,24,24^FDTel: ${zplEscape(recepteurTelephone || '-')}^FS
^FO40,795^A0N,30,30^FD${tronquer(recepteurPays || '', 25)}^FS

^FO40,860^GB${LARGEUR_DOTS - 80},2,2^FS

^FO40,900^A0N,26,26^FDTransport: ${transportLabel}^FS
^FO40,940^A0N,26,26^FDPoids: ${zplEscape(poids || '-')} kg^FS
^FO40,980^A0N,26,26^FDCree le: ${zplEscape(dateStr)}^FS

^XZ`;
}

module.exports = { genererEtiquetteZPL };
