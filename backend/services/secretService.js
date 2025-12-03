// backend/services/secretService.js
// Tunn wrapper runt backend/crypto.js så all kryptering använder APP_ENCRYPTION_KEY

const { encryptSecret, decryptSecret } = require('../crypto');

module.exports = {
  encryptSecret,
  decryptSecret,
};
