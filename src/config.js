const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function normalizePhoneNumber(value, name) {
  const number = String(value || '').replace(/\D/g, '');
  if (!/^\d{7,15}$/.test(number)) {
    throw new Error(`${name} muss eine internationale Telefonnummer mit 7 bis 15 Ziffern sein.`);
  }
  return number;
}

function loadConfig(environment = process.env) {
  const ownerNumber = normalizePhoneNumber(environment.OWNER_NUMBER, 'OWNER_NUMBER');
  const botNumber = normalizePhoneNumber(environment.BOT_NUMBER, 'BOT_NUMBER');
  if (ownerNumber === botNumber) {
    throw new Error('BOT_NUMBER muss sich von OWNER_NUMBER unterscheiden.');
  }
  const ownerNumbers = [...new Set([
    ownerNumber,
    ...(environment.OWNER_NUMBERS || '')
      .split(',')
      .map((number) => number.trim())
      .filter(Boolean)
      .map((number) => normalizePhoneNumber(number, 'OWNER_NUMBERS'))
  ])];
  const prefix = environment.COMMAND_PREFIX || '#';
  if (prefix.length > 3 || /\s/.test(prefix)) {
    throw new Error('COMMAND_PREFIX darf höchstens drei Zeichen lang sein und keine Leerzeichen enthalten.');
  }

  return {
    ownerNumber,
    ownerNumbers,
    botNumber,
    prefix,
    authDirectory: path.resolve(environment.AUTH_DIRECTORY || 'auth/bot-account'),
    dataFile: path.resolve(environment.DATA_FILE || 'data/bot-data.json'),
    logLevel: environment.LOG_LEVEL || 'info',
  };
}

module.exports = { loadConfig, normalizePhoneNumber };
