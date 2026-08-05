function calculatorTokenLabel(token) {
  if (token.type === "operator") return token.value;
  if (token.type === "number") return formatNumber(token.value);
  return "";
}

function normalizeCalculatorTokens(tokens) {
  const normalized = [];
  for (const token of tokens || []) {
    if (token.type === "number") {
      if (normalized.at(-1)?.type === "number") normalized[normalized.length - 1] = token;
      else normalized.push(token);
    } else if (token.type === "operator") {
      if (!normalized.length) continue;
      if (normalized.at(-1)?.type === "operator") normalized[normalized.length - 1] = token;
      else normalized.push(token);
    }
  }
  while (normalized.at(-1)?.type === "operator") normalized.pop();
  return normalized;
}

function evaluateCalculatorTokens(tokens) {
  const normalized = normalizeCalculatorTokens(tokens);
  if (!normalized.length || normalized.at(-1)?.type !== "number") throw new Error("数字と演算子を選んでください。");
  const values = [];
  const operators = [];
  const precedence = { "+": 1, "−": 1, "×": 2, "÷": 2 };
  const apply = () => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("計算式を確認してください。");
    if (operator === "+") values.push(left + right);
    if (operator === "−") values.push(left - right);
    if (operator === "×") values.push(left * right);
    if (operator === "÷") {
      if (right === 0) throw new Error("0では割れません。");
      values.push(left / right);
    }
  };

  normalized.forEach((token) => {
    if (token.type === "number") values.push(Number(token.value));
    else {
      while (operators.length && precedence[operators.at(-1)] >= precedence[token.value]) apply();
      operators.push(token.value);
    }
  });
  while (operators.length) apply();
  const result = values[0];
  if (!Number.isFinite(result)) throw new Error("計算結果を表示できません。");
  return result;
}

function calculatorExpression(tokens = state.calculator.tokens) {
  return tokens.map(calculatorTokenLabel).join(" ");
}

function openCalculatorForStep(stepId = null) {
  state.calculator.isOpen = true;
  state.calculator.targetStepId = stepId;
  state.calculator.error = null;
  state.ui.modal = null;
  saveState();
  render();
}

function addCalculatorNumber(value, label = "資料の数値", unit = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return;
  const tokens = [...(state.calculator.tokens || [])];
  const token = { type: "number", value: number, label, unit };
  if (tokens.at(-1)?.type === "number") tokens[tokens.length - 1] = token;
  else tokens.push(token);
  state.calculator.tokens = tokens;
  state.calculator.result = null;
  state.calculator.error = null;
  state.calculator.isOpen = true;
  saveState();
  render();
}

function addCalculatorOperator(operator) {
  if (!["+", "−", "×", "÷"].includes(operator)) return;
  const tokens = [...(state.calculator.tokens || [])];
  if (!tokens.length) return;
  const token = { type: "operator", value: operator };
  if (tokens.at(-1)?.type === "operator") tokens[tokens.length - 1] = token;
  else tokens.push(token);
  state.calculator.tokens = tokens;
  state.calculator.result = null;
  state.calculator.error = null;
  saveState();
  render();
}

function calculateCurrentExpression() {
  try {
    const result = evaluateCalculatorTokens(state.calculator.tokens || []);
    state.calculator.result = result;
    state.calculator.error = null;
    state.calculationHistory = [
      {
        id: crypto.randomUUID?.() || `${Date.now()}`,
        expression: calculatorExpression(),
        result,
        createdAt: new Date().toISOString(),
      },
      ...(state.calculationHistory || []),
    ].slice(0, 20);
    saveState();
    render();
  } catch (error) {
    state.calculator.error = error.message;
    state.calculator.result = null;
    saveState();
    render();
  }
}

function useCalculatorResult() {
  const result = state.calculator.result;
  if (!Number.isFinite(result)) return;
  const stepId = state.calculator.targetStepId;
  if (stepId) {
    const answer = state.answers[stepId] || {};
    answer.value = Number(result.toFixed(4));
    answer.checked = false;
    state.answers[stepId] = answer;
    state.calculator.isOpen = false;
    state.calculator.targetStepId = null;
    saveState();
    render();
    showToast("計算結果を回答欄へ入力しました");
    return;
  }
  navigator.clipboard?.writeText(String(result)).catch(() => {});
  showToast("計算結果をコピーしました");
}

function renderCalculatorLayer() {
  if (!state.calculator?.isOpen) return "";
  const tokens = state.calculator.tokens || [];
  const selectedNumbers = tokens.filter((token) => token.type === "number");
  return `<div class="deep-backdrop calculator-backdrop" data-action="close-calculator" aria-hidden="true"></div>
    <section class="calculator-sheet" role="dialog" aria-modal="true" aria-labelledby="calculator-title">
      <header class="sheet-header">
        <div><span class="deep-kicker">SMART CALCULATOR</span><h2 id="calculator-title">計算トレイ</h2></div>
        <button class="deep-icon-button" data-action="close-calculator" aria-label="計算トレイを閉じる">${deepIcon("close")}</button>
      </header>
      <div class="calculator-selected" aria-label="選択した数値">
        ${selectedNumbers.length ? selectedNumbers.map((token) => `<span><small>${escapeHtml(token.label || "数値")}</small><strong>${formatNumber(token.value)}</strong><em>${escapeHtml(token.unit || "")}</em></span>`).join("") : `<p>資料の数字をタップするか、計算問題から開いてください。</p>`}
      </div>
      <div class="calculator-display ${state.calculator.error ? "has-error" : ""}">
        <small>計算式</small>
        <strong>${escapeHtml(calculatorExpression() || "—")}</strong>
        ${state.calculator.error ? `<p>${escapeHtml(state.calculator.error)}</p>` : state.calculator.result !== null ? `<output>= ${formatNumber(state.calculator.result)}</output>` : ""}
      </div>
      <div class="calculator-operators" aria-label="演算子">
        ${["+", "−", "×", "÷"].map((operator) => `<button data-action="calc-operator" data-operator="${operator}">${operator}</button>`).join("")}
      </div>
      <div class="calculator-actions">
        <button class="deep-button secondary" data-action="calc-backspace">1つ戻す</button>
        <button class="deep-button secondary" data-action="calc-clear">クリア</button>
        <button class="deep-button primary" data-action="calc-equals">計算する</button>
      </div>
      ${state.calculator.result !== null ? `<button class="deep-button accent full" data-action="calc-use-result">${state.calculator.targetStepId ? "回答欄に使う" : "結果をコピー"}</button>` : ""}
      ${(state.calculationHistory || []).length ? `<details class="calculator-history"><summary>最近の計算</summary>${state.calculationHistory.slice(0, 5).map((item) => `<button data-action="calc-use-history" data-result="${item.result}"><span>${escapeHtml(item.expression)}</span><strong>${formatNumber(item.result)}</strong></button>`).join("")}</details>` : ""}
    </section>`;
}
