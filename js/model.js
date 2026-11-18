import { CERTIFICATION_GROUPS } from './cert-data.js';
import { COURSES, INITIAL_REQUIRED_BY_GRADE, LOWER_REQUIRED_COURSES } from './course-data.js';

const STATE_VERSION = 2;
const LEGACY_STATE_VERSION = 1;
export const STORAGE_KEY = 'kagawa-kosen-ec-credit-tracker';

export const EXTERNAL_CREDIT_SLOTS = Object.freeze([
  { id: 'external-general-a', name: '学外の一般科目A', category: 'general' },
  { id: 'external-general-b', name: '学外の一般科目B', category: 'general' },
  { id: 'external-general-c', name: '学外の一般科目C', category: 'general' },
  { id: 'external-specialized-a', name: '学外の専門科目A', category: 'specialized' },
  { id: 'external-specialized-b', name: '学外の専門科目B', category: 'specialized' },
  { id: 'external-specialized-c', name: '学外の専門科目C', category: 'specialized' },
]);

const certifications = CERTIFICATION_GROUPS.flatMap(group => group.options);
const certificationIds = new Set(certifications.map(option => option.id));
const fixedCreditUpperBound = [...COURSES, ...LOWER_REQUIRED_COURSES, ...certifications]
  .reduce((total, item) => total + item.credits, 0);

function normalizeName(name) {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
}

const fixedCreditNames = new Set([
  ...COURSES,
  ...LOWER_REQUIRED_COURSES,
  ...CERTIFICATION_GROUPS,
  ...certifications,
].map(item => normalizeName(item.name)));

export function createState() {
  return {
    version: STATE_VERSION,
    courses: {},
    certifications: {},
    toeic: { score: null, online: false },
    external: [],
  };
}

function isFixedCourse(course) {
  return course.grade <= 3 && course.required;
}

export function getCourseStatus(state, course) {
  if (isFixedCourse(course)) return { earned: true, planned: false };

  const record = state.courses[course.id];
  return { earned: record?.earned === true, planned: record?.planned === true };
}

function writeCourseStatus(state, course, status) {
  if (status.earned || status.planned) {
    state.courses[course.id] = status;
  } else {
    delete state.courses[course.id];
  }
}

export function setCourseEarned(state, course, earned) {
  if (typeof earned !== 'boolean' || isFixedCourse(course)) return false;

  const { planned } = getCourseStatus(state, course);
  writeCourseStatus(state, course, { earned, planned });
  return true;
}

export function setCoursePlanned(state, course, planned) {
  if (typeof planned !== 'boolean' || getCourseStatus(state, course).earned) return false;

  writeCourseStatus(state, course, { earned: false, planned });
  return true;
}

export function setCertificationStatus(state, id, status) {
  if (!certificationIds.has(id)) return false;

  if (status === 'unearned') {
    delete state.certifications[id];
  } else if (status === 'passed' || status === 'recognized') {
    state.certifications[id] = status;
  } else {
    return false;
  }
  return true;
}

export function setToeic(state, score, online) {
  if (typeof online !== 'boolean') return false;
  if (score !== null && (!Number.isInteger(score) || score < 10 || score > 990)) return false;

  state.toeic = { score, online };
  return true;
}

export function isExternalCreditNameDuplicate(state, id, name) {
  const normalized = normalizeName(name);
  if (normalized === '') return false;
  return fixedCreditNames.has(normalized) ||
    state.external.some(record => record.id !== id && normalizeName(record.name) === normalized);
}

export function updateExternalCredit(state, id, { name, credits }) {
  const slot = EXTERNAL_CREDIT_SLOTS.find(item => item.id === id);
  if (!slot || typeof name !== 'string' || !name.trim() ||
      !Number.isSafeInteger(credits) || credits <= 0 ||
      isExternalCreditNameDuplicate(state, id, name)) {
    return false;
  }

  const existingCredits = state.external.reduce((total, item) => (
    item.id === id ? total : total + item.credits
  ), 0);
  if (!Number.isSafeInteger(fixedCreditUpperBound + existingCredits + credits)) return false;

  const record = { id, name: name.trim(), category: slot.category, credits };
  const index = state.external.findIndex(item => item.id === id);
  if (index >= 0) {
    state.external[index] = record;
  } else {
    state.external.push(record);
  }
  return true;
}

export function removeExternalCredit(state, id) {
  const index = state.external.findIndex(item => item.id === id);
  if (index < 0) return false;

  state.external.splice(index, 1);
  return true;
}

function parseState(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function loadState(storage) {
  const state = createState();
  try {
    const saved = parseState((storage ?? globalThis.localStorage).getItem(STORAGE_KEY));
    if (saved?.version !== STATE_VERSION && saved?.version !== LEGACY_STATE_VERSION) return state;

    for (const course of COURSES) {
      const record = saved.courses?.[course.id];
      if (!record) continue;

      if (saved.version === LEGACY_STATE_VERSION) {
        const enrollmentRequired = course.grade >= 4 && !course.required;
        const enrolled = record.enrolled === true;
        if (record.earned === true && (!enrollmentRequired || enrolled)) {
          setCourseEarned(state, course, true);
        } else if (enrollmentRequired && enrolled) {
          setCoursePlanned(state, course, true);
        }
      } else {
        if (record.planned === true) setCoursePlanned(state, course, true);
        if (record.earned === true) setCourseEarned(state, course, true);
      }
    }

    for (const id of certificationIds) {
      setCertificationStatus(state, id, saved.certifications?.[id]);
    }
    if (saved.toeic) setToeic(state, saved.toeic.score, saved.toeic.online);

    if (Array.isArray(saved.external)) {
      for (const record of saved.external) {
        if (record) updateExternalCredit(state, record.id, record);
      }
    }
  } catch {
    return state;
  }
  return state;
}

export function saveState(state, storage) {
  if (state.version !== STATE_VERSION) return false;

  try {
    const target = storage ?? globalThis.localStorage;
    const saved = parseState(target.getItem(STORAGE_KEY));
    if (saved?.version > STATE_VERSION) return false;

    target.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function resetState(storage) {
  try {
    (storage ?? globalThis.localStorage).removeItem(STORAGE_KEY);
    return createState();
  } catch {
    return null;
  }
}

function creditTotals(general = 0, specialized = 0) {
  return { general, specialized, total: general + specialized };
}

function sumCredits(items) {
  const credits = creditTotals();
  for (const item of items) {
    credits[item.category] += item.credits;
    credits.total += item.credits;
  }
  return credits;
}

function combineCredits(entries) {
  let general = 0;
  let specialized = 0;
  for (const entry of entries) {
    general += entry.general;
    specialized += entry.specialized;
  }
  return creditTotals(general, specialized);
}

function condition(current, required) {
  return { current, required, remaining: Math.max(0, required - current), met: current >= required };
}

export function calculateCredits(state, {
  courses = COURSES,
  certificationGroups = CERTIFICATION_GROUPS,
  initialRequiredByGrade = INITIAL_REQUIRED_BY_GRADE,
  includePlanned = false,
} = {}) {
  const countedCourses = new Map();
  for (const course of courses) {
    if (isFixedCourse(course)) continue;
    const { earned, planned } = getCourseStatus(state, course);
    if (!earned && !(includePlanned && planned)) continue;

    const key = course.equivalentGroup ?? course.id;
    const existing = countedCourses.get(key);
    // Use the earned listing first, then the earliest year when both statuses match.
    if (!existing || (earned && !existing.earned) ||
        (earned === existing.earned && course.grade < existing.course.grade)) {
      countedCourses.set(key, { course, earned });
    }
  }

  const grades = {};
  for (let grade = 1; grade <= 5; grade += 1) {
    const baseline = initialRequiredByGrade[grade];
    grades[grade] = creditTotals(baseline?.general, baseline?.specialized);
  }

  let designatedCredits = 0;
  for (const { course } of countedCourses.values()) {
    grades[course.grade][course.category] += course.credits;
    grades[course.grade].total += course.credits;
    if (course.grade <= 4 && course.recommendation) designatedCredits += course.credits;
  }

  const groups = {};
  const certification = sumCredits(certificationGroups.map(group => {
    let credits = 0;
    for (const option of group.options) {
      if (state.certifications[option.id] === 'recognized') {
        credits = Math.max(credits, option.credits);
      }
    }
    groups[group.id] = credits;
    return { category: group.category, credits };
  }));
  certification.groups = groups;

  const external = sumCredits(state.external);
  // Recognition records are undated, so the conditions use all currently recognized credits.
  const throughYearFour = combineCredits([grades[1], grades[2], grades[3], grades[4], certification, external]);
  const total = combineCredits([throughYearFour, grades[5]]);

  const promotion = condition(throughYearFour.total, 128);
  const specialized = condition(throughYearFour.specialized, 55);
  const designated = condition(designatedCredits, 10);
  const graduation = {
    total: condition(total.total, 167),
    general: condition(total.general, 75),
    specialized: condition(total.specialized, 82),
  };
  graduation.met = graduation.total.met && graduation.general.met && graduation.specialized.met;

  return {
    total,
    grades,
    certification,
    external,
    conditions: {
      promotion,
      recommendation: { specialized, designated, met: specialized.met && designated.met },
      graduation,
    },
  };
}
