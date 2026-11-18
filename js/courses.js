import { COURSES, INITIAL_REQUIRED_BY_GRADE, SYLLABUS_URL } from './course-data.js';
import { categoryLabel, escapeHtml, getState, icon, matchesSearch, mountShell, updateState } from './common.js';
import { getCourseStatus, setCourseEarned, setCourseEnrollment, STORAGE_KEY } from './model.js';

const sections = [
  { id: 'lower', title: '1〜3年の選択科目', includes: course => course.grade <= 3 },
  { id: 'fourth', title: '4年の授業科目', includes: course => course.grade === 4 },
  { id: 'fifth', title: '5年の授業科目', includes: course => course.grade === 5 },
];
const courseById = new Map(COURSES.map(course => [course.id, course]));
const filters = document.querySelector('#course-filters');
const groups = document.querySelector('#course-groups');
const results = document.querySelector('#course-results');
const openSections = new Set(['lower']);
let filtering = false;

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

function renderCourse(course, state) {
  const name = escapeHtml(course.name);
  const id = escapeHtml(course.id);
  const { enrolled, earned } = getCourseStatus(state, course);
  const enrollment = course.grade >= 4 && !course.required;
  const grade = course.grade <= 3 ? `<span>${course.grade}年</span>` : '';
  const equivalent = course.equivalentGroup
    ? '<span title="複数学年の取得を記録しても、単位は一度だけ計上されます。">他学年にも掲載</span>'
    : '';
  const recommendation = course.recommendation ? '<span>推薦指定</span>' : '';
  return `
    <li class="subject-row course-row" data-course-id="${id}" data-earned="${earned}">
      <div class="subject-main course-main">
        <p class="course-name">${name}</p>
        <div class="course-meta">
          <span class="tag ${course.category}">${categoryLabel(course.category)}</span>
          <span class="course-credit">${course.credits}<span>単位</span></span>
          ${grade}${recommendation}${equivalent}
        </div>
      </div>
      <div class="subject-actions course-actions">
        ${enrollment ? `
          <label class="course-check">
            <input type="checkbox" data-course-action="enroll" aria-label="${name}（${course.grade}年）を履修する"
              ${enrolled ? 'checked' : ''}>
            <span>履修する</span>
          </label>` : ''}
        <label class="course-check course-earn-check">
          <input type="checkbox" data-course-action="earn" aria-label="${name}（${course.grade}年）を取得済みにする"
            ${earned ? 'checked' : ''} ${enrolled ? '' : 'disabled'}>
          <span>取得済み</span>
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

function renderSection(section, courses, state) {
  const selected = courses.filter(section.includes);
  if (!selected.length) return '';
  const content = section.id === 'lower'
    ? renderList(selected, state)
    : renderList(selected.filter(course => course.required), state, '必修科目') +
      renderList(selected.filter(course => !course.required), state, '選択科目');
  return `
    <details class="panel subject-group course-group" data-section="${section.id}"
      ${filtering || openSections.has(section.id) ? 'open' : ''}>
      <summary class="course-group-summary">
        <span class="course-group-title">${section.title}</span>
        <span class="course-group-count">${selected.length}科目</span>
        <span class="course-chevron" aria-hidden="true">${icon('chevron', 18)}</span>
      </summary>
      <div class="course-group-body">${content}</div>
    </details>
  `;
}

function renderCourses() {
  if (!filtering) {
    for (const section of groups.querySelectorAll('details')) {
      if (section.open) openSections.add(section.dataset.section);
      else openSections.delete(section.dataset.section);
    }
  }
  const fields = new FormData(filters);
  const search = fields.get('search').trim();
  const grade = fields.get('grade');
  const category = fields.get('category');
  const type = fields.get('type');
  filtering = Boolean(search || grade || category || type);
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
  groups.innerHTML = sections.map(section => renderSection(section, courses, state)).join('');
}

function syncCourseRow(row, state) {
  const course = courseById.get(row.dataset.courseId);
  const { enrolled, earned } = getCourseStatus(state, course);
  const enroll = row.querySelector('[data-course-action="enroll"]');
  const earn = row.querySelector('[data-course-action="earn"]');
  if (enroll) enroll.checked = enrolled;
  earn.checked = earned;
  earn.disabled = !enrolled;
  row.dataset.earned = earned;
}

function syncCourseRows() {
  const state = getState();
  for (const row of groups.querySelectorAll('[data-course-id]')) syncCourseRow(row, state);
}

filters.addEventListener('submit', event => event.preventDefault());
filters.addEventListener('input', renderCourses);
groups.addEventListener('change', event => {
  const control = event.target.closest('[data-course-action]');
  if (!control) return;
  const row = control.closest('[data-course-id]');
  const course = courseById.get(row.dataset.courseId);
  const state = updateState(draft => {
    if (control.dataset.courseAction === 'enroll') setCourseEnrollment(draft, course, control.checked);
    else setCourseEarned(draft, course, control.checked);
  });
  syncCourseRow(row, state);
});
window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY || event.key === null) syncCourseRows();
});
window.addEventListener('pageshow', event => {
  if (event.persisted) syncCourseRows();
});

mountShell('courses');
document.querySelector('#course-source').innerHTML =
  `<a class="text-link" href="${escapeHtml(SYLLABUS_URL)}">2025年度の公式シラバス ${icon('arrow', 15)}</a>`;
renderFoundation();
renderCourses();
