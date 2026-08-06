const FORMULA_OPERATOR_MAP = {
  "+": "+",
  "＋": "+",
  "-": "−",
  "−": "−",
  "*": "×",
  "×": "×",
  "/": "÷",
  "÷": "÷",
};

function findCaseForStep(stepId) {
  for (const item of catalog || []) {
    for (const page of item.data?.pages || []) {
      if ((page.steps || []).some((step) => step.id === stepId)) return item.data;
    }
  }
  return null;
}

function resolveFormulaSource(data, node) {
  if (Number.isFinite(node?.constant)) {
    return { value: Number(node.constant), label: node.label || String(node.constant) };
  }

  if (Array.isArray(node?.acceptedValueIds) && node.acceptedValueIds.length) {
    for (const valueId of node.acceptedValueIds) {
      const row = findFinancialRow(data, valueId);
      if (!row) continue;
      const rawValue = Array.isArray(row.values) ? row.values.at(-1) : row.value;
      const value = Number(rawValue);
      if (Number.isFinite(value)) return { value, label: row.label || node.label || valueId };
    }
  }

  if (node?.documentId && node?.sourceField) {
    const document = (data.documents || []).find((item) => item.id === node.documentId);
    if (!document) return null;
    const source = document[node.sourceField];
    if (node.aggregate === "sum" && Array.isArray(source)) {
      const value = source.reduce((total, item) => total + Number(item?.value || 0), 0);
      return { value, label: node.label || node.sourceField };
    }
    const value = Number(source);
    if (Number.isFinite(value)) return { value, label: node.label || node.sourceField };
  }

  return null;
}

function extractFormulaOperators(template = "") {
  return [...template.matchAll(/[＋+\-−×*÷/]/g)].map((match) => FORMULA_OPERATOR_MAP[match[0]]);
}

function evaluateFormulaParts(values, operators) {
  if (!values.length || operators.length !== values.length - 1) return null;
  const tokens = [{ type: "number", value: values[0] }];
  operators.forEach((operator, index) => {
    tokens.push({ type: "operator", value: operator });
    tokens.push({ type: "number", value: values[index + 1] });
  });

  if (typeof evaluateCalculatorTokens === "function") {
    try {
      return evaluateCalculatorTokens(tokens);
    } catch {
      return null;
    }
  }

  const precedence = { "+": 1, "−": 1, "×": 2, "÷": 2 };
  const numberStack = [];
  const operatorStack = [];
  const apply = () => {
    const operator = operatorStack.pop();
    const right = numberStack.pop();
    const left = numberStack.pop();
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("invalid formula");
    if (operator === "+") numberStack.push(left + right);
    if (operator === "−") numberStack.push(left - right);
    if (operator === "×") numberStack.push(left * right);
    if (operator === "÷") {
      if (right === 0) throw new Error("division by zero");
      numberStack.push(left / right);
    }
  };

  try {
    tokens.forEach((token) => {
      if (token.type === "number") numberStack.push(Number(token.value));
      else {
        while (operatorStack.length && precedence[operatorStack.at(-1)] >= precedence[token.value]) apply();
        operatorStack.push(token.value);
      }
    });
    while (operatorStack.length) apply();
    return Number.isFinite(numberStack[0]) ? numberStack[0] : null;
  } catch {
    return null;
  }
}

function resolveFormulaHelper(stepId) {
  const data = findCaseForStep(stepId);
  const step = data?.pages.flatMap((page) => page.steps || []).find((item) => item.id === stepId);
  if (!data || !step?.formula?.nodes?.length) return null;

  const resolved = step.formula.nodes.map((node) => resolveFormulaSource(data, node));
  if (resolved.some((item) => !item || !Number.isFinite(item.value))) return null;

  const operators = extractFormulaOperators(step.formula.template);
  const values = resolved.map((item) => item.value);
  const value = evaluateFormulaParts(values, operators);
  if (!Number.isFinite(value)) return null;

  const expression = values
    .map((item, index) => `${index ? `${operators[index - 1]} ` : ""}${formatNumber(item)}`)
    .join(" ");

  return { expression, value };
}

// Replace the original CASE 1-specific lookup with a content-driven resolver.
formulaHelper = resolveFormulaHelper;
