# Courriers Auto — Primature

Générateur automatique de situations courriers pour le Secrétariat Central de la Primature.

## Structure du projet

```
courriers-auto/
├── server.js          # Serveur Express (API)
├── logic.js           # Logique métier (parsing, filtrage, génération XLS)
├── package.json
├── .gitignore
└── public/
    └── index.html     # Interface web (4 étapes)
```

## Variables d'environnement (obligatoires sur Render)

| Variable           | Valeur                                      |
|--------------------|---------------------------------------------|
| `SENDGRID_API_KEY` | (clé API SendGrid)                          |
| `MAIL_FROM`        | amadoukeita5263@gmail.com                   |
| `MAIL_TO`          | aboubacar.bangoura@primature.gov.gn         |

## Déploiement sur Render.com

1. Créer un compte sur https://render.com
2. Créer un dépôt GitHub avec ce code
3. Sur Render : New → Web Service → connecter le dépôt
4. Paramètres :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
5. Ajouter les variables d'environnement dans l'onglet "Environment"
6. Cliquer sur "Deploy"

## Utilisation

1. Ouvrir l'URL du site depuis n'importe quel appareil
2. Importer le fichier Excel exporté depuis GEC
3. Choisir le type de rapport
4. Générer et télécharger
5. Envoyer par mail (optionnel)
