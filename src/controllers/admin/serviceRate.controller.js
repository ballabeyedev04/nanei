const ServiceRateService = require('../../services/serviceRate.service');
// Import manquant : chaque refus (404 / 400) finissait en ReferenceError → 500.
const { statutEchec } = require('../../utils/statutHttp');

exports.getAll = async (req, res) => {
  try {
    const result = await ServiceRateService.getAll();
    return res.status(200).json({ data: result.data });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const result = await ServiceRateService.getById(req.params.id);
    if (!result.success) return res.status(statutEchec(result, 404)).json(result);
    return res.status(200).json({ data: result.data });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const result = await ServiceRateService.create(req.body);
    if (!result.success) return res.status(statutEchec(result, 400)).json(result);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const result = await ServiceRateService.update(req.params.id, req.body);
    if (!result.success) return res.status(statutEchec(result, 400)).json(result);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const result = await ServiceRateService.delete(req.params.id);
    if (!result.success) return res.status(statutEchec(result, 404)).json(result);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
