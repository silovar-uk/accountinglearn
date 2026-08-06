function renderCases() {
  return `<div class="page-heading"><span class="page-heading-icon">${navIcon("cases", 25)}</span><div><p class="eyebrow">CASE LIBRARY</p><h1 class="page-title">経営ケース</h1><p class="page-lead">一つの会社、一つの問い。各ケースは独立して最後まで完結します。</p></div></div>
    <div class="case-list">${catalog.map((item, index) => renderCaseCard(item.data, index)).join("")}${renderPlannedCases()}</div>`;
}

function caseMetadataLabel(data) {
  const formatLabels = {
    "micro-case": "ミニ",
    "short-case": "短編",
    "full-case": "本編",
    "public-company-case": "公開企業",
  };
  const metadata = data.metadata || {};
  const difficulty = metadata.difficulty?.label || getCaseDifficultyLabel(data.difficulty || 1);
  const format = formatLabels[metadata.format] || "ケース";
  const minutes = metadata.estimatedMinutes || data.estimatedMinutes;
  return `${difficulty}・${format}・${minutes}分`;
}

function getCaseDisplayNumber(data, fallbackIndex = 0) {
  return String(Number(data.releaseOrder || data.metadata?.releaseOrder || fallbackIndex + 1)).padStart(2, "0");
}

function renderCaseCard(data, index) {
  const pageIndex = state.caseProgress[data.id] || 0;
  const complete = Boolean(state.completedCases[data.id]);
  const started = Boolean(state.visitedPages[data.id]);
  const progress = complete ? 100 : started ? Math.round(((pageIndex + 1) / data.pages.length) * 100) : 0;
  return `<article class="card case-card ${complete ? "complete" : started ? "in-progress" : ""}">
    <div class="case-number">${getCaseDisplayNumber(data, index)}</div>
    <div class="case-card-body"><div class="case-card-status"><span>${complete ? "COMPLETED" : started ? "IN PROGRESS" : "AVAILABLE"}</span><small>${escapeHtml(caseMetadataLabel(data))}</small></div><h3>${escapeHtml(data.title)}</h3><p>${escapeHtml(data.subtitle)}</p>${started ? `<div class="mini-progress"><i style="width:${progress}%"></i></div>` : ""}</div>
    <button class="case-open-button" data-action="open-case" data-case-id="${data.id}" data-page="${pageIndex}" aria-label="${escapeHtml(data.title)}を開く">${complete ? navIcon("check", 21) : navIcon("arrowRight", 21)}</button>
  </article>`;
}

function renderPlannedCases() {
  const planned = [
    ["02", "倉庫に眠るヒット商品", "在庫と粗利益"],
    ["03", "売上が伸びるほど苦しくなる会社", "顧客単位の採算"],
    ["04", "工場は忙しいのに、利益が消えた", "製品別原価"],
    ["05", "満席の店から撤退すべきか", "撤退判断"],
    ["06", "観客は増えた。それでも資金が足りない", "スポーツクラブの資金繰り"],
    ["07", "伸ばす事業と、やめる事業", "事業ポートフォリオ"],
    ["08", "この会社を買うべきか", "M&A・事業再生"],
  ];
  const publishedOrders = new Set(catalog.map(({ data }) => getCaseDisplayNumber(data)));
  return planned
    .filter(([number]) => !publishedOrders.has(number))
    .map(([number, title, subtitle]) => `<article class="card case-card planned"><div class="case-number">${number}</div><div class="case-card-body"><div class="case-card-status"><span>PLANNED</span><small>準備中</small></div><h3>${title}</h3><p>${subtitle}</p></div><span class="case-lock">${navIcon("lock", 19)}</span></article>`)
    .join("");
}
