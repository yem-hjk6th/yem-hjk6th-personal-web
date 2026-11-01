// Loads the site text from content/*.yaml at build time.
// All visible copy comes from these files; nothing here adds facts.
import fs from 'node:fs';
import path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { normalizeMedia, type Media } from './media';

const dir = path.resolve(process.cwd(), 'content');
const load = <T>(name: string): T => parseYaml(fs.readFileSync(path.join(dir, name), 'utf8')) as T;

export interface Link { label: string; url: string }
export interface Project {
  slug: string;
  title: string;
  years: string;
  tags: string[];
  status?: 'draft';
  role: string;
  credits: string;
  problem: string;
  what_i_did: string;
  result: string | null;
  links: Link[];
  media: Media;
}
export interface Publication {
  type: string;
  authors: string;
  year: number;
  title: string;
  venue: string;
  doi?: string | null;
  url?: string;
}
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
interface PublicationsFile {
  publications: Publication[];
  presentations: { title: string; venue: string; year: number }[];
  exhibitions: { title: string; venue: string; year: number }[];
}

export const profile = load<Profile>('profile.yaml');
export const projects = load<Project[]>('projects.yaml').map((p) => ({ ...p, media: normalizeMedia(p.media, p.slug) }));
export const experience = load<Experience[]>('experience.yaml');
const pubs = load<PublicationsFile>('publications.yaml');
export const publications = pubs.publications;
export const presentations = pubs.presentations;
export const exhibitions = pubs.exhibitions;

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
