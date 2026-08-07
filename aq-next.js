const aqLegacyRender = render;
const aqLegacyRenderDocuments = renderDocuments;
const aqLegacyRenderResult = renderResult;
const aqLegacyRenderRecords = renderRecords;
const aqLegacyRenderCaseCard = renderCaseCard;

function aqDocumentTypeLabel(doc) {
  if (doc.type === "financial-statement") return "財務資料";
  if (doc.type === "decision-bridge") return "判断ブリッジ";
  if (doc.type === "scenario-comparison") return "シナリオ比較";
  if (doc.type === "interview") return "ヒアリング";
  return "分析資料";
}

function aqValueFromRow(data, valueId) {
  const row = findFinancialRow(data, valueId);
  if (!row) return null;
  const raw = Array.isArray(row.values) ? row.values.at(-1) : row.value;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function renderAQDecisionBridge(data, doc) {
  const items = (doc.items || []).map((item) => {
    const source = aqValueFromRow(data, item.sourceValueId);
    const value = Number(source) * Number(item.multiplier || 1);
    return { ...item, value };
  });
  const reveal = !doc.revealAfterStepId || Boolean(state.answers[doc.revealAfterStepId]?.checked);
  return `<section class="aq-visual aq-decision-bridge" aria-labelledby="${doc.id}-title">
    <header><span class="deep-kicker">DECISION BRIDGE</span><h3 id="${doc.id}-title">${escapeHtml(doc.title)}</h3><small>単位：${escapeHtml(doc.unit || "")}</small></header>
    <div class="aq-bridge-flow">${items.map((item) => `<div class="aq-bridge-item ${item.value < 0 ? "negative" : "positive"}"><span>${escapeHtml(item.label)}</span><strong>${item.value > 0 ? "+" : ""}${formatNumber(item.value)}</strong></div>`).join("")}<div class="aq-bridge-equals" aria-hidden="true">=</div><div class="aq-bridge-result ${reveal ? (Number(doc.result) < 0 ? "negative" : "positive") : "locked"}"><span>${escapeHtml(doc.resultLabel || "差額")}</span><strong>${reveal ? `${Number(doc.result) > 0 ? "+" : ""}${formatNumber(doc.result)}` : "計算後に表示"}</strong></div></div>
    <p>${escapeHtml(reveal ? doc.note || "" : "先に自分で差額を計算してください。答えを確認すると結果が開きます。")}</p>
  </section>`;
}

function renderAQScenarioComparison(doc) {
  return `<section class="aq-visual aq-scenarios" aria-labelledby="${doc.id}-title">
    <header><span class="deep-kicker">SCENARIO ROOM</span><h3 id="${doc.id}-title">${escapeHtml(doc.title)}</h3><small>単位：${escapeHtml(doc.unit || "")}</small></header>
    <div class="aq-scenario-grid">${(doc.rows || []).map((row, index) => `<article class="${index === 1 ? "recommended" : ""}"><div><span>${String(index + 1).padStart(2, "0")}</span><h4>${escapeHtml(row.scenario)}</h4></div><dl><div><dt>年間増分</dt><dd class="${Number(row.annualImpact) < 0 ? "negative" : Number(row.annualImpact) > 0 ? "positive" : ""}">${Number(row.annualImpact) > 0 ? "+" : ""}${formatNumber(row.annualImpact)}</dd></div><div><dt>初期キャッシュ</dt><dd class="${Number(row.initialCash) < 0 ? "negative" : ""}">${Number(row.initialCash) > 0 ? "+" : ""}${formatNumber(row.initialCash)}</dd></div><div><dt>初年度差額</dt><dd class="${Number(row.yearOneImpact) < 0 ? "negative" : Number(row.yearOneImpact) > 0 ? "positive" : ""}">${Number(row.yearOneImpact) > 0 ? "+" : ""}${formatNumber(row.yearOneImpact)}</dd></div></dl><p>${escapeHtml(row.condition)}</p></article>`).join("")}</div>
  </section>`;
}

function renderAQDocument(data, doc) {
  if (doc.type === "decision-bridge") return renderAQDecisionBridge(data, doc);
  if (doc.type === "scenario-comparison") return renderAQScenarioComparison(doc);
  return renderDocument(doc);
}

renderDocuments = function renderAQDocuments(data, documentIds) {
  const docs = documentIds.map((id) => data.documents.find((doc) => doc.id === id)).filter(Boolean);
  if (!docs.length) return "";
  const desktop = window.innerWidth >= 700;
  return `<section class="aq-analysis-workspace">
    <div class="aq-analysis-brief"><span>${deepIcon("document", 20)}</span><div><strong>資料を比べ、根拠を集める</strong><p>必要な資料だけを開けます。数字を選ぶと計算トレイへ送れます。</p></div></div>
    <div class="aq-document-stack">${docs.map((doc, index) => `<details class="aq-document-disclosure" ${desktop || index === 0 ? "open" : ""}><summary><span>${aqDocumentTypeLabel(doc)}</span><strong>${escapeHtml(doc.title)}</strong><em>開閉</em></summary>${renderAQDocument(data, doc)}</details>`).join("")}</div>
  </section>`;
};

function aqStepOptionLabel(data, stepId) {
  const step = data.pages.flatMap((page) => page.steps || []).find((item) => item.id === stepId);
  const value = state.answers[stepId]?.value;
  return step?.options?.find((option) => option.id === value)?.label || "未回答";
}

function renderAQDecisionJourney(data) {
  const journey = data.decisionJourney;
  if (!journey) return "";
  const initial = aqStepOptionLabel(data, journey.initialStepId);
  const final = aqStepOptionLabel(data, journey.finalStepId);
  const changed = state.answers[journey.initialStepId]?.value !== state.answers[journey.finalStepId]?.value;
  return `<section class="aq-decision-journey"><div><span class="deep-kicker">DECISION JOURNEY</span><h2>${escapeHtml(journey.title || "判断の変化")}</h2><p>最初の仮説と、数字を確認した後の結論を並べます。</p></div><div class="aq-journey-flow"><article><small>最初の判断</small><strong>${escapeHtml(initial)}</strong></article><span aria-hidden="true">→</span><article><small>最終判断</small><strong>${escapeHtml(final)}</strong></article></div><p class="aq-journey-note">${changed ? "判断が変わりました。変化を生んだ数字と条件が、今回の学びです。" : "判断は同じでも、根拠と実行条件が具体化されました。"}</p></section>`;
}

renderResult = function renderAQResult(data, page) {
  return `${aqLegacyRenderResult(data, page)}${renderAQDecisionJourney(data)}`;
};

function renderAQRecordJourneys() {
  const cases = catalog.map(({ data }) => data).filter((data) => data.decisionJourney && state.answers[data.decisionJourney.initialStepId]);
  if (!cases.length) return "";
  return `<section class="card aq-record-judgments"><div class="section-head"><h2>判断の変化</h2><small>${cases.length}ケース</small></div>${cases.map((data) => `<article><div><span>CASE ${String(data.releaseOrder).padStart(2, "0")}</span><strong>${escapeHtml(data.title)}</strong></div><p>${escapeHtml(aqStepOptionLabel(data, data.decisionJourney.initialStepId))}<span aria-hidden="true">→</span>${escapeHtml(aqStepOptionLabel(data, data.decisionJourney.finalStepId))}</p></article>`).join("")}</section>`;
}

renderRecords = function renderAQRecords() {
  return `${aqLegacyRenderRecords()}${renderAQRecordJourneys()}`;
};

renderCaseCard = function renderAQCaseCard(data, index) {
  const html = aqLegacyRenderCaseCard(data, index);
  const theme = data.metadata?.caseTheme;
  return theme ? html.replace("<article ", `<article data-case-theme="${escapeHtml(theme)}" `) : html;
};

render = function renderAQApp() {
  aqLegacyRender();
  const data = currentView.name === "case" ? getCase(currentView.caseId) : null;
  const theme = data?.metadata?.caseTheme || "default";
  document.body.dataset.caseTheme = theme;
};
