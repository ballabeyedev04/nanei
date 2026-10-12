const ShippingRateService = require('../../services/shippingRate.service');
// Import manquant : chaque refus (404 / 400) finissait en ReferenceError → 500.
const { statutEchec } = require('../../utils/statutHttp');

exports.getAll = async (req, res) => {
  try {
    const result = await ShippingRateService.getAll(req.query);
    return res.status(200).json({ success: true, data: result.data });
  } catch (e) { return res.status(500).json({ success: false, message: 'Erreur serveur', error: e.message }); }
};

exports.getById = async (req, res) => {
  try {
    const result = await ShippingRateService.getById(req.params.id);
    if (!result.success) return res.status(statutEchec(result, 404)).json(result);
    return res.status(200).json(result);
  } catch (e) { return res.status(500).json({ success: false, message: 'Erreur serveur', error: e.message }); }
};

exports.create = async (req, res) => {
  try {
    const result = await ShippingRateService.create(req.body);
    if (!result.success) return res.status(statutEchec(result, 400)).json(result);
    return res.status(201).json(result);
  } catch (e) { return res.status(500).json({ success: false, message: 'Erreur serveur', error: e.message }); }
};

exports.update = async (req, res) => {
  try {
    const result = await ShippingRateService.update(req.params.id, req.body);
    if (!result.success) return res.status(statutEchec(result, 400)).json(result);
    return res.status(200).json(result);
  } catch (e) { return res.status(500).json({ success: false, message: 'Erreur serveur', error: e.message }); }
};

exports.delete = async (req, res) => {
  try {
    const result = await ShippingRateService.delete(req.params.id);
    if (!result.success) return res.status(statutEchec(result, 404)).json(result);
    return res.status(200).json(result);
  } catch (e) { return res.status(500).json({ success: false, message: 'Erreur serveur', error: e.message }); }
};
