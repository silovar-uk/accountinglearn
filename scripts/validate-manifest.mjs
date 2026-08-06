import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.cwd(), process.argv[2] || "data/cases/index.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const errors = [];
const allowedStatuses = new Set(["draft", "reviewing", "tested", "published", "archived", "planned"]);

if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) errors.push("manifest.schemaVersion must be a positive integer");
if (!Array.isArray(manifest.cases) || !manifest.cases.length) errors.push("manifest.cases must contain at least one case");

const ids = new Set();
const paths = new Set();
const releaseOrders = new Set();
let publishedCount = 0;

for (const [index, item] of (manifest.cases || []).entries()) {
  const label = `cases[${index}]`;
  if (!item.id || typeof item.id !== "string") errors.push(`${label}.id is required`);
  if (ids.has(item.id)) errors.push(`duplicate manifest case id: ${item.id}`);
  ids.add(item.id);

  if (!item.path || typeof item.path !== "string") errors.push(`${label}.path is required`);
  if (paths.has(item.path)) errors.push(`duplicate manifest case path: ${item.path}`);
  paths.add(item.path);
  if (item.path && (!item.path.startsWith("./data/cases/") || item.path.includes(".."))) errors.push(`${label}.path must stay inside ./data/cases/`);

  if (!allowedStatuses.has(item.status)) errors.push(`${label}.status is invalid: ${item.status}`);
  if (item.status === "published") publishedCount += 1;

  const casePath = item.path ? path.resolve(process.cwd(), item.path) : null;
  if (!casePath) continue;
  try {
    const data = JSON.parse(await fs.readFile(casePath, "utf8"));
    if (data.id !== item.id) errors.push(`manifest id ${item.id} does not match case id ${data.id}`);
    if (item.releaseOrder !== undefined && item.releaseOrder !== data.releaseOrder) {
      errors.push(`manifest releaseOrder for ${item.id} does not match case data`);
    }
    const releaseOrder = Number(data.releaseOrder);
    if (item.status === "published") {
      if (!Number.isInteger(releaseOrder) || releaseOrder < 1) errors.push(`published case ${item.id} needs a positive releaseOrder`);
      if (releaseOrders.has(releaseOrder)) errors.push(`duplicate published releaseOrder: ${releaseOrder}`);
      releaseOrders.add(releaseOrder);
      if (!data.title || !data.subtitle || !Number.isFinite(Number(data.estimatedMinutes))) {
        errors.push(`published case ${item.id} is missing library metadata`);
      }
    }
  } catch (error) {
    errors.push(`cannot read ${item.path}: ${error.message}`);
  }
}

if (!publishedCount) errors.push("manifest must contain at least one published case");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`OK: manifest / ${manifest.cases.length} cases / ${publishedCount} published`);
