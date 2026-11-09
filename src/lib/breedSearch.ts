/**
 * Breed search helpers for the dog profile form.
 *
 * The catalogue is small and fully local, so a simple normalised substring
 * index is enough. Ranking is deliberately predictable:
 *   0. exact id/name/alias match
 *   1. the term starts with the query
 *   2. a word inside the term starts with the query
 *   3. the term contains the query
 *
 * Ties are broken by the shorter, then alphabetically earlier, breed name so
 * "lab" surfaces "Labrador Retriever" ahead of longer names.
 */

import { ALL_BREEDS, getBreedById, type Breed } from "../data/breeds.ts";

export const DEFAULT_BREED_LIMIT = 20;

/**
 * Sensible starting list for an empty search box. The mixed-breed and unknown
 * entries sit within the first twelve so they stay visible even when a compact
 * combobox asks for a short list.
 */
const DEFAULT_BREED_IDS = [
  "labrador-retriever",
  "golden-retriever",
  "french-bulldog",
  "beagle",
  "poodle-miniature",
  "cocker-spaniel",
  "border-collie",
  "german-shepherd",
  "cavalier-king-charles-spaniel",
  "jack-russell-terrier",
  "mixed-breed",
  "unknown",
  "staffordshire-bull-terrier",
  "shih-tzu",
  "yorkshire-terrier",
  "dachshund",
  "boxer",
  "rottweiler",
  "bichon-frise",
  "pug",
];

type IndexedBreed = {
  breed: Breed;
  terms: string[];
};

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTerms(breed: Breed): string[] {
  const values = [breed.id, breed.name, ...breed.aliases];
  return [...new Set(values.map(normalise).filter(Boolean))];
}

const SEARCH_INDEX: IndexedBreed[] = ALL_BREEDS.map((breed) => ({
  breed,
  terms: searchTerms(breed),
}));

const DEFAULT_BREEDS: Breed[] = DEFAULT_BREED_IDS.flatMap((id) => {
  const breed = getBreedById(id);
  return breed ? [breed] : [];
});

function scoreTerm(term: string, query: string): number | null {
  if (term === query) return 0;
  if (term.startsWith(query)) return 1;

  const termWords = term.split(" ");

  if (termWords.some((word) => word.startsWith(query))) return 2;

  if (query.includes(" ")) {
    const queryWords = query.split(" ");
    const allWordsMatch = queryWords.every((queryWord) =>
      termWords.some((termWord) => termWord.startsWith(queryWord)),
    );
    if (allWordsMatch) return 2;
  }

  if (term.includes(query)) return 3;
  return null;
}

function normaliseLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_BREED_LIMIT;
  return Math.max(0, Math.floor(limit));
}

function compareMatches(
  left: { breed: Breed; score: number },
  right: { breed: Breed; score: number },
): number {
  if (left.score !== right.score) return left.score - right.score;
  if (left.breed.name.length !== right.breed.name.length) {
    return left.breed.name.length - right.breed.name.length;
  }
  return left.breed.name.localeCompare(right.breed.name);
}

/**
 * Search the local breed catalogue by name, alias or catalogue id.
 *
 * The query is case- and accent-insensitive. An empty query returns a curated
 * popular-breed list. `limit` is clamped to a non-negative integer.
 */
export function searchBreeds(query: string, limit = DEFAULT_BREED_LIMIT): Breed[] {
  const safeLimit = normaliseLimit(limit);
  if (safeLimit === 0) return [];

  const normalisedQuery = normalise(query);
  if (!normalisedQuery) return DEFAULT_BREEDS.slice(0, safeLimit);

  const matches: Array<{ breed: Breed; score: number }> = [];

  for (const entry of SEARCH_INDEX) {
    let bestScore: number | null = null;
    for (const term of entry.terms) {
      const score = scoreTerm(term, normalisedQuery);
      if (score !== null && (bestScore === null || score < bestScore)) {
        bestScore = score;
      }
    }
    if (bestScore !== null) {
      matches.push({ breed: entry.breed, score: bestScore });
    }
  }

  matches.sort(compareMatches);
  return matches.slice(0, safeLimit).map((match) => match.breed);
}

/** Display label used by comboboxes and summaries. */
export function formatBreedLabel(breed: Pick<Breed, "name">): string {
  return breed.name;
}

const SIZE_LABELS: Record<Breed["size"], string> = {
  toy: "Toy",
  small: "Small",
  medium: "Medium",
  large: "Large",
  giant: "Giant",
  unknown: "Size unknown",
};

/** Human-readable size label, including the unknown sentinel. */
export function breedSizeLabel(size: Breed["size"]): string {
  return SIZE_LABELS[size];
}
