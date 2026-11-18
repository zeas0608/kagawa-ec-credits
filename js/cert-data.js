// 香川高専「香川高等専門学校以外の教育施設等における学修に関する規程」別表
// https://www.kagawa-nct.ac.jp/general_affairs/rules/05-04.pdf#page=3
export const TOEIC_GROUP_ID = 'toeic';

function certificationGroup(id, name, category, rows) {
  const options = rows.map(([id, condition, credits, qualification = name, scoreBounds]) => ({
    id,
    name: qualification,
    condition,
    credits,
    ...scoreBounds,
  }));
  return { id, name, category, options };
}

// 各グループは別表の太枠1つに対応する。名称が同じでも太枠が別なら別グループとする。
export const CERTIFICATION_GROUPS = [
  certificationGroup(TOEIC_GROUP_ID, 'TOEIC・実用英語技能検定', 'general', [
    ['toeic-730', '730点以上', 6, 'TOEIC', { minScore: 730, maxScore: 990 }],
    ['toeic-600', '600〜729点', 4, 'TOEIC', { minScore: 600, maxScore: 729 }],
    ['toeic-450', '450〜599点', 2, 'TOEIC', { minScore: 450, maxScore: 599 }],
    ['toeic-400', '400〜449点', 1, 'TOEIC', { minScore: 400, maxScore: 449 }],
    ['eiken-1', '1級', 6, '実用英語技能検定'],
    ['eiken-pre-1', '準1級', 4, '実用英語技能検定'],
    ['eiken-2', '2級', 2, '実用英語技能検定'],
    ['eiken-pre-2', '準2級', 1, '実用英語技能検定'],
  ]),
  certificationGroup('kanken', '日本漢字能力検定', 'general', [
    ['kanken-2-or-higher', '1級・準1級・2級', 2],
    ['kanken-pre-2', '準2級', 1],
  ]),
  certificationGroup('japanese', '日本語検定', 'general', [
    ['japanese-2-or-higher', '1級・準1級・2級', 2],
    ['japanese-pre-2-or-3', '準2級・3級', 1],
  ]),
  certificationGroup('mathematics', '実用数学技能検定', 'general', [
    ['mathematics-1', '1級', 4],
    ['mathematics-pre-1', '準1級', 2],
    ['mathematics-2', '2級', 1],
  ]),
  certificationGroup('statistics', '統計検定', 'general', [
    ['statistics-1', '1級', 6],
    ['statistics-pre-1', '準1級', 4],
    ['statistics-2', '2級', 2],
    ['statistics-3', '3級', 1],
  ]),
  certificationGroup('technical-english', '技術英語能力検定', 'specialized', [
    ['technical-english-pro', 'プロフェッショナル', 6],
    ['technical-english-pre-pro', '準プロフェッショナル', 4],
    ['technical-english-1', '1級', 3],
    ['technical-english-2', '2級', 2],
  ]),
  certificationGroup('ipa', '情報処理技術者試験・情報処理安全確保支援士試験', 'specialized', [
    ['ipa-pm', 'なし', 6, 'プロジェクトマネージャ試験'],
    ['ipa-sa', 'なし', 6, 'システムアーキテクト試験'],
    ['ipa-au', 'なし', 6, 'システム監査技術者試験'],
    ['ipa-nw', 'なし', 6, 'ネットワークスペシャリスト試験'],
    ['ipa-db', 'なし', 6, 'データベーススペシャリスト試験'],
    ['ipa-sm', 'なし', 6, 'ITサービスマネージャ試験'],
    ['ipa-es', 'なし', 6, 'エンベデッドシステムスペシャリスト試験'],
    ['ipa-sc', 'なし', 6, '情報処理安全確保支援士試験'],
    ['ipa-st', 'なし', 6, 'ITストラテジスト試験'],
    ['ipa-ap', 'なし', 4, '応用情報技術者試験'],
    ['ipa-fe', 'なし', 2, '基本情報技術者試験'],
    ['ipa-sg', 'なし', 1, '情報セキュリティマネジメント試験'],
    ['ipa-ip', 'なし', 1, 'ITパスポート試験'],
  ]),
  certificationGroup('cg-engineer', 'CGエンジニア検定', 'specialized', [
    ['cg-engineer-expert', 'エキスパート', 2],
    ['cg-engineer-basic', 'ベーシック', 1],
  ]),
  certificationGroup('cg-creator', 'CGクリエイター検定', 'specialized', [
    ['cg-creator-expert', 'エキスパート', 2],
    ['cg-creator-basic', 'ベーシック', 1],
  ]),
  certificationGroup('image-processing', '画像処理エンジニア検定', 'specialized', [
    ['image-processing-expert', 'エキスパート', 2],
    ['image-processing-basic', 'ベーシック', 1],
  ]),
  certificationGroup('multimedia', 'マルチメディア検定', 'specialized', [
    ['multimedia-expert', 'エキスパート', 2],
  ]),
  certificationGroup('systems-programmer', '情報システム試験（プログラマ認定）', 'specialized', [
    ['systems-programmer', 'なし', 2],
  ]),
  certificationGroup('systems-engineer', '情報システム試験（システムエンジニア認定）', 'specialized', [
    ['systems-engineer', 'なし', 2],
  ]),
  certificationGroup('digital-technology', 'ディジタル技術検定（制御部門・情報部門）', 'specialized', [
    ['digital-technology-1', '1級', 2],
    ['digital-technology-2', '2級', 1],
  ]),
  certificationGroup('telecommunication-line', '電気通信主任技術者試験（線路）', 'specialized', [
    ['telecommunication-line', '線路', 4, '電気通信主任技術者試験'],
  ]),
  certificationGroup('telecommunication-transmission', '電気通信主任技術者試験（伝送交換）', 'specialized', [
    ['telecommunication-transmission', '伝送交換', 4, '電気通信主任技術者試験'],
  ]),
  certificationGroup('electrical-chief', '電気主任技術者試験', 'specialized', [
    ['electrical-chief-1', '第一種', 6],
    ['electrical-chief-2', '第二種', 4],
    ['electrical-chief-3', '第三種', 2],
  ]),
  certificationGroup('installation-technician', '工事担任者試験', 'specialized', [
    ['installation-technician-combined', '総合通信', 4],
    ['installation-technician-analog', '第一級アナログ通信', 2],
    ['installation-technician-digital', '第一級デジタル通信', 2],
    ['installation-technician-ai-dd-2', '第2種', 1, '工事担任者試験AI・DD'],
  ]),
  certificationGroup('special-land-radio', '陸上特殊無線技士試験', 'specialized', [
    ['special-land-radio-1', '第1級', 1],
  ]),
  certificationGroup('land-radio', '陸上無線技術士試験', 'specialized', [
    ['land-radio-1', '第1級', 4],
    ['land-radio-2', '第2級', 2],
  ]),
  certificationGroup('general-radio', '総合無線通信士試験', 'specialized', [
    ['general-radio-1', '第1級', 4],
    ['general-radio-2', '第2級', 2],
    ['general-radio-3', '第3級', 1],
  ]),
  certificationGroup('marine-radio', '海上無線通信士試験', 'specialized', [
    ['marine-radio-1', '第1級', 4],
    ['marine-radio-2', '第2級', 2],
    ['marine-radio-3', '第3級', 1],
  ]),
  certificationGroup('mechanical-design', '機械設計技術者試験', 'specialized', [
    ['mechanical-design-3', '3級', 2],
  ]),
  certificationGroup('surveying', '測量士試験・測量士補試験', 'specialized', [
    ['surveyor', 'なし', 4, '測量士試験'],
    ['assistant-surveyor', 'なし', 2, '測量士補試験'],
  ]),
  certificationGroup('professional-engineer', '技術士第一次試験', 'specialized', [
    ['professional-engineer', 'なし', 4],
  ]),
  certificationGroup('intellectual-property', '知的財産管理技能検定', 'specialized', [
    ['intellectual-property-3', '3級', 2],
  ]),
];

const toeicOptions = CERTIFICATION_GROUPS.find(group => group.id === TOEIC_GROUP_ID).options;

export function getToeicOption(score) {
  if (!Number.isInteger(score)) return undefined;
  return toeicOptions.find(option => option.minScore <= score && score <= option.maxScore);
}
