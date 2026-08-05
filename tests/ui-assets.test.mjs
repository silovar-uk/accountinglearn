import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => fs.readFile(new URL(path, root), "utf8");

test("index loads UI polish and brand assets", async () => {
  const html = await read("index.html");
  for (const reference of ["favicon.svg", "site.webmanifest", "ui-base.css", "ui-pages.css", "ui-case.css", "ui-responsive.css", "ui-foundation.js", "ui-home.js", "ui-library.js", "ui-case.js", "apple-touch-icon"]) {
    assert.match(html, new RegExp(reference.replace(".", "\\.")));
  }
});

test("web manifest references existing icons", async () => {
  const manifest = JSON.parse(await read("site.webmanifest"));
  assert.equal(manifest.name, "Accounting Quest");
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) {
    await fs.access(new URL(icon.src.replace(/^\.\//, ""), root));
  }
});

test("favicon is a custom SVG asset", async () => {
  const svg = await read("favicon.svg");
  assert.match(svg, /<svg/);
  assert.match(svg, /#0f806f/i);
  assert.match(svg, /f5bd4f/i);
});
