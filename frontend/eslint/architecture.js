import path from "node:path";

export const featureBoundaries = {
  meta: { type: "problem", schema: [], messages: {
    boundary: "Import another feature through its public entry point.",
    shared: "Shared UI must receive feature data/actions through props.",
  } },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const ownFeature = filename.match(/\/src\/features\/([^/]+)\//)?.[1];
    function check(node) {
      const source = node.source?.value;
      if (typeof source !== "string") return;
      const resolved = source.startsWith(".")
        ? path.resolve(path.dirname(filename), source).replaceAll("\\", "/")
        : source.replace(/^@features\//, "/src/features/").replace(/^@\//, "/src/");
      const target = resolved.match(/\/src\/features\/([^/]+)\/(.+)/);
      if (!target) return;
      if (filename.includes("/src/components/ui/")) {
        context.report({ node, messageId: "shared" });
      } else if (target[1] !== ownFeature && !target[2].startsWith("public/")) {
        context.report({ node, messageId: "boundary" });
      }
    }
    return { ImportDeclaration: check, ExportNamedDeclaration: check, ExportAllDeclaration: check,
      ImportExpression(node) { check(node); } };
  },
};
