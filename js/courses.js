import { COURSES } from './course-data.js';
import {
  COURSE_SECTIONS_KEY, categoryLabel, escapeHtml, getOpenSections, getState, icon, mountShell,
  saveOpenSections, updateState,
} from './common.js';
import { getCourseStatus, setCourseEarned, STORAGE_KEY } from './model.js';

const years = [1, 2, 3, 4, 5];
const yearCourses = COURSES.filter(course => !course.equivalentGroup);
const courseById = new Map(yearCourses.map(course => [course.id, course]));
const equivalentGroups = new Map();
for (const course of COURSES) {
  if (!course.equivalentGroup) continue;
  if (!equivalentGroups.has(course.equivalentGroup)) equivalentGroups.set(course.equivalentGroup, []);
  equivalentGroups.get(course.equivalentGroup).push(course);
}
for (const courses of equivalentGroups.values()) courses.sort((a, b) => a.grade - b.grade);

const groups = document.querySelector('#course-groups');
let openYears = getOpenSections(COURSE_SECTIONS_KEY);

function earnedGrade(state, alternatives) {
  const earned = alternatives.find(course => getCourseStatus(state, course).earned);
  return earned ? String(earned.grade) : '';
}

function renderRow(course, identifier, earned, control) {
  return `
    <li class="subject-row course-row" ${identifier} data-earned="${earned}">
      <div class="subject-main course-main">
        <p class="course-name">${escapeHtml(course.name)}</p>
        <div class="course-meta">
          <span class="tag ${course.category}">${categoryLabel(course.category)}</span>
          <span class="course-credit">${course.credits}<span>単位</span></span>
        </div>
      </div>
      <div class="subject-actions">${control}</div>
    </li>
  `;
}

function renderCourse(course, state) {
  const { earned } = getCourseStatus(state, course);
  const control = `
    <label class="course-check">
      <input type="checkbox" data-course-action="earn"
        aria-label="単位取得 ${escapeHtml(course.name)}（${course.grade}年）" ${earned ? 'checked' : ''}>
      <span>単位取得</span>
    </label>
  `;
  return renderRow(course, `data-course-id="${escapeHtml(course.id)}"`, earned, control);
}

function renderEquivalentCourse(id, alternatives, state) {
  const course = alternatives[0];
  const selectedGrade = earnedGrade(state, alternatives);
  const options = alternatives.map(({ grade }) => (
    `<option value="${grade}" ${String(grade) === selectedGrade ? 'selected' : ''}>${grade}年で修得</option>`
  )).join('');
  const control = `
    <select class="course-grade-choice" data-course-action="choose-year" aria-label="${escapeHtml(course.name)}の修得学年">
      <option value="">未修得</option>
      ${options}
    </select>
  `;
  return renderRow(course, `data-equivalent-group="${escapeHtml(id)}"`, Boolean(selectedGrade), control);
}

function renderList(courses, state, title = '') {
  if (!courses.length) return '';
  return `
    ${title ? `<h3 class="course-list-title">${title}</h3>` : ''}
    <ul class="subject-list course-list">${courses.map(course => renderCourse(course, state)).join('')}</ul>
  `;
}

function renderSection(id, title, content) {
  return `
    <details class="panel subject-group course-group" data-section="${id}" ${openYears.has(id) ? 'open' : ''}>
      <summary class="course-group-summary">
        <span class="course-group-title">${title}</span>
        <span class="course-chevron" aria-hidden="true">${icon('chevron', 18)}</span>
      </summary>
      <div class="course-group-body">${content}</div>
    </details>
  `;
}

function renderCourses() {
  const state = getState();
  const yearSections = years.map(year => {
    const courses = yearCourses.filter(course => course.grade === year);
    const content = year <= 3
      ? renderList(courses, state)
      : renderList(courses.filter(course => course.required), state, '必修科目') +
        renderList(courses.filter(course => !course.required), state, '選択科目');
    return renderSection(String(year), `${year}年`, content);
  });
  const sharedRows = [...equivalentGroups].map(([id, alternatives]) => renderEquivalentCourse(id, alternatives, state));
  const other = renderSection('other', 'その他', `<ul class="subject-list course-list">${sharedRows.join('')}</ul>`);
  groups.innerHTML = yearSections.join('') + other;
}

function syncCourseRow(row, state) {
  const control = row.querySelector('[data-course-action]');
  const alternatives = equivalentGroups.get(row.dataset.equivalentGroup);
  if (alternatives) {
    control.value = earnedGrade(state, alternatives);
    row.dataset.earned = Boolean(control.value);
    return;
  }
  const course = courseById.get(row.dataset.courseId);
  const { earned } = getCourseStatus(state, course);
  control.checked = earned;
  row.dataset.earned = earned;
}

function syncCourseRows() {
  const state = getState();
  for (const row of groups.querySelectorAll('.course-row')) syncCourseRow(row, state);
}

function syncOpenYears() {
  openYears = getOpenSections(COURSE_SECTIONS_KEY);
  for (const section of groups.querySelectorAll('details[data-section]')) {
    section.open = openYears.has(section.dataset.section);
  }
}

groups.addEventListener('click', event => {
  const summary = event.target.closest('.course-group-summary');
  if (!summary || event.defaultPrevented) return;
  const section = summary.parentElement;
  const id = section.dataset.section;
  openYears = getOpenSections(COURSE_SECTIONS_KEY);
  if (section.open) openYears.delete(id);
  else openYears.add(id);
  saveOpenSections(COURSE_SECTIONS_KEY, openYears);
});
groups.addEventListener('change', event => {
  const control = event.target.closest('[data-course-action]');
  if (!control) return;
  const row = control.closest('.course-row');
  const alternatives = equivalentGroups.get(row.dataset.equivalentGroup);
  const state = updateState(draft => {
    if (alternatives) {
      const selected = alternatives.find(course => String(course.grade) === control.value);
      for (const course of alternatives) setCourseEarned(draft, course, course === selected);
    } else {
      setCourseEarned(draft, courseById.get(row.dataset.courseId), control.checked);
    }
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
renderCourses();
