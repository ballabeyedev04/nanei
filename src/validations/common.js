const Joi = require('joi');

const telephone = Joi.string()
  .pattern(/^\+?[0-9\s\-\.]{7,20}$/)
  .message('{{#label}} doit être un numéro de téléphone valide');

const motDePasse = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .message('{{#label}} doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre');

const nom    = Joi.string().trim().min(2).max(50);
const prenom = Joi.string().trim().min(2).max(50);
const email  = Joi.string().trim().email().lowercase();
const adresse = Joi.string().trim().max(200);

module.exports = { telephone, motDePasse, nom, prenom, email, adresse };
