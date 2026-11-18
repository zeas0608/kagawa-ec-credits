import { loadState, saveState, resetState } from './model.js';

export const COURSE_SECTIONS_KEY = 'kagawa-kosen-ec-credit-course-sections';
export const CERT_SECTIONS_KEY = 'kagawa-kosen-ec-credit-cert-sections';

const NAV = [
  { id: 'dashboard', href: './index.html', label: 'ダッシュボード', icon: 'dashboard' },
  { id: 'courses', href: './courses.html', label: '科目管理', icon: 'book' },
  { id: 'certifications', href: './certifications.html', label: '資格認定', icon: 'award' },
];

const ICON_PATHS = {
  graduation: '<path d="M2 10 12 5l10 5-10 5-10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5m4-2v6"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  book: '<path d="M12 6v15M3 4h4a5 5 0 0 1 5 5 5 5 0 0 1 5-5h4v14h-4a5 5 0 0 0-5 3 5 5 0 0 0-5-3H3Z"/>',
  award: '<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  trend: '<path d="m3 17 6-6 4 4 7-8m-5 0h5v5"/>',
  flag: '<path d="M5 21V4m0 1c6-5 9 4 15-1v10c-6 5-9-4-15 1"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5m-18 4 9 5 9-5"/>',
  reset: '<path d="M3 12a9 9 0 1 1 2.7 6.4M3 5v7h7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};

const escapedCharacters = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
let memoryState;
const memorySections = new Map();

export function icon(name, size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] ?? ''}</svg>`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => escapedCharacters[character]);
}

export function categoryLabel(category) {
  return category === 'general' ? '一般' : '専門';
}

export function matchesSearch(text, query) {
  const normalize = (value) => String(value).normalize('NFKC').toLowerCase();
  const haystack = normalize(text);
  return normalize(query).trim().split(/\s+/).every((word) => haystack.includes(word));
}

export function getOpenSections(key) {
  if (memorySections.has(key)) return new Set(memorySections.get(key));
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(saved)) return new Set(saved.filter((id) => typeof id === 'string'));
  } catch {
    return new Set();
  }
  return new Set();
}

export function saveOpenSections(key, sections) {
  try {
    localStorage.setItem(key, JSON.stringify([...sections]));
    memorySections.delete(key);
  } catch {
    memorySections.set(key, new Set(sections));
  }
}

function showStorageError(message) {
  const notice = document.querySelector('#storage-notice');
  if (notice) {
    notice.textContent = message;
    notice.hidden = false;
  }
}

export function getState() {
  return memoryState ?? loadState();
}

export function updateState(mutator) {
  const state = getState();
  const next = mutator(state) ?? state;
  try {
    if (saveState(next) === false) throw new Error('Storage unavailable');
    memoryState = undefined;
    const notice = document.querySelector('#storage-notice');
    if (notice) notice.hidden = true;
  } catch {
    memoryState = next;
    showStorageError('このブラウザに保存できませんでした。画面を移動すると変更が失われる場合があります。');
  }
  return next;
}

export function mountShell(active) {
  document.querySelector('#site-header').innerHTML = `
    <a class="skip-link" href="#main-content">本文へ移動</a>
    <header class="site-header">
      <div class="container header-inner">
        <a href="./index.html" class="brand">
          <span class="brand-mark">${icon('graduation', 25)}</span>
          <span><strong>EC 単位管理</strong><small>香川高等専門学校</small></span>
        </a>
        <nav class="primary-nav" aria-label="メインメニュー">
          ${NAV.map((item) => `<a href="${item.href}"${active === item.id ? ' aria-current="page"' : ''}>${icon(item.icon, 17)}<span>${item.label}</span></a>`).join('')}
        </nav>
      </div>
    </header>
    <div class="container"><p class="note storage-notice" id="storage-notice" role="alert" hidden></p></div>`;
  document.querySelector('#site-footer').innerHTML = `
    <footer class="site-footer">
      <div class="container footer-inner">
        <p>${icon('lock', 15)} 入力内容はこのブラウザに自動保存されます。</p>
        <button class="quiet-button" id="reset-data" type="button">${icon('reset', 16)} データを初期化</button>
      </div>
    </footer>`;
  document.querySelector('#reset-data').addEventListener('click', () => {
    if (!window.confirm('科目の取得状況・認定単位と、項目の開閉状態を初期化しますか？')) return;
    try {
      if (!resetState()) throw new Error('Storage unavailable');
      localStorage.removeItem(COURSE_SECTIONS_KEY);
      localStorage.removeItem(CERT_SECTIONS_KEY);
      window.location.reload();
    } catch {
      showStorageError('保存データを初期化できませんでした。ブラウザの保存設定をご確認ください。');
    }
  });
  for (const element of document.querySelectorAll('[data-icon]')) {
    element.innerHTML = icon(element.dataset.icon, 18);
  }
}
