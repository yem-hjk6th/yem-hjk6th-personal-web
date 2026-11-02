// Project media: one thumbnail, a list of large images and an optional video,
// referenced from projects.yaml by a path relative to the media folders:
//   images (and video posters): src/assets/media/<slug>/  -> scaled down and
//     re-encoded (AVIF/WebP) by astro:assets; SVG drawings are served unchanged
//   videos: public/media/<slug>/  -> served unchanged (Astro does not process video)
// Images are only ever scaled down and compressed, never cropped or edited.
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
import type { ImageMetadata } from 'astro';

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

/**
 * A media item resolved for rendering. `asset` is set for raster images, `svgUrl`
 * for SVG drawings; `url` is whichever applies, null when the file is missing.
 */
export interface ResolvedImage extends MediaImage {
  asset: ImageMetadata | null;
  svgUrl: string | null;
  url: string | null;
  path: string;
  zoom: number;
  focus: string;
}

const PREFIX = '../assets/media/';
const raster = import.meta.glob<ImageMetadata>('../assets/media/**/*.{jpg,jpeg,png,webp,avif}', { eager: true, import: 'default' });
const svgs = import.meta.glob<string>('../assets/media/**/*.svg', { eager: true, query: '?url', import: 'default' });
const videoRoot = path.resolve(process.cwd(), 'public/media');
const FOCUS = /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/;

/** Raster image (or video poster) by its path under src/assets/media/. */
export const rasterAsset = (src: string): ImageMetadata | null => raster[PREFIX + src] ?? null;

export function resolveImage(img: MediaImage | undefined, slug: string): ResolvedImage | null {
  if (!img) return null;
  if (!img.src || !img.alt) throw new Error(`${slug}: every media image needs src and alt`);
  const zoom = img.zoom ?? 1;
  const focus = img.focus ?? '50% 50%';
  if (typeof zoom !== 'number' || zoom < 1 || zoom > 4) throw new Error(`${slug}: media zoom must be a number from 1 to 4 (got ${img.zoom})`);
  if (!FOCUS.test(focus)) throw new Error(`${slug}: media focus must look like "52% 72%" (got ${img.focus})`);
  if (img.fit !== undefined && img.fit !== 'cover' && img.fit !== 'contain') throw new Error(`${slug}: media fit must be "cover" or "contain" (got ${img.fit})`);
  const asset = rasterAsset(img.src);
  const svgUrl = svgs[PREFIX + img.src] ?? null;
  return { ...img, zoom, focus, asset, svgUrl, url: asset?.src ?? svgUrl, path: `src/assets/media/${img.src}` };
}

export function resolveVideo(v: MediaVideo | undefined, slug: string) {
  if (!v) return null;
  if (!v.src) throw new Error(`${slug}: media video needs src`);
  const url = fs.existsSync(path.join(videoRoot, v.src)) ? `/media/${v.src}` : null;
  return { ...v, url, poster: v.poster ? rasterAsset(v.poster) : null, path: `public/media/${v.src}` };
}
