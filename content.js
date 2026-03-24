const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

function isLinkedInUiLine(line) {
  const t = (line || '').trim().toLowerCase();
  if (!t) return true;

  const patterns = [
    /^accueil$/,
    /^réseau$/,
    /^emploi$/,
    /^messagerie$/,
    /^notifications?$/,
    /^about$/,
    /^infos?$/,
    /^experience$/,
    /^expériences?$/,
    /^education$/,
    /^formation$/,
    /^skills?$/,
    /^compétences?$/,
    /^activity$/,
    /^activité$/,
    /^interests?$/,
    /^open to work$/,
    /^en recherche de travail$/,
    /^prestataire de services?$/,
    /^connect$/,
    /^se connecter$/,
    /^follow$/,
    /^suivre$/,
    /^message$/,
    /^envoyer un message$/,
    /^see more$/,
    /^voir plus$/,
    /^show all$/,
    /^tout afficher$/,
    /^view full profile$/,
    /^voir (le )?profil$/,
    /^signaler ce profil$/,
    /^partager (le )?profil$/,
    /^linkedin$/,
    /^people also viewed$/,
    /^personnes également consultées$/,
    /^cette personne et vous avez étudié/,
    /^cette personne et vous/,
    /^vous connaissez peut-?être/,
    /^personnes que vous connaissez/,
    /^relation de \d(er|e) niveau/,
    /^\d(st|nd|rd|th) degree connection/,
    /^\d+\+?\s+(followers?|connections?)$/,
    /^\d+\+?\s+(abonnés?|relations?)$/,
    /^\d+\s+relations?$/,
    /^\d+\s+abonnés?$/,
    /^talks about/,
    /^parle de/,
    /^mutual connections?$/,
    /^relations en commun$/,
    /^j['’]?aime$/,
    /^commenter$/,
    /^reposter$/,
    /^republi(er|é)$/,
    /^post de/,
    /^voir la traduction$/,
    /^traduire$/,
    /^voir les \d+ commentaires$/,
    /^\d+ commentaires?$/,
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

function pickMeaningfulLines(text, minLineLength = 10, maxLen = 600) {
  const cleaned = sanitizeTextBlock(text, maxLen * 2);
  if (!cleaned) return '';
  const lines = cleaned
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length >= minLineLength);
  return lines.join('\n').substring(0, maxLen);
}

function scrapeProfile() {
  const data = {};

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

  const allSections = document.querySelectorAll('section.artdeco-card, section[data-view-name], div[data-view-name="profile-card"]');

  data.about = '';
  data.experiences = [];
  data.education = [];
  data.skills = [];
  data.posts = [];

  allSections.forEach(section => {
    const heading = section.querySelector('h2, h3')?.innerText?.toLowerCase().trim() || '';
    const fullText = section.innerText || '';

    if (!data.about && (heading.includes('info') || heading.includes('about') || heading.includes('synthèse') || heading.includes('résumé'))) {
      const cleanedAbout = sanitizeTextBlock(fullText.replace(heading, ''), 1000);
      if (cleanedAbout) data.about = cleanedAbout;
    }

    if (heading.includes('expérience') || heading.includes('experience')) {
      const items = section.querySelectorAll('li, .pvs-list__item--line-separated');
      if (items.length) {
        items.forEach(item => {
          const text = pickMeaningfulLines(item.innerText, 10, 380);
          if (text && text.length > 8) {
            data.experiences.push(text);
          }
        });
      } else {
        const fallbackExp = pickMeaningfulLines(fullText, 10, 550);
        if (fallbackExp) data.experiences.push(fallbackExp);
      }
    }

    if (heading.includes('formation') || heading.includes('education') || heading.includes('études')) {
      const items = section.querySelectorAll('li, .pvs-list__item--line-separated');
      items.forEach(item => {
        const text = pickMeaningfulLines(item.innerText, 8, 220);
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

    if (heading.includes('activité') || heading.includes('activity') || heading.includes('posts') || heading.includes('publications')) {
      const items = section.querySelectorAll('li, article, .feed-shared-update-v2, .occludable-update');
      if (items.length) {
        items.forEach(item => {
          const postText = pickMeaningfulLines(item.innerText, 20, 700);
          if (postText && postText.length > 40) data.posts.push(postText);
        });
      } else {
        const fallbackPosts = pickMeaningfulLines(fullText, 20, 700);
        if (fallbackPosts && fallbackPosts.length > 40) data.posts.push(fallbackPosts);
      }
    }
  });

  if (!data.name) {
    data.name = sanitizeTextBlock(document.querySelector('h1')?.innerText || '', 120) || 'Inconnu';
  }

  if (!data.headline && !data.about) {
    const mainContent = document.querySelector('main') || document.body;
    const rawText = mainContent.innerText || '';
    data.rawText = sanitizeTextBlock(rawText, 2000);
  }

  const legacyPosts = [];
  const postSelectors = [
    '.feed-shared-update-v2__description',
    '.break-words.tvm-parent-container',
    '[data-view-name="profile-component-entity"] span[aria-hidden="true"]'
  ];
  postSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      const text = pickMeaningfulLines(el.innerText, 20, 700);
      if (text && text.length > 30 && !legacyPosts.includes(text)) {
        legacyPosts.push(text);
      }
    });
  });

  data.posts = [...data.posts, ...legacyPosts];

  data.experiences = [...new Set(data.experiences)].slice(0, 16);
  data.education = [...new Set(data.education)].slice(0, 8);
  data.skills = [...new Set(data.skills)].slice(0, 30);
  data.posts = [...new Set(data.posts)].slice(0, 12);

  data.profileUrl = window.location.href;

  return data;
}

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
