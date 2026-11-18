import { CERTIFICATION_GROUPS } from './cert-data.js';
import {
  CERT_SECTIONS_KEY, categoryLabel, escapeHtml, getOpenSections, getState, icon, mountShell,
  saveOpenSections, updateState,
} from './common.js';
import {
  addExternalCredit,
  calculateCredits,
  isExternalCreditNameDuplicate,
  removeExternalCredit,
  setCertificationEarned,
  STORAGE_KEY,
  updateExternalCredit,
} from './model.js';

const certList = document.querySelector('#cert-list');
const externalList = document.querySelector('#external-list');
const externalAdd = document.querySelector('#external-add');
const externalEditor = document.querySelector('#external-editor');
const externalName = document.querySelector('#external-name');
const externalCategory = document.querySelector('#external-category');
const externalCredits = document.querySelector('#external-credits-input');
const externalMessage = document.querySelector('#external-message');
const externalDelete = document.querySelector('#external-delete');
let editingExternalId = null;

function renderOption(option, state) {
  const earned = state.certifications[option.id] === true;
  const condition = option.condition === 'なし' ? '' : option.condition;
  const optionLabel = [option.name, condition].filter(Boolean).join(' ');

  return `
    <li class="subject-row cert-option" data-earned="${earned}">
      <div class="subject-main">
        <span class="cert-option-name">${escapeHtml(option.name)}</span>
        ${condition ? `<span class="muted cert-condition">${escapeHtml(condition)}</span>` : ''}
      </div>
      <div class="subject-actions cert-option-actions">
        <span class="cert-option-credits">${escapeHtml(option.credits)} 単位</span>
        <label class="cert-check">
          <input type="checkbox" data-cert-option="${escapeHtml(option.id)}" aria-label="取得 ${escapeHtml(optionLabel)}" ${earned ? 'checked' : ''}>
          <span>取得</span>
        </label>
      </div>
    </li>`;
}

function renderGroup(group, state, totals, expanded) {
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
      <ul class="subject-list cert-options">${group.options.map(option => renderOption(option, state)).join('')}</ul>
    </details>`;
}

function renderCertList(state = getState()) {
  const totals = calculateCredits(state);
  const openGroups = getOpenSections(CERT_SECTIONS_KEY);
  certList.innerHTML = CERTIFICATION_GROUPS.map(group => (
    renderGroup(group, state, totals, openGroups.has(group.id))
  )).join('');
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

function renderExternalEntry(entry) {
  const name = escapeHtml(entry.name);
  return `
    <li class="subject-row cert-external-row" data-external-id="${escapeHtml(entry.id)}">
      <div class="cert-external-details">
        <span class="cert-option-name">${name}</span>
        <span class="tag ${escapeHtml(entry.category)}">${categoryLabel(entry.category)}</span>
      </div>
      <div class="subject-actions">
        <span class="cert-count">${entry.credits} 単位</span>
        <button type="button" class="button secondary" aria-label="${name}を編集" data-external-edit>編集</button>
      </div>
    </li>`;
}

function renderExternalList(state = getState()) {
  externalList.hidden = state.external.length === 0;
  externalList.innerHTML = state.external.map(renderExternalEntry).join('');
}

function showExternalMessage(message = '') {
  externalMessage.hidden = !message;
  externalMessage.textContent = message;
}

function openExternalEditor(entry) {
  editingExternalId = entry?.id ?? null;
  externalName.value = entry?.name ?? '';
  externalCategory.value = entry?.category ?? '';
  externalCredits.value = entry?.credits ?? '';
  externalDelete.hidden = !entry;
  showExternalMessage();
  externalEditor.hidden = false;
  externalAdd.setAttribute('aria-expanded', 'true');
  externalName.focus();
}

function closeExternalEditor(focusId = editingExternalId) {
  editingExternalId = null;
  externalEditor.hidden = true;
  externalAdd.setAttribute('aria-expanded', 'false');
  const row = [...externalList.children].find(item => item.dataset.externalId === focusId);
  (row?.querySelector('[data-external-edit]') ?? externalAdd).focus();
}

function saveExternalEntry(event) {
  event.preventDefault();
  const id = editingExternalId;
  const name = externalName.value.trim();
  const category = externalCategory.value;
  const credits = externalCredits.valueAsNumber;
  if (!name || !Number.isSafeInteger(credits)) {
    showExternalMessage('科目名と1以上の整数を入力してください。');
    return;
  }
  if (isExternalCreditNameDuplicate(getState(), id, name)) {
    showExternalMessage('登録済みの科目・資格と同じ名称です。');
    return;
  }
  let savedId = null;
  const state = updateState(draft => {
    const values = { name, category, credits };
    if (!id) savedId = addExternalCredit(draft, values);
    else if (draft.external.some(entry => entry.id === id) && updateExternalCredit(draft, id, values)) savedId = id;
  });
  if (!savedId) {
    showExternalMessage('入力した単位を保存できません。');
    return;
  }
  renderExternalList(state);
  renderTotals(state);
  closeExternalEditor(savedId);
}

mountShell('certifications');
renderCertList();
renderExternalList();
renderTotals(getState());

certList.addEventListener('click', event => {
  const summary = event.target.closest('.cert-group-summary');
  if (!summary || event.defaultPrevented) return;
  const group = summary.parentElement;
  const id = group.dataset.certGroup;
  const openGroups = getOpenSections(CERT_SECTIONS_KEY);
  if (group.open) openGroups.delete(id);
  else openGroups.add(id);
  saveOpenSections(CERT_SECTIONS_KEY, openGroups);
});
certList.addEventListener('change', event => {
  const control = event.target;
  if (!control.hasAttribute('data-cert-option')) return;
  const state = updateState(draft => {
    setCertificationEarned(draft, control.dataset.certOption, control.checked);
  });
  for (const input of control.closest('[data-cert-group]').querySelectorAll('[data-cert-option]')) {
    input.checked = state.certifications[input.dataset.certOption] === true;
    input.closest('.cert-option').dataset.earned = input.checked;
  }
  renderTotals(state);
});

externalAdd.addEventListener('click', () => openExternalEditor());
document.querySelector('#external-cancel').addEventListener('click', () => closeExternalEditor());
externalEditor.addEventListener('submit', saveExternalEntry);
externalList.addEventListener('click', event => {
  const button = event.target.closest('[data-external-edit]');
  if (!button) return;
  const id = button.closest('[data-external-id]').dataset.externalId;
  const entry = getState().external.find(item => item.id === id);
  if (entry) openExternalEditor(entry);
});
externalDelete.addEventListener('click', () => {
  if (!editingExternalId || !window.confirm('この認定単位を削除しますか？')) return;
  const state = updateState(draft => { removeExternalCredit(draft, editingExternalId); });
  renderExternalList(state);
  renderTotals(state);
  closeExternalEditor();
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
