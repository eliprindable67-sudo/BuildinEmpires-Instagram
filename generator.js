// ─────────────────────────────────────────────
//  CONTENT GENERATOR
//  Reads POST_SCHEDULE from config to determine
//  what type of post to generate each day
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
  return `You are the creative director of a dark luxury wealth mindset Instagram account called @buildinempires.
Voice: ${CONFIG.ACCOUNT_VOICE}
Visual identity: ${CONFIG.COLOR_PALETTE}
Topic: "${topic}"

Generate a CAROUSEL POST (8 slides) with this exact JSON structure:
{
  "hook_slide": "1 line, under 8 words, cold and arresting. No question marks. No exclamation points.",
  "slides": [
    {"slide_number": 2, "headline": "short bold claim", "body": "1-2 sentences max, cold and direct"},
    {"slide_number": 3, "headline": "...", "body": "..."},
    {"slide_number": 4, "headline": "...", "body": "..."},
    {"slide_number": 5, "headline": "...", "body": "..."},
    {"slide_number": 6, "headline": "...", "body": "..."},
    {"slide_number": 7, "headline": "...", "body": "..."},
    {"slide_number": 8, "headline": "...", "body": "..."}
  ],
  "cta_slide": "Final slide CTA. Example: 'Save this. Read it again in 6 months.' or 'Comment EMPIRE if you needed this.'",
  "caption": "3-4 sentence Instagram caption. Cold open. No emojis. End with a DM trigger like 'Comment DARK below.'",
  "image_prompt": "ChatGPT image prompt for ALL slides (same style, slightly different composition per slide). Dark luxury, cinematic, hyper-realistic. Moody low-key lighting. Deep blacks, muted gold. Abstract wealth symbols, architecture, luxury objects — NO people.",
  "slide_image_prompts": [
    "Specific prompt variation for slide 1 cover",
    "Specific prompt variation for slide 2",
    "Specific prompt variation for slide 3",
    "Specific prompt variation for slide 4",
    "Specific prompt variation for slide 5",
    "Specific prompt variation for slide 6",
    "Specific prompt variation for slide 7",
    "Specific prompt variation for slide 8 CTA"
  ],
  "alt_text": "Plain description of the visual series"
}

Return ONLY valid JSON. No markdown. No explanation.`;
}

// ── PROMPT: Reel ──────────────────────────────
function buildReelPrompt(topic) {
  return `You are the creative director of a dark luxury wealth mindset Instagram account called @buildinempires.
Voice: ${CONFIG.ACCOUNT_VOICE}
Topic: "${topic}"

Generate a REEL POST with this exact JSON structure:
{
  "hook_text": "Text overlay for first 2 seconds. Max 6 words. Cold and polarizing.",
  "text_sequence": [
    {"second": 0, "text": "hook text here"},
    {"second": 3, "text": "second line"},
    {"second": 6, "text": "third line"},
    {"second": 9, "text": "fourth line"},
    {"second": 12, "text": "final statement or CTA"}
  ],
  "caption": "2-3 sentence caption. No emojis. Ends with 'Comment EMPIRE if you agree.'",
  "image_prompt": "Cinematic still image for Reel background. Dark luxury: black marble, candlelight, penthouse at night, luxury car interior — hyper-realistic, no people, moody lighting, deep blacks and gold.",
  "audio_suggestion": "Describe audio vibe to search on Instagram: e.g. 'dark cinematic piano 90 BPM' or 'moody lo-fi jazz low bass'",
  "alt_text": "Plain description of the visual"
}

Return ONLY valid JSON. No markdown. No explanation.`;
}

// ── PROMPT: Quote ─────────────────────────────
function buildQuotePrompt(topic) {
  return `You are the creative director of a dark luxury wealth mindset Instagram account called @buildinempires.
Voice: ${CONFIG.ACCOUNT_VOICE}
Topic: "${topic}"

Generate a QUOTE POST with this exact JSON structure:
{
  "quote": "One sentence. Cold, sharp, true. Under 12 words. Original thought.",
  "subtext": "1 line beneath the quote, 8 words max, punchy.",
  "caption": "1-2 sentences. Quote says everything — caption adds minimal context. End with 'Send this to someone who needed it.'",
  "image_prompt": "Dark luxury background for quote card. Examples: black leather close-up, rain on penthouse window, blurred city lights at 3am, empty luxury hotel corridor, single lit candle. Cinematic, no people, ultra high contrast.",
  "alt_text": "Plain description of the visual"
}

Return ONLY valid JSON. No markdown. No explanation.`;
}

// ── Main generate function ────────────────────
export async function generatePost(overrideType = null) {
  const postType = overrideType || getTodayPostType();
  const topic    = getTodayTopic();
  const hashtags = getHashtags(postType);

  if (postType === 'none') {
    console.log('[Generator] No post scheduled for today — skipping');
    return null;
  }

  console.log(`\n[Generator] Type: ${postType} | Topic: "${topic}"`);

  let promptFn;
  if (postType === 'carousel') promptFn = buildCarouselPrompt;
  else if (postType === 'reel') promptFn = buildReelPrompt;
  else                          promptFn = buildQuotePrompt;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: promptFn(topic) }],
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
    generatedAt: new Date().toISOString(),
    status:      'pending',
    content:     parsed,
  };

  const filePath = path.join('/home/claude/darkluxury/queue/pending', `${postId}.json`);
  await fs.writeFile(filePath, JSON.stringify(postPackage, null, 2));
  console.log(`[Generator] Saved to queue: ${filePath}`);

  return postPackage;
}
