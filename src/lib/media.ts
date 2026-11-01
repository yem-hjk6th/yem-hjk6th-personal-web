// Project media: one thumbnail, a list of large images and an optional video,
// all stored unchanged under public/media/<slug>/ and referenced from
// projects.yaml by a path relative to public/media/.
//
// Images can be shown zoomed in by display only (CSS object-fit, object-position
// and scale); the file itself is never edited:
//   zoom:  number >= 1, e.g. 1.6 (default 1)
//   focus: "X% Y%", the point the zoom centres on, e.g. "52% 72%" (default "50% 50%")
//   fit:   "cover" (fill the frame, cropping) or "contain" (show the whole image).
//          Default: "contain" for SVG drawings among the large images (shown at
//          their own aspect ratio, uncropped), "cover" for everything else.
//          Thumbnails keep their 4:3 frame; with "contain" they letterbox.
// When a field is empty, or its file is not in the repo yet, pages show the
// generated drawing instead.
import fs from 'node:fs';
import path from 'node:path';

export interface MediaImage {
  src: string;
  alt: string;
  zoom?: number;
  focus?: string;
  fit?: 'cover' | 'contain';
  credit?: string;
  caption?: string;
}
export interface MediaVideo { src: string; poster?: string; caption?: string; credit?: string }
export interface Media { thumbnail?: MediaImage; images?: MediaImage[]; video?: MediaVideo }

/** A media item resolved for rendering; `url` is null when the file is missing. */
export interface ResolvedImage extends MediaImage { url: string | null; path: string; zoom: number; focus: string }

const root = path.resolve(process.cwd(), 'public/media');
const FOCUS = /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/;

const fileUrl = (src: string) => (fs.existsSync(path.join(root, src)) ? `/media/${src}` : null);

/** projects.yaml may write `media: []` for "no media yet". */
export function normalizeMedia(raw: unknown, slug: string): Media {
  if (raw == null || (Array.isArray(raw) && raw.length === 0)) return {};
  if (Array.isArray(raw) || typeof raw !== 'object') throw new Error(`${slug}: media must be [] or { thumbnail, images, video }`);
  return raw as Media;
}

export function resolveImage(img: MediaImage | undefined, slug: string): ResolvedImage | null {
  if (!img) return null;
  if (!img.src || !img.alt) throw new Error(`${slug}: every media image needs src and alt`);
  const zoom = img.zoom ?? 1;
  const focus = img.focus ?? '50% 50%';
  if (typeof zoom !== 'number' || zoom < 1 || zoom > 4) throw new Error(`${slug}: media zoom must be a number from 1 to 4 (got ${img.zoom})`);
  if (!FOCUS.test(focus)) throw new Error(`${slug}: media focus must look like "52% 72%" (got ${img.focus})`);
  if (img.fit !== undefined && img.fit !== 'cover' && img.fit !== 'contain') throw new Error(`${slug}: media fit must be "cover" or "contain" (got ${img.fit})`);
  return { ...img, zoom, focus, url: fileUrl(img.src), path: `public/media/${img.src}` };
}

export function resolveVideo(v: MediaVideo | undefined, slug: string) {
  if (!v) return null;
  if (!v.src) throw new Error(`${slug}: media video needs src`);
  return { ...v, url: fileUrl(v.src), posterUrl: v.poster ? fileUrl(v.poster) : null, path: `public/media/${v.src}` };
}
