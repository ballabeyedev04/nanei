const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Audit Fonctionnel — Nanei FrancoMaliShip</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Inter',sans-serif;background:#F4F4F0;color:#111;font-size:13px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .page{max-width:900px;margin:0 auto;background:white;}

  /* COVER */
  .cover{background:linear-gradient(145deg,#0F172A 0%,#1E293B 60%,#0F172A 100%);padding:64px;position:relative;overflow:hidden;min-height:580px;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;}
  .cover::before{content:'';position:absolute;width:500px;height:500px;background:radial-gradient(circle,rgba(255,122,0,0.15),transparent 70%);top:-150px;right:-100px;}
  .cover::after{content:'';position:absolute;width:300px;height:300px;background:radial-gradient(circle,rgba(99,102,241,0.12),transparent 70%);bottom:-80px;left:50px;}
  .cover-tag{display:inline-block;background:rgba(255,122,0,0.15);border:1px solid rgba(255,122,0,0.4);color:#FF7A00;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:24px;position:relative;z-index:1;}
  .cover h1{font-size:38px;font-weight:900;color:white;line-height:1.1;letter-spacing:-1px;margin-bottom:10px;position:relative;z-index:1;}
  .cover h1 span{color:#FF7A00;}
  .cover-sub{font-size:14px;color:rgba(255,255,255,0.5);max-width:500px;line-height:1.7;margin-bottom:36px;position:relative;z-index:1;}
  .cover-stats{display:flex;gap:16px;position:relative;z-index:1;}
  .stat-pill{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);padding:10px 18px;border-radius:10px;text-align:center;}
  .stat-num{font-size:22px;font-weight:900;color:white;}
  .stat-num.orange{color:#FF7A00;}
  .stat-num.green{color:#34D399;}
  .stat-num.red{color:#F87171;}
  .stat-label{font-size:10px;color:rgba(255,255,255,0.4);font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin-top:2px;}
  .cover-bottom{display:flex;justify-content:space-between;align-items:flex-end;position:relative;z-index:1;}
  .cover-apps{display:flex;gap:8px;}
  .app-pill{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.6);padding:4px 12px;border-radius:8px;font-size:10px;font-weight:600;}
  .cover-date{font-size:11px;color:rgba(255,255,255,0.25);}

  /* SECTION */
  .sec{padding:48px 56px;page-break-after:always;}
  .sec:last-of-type{page-break-after:auto;}
  .sec-tag{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}
  .sec-title{font-size:26px;font-weight:900;color:#111;letter-spacing:-0.5px;margin-bottom:8px;}
  .sec-desc{font-size:13px;color:#666;max-width:650px;line-height:1.7;margin-bottom:28px;}

  /* COMPETITOR CARDS */
  .comp-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:28px;}
  .comp-card{border:1.5px solid #E5E7EB;border-radius:12px;padding:16px;background:#FAFAFA;}
  .comp-logo{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:10px;}
  .comp-name{font-size:13px;font-weight:800;color:#111;margin-bottom:4px;}
  .comp-country{font-size:10px;color:#999;font-weight:600;margin-bottom:8px;}
  .comp-feat{font-size:11px;color:#555;line-height:1.7;}
  .comp-feat li{list-style:none;padding:2px 0;display:flex;align-items:flex-start;gap:5px;}
  .comp-feat li::before{content:'✓';font-weight:800;flex-shrink:0;margin-top:1px;}

  /* EXISTING FEATURES */
  .existing-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;}
  .exist-item{display:flex;align-items:flex-start;gap:10px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:10px 12px;}
  .exist-check{font-size:14px;flex-shrink:0;}
  .exist-title{font-size:12px;font-weight:700;color:#059669;}
  .exist-desc{font-size:10px;color:#6B7280;margin-top:1px;}

  /* MISSING FEATURES — MAIN SECTION */
  .priority-header{
    display:flex;align-items:center;gap:12px;
    border-radius:12px;padding:14px 18px;margin-bottom:14px;
  }
  .priority-header.p1{background:#FEF2F2;border:1.5px solid #FECACA;}
  .priority-header.p2{background:#FFF4E8;border:1.5px solid #FFD9A8;}
  .priority-header.p3{background:#EEF3FF;border:1.5px solid #B5D0F8;}
  .priority-header.p4{background:#F5F3FF;border:1.5px solid #DDD6FE;}
  .priority-icon{font-size:22px;flex-shrink:0;}
  .priority-title{font-size:15px;font-weight:800;}
  .priority-header.p1 .priority-title{color:#DC2626;}
  .priority-header.p2 .priority-title{color:#CC5F00;}
  .priority-header.p3 .priority-title{color:#1463F3;}
  .priority-header.p4 .priority-title{color:#7C3AED;}
  .priority-sub{font-size:11px;color:#777;margin-top:2px;}

  /* FEATURE ROW */
  .feat-list{margin-bottom:20px;}
  .feat-row{
    display:flex;align-items:flex-start;gap:12px;
    padding:11px 14px;border-radius:10px;margin-bottom:6px;
    border:1px solid;
  }
  .feat-row.p1{background:#FFFBFB;border-color:#FECACA;}
  .feat-row.p2{background:#FFFDF8;border-color:#FFE4B3;}
  .feat-row.p3{background:#F8FBFF;border-color:#BFDBFE;}
  .feat-row.p4{background:#FAFAFF;border-color:#E0D9FE;}
  .feat-num{
    width:24px;height:24px;border-radius:7px;
    font-size:11px;font-weight:800;color:white;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;
  }
  .feat-num.p1{background:#EF4444;}
  .feat-num.p2{background:#FF7A00;}
  .feat-num.p3{background:#3B82F6;}
  .feat-num.p4{background:#8B5CF6;}
  .feat-content{}
  .feat-title{font-size:12px;font-weight:700;color:#111;margin-bottom:2px;}
  .feat-desc{font-size:11px;color:#666;line-height:1.5;}
  .feat-tags{display:flex;gap:5px;margin-top:5px;flex-wrap:wrap;}
  .tag{font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;}
  .tag.mobile{background:#FFF4E8;color:#CC5F00;}
  .tag.back{background:#F0FDF4;color:#059669;}
  .tag.admin{background:#EEF3FF;color:#1463F3;}
  .tag.ref{background:#F9FAFB;color:#6B7280;border:1px solid #E5E7EB;}
  .tag.new{background:#F0FDF4;color:#059669;}

  /* IMPACT TABLE */
  .impact-table{width:100%;border-collapse:collapse;margin:14px 0;}
  .impact-table th{background:#F9FAFB;font-size:10px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;padding:10px 14px;text-align:left;border-bottom:2px solid #F0F0EE;}
  .impact-table td{padding:9px 14px;font-size:11px;border-bottom:1px solid #F8F8F6;vertical-align:top;color:#111;}
  .impact-table tr:last-child td{border-bottom:none;}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;}
  .badge.high{background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;}
  .badge.med{background:#FFF4E8;color:#CC5F00;border:1px solid #FFD9A8;}
  .badge.low{background:#EEF3FF;color:#1463F3;border:1px solid #B5D0F8;}
  .badge.quick{background:#F0FDF4;color:#059669;border:1px solid #BBF7D0;}

  /* ROADMAP */
  .roadmap-row{display:flex;gap:12px;margin-bottom:10px;}
  .roadmap-phase{
    flex:1;border-radius:12px;padding:16px;border:1.5px solid;
  }
  .roadmap-phase.now{border-color:#FECACA;background:#FFFBFB;}
  .roadmap-phase.soon{border-color:#FFD9A8;background:#FFFDF8;}
  .roadmap-phase.later{border-color:#B5D0F8;background:#F8FBFF;}
  .roadmap-phase-title{font-size:12px;font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
  .roadmap-phase.now .roadmap-phase-title{color:#DC2626;}
  .roadmap-phase.soon .roadmap-phase-title{color:#CC5F00;}
  .roadmap-phase.later .roadmap-phase-title{color:#1463F3;}
  .roadmap-item{font-size:11px;color:#555;padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.04);display:flex;align-items:flex-start;gap:6px;}
  .roadmap-item:last-child{border-bottom:none;}
  .roadmap-item::before{content:'→';font-weight:700;flex-shrink:0;opacity:0.5;}

  /* SUMMARY BAR */
  .summary-bar{
    background:#111;padding:20px 32px;
    display:flex;align-items:center;justify-content:space-around;
    margin-bottom:0;
  }
  .summary-stat{text-align:center;}
  .summary-stat .n{font-size:24px;font-weight:900;color:#FF7A00;}
  .summary-stat .l{font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.8px;margin-top:2px;}

  /* DIVIDER */
  .divider{height:1px;background:#F0F0EE;margin:20px 0;}

  /* FOOTER */
  .footer{background:#0F172A;padding:18px 56px;display:flex;align-items:center;justify-content:space-between;}
  .footer-brand{font-size:13px;font-weight:900;color:white;}
  .footer-sub{font-size:10px;color:rgba(255,255,255,0.3);margin-top:2px;}
  .footer-right{font-size:10px;color:rgba(255,255,255,0.3);text-align:right;}
</style>
</head>
<body>
<div class="page">

<!-- ══════════ COVER ══════════ -->
<div class="cover">
  <div>
    <div class="cover-tag">Audit Fonctionnel · Juin 2026</div>
    <h1>Ce qui manque à<br/><span>Nanei FrancoMaliShip</span></h1>
    <p class="cover-sub">Analyse complète des fonctionnalités existantes, comparaison avec les concurrents (GS Colis, GPma, ColisVoyage, DHL, Chronopost) et liste exhaustive de tout ce qu'il reste à implémenter.</p>
    <div class="cover-stats">
      <div class="stat-pill"><div class="stat-num green">32</div><div class="stat-label">Fonctions existantes</div></div>
      <div class="stat-pill"><div class="stat-num orange">47</div><div class="stat-label">Fonctions manquantes</div></div>
      <div class="stat-pill"><div class="stat-num red">12</div><div class="stat-label">Critiques (P1)</div></div>
    </div>
  </div>
  <div class="cover-bottom">
    <div class="cover-apps">
      <span class="app-pill">📱 Mobile Flutter</span>
      <span class="app-pill">🖥️ Admin React</span>
      <span class="app-pill">⚙️ Backend Node.js</span>
    </div>
    <div class="cover-date">Nanei — FrancoMaliShip · Juin 2026</div>
  </div>
</div>


<!-- ══════════ PAGE 1 : CONCURRENTS ══════════ -->
<div class="sec">
  <div class="sec-tag" style="color:#6366F1;">Analyse Concurrentielle</div>
  <div class="sec-title">Ce que font les concurrents</div>
  <div class="sec-desc">Applications similaires dans le segment France → Afrique et les grands acteurs mondiaux. Ces fonctionnalités sont devenues des standards attendus par les utilisateurs.</div>

  <div class="comp-grid">
    <!-- GS Colis -->
    <div class="comp-card">
      <div class="comp-logo" style="background:#FFF4E8;">📦</div>
      <div class="comp-name">GS Colis</div>
      <div class="comp-country">🇫🇷 → 🌍 France–Afrique</div>
      <ul class="comp-feat" style="color:#059669;">
        <li>Suivi temps réel par étape</li>
        <li>Push notifications à chaque statut</li>
        <li>Choix aérien / maritime</li>
        <li>Paiement Wave, carte, cash</li>
        <li>Service client réactif</li>
        <li>Prix transparents sans surprise</li>
        <li>Réseau transporteurs qualifiés</li>
      </ul>
    </div>
    <!-- GPma -->
    <div class="comp-card">
      <div class="comp-logo" style="background:#EEF3FF;">✈️</div>
      <div class="comp-name">GPma</div>
      <div class="comp-country">🇫🇷 → 🇸🇳 France–Sénégal</div>
      <ul class="comp-feat" style="color:#059669;">
        <li>Mise en relation voyageur</li>
        <li>Filtres de recherche avancés</li>
        <li>Suivi temps réel colis</li>
        <li>Avis / notes destinataires</li>
        <li>Support client intégré</li>
        <li>Répertoire de contacts</li>
        <li>Suppression compte RGPD</li>
      </ul>
    </div>
    <!-- ColisVoyage -->
    <div class="comp-card">
      <div class="comp-logo" style="background:#F0FDF4;">🌍</div>
      <div class="comp-name">ColisVoyage</div>
      <div class="comp-country">🇫🇷 → 15 pays africains</div>
      <ul class="comp-feat" style="color:#059669;">
        <li>Assurance incluse 500€/colis</li>
        <li>Code SMS secret confirmation</li>
        <li>Paiement Stripe escrow</li>
        <li>Tracking géolocalisation</li>
        <li>Voyageurs vérifiés</li>
        <li>Estimation délai livraison</li>
        <li>Support +15 pays africains</li>
      </ul>
    </div>
    <!-- DHL -->
    <div class="comp-card">
      <div class="comp-logo" style="background:#FEF9C3;">🟡</div>
      <div class="comp-name">DHL Express</div>
      <div class="comp-country">🌐 Mondial</div>
      <ul class="comp-feat" style="color:#059669;">
        <li>Tracking lien public (sans login)</li>
        <li>Étiquette PDF imprimable</li>
        <li>Déclaration douanière en ligne</li>
        <li>Assurance jusqu'à 25 000€</li>
        <li>Réclamation en ligne</li>
        <li>QR code colis</li>
        <li>Export données / rapports</li>
      </ul>
    </div>
    <!-- Chronopost -->
    <div class="comp-card">
      <div class="comp-logo" style="background:#FEE2E2;">🔴</div>
      <div class="comp-name">Chronopost</div>
      <div class="comp-country">🇫🇷 France + international</div>
      <ul class="comp-feat" style="color:#059669;">
        <li>Signature électronique livraison</li>
        <li>Photo preuve de livraison</li>
        <li>Point relais / agence retrait</li>
        <li>SMS + email à chaque étape</li>
        <li>Redirection livraison</li>
        <li>Code de dépôt sécurisé</li>
        <li>Programme fidélité</li>
      </ul>
    </div>
    <!-- Keyops / La Poste Afrique -->
    <div class="comp-card">
      <div class="comp-logo" style="background:#F5F3FF;">🟣</div>
      <div class="comp-name">Keyops Tech</div>
      <div class="comp-country">🌍 Livraison en Afrique</div>
      <ul class="comp-feat" style="color:#059669;">
        <li>Map livreur en temps réel</li>
        <li>Preuve livraison photo + GPS</li>
        <li>Scan QR code destinataire</li>
        <li>Attribution livreur automatique</li>
        <li>Dashboard livreur mobile</li>
        <li>Rapport livraisons par zone</li>
        <li>ETA estimé pour chaque colis</li>
      </ul>
    </div>
  </div>

  <div style="background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:12px;padding:18px;">
    <div style="font-size:11px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Standards du marché en 2026</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
      <div style="font-size:11px;color:#111;line-height:1.7;"><strong style="color:#FF7A00;">Obligatoires</strong><br/>✓ Push notifications réelles (FCM)<br/>✓ Suivi détaillé étape par étape<br/>✓ Assurance sur les colis<br/>✓ Lien de suivi public</div>
      <div style="font-size:11px;color:#111;line-height:1.7;"><strong style="color:#1463F3;">Très attendus</strong><br/>✓ QR code par colis<br/>✓ Preuve de livraison (photo)<br/>✓ Réclamation en ligne<br/>✓ Déclaration douanière</div>
      <div style="font-size:11px;color:#111;line-height:1.7;"><strong style="color:#7C3AED;">Différenciants</strong><br/>✓ Programme fidélité / points<br/>✓ Parrainage (référral)<br/>✓ Chat support live<br/>✓ Map livreur temps réel</div>
    </div>
  </div>
</div>


<!-- ══════════ PAGE 2 : CE QUI EXISTE ══════════ -->
<div class="sec">
  <div class="sec-tag" style="color:#059669;">Ce qui est déjà implémenté ✅</div>
  <div class="sec-title">Fonctionnalités existantes</div>
  <div class="sec-desc">32 fonctionnalités déjà en place à travers le backend, le panel admin et l'application mobile Flutter.</div>

  <div style="font-size:11px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">📱 Mobile Flutter</div>
  <div class="existing-grid">
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Inscription / Connexion / JWT</div><div class="exist-desc">Register, login, refresh token, logout</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Formulaire envoi colis multi-étapes</div><div class="exist-desc">Pays, poids, type, destinataire, prix dynamique</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Recherche destinataire autocomplete</div><div class="exist-desc">Par nom, email ou téléphone en temps réel</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Suivi colis (envoyés & reçus)</div><div class="exist-desc">3 statuts : en_attente, récupéré, livré</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Statistiques colis du dashboard</div><div class="exist-desc">Envoyés, reçus, en attente, livrés</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Notifications in-app</div><div class="exist-desc">Liste notifications + marquer comme lue</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Paiement Wave + Orange Money</div><div class="exist-desc">Checkout URL + webhooks + deep link retour</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Facture PDF téléchargeable</div><div class="exist-desc">Design orange Nanei, logo, tampon payé</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Profil utilisateur modifiable</div><div class="exist-desc">Nom, email, téléphone, adresse, photo</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Calculateur de prix dynamique</div><div class="exist-desc">Aérien/maritime, services optionnels</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Réinitialisation mot de passe (OTP)</div><div class="exist-desc">Email OTP + reset password</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Formulaire de contact / support</div><div class="exist-desc">Message envoyé à l'admin</div></div></div>
  </div>

  <div style="font-size:11px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin:16px 0 12px;">🖥️ Admin Panel & ⚙️ Backend</div>
  <div class="existing-grid">
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Dashboard KPIs admin</div><div class="exist-desc">Clients, admins, colis par statut</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Gestion colis + changement statut</div><div class="exist-desc">En attente → Récupéré → Livré</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Gestion utilisateurs clients</div><div class="exist-desc">Liste, search, activer/désactiver</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Gestion admins (CRUD)</div><div class="exist-desc">Ajouter, activer, désactiver, chercher</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Messages clients + réponse email</div><div class="exist-desc">Voir messages, répondre par email</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Gestion pays actifs (CRUD)</div><div class="exist-desc">Ajout, modification, activation pays</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Tarification dynamique</div><div class="exist-desc">Shipping rates + service rates par pays</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Suivi paiements admin</div><div class="exist-desc">Liste, filtres, changement statut manuel</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Auth JWT sécurisée</div><div class="exist-desc">Access + refresh token, rate limiting, CORS</div></div></div>
    <div class="exist-item"><span class="exist-check">✅</span><div><div class="exist-title">Génération PDF facture Puppeteer</div><div class="exist-desc">Template orange, logo base64, A4</div></div></div>
  </div>
</div>


<!-- ══════════ PAGE 3 : MANQUE PRIORITÉ 1 (CRITIQUE) ══════════ -->
<div class="sec">
  <div class="sec-tag" style="color:#DC2626;">Fonctionnalités Manquantes · Priorité 1</div>
  <div class="sec-title">Critique — À faire en premier</div>
  <div class="sec-desc">Ces 12 fonctionnalités sont présentes chez <strong>tous</strong> les concurrents. Leur absence impacte directement la confiance et l'expérience utilisateur.</div>

  <div class="priority-header p1">
    <div class="priority-icon">🔴</div>
    <div>
      <div class="priority-title">Priorité 1 — Impact maximum, attendu par tous les utilisateurs</div>
      <div class="priority-sub">Présent chez GS Colis, GPma, ColisVoyage, DHL, Chronopost</div>
    </div>
  </div>

  <div class="feat-list">

    <div class="feat-row p1">
      <div class="feat-num p1">1</div>
      <div class="feat-content">
        <div class="feat-title">Push Notifications Firebase (FCM) — Alertes statut colis en temps réel</div>
        <div class="feat-desc">Actuellement les notifications existent en base de données mais il n'y a <strong>aucune notification push</strong> envoyée sur le téléphone. Quand le statut d'un colis change (admin marque "livré"), le client n'est pas averti. Il faut intégrer Firebase Cloud Messaging (FCM) : côté backend envoyer un push, côté Flutter écouter les messages.</div>
        <div class="feat-tags">
          <span class="tag mobile">📱 Mobile</span>
          <span class="tag back">⚙️ Backend</span>
          <span class="tag ref">Référence : GS Colis, DHL, Chronopost</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">2</div>
      <div class="feat-content">
        <div class="feat-title">SMS + Email automatique à chaque changement de statut</div>
        <div class="feat-desc">Quand un colis passe de "en attente" à "récupéré" puis "livré", ni le client ni le destinataire ne reçoivent de SMS ou email automatique. Il faut envoyer un email transactionnel (Nodemailer/SendGrid) et idéalement un SMS (Orange SMS API, Twilio ou infobip) à l'expéditeur ET au destinataire.</div>
        <div class="feat-tags">
          <span class="tag back">⚙️ Backend</span>
          <span class="tag ref">Référence : Chronopost, ColisVoyage, GS Colis</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">3</div>
      <div class="feat-content">
        <div class="feat-title">Lien de suivi public (sans login) partageable</div>
        <div class="feat-desc">Actuellement le suivi est uniquement accessible dans l'application après connexion. Il faut une URL publique de type <strong>nanei.app/suivi/NAN-2026-001</strong> accessible depuis n'importe quel navigateur sans créer de compte, que l'expéditeur peut partager par WhatsApp/SMS au destinataire. Standard absolu chez tous les transporteurs.</div>
        <div class="feat-tags">
          <span class="tag back">⚙️ Backend</span>
          <span class="tag admin">🖥️ Admin</span>
          <span class="tag ref">Référence : DHL, Chronopost, GS Colis</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">4</div>
      <div class="feat-content">
        <div class="feat-title">Étiquette colis PDF imprimable (bon de transport)</div>
        <div class="feat-desc">À la création d'un colis, il n'y a aucune étiquette générée. DHL, Chronopost et même GS Colis génèrent une étiquette avec QR code ou code-barres, numéro de référence, adresses expéditeur/destinataire. Cette étiquette est collée sur le colis physique. Indispensable pour les opérations logistiques.</div>
        <div class="feat-tags">
          <span class="tag back">⚙️ Backend (Puppeteer)</span>
          <span class="tag mobile">📱 Mobile (bouton télécharger)</span>
          <span class="tag admin">🖥️ Admin (impression)</span>
          <span class="tag ref">Référence : DHL, Chronopost, La Poste</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">5</div>
      <div class="feat-content">
        <div class="feat-title">Assurance sur le colis (montant déclaré + couverture)</div>
        <div class="feat-desc">Aucune option d'assurance n'existe. ColisVoyage offre 500€ inclus, DHL jusqu'à 25 000€. Il faut : (1) lors de l'envoi, laisser le client déclarer la valeur du contenu, (2) proposer des niveaux d'assurance optionnels (ex: 50 000 FCFA, 100 000 FCFA, 250 000 FCFA), (3) stocker la valeur déclarée en BDD, (4) afficher la couverture sur la facture.</div>
        <div class="feat-tags">
          <span class="tag mobile">📱 Mobile (choix lors envoi)</span>
          <span class="tag back">⚙️ Backend (model)</span>
          <span class="tag admin">🖥️ Admin (affichage)</span>
          <span class="tag ref">Référence : ColisVoyage, DHL, Chronopost</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">6</div>
      <div class="feat-content">
        <div class="feat-title">Déclaration du contenu du colis + valeur douanière</div>
        <div class="feat-desc">Le formulaire d'envoi demande seulement "description" et "type_colis". Il manque : <strong>liste des articles</strong> (vêtements x3, chaussures x2...), <strong>valeur déclarée en FCFA/EUR</strong>, et <strong>catégorie douanière</strong> (alimentaire, vêtements, électronique, médicaments...). Ces informations sont obligatoires pour le passage en douane, surtout pour le transport aérien.</div>
        <div class="feat-tags">
          <span class="tag mobile">📱 Mobile (step envoi)</span>
          <span class="tag back">⚙️ Backend (model Colis)</span>
          <span class="tag ref">Référence : DHL, La Poste, Chronopost</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">7</div>
      <div class="feat-content">
        <div class="feat-title">Dimensions du colis (L × l × H) en plus du poids</div>
        <div class="feat-desc">Le modèle Colis stocke uniquement le poids. Tous les transporteurs professionnels utilisent le <strong>poids volumétrique</strong> = (L × l × H) / 5000. Un colis léger mais encombrant (ex: polystyrène, coussin) se facture sur son volume. Il faut ajouter les champs dimensions dans le formulaire et le calcul du poids volumétrique dans le service de pricing.</div>
        <div class="feat-tags">
          <span class="tag mobile">📱 Mobile (formulaire)</span>
          <span class="tag back">⚙️ Backend (model + pricing)</span>
          <span class="tag ref">Référence : DHL, FedEx, Chronopost</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">8</div>
      <div class="feat-content">
        <div class="feat-title">Suivi détaillé avec historique d'étapes (timeline)</div>
        <div class="feat-desc">Le modèle actuel a 3 statuts (en_attente, récupéré, livré). Il n'y a aucun historique des changements avec dates/heures. Les utilisateurs s'attendent à voir : "Colis créé → Récupéré par l'agent (20 juin 14h30) → En transit → Arrivé en douane → En livraison → Livré". Il faut une table <strong>ColisHistorique</strong> qui log chaque changement de statut avec timestamp, commentaire et auteur.</div>
        <div class="feat-tags">
          <span class="tag mobile">📱 Mobile (timeline UI)</span>
          <span class="tag back">⚙️ Backend (model ColisHistorique)</span>
          <span class="tag admin">🖥️ Admin (ajouter commentaire)</span>
          <span class="tag ref">Référence : GS Colis, DHL, GPma</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">9</div>
      <div class="feat-content">
        <div class="feat-title">Réclamation en ligne (colis perdu, endommagé, retard)</div>
        <div class="feat-desc">Si un colis est perdu ou endommagé, le client n'a aucun moyen de faire une réclamation dans l'app. Il faut un formulaire "Signaler un problème" sur le détail d'un colis : type de problème, description, photos jointes, et un workflow admin pour traiter la réclamation (voir, répondre, rembourser). DHL, Chronopost et ColisVoyage ont tous ce système.</div>
        <div class="feat-tags">
          <span class="tag mobile">📱 Mobile (formulaire)</span>
          <span class="tag back">⚙️ Backend (model Réclamation)</span>
          <span class="tag admin">🖥️ Admin (gestion)</span>
          <span class="tag ref">Référence : DHL, Chronopost, ColisVoyage</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">10</div>
      <div class="feat-content">
        <div class="feat-title">Estimation délai de livraison affiché (ETA)</div>
        <div class="feat-desc">Lors de l'envoi d'un colis et sur la page de suivi, aucun délai estimé n'est affiché. Pour le transport aérien Mali/Sénégal c'est ≈ 3–5 jours, maritime ≈ 4–6 semaines. Il faut stocker la date d'envoi réelle et calculer/afficher la date estimée de livraison selon le type de transport et la destination.</div>
        <div class="feat-tags">
          <span class="tag mobile">📱 Mobile (suivi + envoi)</span>
          <span class="tag back">⚙️ Backend (calcul ETA)</span>
          <span class="tag ref">Référence : GS Colis, DHL, GPma</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">11</div>
      <div class="feat-content">
        <div class="feat-title">Répertoire de destinataires sauvegardés (contacts fréquents)</div>
        <div class="feat-desc">À chaque envoi, le client doit rechercher à nouveau le destinataire. Il n'y a aucune sauvegarde des destinataires fréquents. GPma et GS Colis ont une liste de contacts favoris. Il faut ajouter un système pour sauvegarder des destinataires ("Mes contacts"), les réutiliser lors d'un nouvel envoi et les gérer (renommer, supprimer).</div>
        <div class="feat-tags">
          <span class="tag mobile">📱 Mobile</span>
          <span class="tag back">⚙️ Backend (model ContactFavori)</span>
          <span class="tag ref">Référence : GPma, GS Colis</span>
        </div>
      </div>
    </div>

    <div class="feat-row p1">
      <div class="feat-num p1">12</div>
      <div class="feat-content">
        <div class="feat-title">Preuve de livraison (photo + signature électronique)</div>
        <div class="feat-desc">Quand le livreur marque un colis comme "livré", aucune preuve n'est enregistrée. Chronopost et Keyops prennent une photo du colis déposé et/ou font signer le destinataire. Il faut une interface mobile livreur (ou admin) pour uploader la photo de livraison, qui sera visible par le client dans l'app comme confirmation.</div>
        <div class="feat-tags">
          <span class="tag admin">🖥️ Admin / App Livreur</span>
          <span class="tag back">⚙️ Backend (upload Cloudinary)</span>
          <span class="tag mobile">📱 Mobile (voir preuve)</span>
          <span class="tag ref">Référence : Chronopost, Keyops, BUNDDL</span>
        </div>
      </div>
    </div>

  </div>
</div>


<!-- ══════════ PAGE 4 : PRIORITÉ 2 (IMPORTANT) ══════════ -->
<div class="sec">
  <div class="sec-tag" style="color:#CC5F00;">Fonctionnalités Manquantes · Priorité 2</div>
  <div class="sec-title">Important — Impact commercial & fidélisation</div>
  <div class="sec-desc">Ces 15 fonctionnalités augmentent significativement la rétention client, le chiffre d'affaires et l'efficacité opérationnelle.</div>

  <div class="priority-header p2">
    <div class="priority-icon">🟠</div>
    <div>
      <div class="priority-title">Priorité 2 — Fonctionnalités différenciantes et de fidélisation</div>
      <div class="priority-sub">Présentes chez les leaders du segment, non encore disponibles</div>
    </div>
  </div>

  <div class="feat-list">

    <div class="feat-row p2">
      <div class="feat-num p2">13</div>
      <div class="feat-content">
        <div class="feat-title">Programme de fidélité — Points & récompenses</div>
        <div class="feat-desc">Chaque envoi rapporte des points (ex: 1 point = 100 FCFA de réduction). Les points sont cumulables et échangeables contre des réductions sur le prochain envoi. Chronopost et les grandes plateformes utilisent ce système pour fidéliser. Il faut un model <strong>PointsFidelite</strong>, l'affichage dans le profil et la déduction automatique au paiement.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend</span><span class="tag admin">🖥️ Admin</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">14</div>
      <div class="feat-content">
        <div class="feat-title">Codes promo & réductions</div>
        <div class="feat-desc">Aucun système de code promotionnel n'existe. Il faut pouvoir créer des codes (PROMO10, BIENVENUE20) avec pourcentage ou montant fixe de réduction, date d'expiration, nombre d'utilisations max, et applicable à des pays ou types d'envoi spécifiques. Saisie du code lors du paiement dans l'app.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend</span><span class="tag admin">🖥️ Admin (créer codes)</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">15</div>
      <div class="feat-content">
        <div class="feat-title">Programme de parrainage (référral)</div>
        <div class="feat-desc">Chaque client reçoit un lien de parrainage unique. Quand un nouveau client s'inscrit via ce lien et effectue son premier envoi, le parrain reçoit une récompense (points, réduction). Standard chez les apps de livraison africaines. Nécessite un code de parrainage dans le profil utilisateur et la logique de crédit.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">16</div>
      <div class="feat-content">
        <div class="feat-title">QR Code par colis (scan à la prise en charge)</div>
        <div class="feat-desc">Générer un QR code unique pour chaque colis à la création. L'agent peut le scanner avec son téléphone pour confirmer la prise en charge et la remise. Le destinataire peut aussi présenter un QR code pour retirer le colis en agence. Utiliser la bibliothèque <strong>qrcode</strong> côté backend et <strong>mobile_scanner</strong> côté Flutter.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend</span><span class="tag admin">🖥️ Admin</span><span class="tag ref">Référence : DHL, Chronopost, Keyops</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">17</div>
      <div class="feat-content">
        <div class="feat-title">Calculateur de prix public (sans connexion)</div>
        <div class="feat-desc">Il existe un endpoint /pricing/calculate mais il n'est pas accessible sans login. Il faut une page/écran public "Calculer le prix de votre envoi" : sélectionner le pays de destination, entrer le poids, choisir aérien/maritime, voir le prix instantanément. C'est le premier outil de conversion pour les visiteurs non inscrits.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile (écran public)</span><span class="tag back">⚙️ Backend (route publique)</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">18</div>
      <div class="feat-content">
        <div class="feat-title">Export CSV / Excel des colis et paiements (admin)</div>
        <div class="feat-desc">Aucune fonction d'export n'existe côté admin. Pour la comptabilité, rapports mensuels et analyses, il faut pouvoir exporter : liste des colis (par période, statut, pays), liste des paiements, revenus par pays/mois. Utiliser la bibliothèque <strong>xlsx</strong> ou <strong>csv-writer</strong> côté backend avec endpoint dédié.</div>
        <div class="feat-tags"><span class="tag admin">🖥️ Admin</span><span class="tag back">⚙️ Backend</span><span class="tag ref">Référence : DHL Pro, tous les SaaS logistics</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">19</div>
      <div class="feat-content">
        <div class="feat-title">Graphiques revenus & analytiques (admin dashboard)</div>
        <div class="feat-desc">Le dashboard admin affiche uniquement des compteurs. Il faut des graphiques : CA mensuel par courbe, répartition par pays (pie chart), évolution du nombre de colis (barres), taux de livraison réussie, revenus par moyen de paiement (Wave vs OM). Utiliser <strong>Recharts</strong> ou <strong>Chart.js</strong> dans l'admin React.</div>
        <div class="feat-tags"><span class="tag admin">🖥️ Admin</span><span class="tag back">⚙️ Backend (endpoints stats)</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">20</div>
      <div class="feat-content">
        <div class="feat-title">Gestion des livreurs (rôle dédié + app livreur)</div>
        <div class="feat-desc">Actuellement seuls Admin et Particulier existent comme rôles. Il manque le rôle <strong>Livreur</strong> : créer un compte livreur, lui assigner des colis à livrer, il valide la livraison depuis son téléphone (photo, confirmation). Sans livreur identifié, la traçabilité "last mile" est impossible.</div>
        <div class="feat-tags"><span class="tag back">⚙️ Backend (rôle Livreur)</span><span class="tag admin">🖥️ Admin (assignation)</span><span class="tag mobile">📱 Mobile (app livreur)</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">21</div>
      <div class="feat-content">
        <div class="feat-title">Onboarding interactif (walkthrough première connexion)</div>
        <div class="feat-desc">À la première connexion, l'utilisateur arrive directement sur le dashboard sans aucune explication. Un walkthrough de 3–4 écrans expliquant "Comment envoyer votre premier colis" augmente significativement l'engagement initial. Utiliser <strong>introduction_screen</strong> ou une bottom sheet guidée lors du premier lancement.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">22</div>
      <div class="feat-content">
        <div class="feat-title">Authentification biométrique (Face ID / Empreinte)</div>
        <div class="feat-desc">L'app nécessite email + mot de passe à chaque ouverture. Ajouter <strong>local_auth</strong> (Flutter) pour permettre la connexion par empreinte digitale ou Face ID après la première connexion. Le token JWT est stocké dans le SecureStorage et réutilisé. Standard sur toutes les apps financières en 2026.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile (local_auth)</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">23</div>
      <div class="feat-content">
        <div class="feat-title">Partage du suivi par WhatsApp / SMS / lien</div>
        <div class="feat-desc">Depuis la page de suivi d'un colis, le client devrait pouvoir partager un lien de tracking avec le destinataire par WhatsApp, SMS ou copier le lien. Utiliser <strong>share_plus</strong> Flutter + le lien public de suivi (feature #3). Très demandé pour la diaspora africaine.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile (share_plus)</span><span class="tag back">⚙️ Backend (lien public)</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">24</div>
      <div class="feat-content">
        <div class="feat-title">Avis & notes sur la livraison (rating)</div>
        <div class="feat-desc">Après la livraison d'un colis (statut = livré), le client reçoit une notification pour noter la livraison de 1 à 5 étoiles et laisser un commentaire. Ces avis sont visibles dans le dashboard admin et permettent de mesurer la qualité de service. GPma a ce système pour noter les voyageurs.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend (model Avis)</span><span class="tag admin">🖥️ Admin</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">25</div>
      <div class="feat-content">
        <div class="feat-title">Alertes automatiques admin (colis bloqué X jours)</div>
        <div class="feat-desc">Si un colis reste en statut "en_attente" depuis plus de 3 jours sans mise à jour, aucune alerte n'est générée. Il faut un job cron (node-cron) qui vérifie quotidiennement et notifie l'admin des colis bloqués. Évite les oublis et améliore la traçabilité opérationnelle.</div>
        <div class="feat-tags"><span class="tag back">⚙️ Backend (cron job)</span><span class="tag admin">🖥️ Admin (tableau alertes)</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">26</div>
      <div class="feat-content">
        <div class="feat-title">Rapport financier mensuel PDF (admin)</div>
        <div class="feat-desc">Chaque fin de mois, générer automatiquement un PDF de rapport financier : CA total, CA par pays, CA par moyen de paiement, nombre de colis, taux de livraison, comparaison mois précédent. Envoyé par email à l'admin ou téléchargeable depuis le panel. Utiliser Puppeteer (déjà en place).</div>
        <div class="feat-tags"><span class="tag admin">🖥️ Admin</span><span class="tag back">⚙️ Backend (Puppeteer + cron)</span></div>
      </div>
    </div>

    <div class="feat-row p2">
      <div class="feat-num p2">27</div>
      <div class="feat-content">
        <div class="feat-title">Historique des actions admin (audit log)</div>
        <div class="feat-desc">Aucun historique des actions n'est conservé. Si un admin change le statut d'un colis ou désactive un client, aucune trace n'est gardée. Il faut un log : qui a fait quoi, sur quel objet, à quelle heure. Crucial pour la sécurité et la résolution de litiges.</div>
        <div class="feat-tags"><span class="tag back">⚙️ Backend (model AuditLog)</span><span class="tag admin">🖥️ Admin (page logs)</span></div>
      </div>
    </div>

  </div>
</div>


<!-- ══════════ PAGE 5 : PRIORITÉ 3 & 4 ══════════ -->
<div class="sec">
  <div class="sec-tag" style="color:#1463F3;">Fonctionnalités Manquantes · Priorité 3 & 4</div>
  <div class="sec-title">Nice-to-have & Améliorations UX</div>
  <div class="sec-desc">Ces fonctionnalités améliorent l'expérience mais peuvent être implémentées après les priorités 1 et 2.</div>

  <div class="priority-header p3" style="margin-bottom:10px;">
    <div class="priority-icon">🔵</div>
    <div>
      <div class="priority-title">Priorité 3 — UX & Expérience avancée</div>
      <div class="priority-sub">Améliore l'expérience mais non bloquant au lancement</div>
    </div>
  </div>

  <div class="feat-list">
    <div class="feat-row p3">
      <div class="feat-num p3">28</div>
      <div class="feat-content">
        <div class="feat-title">Multi-colis en une seule commande</div>
        <div class="feat-desc">Actuellement un seul colis par envoi. Permettre d'ajouter plusieurs colis dans une même commande pour un même destinataire (ex: 3 cartons), avec tarification groupée et une seule facture.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">29</div>
      <div class="feat-content">
        <div class="feat-title">Mode sombre (Dark Mode)</div>
        <div class="feat-desc">L'app est uniquement en mode clair. Flutter supporte nativement le dark mode via ThemeData. Ajouter un toggle dans les paramètres avec persistance du choix (SharedPreferences).</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">30</div>
      <div class="feat-content">
        <div class="feat-title">Chat support en temps réel (live chat)</div>
        <div class="feat-desc">Le formulaire de contact actuel est asynchrone (email). Un chat en temps réel (type Intercom, Crisp ou WebSocket custom) permettrait de répondre aux clients instantanément, réduisant les abandons avant le premier envoi.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend (WebSocket)</span><span class="tag admin">🖥️ Admin</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">31</div>
      <div class="feat-content">
        <div class="feat-title">Carte interactive des points de dépôt / agences</div>
        <div class="feat-desc">Afficher sur une carte (Google Maps Flutter) les agences ou points de dépôt disponibles en France et en Afrique. Le client choisit son point de dépôt le plus proche lors de l'envoi.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile (google_maps_flutter)</span><span class="tag admin">🖥️ Admin (gestion points)</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">32</div>
      <div class="feat-content">
        <div class="feat-title">Restrictions de contenu par type de colis</div>
        <div class="feat-desc">Certains contenus sont interdits (batteries lithium, liquides >1L, médicaments sans ordonnance, armes...). Lors de l'envoi, afficher les restrictions selon le pays de destination et faire cocher une case de conformité.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag admin">🖥️ Admin (config restrictions)</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">33</div>
      <div class="feat-content">
        <div class="feat-title">Devis instantané sans compte (landing page)</div>
        <div class="feat-desc">Un widget sur la landing page web ou un écran sans auth dans l'app permettant de calculer le prix d'un envoi instantanément pour convertir les visiteurs en utilisateurs inscrits.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile (écran public)</span><span class="tag back">⚙️ Backend (route publique)</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">34</div>
      <div class="feat-content">
        <div class="feat-title">Gestion de stock / inventaire conteneur (admin)</div>
        <div class="feat-desc">Pour le transport maritime, gérer les conteneurs : capacité max, poids actuel embarqué, date de départ prévue. L'admin voit en temps réel l'espace restant et peut bloquer de nouveaux envois si le conteneur est plein.</div>
        <div class="feat-tags"><span class="tag admin">🖥️ Admin</span><span class="tag back">⚙️ Backend</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">35</div>
      <div class="feat-content">
        <div class="feat-title">Localisation multilingue (Français / Anglais / Bambara)</div>
        <div class="feat-desc">L'app est uniquement en français. Ajouter l'anglais pour les clients anglophones et potentiellement le bambara pour les utilisateurs au Mali. Flutter dispose de flutter_localizations.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile (flutter_localizations)</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">36</div>
      <div class="feat-content">
        <div class="feat-title">Section FAQ / Centre d'aide dans l'app</div>
        <div class="feat-desc">Une section FAQ répondant aux questions fréquentes (délais, restrictions, pertes, prix) réduit les demandes de support. L'admin peut gérer les articles FAQ depuis le panel.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag admin">🖥️ Admin (gestion FAQ)</span></div>
      </div>
    </div>
    <div class="feat-row p3">
      <div class="feat-num p3">37</div>
      <div class="feat-content">
        <div class="feat-title">Paiement par carte bancaire (Stripe / CinetPay)</div>
        <div class="feat-desc">Seuls Wave et Orange Money sont disponibles. Ajouter le paiement par carte bancaire via Stripe (pour les clients en France) ou CinetPay (très utilisé en Afrique de l'Ouest) pour élargir l'accessibilité.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend</span><span class="tag ref">Référence : ColisVoyage (Stripe)</span></div>
      </div>
    </div>
  </div>

  <div class="priority-header p4" style="margin:20px 0 10px;">
    <div class="priority-icon">🟣</div>
    <div>
      <div class="priority-title">Priorité 4 — Vision long terme</div>
      <div class="priority-sub">Fonctionnalités avancées pour la V2 de l'application</div>
    </div>
  </div>

  <div class="feat-list">
    <div class="feat-row p4">
      <div class="feat-num p4">38</div>
      <div class="feat-content">
        <div class="feat-title">Map livreur en temps réel (GPS tracking)</div>
        <div class="feat-desc">Le client voit la position du livreur sur une carte en temps réel lors de la dernière étape de livraison. Nécessite une app livreur avec GPS actif, WebSocket côté backend et Google Maps côté client.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend WebSocket</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">39</div>
      <div class="feat-content">
        <div class="feat-title">Code secret SMS de confirmation de livraison</div>
        <div class="feat-desc">À la livraison, le destinataire reçoit un code SMS à 4 chiffres. Il le communique au livreur pour prouver sa présence. Le livreur entre le code dans l'app pour confirmer la remise (système ColisVoyage). Sécurité maximale contre les fausses livraisons.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend (SMS OTP)</span><span class="tag ref">Référence : ColisVoyage</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">40</div>
      <div class="feat-content">
        <div class="feat-title">Intégration DHL / Chronopost pour les envois express</div>
        <div class="feat-desc">Proposer DHL ou Chronopost comme option express premium pour les envois urgents, en complément du service propre. L'API DHL Express est disponible et permettrait d'offrir une livraison 24-48h pour un prix premium.</div>
        <div class="feat-tags"><span class="tag back">⚙️ Backend (DHL API)</span><span class="tag mobile">📱 Mobile (option envoi)</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">41</div>
      <div class="feat-content">
        <div class="feat-title">Suppression de compte (RGPD / conformité)</div>
        <div class="feat-desc">GPma a une fonctionnalité de suppression de compte. C'est obligatoire pour les apps sur Google Play / App Store et requis par le RGPD. L'utilisateur doit pouvoir demander la suppression de toutes ses données depuis l'app.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">42</div>
      <div class="feat-content">
        <div class="feat-title">Système d'abonnement mensuel (envois illimités)</div>
        <div class="feat-desc">Pour les clients professionnels (commerçants envoyant 10+ colis/mois), proposer un abonnement mensuel avec tarifs préférentiels. Intégration Stripe Billing ou paiement manuel avec activation admin.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile</span><span class="tag back">⚙️ Backend</span><span class="tag admin">🖥️ Admin</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">43</div>
      <div class="feat-content">
        <div class="feat-title">Scan de colis par code-barres (scanner app livreur)</div>
        <div class="feat-desc">L'agent logistique utilise une douchette ou la caméra du téléphone pour scanner le code-barres sur l'étiquette du colis et mettre à jour son statut automatiquement. Utiliser <strong>mobile_scanner</strong> Flutter.</div>
        <div class="feat-tags"><span class="tag mobile">📱 Mobile (livreur)</span><span class="tag back">⚙️ Backend</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">44</div>
      <div class="feat-content">
        <div class="feat-title">Intégration comptable (export Sage / QuickBooks)</div>
        <div class="feat-desc">Pour les besoins comptables avancés, exporter les données de paiement dans un format compatible Sage ou QuickBooks. Utile quand le volume de transactions dépasse 100/mois.</div>
        <div class="feat-tags"><span class="tag admin">🖥️ Admin</span><span class="tag back">⚙️ Backend</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">45</div>
      <div class="feat-content">
        <div class="feat-title">Application Web Progressive (PWA)</div>
        <div class="feat-desc">Permettre l'utilisation de l'interface client (pas admin) depuis un navigateur mobile sans télécharger l'app. Réduit la barrière d'entrée pour les nouveaux utilisateurs ne voulant pas installer l'app.</div>
        <div class="feat-tags"><span class="tag back">⚙️ Frontend Web (Next.js PWA)</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">46</div>
      <div class="feat-content">
        <div class="feat-title">Notifications WhatsApp Business API</div>
        <div class="feat-desc">En Afrique de l'Ouest, WhatsApp est l'outil de communication #1. Envoyer les notifications de changement de statut via l'API WhatsApp Business (Meta) en plus des SMS et emails. Taux d'ouverture supérieur à 90%.</div>
        <div class="feat-tags"><span class="tag back">⚙️ Backend (WhatsApp API)</span><span class="tag ref">Référence : standard en 2026</span></div>
      </div>
    </div>
    <div class="feat-row p4">
      <div class="feat-num p4">47</div>
      <div class="feat-content">
        <div class="feat-title">Intelligence artificielle : estimation délai & prix optimisé</div>
        <div class="feat-desc">À terme, utiliser les données historiques de livraison pour prédire avec précision les délais par route et optimiser les prix selon la demande. Phase V3 du produit.</div>
        <div class="feat-tags"><span class="tag back">⚙️ Backend (ML API)</span></div>
      </div>
    </div>
  </div>
</div>


<!-- ══════════ PAGE 6 : ROADMAP ══════════ -->
<div class="sec">
  <div class="sec-tag" style="color:#059669;">Synthèse & Roadmap</div>
  <div class="sec-title">Plan d'implémentation recommandé</div>
  <div class="sec-desc">Ordre d'implémentation recommandé basé sur l'impact utilisateur, la complexité technique et le retour sur investissement.</div>

  <div class="summary-bar" style="border-radius:12px;margin-bottom:24px;">
    <div class="summary-stat"><div class="n">32</div><div class="l" style="color:rgba(255,255,255,0.4);">Fonctions OK</div></div>
    <div class="summary-stat"><div class="n" style="color:#F87171;">12</div><div class="l" style="color:rgba(255,255,255,0.4);">Priorité 1</div></div>
    <div class="summary-stat"><div class="n" style="color:#FB923C;">15</div><div class="l" style="color:rgba(255,255,255,0.4);">Priorité 2</div></div>
    <div class="summary-stat"><div class="n" style="color:#60A5FA;">10</div><div class="l" style="color:rgba(255,255,255,0.4);">Priorité 3</div></div>
    <div class="summary-stat"><div class="n" style="color:#A78BFA;">10</div><div class="l" style="color:rgba(255,255,255,0.4);">Priorité 4</div></div>
    <div class="summary-stat"><div class="n">47</div><div class="l" style="color:rgba(255,255,255,0.4);">Total manquant</div></div>
  </div>

  <div class="roadmap-row">
    <div class="roadmap-phase now" style="flex:none;width:100%;">
      <div class="roadmap-phase-title">🔴 Sprint 1 — Critique (2–3 semaines)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <div>
          <div class="roadmap-item">#1 Push notifications FCM</div>
          <div class="roadmap-item">#2 SMS + Email auto statut</div>
          <div class="roadmap-item">#3 Lien suivi public</div>
          <div class="roadmap-item">#4 Étiquette PDF imprimable</div>
        </div>
        <div>
          <div class="roadmap-item">#5 Assurance sur les colis</div>
          <div class="roadmap-item">#6 Déclaration contenu douane</div>
          <div class="roadmap-item">#7 Dimensions L×l×H + volumétrique</div>
          <div class="roadmap-item">#8 Timeline historique statuts</div>
        </div>
        <div>
          <div class="roadmap-item">#9 Réclamation en ligne</div>
          <div class="roadmap-item">#10 ETA délai estimé livraison</div>
          <div class="roadmap-item">#11 Répertoire destinataires</div>
          <div class="roadmap-item">#12 Preuve de livraison photo</div>
        </div>
      </div>
    </div>
  </div>

  <div class="roadmap-row" style="margin-top:10px;">
    <div class="roadmap-phase soon" style="flex:none;width:100%;">
      <div class="roadmap-phase-title">🟠 Sprint 2 — Commercial (3–4 semaines)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <div>
          <div class="roadmap-item">#13 Programme fidélité points</div>
          <div class="roadmap-item">#14 Codes promo & réductions</div>
          <div class="roadmap-item">#15 Parrainage référral</div>
          <div class="roadmap-item">#16 QR Code par colis</div>
          <div class="roadmap-item">#17 Calculateur prix public</div>
        </div>
        <div>
          <div class="roadmap-item">#18 Export CSV/Excel admin</div>
          <div class="roadmap-item">#19 Graphiques revenus admin</div>
          <div class="roadmap-item">#20 Rôle Livreur + app</div>
          <div class="roadmap-item">#21 Onboarding interactif</div>
          <div class="roadmap-item">#22 Biométrie Face ID / empreinte</div>
        </div>
        <div>
          <div class="roadmap-item">#23 Partage suivi WhatsApp</div>
          <div class="roadmap-item">#24 Avis & notes livraison</div>
          <div class="roadmap-item">#25 Alertes colis bloqués</div>
          <div class="roadmap-item">#26 Rapport financier PDF mensuel</div>
          <div class="roadmap-item">#27 Audit log actions admin</div>
        </div>
      </div>
    </div>
  </div>

  <div class="roadmap-row" style="margin-top:10px;">
    <div class="roadmap-phase later" style="flex:none;width:100%;">
      <div class="roadmap-phase-title">🔵 Sprint 3 & 4 — UX & Vision (1–2 mois)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
        <div>
          <div class="roadmap-item">#28 Multi-colis une commande</div>
          <div class="roadmap-item">#29 Mode sombre</div>
          <div class="roadmap-item">#30 Chat support live</div>
          <div class="roadmap-item">#31 Carte points de dépôt</div>
          <div class="roadmap-item">#37 Paiement carte Stripe</div>
        </div>
        <div>
          <div class="roadmap-item">#38 Map livreur temps réel</div>
          <div class="roadmap-item">#39 Code SMS confirmation livraison</div>
          <div class="roadmap-item">#41 Suppression compte RGPD</div>
          <div class="roadmap-item">#43 Scan code-barres livreur</div>
          <div class="roadmap-item">#46 Notifications WhatsApp API</div>
        </div>
        <div>
          <div class="roadmap-item">#32 Restrictions contenu par pays</div>
          <div class="roadmap-item">#33 Devis sans compte (landing)</div>
          <div class="roadmap-item">#34 Gestion stock conteneurs</div>
          <div class="roadmap-item">#35 Localisation multilingue</div>
          <div class="roadmap-item">#36 FAQ / Centre d'aide</div>
        </div>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  <div style="background:#F9FAFB;border:1.5px solid #E5E7EB;border-radius:12px;padding:18px;margin-top:16px;">
    <div style="font-size:11px;font-weight:800;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">💡 Les 3 quick wins à faire en priorité absolue</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
      <div style="background:white;border:1.5px solid #FECACA;border-radius:10px;padding:14px;">
        <div style="font-size:18px;margin-bottom:6px;">🔔</div>
        <div style="font-size:12px;font-weight:800;color:#DC2626;margin-bottom:4px;">#1 — Push FCM</div>
        <div style="font-size:11px;color:#555;line-height:1.5;">Impact immédiat sur l'engagement. 2–3 jours d'implémentation. Les utilisateurs reviennent dans l'app.</div>
      </div>
      <div style="background:white;border:1.5px solid #FECACA;border-radius:10px;padding:14px;">
        <div style="font-size:18px;margin-bottom:6px;">🔗</div>
        <div style="font-size:12px;font-weight:800;color:#DC2626;margin-bottom:4px;">#3 — Lien suivi public</div>
        <div style="font-size:11px;color:#555;line-height:1.5;">Réduit les appels support. 1 jour d'implémentation. Partage par WhatsApp → viral growth.</div>
      </div>
      <div style="background:white;border:1.5px solid #FECACA;border-radius:10px;padding:14px;">
        <div style="font-size:18px;margin-bottom:6px;">🏷️</div>
        <div style="font-size:12px;font-weight:800;color:#DC2626;margin-bottom:4px;">#4 — Étiquette PDF</div>
        <div style="font-size:11px;color:#555;line-height:1.5;">Bloquant pour les opérations. Puppeteer déjà en place. 1 jour d'implémentation maximum.</div>
      </div>
    </div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  <div>
    <div class="footer-brand">Nanei · FrancoMaliShip</div>
    <div class="footer-sub">Audit fonctionnel — Fonctionnalités manquantes · Juin 2026</div>
  </div>
  <div class="footer-right">47 fonctionnalités à implémenter<br/>Confidentiel</div>
</div>

</div>
</body>
</html>`;

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
  const out = path.join('C:', 'Users', 'vPro', 'Downloads', 'Audit_Fonctionnel_Nanei.pdf');
  fs.writeFileSync(out, buf);
  console.log('OK', buf.length, 'bytes →', out);
})().catch(e => { console.error(e.message); process.exit(1); });
