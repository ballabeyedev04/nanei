'use strict';

/**
 * Migration : masque les mots de passe, jetons et codes déjà enregistrés en
 * clair dans audit_logs.details (le middleware d'audit copiait req.body tel
 * quel, dont le mot_de_passe des admins créés via POST /admin/ajouter-admin).
 * Depuis, le middleware masque ces champs avant l'enregistrement.
 *
 * Irréversible par nature : les valeurs effacées ne sont pas restaurées.
 */
const CLE_SENSIBLE = /pass|mot_de_passe|token|otp|secret|code_?verif|cvv|pin$/i;

function masquer(valeur, profondeur = 0) {
  if (valeur === null || typeof valeur !== 'object' || profondeur > 5) return { valeur, change: false };
  let change = false;
  if (Array.isArray(valeur)) {
    const res = valeur.map((v) => { const r = masquer(v, profondeur + 1); change = change || r.change; return r.valeur; });
    return { valeur: res, change };
  }
  const copie = {};
  for (const [cle, v] of Object.entries(valeur)) {
    if (CLE_SENSIBLE.test(cle) && v !== '***') { copie[cle] = '***'; change = true; continue; }
    const r = masquer(v, profondeur + 1);
    copie[cle] = r.valeur; change = change || r.change;
  }
  return { valeur: copie, change };
}

module.exports = {
  async up(queryInterface) {
    // Base neuve : la table n'existe pas encore (créée au démarrage par sync).
    let colonnes;
    try { colonnes = await queryInterface.describeTable('audit_logs'); } catch { return; }
    if (!colonnes.details) return;
    const typeDetails = /jsonb/i.test(colonnes.details.type) ? 'jsonb' : 'json';

    const [lignes] = await queryInterface.sequelize.query(
      "SELECT id, details FROM audit_logs WHERE details IS NOT NULL AND details::text ~* '(pass|token|otp|secret|code_?verif|cvv|pin\")'"
    );
    for (const ligne of lignes) {
      const details = typeof ligne.details === 'string' ? JSON.parse(ligne.details) : ligne.details;
      const { valeur, change } = masquer(details);
      if (!change) continue;
      await queryInterface.sequelize.query(
        `UPDATE audit_logs SET details = CAST(:details AS ${typeDetails}) WHERE id = :id`,
        { replacements: { id: ligne.id, details: JSON.stringify(valeur) } }
      );
    }
  },

  async down() {
    // Rien à restaurer : les secrets effacés ne doivent pas revenir.
  },
};
