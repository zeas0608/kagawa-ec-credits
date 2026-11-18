import { CERTIFICATION_GROUPS } from './cert-data.js';
import { COURSES, INITIAL_REQUIRED_BY_GRADE, LOWER_REQUIRED_COURSES } from './course-data.js';
import { NEW_COURSE_IDS, PREVIOUS_COURSE_ALIASES } from './course-migration.js';

const STATE_VERSION = 4;
const COURSE_ENROLLMENT_STATE_VERSION = 1;
const PREVIOUS_SYLLABUS_STATE_VERSION = 2;
const PREVIOUS_STATE_VERSION = 3;
export const STORAGE_KEY = 'kagawa-kosen-ec-credit-tracker';

const previousExternalCategories = new Map([
  ['external-general-a', 'general'],
  ['external-general-b', 'general'],
  ['external-general-c', 'general'],
  ['external-specialized-a', 'specialized'],
  ['external-specialized-b', 'specialized'],
  ['external-specialized-c', 'specialized'],
]);
const externalEntryIdPattern = /^external-entry-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

const certifications = CERTIFICATION_GROUPS.flatMap(group => group.options);
const certificationGroupsByOptionId = new Map(CERTIFICATION_GROUPS.flatMap(group => (
  group.options.map(option => [option.id, group])
)));
const coursesById = new Map(COURSES.map(course => [course.id, course]));
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
    external: [],
  };
}

function isFixedCourse(course) {
  return course.grade <= 3 && course.required;
}

export function getCourseStatus(state, course) {
  return { earned: isFixedCourse(course) || state.courses[course.id]?.earned === true };
}

export function setCourseEarned(state, course, earned) {
  if (typeof earned !== 'boolean' || isFixedCourse(course)) return false;

  if (earned) {
    state.courses[course.id] = { earned: true };
  } else {
    delete state.courses[course.id];
  }
  return true;
}

export function setCertificationEarned(state, id, earned) {
  const group = certificationGroupsByOptionId.get(id);
  if (!group || typeof earned !== 'boolean') return false;

  if (earned) {
    for (const option of group.options) delete state.certifications[option.id];
    state.certifications[id] = true;
  } else {
    delete state.certifications[id];
  }
  return true;
}

function highestEarnedOption(group, isEarned) {
  let best;
  for (const option of group.options) {
    if (isEarned(option.id) && (!best || option.credits > best.credits)) best = option;
  }
  return best;
}

export function isExternalCreditNameDuplicate(state, id, name) {
  const normalized = normalizeName(name);
  if (normalized === '') return false;
  return fixedCreditNames.has(normalized) ||
    state.external.some(record => record.id !== id && normalizeName(record.name) === normalized);
}

function writeExternalCredit(state, { id, name, category, credits }) {
  if ((category !== 'general' && category !== 'specialized') ||
      typeof name !== 'string' || !name.trim() ||
      !Number.isSafeInteger(credits) || credits <= 0 ||
      isExternalCreditNameDuplicate(state, id, name)) {
    return false;
  }

  const existingCredits = state.external.reduce((total, item) => (
    item.id === id ? total : total + item.credits
  ), 0);
  if (!Number.isSafeInteger(fixedCreditUpperBound + existingCredits + credits)) return false;

  const record = { id, name: name.trim(), category, credits };
  const index = state.external.findIndex(item => item.id === id);
  if (index >= 0) {
    state.external[index] = record;
  } else {
    state.external.push(record);
  }
  return true;
}

export function addExternalCredit(state, { name, category, credits }) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) return null;

  const id = `external-entry-${uuid}`;
  if (state.external.some(record => record.id === id)) return null;

  return writeExternalCredit(state, { id, name, category, credits }) ? id : null;
}

export function updateExternalCredit(state, id, { name, category, credits }) {
  const current = state.external.find(record => record.id === id);
  if (!current) return false;

  return writeExternalCredit(state, { id, name, category: category ?? current.category, credits });
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
    const hadEnrollment = saved?.version === COURSE_ENROLLMENT_STATE_VERSION;
    const hadPreviousSyllabus = hadEnrollment || saved?.version === PREVIOUS_SYLLABUS_STATE_VERSION;
    const hadLegacyFormat = hadPreviousSyllabus || saved?.version === PREVIOUS_STATE_VERSION;
    if (saved?.version !== STATE_VERSION && !hadLegacyFormat) return state;

    for (const [id, record] of Object.entries(saved.courses ?? {})) {
      if (record?.earned !== true) continue;
      if (hadPreviousSyllabus && NEW_COURSE_IDS.includes(id)) continue;

      const currentId = hadPreviousSyllabus ? (PREVIOUS_COURSE_ALIASES[id] ?? id) : id;
      const course = coursesById.get(currentId);
      if (!course) continue;

      const enrollmentWasRequired = hadEnrollment && course.grade >= 4 && !course.required;
      if (enrollmentWasRequired && record.enrolled !== true) continue;
      setCourseEarned(state, course, true);
    }

    const wasCertificationEarned = id => {
      const status = saved.certifications?.[id];
      return hadLegacyFormat ? (status === 'passed' || status === 'recognized') : status === true;
    };
    for (const group of CERTIFICATION_GROUPS) {
      const best = highestEarnedOption(group, wasCertificationEarned);
      if (best) setCertificationEarned(state, best.id, true);
    }

    if (Array.isArray(saved.external)) {
      for (const record of saved.external) {
        if (typeof record?.id !== 'string') continue;
        const previousCategory = previousExternalCategories.get(record.id);
        if (hadLegacyFormat && !previousCategory) continue;
        if (!previousCategory && !externalEntryIdPattern.test(record.id)) continue;

        const category = hadLegacyFormat ? previousCategory : record.category;
        writeExternalCredit(state, { ...record, category });
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
} = {}) {
  const earnedCourses = new Map();
  for (const course of courses) {
    if (isFixedCourse(course) || !getCourseStatus(state, course).earned) continue;

    const key = course.equivalentGroup ?? course.id;
    const existing = earnedCourses.get(key);
    // When both listings are marked as earned, count the course once in the earlier year.
    if (!existing || course.grade < existing.grade) earnedCourses.set(key, course);
  }

  const grades = {};
  for (let grade = 1; grade <= 5; grade += 1) {
    const baseline = initialRequiredByGrade[grade];
    grades[grade] = creditTotals(baseline?.general, baseline?.specialized);
  }

  let designatedCredits = 0;
  for (const course of earnedCourses.values()) {
    grades[course.grade][course.category] += course.credits;
    grades[course.grade].total += course.credits;
    if (course.grade <= 4 && course.recommendation) designatedCredits += course.credits;
  }

  const groups = {};
  const certification = sumCredits(certificationGroups.map(group => {
    const credits = highestEarnedOption(group, id => state.certifications[id] === true)?.credits ?? 0;
    groups[group.id] = credits;
    return { category: group.category, credits };
  }));
  certification.groups = groups;

  const external = sumCredits(state.external);
  // Recognition records are undated, so the conditions use all currently recognized credits.
  const throughYearFour = combineCredits([grades[1], grades[2], grades[3], grades[4], certification, external]);
  const total = combineCredits([throughYearFour, grades[5]]);

  const promotionCredits = condition(throughYearFour.total, 128);
  const laboratory = courses.find(course => course.id === 'g4-253125');
  const labEarned = laboratory !== undefined && getCourseStatus(state, laboratory).earned;
  const promotion = { credits: promotionCredits, labEarned, met: promotionCredits.met && labEarned };
  const specialized = condition(throughYearFour.specialized, 55);
  const designated = condition(designatedCredits, 10);
  const graduation = {
    total: condition(total.total, 167),
    general: condition(total.general, 75),
    specialized: condition(total.specialized, 82),
    requiredCoursesRemaining: courses.filter(course => (
      course.grade >= 4 && course.required && !getCourseStatus(state, course).earned
    )).length,
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
