const { timingSafeEqual } = require('crypto');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const BASE_DAILY_LIMIT = 10;
const ELEVATED_DAILY_LIMIT = 50;
const usageByDayAndClient = new Map();

const SYSTEM_PROMPT = `You are a deterministic LinkedIn bullshit analyzer.
Given the same profile, you ALWAYS return the same scores.
You respond ONLY with valid JSON - no markdown, no backticks, no explanation.`;

function buildUserPrompt(profileText) {
  return `Analyze this LinkedIn profile for corporate bullshit. Be consistent and objective.

DATA SCOPE (MANDATORY):
- Analyze ALL user-authored content available in PROFILE: headline, about, experiences, education, skills, and posts.
- Do NOT ignore posts or experiences.
- Ignore LinkedIn interface/system/social-graph text.

PROFILE:
${profileText}

Score each dimension based ONLY on what is written above. Use these strict criteria:

JARGON (0-100): Count occurrences of empty buzzwords: "leverage", "synergy", "disruptive", "innovative", "passionate", "ecosystem", "scalable", "agile", "pivot", "holistic", "dynamic", "proactive", "value-add", "thought leader", "guru", "ninja", "rockstar", "evangelist". 0=none found, 50=several found, 100=profile is mostly buzzwords.

HYPE (0-100): Measure unverifiable superlatives and self-praise: "world-class", "top X%", "serial entrepreneur", "visionary", "game-changer", "best-in-class", "award-winning" without proof, "10x", "revolutionized". 0=humble and factual, 100=delusional self-promotion.

TITREPOMPEUX (0-100): Rate the job title inflation. Standard titles (Engineer, Manager, Analyst) = 0-20. Inflated but common (Senior Director, VP) = 20-50. Pompous invented titles (Chief Evangelist, Head of Vibes, Growth Hacker, Ninja) = 70-100.

SUBSTANCE (0-100): Measure concrete facts: specific numbers, measurable results, named companies, dates, real deliverables. 0=zero concrete facts, 100=full of specific metrics and achievements.

BULLSHITSCORE: exact arithmetic mean of the 4 criteria:
bullshitScore = round(((jargon + hype + titrepompeux + substance) / 4) * 10) / 10

QUOTE RULES (STRICT):
- Every quote MUST be copied exactly from PROFILE text above.
- NEVER use LinkedIn UI/navigation/system/social-graph text (examples: "About", "Experience", "Connect", "Follow", "Message", "See more", "Open to work", "followers", "connections", "People also viewed", "Cette personne et vous avez étudié", "Personnes que vous connaissez", "Relations en commun", "1st/2nd degree connection").
- If no valid quote exists for a category, return an empty array for that category.

VALIDATION BEFORE FINAL ANSWER:
- Reject any quote if it looks like LinkedIn UI/system/social text.
- Reject any quote not present verbatim in PROFILE.
- Ensure categoryDetails and analyse do not mention LinkedIn system suggestions.

Return ONLY this JSON:
{
  "bullshitScore": <number 0-100>,
  "subScores": {
    "jargon": <integer 0-100>,
    "hype": <integer 0-100>,
    "titrepompeux": <integer 0-100>,
    "substance": <integer 0-100>
  },
  "bsPhrases": [<6-10 exact verbatim quotes from the profile text above>],
  "categoryQuotes": {
    "jargon": [<1-3 exact verbatim quotes that are jargon>],
    "hype": [<1-3 exact verbatim quotes that are hype>],
    "titrepompeux": [<their exact job title as written>],
    "substance": [<1-2 exact quotes showing the most concrete fact, or the most empty claim if no facts exist>]
  },
  "categoryDetails": {
    "jargon": "<1 sentence specific to this profile>",
    "hype": "<1 sentence specific to this profile>",
    "titrepompeux": "<1 sentence about their title>",
    "substance": "<1 sentence about real vs empty content>"
  },
  "analyse": "<3 sentences: witty, specific, fair verdict about THIS person in English>"
}`;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function getUtcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getClientId(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown-client';
}

function safeEquals(a, b) {
  const aBuf = Buffer.from(a || '', 'utf8');
  const bBuf = Buffer.from(b || '', 'utf8');
  if (aBuf.length !== bBuf.length || aBuf.length === 0) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function cleanupUsage(currentDay) {
  for (const key of usageByDayAndClient.keys()) {
    if (!key.startsWith(`${currentDay}:`)) {
      usageByDayAndClient.delete(key);
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'Missing OPENAI_API_KEY on server' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const profileText = String(body.profileText || '').trim();
    const providedPassword = String(body.limitPassword || '').trim();
    const adminPassword = String(process.env.ADMIN_LIMIT_PASSWORD || '').trim();

    if (!profileText || profileText.length < 20) {
      return sendJson(res, 400, { error: 'profileText is required and must contain enough data' });
    }

    if (profileText.length > 12000) {
      return sendJson(res, 400, { error: 'profileText is too large' });
    }

    const hasAdminPassword = adminPassword.length > 0;
    const isElevated = hasAdminPassword && safeEquals(providedPassword, adminPassword);
    const limit = isElevated ? ELEVATED_DAILY_LIMIT : BASE_DAILY_LIMIT;

    const day = getUtcDayKey();
    const clientId = getClientId(req);
    cleanupUsage(day);

    const usageKey = `${day}:${clientId}`;
    const usedToday = usageByDayAndClient.get(usageKey) || 0;

    if (usedToday >= limit) {
      return sendJson(res, 429, {
        error: `Daily limit reached (${limit}/day).`,
        canUpgrade: hasAdminPassword && !isElevated,
        usedToday,
        dailyLimit: limit,
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        seed: 42,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(profileText) },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = err?.error?.message || `OpenAI HTTP ${response.status}`;
      return sendJson(res, 502, { error: message });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || '';

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (_e) {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return sendJson(res, 502, { error: 'Invalid JSON returned by model' });
      analysis = JSON.parse(match[0]);
    }

    usageByDayAndClient.set(usageKey, usedToday + 1);

    return sendJson(res, 200, {
      ...analysis,
      usage: {
        usedToday: usedToday + 1,
        dailyLimit: limit,
      },
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
};
