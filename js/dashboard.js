import { getOpenSections, getState, HOME_SECTIONS_KEY, icon, mountShell, saveOpenSections } from './common.js';
import { calculateCredits, STORAGE_KEY } from './model.js';

const dashboard = document.querySelector('#dashboard-summary');
const details = document.querySelector('#unit-details');
const creditBreakdown = document.querySelector('#credit-breakdown');

function conditionRow(label, { current, required, remaining, met }) {
  return `
    <li class="criterion">
      <span class="criterion-label">${label}</span>
      <span class="criterion-value"><strong>${current}</strong> / ${required}</span>
      <span class="criterion-remaining${met ? ' met' : ''}">${met ? '達成' : `あと ${remaining} 単位`}</span>
    </li>`;
}

function requirementRow(label, status, met) {
  return `
    <li class="criterion criterion-check">
      <span class="criterion-label">${label}</span>
      <span class="criterion-remaining${met ? ' met' : ''}">${status}</span>
    </li>`;
}

function judgmentCard(title, symbol, met, rows) {
  return `
    <article class="panel judgment-card" data-met="${met}">
      <header class="judgment-top">
        <h3>${icon(symbol, 20)}${title}</h3>
        <span class="status">${icon(met ? 'check' : 'attention', 16)}${met ? '達成' : '未達成'}</span>
      </header>
      <ul class="criterion-list">${rows.join('')}</ul>
    </article>`;
}

function renderDashboard() {
  const { total, grades, certification, external, conditions } = calculateCredits(getState());
  const { promotion, recommendation, graduation } = conditions;
  const requiredRemaining = graduation.requiredCoursesRemaining;
  dashboard.innerHTML = `
    <section class="total-card" aria-labelledby="total-heading">
      <div>
        <h2 class="total-label" id="total-heading">${icon('layers', 19)} 取得単位</h2>
        <div class="total-value"><strong>${total.total}</strong><span>単位</span></div>
      </div>
      <p class="total-caption">卒業に必要な ${graduation.total.required} 単位まで <b>あと ${graduation.total.remaining} 単位</b></p>
    </section>
    <section class="dashboard-section" aria-labelledby="judgments-heading">
      <h2 class="section-heading" id="judgments-heading">条件の達成状況</h2>
      <div class="judgment-grid">
        ${judgmentCard('5年生への進級', 'trend', promotion.met, [
          conditionRow('1〜4年の累計', promotion.credits),
          requirementRow('1〜3年の必修', '修得済みとして集計', true),
          requirementRow('電気情報工学実験Ⅱ', promotion.labEarned ? '修得済み' : '未修得', promotion.labEarned),
        ])}
        ${judgmentCard('就職の学校推薦', 'flag', recommendation.met, [
          conditionRow('1〜4年の専門', recommendation.specialized),
          conditionRow('4年の専門必修', recommendation.designated),
        ])}
        ${judgmentCard('卒業', 'graduation', graduation.met && requiredRemaining === 0, [
          conditionRow('総単位', graduation.total),
          conditionRow('一般', graduation.general),
          conditionRow('専門', graduation.specialized),
          requirementRow('4・5年の必修', requiredRemaining ? `未修得 ${requiredRemaining} 科目` : '修得済み', !requiredRemaining),
        ])}
      </div>
      <p class="judgment-note">入力した単位と修得状況を表示しています。正式な認定・推薦は学校が行います。</p>
    </section>`;
  creditBreakdown.innerHTML = `
    <section aria-labelledby="grade-heading">
      <h3 id="grade-heading">学年別</h3>
      <table class="credits-table">
        <caption class="visually-hidden">授業の学年別内訳（単位）</caption>
        <thead><tr><th scope="col">学年</th><th scope="col">一般</th><th scope="col">専門</th><th scope="col">合計</th></tr></thead>
        <tbody>${Object.entries(grades).map(([grade, counts]) => `
          <tr><th scope="row">${grade}年</th><td>${counts.general}</td><td>${counts.specialized}</td><td><strong>${counts.total}</strong></td></tr>
        `).join('')}</tbody>
      </table>
    </section>
    <section aria-labelledby="recognition-heading">
      <h3 id="recognition-heading">資格・その他</h3>
      <dl class="recognition-totals">
        <div><dt>資格</dt><dd><strong>${certification.total}</strong> 単位</dd></div>
        <div><dt>その他の認定単位</dt><dd><strong>${external.total}</strong> 単位</dd></div>
      </dl>
    </section>`;
}

function syncDetails() {
  details.open = getOpenSections(HOME_SECTIONS_KEY).has(details.id);
}

mountShell('dashboard');
renderDashboard();
syncDetails();
details.querySelector('summary').addEventListener('click', (event) => {
  if (!event.defaultPrevented) {
    saveOpenSections(HOME_SECTIONS_KEY, details.open ? new Set() : new Set([details.id]));
  }
});
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) renderDashboard();
  if (event.key === HOME_SECTIONS_KEY || event.key === null) syncDetails();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    renderDashboard();
    syncDetails();
  }
});
