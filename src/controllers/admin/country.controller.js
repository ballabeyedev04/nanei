const CountryService = require('../../services/country.service');

exports.getCountries = async (req, res) => {
  try {
    const { isActive } = req.query;

    const filters = {};
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    const result = await CountryService.getCountries(filters);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      message: 'Pays récupérés avec succès',
      data: result.data,
    });
  } catch (error) {
    console.error('Error in getCountries:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.getCountryById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await CountryService.getCountryById(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json({
      message: 'Pays récupéré avec succès',
      data: result.data,
    });
  } catch (error) {
    console.error('Error in getCountryById:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.createCountry = async (req, res) => {
  try {
    const result = await CountryService.createCountry(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error in createCountry:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.updateCountry = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await CountryService.updateCountry(id, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in updateCountry:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await CountryService.deleteCountry(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in deleteCountry:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};
