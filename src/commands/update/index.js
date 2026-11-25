'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '../../..');
const UPDATE_BRANCH = 'feature/stable-update-system';
const RESTART_EXIT_CODE = 75;

async function run(file, args, options = {}) {
  return execFileAsync(file, args, {
    cwd: ROOT,
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
}

function git(args) {
  return run('git', args);
}

function npm(args) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return run(executable, args, { shell: process.platform === 'win32' });
}

function currentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return packageJson.version || 'unbekannt';
}

async function ensureSafeWorkingTree() {
  const result = await git(['status', '--porcelain', '--untracked-files=no']);
  if (result.stdout.trim()) {
    throw new Error(
      'Es gibt lokale Änderungen an versionierten Dateien. Bitte committe oder sichere sie zuerst. '
      + 'Nicht versionierte Ordner wie accounts/ und qr/ werden nicht angefasst.'
    );
  }

  const branch = (await git(['branch', '--show-current'])).stdout.trim();
  if (branch !== UPDATE_BRANCH) {
    throw new Error(
      'Bitte zuerst den Branch ' + UPDATE_BRANCH + ' auschecken. '
      + 'Aktueller Branch: ' + (branch || 'unbekannt') + '.'
    );
  }

  const remote = (await git(['remote', 'get-url', 'origin'])).stdout.trim();
  if (!/github\.com[:/]oskarschulze10-spec\/Projekt-Violett-(\.git)?$/i.test(remote)) {
    throw new Error('Das Git-Remote origin passt nicht zum Violetté-Repository.');
  }
}

async function fetchDevelopmentHead() {
  await git(['fetch', '--no-tags', 'origin', 'refs/heads/' + UPDATE_BRANCH]);
  return (await git(['rev-parse', 'FETCH_HEAD'])).stdout.trim();
}

async function isAncestor(older, newer) {
  try {
    await git(['merge-base', '--is-ancestor', older, newer]);
    return true;
  } catch {
    return false;
  }
}

async function describeCommit(commit) {
  return (await git(['log', '-1', '--format=%h %s', commit])).stdout.trim();
}

async function createBackupBranch() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  let name = 'backup/pre-update-' + stamp;
  let suffix = 1;

  while (true) {
    try {
      await git(['show-ref', '--verify', '--quiet', 'refs/heads/' + name]);
      name = 'backup/pre-update-' + stamp + '-' + suffix++;
    } catch {
      break;
    }
  }

  await git(['branch', name, 'HEAD']);
  return name;
}

async function installDevelopmentUpdate(remoteCommit, onProgress) {
  await ensureSafeWorkingTree();
  const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();

  if (head === remoteCommit || await isAncestor(remoteCommit, head)) {
    return { updated: false, reason: 'already-current' };
  }

  if (!(await isAncestor(head, remoteCommit))) {
    throw new Error(
      'Der GitHub-Stand ist kein Fast-Forward vom lokalen Stand. '
      + 'Zur Sicherheit wurde nichts überschrieben.'
    );
  }

  const backup = await createBackupBranch();
  let merged = false;

  try {
    await onProgress('Backup erstellt: ' + backup + '. Aktualisiere aus GitHub …');
    await git(['merge', '--ff-only', remoteCommit]);
    merged = true;

    await onProgress('Code aktualisiert. Installiere die Abhängigkeiten …');
    if (fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
      await npm(['ci']);
    } else {
      await npm(['install']);
    }

    const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    if (packageJson.scripts && packageJson.scripts.test) {
      await onProgress('Führe die Projekt-Tests aus …');
      await npm(['test']);
    }

    return { updated: true, backup };
  } catch (error) {
    if (merged) {
      await onProgress('Prüfung fehlgeschlagen. Stelle den vorherigen Stand wieder her …');
      await git(['reset', '--hard', backup]);
      if (fs.existsSync(path.join(ROOT, 'package-lock.json'))) {
        await npm(['ci']).catch(() => {});
      }
    }
    throw new Error(error.message + (merged ? ' Das Update wurde zurückgerollt.' : ''));
  }
}

module.exports = (runtime) => {
  const { register, requireRole, commandPrefix } = runtime;

  return [{
    order: 120,
    register() {
      register(['update'], 'GitHub-Entwicklungsstand prüfen und installieren (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) {
          return ctx.reply('🔒 Nur der Owner darf Violetté aktualisieren.');
        }

        const action = (ctx.args[0] || 'install').toLowerCase();
        if (!['install', 'check', 'info'].includes(action)) {
          return ctx.reply(
            'Nutzung: ' + commandPrefix(ctx) + 'update [check|info]\n'
            + 'Der Updater installiert den neuesten Stand des Branches ' + UPDATE_BRANCH + '.'
          );
        }

        await ctx.reply('🔎 Prüfe den neuesten GitHub-Stand …');

        try {
          await ensureSafeWorkingTree();
          const remoteCommit = await fetchDevelopmentHead();
          const remoteDescription = await describeCommit(remoteCommit);
          const localCommit = (await git(['rev-parse', '--short', 'HEAD'])).stdout.trim();
          const installed = currentVersion();

          if (action === 'info') {
            return ctx.reply(
              '🌸 VIOLETTÉ GITHUB UPDATE\n'
              + 'Branch: ' + UPDATE_BRANCH + '\n'
              + 'Paketversion: ' + installed + '\n'
              + 'Installierter Commit: ' + localCommit + '\n'
              + 'GitHub-Stand: ' + remoteDescription
            );
          }

          if (action === 'check') {
            const isCurrent = localCommit === remoteCommit.slice(0, 7)
              || await isAncestor(remoteCommit, (await git(['rev-parse', 'HEAD'])).stdout.trim());
            return ctx.reply(
              '🌸 GITHUB UPDATE-CHECK\n'
              + 'Branch: ' + UPDATE_BRANCH + '\n'
              + 'Installierter Commit: ' + localCommit + '\n'
              + 'GitHub-Stand: ' + remoteDescription + '\n'
              + (isCurrent ? '✅ Dein Stand ist aktuell.' : '⬇️ Ein Update ist verfügbar.')
            );
          }

          await ctx.reply(
            '⬇️ GitHub-Update gefunden. Ich sichere zuerst deinen aktuellen Stand '
            + 'und prüfe danach die neue Version.'
          );

          const result = await installDevelopmentUpdate(remoteCommit, (message) => ctx.reply('🔄 ' + message));
          if (!result.updated) {
            return ctx.reply('✅ Violetté ist bereits auf dem neuesten GitHub-Stand.');
          }

          await ctx.reply(
            '✅ GitHub-Update erfolgreich installiert.\n'
            + 'Neuer Commit: ' + remoteDescription + '\n'
            + 'Backup: ' + result.backup + '\n'
            + 'Violetté startet jetzt automatisch neu.'
          );
          setTimeout(() => process.exit(RESTART_EXIT_CODE), 1500);
        } catch (error) {
          console.error('[Violette updater]', error);
          await ctx.reply('❌ Update abgebrochen: ' + error.message);
        }
      }, { allowPrivate: true, allowUnregistered: true });
    },
  }];
};
