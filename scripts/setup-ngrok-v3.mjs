#!/usr/bin/env node
/**
 * Replace @expo/ngrok-bin's ngrok v2 agent (broken with current ngrok API) with ngrok v3.
 * See: https://github.com/expo/expo/issues/43335
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function platformPackage() {
  const { platform, arch } = process;
  if (platform === 'darwin') return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (platform === 'linux') return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  if (platform === 'win32') return arch === 'x64' ? 'win32-x64' : 'win32-ia32';
  return null;
}

const NGROK_V3_URLS = {
  'darwin-arm64': 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-arm64.zip',
  'darwin-x64': 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-darwin-amd64.zip',
  'linux-arm64': 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.zip',
  'linux-x64': 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip',
};

function ngrokBinPath(pkgName) {
  const dir = path.join(projectRoot, 'node_modules', `@expo/ngrok-bin-${pkgName}`);
  if (!fs.existsSync(dir)) return null;
  const bin = path.join(dir, 'ngrok');
  if (fs.existsSync(bin)) return bin;
  const win = path.join(dir, 'ngrok.exe');
  if (fs.existsSync(win)) return win;
  return null;
}

function currentVersion(bin) {
  try {
    return execSync(`"${bin}" version`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function main() {
  const pkg = platformPackage();
  if (!pkg) {
    console.log('[setup-ngrok-v3] Unsupported platform; skip.');
    return;
  }

  const bin = ngrokBinPath(pkg);
  if (!bin) {
    console.log('[setup-ngrok-v3] @expo/ngrok-bin not installed; skip.');
    return;
  }

  const ver = currentVersion(bin);
  if (/version 3\./i.test(ver)) {
    console.log(`[setup-ngrok-v3] Already on ngrok v3 (${ver})`);
    return;
  }

  const url = NGROK_V3_URLS[pkg];
  if (!url) {
    console.log(`[setup-ngrok-v3] No v3 URL for ${pkg}; skip.`);
    return;
  }

  const tmpZip = path.join(os.tmpdir(), `ngrok-v3-${pkg}.zip`);
  const tmpDir = path.join(os.tmpdir(), `ngrok-v3-${pkg}-extract`);

  console.log(`[setup-ngrok-v3] Upgrading ngrok ${ver || 'unknown'} → v3 (${pkg})...`);

  await download(url, tmpZip);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  execSync(`unzip -o -q "${tmpZip}" -d "${tmpDir}"`);

  const extracted = fs
    .readdirSync(tmpDir)
    .map((f) => path.join(tmpDir, f))
    .find((p) => p.endsWith('ngrok') || p.endsWith('ngrok.exe'));

  if (!extracted) {
    throw new Error('ngrok binary not found in downloaded archive');
  }

  fs.copyFileSync(extracted, bin);
  fs.chmodSync(bin, 0o755);

  fs.rmSync(tmpZip, { force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`[setup-ngrok-v3] Done: ${currentVersion(bin)}`);
}

main().catch((err) => {
  console.warn('[setup-ngrok-v3] Warning:', err.message);
  console.warn('[setup-ngrok-v3] Use `npm run start` (LAN) or install ngrok CLI: https://ngrok.com/download');
});
