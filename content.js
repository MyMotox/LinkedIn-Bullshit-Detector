// Compatibilité Firefox/Chrome
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// content.js — Injecté sur linkedin.com/in/*

function isLinkedInUiLine(line) {
  const t = (line || '').trim().toLowerCase();
  if (!t) return true;

  const patterns = [
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
    /^view full profile$/,
    /^linkedin$/,
    /^people also viewed$/,
    /^\d+\+?\s+(followers?|connections?)$/,
    /^talks about/,
    /^mutual connections?$/,
  ];

  return patterns.some(re => re.test(t));
}

function sanitizeTextBlock(text, maxLen = 1000) {
  if (!text) return '';

  const unique = [];
  const seen = new Set();

  text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line && line.length > 2)
    .forEach((line) => {
      if (isLinkedInUiLine(line)) return;
      const key = line.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(line);
    });

  return unique.join('\n').substring(0, maxLen);
}

function scrapeProfile() {
  const data = {};

  // ── Approche robuste : sélecteurs multiples avec fallbacks ────────────

  // NOM — plusieurs sélecteurs possibles selon version LinkedIn
  const nameSelectors = [
    'h1.text-heading-xlarge',
    'h1.inline.t-24',
    '.pv-text-details__left-panel h1',
    'h1'
  ];
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel);
    if (el?.innerText?.trim()) {
      const clean = sanitizeTextBlock(el.innerText, 120);
      if (clean) {
        data.name = clean;
        break;
      }
    }
  }

  // HEADLINE
  const headlineSelectors = [
    '.text-body-medium.break-words',
    '.pv-text-details__left-panel .text-body-medium',
    '[data-generated-suggestion-target]',
    '.ph5 .mt2 .text-body-medium'
  ];
  for (const sel of headlineSelectors) {
    const el = document.querySelector(sel);
    if (el?.innerText?.trim()) {
      const clean = sanitizeTextBlock(el.innerText, 220);
      if (clean) {
        data.headline = clean;
        break;
      }
    }
  }

  // LOCALISATION
  const locSelectors = [
    '.text-body-small.inline.t-black--light.break-words',
    '.pv-text-details__left-panel span.text-body-small',
    '.ph5 span.text-body-small'
  ];
  for (const sel of locSelectors) {
    const el = document.querySelector(sel);
    if (el?.innerText?.trim()) {
      const clean = sanitizeTextBlock(el.innerText, 120);
      if (clean) {
        data.location = clean;
        break;
      }
    }
  }

  // ── Scrape générique par sections ────────────────────────────────────
  // LinkedIn change souvent ses classes — on travaille sur le texte brut des sections
  const allSections = document.querySelectorAll('section.artdeco-card, section[data-view-name], div[data-view-name="profile-card"]');

  data.about = '';
  data.experiences = [];
  data.education = [];
  data.skills = [];

  allSections.forEach(section => {
    const heading = section.querySelector('h2, h3')?.innerText?.toLowerCase().trim() || '';
    const fullText = section.innerText || '';

    if (!data.about && (heading.includes('info') || heading.includes('about') || heading.includes('synthèse') || heading.includes('résumé'))) {
      const cleanedAbout = sanitizeTextBlock(fullText.replace(heading, ''), 1000);
      if (cleanedAbout) data.about = cleanedAbout;
    }

    if (heading.includes('expérience') || heading.includes('experience')) {
      // Extrait les items de liste ou blocs répétés
      const items = section.querySelectorAll('li, .pvs-list__item--line-separated');
      if (items.length) {
        items.forEach(item => {
          const text = sanitizeTextBlock(item.innerText, 300);
          if (text && text.length > 8) {
            data.experiences.push(text);
          }
        });
      } else {
        const fallbackExp = sanitizeTextBlock(fullText, 500);
        if (fallbackExp) data.experiences.push(fallbackExp);
      }
    }

    if (heading.includes('formation') || heading.includes('education') || heading.includes('études')) {
      const items = section.querySelectorAll('li, .pvs-list__item--line-separated');
      items.forEach(item => {
        const text = sanitizeTextBlock(item.innerText, 200);
        if (text) data.education.push(text);
      });
    }

    if (heading.includes('compétence') || heading.includes('skill')) {
      const items = section.querySelectorAll('li, .pvs-list__item--line-separated');
      items.forEach(item => {
        const text = sanitizeTextBlock(item.innerText?.split('\n')[0], 80);
        if (text && text.length < 60) data.skills.push(text);
      });
    }
  });

  // ── Fallback : si les sections n'ont rien donné, scrape tout le texte ──
  // Très utile pour les nouvelles versions du DOM LinkedIn
  if (!data.name) {
    // Dernier recours — premier h1 de la page
    data.name = sanitizeTextBlock(document.querySelector('h1')?.innerText || '', 120) || 'Inconnu';
  }

  if (!data.headline && !data.about) {
    // Scrape le bloc principal de texte du profil
    const mainContent = document.querySelector('main') || document.body;
    const rawText = mainContent.innerText || '';
    // Prend les 2000 premiers caractères comme contexte général
    data.rawText = sanitizeTextBlock(rawText, 2000);
  }

  // ── Posts récents visibles sur la page ───────────────────────────────
  data.posts = [];
  const postSelectors = [
    '.feed-shared-update-v2__description',
    '.break-words.tvm-parent-container',
    '[data-view-name="profile-component-entity"] span[aria-hidden="true"]'
  ];
  postSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const text = sanitizeTextBlock(el.innerText, 500);
      if (text && text.length > 30 && !data.posts.includes(text)) {
        data.posts.push(text);
      }
    });
  });

  data.experiences = [...new Set(data.experiences)].slice(0, 12);
  data.education = [...new Set(data.education)].slice(0, 8);
  data.skills = [...new Set(data.skills)].slice(0, 30);
  data.posts = [...new Set(data.posts)].slice(0, 6);

  data.profileUrl = window.location.href;

  return data;
}

// Écoute les messages du popup
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeProfile') {
    try {
      const profileData = scrapeProfile();
      sendResponse({ success: true, data: profileData });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }
  if (request.action === 'ping') {
    sendResponse({ alive: true });
    return true;
  }
});
