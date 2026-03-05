const formatUser = (utilisateur) => ({
  id: utilisateur.id,
  nom: utilisateur.nom,
  prenom: utilisateur.prenom,
  email: utilisateur.email,
  adresse: utilisateur.adresse,
  telephone: utilisateur.telephone,
  role: utilisateur.role,
});

module.exports = formatUser;
