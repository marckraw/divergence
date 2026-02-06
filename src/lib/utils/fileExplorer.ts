import type { DirEntry } from "@tauri-apps/plugin-fs";

export interface BadgeInfo {
  label: string;
  className: string;
}

export interface FileEntry {
  path: string;
  name: string;
  isDir: boolean;
}

const FILE_BADGE_BY_NAME: Record<string, BadgeInfo> = {
  "package.json": { label: "NPM", className: "bg-emerald-500/20 text-emerald-200" },
  "package-lock.json": { label: "LOCK", className: "bg-emerald-500/20 text-emerald-200" },
  "tsconfig.json": { label: "TS", className: "bg-blue-500/20 text-blue-200" },
  "vite.config.ts": { label: "VITE", className: "bg-purple-500/20 text-purple-200" },
  "readme.md": { label: "MD", className: "bg-sky-500/20 text-sky-200" },
  ".env": { label: "ENV", className: "bg-amber-500/20 text-amber-200" },
  ".gitignore": { label: "GIT", className: "bg-orange-500/20 text-orange-200" },
  "cargo.toml": { label: "TOML", className: "bg-orange-500/20 text-orange-200" },
  "cargo.lock": { label: "LOCK", className: "bg-orange-500/20 text-orange-200" },
};

const FILE_BADGE_BY_EXT: Record<string, BadgeInfo> = {
  ts: { label: "TS", className: "bg-blue-500/20 text-blue-200" },
  tsx: { label: "TSX", className: "bg-blue-500/20 text-blue-200" },
  js: { label: "JS", className: "bg-yellow-500/20 text-yellow-200" },
  jsx: { label: "JSX", className: "bg-yellow-500/20 text-yellow-200" },
  json: { label: "JSON", className: "bg-amber-500/20 text-amber-200" },
  md: { label: "MD", className: "bg-sky-500/20 text-sky-200" },
  mdx: { label: "MDX", className: "bg-sky-500/20 text-sky-200" },
  css: { label: "CSS", className: "bg-blue-400/20 text-blue-200" },
  scss: { label: "SCSS", className: "bg-pink-400/20 text-pink-200" },
  sass: { label: "SASS", className: "bg-pink-400/20 text-pink-200" },
  less: { label: "LESS", className: "bg-indigo-400/20 text-indigo-200" },
  html: { label: "HTML", className: "bg-orange-500/20 text-orange-200" },
  yml: { label: "YML", className: "bg-teal-500/20 text-teal-200" },
  yaml: { label: "YAML", className: "bg-teal-500/20 text-teal-200" },
  toml: { label: "TOML", className: "bg-orange-400/20 text-orange-200" },
  rs: { label: "RS", className: "bg-orange-400/20 text-orange-200" },
  py: { label: "PY", className: "bg-green-500/20 text-green-200" },
  sql: { label: "SQL", className: "bg-cyan-500/20 text-cyan-200" },
  sh: { label: "SH", className: "bg-lime-500/20 text-lime-200" },
  zsh: { label: "ZSH", className: "bg-lime-500/20 text-lime-200" },
  env: { label: "ENV", className: "bg-amber-500/20 text-amber-200" },
  lock: { label: "LOCK", className: "bg-slate-500/20 text-slate-200" },
  png: { label: "IMG", className: "bg-pink-500/20 text-pink-200" },
  jpg: { label: "IMG", className: "bg-pink-500/20 text-pink-200" },
  jpeg: { label: "IMG", className: "bg-pink-500/20 text-pink-200" },
  gif: { label: "IMG", className: "bg-pink-500/20 text-pink-200" },
  svg: { label: "SVG", className: "bg-pink-500/20 text-pink-200" },
  ico: { label: "ICO", className: "bg-pink-500/20 text-pink-200" },
};

export function getBaseName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function getFileBadgeInfo(name: string): BadgeInfo {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith(".env")) {
    return FILE_BADGE_BY_EXT.env;
  }

  const fromName = FILE_BADGE_BY_NAME[lowerName];
  if (fromName) {
    return fromName;
  }

  const ext = lowerName.includes(".") ? lowerName.split(".").pop() ?? "" : lowerName;
  const fromExt = ext ? FILE_BADGE_BY_EXT[ext] : undefined;
  if (fromExt) {
    return fromExt;
  }

  const label = ext ? ext.slice(0, 4).toUpperCase() : "FILE";
  return { label, className: "bg-surface text-subtext" };
}

export function joinFileExplorerPath(parent: string, name: string): string {
  const cleanName = name.replace(/^[/\\]+/, "");
  if (parent.endsWith("/") || parent.endsWith("\\")) {
    return `${parent}${cleanName}`;
  }
  const separator = parent.includes("\\") ? "\\" : "/";
  return `${parent}${separator}${cleanName}`;
}

export function normalizeFileExplorerEntry(parentPath: string, entry: DirEntry): FileEntry {
  const name = entry.name ?? getBaseName(parentPath);
  return {
    path: joinFileExplorerPath(parentPath, name),
    name,
    isDir: Boolean(entry.isDirectory),
  };
}

export function sortFileExplorerEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDir !== b.isDir) {
      return a.isDir ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
