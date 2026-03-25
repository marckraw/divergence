export interface FuzzyMatchResult {
  match: boolean;
  score: number;
  matchedIndices: number[];
}

const CONSECUTIVE_BONUS = 3;
const WORD_BOUNDARY_BONUS = 5;
const START_OF_STRING_BONUS = 7;
const EXACT_SUBSTRING_BONUS = 15;
const FILENAME_MATCH_BONUS = 10;
const SHORT_TARGET_BONUS_CAP = 8;
const SHORT_PATH_BONUS_CAP = 8;
const NO_MATCH_RESULT: FuzzyMatchResult = { match: false, score: 0, matchedIndices: [] };
const EMPTY_QUERY_RESULT: FuzzyMatchResult = { match: true, score: 0, matchedIndices: [] };

export function fuzzyMatch(query: string, target: string): FuzzyMatchResult {
  const normalizedWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (normalizedWords.length === 0) {
    return EMPTY_QUERY_RESULT;
  }

  if (!target || normalizedWords.some((word) => word.length > target.length)) {
    return NO_MATCH_RESULT;
  }

  const lowerTarget = target.toLowerCase();
  let totalScore = 0;
  const combinedMatchedIndices = new Set<number>();

  for (const word of normalizedWords) {
    const wordMatch = fuzzyMatchWord(word, target, lowerTarget);
    if (!wordMatch.match) {
      return NO_MATCH_RESULT;
    }

    totalScore += wordMatch.score;
    wordMatch.matchedIndices.forEach((index) => combinedMatchedIndices.add(index));
  }

  return {
    match: true,
    score: totalScore,
    matchedIndices: Array.from(combinedMatchedIndices).sort((a, b) => a - b),
  };
}

export function fuzzyMatchPath(query: string, filePath: string): FuzzyMatchResult {
  const fileName = getFileName(filePath);
  const fileNameMatch = fuzzyMatch(query, fileName);
  if (fileNameMatch.match) {
    return {
      match: true,
      score: fileNameMatch.score + FILENAME_MATCH_BONUS + getShortPathBonus(filePath, fileName),
      matchedIndices: fileNameMatch.matchedIndices,
    };
  }

  return fuzzyMatch(query, filePath);
}

function fuzzyMatchWord(word: string, target: string, lowerTarget: string): FuzzyMatchResult {
  const sequentialIndices = findSequentialMatchIndices(word, lowerTarget);
  const exactSubstringMatches = findExactSubstringMatches(word, lowerTarget);

  if (!sequentialIndices && exactSubstringMatches.length === 0) {
    return NO_MATCH_RESULT;
  }

  const candidates = [
    ...exactSubstringMatches.map((matchedIndices) => ({
      matchedIndices,
      score: scoreMatch(word, target, matchedIndices, true),
    })),
  ];

  if (sequentialIndices) {
    candidates.push({
      matchedIndices: sequentialIndices,
      score: scoreMatch(word, target, sequentialIndices, false),
    });
  }

  const bestCandidate = candidates.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    if (candidate.score > best.score) {
      return candidate;
    }

    if (candidate.score === best.score && candidate.matchedIndices[0] < best.matchedIndices[0]) {
      return candidate;
    }

    return best;
  }, null as { matchedIndices: number[]; score: number } | null);

  if (!bestCandidate) {
    return NO_MATCH_RESULT;
  }

  return {
    match: true,
    score: bestCandidate.score,
    matchedIndices: bestCandidate.matchedIndices,
  };
}

function findSequentialMatchIndices(word: string, lowerTarget: string): number[] | null {
  const matchedIndices: number[] = [];
  let searchStart = 0;

  for (const char of word) {
    const index = lowerTarget.indexOf(char, searchStart);
    if (index === -1) {
      return null;
    }

    matchedIndices.push(index);
    searchStart = index + 1;
  }

  return matchedIndices;
}

function findExactSubstringMatches(word: string, lowerTarget: string): number[][] {
  const matches: number[][] = [];
  let searchStart = 0;

  while (searchStart <= lowerTarget.length - word.length) {
    const index = lowerTarget.indexOf(word, searchStart);
    if (index === -1) {
      break;
    }

    matches.push(Array.from({ length: word.length }, (_, offset) => index + offset));
    searchStart = index + 1;
  }

  return matches;
}

function scoreMatch(word: string, target: string, matchedIndices: number[], isExactSubstring: boolean): number {
  let score = getShortTargetBonus(word.length, target.length);

  if (matchedIndices[0] === 0) {
    score += START_OF_STRING_BONUS;
  }

  if (isExactSubstring) {
    score += EXACT_SUBSTRING_BONUS;
  }

  for (let index = 0; index < matchedIndices.length; index += 1) {
    if (isWordBoundary(target, matchedIndices[index])) {
      score += WORD_BOUNDARY_BONUS;
    }

    if (index > 0 && matchedIndices[index] === matchedIndices[index - 1] + 1) {
      score += CONSECUTIVE_BONUS;
    }
  }

  return score;
}

function getShortTargetBonus(queryLength: number, targetLength: number): number {
  const extraChars = Math.max(0, targetLength - queryLength);
  return Math.max(0, SHORT_TARGET_BONUS_CAP - Math.min(SHORT_TARGET_BONUS_CAP, extraChars));
}

function getShortPathBonus(filePath: string, fileName: string): number {
  const directoryLength = Math.max(0, filePath.length - fileName.length);
  return Math.max(0, SHORT_PATH_BONUS_CAP - Math.min(SHORT_PATH_BONUS_CAP, directoryLength));
}

function isWordBoundary(target: string, index: number): boolean {
  if (index <= 0) {
    return true;
  }

  const previous = target[index - 1];
  const current = target[index];
  if (!current) {
    return false;
  }

  if (isBoundarySeparator(previous)) {
    return true;
  }

  return isLowerCaseLetter(previous) && isUpperCaseLetter(current);
}

function isBoundarySeparator(char: string): boolean {
  return char === "/" || char === "\\" || char === "." || char === "-" || char === "_" || char === " ";
}

function isLowerCaseLetter(char: string): boolean {
  return char >= "a" && char <= "z";
}

function isUpperCaseLetter(char: string): boolean {
  return char >= "A" && char <= "Z";
}

function getFileName(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
}
