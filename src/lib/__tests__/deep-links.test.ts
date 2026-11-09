import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routeOf, safeAppPath } from '../deep-links.ts';

test('links with no screen go home', () => {
  for (const link of [
    'musicleague:///**',
    'musicleague://**',
    '/**',
    'musicleague://auth-callback#access_token=x',
    'musicleague:///auth-callback?code=1',
    'musicleague://spotify-auth?code=1',
    'musicleague://group',
    'musicleague://round/1/extra',
    'musicleague://%E0%A4%A',
  ]) {
    assert.equal(safeAppPath(link), '/', link);
  }
});

test('links to real screens are kept as they are', () => {
  for (const link of [
    'musicleague://',
    'musicleague:///',
    '/',
    'musicleague://group/join?code=ABC123',
    'musicleague:///group/join?code=ABC123',
    '/group/0b6c4c1e-1111-2222-3333-444455556666',
    'musicleague://round/abc',
    'musicleague://profile',
    '/stats',
  ]) {
    assert.equal(safeAppPath(link), link, link);
  }
});

test('reads the route out of a link', () => {
  assert.equal(routeOf('musicleague:///group/join?code=1#x'), 'group/join');
  assert.equal(routeOf('musicleague:///**'), '**');
});
