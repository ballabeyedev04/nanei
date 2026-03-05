module.exports = ({ prenom, nom }) => {
  const logoUrl = 'http://localhost:3000/uploads/logo-sign.png';

  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Bienvenue sur Sign</title>
    <style>
      body { font-family: 'Helvetica', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 40px auto; background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .logo { text-align: center; margin-bottom: 30px; }
      .logo img { max-width: 160px; }
      h1 { color: #111827; font-size: 24px; margin-bottom: 15px; }
      p { color: #374151; font-size: 16px; line-height: 1.5; }
      .btn { display: inline-block; padding: 14px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 8px; margin-top: 25px; font-weight: bold; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); transition: background 0.3s ease; }
      .btn:hover { background-color: #1e40af; }
      .footer { text-align: center; font-size: 12px; color: #9ca3af; margin-top: 30px; }
      @media (max-width: 640px) {
        .container { padding: 20px; margin: 20px; }
        h1 { font-size: 20px; }
        p { font-size: 15px; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">
        <img src="${logoUrl}" alt="Sign Logo" />
      </div>
      <h1>Bonjour ${prenom} ${nom},</h1>
      <p>Bienvenue sur <strong>Sign</strong> ! 🎉 Nous sommes ravis de vous compter parmi nos utilisateurs.</p>
      <p>Connectez-vous dès maintenant pour découvrir toutes les fonctionnalités et gérer vos documents en toute sécurité.</p>
      <div style="text-align:center;">
        <a class="btn" href="http://localhost:3000/login">Se connecter</a>
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} Sign. Tous droits réservés.
      </div>
    </div>
  </body>
  </html>
  `;
};
