import assert from 'node:assert/strict';
import { inspectGuide, normalizeBackground, normalizeKeywords } from './guide-rules.mjs';

assert.equal(normalizeBackground('현대물 / 금단의관계'), '현대물/금단의관계');
assert.equal(normalizeBackground('현대물/ 금단의관계'), '현대물/금단의관계');
assert.equal(normalizeBackground('현대물 /금단의관계'), '현대물/금단의관계');
assert.equal(normalizeKeywords('양성구유수; 아빠바라기공; 더티토크'), '양성구유수, 아빠바라기공, 더티토크');

const sample = `작업 메모\n■ 접수양식\n* 배경/분야: 현대물 / 금단의관계\n* 작품 키워드: 양성구유수; 아빠바라기공; 더티토크\n* 남자주인공: 리디\n* 여자주인공: 로판\n* 이럴 때 보세요: 비밀스러운 관계가 보고 싶을 때\n* 공감 글귀: 우리는 서로를 선택했다.`;
const result = inspectGuide(sample);
assert.match(result.output, /\* 배경\/분야: 현대물\/금단의관계/);
assert.match(result.output, /\* 작품 키워드: 양성구유수, 아빠바라기공, 더티토크/);
assert.equal(result.issues.filter((issue) => issue.type === 'fix').length, 2);
assert.equal(result.issues.some((issue) => issue.field === '양식 외 문구'), true);

const missing = inspectGuide('* 배경/분야: 현대물');
assert.equal(missing.issues.filter((issue) => issue.type === 'error').length, 5);

console.log('PASS: 리디 가이드 규칙 테스트 9개 검증 완료');
