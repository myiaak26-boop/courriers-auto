# Courriers Auto — Primature

Générateur automatique de situations courriers pour le Secrétariat Central de la Primature.
Avec stockage PostgreSQL et édition inline des données.

## Structure du projet

```
courriers-auto/
├── server.js          # Serveur Express (API)
├── logic.js           # Logique métier (parsing, filtrage, génération XLS)
├── db.js              # Connexion PostgreSQL + auto-création table
├── schema.sql         # Schéma de référence
├── package.json
├── .gitignore
└── public/
    └── index.html     # Interface web (4 étapes avec tableau éditable)
```

## Fonctionnement

1. **Upload** du fichier Excel (.xlsx) ou CSV
2. **Stockage** automatique dans PostgreSQL (l'ancienne session est effacée)
3. **Édition inline** des champs État et Position
4. **Génération** du rapport XLS (Situation journalière / Assignés non traités / En retard)
5. **Envoi** par email via SendGrid (optionnel)

## Variables d'environnement

| Variable           | Description                          |
|--------------------|--------------------------------------|
| `PGHOST`           | Hôte PostgreSQL                      |
| `PGPORT`           | Port PostgreSQL (défaut: 5432)       |
| `PGUSER`           | Utilisateur PostgreSQL               |
| `PGPASSWORD`       | Mot de passe PostgreSQL              |
| `PGDATABASE`       | Nom de la base de données            |
| `PGSSLMODE`        | Mode SSL (`require` sur Render.com)  |
| `SENDGRID_API_KEY` | Clé API SendGrid (optionnel)         |
| `MAIL_FROM`        | Expéditeur des emails               |
| `MAIL_TO`          | Destinataire par défaut              |
| `PORT`             | Port du serveur (Render définit auto)|

## Déploiement sur Render.com

1. Créer un compte sur https://render.com
2. Créer une base PostgreSQL : **New → PostgreSQL**
3. Créer un Web Service : **New → Web Service** → connecter le dépôt GitHub
4. Paramètres du Web Service :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
5. Ajouter les variables d'environnement depuis l'onglet "Environment" (voir ci-dessus)
6. Cliquer sur **"Deploy"**

La table `courriers` sera créée automatiquement au premier démarrage.
