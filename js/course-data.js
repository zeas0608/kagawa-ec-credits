// 香川高専 電気情報工学科（2019年度以降入学者）の公開シラバス。
// 1〜3年は2025年度の既修課程、4・5年は2026年度の開講科目。
const syllabusBaseUrl = "https://syllabus.kosen-k.go.jp/Pages";
const syllabusDepartment = "school_id=39&department_id=32";
export const SYLLABUS_YEAR = 2026;
export const SYLLABUS_URL = `${syllabusBaseUrl}/PublicSubjects?${syllabusDepartment}&year=${SYLLABUS_YEAR}&lang=ja`;

// 初期取得単位は2025年度学校要覧の教育課程表と利用者指定の内訳に基づく。
// 芸術（美術・音楽）は一般必修の芸術2単位として計上。
// https://www.kagawa-nct.ac.jp/prospectus/publication/yoran/yoran_jp2025_03.pdf
export const INITIAL_REQUIRED_BY_GRADE = Object.freeze({
  1: Object.freeze({ general: 24, specialized: 8 }),
  2: Object.freeze({ general: 24, specialized: 8 }),
  3: Object.freeze({ general: 14, specialized: 18 }),
});

// 学校要覧で「いずれかの学年で修得できる」とされる科目の学年別の科目番号。
// 配列の先頭は集計用IDとして使う。
const equivalentCodes = [
  ["251133", "251150", "251167"], // 海外英語演習
  ["253146", "253179"], // 校外実習
  ["253147", "253180"], // 特別講義Ⅰ
  ["253148", "253181"], // 特別講義Ⅱ
  ["253150", "253183"], // 特別講義Ⅳ
];
const groupByCode = new Map(
  equivalentCodes.flatMap((codes) => codes.map((code) => [code, `ec-${codes[0]}`])),
);

// 学校推薦の単位集計に使う4年の指定7科目。
const recommendationCodes = new Set([
  "253121", // 電気回路Ⅰ
  "253120", // 電磁気学Ⅰ
  "253123", // 電子回路Ⅰ
  "253122", // 論理回路
  "253119", // 応用数学Ⅱ
  "253124", // 情報数学
  "253125", // 電気情報工学実験Ⅱ
]);

function course([grade, code, name, category, required, credits]) {
  const academicYear = grade <= 3 ? 2025 : SYLLABUS_YEAR;
  // 個別シラバスの year には入学年度を指定する。
  const admissionYear = academicYear - grade + 1;
  return Object.freeze({
    id: `g${grade}-${code}`,
    code,
    name,
    grade,
    category,
    required,
    credits,
    syllabusUrl: `${syllabusBaseUrl}/PublicSyllabus?${syllabusDepartment}&subject_code=${code}&year=${admissionYear}&lang=ja`,
    equivalentGroup: groupByCode.get(code),
    recommendation: recommendationCodes.has(code),
  });
}

// 学年, 科目番号, 科目名, 一般/専門, 必修, 単位数。
export const LOWER_REQUIRED_COURSES = Object.freeze([
  [1, "251101", "国語Ⅰ", "general", true, 2],
  [1, "251102", "社会Ⅰ", "general", true, 2],
  [1, "251103", "数学ⅠA", "general", true, 2],
  [1, "251104", "数学ⅠB", "general", true, 2],
  [1, "251105", "数学ⅠC", "general", true, 2],
  [1, "251106", "数学ⅠD", "general", true, 2],
  [1, "251107", "化学Ⅰ", "general", true, 2],
  [1, "251108", "保健・体育Ⅰ", "general", true, 2],
  [1, "251109", "英語ⅠＡ", "general", true, 2],
  [1, "251110", "英語ⅠＢ", "general", true, 2],
  [1, "251111", "表現コミュニケーションⅠ", "general", true, 2],
  [1, "251112", "芸術（美術）", "general", true, 2],
  [1, "251113", "芸術（音楽）", "general", true, 2],
  [1, "253101", "工学リテラシー", "specialized", true, 2],
  [1, "253102", "電気情報基礎Ⅰ（電気）", "specialized", true, 2],
  [1, "253103", "電気情報基礎Ⅰ（情報）", "specialized", true, 2],
  [1, "253104", "創造工学実験実習Ⅰ", "specialized", true, 2],
  [2, "251114", "国語Ⅱ", "general", true, 2],
  [2, "251115", "社会Ⅱ", "general", true, 2],
  [2, "251116", "数学ⅡＡ", "general", true, 2],
  [2, "251117", "数学ⅡＢ", "general", true, 2],
  [2, "251118", "数学ⅡＣ", "general", true, 2],
  [2, "251119", "数学ⅡＤ", "general", true, 2],
  [2, "251120", "物理学Ⅰ", "general", true, 2],
  [2, "251121", "化学Ⅱ", "general", true, 2],
  [2, "251122", "保健・体育Ⅱ", "general", true, 2],
  [2, "251123", "英語ⅡＡ", "general", true, 2],
  [2, "251124", "英語ⅡＢ", "general", true, 2],
  [2, "251125", "表現コミュニケーションⅡ", "general", true, 2],
  [2, "253106", "電気情報基礎Ⅱ（電気）", "specialized", true, 2],
  [2, "253107", "電気情報基礎Ⅱ（情報）", "specialized", true, 1],
  [2, "253108", "電気情報基礎Ⅱ（物理）", "specialized", true, 1],
  [2, "253109", "創造工学実験実習Ⅱ（電気）", "specialized", true, 2],
  [2, "253110", "創造工学実験実習Ⅱ（情報）", "specialized", true, 2],
  [3, "251126", "国語Ⅲ", "general", true, 2],
  [3, "251127", "数学ⅢＡ", "general", true, 2],
  [3, "251128", "数学ⅢＢ", "general", true, 2],
  [3, "251129", "物理学Ⅱ", "general", true, 2],
  [3, "251130", "保健・体育Ⅲ", "general", true, 2],
  [3, "251131", "英語ⅢＡ", "general", true, 2],
  [3, "251132", "英語ⅢＢ", "general", true, 2],
  [3, "253112", "応用数学Ⅰ", "specialized", true, 2],
  [3, "253113", "電気基礎", "specialized", true, 4],
  [3, "253114", "電子工学基礎", "specialized", true, 4],
  [3, "253115", "情報処理基礎", "specialized", true, 4],
  [3, "253116", "電気情報工学実験Ⅰ", "specialized", true, 4],
].map(course));

export const COURSES = Object.freeze([
  // 1〜3年 選択
  [1, "253105", "プレ研究Ⅰ", "specialized", false, 1],
  [2, "253111", "プレ研究Ⅱ", "specialized", false, 1],
  [3, "251133", "海外英語演習", "general", false, 1],
  [3, "253117", "プレ研究Ⅲ", "specialized", false, 1],
  [3, "253118", "ソフトウェア特別実習Ⅰ", "specialized", false, 4],

  // 4年
  [4, "251134", "文学特論Ⅰ", "general", false, 2],
  [4, "251135", "人文科学Ⅰ", "general", false, 2],
  [4, "251136", "人文科学Ⅱ", "general", false, 2],
  [4, "251141", "化学概論Ⅰ", "general", false, 2],
  [4, "251142", "化学概論Ⅱ", "general", false, 2],
  [4, "251143", "体育Ⅰ", "general", false, 1],
  [4, "251144", "英語ⅣＡ", "general", false, 2],
  [4, "251145", "英語ⅣＢ", "general", false, 2],
  [4, "251148", "語学特講Ⅲ（中国語）", "general", false, 2],
  [4, "251149", "語学特講Ⅳ（中国語）", "general", false, 2],
  [4, "251150", "海外英語演習", "general", false, 1],
  [4, "253119", "応用数学Ⅱ", "specialized", true, 2],
  [4, "253120", "電磁気学Ⅰ", "specialized", true, 2],
  [4, "253121", "電気回路Ⅰ", "specialized", true, 2],
  [4, "253122", "論理回路", "specialized", true, 2],
  [4, "253123", "電子回路Ⅰ", "specialized", true, 1],
  [4, "253124", "情報数学", "specialized", true, 1],
  [4, "253125", "電気情報工学実験Ⅱ", "specialized", true, 4],
  [4, "253126", "半導体物理", "specialized", false, 2],
  [4, "253127", "電磁気学Ⅱ", "specialized", false, 2],
  [4, "253128", "電気回路Ⅱ", "specialized", false, 2],
  [4, "253129", "計測工学", "specialized", false, 2],
  [4, "253131", "電子回路Ⅱ", "specialized", false, 2],
  [4, "253137", "情報通信ネットワーク", "specialized", false, 2],
  [4, "253138", "アルゴリズム", "specialized", false, 2],
  [4, "253139", "計算機アーキテクチャ", "specialized", false, 2],
  [4, "253140", "オペレーティングシステム", "specialized", false, 2],
  [4, "253146", "校外実習", "specialized", false, 1],
  [4, "253147", "特別講義Ⅰ", "specialized", false, 1],
  [4, "253148", "特別講義Ⅱ", "specialized", false, 1],
  [4, "253150", "特別講義Ⅳ", "specialized", false, 1],
  [4, "253151", "ソフトウェア特別実習Ⅱ", "specialized", false, 4],

  // 5年
  [5, "251155", "社会科学Ⅰ", "general", false, 2],
  [5, "251160", "体育Ⅱ", "general", false, 1],
  [5, "251161", "英語ⅤＡ", "general", false, 2],
  [5, "251162", "英語ⅤＢ", "general", false, 2],
  [5, "251163", "語学特講Ⅰ（ドイツ語）", "general", false, 2],
  [5, "251164", "語学特講Ⅱ（ドイツ語）", "general", false, 2],
  [5, "251167", "海外英語演習", "general", false, 1],
  [5, "253152", "科学技術史概論", "specialized", true, 1],
  [5, "253153", "知的財産概論", "specialized", true, 1],
  [5, "253154", "電気情報工学応用実験", "specialized", true, 4],
  [5, "253155", "卒業研究", "specialized", true, 8],
  [5, "253156", "回路設計（電子設計）", "specialized", true, 1],
  [5, "253157", "回路設計（論理設計）", "specialized", true, 1],
  [5, "253162", "電気電子材料", "specialized", false, 2],
  [5, "253164", "電子回路Ⅲ", "specialized", false, 2],
  [5, "253165", "エネルギー変換工学", "specialized", false, 2],
  [5, "253166", "制御工学", "specialized", false, 2],
  [5, "253167", "電子デバイス", "specialized", false, 2],
  [5, "253168", "通信工学", "specialized", false, 2],
  [5, "253173", "信号処理", "specialized", false, 2],
  [5, "253174", "情報・符号理論", "specialized", false, 2],
  [5, "253175", "知能情報処理", "specialized", false, 2],
  [5, "253176", "数値解析", "specialized", false, 2],
  [5, "253177", "統計データ処理", "specialized", false, 2],
  [5, "253178", "科学技術英語", "specialized", false, 2],
  [5, "253179", "校外実習", "specialized", false, 1],
  [5, "253180", "特別講義Ⅰ", "specialized", false, 1],
  [5, "253181", "特別講義Ⅱ", "specialized", false, 1],
  [5, "253183", "特別講義Ⅳ", "specialized", false, 1],
  [5, "253184", "ソフトウェア特別実習Ⅲ", "specialized", false, 4],
].map(course));
