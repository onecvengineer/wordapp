#!/usr/bin/env node
/**
 * Dev launcher: 启动 vite dev server，把 stdout/stderr 加时间戳前缀
 * 写到 logs/<name>.std.log + 当前 stdout；负责子进程组管理与端口孤儿清理。
 *
 * 兼容 Windows / macOS / Linux。
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn, spawnSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const LOG_DIR = process.env.LOG_DIR || 'logs';
const CLIENT_DEV_PORT = process.env.CLIENT_DEV_PORT || '8001';

fs.mkdirSync(LOG_DIR, { recursive: true });

const IS_WIN = process.platform === 'win32';

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

function log(msg) {
  const line = `[${timestamp()}] [dev] ${msg}\n`;
  try { process.stdout.write(line); } catch {}
}

/**
 * 清理端口占用（跨平台）：
 * - Windows: netstat -ano | findstr :<port>  → taskkill /F /PID <pid>
 * - Unix:    lsof -ti:<port>                  → kill -9 <pid>
 */
function killOrphansByPort(port) {
  if (IS_WIN) {
    try {
      const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout || '';
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        // 匹配形如 "  TCP    0.0.0.0:8001    ...    LISTENING    12345"
        if (line.includes(`:${port}`) && /LISTENING/i.test(line)) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          spawnSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
          log(`killed orphan pid=${pid} on :${port}`);
        } catch {}
      }
      return [...pids];
    } catch {
      return [];
    }
  }
  // Unix 分支
  try {
    const out = execSync(`lsof -ti:${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (!out) return [];
    const pids = out.split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(Number(pid), 'SIGKILL');
        log(`killed orphan pid=${pid} on :${port}`);
      } catch {}
    }
    return pids;
  } catch {
    return [];
  }
}

const managed = [];

function startProcess({ name, command, args, logFileName }) {
  const logFd = logFileName
    ? fs.openSync(path.join(LOG_DIR, logFileName), 'a')
    : null;

  // Windows 上 npx / npm / node 等是 .cmd 包装脚本，
  // 必须通过 shell: true 才能正确 spawn。
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: IS_WIN ? true : false,
    cwd: ROOT,
    env: process.env,
    detached: !IS_WIN, // Windows 上不要建独立进程组，否则 cleanup 时的负 PID 信号会失败
  });

  const pipeLines = (stream) => {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    rl.on('line', (line) => {
      const msg = `[${timestamp()}] [${name}] ${line}\n`;
      try { process.stdout.write(msg); } catch {}
      if (logFd != null) {
        try { fs.writeSync(logFd, msg); } catch {}
      }
    });
  };
  pipeLines(child.stdout);
  pipeLines(child.stderr);

  managed.push({ name, child });
  return child;
}

killOrphansByPort(CLIENT_DEV_PORT);

startProcess({
  name: 'client',
  command: 'npx',
  args: ['vite', '--port', CLIENT_DEV_PORT, '--host', '0.0.0.0'],
  logFileName: 'client.std.log',
});

let stopping = false;
function cleanup(signal) {
  if (stopping) return;
  stopping = true;
  log(`cleanup triggered by ${signal}`);

  for (const { child } of managed) {
    if (!child.pid) continue;
    if (IS_WIN) {
      // Windows: 用 taskkill 杀整个进程树
      try { spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' }); } catch {}
    } else {
      try { process.kill(-child.pid, signal || 'SIGTERM'); } catch {}
    }
  }
  setTimeout(() => {
    killOrphansByPort(CLIENT_DEV_PORT);
    process.exit(0);
  }, 2000);
}

process.on('SIGINT', () => cleanup('SIGTERM'));
process.on('SIGTERM', () => cleanup('SIGTERM'));
// 关闭终端 / 杀父进程时会收 SIGHUP
process.on('SIGHUP', () => cleanup('SIGTERM'));

Promise.race(
  managed.map(({ child }) => new Promise((r) => child.on('exit', r))),
).then(() => cleanup('SIGTERM'));
