import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addBan, bannedArtistIn, splitArtists } from '../banned-artists.ts';

test('a ban matches regardless of case, spaces, punctuation and a leading "the"', () => {
  assert.equal(bannedArtistIn('The Beatles', ['beatles']), 'beatles');
  assert.equal(bannedArtistIn('AC/DC', ['acdc']), 'acdc');
  assert.equal(bannedArtistIn('  taylor   swift ', ['Taylor Swift']), 'Taylor Swift');
});

test('a ban matches any credited artist', () => {
  assert.equal(bannedArtistIn('Calvin Harris, Rihanna', ['Rihanna']), 'Rihanna');
  assert.equal(bannedArtistIn('Drake feat. Rihanna', ['rihanna']), 'rihanna');
  assert.equal(bannedArtistIn('Lady Gaga & Bradley Cooper', ['Bradley Cooper']), 'Bradley Cooper');
});

test('a ban on a duo matches the duo', () => {
  assert.equal(bannedArtistIn('Simon & Garfunkel', ['Simon & Garfunkel']), 'Simon & Garfunkel');
});

test('a ban does not match part of a name', () => {
  assert.equal(bannedArtistIn('Swiftie Tribute Band', ['Swift']), null);
  assert.equal(bannedArtistIn('Drake Bell', ['Drake']), null);
  assert.equal(bannedArtistIn('Feather Weight', ['her weight']), null);
});

test('splitting credits', () => {
  assert.deepEqual(splitArtists('A, B & C ft. D'), ['a', 'b', 'c', 'd']);
});

test('adding a ban skips blanks and repeats', () => {
  assert.deepEqual(addBan(['Drake'], ' drake '), ['Drake']);
  assert.deepEqual(addBan(['Drake'], '   '), ['Drake']);
  assert.deepEqual(addBan(['Drake'], ' Taylor  Swift'), ['Drake', 'Taylor Swift']);
});
