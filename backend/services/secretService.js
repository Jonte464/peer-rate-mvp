// backend/services/secretService.js
// Wrapper runt den generella krypteringsmodulen (backend/crypto.js)
// Används t.ex. för att kryptera Tradera-lösenord m.m.

const { encryptSecret, decryptSecret } = require('../crypto');

module.exports = {
  encryptSecret,
  decryptSecret,
};
