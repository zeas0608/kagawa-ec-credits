import { getState, icon, mountShell } from './common.js';
import { calculateCredits } from './model.js';

const dashboard = document.querySelector('#dashboard-summary');

function percent(current, required) {
  return Math.round(100 * current / required);
}

function progressBar(label, condition, color) {
  const { current, required } = condition;
  return `
    <div class="credit-progress">
      <div class="progress-label">
        <span><i class="legend-dot ${color}"></i>${label}</span>
        <span><strong>${current}</strong><span class="progress-target"> / ${required} 単位</span></span>
      </div>
      <progress class="${color}" aria-label="${label}" value="${Math.min(current, required)}" max="${required}"></progress>
    </div>`;
}

function conditionRow(label, { current, required, remaining, met }) {
  return `
    <li class="criterion">
      <span class="criterion-label">${label}</span>
      <span class="criterion-value"><strong>${current}</strong><span> / ${required}</span></span>
      <span class="criterion-remaining${met ? ' met' : ''}">${met ? '不足 0 単位' : `あと ${remaining} 単位`}</span>
    </li>`;
}

function judgmentCard(title, caption, symbol, met, rows) {
  return `
    <article class="panel judgment-card">
      <div class="judgment-top">
        <span class="icon-tile">${icon(symbol, 19)}</span>
        <span class="status${met ? ' met' : ''}"><span></span>${met ? '単位数条件達成' : '未達成'}</span>
      </div>
      <h3>${title}</h3>
      <p>${caption}</p>
      <ul class="criterion-list">${rows.join('')}</ul>
    </article>`;
}

function renderDashboard() {
  const { total, grades, certification, external, conditions } = calculateCredits(getState());
  const { promotion, recommendation, graduation } = conditions;
  const overallPercent = percent(total.total, graduation.total.required);
  dashboard.innerHTML = `
    <section class="summary-grid" aria-label="取得単位の概要">
      <article class="total-card">
        <div class="total-content">
          <p class="total-label">${icon('layers', 19)} 現在の総取得単位</p>
          <div class="total-value"><strong>${total.total}</strong><span>単位</span></div>
          <p class="total-caption">卒業に必要な ${graduation.total.required} 単位まで <b>あと ${graduation.total.remaining} 単位</b></p>
        </div>
        <div class="credit-ring" style="--completion: ${Math.min(overallPercent, 100)}%" role="img" aria-label="卒業総単位の進捗 ${overallPercent}%">
          <div class="ring-label" aria-hidden="true"><strong>${overallPercent}<small>%</small></strong><span>総単位の進捗</span></div>
        </div>
      </article>
      <article class="panel distribution-card">
        <div class="card-heading"><span class="icon-tile">${icon('trend', 20)}</span><h2>一般・専門の進捗</h2></div>
        <div class="distribution-bars">
          ${progressBar('一般科目', graduation.general, 'general')}
          ${progressBar('専門科目', graduation.specialized, 'specialized')}
        </div>
      </article>
    </section>
    <section class="dashboard-section" aria-labelledby="judgments-heading">
      <header class="section-heading"><h2 id="judgments-heading">単位数判定</h2></header>
      <div class="judgment-grid">
        ${judgmentCard('進級', '1〜4年の対象単位', 'trend', promotion.met, [
          conditionRow('対象単位', promotion),
        ])}
        ${judgmentCard('学校推薦', '5年次の学校推薦', 'flag', recommendation.met, [
          conditionRow('1〜4年の専門', recommendation.specialized),
          conditionRow('指定7科目', recommendation.designated),
        ])}
        ${judgmentCard('卒業', '総単位・一般・専門の3条件', 'graduation', graduation.met, [
          conditionRow('総単位', graduation.total),
          conditionRow('一般', graduation.general),
          conditionRow('専門', graduation.specialized),
        ])}
      </div>
      <p class="judgment-note">${icon('info', 17)}<span>判定は単位数条件のみを表示します。進級と学校推薦には現在の資格・学外認定単位を反映するため、過去の年度末時点の判定とは異なる場合があります。</span></p>
    </section>
    <div class="detail-grid dashboard-section">
      <section class="panel detail-card" aria-labelledby="grade-heading">
        <div class="card-heading"><span class="icon-tile">${icon('book', 19)}</span><h2 id="grade-heading">学年別の取得単位</h2></div>
        <table class="credits-table">
          <caption class="visually-hidden">授業科目の学年別内訳（単位）</caption>
          <thead><tr><th scope="col">学年</th><th scope="col">一般</th><th scope="col">専門</th><th scope="col">合計</th></tr></thead>
          <tbody>${Object.entries(grades).map(([grade, counts]) => `
            <tr><th scope="row">${grade}年</th><td>${counts.general}</td><td>${counts.specialized}</td><td><strong>${counts.total}</strong></td></tr>
          `).join('')}</tbody>
        </table>
      </section>
      <section class="panel detail-card" aria-labelledby="recognition-heading">
        <div class="card-heading"><span class="icon-tile">${icon('award', 19)}</span><h2 id="recognition-heading">認定単位の概要</h2></div>
        <dl class="recognition-totals">
          <div><dt>資格認定</dt><dd><strong>${certification.total}</strong> 単位</dd></div>
          <div><dt>その他の認定単位</dt><dd><strong>${external.total}</strong> 単位</dd></div>
        </dl>
        <a class="text-link" href="./certifications.html">資格・認定単位を管理 ${icon('arrow', 17)}</a>
      </section>
    </div>`;
}

mountShell('dashboard');
renderDashboard();
window.addEventListener('storage', renderDashboard);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) renderDashboard();
});
