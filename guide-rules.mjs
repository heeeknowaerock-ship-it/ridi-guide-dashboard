export const COMMON_PREFIX_FIELDS = ['배경/분야', '작품 키워드'];
export const ROMANCE_CHARACTER_FIELDS = ['남자주인공', '여자주인공'];
export const BL_CHARACTER_FIELDS = ['공', '수'];
export const COMMON_SUFFIX_FIELDS = ['이럴 때 보세요', '공감 글귀'];
export const FIELDS = [
  ...COMMON_PREFIX_FIELDS,
  ...ROMANCE_CHARACTER_FIELDS,
  ...BL_CHARACTER_FIELDS,
  ...COMMON_SUFFIX_FIELDS,
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headingPattern = new RegExp(
  `^\\s*(?:[■□▪•*-]\\s*)?(${FIELDS.map(escapeRegExp).join('|')})\\s*:\\s*(.*)$`,
);

export function parseGuide(source = '') {
  const values = Object.fromEntries(FIELDS.map((field) => [field, '']));
  const found = new Set();
  const duplicateFields = new Set();
  const outsideLines = [];
  let currentField = null;

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const match = rawLine.match(headingPattern);
    if (match) {
      const [, field, firstValue] = match;
      if (found.has(field)) duplicateFields.add(field);
      found.add(field);
      currentField = field;
      values[field] = values[field]
        ? `${values[field]}\n${firstValue.trim()}`
        : firstValue.trim();
      continue;
    }

    if (currentField) {
      if (rawLine.trim() || values[currentField]) {
        values[currentField] += `${values[currentField] ? '\n' : ''}${rawLine.trimEnd()}`;
      }
    } else if (rawLine.trim() && !/^■\s*접수양식\s*$/.test(rawLine.trim())) {
      outsideLines.push(rawLine.trim());
    }
  }

  return { values, found, duplicateFields, outsideLines };
}

export function normalizeBackground(value = '') {
  return value
    .split('\n')
    .map((line) => line.trim().replace(/\s*\/\s*/g, '/'))
    .join('\n')
    .trim();
}

export function normalizeKeywords(value = '') {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const replaced = line.trim().replace(/[;；]+/g, ',');
      const hasTrailingDelimiter = /,\s*$/.test(replaced);
      const normalizedLine = replaced
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .join(', ');
      return hasTrailingDelimiter && normalizedLine ? `${normalizedLine},` : normalizedLine;
    })
    .join('\n')
    .trim();
}

export function inspectGuide(source = '') {
  const parsed = parseGuide(source);
  const corrected = { ...parsed.values };
  const issues = [];
  const mode = parsed.found.has('공') || parsed.found.has('수') ? 'bl' : 'romance';
  const characterFields = mode === 'bl' ? BL_CHARACTER_FIELDS : ROMANCE_CHARACTER_FIELDS;
  const outputFields = [...COMMON_PREFIX_FIELDS, ...characterFields, ...COMMON_SUFFIX_FIELDS];

  for (const field of outputFields) {
    if (!parsed.found.has(field)) {
      issues.push({ type: 'error', field, message: `필수 항목 ‘${field}’이 누락되었습니다.` });
    } else if (!parsed.values[field].trim()) {
      issues.push({ type: 'error', field, message: `‘${field}’ 내용이 비어 있습니다.` });
    }
  }

  for (const field of parsed.duplicateFields) {
    issues.push({ type: 'warning', field, message: `‘${field}’ 항목이 두 번 이상 작성되었습니다.` });
  }

  const romanceFieldsInBl = ROMANCE_CHARACTER_FIELDS.filter((field) => parsed.found.has(field));
  if (mode === 'bl' && romanceFieldsInBl.length) {
    issues.push({
      type: 'fix',
      field: '주인공 항목',
      message: '공/수 항목이 있어 BL 양식으로 판단하고 남자주인공/여자주인공 항목을 삭제했습니다.',
      before: romanceFieldsInBl.map((field) => `${field}: ${parsed.values[field]}`).join('\n'),
      after: BL_CHARACTER_FIELDS.map((field) => `${field}: ${corrected[field]}`).join('\n'),
    });
  }

  const background = parsed.values['배경/분야'];
  const fixedBackground = normalizeBackground(background);
  if (background !== fixedBackground) {
    issues.push({
      type: 'fix',
      field: '배경/분야',
      message: '슬래시(/) 앞뒤의 띄어쓰기를 제거했습니다.',
      before: background,
      after: fixedBackground,
    });
    corrected['배경/분야'] = fixedBackground;
  }

  const keywords = parsed.values['작품 키워드'];
  const fixedKeywords = normalizeKeywords(keywords);
  if (keywords !== fixedKeywords) {
    issues.push({
      type: 'fix',
      field: '작품 키워드',
      message: '기존 줄바꿈은 유지하고 키워드 구분자만 쉼표(,)로 통일했습니다.',
      before: keywords,
      after: fixedKeywords,
    });
    corrected['작품 키워드'] = fixedKeywords;
  }

  if (parsed.outsideLines.length) {
    issues.push({
      type: 'warning',
      field: '양식 외 문구',
      message: '접수 항목 바깥의 문구는 최종본에서 제외했습니다.',
      before: parsed.outsideLines.join('\n'),
    });
  }

  const output = ['■ 접수양식', ...outputFields.map((field) => `* ${field}: ${corrected[field].trim()}`)].join('\n');
  return { ...parsed, corrected, issues, output, outputFields, mode };
}
