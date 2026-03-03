import { useMemo } from "react";
import {
  autocompletion,
  completeAnyWord,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { readDir, readTextFile } from "../../../shared/api/fs.api";
import {
  buildImportLabel,
  getDirname,
  isImportCompletionEnabled,
  joinPath,
  normalizePath,
  resolvePath,
} from "../lib/quickEdit.pure";
import { getImportPathMatchFromPrefix } from "../../../shared";

const DIR_CACHE_TTL_MS = 10_000;
const PACKAGE_CACHE_TTL_MS = 60_000;
const MAX_DIR_CACHE_ENTRIES = 500;
const MAX_PACKAGE_CACHE_ENTRIES = 500;

type DirCacheValue = { at: number; entries: { name: string; isDir: boolean }[] };
type PackageCacheValue = { at: number; names: string[] };

const dirCache = new Map<string, DirCacheValue>();
const packageCache = new Map<string, PackageCacheValue>();

function pruneCache<T extends { at: number }>(
  cache: Map<string, T>,
  now: number,
  ttlMs: number,
  maxEntries: number
): void {
  for (const [key, value] of cache) {
    if (now - value.at >= ttlMs) {
      cache.delete(key);
    }
  }

  if (cache.size <= maxEntries) {
    return;
  }

  const overflowCount = cache.size - maxEntries;
  const oldestKeys = Array.from(cache.entries())
    .sort((left, right) => left[1].at - right[1].at)
    .slice(0, overflowCount)
    .map(([key]) => key);

  for (const key of oldestKeys) {
    cache.delete(key);
  }
}

const getImportPathMatch = (context: CompletionContext) => {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const match = getImportPathMatchFromPrefix(before);
  if (match) {
    return {
      value: match.value,
      from: context.pos - match.matchLength,
    };
  }
  return null;
};

const readDirCached = async (path: string) => {
  const now = Date.now();
  pruneCache(dirCache, now, DIR_CACHE_TTL_MS, MAX_DIR_CACHE_ENTRIES);
  const cached = dirCache.get(path);
  if (cached) {
    cached.at = now;
    return cached.entries;
  }

  try {
    const entries = await readDir(path);
    const normalized = entries
      .map(entry => ({
        name: entry.name ?? "",
        isDir: Boolean(entry.isDirectory),
      }))
      .filter(entry => entry.name.length > 0)
      .sort((a, b) => {
        if (a.isDir !== b.isDir) {
          return a.isDir ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    dirCache.set(path, { at: now, entries: normalized });
    pruneCache(dirCache, now, DIR_CACHE_TTL_MS, MAX_DIR_CACHE_ENTRIES);
    return normalized;
  } catch {
    return [];
  }
};

const readPackageNamesCached = async (rootPath: string) => {
  const now = Date.now();
  pruneCache(packageCache, now, PACKAGE_CACHE_TTL_MS, MAX_PACKAGE_CACHE_ENTRIES);
  const cached = packageCache.get(rootPath);
  if (cached) {
    cached.at = now;
    return cached.names;
  }

  try {
    const packagePath = joinPath(rootPath, "package.json");
    const raw = await readTextFile(packagePath);
    const parsed = JSON.parse(raw);
    const names = new Set<string>();
    const buckets = [
      parsed?.dependencies,
      parsed?.devDependencies,
      parsed?.peerDependencies,
      parsed?.optionalDependencies,
    ];
    for (const bucket of buckets) {
      if (!bucket || typeof bucket !== "object") {
        continue;
      }
      for (const name of Object.keys(bucket)) {
        names.add(name);
      }
    }
    const list = Array.from(names).sort();
    packageCache.set(rootPath, { at: now, names: list });
    pruneCache(packageCache, now, PACKAGE_CACHE_TTL_MS, MAX_PACKAGE_CACHE_ENTRIES);
    return list;
  } catch {
    packageCache.set(rootPath, { at: now, names: [] });
    pruneCache(packageCache, now, PACKAGE_CACHE_TTL_MS, MAX_PACKAGE_CACHE_ENTRIES);
    return [];
  }
};

const getRelativePathCompletions = async (
  filePath: string,
  typed: string
): Promise<Completion[]> => {
  const normalizedTyped = normalizePath(typed);
  const lastSlash = normalizedTyped.lastIndexOf("/");
  const prefixDir = lastSlash >= 0 ? normalizedTyped.slice(0, lastSlash + 1) : "";
  const partial = lastSlash >= 0 ? normalizedTyped.slice(lastSlash + 1) : normalizedTyped;
  const baseDir = getDirname(filePath);
  const targetDir = resolvePath(baseDir, prefixDir || ".");
  const entries = await readDirCached(targetDir);

  return entries
    .filter(entry => (partial ? entry.name.startsWith(partial) : true))
    .map(entry => {
      if (entry.isDir) {
        const label = `${prefixDir}${entry.name}/`;
        return { label, apply: label, type: "folder" } satisfies Completion;
      }
      const labelName = buildImportLabel(entry.name);
      const label = `${prefixDir}${labelName}`;
      return { label, apply: label, type: "file" } satisfies Completion;
    });
};

const getPackageCompletions = async (
  rootPath: string,
  typed: string
): Promise<Completion[]> => {
  const names = await readPackageNamesCached(rootPath);
  return names
    .filter(name => (typed ? name.startsWith(typed) : true))
    .map(name => ({ label: name, type: "module" } satisfies Completion));
};

const createImportPathCompletionSource = (
  filePath: string | null,
  projectRootPath: string | null
) => {
  if (!filePath || !isImportCompletionEnabled(filePath)) {
    return null;
  }

  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const match = getImportPathMatch(context);
    if (!match) {
      return null;
    }

    const { value, from } = match;
    const isRelative = value.startsWith(".");
    const isAbsoluteLike = value.startsWith("/");

    if (isAbsoluteLike) {
      return null;
    }

    if (isRelative) {
      const options = await getRelativePathCompletions(filePath, value);
      if (options.length === 0) {
        return null;
      }
      return {
        from,
        options,
        validFor: /^[^"'`]*$/,
      };
    }

    if (!projectRootPath) {
      return null;
    }

    const options = await getPackageCompletions(projectRootPath, value);
    if (options.length === 0) {
      return null;
    }

    return {
      from,
      options,
      validFor: /^[^"'`]*$/,
    };
  };
};

const buildCompletionExtensions = (filePath: string | null, projectRootPath: string | null) => {
  const sources = [completeAnyWord];
  const importSource = createImportPathCompletionSource(filePath, projectRootPath);
  if (importSource) {
    sources.unshift(importSource);
  }
  return [autocompletion({ override: sources })];
};

interface UseImportPathCompletionParams {
  filePath: string | null;
  projectRootPath: string | null;
}

export function useImportPathCompletion({ filePath, projectRootPath }: UseImportPathCompletionParams) {
  const completionExtensions = useMemo(
    () => buildCompletionExtensions(filePath, projectRootPath),
    [filePath, projectRootPath]
  );

  return { completionExtensions };
}
