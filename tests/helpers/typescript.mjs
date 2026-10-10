import { readFileSync } from "node:fs";
import ts from "typescript";

export const moduleURL = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;

// Test-only loader: run source TypeScript with controlled imports, without a build step.
export function compile(path, imports = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const [name, target] of Object.entries(imports)) {
    outputText = outputText
      .replaceAll(`from "${name}"`, `from "${target}"`)
      .replaceAll(`import "${name}"`, `import "${target}"`);
  }
  return moduleURL(outputText);
}
