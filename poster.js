// ─────────────────────────────────────────────
//  BUILDIN EMPIRES — INSTAGRAM POSTER
// ─────────────────────────────────────────────

import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from './config.js';

const BASE_URL    = 'https://graph.facebook.com/v19.0';
const APPROVED_DIR = '/app/queue/approved';
const POSTED_DIR   = '/app/queue/posted';

async function metaPost(endpoint, body) {
  const res  = await fetch(`${BASE_URL}${endpoint}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...body, access_token: CONFIG.META_ACCESS_TOKEN }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Meta API error: ${data.error.message}`);
  return data;
}

async function createImageContainer(imageUrl, caption, isCarouselItem = false) {
  const body = { image_url: imageUrl };
  if (!isCarouselItem && caption) body.caption = caption;
  if (isCarouselItem) body.is_carousel_item = true;
  const result = await metaPost(`/${CONFIG.INSTAGRAM_ACCOUNT_ID}/media`, body);
  return result.id;
}

async function publishContainer(creationId) {
  const result = await metaPost(`/${CONFIG.INSTAGRAM_ACCOUNT_ID}/media_publish`, {
    creation_id: creationId,
  });
  return result.id;
}

async function waitForReady(containerId, maxRetries = 12) {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const res  = await fetch(`${BASE_URL}/${containerId}?fields=status_code&access_token=${CONFIG.META_ACCESS_TOKEN}`);
    const data = await res.json();
    console.log(`[Poster] Media status: ${data.status_code}`);
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR') throw new Error('Media processing failed');
  }
  throw new Error('Media processing timed out');
}

export async function publishApprovedPost(postPackage) {
  const { type, content, hashtags } = postPackage;
  const buildCaption = (base) => `${base}\n\n.\n.\n.\n${hashtags}`;

  console.log(`\n[Poster] Publishing ${type} post...`);

  let postId;

  if (type === 'carousel') {
    if (!postPackage.imageUrls?.length) throw new Error('Carousel requires imageUrls — add them in the dashboard first');
    const caption   = buildCaption(content.caption);
    const itemIds   = [];
    for (const url of postPackage.imageUrls) {
      const id = await createImageContainer(url, null, true);
      itemIds.push(id);
      await new Promise(r => setTimeout(r, 1000));
    }
    const carousel = await metaPost(`/${CONFIG.INSTAGRAM_ACCOUNT_ID}/media`, {
      media_type: 'CAROUSEL',
      children:   itemIds.join(','),
      caption,
    });
    await new Promise(r => setTimeout(r, 3000));
    postId = await publishContainer(carousel.id);

  } else if (type === 'reel' && postPackage.videoUrl) {
    const caption   = buildCaption(content.caption);
    const container = await metaPost(`/${CONFIG.INSTAGRAM_ACCOUNT_ID}/media`, {
      media_type:    'REELS',
      video_url:     postPackage.videoUrl,
      caption,
      share_to_feed: true,
    });
    await waitForReady(container.id);
    postId = await publishContainer(container.id);

  } else {
    if (!postPackage.imageUrls?.[0]) throw new Error('Post requires at least one imageUrl');
    const caption     = buildCaption(content.caption);
    const creationId  = await createImageContainer(postPackage.imageUrls[0], caption);
    await new Promise(r => setTimeout(r, 3000));
    postId = await publishContainer(creationId);
  }

  console.log(`[Poster] Published! Instagram post ID: ${postId}`);

  const postedPackage = {
    ...postPackage,
    status:          'posted',
    postedAt:        new Date().toISOString(),
    instagramPostId: postId,
  };

  await fs.mkdir(POSTED_DIR, { recursive: true });
  await fs.writeFile(
    path.join(POSTED_DIR, `${postPackage.id}.json`),
    JSON.stringify(postedPackage, null, 2)
  );

  try { await fs.unlink(path.join(APPROVED_DIR, `${postPackage.id}.json`)); } catch {}

  return postId;
}
