import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.cwd(), process.argv[2] || "data/cases/index.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const errors = [];
const allowedStatuses = new Set(["draft", "reviewing", "tested", "published", "archived", "planned"]);
const allowedFormats = new Set(["micro-case", "short-case", "full-case", "public-company-case"]);
const semverPattern = /^\d+\.\d+\.\d+$/;
const skillIdPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) errors.push("manifest.schemaVersion must be a positive integer");
if (!Array.isArray(manifest.cases) || !manifest.cases.length) errors.push("manifest.cases must contain at least one case");

let skillCatalog = { skills: [] };
const knownSkills = new Set();
if (manifest.schemaVersion >= 2) {
  if (!manifest.skillsPath || typeof manifest.skillsPath !== "string") {
    errors.push("schema v2 manifest needs skillsPath");
  } else if (!manifest.skillsPath.startsWith("./data/skills/") || manifest.skillsPath.includes("..")) {
    errors.push("manifest.skillsPath must stay inside ./data/skills/");
  } else {
    try {
      skillCatalog = JSON.parse(await fs.readFile(path.resolve(process.cwd(), manifest.skillsPath), "utf8"));
      if (!Array.isArray(skillCatalog.skills) || !skillCatalog.skills.length) errors.push("skill catalog must contain at least one skill");
      for (const skill of skillCatalog.skills || []) {
        if (!skillIdPattern.test(skill.id || "")) errors.push(`invalid skill id in catalog: ${skill.id}`);
        if (knownSkills.has(skill.id)) errors.push(`duplicate skill id in catalog: ${skill.id}`);
        knownSkills.add(skill.id);
      }
    } catch (error) {
      errors.push(`cannot read ${manifest.skillsPath}: ${error.message}`);
    }
  }
}

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

  if (manifest.schemaVersion >= 2) {
    if (!Number.isInteger(item.sourceSchemaVersion) || item.sourceSchemaVersion < 1 || item.sourceSchemaVersion > 2) {
      errors.push(`${label}.sourceSchemaVersion must be 1 or 2`);
    }
    if (!semverPattern.test(item.contentVersion || "")) errors.push(`${label}.contentVersion must use x.y.z format`);
    if (!item.metadata || typeof item.metadata !== "object") {
      errors.push(`${label}.metadata is required`);
    } else {
      if (!Number.isInteger(item.metadata.difficultyLevel) || item.metadata.difficultyLevel < 1 || item.metadata.difficultyLevel > 5) {
        errors.push(`${label}.metadata.difficultyLevel must be 1 to 5`);
      }
      if (!Number.isInteger(item.metadata.estimatedMinutes) || item.metadata.estimatedMinutes < 1) {
        errors.push(`${label}.metadata.estimatedMinutes must be positive`);
      }
      if (!allowedFormats.has(item.metadata.format)) errors.push(`${label}.metadata.format is invalid`);
      for (const key of ["industry", "companyStage", "locale"]) {
        if (!item.metadata[key] || typeof item.metadata[key] !== "string") errors.push(`${label}.metadata.${key} is required`);
      }
      if (typeof item.metadata.fictional !== "boolean") errors.push(`${label}.metadata.fictional must be boolean`);
    }
    for (const key of ["prerequisiteSkillIds", "skillIds"]) {
      if (!Array.isArray(item[key])) errors.push(`${label}.${key} must be an array`);
      const values = item[key] || [];
      if (new Set(values).size !== values.length) errors.push(`${label}.${key} contains duplicates`);
      for (const skillId of values) {
        if (!knownSkills.has(skillId)) errors.push(`${label}.${key} contains unknown skill: ${skillId}`);
      }
    }
  }

  const casePath = item.path ? path.resolve(process.cwd(), item.path) : null;
  if (!casePath) continue;
  try {
    const data = JSON.parse(await fs.readFile(casePath, "utf8"));
    if (data.id !== item.id) errors.push(`manifest id ${item.id} does not match case id ${data.id}`);
    if (manifest.schemaVersion >= 2 && Number(data.schemaVersion) !== Number(item.sourceSchemaVersion)) {
      errors.push(`manifest sourceSchemaVersion for ${item.id} does not match case data`);
    }
    if (item.releaseOrder !== undefined && item.releaseOrder !== (data.releaseOrder ?? data.metadata?.releaseOrder)) {
      errors.push(`manifest releaseOrder for ${item.id} does not match case data`);
    }
    const releaseOrder = Number(data.releaseOrder ?? data.metadata?.releaseOrder);
    if (item.status === "published") {
      if (!Number.isInteger(releaseOrder) || releaseOrder < 1) errors.push(`published case ${item.id} needs a positive releaseOrder`);
      if (releaseOrders.has(releaseOrder)) errors.push(`duplicate published releaseOrder: ${releaseOrder}`);
      releaseOrders.add(releaseOrder);
      const estimatedMinutes = data.estimatedMinutes ?? data.metadata?.estimatedMinutes ?? item.metadata?.estimatedMinutes;
      if (!data.title || !data.subtitle || !Number.isFinite(Number(estimatedMinutes))) {
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

console.log(`OK: manifest v${manifest.schemaVersion} / ${manifest.cases.length} cases / ${publishedCount} published / ${knownSkills.size} skills`);
