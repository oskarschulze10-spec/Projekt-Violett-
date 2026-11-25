'use strict';

const { spawn } = require('child_process');
const path = require('path');

const entry = path.join(__dirname, 'index.js');
let child = null;
let stopping = false;

function startBotProcess() {
  if (stopping) return;

  console.log('[Violette Launcher] Starte Bot …');
  child = spawn(process.execPath, [entry], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, VIOLETTE_LAUNCHER: '1' },
    stdio: 'inherit',
    windowsHide: false,
  });

  child.once('error', (error) => {
    console.error('[Violette Launcher] Bot-Prozess konnte nicht gestartet werden:', error);
    process.exitCode = 1;
  });

  child.once('exit', (code, signal) => {
    child = null;
    if (stopping) {
      process.exit(code || 0);
      return;
    }

    if (code === 75) {
      console.log('[Violette Launcher] Update erkannt. Starte die neue Version …');
      setTimeout(startBotProcess, 1200);
      return;
    }

    if (signal) {
      console.error('[Violette Launcher] Bot wurde durch Signal ' + signal + ' beendet.');
      process.exitCode = 1;
      return;
    }

    process.exitCode = code === null ? 1 : code;
  });
}

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (child && !child.killed) child.kill(signal);
  else process.exit(0);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

startBotProcess();
