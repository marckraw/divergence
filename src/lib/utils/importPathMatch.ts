const IMPORT_PATH_MATCHERS = [
  /(?:import|export)\s+[^'"]*from\s+["']([^"']*)$/,
  /import\s+["']([^"']*)$/,
  /(?:import|require)\(\s*["']([^"']*)$/,
];

export interface ImportPathMatch {
  value: string;
  matchLength: number;
}

export function getImportPathMatchFromPrefix(prefix: string): ImportPathMatch | null {
  for (const matcher of IMPORT_PATH_MATCHERS) {
    const match = prefix.match(matcher);
    if (match) {
      return {
        value: match[1],
        matchLength: match[1].length,
      };
    }
  }
  return null;
}
