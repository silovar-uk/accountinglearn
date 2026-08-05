import fs from "node:fs/promises";
import path from "node:path";

const file = process.argv[2] || "data/cases/case-001-black-profit-no-cash.json";
const fullPath = path.resolve(process.cwd(), file);
const data = JSON.parse(await fs.readFile(fullPath, "utf8"));

const errors = [];
const required = ["schemaVersion", "id", "title", "documents", "pages", "scoring"];
for (const key of required) {
  if (data[key] === undefined) errors.push(`missing top-level field: ${key}`);
}

const pageIds = new Set();
const stepIds = new Set();
const documentIds = new Set(data.documents?.map((document) => document.id) || []);

for (const page of data.pages || []) {
  if (pageIds.has(page.id)) errors.push(`duplicate page id: ${page.id}`);
  pageIds.add(page.id);
  for (const documentId of page.documentIds || []) {
    if (!documentIds.has(documentId)) errors.push(`unknown document id ${documentId} in ${page.id}`);
  }
  for (const step of page.steps || []) {
    if (stepIds.has(step.id)) errors.push(`duplicate step id: ${step.id}`);
    stepIds.add(step.id);
  }
}

for (const stepId of data.scoring?.autoScoredStepIds || []) {
  if (!stepIds.has(stepId)) errors.push(`unknown scored step id: ${stepId}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`OK: ${data.id} / ${data.pages.length} pages / ${stepIds.size} steps / ${documentIds.size} documents`);
