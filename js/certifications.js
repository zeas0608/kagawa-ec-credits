import { CERTIFICATION_GROUPS, getToeicOption, TOEIC_GROUP_ID } from './cert-data.js';
import {
  CERT_SECTIONS_KEY, categoryLabel, escapeHtml, getOpenSections, getState, icon, matchesSearch, mountShell,
  saveOpenSections, updateState,
} from './common.js';
import {
  calculateCredits,
  EXTERNAL_CREDIT_SLOTS,
  isExternalCreditNameDuplicate,
  removeExternalCredit,
  setCertificationStatus,
  setToeic,
  STORAGE_KEY,
  updateExternalCredit,
} from './model.js';

const statuses = [
  ['unearned', '未取得'],
  ['passed', '合格済み・学校未認定'],
  ['recognized', '学校認定済み'],
];
const searchAliases = {
  実用英語技能検定: '英検',
  日本漢字能力検定: '漢検',
  実用数学技能検定: '数検',
};
const search = document.querySelector('#cert-search');
const category = document.querySelector('#cert-category');
const certList = document.querySelector('#cert-list');
const externalList = document.querySelector('#external-list');

function statusSelect(label, status, attributes = '') {
  const options = statuses.map(([value, text]) => (
    `<option value="${value}"${status === value ? ' selected' : ''}>${text}</option>`
  ));
  return `<select aria-label="${escapeHtml(label)}" data-status="${status}" ${attributes}>${options.join('')}</select>`;
}

function isToeic(option) {
  return Number.isInteger(option.minScore);
}

function matchesOption(option, query) {
  const normalizedQuery = query.normalize('NFKC').trim();
  if (isToeic(option) && /^\d{3}(?:\s*点)?$/.test(normalizedQuery)) {
    return getToeicOption(Number.parseInt(normalizedQuery, 10))?.id === option.id;
  }
  return matchesSearch(`${option.name} ${searchAliases[option.name] ?? ''} ${option.condition ?? ''}`, query);
}

function renderOption(option, state) {
  const status = state.certifications[option.id] ?? 'unearned';
  const condition = option.condition === 'なし' ? '' : option.condition;
  const optionLabel = [option.name, condition].filter(Boolean).join(' ');
  const control = isToeic(option) && status === 'unearned'
    ? '<span class="cert-unearned">未取得</span>'
    : statusSelect(`${optionLabel}の取得状況`, status, `data-cert-option="${escapeHtml(option.id)}"`);

  return `
    <li class="subject-row cert-option" data-status="${status}">
      <div class="subject-main">
        <span class="cert-option-name">${escapeHtml(option.name)}</span>
        ${condition ? `<span class="muted cert-condition">${escapeHtml(condition)}</span>` : ''}
      </div>
      <div class="subject-actions cert-option-actions">
        <span class="cert-option-credits">${escapeHtml(option.credits)} 単位</span>
        ${control}
      </div>
    </li>`;
}

function renderToeic({ score, online }) {
  return `
    <div class="cert-toeic">
      <h3>TOEIC Listening &amp; Reading Test の点数で判定</h3>
      <div class="cert-toeic-fields">
        <label class="field" for="toeic-score">
          <span>点数</span>
          <input id="toeic-score" type="number" min="10" max="990" step="1" inputmode="numeric"
            value="${escapeHtml(score ?? '')}" placeholder="例：450" aria-describedby="toeic-result-text">
        </label>
        <label class="field" for="toeic-type">
          <span>テストの種類</span>
          <select id="toeic-type">
            <option value="eligible" ${online ? '' : 'selected'}>公開テスト／IPテスト（マークシート方式）</option>
            <option value="online" ${online ? 'selected' : ''}>IPテスト（オンライン）</option>
          </select>
        </label>
      </div>
      <div class="cert-toeic-result">
        <p class="muted" id="toeic-result-text" aria-live="polite"></p>
        <div id="toeic-result-control"></div>
      </div>
    </div>`;
}

function renderGroup(group, options, state, totals, expanded) {
  return `
    <details class="subject-group cert-group" data-cert-group="${escapeHtml(group.id)}" ${expanded ? 'open' : ''}>
      <summary class="cert-group-summary">
        <span class="cert-group-heading">
          <span class="tag ${escapeHtml(group.category)}">${categoryLabel(group.category)}</span>
          <span class="cert-group-name">${escapeHtml(group.name)}</span>
        </span>
        <span class="cert-count cert-group-total">${totals.certification.groups[group.id] ?? 0} 単位</span>
        <span class="cert-chevron">${icon('chevron', 17)}</span>
      </summary>
      ${group.id === TOEIC_GROUP_ID && options.some(isToeic) ? renderToeic(state.toeic) : ''}
      <ul class="subject-list cert-options">${options.map(option => renderOption(option, state)).join('')}</ul>
    </details>`;
}

function renderCertList(state = getState()) {
  const query = search.value.trim();
  const totals = calculateCredits(state);
  const openGroups = getOpenSections(CERT_SECTIONS_KEY);
  const results = [];
  for (const group of CERTIFICATION_GROUPS) {
    if (category.value && category.value !== group.category) continue;
    const options = matchesSearch(group.name, query)
      ? group.options
      : group.options.filter(option => matchesOption(option, query));
    if (options.length) {
      results.push(renderGroup(group, options, state, totals, openGroups.has(group.id)));
    }
  }
  certList.innerHTML = results.join('') || '<p class="empty-state" role="status">該当する資格・検定はありません。</p>';
  renderToeicResult(state);
}

function readToeicFields() {
  const score = document.querySelector('#toeic-score');
  return {
    rawScore: score.value,
    score: score.value === '' || !score.validity.valid ? null : score.valueAsNumber,
    invalid: score.validity.badInput || !score.validity.valid,
    online: document.querySelector('#toeic-type').value === 'online',
  };
}

function renderToeicResult(state) {
  const result = document.querySelector('#toeic-result-text');
  if (!result) return;
  const control = document.querySelector('#toeic-result-control');
  const { rawScore, score, invalid, online } = readToeicFields();
  const option = getToeicOption(score);
  control.replaceChildren();

  if (online) {
    result.textContent = 'IPテスト（オンライン）は単位認定の対象外です。';
  } else if (invalid) {
    result.textContent = '10〜990の整数を入力してください。';
  } else if (!rawScore) {
    result.textContent = '点数を入力すると、対象区分と単位数が表示されます。';
  } else if (!option) {
    result.textContent = 'この点数は単位認定の対象外です。';
  } else {
    result.textContent = `${option.condition}（${option.credits} 単位）`;
    const status = state.certifications[option.id] ?? 'unearned';
    control.innerHTML = statusSelect('TOEICの取得状況', status, `data-toeic-option="${escapeHtml(option.id)}"`);
  }
}

function renderTotals(state) {
  const totals = calculateCredits(state);
  for (const field of ['total', 'general', 'specialized']) {
    document.querySelector(`#cert-${field}`).textContent = totals.certification[field];
  }
  document.querySelector('#external-total').textContent = totals.external.total;
  for (const group of certList.querySelectorAll('[data-cert-group]')) {
    group.querySelector('.cert-group-total').textContent = `${totals.certification.groups[group.dataset.certGroup] ?? 0} 単位`;
  }
}

function renderExternalSlot(slot, entry) {
  const id = escapeHtml(slot.id);
  const name = escapeHtml(slot.name);
  return `
    <li class="subject-row cert-external-row" data-external-slot="${id}">
      <h4>${name}</h4>
      <div class="cert-external-fields">
        <label class="field" for="${id}-name">
          <span>科目名</span>
          <input id="${id}-name" type="text" value="${escapeHtml(entry?.name ?? '')}" placeholder="認定された科目名"
            aria-label="${name}の科目名" aria-describedby="${id}-message" autocomplete="off" data-external-name>
        </label>
        <label class="field" for="${id}-credits">
          <span>認定単位数</span>
          <input id="${id}-credits" type="number" min="1" step="1" inputmode="numeric" value="${escapeHtml(entry?.credits ?? '')}"
            placeholder="0" aria-label="${name}の認定単位数" aria-describedby="${id}-message" data-external-credits>
        </label>
        <button type="button" class="button secondary cert-external-clear" aria-label="${name}の入力をクリア" data-external-clear>クリア</button>
      </div>
      <p id="${id}-message" class="cert-external-message" aria-live="polite" hidden></p>
    </li>`;
}

function renderExternalList(state = getState()) {
  externalList.innerHTML = ['general', 'specialized'].map(categoryId => `
    <section class="panel cert-external-group">
      <h3>${categoryLabel(categoryId)}</h3>
      <ul class="subject-list cert-options">
        ${EXTERNAL_CREDIT_SLOTS.filter(slot => slot.category === categoryId).map(slot => (
          renderExternalSlot(slot, state.external.find(entry => entry.id === slot.id))
        )).join('')}
      </ul>
    </section>`).join('');
}

function showExternalMessage(row, message, entry) {
  const output = row.querySelector('.cert-external-message');
  const text = message && entry ? `${message} 変更前の ${entry.credits} 単位を集計しています。` : message;
  output.hidden = !text;
  output.textContent = text;
}

function saveExternalRow(row) {
  const id = row.dataset.externalSlot;
  const name = row.querySelector('[data-external-name]').value.trim();
  const creditField = row.querySelector('[data-external-credits]');
  const credits = creditField.valueAsNumber;
  const state = getState();
  const entry = state.external.find(item => item.id === id);

  if (!name && !creditField.value && !creditField.validity.badInput && !entry) {
    showExternalMessage(row, '', entry);
  } else if (!name || !creditField.value || !creditField.validity.valid || !Number.isSafeInteger(credits)) {
    showExternalMessage(row, '科目名と1以上の整数を入力してください。', entry);
  } else if (isExternalCreditNameDuplicate(state, id, name)) {
    showExternalMessage(row, '登録済みの科目・資格と同じ名称です。', entry);
  } else {
    let accepted;
    const next = updateState(draft => { accepted = updateExternalCredit(draft, id, { name, credits }); });
    showExternalMessage(row, accepted ? '' : '入力した単位数を登録できません。', entry);
    renderTotals(next);
  }
}

function saveStatus(control) {
  const id = control.dataset.toeicOption ?? control.dataset.certOption;
  const state = updateState(draft => { setCertificationStatus(draft, id, control.value); });
  renderCertList(state);
  renderTotals(state);
  const matchingControl = [...certList.querySelectorAll('select')].find(item => (
    control.dataset.toeicOption ? item.dataset.toeicOption === id : item.dataset.certOption === id
  ));
  (matchingControl ?? document.querySelector('#toeic-score'))?.focus({ preventScroll: true });
}

mountShell('certifications');
renderCertList();
renderExternalList();
renderTotals(getState());

search.addEventListener('input', () => renderCertList());
category.addEventListener('change', () => renderCertList());
certList.addEventListener('toggle', event => {
  const group = event.target;
  if (!group.matches('details[data-cert-group]')) return;
  const id = group.dataset.certGroup;
  const openGroups = getOpenSections(CERT_SECTIONS_KEY);
  if (openGroups.has(id) === group.open) return;
  if (group.open) openGroups.add(id);
  else openGroups.delete(id);
  saveOpenSections(CERT_SECTIONS_KEY, openGroups);
}, true);
certList.addEventListener('input', event => {
  if (event.target.id !== 'toeic-score') return;
  const { score, online } = readToeicFields();
  const state = updateState(draft => { setToeic(draft, score, online); });
  renderToeicResult(state);
});
certList.addEventListener('change', event => {
  const control = event.target;
  if (control.id === 'toeic-type') {
    const { score, online } = readToeicFields();
    const state = updateState(draft => { setToeic(draft, score, online); });
    renderToeicResult(state);
  } else if (control.hasAttribute('data-toeic-option')) {
    const { score, online } = readToeicFields();
    if (!online && getToeicOption(score)?.id === control.dataset.toeicOption) saveStatus(control);
  } else if (control.hasAttribute('data-cert-option')) {
    saveStatus(control);
  }
});

externalList.addEventListener('change', event => {
  if (event.target.matches('[data-external-name], [data-external-credits]')) {
    saveExternalRow(event.target.closest('[data-external-slot]'));
  }
});
externalList.addEventListener('click', event => {
  const button = event.target.closest('[data-external-clear]');
  if (!button) return;
  const row = button.closest('[data-external-slot]');
  const state = updateState(draft => { removeExternalCredit(draft, row.dataset.externalSlot); });
  row.querySelector('[data-external-name]').value = '';
  row.querySelector('[data-external-credits]').value = '';
  showExternalMessage(row, '');
  renderTotals(state);
  row.querySelector('[data-external-name]').focus();
});

function syncStoredData() {
  const state = getState();
  renderCertList(state);
  renderExternalList(state);
  renderTotals(state);
}

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) syncStoredData();
  if (event.key === CERT_SECTIONS_KEY) {
    const openGroups = getOpenSections(CERT_SECTIONS_KEY);
    for (const group of certList.querySelectorAll('details[data-cert-group]')) {
      group.open = openGroups.has(group.dataset.certGroup);
    }
  }
});
window.addEventListener('pageshow', event => {
  if (event.persisted) syncStoredData();
});
