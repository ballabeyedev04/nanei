const { Avis, Colis, Utilisateur } = require('../../models');
const { paginer, avecPagination } = require('../../utils/pagination');
const logger = require('../../config/logger');
const { fn, col } = require('sequelize');

// ── CLIENT : donner un avis ──────────────────────────────────────────────────
exports.donnerAvis = async (req, res) => {
  try {
    const userId = req.user.id;
    // Tolérance de nommage : accepte `colis_id` (canonique) ou `colisId`.
    const { note, commentaire } = req.body;
    const colis_id = req.body.colis_id ?? req.body.colisId;

    if (!colis_id || !note) {
      return res.status(400).json({ success: false, message: 'colis_id et note sont obligatoires' });
    }
    // Entier de 1 à 5. Avant : « abc » ou 4.5 passaient le contrôle
    // (comparaisons fausses) puis échouaient en base (500) ou étaient
    // tronqués en silence.
    const noteEntiere = Number(note);
    if (!Number.isInteger(noteEntiere) || noteEntiere < 1 || noteEntiere > 5) {
      return res.status(400).json({ success: false, message: 'La note doit être un entier entre 1 et 5' });
    }

    // Vérifier que le colis est livré et appartient à l'utilisateur
    const colis = await Colis.findByPk(colis_id);
    if (!colis) return res.status(404).json({ success: false, message: 'Colis introuvable' });
    if (colis.expediteurId !== userId) {
      return res.status(403).json({ success: false, message: 'Ce colis ne vous appartient pas' });
    }
    if (colis.statut !== 'livre') {
      return res.status(400).json({ success: false, message: 'Vous pouvez donner un avis uniquement après livraison' });
    }

    // Vérifier qu'aucun avis n'existe déjà
    const existant = await Avis.findOne({ where: { colis_id } });
    if (existant) {
      return res.status(409).json({ success: false, message: 'Un avis existe déjà pour ce colis' });
    }

    const avis = await Avis.create({
      colis_id,
      utilisateur_id: userId,
      note: noteEntiere,
      commentaire: commentaire || null,
    });

    return res.status(201).json({ success: true, message: 'Avis enregistré', avis });
  } catch (err) {
    logger.error('Erreur dans donnerAvis', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── CLIENT : mes avis ────────────────────────────────────────────────────────
exports.mesAvis = async (req, res) => {
  try {
    // Pagination facultative (?page=&limit=) : sans paramètre, liste complète
    // (le mobile s'en sert aussi pour savoir si un colis est déjà noté).
    const { lignes: avis, pagination } = await paginer(Avis, {
      where: { utilisateur_id: req.user.id },
      include: [{ model: Colis, as: 'colis', attributes: ['reference', 'destination'] }],
      order: [['created_at', 'DESC']],
    }, req.query);
    return res.status(200).json(avecPagination({ success: true, avis }, pagination));
  } catch (err) {
    logger.error('Erreur dans mesAvis', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ── ADMIN : tous les avis + stats ────────────────────────────────────────────
exports.adminAvis = async (req, res) => {
  try {
    // Statistiques sur TOUS les avis (calculées en base, indépendantes de la
    // page et du filtre de note).
    const parNote = await Avis.findAll({
      attributes: ['note', [fn('COUNT', col('id')), 'nombre']],
      group: ['note'],
      raw: true,
    });
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let somme = 0;
    for (const ligne of parNote) {
      const n = Number(ligne.nombre) || 0;
      distribution[ligne.note] = n;
      total += n;
      somme += n * Number(ligne.note);
    }
    const note_moyenne = total > 0 ? Math.round((somme / total) * 10) / 10 : 0;

    // Filtre facultatif ?note=1..5 sur la liste ; pagination facultative.
    const noteFiltre = Number(req.query.note);
    const where = Number.isInteger(noteFiltre) && noteFiltre >= 1 && noteFiltre <= 5 ? { note: noteFiltre } : {};
    const { lignes: avis, pagination } = await paginer(Avis, {
      where,
      include: [
        { model: Colis, as: 'colis', attributes: ['reference', 'destination'] },
        { model: Utilisateur, as: 'utilisateur', attributes: ['nom', 'prenom', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    }, req.query);

    return res.status(200).json(avecPagination({
      success: true,
      stats: { total, note_moyenne, distribution },
      avis,
    }, pagination));
  } catch (err) {
    logger.error('Erreur dans adminAvis', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
