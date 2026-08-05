function renderCaseFooter(data,pageIndex) {
  const page=data.pages[pageIndex]; const completion=getPageCompletion(data,page); const last=pageIndex===data.pages.length-1; const caseCompletion=getCaseCompletion(data); const nextDisabled=!completion.isComplete;
  return `<nav class="case-footer" aria-label="ケースページ移動"><button class="footer-nav-button secondary" data-action="change-page" data-case-id="${data.id}" data-page="${pageIndex-1}" ${pageIndex===0?"disabled":""}>${navIcon("arrowLeft",20)}<span>前へ</span></button><div class="footer-page-status"><strong>${pageIndex+1}<small> / ${data.pages.length}</small></strong><span>${completion.isComplete?"ページ完了":completion.required?`あと${completion.required-completion.completed}項目`:"読むページ"}</span></div><button class="footer-nav-button primary" data-action="${last?"finish-case":"change-page"}" data-case-id="${data.id}" data-page="${pageIndex+1}" ${last?!caseCompletion.isComplete:nextDisabled?"disabled":""}><span>${last?"記録を見る":"次へ"}</span>${navIcon("arrowRight",20)}</button></nav>`;
}

function renderBottomNav(active) {
  const items=[["home","home","ホーム"],["cases","cases","ケース"],["basics","basics","基礎"],["review","review","復習"],["records","records","記録"]];
  return `<nav class="bottom-nav" aria-label="メインメニュー"><div class="bottom-nav-inner">${items.map(([id,icon,label])=>`<button class="nav-item ${active===id?"active":""}" data-action="navigate" data-target="${id}" aria-current="${active===id?"page":"false"}"><span class="nav-icon">${navIcon(icon,22)}</span><span>${label}</span>${id==="review"&&state.mistakes.length?`<b>${state.mistakes.length}</b>`:""}</button>`).join("")}</div></nav>`;
}
