'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '../../..');
const REPOSITORY = 'oskarschulze10-spec/Projekt-Violett-';
const RELEASE_URL = 'https://api.github.com/repos/' + REPOSITORY + '/releases/latest';
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

async function getLatestStableRelease() {
  const response = await fetch(RELEASE_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Violette-Stable-Updater',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error('GitHub antwortet mit HTTP ' + response.status + '.');
  }

  const release = await response.json();
  if (release.draft || release.prerelease || !release.tag_name) return null;
  if (!/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(release.tag_name)) {
    throw new Error('Das Release besitzt keine gültige Versionsnummer: ' + release.tag_name);
  }
  return release;
}

function currentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return packageJson.version || 'unbekannt';
}

async function getReleaseCommit(tag) {
  await git(['fetch', '--no-tags', 'origin', 'refs/tags/' + tag + ':refs/tags/' + tag]);
  const result = await git(['rev-parse', tag + '^{commit}']);
  return result.stdout.trim();
}

async function isAncestor(older, newer) {
  try {
    await git(['merge-base', '--is-ancestor', older, newer]);
    return true;
  } catch {
    return false;
  }
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
  if (!branch) {
    throw new Error('Der Updater kann nicht auf einem detached HEAD arbeiten.');
  }

  const remote = (await git(['remote', 'get-url', 'origin'])).stdout.trim();
  if (!/github\.com[:/]oskarschulze10-spec\/Projekt-Violett-(\.git)?$/i.test(remote)) {
    throw new Error('Das Git-Remote origin passt nicht zum Violetté-Repository.');
  }
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

async function installStableRelease(release, onProgress) {
  await ensureSafeWorkingTree();
  const releaseCommit = await getReleaseCommit(release.tag_name);
  const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();

  if (await isAncestor(releaseCommit, head)) {
    return { updated: false, reason: 'already-current' };
  }
  if (!(await isAncestor(head, releaseCommit))) {
    throw new Error(
      'Das stabile Release ist kein Fast-Forward vom aktuellen Stand. '
      + 'Zur Sicherheit wurde nichts überschrieben.'
    );
  }

  const backup = await createBackupBranch();
  let merged = false;

  try {
    await onProgress('Backup erstellt: ' + backup + '. Installiere Release ' + release.tag_name + ' …');
    await git(['merge', '--ff-only', releaseCommit]);
    merged = true;

    await onProgress('Code aktualisiert. Installiere jetzt die festgelegten Abhängigkeiten …');
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
      register(['update'], 'Stabile Violetté-Version prüfen und installieren (nur Owner)', async (ctx) => {
        if (!requireRole(ctx, 'owner')) {
          return ctx.reply('🔒 Nur der Owner darf Violetté aktualisieren.');
        }

        const action = (ctx.args[0] || 'install').toLowerCase();
        if (!['install', 'check', 'info'].includes(action)) {
          return ctx.reply(
            'Nutzung: ' + commandPrefix(ctx) + 'update [check|info]\n'
            + 'Der Updater installiert ausschließlich veröffentlichte stabile GitHub-Releases.'
          );
        }

        await ctx.reply('🔎 Suche nach dem neuesten stabilen Violetté-Release …');

        try {
          const release = await getLatestStableRelease();
          if (!release) {
            return ctx.reply(
              'ℹ️ Es gibt noch kein veröffentlichtes stabiles GitHub-Release. '
              + 'Sobald eine Version als Release veröffentlicht wurde, kann ich sie hier installieren.'
            );
          }

          const installed = currentVersion();
          const notes = String(release.body || 'Keine Release-Notizen vorhanden.').trim().slice(0, 1800);

          if (action === 'info') {
            return ctx.reply(
              '🌸 VIOLETTÉ STABLE RELEASE\n'
              + 'Version: ' + release.tag_name + '\n'
              + 'Installierte Paketversion: ' + installed + '\n'
              + 'Veröffentlicht: ' + (release.published_at || 'unbekannt') + '\n'
              + 'Änderungen:\n' + notes
            );
          }

          if (action === 'check') {
            return ctx.reply(
              '🌸 STABLE UPDATE-CHECK\n'
              + 'Installierte Paketversion: ' + installed + '\n'
              + 'Neueste stabile Version: ' + release.tag_name + '\n'
              + 'Release: ' + release.html_url
            );
          }

          await ctx.reply(
            '⬇️ Stabiles Release gefunden: ' + release.tag_name
            + '\nIch sichere zuerst deinen aktuellen Stand und prüfe danach die neue Version.'
          );

          const result = await installStableRelease(release, (message) => ctx.reply('🔄 ' + message));
          if (!result.updated) {
            return ctx.reply('✅ Violetté ist bereits auf dem neuesten stabilen Release.');
          }

          await ctx.reply(
            '✅ Update ' + release.tag_name + ' erfolgreich installiert.\n'
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
