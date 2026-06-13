const Joi = require('joi');
const { telephone, motDePasse, nom, prenom, email, adresse } = require('./common');

const registerSchema = Joi.object({
  nom:          nom.required(),
  prenom:       prenom.required(),
  email:        email.required(),
  mot_de_passe: motDePasse.required(),
  adresse:      adresse.optional().allow(''),
  telephone:    telephone.optional().allow(''),
  role: Joi.string().valid('Particulier').default('Particulier')
});

const loginSchema = Joi.object({
  identifiant:  Joi.string().trim().required(),
  mot_de_passe: Joi.string().required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional().allow('', null)
});

const forgotPasswordSchema = Joi.object({
  email: email.required()
});

const resetPasswordSchema = Joi.object({
  mot_de_passe: motDePasse.required()
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema
};
