import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emailProblem } from '../email-check.ts';

test('real addresses are fine', () => {
  assert.equal(emailProblem('friend@gmail.com'), null);
  assert.equal(emailProblem('  Someone+music@iCloud.com '), null);
  assert.equal(emailProblem('a@school.co.uk'), null);
  assert.equal(emailProblem('a@company.com.au'), null);
});

test('the Google Play test robot is stopped', () => {
  assert.equal(emailProblem('crawlerrobo@gmail.com'), 'robot');
  assert.equal(emailProblem('CrawlerRobo@Gmail.com'), 'robot');
});

test('reserved test domains are stopped', () => {
  assert.equal(emailProblem('test@example.com'), 'undeliverable');
  assert.equal(emailProblem('a@mail.example.org'), 'undeliverable');
  assert.equal(emailProblem('a@foo.test'), 'undeliverable');
  assert.equal(emailProblem('a@foo.invalid'), 'undeliverable');
});

test('letters typed after .com on a big provider are caught', () => {
  assert.equal(emailProblem('nabolger+review@gmail.coma'), 'typo');
  assert.equal(emailProblem('bolger+review@gmail.comana'), 'typo');
  assert.equal(emailProblem('wesle@icloud.coman'), 'typo');
  assert.equal(emailProblem('a@mycompany.coma'), null);
});

test('things that are not email addresses', () => {
  assert.equal(emailProblem(''), 'invalid');
  assert.equal(emailProblem('anna'), 'invalid');
  assert.equal(emailProblem('anna@gmail'), 'invalid');
});
