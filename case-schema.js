const CASE_SCHEMA_VERSION = 2;
const CASE_DIFFICULTY_LABELS = {
  1: "入門",
  2: "基礎",
  3: "標準",
  4: "応用",
  5: "実践",
};
const CASE_STATUS_VALUES = new Set(["draft", "reviewing", "tested", "published", "archived", "planned"]);
const CASE_UNLOCK_TYPES = new Set(["always", "page-complete", "all-previous-complete", "skill-mastered", "manual"]);
const CASE_ASSESSMENT_MODES = new Set(["auto", "self-review", "completion", "none"]);

function cloneCaseValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function uniqueCaseStrings(values) {
  return [...new Set((values || []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function positiveCaseInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function getCaseDifficultyLabel(level) {
  return CASE_DIFFICULTY_LABELS[positiveCaseInteger(level, 1)] || CASE_DIFFICULTY_LABELS[1];
}

function inferStepSkillIds(step) {
  const byType = {
    singleChoice: ["reasoning.evidence-selection"],
    multipleChoice: ["reasoning.evidence-selection"],
    highlightAnomaly: ["analysis.variance"],
    formulaBuilder: ["analysis.calculation"],
    journalEntry: ["accounting.journal-entry"],
    proposalBuilder: ["consulting.recommendation"],
  };
  return byType[step.type] || [];
}

function defaultHintText(step, level) {
  const firstHints = {
    singleChoice: "選択肢を、資料に書かれた事実と一つずつ照らし合わせます。",
    multipleChoice: "問題文が求める個数と、経営課題へ直接つながる選択肢を確認します。",
    highlightAnomaly: "利益だけでなく、現金がどこへ移ったかを前年差から追います。",
    formulaBuilder: `まず「${step.formula?.template || "必要な式"}」に、同じ単位の数字を当てはめます。`,
    journalEntry: "現金が動いたか、未入金・未払いかを先に確認して借方と貸方を決めます。",
    proposalBuilder: "事実、原因、今すぐ行うこと、再発防止の順に分けて書きます。",
  };
  if (level === 1) return firstHints[step.type] || "数字、原因、経営への影響の順に整理します。";
  return step.feedback?.incorrect || step.feedback?.default || step.feedback?.partial || firstHints[step.type] || "資料の根拠をもう一度確認します。";
}

function normalizeStepHints(step) {
  const explicit = Array.isArray(step.hints) ? step.hints : [];
  if (explicit.length) {
    return explicit
      .map((hint, index) => typeof hint === "string"
        ? { level: index + 1, label: index === 0 ? "着眼点" : "考え方", text: hint }
        : {
            level: positiveCaseInteger(hint.level, index + 1),
            label: hint.label || (index === 0 ? "着眼点" : "考え方"),
            text: String(hint.text || "").trim(),
          })
      .filter((hint) => hint.text)
      .sort((a, b) => a.level - b.level);
  }
  if (step.hint) {
    const text = typeof step.hint === "string" ? step.hint : step.hint.text;
    if (text) return [{ level: 1, label: "着眼点", text }];
  }
  const hints = [{ level: 1, label: "着眼点", text: defaultHintText(step, 1) }];
  const second = defaultHintText(step, 2);
  if (second && second !== hints[0].text) hints.push({ level: 2, label: "考え方", text: second });
  return hints;
}

function normalizeStepAssessment(step) {
  const maxPoints = Number(step.assessment?.maxPoints ?? step.scoring?.maxPoints ?? 0);
  const mode = step.assessment?.mode
    || (maxPoints > 0 ? "auto" : step.type === "proposalBuilder" ? "self-review" : "completion");
  return {
    mode,
    maxPoints: Number.isFinite(maxPoints) && maxPoints >= 0 ? maxPoints : 0,
    rubricCriteria: Array.isArray(step.assessment?.rubricCriteria)
      ? step.assessment.rubricCriteria.map((criterion, index) => ({
          id: criterion.id || `${step.id}-criterion-${index + 1}`,
          label: String(criterion.label || criterion.text || "").trim(),
          weight: Number.isFinite(Number(criterion.weight)) ? Number(criterion.weight) : 1,
        })).filter((criterion) => criterion.label)
      : [],
  };
}

function normalizeCaseStep(step) {
  const normalized = cloneCaseValue(step);
  normalized.skillIds = uniqueCaseStrings([...(step.skillIds || []), ...inferStepSkillIds(step)]);
  normalized.hints = normalizeStepHints(step);
  normalized.assessment = normalizeStepAssessment(step);
  return normalized;
}

function normalizePageUnlock(page, index, pages) {
  if (page.unlock && typeof page.unlock === "object") return cloneCaseValue(page.unlock);
  if (index === 0) return { type: "always" };
  return { type: "page-complete", pageId: pages[index - 1].id };
}

function normalizeCasePage(page, index, pages, estimatedMinutes) {
  const normalized = cloneCaseValue(page);
  normalized.unlock = normalizePageUnlock(page, index, pages);
  normalized.estimatedMinutes = positiveCaseInteger(page.estimatedMinutes, estimatedMinutes);
  normalized.steps = (page.steps || []).map(normalizeCaseStep);
  normalized.skillIds = uniqueCaseStrings([
    ...(page.skillIds || []),
    ...normalized.steps.flatMap((step) => step.skillIds || []),
  ]);
  return normalized;
}

function normalizeCaseDefinition(rawCase, catalogEntry = {}) {
  if (!rawCase || typeof rawCase !== "object") throw new TypeError("Case definition must be an object");
  const sourceSchemaVersion = positiveCaseInteger(rawCase.schemaVersion, 1);
  const rawMetadata = rawCase.metadata || {};
  const entryMetadata = catalogEntry.metadata || {};
  const difficultyLevel = positiveCaseInteger(
    rawMetadata.difficulty?.level ?? entryMetadata.difficultyLevel ?? rawCase.difficulty,
    1,
  );
  const estimatedMinutes = positiveCaseInteger(
    rawMetadata.estimatedMinutes ?? entryMetadata.estimatedMinutes ?? rawCase.estimatedMinutes,
    15,
  );
  const releaseOrder = positiveCaseInteger(
    rawMetadata.releaseOrder ?? catalogEntry.releaseOrder ?? rawCase.releaseOrder,
    1,
  );
  const metadata = {
    contentVersion: String(rawMetadata.contentVersion || catalogEntry.contentVersion || "1.0.0"),
    status: rawMetadata.status || catalogEntry.status || "draft",
    releaseOrder,
    difficulty: {
      level: difficultyLevel,
      label: rawMetadata.difficulty?.label || getCaseDifficultyLabel(difficultyLevel),
    },
    estimatedMinutes,
    format: rawMetadata.format || entryMetadata.format || "full-case",
    industry: rawMetadata.industry || entryMetadata.industry || "general-business",
    companyStage: rawMetadata.companyStage || entryMetadata.companyStage || "established",
    fictional: rawMetadata.fictional ?? entryMetadata.fictional ?? true,
    locale: rawMetadata.locale || entryMetadata.locale || "ja-JP",
    publishedAt: rawMetadata.publishedAt || null,
    reviewedAt: rawMetadata.reviewedAt || null,
  };
  const rawPedagogy = rawCase.pedagogy || {};
  const pedagogy = {
    learningObjectives: uniqueCaseStrings(rawPedagogy.learningObjectives || rawCase.learningObjectives),
    prerequisiteSkillIds: uniqueCaseStrings([
      ...(catalogEntry.prerequisiteSkillIds || []),
      ...(rawCase.prerequisiteSkillIds || []),
      ...(rawPedagogy.prerequisiteSkillIds || []),
    ]),
    skillIds: uniqueCaseStrings([
      ...(catalogEntry.skillIds || []),
      ...(rawCase.skillIds || []),
      ...(rawPedagogy.skillIds || []),
    ]),
    accountingTopics: uniqueCaseStrings(rawPedagogy.accountingTopics || rawCase.accountingTopics),
    analysisMethods: uniqueCaseStrings(rawPedagogy.analysisMethods || rawCase.analysisMethods),
    recommendedModes: uniqueCaseStrings(rawPedagogy.recommendedModes || ["beginner", "standard", "practical"]),
    reviewStrategy: {
      type: rawPedagogy.reviewStrategy?.type || "spaced-retrieval",
      intervalsDays: Array.isArray(rawPedagogy.reviewStrategy?.intervalsDays)
        ? rawPedagogy.reviewStrategy.intervalsDays.map(Number).filter((value) => Number.isInteger(value) && value > 0)
        : [1, 3, 7],
    },
  };
  const normalized = cloneCaseValue(rawCase);
  const pages = Array.isArray(rawCase.pages) ? rawCase.pages : [];
  const perPageMinutes = Math.max(1, Math.round(estimatedMinutes / Math.max(1, pages.length)));
  normalized.schemaVersion = CASE_SCHEMA_VERSION;
  normalized.source = {
    schemaVersion: sourceSchemaVersion,
    migratedAtRuntime: sourceSchemaVersion < CASE_SCHEMA_VERSION,
  };
  normalized.metadata = metadata;
  normalized.pedagogy = pedagogy;
  normalized.pages = pages.map((page, index) => normalizeCasePage(page, index, pages, perPageMinutes));
  normalized.difficulty = difficultyLevel;
  normalized.estimatedMinutes = estimatedMinutes;
  normalized.releaseOrder = releaseOrder;
  normalized.learningObjectives = pedagogy.learningObjectives;
  normalized.skillIds = uniqueCaseStrings([
    ...pedagogy.skillIds,
    ...normalized.pages.flatMap((page) => page.skillIds || []),
  ]);
  normalized.prerequisiteSkillIds = pedagogy.prerequisiteSkillIds;
  return normalized;
}

function caseSkillIdSet(skillCatalog) {
  if (Array.isArray(skillCatalog)) return new Set(skillCatalog.map((skill) => typeof skill === "string" ? skill : skill.id).filter(Boolean));
  if (Array.isArray(skillCatalog?.skills)) return new Set(skillCatalog.skills.map((skill) => skill.id).filter(Boolean));
  return new Set();
}

function validateSkillCatalog(skillCatalog) {
  const errors = [];
  const warnings = [];
  const skills = Array.isArray(skillCatalog?.skills) ? skillCatalog.skills : [];
  const idPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
  const ids = new Set();
  for (const skill of skills) {
    if (!idPattern.test(skill.id || "")) errors.push(`invalid skill id: ${skill.id}`);
    if (ids.has(skill.id)) errors.push(`duplicate skill id: ${skill.id}`);
    ids.add(skill.id);
    if (!skill.title || !skill.domain || !skill.description) errors.push(`skill ${skill.id || "(unknown)"} is incomplete`);
  }
  for (const skill of skills) {
    for (const prerequisite of skill.prerequisiteSkillIds || []) {
      if (!ids.has(prerequisite)) errors.push(`skill ${skill.id} has unknown prerequisite: ${prerequisite}`);
      if (prerequisite === skill.id) errors.push(`skill ${skill.id} cannot require itself`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const map = new Map(skills.map((skill) => [skill.id, skill]));
  function visit(id, trail = []) {
    if (visiting.has(id)) {
      errors.push(`skill prerequisite cycle: ${[...trail, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id) || !map.has(id)) return;
    visiting.add(id);
    for (const prerequisite of map.get(id).prerequisiteSkillIds || []) visit(prerequisite, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
  if (!skills.length) warnings.push("skill catalog is empty");
  return { valid: errors.length === 0, errors, warnings };
}

function validateCaseDefinition(caseDefinition, skillCatalog = []) {
  const errors = [];
  const warnings = [];
  const data = caseDefinition;
  const skillIds = caseSkillIdSet(skillCatalog);
  const caseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (data.schemaVersion !== CASE_SCHEMA_VERSION) errors.push(`case schemaVersion must be ${CASE_SCHEMA_VERSION}`);
  if (!caseIdPattern.test(data.id || "")) errors.push(`invalid case id: ${data.id}`);
  if (!data.title || !data.subtitle) errors.push("case title and subtitle are required");
  if (!CASE_STATUS_VALUES.has(data.metadata?.status)) errors.push(`invalid case status: ${data.metadata?.status}`);
  if (!/^\d+\.\d+\.\d+$/.test(data.metadata?.contentVersion || "")) errors.push("metadata.contentVersion must use x.y.z format");
  if (!Number.isInteger(data.metadata?.difficulty?.level) || data.metadata.difficulty.level < 1 || data.metadata.difficulty.level > 5) {
    errors.push("metadata.difficulty.level must be an integer from 1 to 5");
  }
  if (!Number.isInteger(data.metadata?.estimatedMinutes) || data.metadata.estimatedMinutes < 1) errors.push("metadata.estimatedMinutes must be positive");
  if (!Array.isArray(data.pedagogy?.learningObjectives) || !data.pedagogy.learningObjectives.length) errors.push("pedagogy.learningObjectives must not be empty");
  if (!Array.isArray(data.pages) || !data.pages.length) errors.push("pages must not be empty");

  const allCaseSkills = uniqueCaseStrings([
    ...(data.pedagogy?.skillIds || []),
    ...(data.pedagogy?.prerequisiteSkillIds || []),
    ...(data.skillIds || []),
  ]);
  if (skillIds.size) {
    for (const skillId of allCaseSkills) if (!skillIds.has(skillId)) errors.push(`unknown case skill id: ${skillId}`);
  }

  const pageIds = new Set((data.pages || []).map((page) => page.id));
  for (const [index, page] of (data.pages || []).entries()) {
    if (!page.unlock || !CASE_UNLOCK_TYPES.has(page.unlock.type)) errors.push(`${page.id}.unlock.type is invalid`);
    if (index === 0 && page.unlock?.type !== "always") errors.push(`${page.id} must always be unlocked`);
    if (page.unlock?.type === "page-complete") {
      if (!pageIds.has(page.unlock.pageId)) errors.push(`${page.id} unlock references unknown page: ${page.unlock.pageId}`);
      const referencedIndex = data.pages.findIndex((candidate) => candidate.id === page.unlock.pageId);
      if (referencedIndex >= index) errors.push(`${page.id} unlock must reference an earlier page`);
    }
    if (page.unlock?.type === "skill-mastered" && !skillIds.has(page.unlock.skillId)) errors.push(`${page.id} unlock references unknown skill: ${page.unlock.skillId}`);
    if (!Number.isInteger(page.estimatedMinutes) || page.estimatedMinutes < 1) errors.push(`${page.id}.estimatedMinutes must be positive`);
    for (const pageSkillId of page.skillIds || []) if (skillIds.size && !skillIds.has(pageSkillId)) errors.push(`${page.id} has unknown skill id: ${pageSkillId}`);

    for (const step of page.steps || []) {
      if (!Array.isArray(step.skillIds) || !step.skillIds.length) warnings.push(`${step.id} has no skillIds`);
      for (const stepSkillId of step.skillIds || []) if (skillIds.size && !skillIds.has(stepSkillId)) errors.push(`${step.id} has unknown skill id: ${stepSkillId}`);
      if (!Array.isArray(step.hints) || !step.hints.length) errors.push(`${step.id} must have at least one hint`);
      const levels = new Set();
      let previousLevel = 0;
      for (const hint of step.hints || []) {
        if (!Number.isInteger(hint.level) || hint.level < 1) errors.push(`${step.id} hint level must be positive`);
        if (levels.has(hint.level)) errors.push(`${step.id} has duplicate hint level ${hint.level}`);
        if (hint.level < previousLevel) errors.push(`${step.id} hints must be ordered by level`);
        if (!hint.text) errors.push(`${step.id} hint text is required`);
        levels.add(hint.level);
        previousLevel = hint.level;
      }
      if (!CASE_ASSESSMENT_MODES.has(step.assessment?.mode)) errors.push(`${step.id} assessment mode is invalid`);
      if (!Number.isFinite(Number(step.assessment?.maxPoints)) || Number(step.assessment.maxPoints) < 0) errors.push(`${step.id} assessment maxPoints is invalid`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

if (typeof globalThis !== "undefined") {
  globalThis.CASE_SCHEMA_VERSION = CASE_SCHEMA_VERSION;
  globalThis.normalizeCaseDefinition = normalizeCaseDefinition;
  globalThis.validateCaseDefinition = validateCaseDefinition;
  globalThis.validateSkillCatalog = validateSkillCatalog;
  globalThis.getCaseDifficultyLabel = getCaseDifficultyLabel;
}
