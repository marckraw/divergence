import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
const tag = `v${pkg.version}`;

// Check if tag already exists
try {
  execSync(`git rev-parse ${tag}`, { cwd: root, stdio: "ignore" });
  console.log(`Tag ${tag} already exists, skipping.`);
  process.exit(0);
} catch {
  // Tag does not exist, create it
}

execSync(`git tag ${tag}`, { cwd: root, stdio: "inherit" });
execSync(`git push origin ${tag}`, { cwd: root, stdio: "inherit" });
console.log(`Created and pushed tag ${tag}`);
