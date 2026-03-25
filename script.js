/* =============================================================
   AI Study Assistant — Shared JavaScript
   All logic: theme, LocalStorage helpers, text algorithms
   ============================================================= */

'use strict';

/* ─── Constants ─── */
const LS_KEYS = {
  INPUT:      'aistudy_input',
  SUMMARY:    'aistudy_summary',
  QUIZ:       'aistudy_quiz',
  FLASHCARDS: 'aistudy_flashcards',
  PLANNER:    'aistudy_planner',
  THEME:      'aistudy_theme',
};

const SAMPLE_TEXT = `Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy stored in glucose. This process occurs primarily in the chloroplasts, which contain a green pigment called chlorophyll. Chlorophyll absorbs sunlight, which drives the conversion of carbon dioxide and water into glucose and oxygen. The overall equation for photosynthesis is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂.

There are two main stages of photosynthesis: the light-dependent reactions and the light-independent reactions, also known as the Calvin cycle. The light-dependent reactions occur in the thylakoid membranes and produce ATP and NADPH. The Calvin cycle takes place in the stroma of the chloroplast and uses ATP and NADPH to fix carbon dioxide into glucose.

Factors that affect the rate of photosynthesis include light intensity, carbon dioxide concentration, temperature, and water availability. Photosynthesis is fundamental to life on Earth because it produces the oxygen we breathe and is the primary source of the organic compounds that form the base of most food chains.`;

/* ─── LocalStorage Helpers ─── */
const LS = {
  get(key)       { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, val)  { localStorage.setItem(key, JSON.stringify(val)); },
  remove(key)    { localStorage.removeItem(key); },
  clear()        { Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k)); },
};

/* ─── Theme Manager ─── */
const Theme = {
  init() {
    const saved = LS.get(LS_KEYS.THEME) || 'light';
    this.apply(saved);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => this.toggle());
  },
  apply(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    const icon  = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if (icon)  icon.textContent  = mode === 'dark' ? '☀️' : '🌙';
    if (label) label.textContent = mode === 'dark' ? 'Light' : 'Dark';
    LS.set(LS_KEYS.THEME, mode);
  },
  toggle() {
    const cur = document.documentElement.getAttribute('data-theme');
    this.apply(cur === 'dark' ? 'light' : 'dark');
  },
};

/* ─── Toast Notifications ─── */
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ─── Loading Spinner ─── */
function showLoading(text = 'Processing…') {
  const overlay = document.getElementById('loadingOverlay');
  const txt     = document.getElementById('loadingText');
  if (overlay) { overlay.classList.add('active'); }
  if (txt)     { txt.textContent = text; }
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.remove('active');
}

/* ─── Word / Char Counter ─── */
function updateWordCount(text, elId = 'wordCount') {
  const el = document.getElementById(elId);
  if (!el) return;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  el.textContent = `${words.toLocaleString()} word${words !== 1 ? 's' : ''} · ${text.length.toLocaleString()} characters`;
}

/* ─── Navigation Active Link ─── */
function setActiveNav() {
  const path = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href').split('/').pop();
    a.classList.toggle('active', href === path || (path === '' && href === 'index.html'));
  });
}

/* ─── Hamburger Menu ─── */
function initHamburger() {
  const btn   = document.getElementById('hamburger');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;
  btn.addEventListener('click', () => links.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !links.contains(e.target))
      links.classList.remove('open');
  });
}

/* ─── TEXT PROCESSING ENGINE ─── */

/** Tokenize text into sentences */
function tokenizeSentences(text) {
  return text
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 20);
}

/** Tokenize text into words (cleaned) */
function tokenizeWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
}

/** Common stop words to ignore */
const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','shall',
  'to','of','in','for','on','with','at','by','from','as','it','its',
  'this','that','these','those','and','or','but','if','because','so',
  'not','no','nor','yet','than','then','when','where','which','who','whom',
  'what','how','all','any','both','each','few','more','most','other',
  'some','such','too','very','just','also','into','about','above','after',
  'before','between','through','during','i','we','you','he','she','they',
  'me','him','her','us','them','my','our','your','his','their','its',
]);

/** Build keyword frequency map from text */
function buildKeywordFrequency(text) {
  const words = tokenizeWords(text);
  const freq  = {};
  words.forEach(w => {
    if (!STOP_WORDS.has(w) && w.length > 3) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });
  return freq;
}

/** Score a sentence by its keyword density */
function scoreSentence(sentence, freqMap) {
  const words = tokenizeWords(sentence);
  if (!words.length) return 0;
  const score = words.reduce((acc, w) => acc + (freqMap[w] || 0), 0);
  // Normalize by sentence length (avoid bias toward longer sentences)
  return score / Math.sqrt(words.length);
}

/* ─── SUMMARIZER ─── */
function summarizeText(text, ratio = 0.35) {
  const sentences = tokenizeSentences(text);
  if (sentences.length === 0) return { summary: '', keywords: [], sentences: [] };
  if (sentences.length <= 3) return { summary: text, keywords: getTopKeywords(text, 8), sentences };

  const freqMap  = buildKeywordFrequency(text);
  const topCount = Math.max(2, Math.round(sentences.length * ratio));

  // Score and rank sentences, but keep their original position for readability
  const scored = sentences.map((s, i) => ({ s, i, score: scoreSentence(s, freqMap) }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top    = sorted.slice(0, topCount);
  // Re-sort by original index to maintain reading order
  top.sort((a, b) => a.i - b.i);

  const summary  = top.map(t => t.s).join(' ');
  const keywords = getTopKeywords(text, 8);
  return { summary, keywords, sentences: top.map(t => t.s) };
}

function getTopKeywords(text, n = 8) {
  const freq = buildKeywordFrequency(text);
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

/** Highlight keywords inside summary HTML */
function highlightKeywords(text, keywords) {
  if (!keywords.length) return text;
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex   = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  return text.replace(regex, '<mark class="keyword">$1</mark>');
}

/* ─── QUIZ GENERATOR ─── */
function generateQuiz(text) {
  const sentences = tokenizeSentences(text);
  const freqMap   = buildKeywordFrequency(text);
  const questions = [];

  sentences.forEach(sentence => {
    const q = sentenceToQuestion(sentence, freqMap);
    if (q) questions.push(q);
  });

  // Deduplicate and cap
  const unique = questions.filter((q, i, arr) =>
    arr.findIndex(x => x.question === q.question) === i
  );
  return unique.slice(0, 15);
}

function sentenceToQuestion(sentence, freqMap) {
  const s = sentence.trim();

  // Pattern 1: "X is Y" → "What is X?"
  let m = s.match(/^(.+?)\s+(?:is|are|was|were)\s+(?:a|an|the)?\s*(.+)$/i);
  if (m) {
    const subject = m[1].trim();
    const obj     = m[2].trim().replace(/[.!?]$/, '');
    if (subject.split(' ').length <= 6) {
      return {
        question: `What ${s.match(/\bare\b/i) ? 'are' : 'is'} ${subject}?`,
        answer: capFirst(obj),
        sentence: s,
      };
    }
  }

  // Pattern 2: "X contains/consists/includes Y"
  m = s.match(/^(.+?)\s+(contains?|consists? of|includes?|involves?)\s+(.+)$/i);
  if (m) {
    const subj = m[1].trim();
    const verb = m[2].trim();
    const obj  = m[3].trim().replace(/[.!?]$/, '');
    if (subj.split(' ').length <= 5) {
      return {
        question: `What does ${subj} ${verb}?`,
        answer: capFirst(obj),
        sentence: s,
      };
    }
  }

  // Pattern 3: "X occurs/happens/takes place in Y"
  m = s.match(/^(.+?)\s+(occurs?|happens?|takes? place)\s+(.+)$/i);
  if (m) {
    const subj = m[1].trim();
    const where = m[3].trim().replace(/[.!?]$/, '');
    if (subj.split(' ').length <= 6) {
      return {
        question: `Where does ${subj} ${m[2].toLowerCase()}?`,
        answer: capFirst(where),
        sentence: s,
      };
    }
  }

  // Pattern 4: "X produces/creates/generates Y"
  m = s.match(/^(.+?)\s+(produces?|creates?|generates?|make[s]?)\s+(.+)$/i);
  if (m) {
    const subj = m[1].trim();
    const obj  = m[3].trim().replace(/[.!?]$/, '');
    if (subj.split(' ').length <= 6) {
      return {
        question: `What does ${subj} produce?`,
        answer: capFirst(obj),
        sentence: s,
      };
    }
  }

  // Pattern 5: Sentence with top-frequency keyword — "What is [keyword] related to?"
  const words = tokenizeWords(s);
  const topW  = words.filter(w => !STOP_WORDS.has(w) && w.length > 4)
                     .sort((a, b) => (freqMap[b] || 0) - (freqMap[a] || 0));
  if (topW.length > 0) {
    return {
      question: `What is "${topW[0]}" in this context?`,
      answer: capFirst(s.replace(/[.!?]$/, '')),
      sentence: s,
    };
  }

  return null;
}

/* ─── MCQ OPTION GENERATOR ─── */
/**
 * Attaches 4 shuffled multiple-choice options to each quiz question.
 * Strategy:
 *  1. Pool all other questions' answers as distractor candidates.
 *  2. Supplement with short noun-phrases extracted from the source text.
 *  3. Pick 3 unique distractors (different from the correct answer).
 *  4. Shuffle correct + distractors and tag the correct one.
 */
function generateMCQOptions(questions, sourceText) {
  // Build a pool of distractor phrases from other answers
  const answerPool = questions.map(q => q.answer);

  // Also extract short noun phrases from the source text as fallback distractors
  const nounPhrases = extractNounPhrases(sourceText);

  return questions.map((q, idx) => {
    const correct = q.answer;

    // Candidate distractors: other answers + noun phrases, excluding the correct answer
    const candidates = [
      ...answerPool.filter((_, i) => i !== idx),
      ...nounPhrases,
    ].filter(c => {
      // Must be different from the correct answer (case-insensitive, trimmed)
      return c.trim().toLowerCase() !== correct.trim().toLowerCase() && c.trim().length > 0;
    });

    // Deduplicate candidates
    const seen = new Set();
    const unique = [];
    for (const c of candidates) {
      const key = c.trim().toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(c.trim()); }
    }

    // Pick up to 3 distractors; if not enough, pad with generic ones
    const distractors = unique.slice(0, 3);
    while (distractors.length < 3) {
      distractors.push(genericDistractor(correct, distractors.length));
    }

    // Combine and shuffle
    const options = [
      { text: capFirst(correct), isCorrect: true },
      ...distractors.slice(0, 3).map(d => ({ text: capFirst(d), isCorrect: false })),
    ];
    shuffleArray(options);

    return { ...q, options };
  });
}

/** Extract short (2-5 word) noun-like phrases from the text */
function extractNounPhrases(text) {
  const sentences = tokenizeSentences(text);
  const phrases   = [];

  sentences.forEach(s => {
    // Grab phrases after: "is a/an", "called", "known as", "such as", "like"
    const patterns = [
      /(?:is|are|was|were)\s+(?:a|an|the)?\s*([A-Z][^,.!?]{3,40})/g,
      /(?:called|known as|termed)\s+([A-Z][^,.!?]{3,35})/gi,
      /(?:such as|like|including)\s+([^,.!?]{4,35})/gi,
    ];
    patterns.forEach(rx => {
      let m;
      while ((m = rx.exec(s)) !== null) {
        const phrase = m[1].trim().replace(/[.!?]$/, '');
        if (phrase.split(' ').length <= 8) phrases.push(phrase);
      }
    });

    // Also take the last clause after a comma as a short answer candidate
    const parts = s.split(',');
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].trim().replace(/[.!?]$/, '');
      if (last.split(' ').length >= 2 && last.split(' ').length <= 7) phrases.push(last);
    }
  });

  return [...new Set(phrases)]; // deduplicate
}

/** Generic placeholder distractors as last resort */
function genericDistractor(correct, index) {
  const generics = [
    'None of the above',
    'All of the above',
    'Cannot be determined',
  ];
  return generics[index] || `Option ${index + 1}`;
}

/** Fisher-Yates shuffle (in-place) */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ─── FLASHCARD GENERATOR ─── */
function generateFlashcards(text) {
  const quiz = generateQuiz(text);
  return quiz.map(q => ({ front: q.question, back: q.answer, source: q.sentence }));
}

/* ─── STUDY PLANNER ─── */
function generateStudyPlan(topicsText, days) {
  const topics = topicsText
    .split(/[\n,;]+/)
    .map(t => t.trim())
    .filter(Boolean);

  if (!topics.length || days < 1) return [];

  const plan  = [];
  const perDay = Math.ceil(topics.length / days);

  for (let d = 0; d < days; d++) {
    const start  = d * perDay;
    const end    = Math.min(start + perDay, topics.length);
    const slice  = topics.slice(start, end);
    if (slice.length > 0) {
      plan.push({ day: d + 1, topics: slice });
    }
  }

  // If there are more days than topics, add review days
  if (plan.length < days) {
    const reviewTopics = [...topics];
    for (let d = plan.length; d < days; d++) {
      const reviewSlice = reviewTopics.slice(0, Math.max(1, Math.ceil(reviewTopics.length / 2)));
      plan.push({ day: d + 1, topics: reviewSlice.map(t => `Review: ${t}`), isReview: true });
    }
  }

  return plan;
}

/* ─── Utility: capitalize first letter ─── */
function capFirst(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

/* ─── Copy to Clipboard ─── */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ Copied to clipboard!', 'success');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ Copied!', 'success');
  }
}

/* ══════════════════════════════════════
   HOME PAGE LOGIC
   ══════════════════════════════════════ */
function initHomePage() {
  const textarea = document.getElementById('mainTextInput');
  if (!textarea) return;

  // Restore saved input
  const saved = LS.get(LS_KEYS.INPUT);
  if (saved) {
    textarea.value = saved;
    updateWordCount(saved);
  }

  textarea.addEventListener('input', () => {
    updateWordCount(textarea.value);
    LS.set(LS_KEYS.INPUT, textarea.value);
  });

  document.getElementById('saveInputBtn')?.addEventListener('click', () => {
    const text = textarea.value.trim();
    if (!text) { showToast('⚠️ Please enter some text first!', 'error'); return; }
    LS.set(LS_KEYS.INPUT, text);
    showToast('✅ Text saved! Choose a tool below or in the nav.', 'success', 4000);
    // Scroll to feature cards
    document.querySelector('.features-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('clearBtn')?.addEventListener('click', () => {
    if (!confirm('Clear all saved data? This cannot be undone.')) return;
    LS.clear();
    textarea.value = '';
    updateWordCount('');
    showToast('🗑️ All data cleared', 'info');
  });

  document.getElementById('copyBtn')?.addEventListener('click', () => {
    const text = textarea.value;
    if (!text.trim()) { showToast('⚠️ Nothing to copy', 'error'); return; }
    copyToClipboard(text);
  });

  document.getElementById('sampleBtn')?.addEventListener('click', () => {
    textarea.value = SAMPLE_TEXT;
    LS.set(LS_KEYS.INPUT, SAMPLE_TEXT);
    updateWordCount(SAMPLE_TEXT);
    showToast('✨ Sample text loaded!', 'success');
  });
}

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  setActiveNav();
  initHamburger();
  initHomePage();
});
