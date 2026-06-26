module.exports = {
  DEFAULT_DESTINATAIRE: 'Premier Ministre',
  DEFAULT_MAIL_TO: 'aboubacar.bangoura@primature.gov.gn',
  DEFAULT_MAIL_FROM: 'amadoukeita5263@gmail.com',
  SESSION_TTL_MS: 24 * 60 * 60 * 1000,
  SESSION_CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
  PORT: process.env.PORT || 3000,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX: 200,
};
