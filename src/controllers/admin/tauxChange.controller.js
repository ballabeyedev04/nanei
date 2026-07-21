const TauxChangeService = require('../../services/tauxChange.service');

exports.getAll = async (req, res) => {
  try {
    const result = await TauxChangeService.getAll();
    return res.status(200).json({ data: result.data });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const result = await TauxChangeService.getById(req.params.id);
    if (!result.success) return res.status(404).json(result);
    return res.status(200).json({ data: result.data });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const result = await TauxChangeService.update(req.params.id, req.body);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
