import assert from 'node:assert/strict';
import test from 'node:test';
import { CERTIFICATION_GROUPS, getToeicOption } from '../js/cert-data.js';
import { COURSES, INITIAL_REQUIRED_BY_GRADE, LOWER_REQUIRED_COURSES } from '../js/course-data.js';
import {
  calculateCredits,
  createState,
  getCourseStatus,
  isExternalCreditNameDuplicate,
  loadState,
  removeExternalCredit,
  resetState,
  saveState,
  setCertificationStatus,
  setCourseEarned,
  setCourseEnrollment,
  setToeic,
  STORAGE_KEY,
  updateExternalCredit,
} from '../js/model.js';

function courseById(id) {
  const course = COURSES.find(item => item.id === id);
  assert.ok(course, id);
  return course;
}

function earn(state, course) {
  if (course.grade >= 4 && !course.required) {
    assert.equal(setCourseEnrollment(state, course, true), true);
  }
  assert.equal(setCourseEarned(state, course, true), true);
}

function external(state, general, specialized) {
  assert.equal(updateExternalCredit(state, 'external-general-a', { name: '学外研修（一般）', credits: general }), true);
  assert.equal(updateExternalCredit(state, 'external-specialized-a', { name: '学外研究（専門）', credits: specialized }), true);
}

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
}

test('initial credits come from required courses in years 1–3 only', () => {
  const { total, grades, conditions } = calculateCredits(createState());
  assert.deepEqual(total, { general: 62, specialized: 34, total: 96 });
  for (const [grade, baseline] of Object.entries(INITIAL_REQUIRED_BY_GRADE)) {
    assert.deepEqual(grades[grade], { ...baseline, total: baseline.general + baseline.specialized });
  }
  assert.equal(grades[4].total, 0);
  assert.equal(grades[5].total, 0);
  assert.deepEqual(conditions.promotion, { current: 96, required: 128, remaining: 32, met: false });
  assert.equal(getCourseStatus(createState(), LOWER_REQUIRED_COURSES[0]).earned, true);
  assert.equal(setCourseEarned(createState(), LOWER_REQUIRED_COURSES[0], false), false);
});

test('lower-year electives and upper-year required courses count only while earned', () => {
  const state = createState();
  const preResearch = courseById('g1-253105');
  const laboratory = courseById('g4-253125');

  assert.equal(getCourseStatus(state, preResearch).earned, false);
  assert.equal(getCourseStatus(state, laboratory).earned, false);
  earn(state, preResearch);
  earn(state, laboratory);
  assert.deepEqual(calculateCredits(state).total, { general: 62, specialized: 39, total: 101 });

  assert.equal(setCourseEarned(state, laboratory, false), true);
  assert.equal(calculateCredits(state).total.specialized, 35);
  assert.equal(setCourseEarned(state, preResearch, false), true);
  assert.equal(calculateCredits(state).total.total, 96);
});

test('upper-year electives require enrollment and earning, and withdrawal clears both', () => {
  const state = createState();
  const elective = courseById('g4-251134');
  assert.deepEqual(getCourseStatus(state, elective), { enrolled: false, earned: false });
  assert.equal(setCourseEarned(state, elective, true), false);
  assert.equal(setCourseEnrollment(state, elective, true), true);
  assert.equal(calculateCredits(state).total.total, 96);
  assert.equal(setCourseEarned(state, elective, true), true);
  assert.equal(calculateCredits(state).total.total, 96 + elective.credits);
  assert.equal(setCourseEnrollment(state, elective, false), true);
  assert.equal(calculateCredits(state).total.total, 96);
  assert.equal(setCourseEnrollment(state, elective, true), true);
  assert.deepEqual(getCourseStatus(state, elective), { enrolled: true, earned: false });
});

test('promotion reaches 128 exactly and excludes courses earned in year 5', () => {
  const state = createState();
  const yearFive = COURSES.find(course => course.grade === 5 && course.required);
  earn(state, yearFive);
  assert.equal(updateExternalCredit(state, 'external-general-a', { name: '学外集中講座', credits: 31 }), true);
  let result = calculateCredits(state);
  assert.ok(result.total.total >= 128);
  assert.deepEqual(result.conditions.promotion, { current: 127, required: 128, remaining: 1, met: false });

  assert.equal(updateExternalCredit(state, 'external-general-a', { name: '学外集中講座', credits: 32 }), true);
  result = calculateCredits(state);
  assert.deepEqual(result.conditions.promotion, { current: 128, required: 128, remaining: 0, met: true });
});

test('recommendation independently checks 55 specialized and 10 designated credits', () => {
  const state = createState();
  const designated = COURSES.filter(course => course.recommendation);
  const laboratory = courseById('g4-253125');
  assert.equal(designated.length, 7);
  assert.equal(designated.reduce((sum, course) => sum + course.credits, 0), 14);
  for (const course of designated) {
    if (course !== laboratory) earn(state, course);
  }

  external(state, 1, 10);
  let { recommendation } = calculateCredits(state).conditions;
  assert.deepEqual(recommendation.specialized, { current: 54, required: 55, remaining: 1, met: false });
  assert.deepEqual(recommendation.designated, { current: 10, required: 10, remaining: 0, met: true });
  assert.equal(recommendation.met, false);

  external(state, 1, 11);
  recommendation = calculateCredits(state).conditions.recommendation;
  assert.deepEqual(recommendation.specialized, { current: 55, required: 55, remaining: 0, met: true });
  assert.equal(recommendation.met, true);

  assert.equal(setCourseEarned(state, courseById('g4-253124'), false), true);
  external(state, 1, 12);
  recommendation = calculateCredits(state).conditions.recommendation;
  assert.equal(recommendation.specialized.met, true);
  assert.deepEqual(recommendation.designated, { current: 9, required: 10, remaining: 1, met: false });
  assert.equal(recommendation.met, false);

  for (const course of designated) earn(state, course);
  recommendation = calculateCredits(state).conditions.recommendation;
  assert.equal(recommendation.designated.current, 14);
  assert.equal(recommendation.designated.remaining, 0);
});

test('graduation checks total, general and specialized credits independently', () => {
  const state = createState();
  external(state, 13, 48);
  let { graduation } = calculateCredits(state).conditions;
  assert.deepEqual(graduation.total, { current: 157, required: 167, remaining: 10, met: false });
  assert.deepEqual(graduation.general, { current: 75, required: 75, remaining: 0, met: true });
  assert.deepEqual(graduation.specialized, { current: 82, required: 82, remaining: 0, met: true });
  assert.equal(graduation.met, false);

  external(state, 12, 59);
  graduation = calculateCredits(state).conditions.graduation;
  assert.equal(graduation.total.met, true);
  assert.equal(graduation.general.remaining, 1);
  assert.equal(graduation.met, false);

  external(state, 24, 47);
  graduation = calculateCredits(state).conditions.graduation;
  assert.equal(graduation.total.met, true);
  assert.equal(graduation.specialized.remaining, 1);
  assert.equal(graduation.met, false);

  external(state, 23, 48);
  graduation = calculateCredits(state).conditions.graduation;
  assert.equal(graduation.total.current, 167);
  assert.equal(graduation.met, true);
});

test('TOEIC score boundaries map to the official bands', () => {
  for (const [score, credits] of [
    [399, undefined], [400, 1], [449, 1], [450, 2], [599, 2],
    [600, 4], [729, 4], [730, 6], [990, 6], [991, undefined],
  ]) {
    assert.equal(getToeicOption(score)?.credits, credits);
  }
  assert.equal(getToeicOption(450.5), undefined);
});

test('recognized options add only their thick group maximum while separate groups add', () => {
  const state = createState();
  assert.equal(setCertificationStatus(state, 'toeic-400', 'recognized'), true);
  assert.equal(setCertificationStatus(state, 'toeic-450', 'recognized'), true);
  assert.equal(setCertificationStatus(state, 'toeic-730', 'passed'), true);
  assert.equal(calculateCredits(state).certification.groups.toeic, 2);
  assert.equal(calculateCredits(state).certification.total, 2);

  assert.equal(setCertificationStatus(state, 'eiken-pre-1', 'recognized'), true);
  assert.equal(setCertificationStatus(state, 'kanken-2-or-higher', 'recognized'), true);
  const result = calculateCredits(state);
  assert.equal(result.certification.groups.toeic, 4);
  assert.equal(result.certification.groups.kanken, 2);
  assert.equal(result.certification.total, 6);
  assert.equal(result.conditions.promotion.current, 102);
});

test('passing a qualification without school recognition contributes zero', () => {
  const state = createState();
  assert.equal(setCertificationStatus(state, 'ipa-ap', 'passed'), true);
  assert.equal(calculateCredits(state).certification.total, 0);
  assert.equal(setCertificationStatus(state, 'ipa-ap', 'recognized'), true);
  assert.equal(calculateCredits(state).conditions.recommendation.specialized.current, 38);
  assert.equal(setCertificationStatus(state, 'ipa-ap', 'unearned'), true);
  assert.equal(calculateCredits(state).certification.total, 0);
});

test('explicit course equivalents count once in the earliest selected year', () => {
  const state = createState();
  const yearFour = courseById('g4-251134');
  const yearFive = courseById('g5-251151');
  assert.equal(yearFour.equivalentGroup, yearFive.equivalentGroup);

  earn(state, yearFive);
  let result = calculateCredits(state);
  assert.equal(result.grades[5].total, yearFive.credits);
  assert.equal(result.conditions.promotion.current, 96);

  earn(state, yearFour);
  result = calculateCredits(state);
  assert.equal(result.total.total, 96 + yearFour.credits);
  assert.equal(result.grades[4].total, yearFour.credits);
  assert.equal(result.grades[5].total, 0);
  assert.equal(result.conditions.promotion.current, 96 + yearFour.credits);

  assert.equal(setCourseEarned(state, yearFour, false), true);
  assert.equal(calculateCredits(state).grades[5].total, yearFive.credits);
});

test('namesake course listings are independent unless explicitly grouped', () => {
  const first = { id: 'test-4', name: '同名科目', grade: 4, category: 'general', required: true, credits: 2 };
  const second = { ...first, id: 'test-5', grade: 5 };
  const state = createState();
  earn(state, first);
  earn(state, second);
  assert.equal(calculateCredits(state, { courses: [first, second] }).total.total, 100);
});

test('external recognition slots enforce categories, real unit numbers and distinct names', () => {
  const state = createState();
  const general = 'external-general-a';
  const specialized = 'external-specialized-a';
  assert.equal(isExternalCreditNameDuplicate(state, general, ' ＴＯＥＩＣ '), true);
  assert.equal(isExternalCreditNameDuplicate(state, general, '電 気 回 路 I'), true);
  assert.equal(updateExternalCredit(state, general, { name: 'TOEIC', credits: 2 }), false);
  for (const credits of [-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.equal(updateExternalCredit(state, general, { name: '学外研修', credits }), false);
  }
  assert.equal(updateExternalCredit(state, 'unknown', { name: '学外研修', credits: 3 }), false);
  assert.equal(updateExternalCredit(state, general, { name: ' 学外研修 ', category: 'specialized', credits: 3 }), true);
  assert.equal(updateExternalCredit(state, specialized, { name: '学外 研修', credits: 4 }), false);
  assert.deepEqual(calculateCredits(state).external, { general: 3, specialized: 0, total: 3 });
  assert.equal(removeExternalCredit(state, general), true);
  assert.equal(calculateCredits(state).external.total, 0);
});

test('versioned localStorage round-trips and resets all recognized and earned inputs', () => {
  const state = createState();
  const storage = createMemoryStorage();
  assert.deepEqual(loadState(storage), state);

  earn(state, courseById('g4-253125'));
  assert.equal(setCourseEnrollment(state, courseById('g5-251151'), true), true);
  assert.equal(setCertificationStatus(state, 'toeic-450', 'recognized'), true);
  assert.equal(setToeic(state, 450, false), true);
  external(state, 2, 3);
  assert.equal(saveState(state, storage), true);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 1);
  assert.deepEqual(loadState(storage), state);
  assert.deepEqual(calculateCredits(loadState(storage)), calculateCredits(state));
  assert.deepEqual(resetState(storage), createState());
  assert.deepEqual(loadState(storage), createState());
});

test('unrecognized records and malformed storage do not affect totals', () => {
  const storage = createMemoryStorage();
  const state = createState();
  storage.setItem(STORAGE_KEY, '{');
  assert.deepEqual(loadState(storage), state);

  const invalid = createState();
  invalid.courses['g4-251134'] = { enrolled: false, earned: true };
  invalid.certifications['toeic-450'] = 'unknown';
  invalid.external.push({ id: 'external-general-a', name: '学外研修', credits: -2 });
  storage.setItem(STORAGE_KEY, JSON.stringify(invalid));
  assert.deepEqual(loadState(storage), state);
  assert.equal(calculateCredits(loadState(storage)).total.total, 96);

  const future = JSON.stringify({ ...state, version: 2 });
  storage.setItem(STORAGE_KEY, future);
  assert.deepEqual(loadState(storage), state);
  assert.equal(saveState(state, storage), false);
  assert.equal(storage.getItem(STORAGE_KEY), future);
});

test('fixed rows and their group identifiers are internally consistent', () => {
  const courseIds = new Set(COURSES.map(course => course.id));
  assert.equal(courseIds.size, COURSES.length);
  const equivalentCourses = new Map();
  for (const course of COURSES) {
    if (!course.equivalentGroup) continue;
    const terms = [course.category, course.credits];
    const previous = equivalentCourses.get(course.equivalentGroup);
    if (previous) assert.deepEqual(terms, previous, course.id);
    equivalentCourses.set(course.equivalentGroup, terms);
  }

  const groupIds = new Set(CERTIFICATION_GROUPS.map(group => group.id));
  assert.equal(groupIds.size, CERTIFICATION_GROUPS.length);
  const options = CERTIFICATION_GROUPS.flatMap(group => group.options);
  assert.equal(new Set(options.map(option => option.id)).size, options.length);
});
