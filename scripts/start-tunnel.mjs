#!/usr/bin/env node
/**
 * Start ngrok v3 + Expo (bypasses broken Expo shared ngrok / exp.direct).
 *
 * Fixes the Android Expo Go "Something went wrong" error: Metro's LAN host is
 * often unreachable from the phone (IPv6 / wrong interface / client-isolated
 * Wi-Fi), so the bundle download fails on Android even though iOS works. This
 * advertises a publicly reachable ngrok URL to the device instead.
 *
 * Requires NGROK_AUTHTOKEN in .env — https://dashboard.ngrok.com/get-started/your-authtoken
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const PORT = process.env.EXPO_METRO_PORT || '8081';

function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function ngrokBinary() {
  const { platform, arch } = process;
  let pkg = null;
  if (platform === 'darwin') pkg = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  else if (platform === 'linux') pkg = arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  if (!pkg) return null;
  const bin = path.join(projectRoot, 'node_modules', `@expo/ngrok-bin-${pkg}`, 'ngrok');
  return fs.existsSync(bin) ? bin : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForNgrokApi(maxMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://127.0.0.1:4040/api/tunnels');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const tunnels = data.tunnels || [];
      const https =
        tunnels.find((t) => t.proto === 'https') ||
        tunnels.find((t) => String(t.public_url || '').startsWith('https://'));
      if (https?.public_url) return https.public_url;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error('Timed out waiting for ngrok tunnel URL (check NGROK_AUTHTOKEN)');
}

async function runSetup() {
  const setup = path.join(__dirname, 'setup-ngrok-v3.mjs');
  await new Promise((resolve) => {
    const child = spawn(process.execPath, [setup], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', () => resolve());
  });
}

loadEnv();

const token = process.env.NGROK_AUTHTOKEN || process.env.EXPO_NGROK_AUTHTOKEN;
if (!token) {
  console.error(`
Expo's built-in tunnel (exp.direct) is currently broken ("remote gone away").

Add your own free ngrok token to Picker-app-v1.1/.env:

  NGROK_AUTHTOKEN=paste_token_here

Get one at: https://dashboard.ngrok.com/get-started/your-authtoken

Or use LAN mode on the same Wi‑Fi (no tunnel):
  npm run start
`);
  process.exit(1);
}

await runSetup();

const bin = ngrokBinary();
if (!bin) {
  console.error('ngrok binary not found. Run: npm install');
  process.exit(1);
}

console.log('[tunnel] Starting ngrok v3 → port', PORT);
const ngrokProc = spawn(
  bin,
  ['http', String(PORT), `--authtoken=${token}`, '--log=stdout', '--log-level=info'],
  { cwd: projectRoot, stdio: ['ignore', 'pipe', 'inherit'] },
);

let ngrokStopped = false;
ngrokProc.on('exit', (code) => {
  ngrokStopped = true;
  if (code && code !== 0) console.error('[tunnel] ngrok exited with code', code);
});

process.on('SIGINT', () => {
  ngrokProc.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  ngrokProc.kill();
  process.exit(0);
});

let publicUrl;
try {
  publicUrl = await waitForNgrokApi();
} catch (err) {
  ngrokProc.kill();
  console.error('[tunnel]', err.message);
  console.error('[tunnel] Verify token at https://dashboard.ngrok.com/get-started/your-authtoken');
  process.exit(1);
}

const hostname = new URL(publicUrl).hostname;
console.log('\n[tunnel] Public URL:', publicUrl);
console.log('[tunnel] Packager hostname:', hostname);
console.log('[tunnel] Starting Expo (LAN + tunnel hostname)...\n');

const expoEnv = {
  ...process.env,
  REACT_NATIVE_PACKAGER_HOSTNAME: hostname,
  EXPO_PACKAGER_PROXY_URL: publicUrl,
  NGROK_AUTHTOKEN: token,
};

const expo = spawn('npx', ['expo', 'start', '--lan', '--port', String(PORT)], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: expoEnv,
  shell: true,
});

expo.on('exit', (code) => {
  if (!ngrokStopped) ngrokProc.kill();
  process.exit(code ?? 0);
});
