import { COURSES, INITIAL_REQUIRED_BY_GRADE, SYLLABUS_URL } from './course-data.js';
import {
  COURSE_SECTIONS_KEY, categoryLabel, escapeHtml, getOpenSections, getState, icon, matchesSearch, mountShell,
  saveOpenSections, updateState,
} from './common.js';
import { getCourseStatus, setCourseEarned, setCoursePlanned, STORAGE_KEY } from './model.js';

const years = [1, 2, 3, 4, 5];
const courseById = new Map(COURSES.map(course => [course.id, course]));
const filters = document.querySelector('#course-filters');
const groups = document.querySelector('#course-groups');
const results = document.querySelector('#course-results');
const modePicker = document.querySelector('#course-mode');
let planning = new URLSearchParams(window.location.search).get('mode') === 'planned';
let openYears = getOpenSections(COURSE_SECTIONS_KEY);

function renderFoundation() {
  const totals = { general: 0, specialized: 0 };
  for (const year of Object.values(INITIAL_REQUIRED_BY_GRADE)) {
    totals.general += year.general;
    totals.specialized += year.specialized;
  }
  const stats = [
    { label: '一般', value: totals.general, category: 'general' },
    { label: '専門', value: totals.specialized, category: 'specialized' },
    { label: '合計', value: totals.general + totals.specialized, category: 'total' },
  ];
  document.querySelector('#foundation-totals').innerHTML = stats.map(stat => `
    <div class="foundation-stat foundation-${stat.category}">
      <dt>${stat.label}</dt>
      <dd><strong>${stat.value}</strong><span>単位</span></dd>
    </div>
  `).join('');
}

function inputStatus(state, course) {
  const { earned, planned } = getCourseStatus(state, course);
  const includedInPlan = planning && !earned && planned;
  return {
    earned,
    includedInPlan,
    checked: earned || includedInPlan,
    disabled: planning && earned,
    label: planning ? (earned ? '取得済み' : '想定に含める') : '単位取得',
  };
}

function renderCourse(course, state) {
  const name = escapeHtml(course.name);
  const id = escapeHtml(course.id);
  const { earned, includedInPlan, checked, disabled, label } = inputStatus(state, course);
  const equivalent = course.equivalentGroup
    ? '<span title="複数学年の取得を記録しても、単位は一度だけ計上されます。">他学年にも掲載</span>'
    : '';
  const recommendation = course.recommendation ? '<span>推薦指定</span>' : '';
  return `
    <li class="subject-row course-row" data-course-id="${id}" data-earned="${earned}" data-planned="${includedInPlan}">
      <div class="subject-main course-main">
        <p class="course-name">${name}</p>
        <div class="course-meta">
          <span class="tag ${course.category}">${categoryLabel(course.category)}</span>
          <span class="course-credit">${course.credits}<span>単位</span></span>
          ${recommendation}${equivalent}
        </div>
      </div>
      <div class="subject-actions course-actions">
        <label class="course-check">
          <input type="checkbox" data-course-action="${planning ? 'plan' : 'earn'}"
            aria-label="${label} ${name}（${course.grade}年）" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
          <span>${label}</span>
        </label>
      </div>
    </li>
  `;
}

function renderList(courses, state, title = '') {
  if (!courses.length) return '';
  return `
    ${title ? `<h3 class="course-list-title">${title}</h3>` : ''}
    <ul class="subject-list course-list">${courses.map(course => renderCourse(course, state)).join('')}</ul>
  `;
}

function renderSection(year, courses, state) {
  const selected = courses.filter(course => course.grade === year);
  if (!selected.length) return '';
  const content = year <= 3
    ? renderList(selected, state)
    : renderList(selected.filter(course => course.required), state, '必修科目') +
      renderList(selected.filter(course => !course.required), state, '選択科目');
  return `
    <details class="panel subject-group course-group" data-section="${year}" ${openYears.has(String(year)) ? 'open' : ''}>
      <summary class="course-group-summary">
        <span class="course-group-title">${year}年の${year <= 3 ? '選択科目' : '授業科目'}</span>
        <span class="course-group-count">${selected.length}科目</span>
        <span class="course-chevron" aria-hidden="true">${icon('chevron', 18)}</span>
      </summary>
      <div class="course-group-body">${content}</div>
    </details>
  `;
}

function renderCourses() {
  const fields = new FormData(filters);
  const search = fields.get('search').trim();
  const grade = fields.get('grade');
  const category = fields.get('category');
  const type = fields.get('type');
  const courses = COURSES.filter(course => (
    (!grade || course.grade === Number(grade)) &&
    (!category || course.category === category) &&
    (!type || course.required === (type === 'required')) &&
    matchesSearch(course.name, search)
  ));
  results.textContent = `${courses.length}科目`;
  if (!courses.length) {
    groups.innerHTML = '<p class="panel empty-state">条件に一致する科目がありません。</p>';
    return;
  }
  const state = getState();
  groups.innerHTML = years.map(year => renderSection(year, courses, state)).join('');
}

function syncCourseRow(row, state) {
  const course = courseById.get(row.dataset.courseId);
  const { earned, includedInPlan, checked, disabled, label } = inputStatus(state, course);
  const input = row.querySelector('[data-course-action]');
  input.checked = checked;
  input.disabled = disabled;
  input.setAttribute('aria-label', `${label} ${course.name}（${course.grade}年）`);
  input.nextElementSibling.textContent = label;
  row.dataset.earned = earned;
  row.dataset.planned = includedInPlan;
}

function syncCourseRows() {
  const state = getState();
  for (const row of groups.querySelectorAll('[data-course-id]')) syncCourseRow(row, state);
}

function syncOpenYears() {
  openYears = getOpenSections(COURSE_SECTIONS_KEY);
  for (const section of groups.querySelectorAll('details[data-section]')) {
    section.open = openYears.has(section.dataset.section);
  }
}

function renderMode() {
  modePicker.querySelector(`[value="${planning ? 'planned' : 'earned'}"]`).checked = true;
  document.querySelector('#course-mode-description').textContent = planning
    ? '今後の取得を想定する科目を選びます。'
    : '取得済みの科目にチェックを入れます。';
}

modePicker.addEventListener('change', event => {
  planning = event.target.value === 'planned';
  const url = new URL(window.location.href);
  if (planning) url.searchParams.set('mode', 'planned');
  else url.searchParams.delete('mode');
  history.replaceState(history.state, '', url);
  renderMode();
  renderCourses();
});
filters.addEventListener('submit', event => event.preventDefault());
filters.addEventListener('input', renderCourses);
groups.addEventListener('click', event => {
  const summary = event.target.closest('.course-group-summary');
  if (!summary || event.defaultPrevented) return;
  const section = summary.parentElement;
  const year = section.dataset.section;
  openYears = getOpenSections(COURSE_SECTIONS_KEY);
  if (section.open) openYears.delete(year);
  else openYears.add(year);
  saveOpenSections(COURSE_SECTIONS_KEY, openYears);
});
groups.addEventListener('change', event => {
  const control = event.target.closest('[data-course-action]');
  if (!control) return;
  const row = control.closest('[data-course-id]');
  const course = courseById.get(row.dataset.courseId);
  const state = updateState(draft => {
    if (control.dataset.courseAction === 'plan') setCoursePlanned(draft, course, control.checked);
    else setCourseEarned(draft, course, control.checked);
  });
  syncCourseRow(row, state);
});
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) syncCourseRows();
  if (event.key === COURSE_SECTIONS_KEY || event.key === null) syncOpenYears();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    syncCourseRows();
    syncOpenYears();
  }
});

mountShell('courses');
document.querySelector('#course-source').innerHTML =
  `<a class="text-link" href="${escapeHtml(SYLLABUS_URL)}">2025年度の公式シラバス ${icon('arrow', 15)}</a>`;
renderFoundation();
renderMode();
renderCourses();
