const Joi = require('joi');
const { telephone, motDePasse, nom, prenom, email, adresse } = require('./common');

const forgotPasswordSchema = Joi.object({
  email: email.required()
});

const resetPasswordSchema = Joi.object({
  email:        email.required(),
  otpRecu:      Joi.string().trim().min(6).max(12).required(),
  mot_de_passe: motDePasse.required()
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: motDePasse.required()
});

const modifierProfilSchema = Joi.object({
  nom:       nom.optional(),
  prenom:    prenom.optional(),
  email:     email.optional(),
  adresse:   adresse.optional().allow(''),
  telephone: telephone.optional().allow('')
});

module.exports = {
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  modifierProfilSchema
};
