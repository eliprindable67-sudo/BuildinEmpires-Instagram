// ─────────────────────────────────────────────
//  BUILDIN EMPIRES — APPROVAL SERVER
//  With direct image upload support
// ─────────────────────────────────────────────

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { CONFIG } from './config.js';
import { publishApprovedPost } from './poster.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PENDING_DIR  = '/app/queue/pending';
const APPROVED_DIR = '/app/queue/approved';
const POSTED_DIR   = '/app/queue/posted';
const UPLOADS_DIR  = '/app/uploads';

// ── Multer — handles image uploads ────────────
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per image
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
  },
});

// ── Serve uploaded images statically ──────────
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Auth middleware ────────────────────────────
function requireAuth(req, res, next) {
  const token = req.query.token || req.body.token || req.headers['x-approval-token'];
  if (token !== CONFIG.APPROVAL_SECRET) {
    return res.status(401).send('<h2 style="font-family:sans-serif;color:#fff;background:#050505;padding:40px">Unauthorized — add ?token=YOUR_SECRET to the URL</h2>');
  }
  next();
}

// ── Render a post card ─────────────────────────
function renderPost(post, status = 'pending') {
  const c          = post.content;
  const isCarousel = post.type === 'carousel';
  const isReel     = post.type === 'reel';
  const token      = CONFIG.APPROVAL_SECRET;

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
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
          Per-slide image prompts — paste each into Higgsfield or ChatGPT
        </div>
        ${c.slide_image_prompts.map((p, i) =>
          `<div style="background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:8px 12px;margin-bottom:6px">
            <div style="font-size:11px;color:#c9a84c;margin-bottom:4px">Slide ${i + 1}</div>
            <div style="font-size:11px;font-family:monospace;color:#aaa;line-height:1.5">${p}</div>
            <button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)})"
              style="margin-top:6px;background:#1a1a1a;color:#888;border:1px solid #333;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer">
              Copy
            </button>
          </div>`
        ).join('')}
      </div>`;
  }

  // ── Uploaded images preview ──────────────────
  let uploadedPreview = '';
  if (post.imageUrls && post.imageUrls.length > 0) {
    uploadedPreview = `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">
          Uploaded images (${post.imageUrls.length})
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${post.imageUrls.map((url, i) =>
            `<div style="position:relative">
              <img src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #333">
              <div style="position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,0.7);color:#c9a84c;font-size:9px;padding:1px 4px;border-radius:3px">${i + 1}</div>
            </div>`
          ).join('')}
        </div>
      </div>`;
  }

  const actionButtons = status === 'pending' ? `
    <div style="margin-top:20px">
      <form method="POST" action="/upload-and-approve?token=${token}"
        enctype="multipart/form-data" style="width:100%">
        <input type="hidden" name="postId" value="${post.id}">

        <div style="margin-bottom:14px">
          <label style="display:block;margin-bottom:6px;font-size:13px;color:#c9a84c;font-weight:500">
            ${isCarousel ? `Upload images (${c.slide_image_prompts ? c.slide_image_prompts.length : 8} slides — select multiple at once)` : 'Upload image'}
          </label>
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp"
            ${isCarousel ? 'multiple' : ''}
            style="width:100%;padding:10px;background:#111;color:#fff;border:1px solid #444;border-radius:6px;cursor:pointer;font-size:13px">
          <div style="font-size:11px;color:#555;margin-top:4px">
            JPG, PNG or WEBP • Max 10MB per image${isCarousel ? ' • Hold Ctrl/Cmd to select multiple files' : ''}
          </div>
        </div>

        ${isReel ? `
        <div style="margin-bottom:14px">
          <label style="display:block;margin-bottom:6px;font-size:13px;color:#888">
            Video URL (optional — leave blank to post as image)
          </label>
          <input type="text" name="videoUrl" placeholder="https://..."
            style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #333;border-radius:6px;font-size:13px">
        </div>` : ''}

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
          <button type="submit" name="action" value="approve"
            style="background:#c9a84c;color:#000;border:none;padding:10px 24px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:14px">
            APPROVE + QUEUE
          </button>
          <button type="submit" name="action" value="post-now"
            style="background:#1a1a2e;color:#c9a84c;border:1px solid #c9a84c;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:14px">
            POST NOW
          </button>
        </div>
      </form>

      <form method="POST" action="/reject?token=${token}" style="margin-top:10px">
        <input type="hidden" name="postId" value="${post.id}">
        <button type="submit"
          style="background:transparent;color:#555;border:none;padding:4px 0;cursor:pointer;font-size:12px;text-decoration:underline">
          Reject this post
        </button>
      </form>
    </div>` : `
    <div style="color:#4caf50;font-weight:500;margin-top:12px;font-size:13px">
      ${status === 'approved' ? '✓ Approved — queued for next posting window' : '✓ Posted to @buildinempires'}
    </div>`;

  return `
    <div style="background:#0d0d0d;border:1px solid #222;border-radius:10px;padding:20px;margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="background:#c9a84c22;color:#c9a84c;padding:4px 10px;border-radius:20px;font-size:12px;text-transform:uppercase;letter-spacing:1px">${post.type}</span>
        <span style="color:#333;font-size:11px">${new Date(post.generatedAt).toLocaleString()}</span>
      </div>

      <div style="background:#c9a84c0d;border-left:4px solid #c9a84c;padding:12px;border-radius:0 6px 6px 0;margin-bottom:16px">
        <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Topic</div>
        <div style="color:#fff;font-size:14px">${post.topic}</div>
      </div>

      ${isCarousel ? `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Hook slide</div>
          <div style="color:#c9a84c;font-size:20px;font-weight:bold;margin-bottom:10px">${c.hook_slide}</div>
          ${slidesHtml}
          <div style="border-left:3px solid #4caf50;padding:8px 12px;margin:8px 0;color:#4caf50;font-size:13px">${c.cta_slide}</div>
        </div>
        ${slidePromptsHtml}` : ''}

      ${isReel ? `
        <div style="margin-bottom:16px">
          <div style="color:#c9a84c;font-size:20px;font-weight:bold;margin-bottom:10px">${c.hook_text}</div>
          ${(c.text_sequence || []).map(t =>
            `<div style="color:#ccc;padding:3px 0;font-size:13px"><span style="color:#444">@${t.second}s — </span>${t.text}</div>`
          ).join('')}
          <div style="color:#666;font-size:12px;margin-top:10px">🎵 ${c.audio_suggestion}</div>
        </div>` : ''}

      ${!isCarousel && !isReel ? `
        <div style="margin-bottom:16px">
          <div style="color:#c9a84c;font-size:22px;font-weight:bold;line-height:1.4;margin-bottom:8px">"${c.quote}"</div>
          ${c.subtext ? `<div style="color:#777;font-size:14px;margin-bottom:8px">${c.subtext}</div>` : ''}
        </div>` : ''}

      <div style="background:#111;border-radius:6px;padding:12px;margin-bottom:10px">
        <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Caption</div>
        <div style="color:#ccc;font-size:13px;line-height:1.7">${c.caption}</div>
      </div>

      ${!isCarousel ? `
        <div style="background:#111;border-radius:6px;padding:12px;margin-bottom:10px">
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Image prompt</div>
          <div style="color:#aaa;font-size:12px;font-family:monospace;line-height:1.6">${c.image_prompt}</div>
          <button onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy prompt',1500)})"
            style="margin-top:8px;background:#1a1a1a;color:#888;border:1px solid #333;border-radius:4px;padding:4px 12px;font-size:12px;cursor:pointer">
            Copy prompt
          </button>
        </div>` : ''}

      <div style="background:#111;border-radius:6px;padding:12px;margin-bottom:16px">
        <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Hashtags</div>
        <div style="color:#444;font-size:12px;line-height:1.6">${post.hashtags}</div>
      </div>

      ${uploadedPreview}
      ${actionButtons}
    </div>`;
}

// ── Dashboard ──────────────────────────────────
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

  const msg = req.query.msg;
  const msgHtml = msg ? `
    <div style="background:#1a2e1a;border:1px solid #2d4a2d;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#4caf50;font-size:13px">
      ${msg === 'posted' ? '🚀 Post published to @buildinempires!' :
        msg === 'approved' ? '✓ Post approved and queued' :
        msg === 'rejected' ? 'Post rejected and removed' : msg}
    </div>` : '';

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Buildin Empires — Approval Dashboard</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#050505;color:#fff;padding:20px;max-width:840px;margin:0 auto;font-family:system-ui,sans-serif}
    h1{color:#c9a84c;font-size:20px;margin-bottom:4px}
    h2{color:#333;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:28px 0 12px;padding-bottom:8px;border-bottom:1px solid #111}
    .stats{display:flex;gap:10px;margin:16px 0}
    .stat{background:#0d0d0d;border:1px solid #1a1a1a;border-radius:8px;padding:14px;flex:1;text-align:center}
    .stat .num{font-size:28px;font-weight:bold;color:#c9a84c}
    .stat .lbl{font-size:10px;color:#444;text-transform:uppercase;margin-top:4px;letter-spacing:1px}
    .empty{text-align:center;padding:80px 0;color:#222}
    .empty .icon{font-size:40px;margin-bottom:16px}
    .empty .title{font-size:16px;margin-bottom:8px;color:#333}
    .empty .sub{font-size:13px;color:#222;line-height:1.6}
  </style>
</head>
<body>
  <h1>Buildin Empires</h1>
  <p style="color:#333;font-size:13px;margin-top:4px">@buildinempires — Content Approval Dashboard</p>

  ${msgHtml}

  <div class="stats">
    <div class="stat"><div class="num">${pending.length}</div><div class="lbl">Pending</div></div>
    <div class="stat"><div class="num">${approved.length}</div><div class="lbl">Approved</div></div>
    <div class="stat"><div class="num">${posted.length}</div><div class="lbl">Posted</div></div>
  </div>

  ${pending.length > 0 ? `<h2>Needs your review</h2>${pending.map(p => renderPost(p, 'pending')).join('')}` : ''}
  ${approved.length > 0 ? `<h2>Approved — queued</h2>${approved.map(p => renderPost(p, 'approved')).join('')}` : ''}
  ${posted.length > 0 ? `<h2>Recently posted</h2>${posted.slice(-3).reverse().map(p => renderPost(p, 'posted')).join('')}` : ''}

  ${pending.length === 0 && approved.length === 0 ? `
    <div class="empty">
      <div class="icon">⏳</div>
      <div class="title">No posts in queue</div>
      <div class="sub">Content generates daily at 6 AM ET<br>Redeploy with GENERATE_ON_STARTUP=true to generate now</div>
    </div>` : ''}
</body>
</html>`);
});

// ── Upload + Approve ───────────────────────────
app.post('/upload-and-approve', requireAuth, upload.array('images', 10), async (req, res) => {
  const { postId, action, videoUrl } = req.body;

  try {
    let post;
    try {
      post = JSON.parse(await fs.readFile(path.join(PENDING_DIR, `${postId}.json`), 'utf8'));
    } catch {
      post = JSON.parse(await fs.readFile(path.join(APPROVED_DIR, `${postId}.json`), 'utf8'));
    }

    // Build public URLs for uploaded images
    const baseUrl  = `${req.protocol}://${req.get('host')}`;
    const imageUrls = (req.files || []).map(f => `${baseUrl}/uploads/${f.filename}`);

    post.imageUrls = imageUrls;
    post.videoUrl  = videoUrl?.trim() || null;

    if (action === 'post-now') {
      if (imageUrls.length === 0 && !post.videoUrl) {
        return res.status(400).send(`
          <div style="font-family:sans-serif;background:#050505;color:#fff;padding:40px">
            <h2 style="color:#e53;margin-bottom:12px">No images uploaded</h2>
            <p style="color:#888">Please select at least one image before posting.</p>
            <a href="/?token=${CONFIG.APPROVAL_SECRET}" style="color:#c9a84c;display:block;margin-top:16px">← Back to dashboard</a>
          </div>`);
      }
      post.status = 'approved';
      await publishApprovedPost(post);
      return res.redirect(`/?token=${CONFIG.APPROVAL_SECRET}&msg=posted`);
    }

    // Approve + queue
    post.status     = 'approved';
    post.approvedAt = new Date().toISOString();
    await fs.mkdir(APPROVED_DIR, { recursive: true });
    await fs.writeFile(path.join(APPROVED_DIR, `${postId}.json`), JSON.stringify(post, null, 2));
    try { await fs.unlink(path.join(PENDING_DIR, `${postId}.json`)); } catch {}
    res.redirect(`/?token=${CONFIG.APPROVAL_SECRET}&msg=approved`);

  } catch (e) {
    res.status(500).send(`
      <div style="font-family:sans-serif;background:#050505;color:#fff;padding:40px">
        <h2 style="color:#e53;margin-bottom:12px">Error</h2>
        <p style="color:#888">${e.message}</p>
        <a href="/?token=${CONFIG.APPROVAL_SECRET}" style="color:#c9a84c;display:block;margin-top:16px">← Back to dashboard</a>
      </div>`);
  }
});

// ── Reject ─────────────────────────────────────
app.post('/reject', requireAuth, async (req, res) => {
  const { postId } = req.body;
  await fs.unlink(path.join(PENDING_DIR, `${postId}.json`)).catch(() => {});
  res.redirect(`/?token=${CONFIG.APPROVAL_SECRET}&msg=rejected`);
});

// ── Health check ───────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

export function startApprovalServer() {
  app.listen(CONFIG.PORT, () => {
    console.log(`[Server] Dashboard running — open your Railway URL with ?token=${CONFIG.APPROVAL_SECRET}`);
  });
}
