// Content collections: projects and publications are read from content/*.yaml
// by Astro's file() loader and checked against these schemas at build time.
// A missing required field, a wrong type or an unknown key fails the build.
// (profile.yaml and experience.yaml are still read directly in lib/content.ts.)
import fs from 'node:fs/promises';
import { defineCollection, reference } from 'astro:content';
import { file, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { load as parseYaml } from 'js-yaml';

const text = z.string().trim().min(1);
// The store does not keep file order, so each loader records it; lib/content.ts sorts by it.
const order = z.number().int().nonnegative();
const withOrder = (items: Record<string, unknown>[]) => items.map((item, i) => ({ ...item, order: i }));

// file() only logs a YAML syntax error and keeps the previous build's entries,
// so a broken file would ship stale content. Parse once up front and let it throw.
type Items = Record<string, unknown>[];
const yamlFile = (fileName: string, parser: (text: string) => Items): Loader => {
  const inner = file(fileName, { parser });
  return {
    ...inner,
    name: 'yaml-file',
    load: async (ctx) => {
      const raw = await fs.readFile(new URL(fileName, ctx.config.root), 'utf8');
      try { parser(raw); } catch (e) { throw new Error(`${fileName}: ${(e as Error).message}`); }
      return inner.load(ctx);
    },
  };
};

const mediaImage = z.object({
  src: text,
  alt: text,
  zoom: z.number().min(1).max(4).optional(),
  focus: z.string().regex(/^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/, 'focus must look like "52% 72%"').optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  credit: text.optional(),
  caption: text.optional(),
}).strict();

const mediaVideo = z.object({
  src: text,
  poster: text.optional(),
  caption: text.optional(),
  credit: text.optional(),
}).strict();

// Optional illustrated sections on a project page, shown between "What I did" and "Result".
// `narrow_src` is a second drawing for phones (art direction, e.g. a portrait layout);
// both files are only scaled down and re-encoded.
const storyImage = mediaImage.extend({ narrow_src: text.optional() }).strict();
const storySection = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  heading: text,
  body: text,
  images: z.array(storyImage).optional(),
  videos: z.array(mediaVideo).optional(),
  link: z.object({ label: text, url: z.string().regex(/^(\/|https:\/\/)/, 'link url must start with / or https://') }).strict().optional(),
}).strict();

// `media: []` means "no media yet".
const media = z.union([
  z.array(z.never()).max(0).transform(() => ({})),
  z.object({ thumbnail: mediaImage.optional(), images: z.array(mediaImage).optional(), video: mediaVideo.optional() }).strict(),
]);

const projects = defineCollection({
  // Entry ids come from each item's `slug`.
  loader: yamlFile('content/projects.yaml', (t) => withOrder(parseYaml(t) as Items)),
  schema: z.object({
    order,
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: text,
    years: text,
    meta: z.object({ place: text.optional(), role: text }).strict(),
    tags: z.array(text).min(1),
    status: z.literal('draft').optional(),
    role: text,
    credits: text,
    problem: text,
    what_i_did: text,
    story: z.array(storySection).optional(),
    result: text.nullable(),
    publications: z.array(reference('publications')).optional(),
    links: z.array(z.object({ label: text, url: z.url() }).strict()),
    media,
  }).strict(),
});

const publicationsFile = (text: string) => parseYaml(text) as Record<'publications' | 'presentations' | 'exhibitions', Items>;

const publications = defineCollection({
  loader: yamlFile('content/publications.yaml', (t) => withOrder(publicationsFile(t).publications)),
  schema: z.object({
    order,
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.enum(['conference paper', 'journal paper', 'patent']),
    authors: text,
    year: z.number().int(),
    title: text,
    venue: text,
    doi: text.nullable().optional(),
    url: z.url().optional(),
  }).strict(),
});

// Presentations and exhibitions have no ids in the file; number them in order.
const talk = z.object({ order, id: z.string(), title: text, venue: text, year: z.number().int() }).strict();
const numbered = (key: 'presentations' | 'exhibitions') => (t: string) =>
  withOrder(publicationsFile(t)[key]).map((item, i) => ({ id: `${key}-${i + 1}`, ...item }));

const presentations = defineCollection({ loader: yamlFile('content/publications.yaml', numbered('presentations')), schema: talk });
const exhibitions = defineCollection({ loader: yamlFile('content/publications.yaml', numbered('exhibitions')), schema: talk });

export const collections = { projects, publications, presentations, exhibitions };
