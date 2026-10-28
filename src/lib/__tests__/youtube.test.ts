import assert from 'node:assert/strict';
import { test } from 'node:test';

import { youtubeVideoId } from '../youtube.ts';

test('reads the video id from the usual link shapes', () => {
  for (const link of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&si=abc',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    '  https://www.youtube.com/embed/dQw4w9WgXcQ  ',
  ]) {
    assert.equal(youtubeVideoId(link), 'dQw4w9WgXcQ', link);
  }
});

test('rejects links that are not YouTube videos', () => {
  for (const link of [
    '',
    'not a link',
    'https://open.spotify.com/track/abc',
    'https://www.youtube.com/',
    'https://www.youtube.com/watch?v=short',
    'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
  ]) {
    assert.equal(youtubeVideoId(link), null, link);
  }
});
