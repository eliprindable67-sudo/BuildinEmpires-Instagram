// ─────────────────────────────────────────────
//  CONTENT GENERATOR
//  Calls Claude to produce a full post package:
//  image prompt + caption + hashtags + slides
// ─────────────────────────────────────────────
 
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from './config.js';
 
const client = new Anthropic({ apiKey: CONFIG.ANTHROPIC_API_KEY });
 
// ── Trending topic pool (Claude refreshes weekly) ──
const TOPIC_POOL = [
  'The hidden psychology of old money vs new money',
  'Why most people stay broke: the comfort trap',
  'The 5 AM club is for people who think routine is a personality',
  'Silence is the loudest flex',
  'How the wealthy use boredom as a competitive advantage',
  'The difference between looking rich and building wealth',
  'Dark side of ambition nobody talks about',
  'Why discipline beats motivation every time',
  'The luxury of saying no',
  'Soft life vs hard choices — which actually builds wealth',
  'The stoic approach to money that the internet hates',
  'How to move in silence while everyone else performs',
];
 
function getTodayTopic() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return TOPIC_POOL[dayOfYear % TOPIC_POOL.length];
}
 
function getTodayPostType() {
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  return CONFIG.POST_TYPES[day] || 'quote';
}
 
function getHashtags(postType) {
  if (postType === 'carousel') return `${CONFIG.HASHTAG_SETS.wealth}\n${CONFIG.HASHTAG_SETS.discipline}`;
  if (postType === 'reel') return `${CONFIG.HASHTAG_SETS.discipline}\n${CONFIG.HASHTAG_SETS.quotes}`;
  return `${CONFIG.HASHTAG_SETS.quotes}\n${CONFIG.HASHTAG_SETS.wealth}`;
}
 
// ── Prompt builders ────────────────────────────
 
function buildCarouselPrompt(topic) {
  return `You are the creative director of a dark luxury wealth mindset Instagram account.
Voice: ${CONFIG.ACCOUNT_VOICE}
Visual identity: ${CONFIG.COLOR_PALETTE}
 
Topic: "${topic}"
 
Generate a CAROUSEL POST package with this exact JSON structure:
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
  "cta_slide": "1 line CTA. Example: 'Save this. Read it again in 6 months.' or 'Comment WEALTH if you needed this.'",
  "caption": "3-4 sentence Instagram caption. Cold open. No emojis. End with a DM trigger like 'Comment DARK below.'",
  "image_prompt": "Detailed ChatGPT image prompt for the cover slide. Style: cinematic, dark luxury, hyper-realistic. Include: lighting (moody, low key), color (blacks, deep gold), subject matter (abstract wealth symbol, architectural detail, luxury object — NO people), camera angle, mood.",
  "alt_text": "Plain description of the image for accessibility"
}
 
Return ONLY valid JSON. No markdown. No explanation.`;
}
 
function buildReelPrompt(topic) {
  return `You are the creative director of a dark luxury wealth mindset Instagram account.
Voice: ${CONFIG.ACCOUNT_VOICE}
 
Topic: "${topic}"
 
Generate a REEL POST package with this exact JSON structure:
{
  "hook_text": "Text overlay for first 2 seconds. Max 6 words. Cold and polarizing.",
  "text_sequence": [
    {"second": 0, "text": "hook_text here"},
    {"second": 3, "text": "second line"},
    {"second": 6, "text": "third line"},
    {"second": 9, "text": "fourth line"},
    {"second": 12, "text": "final statement or CTA"}
  ],
  "caption": "2-3 sentence caption. No emojis. Ends with 'Comment DARK if you agree.'",
  "image_prompt": "Cinematic still image to use as Reel background. Dark luxury: black marble, candlelight, penthouse view at night, abandoned mansion, luxury car interior detail — hyper-realistic, no people, moody lighting, deep blacks and gold.",
  "audio_suggestion": "Describe the vibe of audio to search: e.g. 'dark piano, slow cinematic, 90 BPM' or 'lo-fi jazz, moody, low bass'",
  "alt_text": "Plain description of the visual for accessibility"
}
 
Return ONLY valid JSON. No markdown. No explanation.`;
}
 
function buildQuotePrompt(topic) {
  return `You are the creative director of a dark luxury wealth mindset Instagram account.
Voice: ${CONFIG.ACCOUNT_VOICE}
 
Topic: "${topic}"
 
Generate a QUOTE POST package with this exact JSON structure:
{
  "quote": "One single sentence. Cold, sharp, true. Under 12 words. No attribution needed — this is an original thought.",
  "subtext": "Optional 1 line beneath the quote, 8 words max, that lands like a punch.",
  "caption": "1-2 sentences max. The quote says everything — caption just adds context or asks a question. End with 'Send this to someone who needed it.'",
  "image_prompt": "Dark luxury background for quote card. Examples: close-up of black leather, rain on a penthouse window, blurred city lights at 3am, empty luxury hotel corridor, single lit candle. Cinematic, no people, ultra high contrast.",
  "alt_text": "Plain description of the visual"
}
 
Return ONLY valid JSON. No markdown. No explanation.`;
}
 
// ── Main generator ─────────────────────────────
 
export async function generatePost() {
  const postType = getTodayPostType();
  const topic = getTodayTopic();
  const hashtags = getHashtags(postType);
 
  console.log(`\n[Generator] Type: ${postType} | Topic: "${topic}"`);
 
  let promptFn;
  if (postType === 'carousel') promptFn = buildCarouselPrompt;
  else if (postType === 'reel') promptFn = buildReelPrompt;
  else promptFn = buildQuotePrompt;
 
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: promptFn(topic) }],
  });
 
  let rawContent = response.content[0].text.trim();
  // Strip any accidental markdown fences
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
    id: postId,
    type: postType,
    topic,
    hashtags,
    generatedAt: new Date().toISOString(),
    status: 'pending',
    content: parsed,
  };
 
  const filePath = path.join('/home/claude/darkluxury/queue/pending', `${postId}.json`);
  await fs.writeFile(filePath, JSON.stringify(postPackage, null, 2));
  console.log(`[Generator] Saved to queue: ${filePath}`);
 
  return postPackage;
}
