import assert from 'node:assert/strict';
import test from 'node:test';
import { CERTIFICATION_GROUPS } from '../js/cert-data.js';
import { COURSES, INITIAL_REQUIRED_BY_GRADE, LOWER_REQUIRED_COURSES } from '../js/course-data.js';
import { NEW_COURSE_IDS, PREVIOUS_COURSE_ALIASES } from '../js/course-migration.js';
import {
  addExternalCredit,
  calculateCredits,
  createState,
  getCourseStatus,
  isExternalCreditNameDuplicate,
  loadState,
  removeExternalCredit,
  resetState,
  saveState,
  setCertificationEarned,
  setCourseEarned,
  STORAGE_KEY,
  updateExternalCredit,
} from '../js/model.js';

function courseById(id) {
  const course = COURSES.find(item => item.id === id);
  assert.ok(course, id);
  return course;
}

function earn(state, course) {
  assert.equal(setCourseEarned(state, course, true), true);
}

function setExternal(state, name, category, credits) {
  const current = state.external.find(record => record.name === name);
  const values = { name, category, credits };
  if (current) assert.equal(updateExternalCredit(state, current.id, values), true);
  else assert.ok(addExternalCredit(state, values));
}

function external(state, general, specialized) {
  setExternal(state, '学外研修（一般）', 'general', general);
  setExternal(state, '学外研究（専門）', 'specialized', specialized);
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
  assert.deepEqual(conditions.promotion, {
    credits: { current: 96, required: 128, remaining: 32, met: false },
    labEarned: false,
    met: false,
  });
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

test('upper-year electives can be marked earned directly', () => {
  const state = createState();
  const elective = courseById('g4-251134');
  assert.deepEqual(getCourseStatus(state, elective), { earned: false });
  earn(state, elective);
  assert.equal(calculateCredits(state).total.total, 96 + elective.credits);
  assert.equal(setCourseEarned(state, elective, false), true);
  assert.equal(calculateCredits(state).total.total, 96);
});

test('promotion requires both 128 through year 4 and the year-4 laboratory', () => {
  const state = createState();
  const yearFive = COURSES.find(course => course.grade === 5 && course.required);
  const laboratory = courseById('g4-253125');
  earn(state, yearFive);
  setExternal(state, '学外集中講座', 'general', 32);
  let result = calculateCredits(state);
  assert.ok(result.total.total >= 128);
  assert.deepEqual(result.conditions.promotion, {
    credits: { current: 128, required: 128, remaining: 0, met: true },
    labEarned: false,
    met: false,
  });

  earn(state, laboratory);
  setExternal(state, '学外集中講座', 'general', 27);
  result = calculateCredits(state);
  assert.ok(result.total.total >= 128);
  assert.deepEqual(result.conditions.promotion, {
    credits: { current: 127, required: 128, remaining: 1, met: false },
    labEarned: true,
    met: false,
  });

  setExternal(state, '学外集中講座', 'general', 28);
  result = calculateCredits(state);
  assert.deepEqual(result.conditions.promotion, {
    credits: { current: 128, required: 128, remaining: 0, met: true },
    labEarned: true,
    met: true,
  });
});

test('recommendation independently checks 55 specialized and 10 designated credits', () => {
  const state = createState();
  const designated = COURSES.filter(course => course.recommendation);
  const yearFourSpecializedRequired = COURSES.filter(course => (
    course.grade === 4 && course.category === 'specialized' && course.required
  ));
  const laboratory = courseById('g4-253125');
  assert.equal(designated.length, 7);
  assert.deepEqual(designated, yearFourSpecializedRequired);
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

test('graduation reports remaining mandatory courses separately from its credit thresholds', () => {
  const state = createState();
  const required = COURSES.filter(course => course.grade >= 4 && course.required);
  assert.equal(required.length, 13);
  assert.equal(calculateCredits(state).conditions.graduation.requiredCoursesRemaining, 13);

  for (const course of required) earn(state, course);
  let { graduation } = calculateCredits(state).conditions;
  assert.equal(graduation.requiredCoursesRemaining, 0);
  assert.equal(graduation.met, false);

  assert.equal(setCourseEarned(state, required[0], false), true);
  external(state, 23, 48);
  graduation = calculateCredits(state).conditions.graduation;
  assert.equal(graduation.requiredCoursesRemaining, 1);
  assert.equal(graduation.met, true);
});

test('the fixed TOEIC score bands and credits remain available as options', () => {
  const group = CERTIFICATION_GROUPS.find(item => item.id === 'toeic');
  assert.deepEqual(group.options
    .filter(option => option.name === 'TOEIC')
    .map(option => [option.minScore, option.maxScore, option.credits]), [
    [730, 990, 6], [600, 729, 4], [450, 599, 2], [400, 449, 1],
  ]);
});

test('an acquired option replaces the previous option in its thick group', () => {
  const state = createState();
  assert.equal(setCertificationEarned(state, 'toeic-400', true), true);
  assert.equal(setCertificationEarned(state, 'toeic-450', true), true);
  assert.deepEqual(state.certifications, { 'toeic-450': true });
  assert.equal(calculateCredits(state).certification.groups.toeic, 2);

  assert.equal(setCertificationEarned(state, 'eiken-pre-1', true), true);
  assert.equal(setCertificationEarned(state, 'kanken-2-or-higher', true), true);
  const result = calculateCredits(state);
  assert.deepEqual(state.certifications, { 'eiken-pre-1': true, 'kanken-2-or-higher': true });
  assert.equal(result.certification.groups.toeic, 4);
  assert.equal(result.certification.groups.kanken, 2);
  assert.equal(result.certification.total, 6);
  assert.equal(result.conditions.promotion.credits.current, 102);

  assert.equal(setCertificationEarned(state, 'toeic-400', true), true);
  assert.equal(setCertificationEarned(state, 'eiken-pre-1', false), true);
  assert.deepEqual(state.certifications, { 'toeic-400': true, 'kanken-2-or-higher': true });
  assert.equal(calculateCredits(state).certification.total, 3);
});

test('checking or clearing a qualification immediately updates specialized credits', () => {
  const state = createState();
  assert.equal(setCertificationEarned(state, 'unknown', true), false);
  assert.equal(setCertificationEarned(state, 'ipa-ap', 'passed'), false);
  assert.equal(calculateCredits(state).certification.total, 0);
  assert.equal(setCertificationEarned(state, 'ipa-ap', true), true);
  assert.equal(calculateCredits(state).conditions.recommendation.specialized.current, 38);
  assert.equal(setCertificationEarned(state, 'ipa-ap', false), true);
  assert.equal(calculateCredits(state).certification.total, 0);
});

test('explicit course equivalents count once in the earliest selected year', () => {
  const state = createState();
  const yearFour = courseById('g4-253150');
  const yearFive = courseById('g5-253183');
  assert.equal(yearFour.equivalentGroup, yearFive.equivalentGroup);

  earn(state, yearFive);
  let result = calculateCredits(state);
  assert.equal(result.grades[5].total, yearFive.credits);
  assert.equal(result.conditions.promotion.credits.current, 96);

  earn(state, yearFour);
  result = calculateCredits(state);
  assert.equal(result.total.total, 96 + yearFour.credits);
  assert.equal(result.grades[4].total, yearFour.credits);
  assert.equal(result.grades[5].total, 0);
  assert.equal(result.conditions.promotion.credits.current, 96 + yearFour.credits);

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

test('external recognition enforces categories, whole credit numbers and distinct names', () => {
  const state = createState();
  assert.equal(isExternalCreditNameDuplicate(state, null, ' ＴＯＥＩＣ '), true);
  assert.equal(isExternalCreditNameDuplicate(state, null, '電 気 回 路 I'), true);
  assert.equal(addExternalCredit(state, { name: 'TOEIC', category: 'general', credits: 2 }), null);
  for (const credits of [-1, 0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.equal(addExternalCredit(state, { name: '学外研修', category: 'general', credits }), null);
  }
  assert.equal(addExternalCredit(state, { name: '学外研修', category: 'other', credits: 1 }), null);
  assert.equal(addExternalCredit(state, { name: ' ', category: 'general', credits: 1 }), null);
  assert.equal(updateExternalCredit(state, 'unknown', { name: '学外研修', credits: 3 }), false);
  const general = addExternalCredit(state, { name: ' 学外研修 ', category: 'general', credits: 3 });
  assert.ok(general);
  const specialized = addExternalCredit(state, { name: '学外研究', category: 'specialized', credits: 4 });
  assert.ok(specialized);
  assert.equal(updateExternalCredit(state, specialized, { name: '学外 研修', credits: 4 }), false);
  assert.equal(addExternalCredit(state, { name: '学 外 研 修', category: 'specialized', credits: 1 }), null);
  assert.deepEqual(calculateCredits(state).external, { general: 3, specialized: 4, total: 7 });
  assert.equal(removeExternalCredit(state, general), true);
  assert.equal(calculateCredits(state).external.total, 4);
});

test('additional external entries retain unique IDs and support reclassification and removal', () => {
  const state = createState();
  const storage = createMemoryStorage();
  const ids = [];
  for (let index = 1; index <= 8; index += 1) {
    const id = addExternalCredit(state, { name: `外部研修・第${index}期`, category: 'general', credits: index });
    assert.ok(id);
    ids.push(id);
  }
  assert.equal(new Set(ids).size, 8);
  assert.deepEqual(calculateCredits(state).external, { general: 36, specialized: 0, total: 36 });
  assert.equal(updateExternalCredit(state, ids[0], { name: '学外集中研修', credits: 3, category: 'specialized' }), true);
  assert.equal(removeExternalCredit(state, ids[2]), true);
  assert.equal(updateExternalCredit(state, ids[2], { name: '学外集中研修', credits: 3 }), false);
  assert.deepEqual(calculateCredits(state).external, { general: 32, specialized: 3, total: 35 });
  assert.equal(saveState(state, storage), true);
  assert.deepEqual(loadState(storage), state);
});

test('versioned localStorage round-trips and resets all acquired and external inputs', () => {
  const state = createState();
  const storage = createMemoryStorage();
  assert.deepEqual(loadState(storage), state);

  earn(state, courseById('g4-253125'));
  earn(state, courseById('g4-253150'));
  earn(state, courseById('g5-253179'));
  assert.equal(setCertificationEarned(state, 'toeic-450', true), true);
  external(state, 2, 3);
  assert.equal(saveState(state, storage), true);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 4);
  assert.deepEqual(loadState(storage), state);
  assert.deepEqual(calculateCredits(loadState(storage)), calculateCredits(state));
  assert.deepEqual(resetState(storage), createState());
  assert.deepEqual(loadState(storage), createState());
});

test('version 1 storage migrates earned courses, qualifications and external credits', () => {
  const storage = createMemoryStorage();
  const legacy = {
    version: 1,
    courses: {
      'g4-253125': { earned: true },
      'g4-251134': { enrolled: true, earned: true },
      'g5-251151': { enrolled: true, earned: false },
      'g5-251158': { enrolled: false, earned: true },
      'g5-253158': { enrolled: true, earned: true },
    },
    certifications: { 'toeic-450': 'recognized', 'ipa-ap': 'passed' },
    toeic: { score: 450, online: false },
    external: [{ id: 'external-general-a', name: '学外研修', category: 'general', credits: 3 }],
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

  const state = loadState(storage);
  assert.equal(state.version, 4);
  assert.deepEqual(state.courses, {
    'g4-253125': { earned: true },
    'g4-251134': { earned: true },
    'g4-253126': { earned: true },
  });
  assert.deepEqual(state.certifications, { 'toeic-450': true, 'ipa-ap': true });
  assert.equal('toeic' in state, false);
  assert.deepEqual(state.external, legacy.external);
  assert.equal(calculateCredits(state).total.total, 113);
  assert.equal(saveState(state, storage), true);
  assert.deepEqual(loadState(storage), state);
});

test('version 2 acquisitions migrate to the equivalent courses in their listed grades', () => {
  const storage = createMemoryStorage();
  const yearFour = courseById('g4-253126');
  const yearFive = courseById('g5-253164');
  const legacy = {
    version: 2,
    courses: {
      'g4-253132': { earned: true, planned: true },
      'g5-253158': { earned: true },
      'g5-251151': { earned: false, planned: true },
      'g4-253150': { earned: true },
      [yearFour.id]: { earned: false },
      [yearFive.id]: { earned: true },
    },
    certifications: { 'toeic-450': 'recognized' },
    toeic: { score: 450, online: false },
    external: [{ id: 'external-general-a', name: '学外研修', category: 'general', credits: 3 }],
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

  const state = loadState(storage);
  assert.deepEqual(state.courses, {
    [yearFour.id]: { earned: true },
    [yearFive.id]: { earned: true },
  });
  assert.deepEqual(state.certifications, { 'toeic-450': true });
  assert.equal('toeic' in state, false);
  assert.deepEqual(state.external, legacy.external);
  const result = calculateCredits(state);
  assert.equal(result.grades[4].total, yearFour.credits);
  assert.equal(result.grades[5].total, yearFive.credits);
  assert.equal(result.total.total, 101 + yearFour.credits + yearFive.credits);
  assert.equal(result.conditions.promotion.credits.current, 101 + yearFour.credits);
  assert.equal(saveState(state, storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), state);
  assert.deepEqual(loadState(storage), state);
});

test('version 3 retains all six external entries and migrates one highest acquired qualification per group', () => {
  const storage = createMemoryStorage();
  const legacy = {
    version: 3,
    courses: { 'g4-253150': { earned: true } },
    certifications: {
      'toeic-400': 'recognized',
      'toeic-450': 'passed',
      'eiken-pre-2': 'recognized',
      'ipa-ap': 'passed',
    },
    toeic: { score: 450, online: false },
    external: ['general', 'specialized'].flatMap(category => (
      ['a', 'b', 'c'].map((slot, index) => ({
        id: `external-${category}-${slot}`,
        name: `外部受講${category}${index + 1}`,
        category,
        credits: index + 1,
      }))
    )),
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

  const state = loadState(storage);
  assert.deepEqual(state.courses, legacy.courses);
  assert.deepEqual(state.certifications, { 'toeic-450': true, 'ipa-ap': true });
  assert.deepEqual(calculateCredits(state).certification.groups.toeic, 2);
  assert.equal('toeic' in state, false);
  assert.deepEqual(state.external, legacy.external);

  const id = 'external-general-a';
  assert.equal(updateExternalCredit(state, id, { name: '別の科目名', category: 'specialized', credits: 3 }), true);
  assert.ok(addExternalCredit(state, { name: '新規の学外講座', category: 'general', credits: 1 }));
  assert.equal(state.external.length, 7);
  assert.deepEqual(calculateCredits(state).external, { general: 6, specialized: 9, total: 15 });
  assert.equal(saveState(state, storage), true);
  assert.deepEqual(loadState(storage), state);
  assert.equal(removeExternalCredit(state, id), true);
  assert.equal(updateExternalCredit(state, id, { name: '別の科目名', category: 'general', credits: 3 }), false);
});

test('unrecognized records and malformed storage do not affect totals', () => {
  const storage = createMemoryStorage();
  const state = createState();
  storage.setItem(STORAGE_KEY, '{');
  assert.deepEqual(loadState(storage), state);

  const invalid = createState();
  invalid.courses['g4-251134'] = { earned: 'true' };
  invalid.certifications['toeic-450'] = 'unknown';
  invalid.external.push({ id: 'external-general-a', name: '学外研修', credits: -2 });
  storage.setItem(STORAGE_KEY, JSON.stringify(invalid));
  assert.deepEqual(loadState(storage), state);
  assert.equal(calculateCredits(loadState(storage)).total.total, 96);

  const future = JSON.stringify({ ...state, version: 5 });
  storage.setItem(STORAGE_KEY, future);
  assert.deepEqual(loadState(storage), state);
  assert.equal(saveState(state, storage), false);
  assert.equal(storage.getItem(STORAGE_KEY), future);
});

test('fixed rows and their group identifiers are internally consistent', () => {
  const courseIds = new Set(COURSES.map(course => course.id));
  assert.equal(courseIds.size, COURSES.length);
  for (const [previousId, currentId] of Object.entries(PREVIOUS_COURSE_ALIASES)) {
    assert.equal(courseIds.has(previousId), false, previousId);
    assert.ok(courseIds.has(currentId), currentId);
  }
  for (const id of NEW_COURSE_IDS) assert.ok(courseIds.has(id), id);
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
