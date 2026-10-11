/**
 * Gate: no `title=` tooltips (plan Step 4, spec 9.1 and 9.5).
 *
 * Native title tooltips cannot be hovered, never show on keyboard focus and are not read
 * reliably, so every hint goes through components/studio/Tooltip (SC 1.4.13). The TSX is
 * parsed with the TypeScript compiler, so only a `title` attribute on a DOM element (a
 * lowercase JSX tag such as <button> or <svg>) fails. A `title` prop on a component
 * (<Dialog title=...>, <CanvasApp title=...>) is a heading or data, not a tooltip.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./design-gate-files";

const files = sourceFiles(["app", "canvas", "components", "ui"], /\.tsx$/);

function titleAttributes(file: string, text = read(file)): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const intrinsic = /^[a-z]/.test(tag) && !tag.includes(".");
      if (intrinsic) {
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && attr.name.getText(source) === "title") {
            const { line } = source.getLineAndCharacterOfPosition(attr.getStart(source));
            found.push(`${file}:${line + 1} <${tag} title=...>`);
          }
          // A spread object literal that sets title: <div {...{ title }}>.
          if (ts.isJsxSpreadAttribute(attr) && ts.isObjectLiteralExpression(attr.expression)) {
            for (const p of attr.expression.properties) {
              if (p.name && p.name.getText(source) === "title") {
                const { line } = source.getLineAndCharacterOfPosition(p.getStart(source));
                found.push(`${file}:${line + 1} <${tag} {...{ title }}>`);
              }
            }
          }
        }
      }
    }
    // createElement("div", { title }) and el.title = "..." / setAttribute("title", ...).
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      const [first, second] = node.arguments;
      if (/(^|\.)setAttribute$/.test(callee) && first && ts.isStringLiteral(first) && first.text === "title") {
        found.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} setAttribute("title")`);
      }
      if (/(^|\.)createElement$/.test(callee) && first && ts.isStringLiteral(first) && second && ts.isObjectLiteralExpression(second)) {
        if (second.properties.some((p) => p.name?.getText(source) === "title")) {
          found.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} createElement(..., { title })`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("design gate: no title= tooltips", () => {
  it("scans the real components", () => {
    expect(files).toEqual(expect.arrayContaining(["canvas/CanvasApp.tsx", "canvas/Toolbar.tsx", "components/studio/Tooltip.tsx", "ui/canvas/main.tsx"]));
  });

  it("finds a title attribute when there is one (self-check)", () => {
    const sample = [
      'const a = <button title="Zoom in" />;',
      "const b = <Dialog title=\"Share canvas\" />;",
      'const c = <svg><title>Logo</title></svg>;',
      'el.setAttribute("title", "x");',
    ].join("\n");
    expect(titleAttributes("sample.tsx", sample)).toEqual(['sample.tsx:1 <button title=...>', 'sample.tsx:4 setAttribute("title")']);
  });

  it.each(files)("%s uses Tooltip instead of title=", (file) => {
    expect(titleAttributes(file), "wrap the control in components/studio/Tooltip").toEqual([]);
  });
});
