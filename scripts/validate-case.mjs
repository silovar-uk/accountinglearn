import fs from "node:fs/promises";
import path from "node:path";

const file = process.argv[2] || "data/cases/case-001-black-profit-no-cash.json";
const fullPath = path.resolve(process.cwd(), file);
const data = JSON.parse(await fs.readFile(fullPath, "utf8"));
const errors = [];
const warnings = [];
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedPageTypes = new Set(["story", "exercise", "document", "interview", "calculator", "decision", "ending"]);
const allowedStepTypes = new Set(["singleChoice", "multipleChoice", "highlightAnomaly", "formulaBuilder", "journalEntry", "proposalBuilder"]);
const required = ["schemaVersion", "id", "title", "subtitle", "documents", "pages", "scoring"];

for (const key of required) if (data[key] === undefined) errors.push(`missing top-level field: ${key}`);
if (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) errors.push("schemaVersion must be a positive integer");
if (!idPattern.test(data.id || "")) errors.push(`invalid case id: ${data.id}`);
if (!Array.isArray(data.learningObjectives) || !data.learningObjectives.length) errors.push("learningObjectives must not be empty");
if (!Array.isArray(data.documents) || !data.documents.length) errors.push("documents must not be empty");
if (!Array.isArray(data.pages) || !data.pages.length) errors.push("pages must not be empty");

const documentIds = new Set();
const valueIds = new Set();
const documentMap = new Map();
for (const document of data.documents || []) {
  if (!idPattern.test(document.id || "")) errors.push(`invalid document id: ${document.id}`);
  if (documentIds.has(document.id)) errors.push(`duplicate document id: ${document.id}`);
  documentIds.add(document.id);
  documentMap.set(document.id, document);

  const rows = [...(document.rows || []), ...(document.sections || []).flatMap((section) => section.rows || [])];
  for (const row of rows) {
    if (!idPattern.test(row.id || "")) errors.push(`invalid value id: ${row.id}`);
    if (valueIds.has(row.id)) errors.push(`duplicate value id across documents: ${row.id}`);
    valueIds.add(row.id);
    if (Array.isArray(row.values) && Array.isArray(document.periods) && row.values.length !== document.periods.length) {
      errors.push(`${document.id}.${row.id} values do not match periods`);
    }
  }

  if (Array.isArray(document.columns)) {
    const columnIds = new Set();
    for (const column of document.columns) {
      if (columnIds.has(column.id)) errors.push(`duplicate column id ${column.id} in ${document.id}`);
      columnIds.add(column.id);
    }
  }

  if (document.type === "cash-forecast") {
    const inflows = (document.cashInflows || []).reduce((total, item) => total + Number(item.value || 0), 0);
    const outflows = (document.cashOutflows || []).reduce((total, item) => total + Number(item.value || 0), 0);
    const calculated = Number(document.openingCash) + inflows - outflows;
    if (calculated !== Number(document.expectedClosingCash)) errors.push(`${document.id} expectedClosingCash is inconsistent`);
  }

  if (document.type === "cash-flow-bridge") {
    const movement = (document.items || [])
      .filter((item) => item.category !== "subtotal")
      .reduce((total, item) => total + Number(item.value || 0), 0);
    if (Number(document.openingCash) + movement !== Number(document.closingCash)) errors.push(`${document.id} closingCash is inconsistent`);
  }
}

const pageIds = new Set();
const pageOrders = new Set();
const stepIds = new Set();
const stepMap = new Map();
for (const page of data.pages || []) {
  if (!idPattern.test(page.id || "")) errors.push(`invalid page id: ${page.id}`);
  if (pageIds.has(page.id)) errors.push(`duplicate page id: ${page.id}`);
  pageIds.add(page.id);
  if (!Number.isInteger(page.order)) errors.push(`${page.id}.order must be an integer`);
  if (pageOrders.has(page.order)) errors.push(`duplicate page order: ${page.order}`);
  pageOrders.add(page.order);
  if (!allowedPageTypes.has(page.type)) errors.push(`unknown page type ${page.type} in ${page.id}`);

  for (const documentId of page.documentIds || []) {
    if (!documentIds.has(documentId)) errors.push(`unknown document id ${documentId} in ${page.id}`);
  }

  for (const step of page.steps || []) {
    if (!idPattern.test(step.id || "")) errors.push(`invalid step id: ${step.id}`);
    if (stepIds.has(step.id)) errors.push(`duplicate step id: ${step.id}`);
    stepIds.add(step.id);
    stepMap.set(step.id, step);
    if (!allowedStepTypes.has(step.type)) errors.push(`unknown step type ${step.type} in ${step.id}`);
    if (!step.instruction) errors.push(`${step.id} is missing instruction`);

    const optionIds = new Set((step.options || []).map((option) => option.id));
    if (optionIds.size !== (step.options || []).length) errors.push(`duplicate option id in ${step.id}`);
    if (step.correctOptionId && !optionIds.has(step.correctOptionId)) errors.push(`${step.id} correctOptionId is unknown`);
    for (const optionId of step.correctOptionIds || []) if (!optionIds.has(optionId)) errors.push(`${step.id} correct option is unknown: ${optionId}`);
    for (const optionId of [...(step.preferredOptionIds || []), ...(step.acceptableAlternativeIds || [])]) {
      if (!optionIds.has(optionId)) errors.push(`${step.id} scored option is unknown: ${optionId}`);
    }

    for (const valueId of step.selectableValueIds || []) if (!valueIds.has(valueId)) errors.push(`${step.id} selectable value is unknown: ${valueId}`);
    for (const valueId of step.correctValueIds || []) {
      if (!valueIds.has(valueId)) errors.push(`${step.id} correct value is unknown: ${valueId}`);
      if (!(step.selectableValueIds || []).includes(valueId)) errors.push(`${step.id} correct value is not selectable: ${valueId}`);
    }

    if (step.type === "formulaBuilder") {
      if (!step.formula?.template || !Array.isArray(step.formula?.nodes) || !step.formula.nodes.length) errors.push(`${step.id} formula is incomplete`);
      if (!Number.isFinite(Number(step.expected?.value))) errors.push(`${step.id} expected formula value is invalid`);
      for (const node of step.formula?.nodes || []) {
        for (const valueId of node.acceptedValueIds || []) if (!valueIds.has(valueId)) errors.push(`${step.id} formula value is unknown: ${valueId}`);
        if (node.documentId) {
          const document = documentMap.get(node.documentId);
          if (!document) errors.push(`${step.id} formula document is unknown: ${node.documentId}`);
          else if (!(node.sourceField in document)) errors.push(`${step.id} formula sourceField is unknown: ${node.sourceField}`);
        }
      }
    }

    if (step.type === "journalEntry") {
      const accountIds = new Set((step.accountChoices || []).map((account) => account.id));
      for (const entry of step.expectedEntries || []) {
        if (!accountIds.has(entry.debitAccountId)) errors.push(`${step.id} debit account is unknown`);
        if (!accountIds.has(entry.creditAccountId)) errors.push(`${step.id} credit account is unknown`);
        if (Number(entry.debitAmount) !== Number(entry.creditAmount)) errors.push(`${step.id} journal entry does not balance`);
        if (!(Number(entry.debitAmount) > 0)) errors.push(`${step.id} journal amount must be positive`);
      }
    }

    if (step.type === "proposalBuilder") {
      const fieldIds = new Set();
      for (const field of step.fields || []) {
        if (fieldIds.has(field.id)) errors.push(`duplicate proposal field ${field.id} in ${step.id}`);
        fieldIds.add(field.id);
      }
      if (!(step.fields || []).some((field) => field.required)) warnings.push(`${step.id} has no required proposal fields`);
    }
  }
}

const sortedOrders = [...pageOrders].sort((a, b) => a - b);
for (let index = 0; index < sortedOrders.length; index += 1) {
  if (sortedOrders[index] !== index + 1) errors.push(`page order must be sequential from 1; found ${sortedOrders.join(", ")}`);
}

let calculatedMaxScore = 0;
for (const stepId of data.scoring?.autoScoredStepIds || []) {
  const step = stepMap.get(stepId);
  if (!step) errors.push(`unknown scored step id: ${stepId}`);
  else {
    const maxPoints = Number(step.scoring?.maxPoints);
    if (!Number.isFinite(maxPoints) || maxPoints <= 0) errors.push(`${stepId} needs positive scoring.maxPoints`);
    else calculatedMaxScore += maxPoints;
  }
}
if (calculatedMaxScore !== Number(data.scoring?.maxAutoScore)) {
  errors.push(`maxAutoScore ${data.scoring?.maxAutoScore} does not equal scored step total ${calculatedMaxScore}`);
}

const ending = (data.pages || []).find((page) => page.type === "ending");
if (!ending) errors.push("case needs an ending page");
else {
  const tiers = ending.resultTiers || [];
  if (!tiers.some((tier) => Number(tier.minScore) === 0)) errors.push("ending resultTiers must include a 0-point tier");
  if (!ending.modelAnalysis?.summary || !ending.modelAnalysis?.keyFindings?.length) errors.push("ending modelAnalysis is incomplete");
  if (!ending.review?.checklist?.length) errors.push("ending review checklist is empty");
}

if (warnings.length) console.warn(warnings.map((warning) => `WARN: ${warning}`).join("\n"));
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`OK: ${data.id} / ${data.pages.length} pages / ${stepIds.size} steps / ${documentIds.size} documents / ${calculatedMaxScore} points`);
