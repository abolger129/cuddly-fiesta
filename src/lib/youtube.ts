/** A YouTube video's id, from any of the usual link shapes. null if it isn't one. */
export function youtubeVideoId(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link.trim().replace(/^(?!https?:\/\/)/i, 'https://'));
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1] ?? null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** The link we store and open: always the plain watch page. */
export function youtubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * The video's title and channel, to fill in the song for the player. Uses
 * YouTube's public oEmbed endpoint, which needs no key. null if it can't be found.
 */
export async function lookUpYoutubeVideo(
  videoId: string
): Promise<{ title: string; channel: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtubeWatchUrl(videoId))}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { title: String(data.title ?? ''), channel: String(data.author_name ?? '').replace(/ - Topic$/, '') };
  } catch {
    return null;
  }
}
