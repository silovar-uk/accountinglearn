import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

function parseArguments(argv) {
  const args = { source: null, out: null, write: false, manifest: "data/cases/index.json" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index];
    else if (value === "--write") args.write = true;
    else if (value === "--manifest") args.manifest = argv[++index];
    else if (!args.source) args.source = value;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.source) throw new Error("Usage: node scripts/migrate-case-v2.mjs <case.json> [--out output.json | --write]");
  if (args.out && args.write) throw new Error("Use either --out or --write, not both");
  return args;
}

async function loadRuntime() {
  const source = await fs.readFile(path.resolve("case-schema.js"), "utf8");
  const context = { console, structuredClone };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "case-schema.js" });
  return context;
}

function nativeV2Case(normalized) {
  const output = structuredClone(normalized);
  output.schemaVersion = 2;
  output.source = {
    schemaVersion: normalized.source?.schemaVersion || 1,
    migratedFromLegacy: (normalized.source?.schemaVersion || 1) < 2,
  };
  delete output.releaseOrder;
  delete output.difficulty;
  delete output.estimatedMinutes;
  delete output.learningObjectives;
  delete output.skillIds;
  delete output.prerequisiteSkillIds;
  return output;
}

const args = parseArguments(process.argv.slice(2));
const sourcePath = path.resolve(args.source);
const raw = JSON.parse(await fs.readFile(sourcePath, "utf8"));
let manifestEntry = {};
try {
  const manifest = JSON.parse(await fs.readFile(path.resolve(args.manifest), "utf8"));
  manifestEntry = (manifest.cases || []).find((item) => item.id === raw.id) || {};
} catch {
  // A standalone draft can be migrated without a catalog entry.
}

const runtime = await loadRuntime();
const migrated = nativeV2Case(runtime.normalizeCaseDefinition(raw, manifestEntry));
const serialized = `${JSON.stringify(migrated, null, 2)}\n`;

if (args.write) {
  await fs.writeFile(sourcePath, serialized);
  console.log(`Migrated in place: ${path.relative(process.cwd(), sourcePath)}`);
} else if (args.out) {
  const outputPath = path.resolve(args.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, serialized);
  console.log(`Migrated: ${path.relative(process.cwd(), sourcePath)} -> ${path.relative(process.cwd(), outputPath)}`);
} else {
  process.stdout.write(serialized);
}
