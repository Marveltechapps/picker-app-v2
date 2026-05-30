/**
 * Video URL utilities for training video playback.
 * Handles YouTube, Vimeo, and direct video URLs (mp4, m3u8, etc.)
 */

const DIRECT_VIDEO_EXT = /\.(mp4|m3u8|webm|mov|mkv)(\?|$)/i;

/**
 * Check if the URL is a direct video file (playable by native player).
 */
export function isDirectVideoUrl(url: string | undefined): boolean {
  const u = url?.trim();
  if (!u) return false;
  return DIRECT_VIDEO_EXT.test(u);
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([^&\s?#]+)/,
  /(?:youtu\.be\/)([^&\s?#]+)/,
  /(?:youtube\.com\/embed\/)([^&\s?#]+)/,
  /(?:youtube\.com\/v\/)([^&\s?#]+)/,
];

/**
 * Detect if the URL is a YouTube URL and extract the video ID.
 */
export function getYouTubeVideoId(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  for (const re of YOUTUBE_PATTERNS) {
    const m = trimmed.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * Check if the URL is a YouTube link.
 */
export function isYouTubeUrl(url: string | undefined): boolean {
  return getYouTubeVideoId(url ?? "") !== null;
}

/**
 * Get YouTube embed URL for WebView playback.
 */
export function getYouTubeEmbedUrl(videoId: string, autoplay = false): string {
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "1");
  params.set("playsinline", "1");
  params.set("rel", "0");
  const qs = params.toString();
  return `https://www.youtube.com/embed/${videoId}${qs ? `?${qs}` : ""}`;
}

const VIMEO_PATTERNS = [
  /vimeo\.com\/(\d+)/,
  /player\.vimeo\.com\/video\/(\d+)/,
];

/**
 * Extract Vimeo video ID and return embed URL.
 */
export function getVimeoEmbedUrl(url: string | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  for (const re of VIMEO_PATTERNS) {
    const m = u.match(re);
    if (m?.[1]) return `https://player.vimeo.com/video/${m[1]}?autoplay=1`;
  }
  return null;
}

/**
 * Get embeddable URL for WebView (Vimeo or other pages).
 * Returns null for YouTube (use YoutubeIframe instead).
 */
export function getEmbedUrl(url: string | undefined): string | null {
  if (getYouTubeVideoId(url)) return null;
  const vimeo = getVimeoEmbedUrl(url);
  if (vimeo) return vimeo;
  return url?.trim() || null;
}
