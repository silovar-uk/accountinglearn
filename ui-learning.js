function renderBasics() {
  const data = catalog[0].data;
  const topics = [
    ["利益と現金","売上・費用の計上と入出金の時間差を分ける","trend"],
    ["売掛金","売上になったが、まだ入金されていない金額","clock"],
    ["貸借対照表","会社が持つ資産と、返す義務のある負債を読む","document"],
    ["キャッシュフロー","利益から現金の増減へ橋を架ける","calculator"],
    ["資金繰り表","将来の入金と支払いを時系列で確認する","cases"],
  ];
  return `<div class="page-heading"><span class="page-heading-icon">${navIcon("basics",25)}</span><div><p class="eyebrow">FOUNDATIONS</p><h1 class="page-title">基礎を確認</h1><p class="page-lead">教科書順ではなく、ケースで必要になった知識から戻れます。</p></div></div>
    <div class="foundation-list">${topics.map(([title,body,icon],i) => `<article class="card foundation-card"><span class="foundation-icon">${navIcon(icon,23)}</span><div><small>LESSON ${String(i+1).padStart(2,"0")}</small><h2>${title}</h2><p>${body}</p></div><span class="foundation-arrow">${navIcon("arrowRight",20)}</span></article>`).join("")}</div>
    <section class="card objective-card"><p class="eyebrow">CASE 01 OBJECTIVES</p><h2>このケースの到達目標</h2><ul class="mission-list">${data.learningObjectives.map((item) => `<li><span>${navIcon("check",16)}</span>${escapeHtml(item)}</li>`).join("")}</ul></section>`;
}

function renderReview() {
  if (!state.mistakes.length) return `<div class="page-heading"><span class="page-heading-icon">${navIcon("review",25)}</span><div><p class="eyebrow">REVIEW</p><h1 class="page-title">復習</h1><p class="page-lead">間違えた論点を、必要なときにもう一度。</p></div></div><div class="card empty-state polished-empty"><span>${navIcon("check",34)}</span><strong>復習候補はありません</strong><p>ケースで間違えた設問が、ここへ自動で追加されます。</p><button class="btn btn-primary" data-action="navigate" data-target="cases">ケースへ進む</button></div>`;
  const items = [...state.mistakes].reverse();
  return `<div class="page-heading"><span class="page-heading-icon">${navIcon("review",25)}</span><div><p class="eyebrow">REVIEW</p><h1 class="page-title">復習</h1><p class="page-lead">答えではなく、考え方をもう一度確認します。</p></div></div><div class="review-list">${items.map((item,index) => { const data=getCase(item.caseId); const page=data.pages.find((entry)=>entry.id===item.pageId); const pageIndex=data.pages.findIndex((entry)=>entry.id===item.pageId); return `<article class="card review-card"><span class="review-index">${String(index+1).padStart(2,"0")}</span><div><small>${escapeHtml(page?.title||"設問")}</small><h2>${escapeHtml(item.instruction)}</h2><p>${escapeHtml(item.feedback||"もう一度確認しましょう。")}</p><button class="text-action" data-action="open-case" data-case-id="${item.caseId}" data-page="${pageIndex}">このページを復習 ${navIcon("arrowRight",17)}</button></div></article>`; }).join("")}</div>`;
}

