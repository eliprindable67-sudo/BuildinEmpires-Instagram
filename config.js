// ─────────────────────────────────────────────
//  DARK LUXURY INSTAGRAM AUTOMATION — CONFIG
//  Edit POST_SCHEDULE below to control exactly
//  what type of post goes out each day
// ─────────────────────────────────────────────

export const CONFIG = {

  // ── ANTHROPIC (Claude) ──────────────────────
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',

  // ── META / INSTAGRAM GRAPH API ──────────────
  META_ACCESS_TOKEN:    process.env.META_ACCESS_TOKEN || '',
  INSTAGRAM_ACCOUNT_ID: process.env.INSTAGRAM_ACCOUNT_ID || '',

  // ── APPROVAL INTERFACE ──────────────────────
  APPROVAL_SECRET: process.env.APPROVAL_SECRET || 'darklux2026',
  PORT: process.env.PORT || 3000,

  // ── POSTING SCHEDULE ────────────────────────
  // Times are in ET (Eastern Time)
  // Set to [] for no post that day
  SCHEDULE: {
    monday:    ['07:00'],
    tuesday:   ['07:00', '18:00'],
    wednesday: ['07:00'],
    thursday:  ['07:00', '18:00'],
    friday:    ['07:00'],
    saturday:  [],
    sunday:    [],
  },

  // ── POST TYPE PER DAY ────────────────────────
  // Options for each day:
  //   'quote'    — single image with one powerful quote (easiest, 1 image)
  //   'carousel' — slideshow of 8 slides (most saves, needs 8 images)
  //   'reel'     — short video format (most reach, needs 1 image or video)
  //   'none'     — skip this day entirely
  //
  // RECOMMENDED STARTER SCHEDULE:
  //   Mon/Thu = carousel (saves algorithm)
  //   Tue/Fri = reel (reach algorithm)
  //   Wed     = quote (DM share trigger)
  //   Sat/Sun = none (rest days)
  //
  POST_SCHEDULE: {
    monday:    'carousel',
    tuesday:   'reel',
    wednesday: 'quote',
    thursday:  'carousel',
    friday:    'reel',
    saturday:  'none',
    sunday:    'none',
  },

  // ── CONTENT SETTINGS ────────────────────────
  NICHE: 'dark luxury wealth mindset',
  ACCOUNT_VOICE: 'cold, direct, aspirational — never desperate, never loud. Think: midnight boardroom, not hustle bro.',
  COLOR_PALETTE: 'deep black, muted gold, slate grey, off-white',

  // ── HASHTAG SETS ─────────────────────────────
  HASHTAG_SETS: {
    wealth:     '#wealthmindset #darkluxury #millionairemindset #richlifestyle #luxurylife #moneyminds #financialfreedom #elitemindset',
    discipline: '#discipline #mentalstrength #stoicmindset #silentwealth #focusedmind #grindculture #darkambition #buildingempires',
    quotes:     '#powerquotes #successquotes #motivationaldaily #mindsetshift #levelup #ambitionquotes #darkquotes #luxuryquotes',
  },

  // ── TOPIC POOL ───────────────────────────────
  // Claude cycles through these topics daily
  // Add your own topics to this list anytime
  TOPIC_POOL: [
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
    'Why your network is your net worth — and how to build one quietly',
    'The morning routine of someone who actually has money',
    'What broke people think rich people do all day',
    'Why delayed gratification is the ultimate luxury',
    'The uncomfortable truth about passive income',
    'How to think about money like old European families do',
    'Why the most successful people are also the most boring',
    'The difference between being busy and being productive',
  ],
};
