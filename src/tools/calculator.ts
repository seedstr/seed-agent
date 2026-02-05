export interface CalculatorResult {
  expression: string;
  result: number;
  formattedResult: string;
}

/**
 * Safe mathematical expression evaluator
 * Supports basic operations, functions, and constants
 */
export function calculator(expression: string): CalculatorResult {
  // Sanitize and prepare the expression
  const sanitized = sanitizeExpression(expression);

  // Evaluate the expression
  const result = evaluateExpression(sanitized);

  return {
    expression,
    result,
    formattedResult: formatResult(result),
  };
}

/**
 * Sanitize the expression to prevent code injection
 */
function sanitizeExpression(expr: string): string {
  // Remove whitespace
  let sanitized = expr.replace(/\s+/g, "");

  // Convert common function names to Math functions
  const replacements: [RegExp, string][] = [
    [/\bsqrt\(/gi, "Math.sqrt("],
    [/\babs\(/gi, "Math.abs("],
    [/\bsin\(/gi, "Math.sin("],
    [/\bcos\(/gi, "Math.cos("],
    [/\btan\(/gi, "Math.tan("],
    [/\basin\(/gi, "Math.asin("],
    [/\bacos\(/gi, "Math.acos("],
    [/\batan\(/gi, "Math.atan("],
    [/\blog\(/gi, "Math.log("],
    [/\blog10\(/gi, "Math.log10("],
    [/\blog2\(/gi, "Math.log2("],
    [/\bexp\(/gi, "Math.exp("],
    [/\bpow\(/gi, "Math.pow("],
    [/\bfloor\(/gi, "Math.floor("],
    [/\bceil\(/gi, "Math.ceil("],
    [/\bround\(/gi, "Math.round("],
    [/\bmin\(/gi, "Math.min("],
    [/\bmax\(/gi, "Math.max("],
    [/\bpi\b/gi, "Math.PI"],
    [/\be\b/gi, "Math.E"],
    [/\^/g, "**"], // Convert ^ to ** for exponentiation
  ];

  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  // Validate the expression only contains safe characters
  const safePattern = /^[0-9+\-*/().,%\s]+$|^[0-9+\-*/().,%\sMath.a-zA-Z]+$/;
  if (!safePattern.test(sanitized)) {
    // Check if it only contains Math functions and operators
    const mathPattern =
      /^[0-9+\-*/().,%\s]*(Math\.(sqrt|abs|sin|cos|tan|asin|acos|atan|log|log10|log2|exp|pow|floor|ceil|round|min|max|PI|E)[0-9+\-*/().,%\s]*)*$/;
    if (!mathPattern.test(sanitized)) {
      throw new Error(
        `Invalid expression: contains unsafe characters. Expression: ${expr}`
      );
    }
  }

  return sanitized;
}

/**
 * Safely evaluate a mathematical expression
 */
function evaluateExpression(expr: string): number {
  try {
    // Create a safe evaluation context with only Math available
    const safeEval = new Function(
      "Math",
      `"use strict"; return (${expr});`
    );
    const result = safeEval(Math);

    if (typeof result !== "number" || !isFinite(result)) {
      throw new Error("Expression did not evaluate to a valid number");
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to evaluate expression: ${error.message}`);
    }
    throw new Error("Failed to evaluate expression");
  }
}

/**
 * Format the result for display
 */
function formatResult(result: number): string {
  // Handle integers
  if (Number.isInteger(result)) {
    return result.toString();
  }

  // Handle very small or very large numbers with scientific notation
  if (Math.abs(result) < 0.0001 || Math.abs(result) > 1e10) {
    return result.toExponential(6);
  }

  // Round to 10 decimal places to avoid floating point artifacts
  const rounded = Math.round(result * 1e10) / 1e10;

  // Format with up to 10 decimal places, trimming trailing zeros
  return rounded.toString();
}

export default calculator;
