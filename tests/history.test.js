import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validate, grade } = require('../lib/history.cjs');

test('History validator detects missing questions and invalid question counts', () => {
  const invalidExam = { title: 'Đề mẫu lỗi', questions: [] };
  const errors = validate(invalidExam);
  assert(errors.length > 0);
  assert(errors.includes('Cần 24 câu trắc nghiệm và 4 câu đúng/sai theo mẫu Hikarii.'));
});

test('History grader calculates score for multiple-choice and true/false correctly', () => {
  const mockExam = {
    title: 'Đề kiểm tra',
    questions: [
      { type: 'mc', number: 1, text: 'Câu 1', options: ['A', 'B', 'C', 'D'], answer: 0 },
      { type: 'tf', number: 1, text: 'Câu 2', options: ['a', 'b', 'c', 'd'], answer: [true, false, true, false] }
    ]
  };

  // Correct answer for MC (0.25 pts), all correct for TF (1.0 pt)
  const result = grade(mockExam, [0, [true, false, true, false]]);
  assert.equal(result.score, 1.25);
  assert.equal(result.review[0].points, 0.25);
  assert.equal(result.review[1].points, 1);

  // Wrong answer for MC (0 pts)
  const wrongResult = grade(mockExam, [1, [true, false, true, false]]);
  assert.equal(wrongResult.score, 1);
  assert.equal(wrongResult.review[0].points, 0);
});
