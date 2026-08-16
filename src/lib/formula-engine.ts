/**
 * Safe Declarative Formula & Business Rule Engine
 * Master Reference: docs/MASTER/CUSTOM_FORMULA_ENGINE.md
 * Master Reference: docs/MASTER/CALCULATION_AND_RULE_ENGINE.md
 *
 * STRICT SAFETY MANDATE:
 * - NO unsafe eval(), new Function(), or arbitrary JavaScript execution.
 * - AST-based declarative parser for arithmetic and conditional business logic.
 * - Deterministic, floating-point rounded, and reproducible.
 */

export interface FormulaVariable {
  name: string;
  label: string;
  type: "number" | "boolean" | "string";
  defaultValue?: number | boolean | string;
}

export interface RuleCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "in";
  value: any;
}

export interface BusinessRuleDefinition {
  id: string;
  name: string;
  description?: string;
  category: "labour" | "approval" | "discount" | "wastage" | "custom";
  conditions: RuleCondition[];
  conditionLogic: "AND" | "OR";
  action: {
    type: "apply_formula" | "require_approval" | "override_rate" | "exclude_weight" | "alert";
    targetField?: string;
    formulaExpression?: string;
    approvalRole?: "manager" | "owner" | "admin";
    message?: string;
    overrideValue?: number;
  };
  isActive: boolean;
}

/**
 * Tokenizer & Safe Recursive Descent Parser for Mathematical Expressions
 */
type TokenType = "NUMBER" | "VARIABLE" | "OP" | "LPAREN" | "RPAREN" | "COMMA" | "FUNC";

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const str = expression.trim();

  while (i < str.length) {
    const ch = str[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = "";
      while (i < str.length && /[0-9.]/.test(str[i])) {
        numStr += str[i];
        i++;
      }
      tokens.push({ type: "NUMBER", value: numStr });
      continue;
    }

    // Variable in braces e.g. {net_weight}
    if (ch === "{") {
      i++;
      let varName = "";
      while (i < str.length && str[i] !== "}") {
        varName += str[i];
        i++;
      }
      i++; // skip '}'
      tokens.push({ type: "VARIABLE", value: varName.trim() });
      continue;
    }

    // Identifiers / functions (e.g. max, min, round, if, or plain variable name)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
        ident += str[i];
        i++;
      }
      const lower = ident.toLowerCase();
      if (["max", "min", "round", "floor", "ceil", "abs", "if"].includes(lower)) {
        tokens.push({ type: "FUNC", value: lower });
      } else {
        tokens.push({ type: "VARIABLE", value: ident });
      }
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    if (ch === ",") {
      tokens.push({ type: "COMMA", value: "," });
      i++;
      continue;
    }

    if (["+", "-", "*", "/", "%", "^"].includes(ch)) {
      tokens.push({ type: "OP", value: ch });
      i++;
      continue;
    }

    // Unknown char, advance
    i++;
  }

  return tokens;
}

/**
 * Safe Recursive Descent Parser
 */
class SafeExpressionParser {
  private tokens: Token[];
  private pos = 0;
  private context: Record<string, any>;

  constructor(tokens: Token[], context: Record<string, any>) {
    this.tokens = tokens;
    this.context = context;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(expectedType?: TokenType): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("Unexpected end of expression");
    if (expectedType && t.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but got ${t.type} ('${t.value}')`);
    }
    this.pos++;
    return t;
  }

  public parse(): number {
    if (this.tokens.length === 0) return 0;
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos}: '${this.tokens[this.pos].value}'`);
    }
    return isNaN(result) || !isFinite(result) ? 0 : result;
  }

  private parseExpression(): number {
    let result = this.parseTerm();

    while (this.peek() && (this.peek()?.value === "+" || this.peek()?.value === "-")) {
      const op = this.consume("OP").value;
      const right = this.parseTerm();
      if (op === "+") result += right;
      if (op === "-") result -= right;
    }

    return result;
  }

  private parseTerm(): number {
    let result = this.parseFactor();

    while (
      this.peek() &&
      (this.peek()?.value === "*" || this.peek()?.value === "/" || this.peek()?.value === "%")
    ) {
      const op = this.consume("OP").value;
      const right = this.parseFactor();
      if (op === "*") result *= right;
      if (op === "/") result = right === 0 ? 0 : result / right;
      if (op === "%") result = right === 0 ? 0 : result % right;
    }

    return result;
  }

  private parseFactor(): number {
    const token = this.peek();
    if (!token) return 0;

    // Unary plus/minus
    if (token.type === "OP" && (token.value === "+" || token.value === "-")) {
      this.consume("OP");
      const factor = this.parseFactor();
      return token.value === "-" ? -factor : factor;
    }

    if (token.type === "NUMBER") {
      this.consume("NUMBER");
      return parseFloat(token.value);
    }

    if (token.type === "VARIABLE") {
      this.consume("VARIABLE");
      const val = this.context[token.value];
      if (val === undefined || val === null) return 0;
      return typeof val === "number" ? val : parseFloat(String(val)) || 0;
    }

    if (token.type === "FUNC") {
      const fnName = this.consume("FUNC").value;
      this.consume("LPAREN");
      const args: number[] = [];

      if (this.peek()?.type !== "RPAREN") {
        args.push(this.parseExpression());
        while (this.peek()?.type === "COMMA") {
          this.consume("COMMA");
          args.push(this.parseExpression());
        }
      }
      this.consume("RPAREN");

      switch (fnName) {
        case "max":
          return args.length > 0 ? Math.max(...args) : 0;
        case "min":
          return args.length > 0 ? Math.min(...args) : 0;
        case "round":
          return args.length > 0 ? Math.round(args[0]) : 0;
        case "floor":
          return args.length > 0 ? Math.floor(args[0]) : 0;
        case "ceil":
          return args.length > 0 ? Math.ceil(args[0]) : 0;
        case "abs":
          return args.length > 0 ? Math.abs(args[0]) : 0;
        case "if":
          // if(cond, trueVal, falseVal) -> cond != 0 ? trueVal : falseVal
          return args.length >= 3 ? (args[0] !== 0 ? args[1] : args[2]) : args[0] || 0;
        default:
          return 0;
      }
    }

    if (token.type === "LPAREN") {
      this.consume("LPAREN");
      const val = this.parseExpression();
      this.consume("RPAREN");
      return val;
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }
}

/**
 * Safely evaluates a custom formula expression with a provided record/context dictionary.
 */
export function evaluateSafeFormula(
  expression: string,
  context: Record<string, any>,
): { success: boolean; value: number; error?: string } {
  try {
    if (!expression || !expression.trim()) {
      return { success: true, value: 0 };
    }
    const tokens = tokenize(expression);
    const parser = new SafeExpressionParser(tokens, context);
    const value = parser.parse();
    return { success: true, value };
  } catch (err: any) {
    return { success: false, value: 0, error: err.message || "Evaluation error" };
  }
}

/**
 * Evaluates a set of declarative business rules against a record.
 */
export function evaluateBusinessRules(
  rules: BusinessRuleDefinition[],
  record: Record<string, any>,
): {
  triggeredRules: BusinessRuleDefinition[];
  requiresApproval: boolean;
  approvalRole?: string;
  calculatedOverrides: Record<string, number>;
  messages: string[];
} {
  const triggered: BusinessRuleDefinition[] = [];
  const overrides: Record<string, number> = {};
  const messages: string[] = [];
  let requiresApproval = false;
  let highestRole = "manager";

  for (const rule of rules) {
    if (!rule.isActive) continue;

    let isMatch = rule.conditionLogic === "AND";

    for (const cond of rule.conditions) {
      const recordVal = record[cond.field];
      let condPassed = false;

      switch (cond.operator) {
        case "eq":
          condPassed =
            recordVal === cond.value ||
            String(recordVal).toLowerCase() === String(cond.value).toLowerCase();
          break;
        case "neq":
          condPassed =
            recordVal !== cond.value &&
            String(recordVal).toLowerCase() !== String(cond.value).toLowerCase();
          break;
        case "gt":
          condPassed = parseFloat(recordVal) > parseFloat(cond.value);
          break;
        case "gte":
          condPassed = parseFloat(recordVal) >= parseFloat(cond.value);
          break;
        case "lt":
          condPassed = parseFloat(recordVal) < parseFloat(cond.value);
          break;
        case "lte":
          condPassed = parseFloat(recordVal) <= parseFloat(cond.value);
          break;
        case "contains":
          condPassed = String(recordVal || "")
            .toLowerCase()
            .includes(String(cond.value).toLowerCase());
          break;
        case "in":
          condPassed = Array.isArray(cond.value) && cond.value.includes(recordVal);
          break;
      }

      if (rule.conditionLogic === "AND") {
        if (!condPassed) {
          isMatch = false;
          break;
        }
      } else {
        // OR logic
        if (condPassed) {
          isMatch = true;
          break;
        }
      }
    }

    if (isMatch) {
      triggered.push(rule);

      if (rule.action.type === "require_approval") {
        requiresApproval = true;
        if (rule.action.approvalRole === "owner") highestRole = "owner";
        if (rule.action.approvalRole === "admin") highestRole = "admin";
      }

      if (
        rule.action.type === "apply_formula" &&
        rule.action.targetField &&
        rule.action.formulaExpression
      ) {
        const evalRes = evaluateSafeFormula(rule.action.formulaExpression, record);
        if (evalRes.success) {
          overrides[rule.action.targetField] = evalRes.value;
        }
      }

      if (
        rule.action.type === "override_rate" &&
        rule.action.targetField &&
        rule.action.overrideValue !== undefined
      ) {
        overrides[rule.action.targetField] = rule.action.overrideValue;
      }

      if (rule.action.message) {
        messages.push(rule.action.message);
      }
    }
  }

  return {
    triggeredRules: triggered,
    requiresApproval,
    approvalRole: requiresApproval ? highestRole : undefined,
    calculatedOverrides: overrides,
    messages,
  };
}
