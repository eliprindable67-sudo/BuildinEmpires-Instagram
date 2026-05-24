// ─────────────────────────────────────────────
//  BUILDIN EMPIRES — MAIN ENTRY POINT
//  Uses /app/queue for persistent storage
//  so posts survive Railway redeploys
// ─────────────────────────────────────────────

import { startApprovalServer } from './server.js';
import { startScheduler } from './scheduler.js';
import { generatePost } from './generator.js';
import fs from 'fs/promises';

console.log(`
╔══════════════════════════════════════════╗
║   BUILDIN EMPIRES INSTAGRAM AUTOMATION   ║
║   Starting up...                         ║
╚══════════════════════════════════════════╝
`);

// ── Use /app/queue — persists inside Railway container ──
const QUEUE_DIRS = [
  '/app/queue/pending',
  '/app/queue/approved',
  '/app/queue/posted',
  '/app/logs',
];

for (const dir of QUEUE_DIRS) {
  await fs.mkdir(dir, { recursive: true });
}
console.log('[Startup] Queue folders ready at /app/queue');

// ── Validate required env vars ──────────────
const required = ['ANTHROPIC_API_KEY', 'META_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.warn(`[Startup] WARNING: Missing env vars: ${missing.join(', ')}`);
}

// ── Start server + scheduler ─────────────────
startApprovalServer();
startScheduler();

// ── Generate first post on startup ───────────
if (process.env.GENERATE_ON_STARTUP === 'true') {
  console.log('[Startup] Generating first post now...');
  try {
    const post = await generatePost();
    if (post) {
      console.log(`[Startup] First post ready: ${post.id}`);
      console.log(`[Startup] Open your approval dashboard to review it`);
    }
  } catch (e) {
    console.error('[Startup] Generation failed:', e.message);
  }
}

process.on('SIGTERM', () => {
  console.log('[Shutdown] Shutting down cleanly');
  process.exit(0);
});
