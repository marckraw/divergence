import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
const version = pkg.version;

const cargoPath = resolve(root, "src-tauri", "Cargo.toml");
let cargo = readFileSync(cargoPath, "utf-8");

cargo = cargo.replace(
  /^(version\s*=\s*")([^"]+)(")/m,
  `$1${version}$3`
);

writeFileSync(cargoPath, cargo);
console.log(`Synced version ${version} → src-tauri/Cargo.toml`);
