module.exports = (err, req, res, next) => {
  console.error('ERREUR EXPRESS:', err);
  res.status(500).json({ error: err.message || 'Erreur interne' });
};
