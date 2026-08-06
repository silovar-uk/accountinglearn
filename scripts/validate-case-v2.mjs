import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const manifestPath = path.resolve(process.cwd(), process.argv[2] || "data/cases/index.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const errors = [];
const warnings = [];

async function loadCaseSchemaRuntime() {
  const source = await fs.readFile(path.resolve(process.cwd(), "case-schema.js"), "utf8");
  const context = { console, structuredClone };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "case-schema.js" });
  return context;
}

function requireNativeV2Fields(raw, label) {
  if (raw.schemaVersion !== 2) return;
  if (!raw.metadata || !raw.pedagogy) errors.push(`${label} native v2 case needs metadata and pedagogy`);
  for (const page of raw.pages || []) {
    if (!page.unlock) errors.push(`${label}.${page.id} native v2 page needs unlock`);
    if (!Number.isInteger(page.estimatedMinutes)) errors.push(`${label}.${page.id} native v2 page needs estimatedMinutes`);
    if (!Array.isArray(page.skillIds)) errors.push(`${label}.${page.id} native v2 page needs skillIds`);
    for (const step of page.steps || []) {
      if (!Array.isArray(step.skillIds)) errors.push(`${label}.${step.id} native v2 step needs skillIds`);
      if (!Array.isArray(step.hints) || !step.hints.length) errors.push(`${label}.${step.id} native v2 step needs hints`);
      if (!step.assessment) errors.push(`${label}.${step.id} native v2 step needs assessment`);
    }
  }
}

function validateMachineSchema(schema) {
  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") errors.push("case-v2.schema.json must use JSON Schema draft 2020-12");
  if (schema.properties?.schemaVersion?.const !== 2) errors.push("case-v2.schema.json must require schemaVersion 2");
  for (const definition of ["metadata", "pedagogy", "unlock", "hint", "assessment", "step", "page"]) {
    if (!schema.$defs?.[definition]) errors.push(`case-v2.schema.json is missing $defs.${definition}`);
  }
  const required = new Set(schema.required || []);
  for (const field of ["schemaVersion", "id", "title", "subtitle", "metadata", "pedagogy", "documents", "pages", "scoring"]) {
    if (!required.has(field)) errors.push(`case-v2.schema.json top-level required is missing ${field}`);
  }
  const unlockVariants = schema.$defs?.unlock?.oneOf || [];
  const unlockTypes = new Set(unlockVariants.map((variant) => variant.properties?.type?.const).filter(Boolean));
  for (const type of ["always", "page-complete", "all-previous-complete", "skill-mastered", "manual"]) {
    if (!unlockTypes.has(type)) errors.push(`case-v2.schema.json unlock does not define ${type}`);
  }
}

const runtime = await loadCaseSchemaRuntime();
if (manifest.schemaVersion !== 2) errors.push("case manifest must use schemaVersion 2");
if (!manifest.skillsPath) errors.push("case manifest needs skillsPath");

try {
  const machineSchema = JSON.parse(await fs.readFile(path.resolve(process.cwd(), "schemas/case-v2.schema.json"), "utf8"));
  validateMachineSchema(machineSchema);
} catch (error) {
  errors.push(`cannot read machine-readable case schema: ${error.message}`);
}

let skillCatalog = { schemaVersion: 1, skills: [] };
try {
  skillCatalog = JSON.parse(await fs.readFile(path.resolve(process.cwd(), manifest.skillsPath), "utf8"));
} catch (error) {
  errors.push(`cannot read skill catalog: ${error.message}`);
}

const skillValidation = runtime.validateSkillCatalog(skillCatalog);
errors.push(...skillValidation.errors);
warnings.push(...skillValidation.warnings);
const skillIds = new Set((skillCatalog.skills || []).map((skill) => skill.id));
const globalStepOwners = new Map();
let normalizedCount = 0;
let nativeCount = 0;

for (const entry of manifest.cases || []) {
  const casePath = path.resolve(process.cwd(), entry.path);
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(casePath, "utf8"));
  } catch (error) {
    errors.push(`cannot read ${entry.path}: ${error.message}`);
    continue;
  }
  const label = entry.id || entry.path;
  if (Number(entry.sourceSchemaVersion) !== Number(raw.schemaVersion)) {
    errors.push(`${label} manifest sourceSchemaVersion does not match case file`);
  }
  requireNativeV2Fields(raw, label);
  if (raw.schemaVersion === 2) nativeCount += 1;

  let normalized;
  try {
    normalized = runtime.normalizeCaseDefinition(raw, entry);
  } catch (error) {
    errors.push(`${label} could not be normalized: ${error.message}`);
    continue;
  }
  normalizedCount += 1;
  const validation = runtime.validateCaseDefinition(normalized, skillCatalog);
  errors.push(...validation.errors.map((error) => `${label}: ${error}`));
  warnings.push(...validation.warnings.map((warning) => `${label}: ${warning}`));

  if (normalized.schemaVersion !== 2) errors.push(`${label} did not normalize to schemaVersion 2`);
  if (normalized.source?.schemaVersion !== raw.schemaVersion) errors.push(`${label} lost its source schema version`);
  if (normalized.metadata?.status !== entry.status) errors.push(`${label} normalized status does not match manifest`);
  if (normalized.metadata?.contentVersion !== entry.contentVersion) errors.push(`${label} normalized contentVersion does not match manifest`);
  if (normalized.metadata?.releaseOrder !== entry.releaseOrder) errors.push(`${label} normalized releaseOrder does not match manifest`);

  const declaredSkills = new Set(normalized.pedagogy?.skillIds || []);
  for (const prerequisite of normalized.pedagogy?.prerequisiteSkillIds || []) {
    if (!skillIds.has(prerequisite)) errors.push(`${label} has unknown prerequisite skill: ${prerequisite}`);
  }
  for (const page of normalized.pages || []) {
    for (const skillId of page.skillIds || []) {
      if (!declaredSkills.has(skillId)) errors.push(`${label}.${page.id} uses skill not declared by the case: ${skillId}`);
    }
    for (const step of page.steps || []) {
      const existingOwner = globalStepOwners.get(step.id);
      if (existingOwner && existingOwner !== label) {
        errors.push(`duplicate step id across cases: ${step.id} (${existingOwner}, ${label})`);
      } else {
        globalStepOwners.set(step.id, label);
      }
      if (Number(step.assessment?.maxPoints || 0) !== Number(step.scoring?.maxPoints || 0) && step.assessment?.mode === "auto") {
        errors.push(`${label}.${step.id} assessment maxPoints does not match scoring.maxPoints`);
      }
    }
  }
}

const fixturePath = path.resolve(process.cwd(), "tests/fixtures/case-v2-minimal.json");
try {
  const fixture = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  requireNativeV2Fields(fixture, "case-v2-minimal fixture");
  const normalizedFixture = runtime.normalizeCaseDefinition(fixture, {
    status: fixture.metadata.status,
    releaseOrder: fixture.metadata.releaseOrder,
    contentVersion: fixture.metadata.contentVersion,
    skillIds: fixture.pedagogy.skillIds,
    prerequisiteSkillIds: fixture.pedagogy.prerequisiteSkillIds,
    metadata: {
      difficultyLevel: fixture.metadata.difficulty.level,
      estimatedMinutes: fixture.metadata.estimatedMinutes,
      format: fixture.metadata.format,
      industry: fixture.metadata.industry,
      companyStage: fixture.metadata.companyStage,
      fictional: fixture.metadata.fictional,
      locale: fixture.metadata.locale
    }
  });
  const fixtureValidation = runtime.validateCaseDefinition(normalizedFixture, skillCatalog);
  errors.push(...fixtureValidation.errors.map((error) => `case-v2-minimal fixture: ${error}`));
  nativeCount += 1;
} catch (error) {
  errors.push(`cannot validate native v2 fixture: ${error.message}`);
}

if (warnings.length) console.warn([...new Set(warnings)].map((warning) => `WARN: ${warning}`).join("\n"));
if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exit(1);
}

console.log(`OK: case schema v2 / ${normalizedCount} published definitions normalized / ${nativeCount} native v2 fixture(s) / ${skillIds.size} skills / ${globalStepOwners.size} globally unique steps`);
