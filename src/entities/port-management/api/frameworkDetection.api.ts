import { readTextFile } from "../../../shared/api/fs.api";
import { detectFrameworkFromDependencies, type FrameworkAdapter } from "../lib/frameworkAdapters.pure";

export async function detectFrameworkForPath(projectPath: string): Promise<FrameworkAdapter | null> {
  try {
    const packageJsonPath = `${projectPath}/package.json`;
    const content = await readTextFile(packageJsonPath);
    const parsed = JSON.parse(content);
    const deps = parsed.dependencies ?? {};
    const devDeps = parsed.devDependencies ?? {};
    return detectFrameworkFromDependencies(deps, devDeps);
  } catch {
    return null;
  }
}
