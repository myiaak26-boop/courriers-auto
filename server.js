require('dotenv').config();
const express = require('express');
const path = require('path');
const sgMail = require('@sendgrid/mail');
const { initDB } = require('./db');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', require('./routes/health'));
app.use('/api', require('./middlewares/auth'));
app.use('/api', require('./routes/api'));
app.use(require('./middlewares/errorHandler'));

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur init DB:', err);
  process.exit(1);
});
