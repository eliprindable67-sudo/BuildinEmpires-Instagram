// ─────────────────────────────────────────────
//  BUILDIN EMPIRES — APPROVAL SERVER
// ─────────────────────────────────────────────

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from './config.js';
import { publishApprovedPost } from './poster.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PENDING_DIR  = '/app/queue/pending';
const APPROVED_DIR = '/app/queue/approved';
const POSTED_DIR   = '/app/queue/posted';

function requireAuth(req, res, next) {
  const token = req.query.token || req.body.token || req.headers['x-approval-token'];
  if (token !== CONFIG.APPROVAL_SECRET) {
    return res.status(401).send('<h2 style="font-family:sans-serif;color:#fff;background:#050505;padding:40px">Unauthorized — add ?token=YOUR_SECRET to the URL</h2>');
  }
  next();
}

function renderPost(post, status = 'pending') {
  const c = post.content;
  const isCarousel = post.type === 'carousel';
  const isReel = post.type === 'reel';

  let slidesHtml = '';
  if (isCarousel && c.slides) {
    slidesHtml = c.slides.map(s =>
      `<div style="border-left:3px solid #c9a84c;padding:8px 12px;margin:6px 0">
        <strong style="color:#fff">Slide ${s.slide_number}:</strong> ${s.headline}<br>
        <span style="color:#888;font-size:13px">${s.body}</span>
      </div>`
    ).join('');
  }

  let slidePromptsHtml = '';
  if (isCarousel && c.slide_image_prompts) {
    slidePromptsHtml = `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Per-slide image prompts (paste each into ChatGPT)</div>
        ${c.slide_image_prompts.map((p, i) =>
          `<div style="background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:11px;font-family:monospace;color:#aaa">
            <span style="color:#c9a84c">Slide ${i + 1}:</span> ${p}
          </div>`
        ).join('')}
      </div>`;
  }

  const actionButtons = status === 'pending' ? `
    <div style="margin-top:20px">
      <form method="POST" action="/approve?token=${CONFIG.APPROVAL_SECRET}" style="display:inline;width:100%">
        <input type="hidden" name="postId" value="${post.id}">
        <label style="display:block;margin-bottom:6px;font-size:13px;color:#888">
          Public image URL(s) — paste Imgur/Cloudinary link(s), comma-separated:
        </label>
        <input type="text" name="imageUrls" placeholder="https://i.imgur.com/abc.jpg, https://i.imgur.com/def.jpg"
          style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #333;border-radius:6px;margin-bottom:8px;box-sizing:border-box">
        <label style="display:block;margin-bottom:6px;font-size:13px;color:#888">
          Video URL (Reels only — leave blank for image):
        </label>
        <input type="text" name="videoUrl" placeholder="https://..."
          style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #333;border-radius:6px;margin-bottom:12px;box-sizing:border-box">
        <button type="submit"
          style="background:#c9a84c;color:#000;border:none;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer;margin-right:8px">
          APPROVE + QUEUE
        </button>
      </form>
      <form method="POST" action="/post-now?token=${CONFIG.APPROVAL_SECRET}" style="display:inline">
        <input type="hidden" name="postId" value="${post.id}">
        <button type="submit"
          style="background:#1a1a2e;color:#c9a84c;border:1px solid #c9a84c;padding:10px 24px;border-radius:6px;cursor:pointer;margin-right:8px">
          POST NOW
        </button>
      </form>
      <form method="POST" action="/reject?token=${CONFIG.APPROVAL_SECRET}" style="display:inline">
        <input type="hidden" name="postId" value="${post.id}">
        <button type="submit"
          style="background:#1a1a1a;color:#888;border:1px solid #333;padding:10px 24px;border-radius:6px;cursor:pointer">
          REJECT
        </button>
      </form>
    </div>` : `<div style="color:#4caf50;font-weight:bold;margin-top:12px">
      ${status === 'approved' ? '✓ APPROVED — queued for next posting window' : '✓ POSTED to Instagram'}
    </div>`;

  return `
    <div style="background:#0d0d0d;border:1px solid #222;border-radius:10px;padding:20px;margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="background:#c9a84c22;color:#c9a84c;padding:4px 10px;border-radius:20px;font-size:12px;text-transform:uppercase">${post.type}</span>
        <span style="color:#444;font-size:11px">${new Date(post.generatedAt).toLocaleString()}</span>
      </div>

      <div style="background:#c9a84c11;border-left:4px solid #c9a84c;padding:12px;border-radius:6px;margin-bottom:16px">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px">Topic</div>
        <div style="color:#fff;font-size:14px;margin-top:4px">${post.topic}</div>
      </div>

      ${isCarousel ? `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Hook slide</div>
          <div style="color:#c9a84c;font-size:18px;font-weight:bold;margin-bottom:10px">${c.hook_slide}</div>
          ${slidesHtml}
          <div style="border-left:3px solid #4caf50;padding:8px 12px;margin:6px 0;color:#4caf50">${c.cta_slide}</div>
        </div>
        ${slidePromptsHtml}` : ''}

      ${isReel ? `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Hook</div>
          <div style="color:#c9a84c;font-size:18px;font-weight:bold;margin-bottom:10px">${c.hook_text}</div>
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Text sequence</div>
          ${(c.text_sequence || []).map(t =>
            `<div style="color:#fff;padding:3px 0"><span style="color:#555;font-size:12px">@${t.second}s — </span>${t.text}</div>`
          ).join('')}
          <div style="color:#888;font-size:13px;margin-top:10px">🎵 Audio: ${c.audio_suggestion}</div>
        </div>` : ''}

      ${!isCarousel && !isReel ? `
        <div style="margin-bottom:16px">
          <div style="color:#c9a84c;font-size:20px;font-weight:bold;line-height:1.4;margin-bottom:8px">"${c.quote}"</div>
          ${c.subtext ? `<div style="color:#888;font-size:14px">${c.subtext}</div>` : ''}
        </div>` : ''}

      <div style="background:#111;border-radius:6px;padding:12px;margin-bottom:10px">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Caption</div>
        <div style="color:#ccc;font-size:13px;line-height:1.6">${c.caption}</div>
      </div>

      ${!isCarousel ? `
        <div style="background:#111;border-radius:6px;padding:12px;margin-bottom:10px">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Image prompt — paste into ChatGPT</div>
          <div style="color:#aaa;font-size:12px;font-family:monospace;line-height:1.6">${c.image_prompt}</div>
        </div>` : ''}

      <div style="background:#111;border-radius:6px;padding:12px;margin-bottom:16px">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Hashtags</div>
        <div style="color:#555;font-size:12px">${post.hashtags}</div>
      </div>

      ${actionButtons}
    </div>`;
}

app.get('/', requireAuth, async (req, res) => {
  const loadPosts = async (dir) => {
    try {
      const files = await fs.readdir(dir);
      return Promise.all(
        files.filter(f => f.endsWith('.json')).map(async f => {
          const content = await fs.readFile(path.join(dir, f), 'utf8');
          return JSON.parse(content);
        })
      );
    } catch { return []; }
  };

  const [pending, approved, posted] = await Promise.all([
    loadPosts(PENDING_DIR),
    loadPosts(APPROVED_DIR),
    loadPosts(POSTED_DIR),
  ]);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Buildin Empires — Approval Dashboard</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#050505;color:#fff;padding:24px;max-width:820px;margin:0 auto;font-family:system-ui,sans-serif}
    h1{color:#c9a84c;font-size:20px;margin-bottom:4px}
    h2{color:#444;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:28px 0 12px}
    .stats{display:flex;gap:12px;margin:16px 0 8px}
    .stat{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:12px 20px;flex:1;text-align:center}
    .stat .num{font-size:28px;font-weight:bold;color:#c9a84c}
    .stat .lbl{font-size:11px;color:#555;text-transform:uppercase;margin-top:4px}
    a{color:#c9a84c}
  </style>
</head>
<body>
  <h1>Buildin Empires — @buildinempires</h1>
  <p style="color:#444;font-size:13px;margin-top:4px">Review content → add image URLs → approve to post</p>

  <div class="stats">
    <div class="stat"><div class="num">${pending.length}</div><div class="lbl">Pending review</div></div>
    <div class="stat"><div class="num">${approved.length}</div><div class="lbl">Approved</div></div>
    <div class="stat"><div class="num">${posted.length}</div><div class="lbl">Posted</div></div>
  </div>

  ${pending.length > 0 ? `<h2>Needs your review</h2>${pending.map(p => renderPost(p, 'pending')).join('')}` : ''}
  ${approved.length > 0 ? `<h2>Approved — queued</h2>${approved.map(p => renderPost(p, 'approved')).join('')}` : ''}
  ${posted.length > 0 ? `<h2>Recently posted</h2>${posted.slice(-3).reverse().map(p => renderPost(p, 'posted')).join('')}` : ''}

  ${pending.length === 0 && approved.length === 0 ? `
    <div style="text-align:center;padding:80px 0;color:#333">
      <div style="font-size:40px;margin-bottom:16px">⏳</div>
      <div style="font-size:16px;margin-bottom:8px">No posts in queue</div>
      <div style="font-size:13px">Content generates daily at 6 AM ET<br>or redeploy with GENERATE_ON_STARTUP=true</div>
    </div>` : ''}
</body>
</html>`;

  res.send(html);
});

app.post('/approve', requireAuth, async (req, res) => {
  const { postId, imageUrls, videoUrl } = req.body;
  try {
    const filePath = path.join(PENDING_DIR, `${postId}.json`);
    const post = JSON.parse(await fs.readFile(filePath, 'utf8'));
    post.status    = 'approved';
    post.approvedAt = new Date().toISOString();
    post.imageUrls  = imageUrls ? imageUrls.split(',').map(u => u.trim()).filter(Boolean) : [];
    post.videoUrl   = videoUrl?.trim() || null;
    await fs.mkdir(APPROVED_DIR, { recursive: true });
    await fs.writeFile(path.join(APPROVED_DIR, `${postId}.json`), JSON.stringify(post, null, 2));
    await fs.unlink(filePath);
    res.redirect(`/?token=${CONFIG.APPROVAL_SECRET}`);
  } catch (e) {
    res.status(500).send(`Error: ${e.message}`);
  }
});

app.post('/reject', requireAuth, async (req, res) => {
  const { postId } = req.body;
  await fs.unlink(path.join(PENDING_DIR, `${postId}.json`)).catch(() => {});
  res.redirect(`/?token=${CONFIG.APPROVAL_SECRET}`);
});

app.post('/post-now', requireAuth, async (req, res) => {
  const { postId, imageUrls, videoUrl } = req.body;
  try {
    let post;
    try {
      post = JSON.parse(await fs.readFile(path.join(APPROVED_DIR, `${postId}.json`), 'utf8'));
    } catch {
      post = JSON.parse(await fs.readFile(path.join(PENDING_DIR, `${postId}.json`), 'utf8'));
    }
    post.imageUrls = imageUrls ? imageUrls.split(',').map(u => u.trim()).filter(Boolean) : post.imageUrls || [];
    post.videoUrl  = videoUrl?.trim() || post.videoUrl || null;
    await publishApprovedPost(post);
    res.redirect(`/?token=${CONFIG.APPROVAL_SECRET}`);
  } catch (e) {
    res.status(500).send(`<div style="font-family:sans-serif;background:#050505;color:#fff;padding:40px"><h2 style="color:#e53">Error</h2><p>${e.message}</p><a href="/?token=${CONFIG.APPROVAL_SECRET}" style="color:#c9a84c">← Back</a></div>`);
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

export function startApprovalServer() {
  app.listen(CONFIG.PORT, () => {
    console.log(`[Server] Dashboard running — open your Railway URL with ?token=${CONFIG.APPROVAL_SECRET}`);
  });
}
