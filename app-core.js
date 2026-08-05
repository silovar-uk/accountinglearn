const STORAGE_KEY = "accounting-quest:v1";

const defaultState = {
  answers: {},
  caseProgress: {},
  visitedPages: {},
  completedCases: {},
  lastCaseId: null,
  lastPageIndex: 0,
  mistakes: [],
  proposalReview: {},
  startedAt: new Date().toISOString(),
};

let state = loadState();
let catalog = [];
let currentView = parseHash();
let toastTimer;

const app = document.querySelector("#app");


async function boot() {
  const manifest = await fetchJson("./data/cases/index.json");
  catalog = await Promise.all(
    manifest.cases
      .filter((item) => item.status === "published")
      .map(async (item) => ({ ...item, data: await fetchJson(item.path) })),
  );

  window.addEventListener("hashchange", () => {
    currentView = parseHash();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  });

  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleInput);

  if (!location.hash) location.hash = "#home";
  render();
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...structuredClone(defaultState), ...saved } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "home";
  const [view, caseId, pageIndex] = raw.split("/");
  if (view === "case") {
    return { name: "case", caseId, pageIndex: Number(pageIndex || 0) };
  }
  return { name: ["home", "cases", "basics", "review", "records"].includes(view) ? view : "home" };
}

function render() {
  if (!catalog.length) return;
  const isCase = currentView.name === "case";
  app.innerHTML = `
    ${renderTopbar()}
    ${isCase ? renderCaseView(currentView.caseId, currentView.pageIndex) : renderMainView(currentView.name)}
    ${renderBottomNav(isCase ? "cases" : currentView.name)}
  `;
}

function renderTopbar() {
  if (currentView.name === "case") {
    const item = catalog.find((entry) => entry.data.id === currentView.caseId) || catalog[0];
    const data = item.data;
    const pageCount = data.pages.length;
    const page = clamp(currentView.pageIndex, 0, pageCount - 1);
    const progress = Math.round(((page + 1) / pageCount) * 100);
    return `
      <header class="topbar">
        <div class="topbar-inner">
          <button class="icon-button" data-action="close-case" aria-label="ケース一覧へ戻る">×</button>
          <div class="progress-wrap">
            <div class="progress-label"><span>${escapeHtml(data.title)}</span><span>${page + 1}/${pageCount}</span></div>
            <div class="progress-track" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar" style="width:${progress}%"></div>
            </div>
          </div>
          <span class="pill">${getCaseScore(data)}%</span>
        </div>
      </header>`;
  }

  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div></div>
        <div class="brand">Accounting Quest<span class="brand-sub">数字で経営を考える</span></div>
        <span class="pill">${getCompletedCount()} / ${catalog.length}</span>
      </div>
    </header>`;
}

function renderMainView(view) {
  const content = {
    home: renderHome,
    cases: renderCases,
    basics: renderBasics,
    review: renderReview,
    records: renderRecords,
  }[view]?.() || renderHome();
  return `<main class="main">${content}</main>`;
}

function renderHome() {
  const featured = catalog[0].data;
  const progress = state.caseProgress[featured.id] || 0;
  const started = Boolean(state.visitedPages[featured.id]);
  const buttonLabel = started ? "続きから再開" : "ケースを始める";
  return `
    <section class="hero-card">
      <span class="pill">CASE ${String(featured.releaseOrder || 1).padStart(2, "0")}</span>
      <h1 class="hero-title">${escapeHtml(featured.title)}</h1>
      <p class="muted">${escapeHtml(featured.subtitle)}</p>
      <div class="case-meta">
        <span>約${featured.estimatedMinutes}分</span>
        <span>難易度 ${"●".repeat(featured.difficulty)}${"○".repeat(Math.max(0, 5 - featured.difficulty))}</span>
        <span>${featured.pages.length}ページ</span>
      </div>
      <div class="hero-actions">
        <button class="btn btn-accent" data-action="open-case" data-case-id="${featured.id}" data-page="${progress}">${buttonLabel}</button>
        <button class="btn btn-light" data-action="navigate" data-target="cases">ケース一覧</button>
      </div>
    </section>

    <div class="section-head"><h2>今日の一歩</h2><small>迷わず1つだけ</small></div>
    <section class="card">
      <p class="eyebrow">TODAY</p>
      <h2 style="margin:5px 0 8px">利益と現金の違いを説明する</h2>
      <p class="page-lead" style="margin-bottom:14px">黒字でも資金不足になる理由を、売掛金・設備投資・翌月の入出金から追います。</p>
      <button class="btn btn-primary btn-block" data-action="open-case" data-case-id="${featured.id}" data-page="${progress}">${buttonLabel}</button>
    </section>

    <div class="section-head"><h2>学習状況</h2></div>
    <div class="stat-grid">
      <div class="stat-card"><span class="eyebrow">CASE</span><strong>${getCompletedCount()}</strong><span class="muted">完了</span></div>
      <div class="stat-card"><span class="eyebrow">SCORE</span><strong>${getAverageScore()}%</strong><span class="muted">平均</span></div>
      <div class="stat-card"><span class="eyebrow">REVIEW</span><strong>${state.mistakes.length}</strong><span class="muted">復習候補</span></div>
      <div class="stat-card"><span class="eyebrow">PAGES</span><strong>${getVisitedPageCount()}</strong><span class="muted">読了</span></div>
    </div>`;
}

function renderCases() {
  return `
    <p class="eyebrow">CASE LIBRARY</p>
    <h1 class="page-title">経営ケース</h1>
    <p class="page-lead">各ケースは独立して完結します。気になる課題から始められます。</p>
    <div class="case-list">
      ${catalog.map((item, index) => renderCaseCard(item.data, index)).join("")}
      ${renderPlannedCases()}
    </div>`;
}

function renderCaseCard(data, index) {
  const progress = state.caseProgress[data.id] || 0;
  const complete = state.completedCases[data.id];
  return `
    <article class="card case-card">
      <div class="case-number">${String(index + 1).padStart(2, "0")}</div>
      <div>
        <h3>${escapeHtml(data.title)}</h3>
        <p>${escapeHtml(data.subtitle)} ・ ${data.estimatedMinutes}分</p>
      </div>
      <button data-action="open-case" data-case-id="${data.id}" data-page="${progress}" aria-label="${escapeHtml(data.title)}を開く">${complete ? "✓" : "→"}</button>
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
  return planned.map(([no, title, subtitle]) => `
    <article class="card case-card" style="opacity:.62">
      <div class="case-number">${no}</div>
      <div><h3>${title}</h3><p>${subtitle} ・ 準備中</p></div>
      <button disabled aria-label="準備中">🔒</button>
    </article>`).join("");
}

function renderBasics() {
  const data = catalog[0].data;
  const topics = [
    ["利益と現金", "売上・費用の計上と入出金のタイミングを分けて考える"],
    ["売掛金", "売上になったが、まだ入金されていない金額"],
    ["貸借対照表", "会社が持つ資産と、返す義務のある負債を読む"],
    ["キャッシュフロー", "利益から現金の増減へ橋を架ける"],
    ["資金繰り表", "将来の入金と支払いを時系列で確認する"],
  ];
  return `
    <p class="eyebrow">FOUNDATIONS</p>
    <h1 class="page-title">基礎を確認</h1>
    <p class="page-lead">ケースで必要になった知識へ、ここから戻れます。資格順ではなく、経営判断で使う順です。</p>
    ${topics.map(([title, body], i) => `
      <section class="card">
        <span class="pill">LESSON ${i + 1}</span>
        <h2>${title}</h2>
        <p class="page-lead" style="margin-bottom:0">${body}</p>
      </section>`).join("")}
    <section class="card">
      <h2>CASE 1の到達目標</h2>
      <ul class="mission-list">${data.learningObjectives.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>`;
}

function renderReview() {
  if (!state.mistakes.length) {
    return `
      <p class="eyebrow">REVIEW</p><h1 class="page-title">復習</h1>
      <div class="card empty-state"><strong>復習候補はまだありません</strong>間違えた設問が、ここへ自動で追加されます。</div>`;
  }

  const items = [...state.mistakes].reverse();
  return `
    <p class="eyebrow">REVIEW</p><h1 class="page-title">復習</h1>
    <p class="page-lead">誤答した地点へ戻り、考え方を確認します。</p>
    ${items.map((item) => {
      const data = getCase(item.caseId);
      const page = data.pages.find((entry) => entry.id === item.pageId);
      const index = data.pages.findIndex((entry) => entry.id === item.pageId);
      return `<section class="card">
        <span class="pill">${escapeHtml(page?.title || "設問")}</span>
        <h2 style="font-size:18px">${escapeHtml(item.instruction)}</h2>
        <p class="page-lead">${escapeHtml(item.feedback || "もう一度確認しましょう。")}</p>
        <button class="btn btn-primary" data-action="open-case" data-case-id="${item.caseId}" data-page="${index}">このページを復習</button>
      </section>`;
    }).join("")}`;
}

function renderRecords() {
  return `
    <p class="eyebrow">RECORDS</p>
    <h1 class="page-title">学習記録</h1>
    <p class="page-lead">回答・進捗はこのブラウザに保存されます。</p>
    <div class="stat-grid">
      <div class="stat-card"><span class="eyebrow">CASE</span><strong>${getCompletedCount()}</strong><span class="muted">完了</span></div>
      <div class="stat-card"><span class="eyebrow">SCORE</span><strong>${getAverageScore()}%</strong><span class="muted">平均</span></div>
      <div class="stat-card"><span class="eyebrow">REVIEW</span><strong>${state.mistakes.length}</strong><span class="muted">候補</span></div>
      <div class="stat-card"><span class="eyebrow">PAGES</span><strong>${getVisitedPageCount()}</strong><span class="muted">読了</span></div>
    </div>
    ${catalog.map(({ data }) => renderRecordCard(data)).join("")}
    <section class="card">
      <h2>データ管理</h2>
      <p class="page-lead">学習データをJSONで保存できます。端末を変える場合のバックアップにも使えます。</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-action="export-state">JSONを書き出す</button>
        <button class="btn btn-ghost" data-action="reset-state">学習記録を削除</button>
      </div>
    </section>`;
}

function renderRecordCard(data) {
  const score = getCaseScore(data);
  const complete = Boolean(state.completedCases[data.id]);
  return `<section class="card">
    <span class="pill">${complete ? "完了" : "進行中"}</span>
    <h2>${escapeHtml(data.title)}</h2>
    <div class="progress-label"><span>自動採点</span><span>${score}%</span></div>
    <div class="progress-track"><div class="progress-bar" style="width:${score}%"></div></div>
    <div class="hero-actions"><button class="btn btn-primary" data-action="open-case" data-case-id="${data.id}" data-page="${state.caseProgress[data.id] || 0}">${complete ? "振り返る" : "続きから"}</button></div>
  </section>`;
}

function renderCaseView(caseId, rawPageIndex) {
  const data = getCase(caseId);
  const pageIndex = clamp(rawPageIndex, 0, data.pages.length - 1);
  const page = data.pages[pageIndex];
  state.lastCaseId = data.id;
  state.lastPageIndex = pageIndex;
  state.caseProgress[data.id] = Math.max(state.caseProgress[data.id] || 0, pageIndex);
  state.visitedPages[data.id] = [...new Set([...(state.visitedPages[data.id] || []), page.id])];
  saveState();

  return `<main class="main">
    <p class="eyebrow">PAGE ${String(pageIndex + 1).padStart(2, "0")}</p>
    <h1 class="page-title">${escapeHtml(page.title)}</h1>
    ${page.intro ? `<p class="page-lead">${escapeHtml(page.intro)}</p>` : ""}
    ${renderPageBody(data, page)}
    ${renderCaseFooter(data, pageIndex)}
  </main>`;
}

function renderPageBody(data, page) {
  const parts = [];
  if (page.story) parts.push(renderStory(page.story));
  if (page.mission) parts.push(renderMission(page.mission));
  if (page.guideMessage) parts.push(renderGuide(page.guideMessage));
  if (page.documentIds?.length) parts.push(renderDocuments(data, page.documentIds));
  if (page.steps?.length) parts.push(page.steps.map((step, index) => renderStep(data, page, step, index)).join(""));
  if (page.modelAnalysis) parts.push(renderModelAnalysis(page.modelAnalysis));
  if (page.review) parts.push(renderSelfReview(data, page));
  if (page.resultTiers) parts.unshift(renderResult(data, page));
  return parts.join("");
}

function renderStory(story) {
  return `<section class="card story">${story.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`;
}

function renderMission(mission) {
  return `<section class="card">
    <p class="eyebrow">MISSION</p>
    <h2>${escapeHtml(mission.primary)}</h2>
    <ul class="mission-list">${mission.deliverables.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  </section>`;
}

function renderGuide(message) {
  return `<aside class="guide-message"><div class="guide-avatar">Q</div><p>${escapeHtml(message.text)}</p></aside>`;
}

function renderDocuments(data, documentIds) {
  const docs = documentIds.map((id) => data.documents.find((doc) => doc.id === id)).filter(Boolean);
  if (!docs.length) return "";
  return `<section>
    <div class="section-head"><h2>資料</h2><small>数字をタップでコピー</small></div>
    ${docs.map((doc) => renderDocument(doc)).join("")}
  </section>`;
}

function renderDocument(doc) {
  if (doc.type === "financial-statement") return renderFinancialStatement(doc);
  if (doc.type === "table") return renderGenericTable(doc);
  if (doc.type === "cash-forecast") return renderCashForecast(doc);
  if (doc.type === "cash-flow-bridge") return renderCashBridge(doc);
  if (doc.type === "interview") return renderInterview(doc);
  return `<section class="card"><h3>${escapeHtml(doc.title)}</h3></section>`;
}

function renderFinancialStatement(doc) {
  const rows = doc.rows || doc.sections?.flatMap((section) => [
    { sectionLabel: section.label },
    ...section.rows,
  ]) || [];
  return `<section class="card document-card">
    <header><h3>${escapeHtml(doc.title)}</h3><small>単位：${escapeHtml(doc.unit)}</small></header>
    <div class="table-scroll"><table>
      <thead><tr><th>科目</th>${doc.periods.map((period) => `<th>${escapeHtml(period)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => {
        if (row.sectionLabel) return `<tr class="section-row"><td colspan="${doc.periods.length + 1}">${escapeHtml(row.sectionLabel)}</td></tr>`;
        return `<tr><td>${escapeHtml(row.label)}</td>${row.values.map((value, index) => `<td><button class="value-button" data-action="copy-number" data-value="${value}" aria-label="${escapeHtml(row.label)} ${doc.periods[index]} ${value}${doc.unit}">${formatNumber(value)}</button></td>`).join("")}</tr>`;
      }).join("")}</tbody>
    </table></div>
  </section>`;
}

function renderGenericTable(doc) {
  return `<section class="card document-card">
    <header><h3>${escapeHtml(doc.title)}</h3><small>単位：${escapeHtml(doc.unit || "-")}</small></header>
    <div class="table-scroll"><table>
      <thead><tr>${doc.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
      <tbody>${doc.rows.map((row) => `<tr>${doc.columns.map((column) => `<td>${typeof row[column.id] === "number" ? `<button class="value-button" data-action="copy-number" data-value="${row[column.id]}">${formatNumber(row[column.id])}</button>` : escapeHtml(String(row[column.id] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>
  </section>`;
}

function renderCashForecast(doc) {
  const inflow = sum(doc.cashInflows.map((item) => item.value));
  const outflow = sum(doc.cashOutflows.map((item) => item.value));
  return `<section class="card document-card">
    <header><h3>${escapeHtml(doc.title)}</h3><small>単位：${escapeHtml(doc.unit)}</small></header>
    <ul class="cash-list">
      <li><span>期首現金</span><strong>${formatNumber(doc.openingCash)}</strong></li>
      ${doc.cashInflows.map((item) => `<li><span>＋ ${escapeHtml(item.label)}</span><strong class="positive">${formatNumber(item.value)}</strong></li>`).join("")}
      ${doc.cashOutflows.map((item) => `<li><span>－ ${escapeHtml(item.label)}</span><strong class="negative">${formatNumber(item.value)}</strong></li>`).join("")}
      <li><span>入金合計 / 支払合計</span><strong>${formatNumber(inflow)} / ${formatNumber(outflow)}</strong></li>
      <li><span>翌月末見込み</span><strong class="${doc.expectedClosingCash < 0 ? "negative" : "positive"}">${formatNumber(doc.expectedClosingCash)}</strong></li>
    </ul>
  </section>`;
}

function renderCashBridge(doc) {
  return `<section class="card document-card">
    <header><h3>${escapeHtml(doc.title)}</h3><small>単位：${escapeHtml(doc.unit)}</small></header>
    <ul class="cash-list">
      <li><span>期首現預金</span><strong>${formatNumber(doc.openingCash)}</strong></li>
      ${doc.items.map((item) => `<li><span>${escapeHtml(item.label)}</span><strong class="${item.value < 0 ? "negative" : "positive"}">${item.value > 0 ? "+" : ""}${formatNumber(item.value)}</strong></li>`).join("")}
      <li><span>期末現預金</span><strong>${formatNumber(doc.closingCash)}</strong></li>
    </ul>
  </section>`;
}

function renderInterview(doc) {
  return `<section class="card document-card">
    <header><h3>${escapeHtml(doc.title)}</h3><small>${escapeHtml(doc.speaker)}</small></header>
    <dl>${doc.entries.map((entry) => `<div class="interview-entry"><dt>Q. ${escapeHtml(entry.question)}</dt><dd>${escapeHtml(entry.answer)}</dd></div>`).join("")}</dl>
  </section>`;
}
