// Loads the site text at build time. Projects and publications come from the
// content collections (src/content.config.ts: content/*.yaml checked against
// schemas); profile and experience are read from their YAML files directly.
// All visible copy comes from content/*.yaml; nothing here adds facts.
import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Media } from './media';

const dir = path.resolve(process.cwd(), 'content');
const load = <T>(name: string): T => parseYaml(fs.readFileSync(path.join(dir, name), 'utf8')) as T;

export type Link = CollectionEntry<'projects'>['data']['links'][number];
export type Project = Omit<CollectionEntry<'projects'>['data'], 'media'> & { media: Media };
export type Publication = CollectionEntry<'publications'>['data'];
export interface Experience { role: string; org: string; location?: string; years?: string; summary: string }
export interface Profile {
  name: string;
  affiliation: string;
  location: string;
  headlines: { robotics_cv: string; aec_fabrication: string };
  bio: string;
  contact: { email: string; linkedin: string; github: string; orcid: string };
  education: { degree: string; school: string; years: string; detail?: string }[];
}
type Name = 'projects' | 'publications' | 'presentations' | 'exhibitions';
const entries = async <C extends Name>(c: C): Promise<CollectionEntry<C>['data'][]> => {
  const list = (await getCollection(c)).map((e) => e.data as CollectionEntry<C>['data']).sort((x, y) => x.order - y.order);
  if (!list.length) throw new Error(`content: no ${c} loaded; check the YAML file`);
  return list;
};

export const profile = load<Profile>('profile.yaml');
export const projects = (await entries('projects')) as Project[];
export const experience = load<Experience[]>('experience.yaml');
export const publications = await entries('publications');
export const presentations = await entries('presentations');
export const exhibitions = await entries('exhibitions');

/** Publications a project links to (`publications:` in projects.yaml), in that order. */
export const publicationsFor = (p: Project) =>
  (p.publications ?? []).map((r) => publications.find((x) => x.id === r.id)!);

// Audience entries. A project belongs to an audience if it carries any of its tags,
// so cross-over work (e.g. robotics + fabrication) shows up for both readers.
export const audiences = [
  {
    id: 'robotics-cv',
    label: 'Robotics & CV',
    headline: profile.headlines.robotics_cv,
    tags: ['robotics', 'cv', 'ml', 'software', '3d'],
  },
  {
    id: 'aec-fabrication',
    label: 'AEC & fabrication',
    headline: profile.headlines.aec_fabrication,
    tags: ['aec', 'fabrication', 'design'],
  },
] as const;

export type AudienceId = (typeof audiences)[number]['id'];

export const audiencesFor = (p: Project): AudienceId[] =>
  audiences.filter((a) => p.tags.some((t) => (a.tags as readonly string[]).includes(t))).map((a) => a.id);

export const tagLabel: Record<string, string> = {
  robotics: 'Robotics',
  cv: 'Computer vision',
  ml: 'Machine learning',
  software: 'Software',
  '3d': '3D',
  fabrication: 'Fabrication',
  aec: 'AEC',
  design: 'Design',
  sensing: 'Sensing',
};

/** The listing's metadata line: years · place · role. */
export const metaLine = (p: Project) => [p.years, p.meta.place, p.meta.role].filter(Boolean).join(' · ');

/** First sentence of a field, for compact listings. */
export const firstSentence = (s: string) => {
  const m = s.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : s;
};

const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export const contactLinks = [
  { label: 'Email', href: `mailto:${profile.contact.email}`, text: profile.contact.email },
  { label: 'LinkedIn', href: profile.contact.linkedin, text: bare(profile.contact.linkedin) },
  { label: 'GitHub', href: profile.contact.github, text: bare(profile.contact.github) },
  { label: 'ORCID', href: profile.contact.orcid, text: bare(profile.contact.orcid) },
];
