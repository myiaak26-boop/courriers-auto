module.exports = (req, res, next) => {
  const token = process.env.AUTH_TOKEN;
  if (!token) return next();

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== token) {
    return res.status(401).json({ error: 'Non autorisé. Token manquant ou invalide.' });
  }
  next();
};
