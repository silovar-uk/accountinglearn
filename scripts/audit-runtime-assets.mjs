import fs from "node:fs/promises";

const [html, serviceWorker, manifestText] = await Promise.all([
  fs.readFile("index.html", "utf8"),
  fs.readFile("sw.js", "utf8"),
  fs.readFile("data/cases/index.json", "utf8"),
]);
const manifest = JSON.parse(manifestText);
const errors = [];
const normalize = (value) => value.replace(/^\.\//, "");

const htmlAssets = [...html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)]
  .map((match) => normalize(match[1]))
  .filter((asset) => /\.(?:js|css|svg|png|webmanifest)$/.test(asset));
const cachedAssets = new Set([...serviceWorker.matchAll(/"(\.\/[^"?#]+)"/g)].map((match) => normalize(match[1])));
const requiredAssets = new Set([...htmlAssets, "index.html", "data/cases/index.json"]);
for (const item of manifest.cases || []) if (item.status === "published") requiredAssets.add(normalize(item.path));

for (const asset of requiredAssets) {
  try {
    await fs.access(asset);
  } catch {
    errors.push(`referenced asset does not exist: ${asset}`);
  }
  if (!cachedAssets.has(asset) && asset !== "sw.js") errors.push(`service worker does not cache: ${asset}`);
}

if (!/accounting-quest-v\d+/.test(serviceWorker)) errors.push("service worker cache name must be versioned");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: runtime assets / ${requiredAssets.size} required / ${cachedAssets.size} cached`);
