import { Linter } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { featureBoundaries } from "./architecture.js";

const linter = new Linter();
const config = [{
  files: ["**/*.js"],
  plugins: { architecture: { rules: { boundaries: featureBoundaries } } },
  rules: { "architecture/boundaries": "error" },
}];
const filename = path.resolve("src/features/projects/hooks/probe.js");
const verify = (code, file = filename) => linter.verify(code, config, { filename: file });

describe("feature import boundaries", () => {
  for (const source of [
    "@features/articles/services/articleService",
    "@/features/articles/services/articleService",
    "../../articles/services/articleService",
  ]) {
    for (const code of [
      `import value from '${source}';`,
      `export { value } from '${source}';`,
      `export * from '${source}';`,
      `const load = () => import('${source}');`,
    ]) {
      it(`rejects cross-feature access: ${code}`, () => {
        expect(verify(code).map((message) => message.messageId)).toEqual(["boundary"]);
      });
    }
  }
  it("allows public entries and internal imports", () => {
    expect(verify("import value from '@features/articles/public/services';")).toEqual([]);
    expect(verify("import value from '@features/projects/hooks/internal';")).toEqual([]);
  });
  it("keeps shared UI independent of business features", () => {
    expect(verify("import value from '@features/articles/public/components';",
      path.resolve("src/components/ui/probe.js")).map((message) => message.messageId)).toEqual(["shared"]);
  });
});
