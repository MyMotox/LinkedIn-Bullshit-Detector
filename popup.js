// popup.js — Bullshit-o-Meter v1.3
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
// Local dev URL. For Vercel, replace with: https://YOUR-PROJECT.vercel.app/api/analyze
const ANALYSIS_API_URL = 'http://localhost:8787/v1/analyze';

const LOADING_MESSAGES = [
  "Extracting profile data...",
  "Scanning for corporate jargon...",
  "Weighing the buzzwords...",
  "Calibrating the detector...",
  "Computing hype levels...",
  "Almost done... 💩",
];

const CATEGORIES = {
  jargon: {
    icon: '🎭',
    label: 'Corporate Jargon',
    desc: 'Empty buzzwords with no concrete meaning — words that sound impressive but say nothing.',
  },
  hype: {
    icon: '🚀',
    label: 'Hype & Self-Promo',
    desc: 'Unverifiable superlatives, excessive self-praise, and inflated claims nobody can fact-check.',
  },
  titrepompeux: {
    icon: '🤡',
    label: 'Inflated Job Title',
    desc: 'Job titles artificially inflated to sound more senior or unique than the role actually is.',
  },
  substance: {
    icon: '📊',
    label: 'Real Substance',
    desc: 'Concrete achievements and measurable results. Higher = more legit. Lower = all talk.',
    inverse: true,
  },
};

function scoreColor(s) {
  if (s <= 20) return '#34d399';
  if (s <= 45) return '#fbbf24';
  if (s <= 65) return '#f97316';
  if (s <= 85) return '#ef4444';
  return '#a21caf';
}

function scoreVerdict(s) {
  if (s <= 15) return { emoji: '✅', text: 'Genuinely Legit',     bg: 'rgba(52,211,153,0.1)',  color: '#34d399' };
  if (s <= 35) return { emoji: '🤔', text: 'Slightly Suspicious', bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24' };
  if (s <= 55) return { emoji: '⚠️', text: 'Corporate Vibes',     bg: 'rgba(249,115,22,0.1)',  color: '#f97316' };
  if (s <= 75) return { emoji: '🚨', text: 'Bullshit Detected!',  bg: 'rgba(239,68,68,0.1)',   color: '#ef4444' };
  if (s <= 90) return { emoji: '💀', text: 'LinkedIn Guru Level', bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' };
  return         { emoji: '💩', text: 'MAXIMUM BULLSHIT',         bg: 'rgba(162,28,175,0.15)', color: '#a21caf' };
}

function animateNumber(el, target, duration = 1000, suffix = '%') {
  const start = performance.now();
  const decimals = Number.isInteger(target) ? 0 : 1;
  (function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const value = (1 - Math.pow(1 - p, 3)) * target;
    el.textContent = value.toFixed(decimals) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeBullshitAverage(subScores = {}) {
  const jargon = clampScore(subScores.jargon);
  const hype = clampScore(subScores.hype);
  const titrepompeux = clampScore(subScores.titrepompeux);
  const substance = clampScore(subScores.substance);
  // Simple arithmetic mean of the 4 criteria.
  return Math.round(((jargon + hype + titrepompeux + substance) / 4) * 10) / 10;
}

function isLikelyLinkedInUiText(text) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return true;
  const uiPatterns = [
    /^about$/,
    /^experience$/,
    /^education$/,
    /^skills?$/,
    /^activity$/,
    /^interests?$/,
    /^open to work$/,
    /^connect$/,
    /^follow$/,
    /^message$/,
    /^see more$/,
    /^show all$/,
    /^view (profile|full profile)$/,
    /^linkedin$/,
    /^people also viewed$/,
    /^\d+\+?\s+(followers?|connections?)$/,
    /^talks about/,
    /^mutual connections?$/,
  ];
  return uiPatterns.some(re => re.test(t));
}

function sanitizeQuotes(quotes, sourceText) {
  if (!Array.isArray(quotes)) return [];
  const src = sourceText || '';
  const out = [];
  const seen = new Set();

  quotes.forEach((q) => {
    if (typeof q !== 'string') return;
    const clean = q.trim();
    if (!clean || clean.length < 3) return;
    if (isLikelyLinkedInUiText(clean)) return;
    if (src && !src.includes(clean)) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  });

  return out;
}

function normalizeAnalysis(rawAnalysis, profileText) {
  const rawSub = rawAnalysis?.subScores || {};
  const subScores = {
    jargon: clampScore(rawSub.jargon),
    hype: clampScore(rawSub.hype),
    titrepompeux: clampScore(rawSub.titrepompeux),
    substance: clampScore(rawSub.substance),
  };

  const categoryQuotes = rawAnalysis?.categoryQuotes || {};

  return {
    ...rawAnalysis,
    subScores,
    bullshitScore: computeBullshitAverage(subScores),
    bsPhrases: sanitizeQuotes(rawAnalysis?.bsPhrases, profileText),
    categoryQuotes: {
      jargon: sanitizeQuotes(categoryQuotes.jargon, profileText),
      hype: sanitizeQuotes(categoryQuotes.hype, profileText),
      titrepompeux: sanitizeQuotes(categoryQuotes.titrepompeux, profileText),
      substance: sanitizeQuotes(categoryQuotes.substance, profileText),
    },
  };
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
let notLinkedin;
let mainScreen;
let profileUrl;
let analyzeBtn;
let loadingDiv;
let loadingText;
let resultsDiv;
let errorBox;
let resetBtn;
let copyBtn;

let currentProfileData = null;
let currentAnalysis    = null;
let currentTab         = null;

function cacheDomRefs() {
  notLinkedin = document.getElementById('not-linkedin');
  mainScreen  = document.getElementById('main-screen');
  profileUrl  = document.getElementById('profile-url');
  analyzeBtn  = document.getElementById('analyze-btn');
  loadingDiv  = document.getElementById('loading');
  loadingText = document.getElementById('loading-text');
  resultsDiv  = document.getElementById('results');
  errorBox    = document.getElementById('error-box');
  resetBtn    = document.getElementById('reset-btn');
  copyBtn     = document.getElementById('copy-btn');
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    if (!notLinkedin || !mainScreen || !profileUrl) {
      return;
    }

    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    const url  = currentTab?.url || '';

    if (!url.includes('linkedin.com/in/')) {
      notLinkedin.style.display = 'block';
      mainScreen.style.display  = 'none';
      return;
    }

    // Show cleaned URL (e.g. "linkedin.com/in/julescs")
    const cleanUrl = url.replace('https://www.', '').replace('https://', '').split('?')[0].replace(/\/$/, '');
    profileUrl.textContent = cleanUrl;

    notLinkedin.style.display = 'none';
    mainScreen.style.display  = 'block';

    // Try to scrape immediately (content script injected by background.js)
    // Small delay to ensure content script is ready
    setTimeout(async () => {
      try {
        const res = await browserAPI.tabs.sendMessage(currentTab.id, { action: 'scrapeProfile' });
        if (res?.success) currentProfileData = res.data;
      } catch (_) {}
    }, 100);

  } catch (e) {
    notLinkedin.style.display = 'block';
  }
}

// ── Send to content script (with auto-inject fallback) ───────────────────────
async function sendToContent(tabId, msg) {
  try {
    const r = await browserAPI.tabs.sendMessage(tabId, msg);
    if (r) return r;
  } catch (_) {}
  try {
    await browserAPI.tabs.executeScript(tabId, { file: 'content.js' });
    await new Promise(r => setTimeout(r, 400));
    return await browserAPI.tabs.sendMessage(tabId, msg);
  } catch (e) {
    throw new Error('Cannot read page: ' + e.message);
  }
}

// ── Analyze button ────────────────────────────────────────────────────────────
async function handleAnalyzeClick() {
  errorBox.style.display   = 'none';
  resultsDiv.style.display = 'none';

  if (!currentTab) {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
  }

  // Always fresh scrape on every analysis click
  try {
    const res = await sendToContent(currentTab.id, { action: 'scrapeProfile' });
    if (res?.success) currentProfileData = res.data;
  } catch (e) {
    showError('Read error: ' + e.message);
    return;
  }

  const hasData = currentProfileData && (
    currentProfileData.headline || currentProfileData.about ||
    currentProfileData.rawText  || currentProfileData.experiences?.length
  );

  if (!hasData) {
    showError('Could not read this profile. Reload the LinkedIn page and try again.');
    return;
  }

  analyzeBtn.disabled      = true;
  loadingDiv.style.display = 'block';

  let idx = 0;
  const interval = setInterval(() => {
    loadingText.textContent = LOADING_MESSAGES[++idx % LOADING_MESSAGES.length];
  }, 1400);

  try {
    const analysis = await callSecureAnalyzeApi(currentProfileData);
    currentAnalysis = analysis;
    clearInterval(interval);
    loadingDiv.style.display = 'none';
    renderResults(analysis);
  } catch (e) {
    clearInterval(interval);
    loadingDiv.style.display = 'none';
    showError('API error: ' + e.message);
  } finally {
    analyzeBtn.disabled = false;
  }
}

// ── Backend call (OpenAI key stays server-side) ───────────────────────────────
async function callSecureAnalyzeApi(profile) {
  const profileText = formatProfile(profile);

  const res = await fetch(ANALYSIS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      profileText
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || err?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return normalizeAnalysis(data, profileText);
}

// ── Format profile ────────────────────────────────────────────────────────────
function formatProfile(d) {
  let t = '';
  if (d.headline) t += `Job Title: ${d.headline}\n`;
  if (d.about)    t += `About section: ${d.about}\n`;
  if (d.experiences?.length) {
    t += `Experiences:\n`;
    d.experiences.slice(0, 6).forEach(e => {
      t += `- ${typeof e === 'string' ? e : JSON.stringify(e)}\n`;
    });
  }
  if (d.skills?.length)  t += `Skills: ${d.skills.slice(0, 20).join(', ')}\n`;
  if (d.posts?.length) {
    t += `Posts:\n`;
    d.posts.slice(0, 3).forEach((p, i) => { t += `[${i+1}] ${p.substring(0, 400)}\n`; });
  }
  // rawText only as last resort if we have very little data
  if (t.trim().length < 100 && d.rawText) {
    t += `Page text: ${d.rawText.substring(0, 2000)}`;
  }
  return t.trim();
}

// ── Render results ────────────────────────────────────────────────────────────
function renderResults(data) {
  const score   = Number.isFinite(Number(data.bullshitScore)) ? Number(data.bullshitScore) : 0;
  const color   = scoreColor(score);
  const verdict = scoreVerdict(score);

  const scoreEl = document.getElementById('main-score');
  const fillEl  = document.getElementById('meter-fill');
  const verdEl  = document.getElementById('meter-verdict');

  scoreEl.style.color = color;
  animateNumber(scoreEl, score);
  setTimeout(() => {
    fillEl.style.width      = score + '%';
    fillEl.style.background = `linear-gradient(90deg, #34d399, ${color})`;
  }, 80);

  verdEl.textContent      = `${verdict.emoji}  ${verdict.text}`;
  verdEl.style.background = verdict.bg;
  verdEl.style.color      = verdict.color;

  // Detected phrases
  const phrasesEl = document.getElementById('bs-phrases');
  phrasesEl.innerHTML = '';
  (data.bsPhrases || []).forEach(p => {
    const tag = document.createElement('span');
    tag.className   = 'bs-tag';
    tag.textContent = `"${p}"`;
    phrasesEl.appendChild(tag);
  });
  if (!data.bsPhrases?.length) {
    const empty = document.createElement('span');
    empty.style.color = 'var(--muted)';
    empty.style.fontSize = '10px';
    empty.textContent = 'No bullshit phrases detected 🎉';
    phrasesEl.appendChild(empty);
  }

  // Category breakdown
  const sub       = data.subScores       || {};
  const details   = data.categoryDetails || {};
  const quotes    = data.categoryQuotes  || {};
  const container = document.getElementById('breakdown-container');
  container.innerHTML = '';

  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const raw = Math.round(sub[key] || 0);
    const c   = cat.inverse ? scoreColor(100 - raw) : scoreColor(raw);
    const catQuotes = (quotes[key] || []).filter(q => q && q.trim().length > 0);

    const item = document.createElement('div');
    item.className = 'bk-item';

    const row = document.createElement('div');
    row.className = 'bk-row';

    const catEl = document.createElement('div');
    catEl.className = 'bk-cat';
    catEl.textContent = `${cat.icon} ${cat.label}`;

    const scoreEl = document.createElement('div');
    scoreEl.className = 'bk-score';
    scoreEl.style.color = c;
    scoreEl.textContent = `${raw}%`;

    row.appendChild(catEl);
    row.appendChild(scoreEl);

    const barWrap = document.createElement('div');
    barWrap.className = 'bk-bar-wrap';

    const bar = document.createElement('div');
    bar.className = 'bk-bar';
    bar.id = `bar-${key}`;
    bar.style.width = '0%';
    bar.style.background = c;
    barWrap.appendChild(bar);

    const desc = document.createElement('div');
    desc.className = 'bk-desc';
    desc.textContent = details[key] || cat.desc;

    item.appendChild(row);
    item.appendChild(barWrap);
    item.appendChild(desc);

    if (catQuotes.length) {
      const quotesWrap = document.createElement('div');
      quotesWrap.className = 'bk-quotes';
      catQuotes.slice(0, 2).forEach((q) => {
        const quoteTag = document.createElement('div');
        quoteTag.className = 'quote-tag';
        quoteTag.textContent = `"${q}"`;
        quotesWrap.appendChild(quoteTag);
      });
      item.appendChild(quotesWrap);
    }

    container.appendChild(item);
    setTimeout(() => {
      const bar = document.getElementById(`bar-${key}`);
      if (bar) bar.style.width = raw + '%';
    }, 150);
  });

  document.getElementById('analysis-text').textContent = data.analyse || '';
  resultsDiv.style.display = 'block';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(msg) {
  errorBox.textContent   = '⚠️ ' + msg;
  errorBox.style.display = 'block';
}

function handleResetClick() {
  resultsDiv.style.display = 'none';
  errorBox.style.display   = 'none';
  currentProfileData       = null;
  currentAnalysis          = null;
}

function handleCopyClick() {
  if (!currentAnalysis) return;
  const score   = Number.isFinite(Number(currentAnalysis.bullshitScore)) ? Number(currentAnalysis.bullshitScore) : 0;
  const verdict = scoreVerdict(score);
  const sub     = currentAnalysis.subScores || {};
  const report  = [
    '💩 BULLSHIT-O-METER — LinkedIn Analysis',
    '═'.repeat(44),
    `URL     : ${currentTab?.url || '—'}`,
    '',
    `SCORE   : ${score}% — ${verdict.emoji} ${verdict.text}`,
    '',
    `🎭 Corporate Jargon  : ${sub.jargon       || 0}%`,
    `🚀 Hype & Self-Promo : ${sub.hype         || 0}%`,
    `🤡 Inflated Title    : ${sub.titrepompeux || 0}%`,
    `📊 Real Substance    : ${sub.substance    || 0}%`,
    '',
    'Detected phrases:',
    ...(currentAnalysis.bsPhrases || []).map(p => `  • "${p}"`),
    '',
    'Verdict:',
    currentAnalysis.analyse || '—',
  ].join('\n');

  navigator.clipboard.writeText(report).then(() => {
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyBtn.textContent = '📋 Copy Report'; }, 2000);
  });
}

function setupEventListeners() {
  if (analyzeBtn) analyzeBtn.addEventListener('click', handleAnalyzeClick);
  if (resetBtn) resetBtn.addEventListener('click', handleResetClick);
  if (copyBtn) copyBtn.addEventListener('click', handleCopyClick);
}

function bootstrapPopup() {
  cacheDomRefs();
  setupEventListeners();
  init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapPopup, { once: true });
} else {
  bootstrapPopup();
}
