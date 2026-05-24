// ─────────────────────────────────────────────
//  BUILDIN EMPIRES — CONTENT GENERATOR
//  Calls Claude to produce a full post package
//  based on the POST_SCHEDULE in config.js
// ─────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from './config.js';

const client = new Anthropic({ apiKey: CONFIG.ANTHROPIC_API_KEY });

// ── Get today's post type from schedule ───────
function getTodayPostType() {
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  return CONFIG.POST_SCHEDULE[day] || 'quote';
}

// ── Get today's topic (cycles through pool) ───
function getTodayTopic() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  return CONFIG.TOPIC_POOL[dayOfYear % CONFIG.TOPIC_POOL.length];
}

// ── Build hashtags based on post type ─────────
function getHashtags(postType) {
  if (postType === 'carousel') return `${CONFIG.HASHTAG_SETS.wealth}\n${CONFIG.HASHTAG_SETS.discipline}`;
  if (postType === 'reel')     return `${CONFIG.HASHTAG_SETS.discipline}\n${CONFIG.HASHTAG_SETS.quotes}`;
  return `${CONFIG.HASHTAG_SETS.quotes}\n${CONFIG.HASHTAG_SETS.wealth}`;
}

// ── PROMPT: Carousel ──────────────────────────
function buildCarouselPrompt(topic) {
  return `You are the creative director of ${CONFIG.ACCOUNT_NAME}, a dark luxury wealth mindset Instagram account.
Brand voice: ${CONFIG.ACCOUNT_VOICE}
Visual identity: ${CONFIG.COLOR_PALETTE}
Topic: "${topic}"

Generate a CAROUSEL POST (8 slides + cover + CTA) with this exact JSON structure:
{
  "hook_slide": "Cover slide text. 1 line, under 8 words, cold and arresting. No question marks. No exclamation points.",
  "slides": [
    {"slide_number": 2, "headline": "short bold claim", "body": "1-2 sentences max, cold and direct"},
    {"slide_number": 3, "headline": "...", "body": "..."},
    {"slide_number": 4, "headline": "...", "body": "..."},
    {"slide_number": 5, "headline": "...", "body": "..."},
    {"slide_number": 6, "headline": "...", "body": "..."},
    {"slide_number": 7, "headline": "...", "body": "..."},
    {"slide_number": 8, "headline": "...", "body": "..."}
  ],
  "cta_slide": "Final slide. 1 line. Example: 'Save this. Read it again in 6 months.' or 'Comment ${CONFIG.DM_TRIGGER} if you needed this.'",
  "caption": "3-4 sentence Instagram caption. Cold open. No emojis. End with 'Comment ${CONFIG.DM_TRIGGER} below.'",
  "slide_image_prompts": [
    "Image prompt for cover slide — dark luxury, cinematic, hyper-realistic, moody lighting, deep blacks and muted gold, abstract wealth symbol or architecture, NO people",
    "Slight variation for slide 2 — same style, different composition or object",
    "Slight variation for slide 3",
    "Slight variation for slide 4",
    "Slight variation for slide 5",
    "Slight variation for slide 6",
    "Slight variation for slide 7",
    "Slight variation for CTA slide 8 — minimal, strong, ending energy"
  ],
  "alt_text": "Plain text description of the visual series for accessibility"
}

Return ONLY valid JSON. No markdown fences. No explanation.`;
}

// ── PROMPT: Reel ──────────────────────────────
function buildReelPrompt(topic) {
  return `You are the creative director of ${CONFIG.ACCOUNT_NAME}, a dark luxury wealth mindset Instagram account.
Brand voice: ${CONFIG.ACCOUNT_VOICE}
Visual identity: ${CONFIG.COLOR_PALETTE}
Topic: "${topic}"

Generate a REEL POST with this exact JSON structure:
{
  "hook_text": "Text overlay for first 2 seconds. Max 6 words. Cold and polarizing.",
  "text_sequence": [
    {"second": 0,  "text": "hook text here"},
    {"second": 3,  "text": "second line"},
    {"second": 6,  "text": "third line"},
    {"second": 9,  "text": "fourth line"},
    {"second": 12, "text": "final statement or CTA"}
  ],
  "caption": "2-3 sentence caption. No emojis. Ends with 'Comment ${CONFIG.DM_TRIGGER} if you agree.'",
  "image_prompt": "Cinematic still image for Reel background. Dark luxury style: black marble, single candle, penthouse view at night, luxury car interior detail — hyper-realistic, no people, moody low-key lighting, deep blacks and muted gold.",
  "audio_suggestion": "Describe the vibe of audio to search on Instagram. Example: 'dark cinematic piano 90 BPM' or 'moody lo-fi jazz low bass'",
  "alt_text": "Plain text description of the visual for accessibility"
}

Return ONLY valid JSON. No markdown fences. No explanation.`;
}

// ── PROMPT: Quote ─────────────────────────────
function buildQuotePrompt(topic) {
  return `You are the creative director of ${CONFIG.ACCOUNT_NAME}, a dark luxury wealth mindset Instagram account.
Brand voice: ${CONFIG.ACCOUNT_VOICE}
Visual identity: ${CONFIG.COLOR_PALETTE}
Topic: "${topic}"

Generate a QUOTE POST with this exact JSON structure:
{
  "quote": "One sentence. Cold, sharp, true. Under 12 words. Original thought — no attribution needed.",
  "subtext": "1 optional line beneath the quote. Max 8 words. Lands like a punch.",
  "caption": "1-2 sentences only. The quote says everything — caption adds minimal context. End with 'Send this to someone who needed it.'",
  "image_prompt": "Dark luxury background for quote card. Examples: extreme close-up of black leather, rain on a penthouse window at night, blurred city lights at 3am, empty luxury hotel corridor, single lit candle on black. Cinematic, no people, ultra high contrast, muted gold tones.",
  "alt_text": "Plain text description of the visual for accessibility"
}

Return ONLY valid JSON. No markdown fences. No explanation.`;
}

// ── Main generate function ────────────────────
export async function generatePost(overrideType = null) {
  const postType = overrideType || getTodayPostType();
  const topic    = getTodayTopic();
  const hashtags = getHashtags(postType);

  if (postType === 'none') {
    console.log('[Generator] No post scheduled today — skipping');
    return null;
  }

  console.log(`\n[Generator] Account: ${CONFIG.ACCOUNT_NAME}`);
  console.log(`[Generator] Type: ${postType} | Topic: "${topic}"`);

  let promptFn;
  if (postType === 'carousel') promptFn = buildCarouselPrompt;
  else if (postType === 'reel') promptFn = buildReelPrompt;
  else                          promptFn = buildQuotePrompt;

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 2000,
    messages:   [{ role: 'user', content: promptFn(topic) }],
  });

  let rawContent = response.content[0].text.trim();
  rawContent = rawContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (e) {
    console.error('[Generator] JSON parse failed:', e.message);
    throw new Error('Claude returned invalid JSON — retrying next cycle');
  }

  const postId = `${postType}_${Date.now()}`;
  const postPackage = {
    id:          postId,
    type:        postType,
    topic,
    hashtags,
    account:     CONFIG.ACCOUNT_NAME,
    generatedAt: new Date().toISOString(),
    status:      'pending',
    content:     parsed,
  };

  const filePath = path.join('/home/claude/darkluxury/queue/pending', `${postId}.json`);
  await fs.writeFile(filePath, JSON.stringify(postPackage, null, 2));
  console.log(`[Generator] Saved to queue: ${filePath}`);

  return postPackage;
}
