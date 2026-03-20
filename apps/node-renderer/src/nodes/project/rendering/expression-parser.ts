import { Expression, Parser } from 'expr-eval';

export type TimeData = {
  start: number; // when fragment starts in timeline (milliseconds)
  end: number; // when fragment ends (milliseconds)
  duration: number; // fragment duration (milliseconds)
};

export type FragmentData = {
  time: TimeData;
};

/**
 * Context available for expression evaluation
 * Contains fragment data with runtime timing information
 */
export type ExpressionContext = {
  fragments: Map<string, FragmentData>;
};

/**
 * Compiled expression that can be evaluated with runtime context
 */
export type CompiledExpression = {
  original: string;
  expression: Expression;
};

/**
 * Parses a calc() expression into a compiled expression for later evaluation
 *
 * Supported syntax:
 * - Fragment references: #fragment_id.property.path
 * - Math operations: +, -, *, /, parentheses
 * - Constants: numeric values
 *
 * Examples:
 * - calc(-1 * #ending_screen.time.start)
 * - calc(#intro.time.duration + 1000)
 * - calc((#scene1.time.start + #scene2.time.end) / 2)
 *
 * @param expression - The expression string to parse
 * @returns Compiled expression that can be evaluated later
 */
export function parseExpression(expression: string): CompiledExpression {
  const parser = new Parser();

  // Transform expression to replace fragment references with variable names
  // Convert: calc(-1 * #ending_screen.time.start)
  // To:      -1 * ending_screen_time_start
  const transformed = transformExpressionToVariables(expression);

  try {
    // Parse into Expression object
    const expr = parser.parse(transformed);
    return {
      original: expression,
      expression: expr,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse expression "${expression}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Evaluates a compiled expression with runtime context
 *
 * @param compiled - Compiled expression from parseExpression()
 * @param context - Context containing fragment data
 * @returns Evaluated numeric result (in milliseconds)
 */
export function evaluateCompiledExpression(
  compiled: CompiledExpression,
  context: ExpressionContext,
): number {
  // Build evaluation context by resolving all fragment references
  // Convert fragment references to flat variable names
  const evalContext: Record<string, number> = {};

  // Extract all fragment references from the original expression
  const fragmentRefs = compiled.original.matchAll(
    /#(\w+)\.([\w.]+?)(?=\s|[+\-*/)]|$)/g,
  );

  for (const match of fragmentRefs) {
    const id = match[1];
    const prop = match[2];
    const varName = `${id}_${prop.replace(/\./g, '_')}`;

    // Resolve fragment value
    const fragment = context.fragments.get(id);
    if (!fragment) {
      throw new Error(
        `Fragment with id "${id}" not found in expression: ${compiled.original}`,
      );
    }

    // Navigate property path (e.g., "time.start" -> fragment.time.start)
    const parts = prop.split('.');
    let value: any = fragment;
    for (const part of parts) {
      value = value[part];
      if (value === undefined) {
        throw new Error(
          `Property "${prop}" not found on fragment "${id}" in expression: ${compiled.original}`,
        );
      }
    }

    evalContext[varName] = value;
  }

  try {
    // Evaluate with resolved context
    return compiled.expression.evaluate(evalContext);
  } catch (error) {
    throw new Error(
      `Failed to evaluate expression "${compiled.original}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Transforms calc() expression syntax to use variable names instead of fragment references
 * and converts time units to milliseconds
 * @param expression - Original expression
 * @returns Transformed expression
 *
 * Example: calc(url(#ending_screen.time.start) + 5s)
 *       -> ending_screen_time_start + 5000
 */
function transformExpressionToVariables(expression: string): string {
  let transformed = expression
    // Remove calc() wrapper
    .replace(/calc\(/g, '(')
    // Convert fragment references: url(#id.prop.path) -> id_prop_path
    .replace(/url\(#(\w+)\.([\w.]+?)\)/g, (_, id, prop) => {
      return `${id}_${prop.replace(/\./g, '_')}`;
    })
    // Convert time units to milliseconds
    // Match numbers with 's' suffix (seconds): 5s -> 5000
    .replace(/(\d+(?:\.\d+)?)s(?!\w)/g, (_, num) => {
      return String(parseFloat(num) * 1000);
    })
    // Match numbers with 'ms' suffix (milliseconds): 5000ms -> 5000
    .replace(/(\d+(?:\.\d+)?)ms(?!\w)/g, (_, num) => {
      return String(parseFloat(num));
    });

  return transformed;
}

/**
 * Checks if a string contains a calc() expression
 * @param value - String to check
 * @returns True if value contains calc()
 */
export function isCalcExpression(value: string): boolean {
  return typeof value === 'string' && value.trim().startsWith('calc(');
}

/**
 * Parses a value into either a number or a compiled expression for later evaluation
 * Use this during HTML parsing to compile expressions once
 * @param value - Value to parse (number or calc expression string)
 * @returns Number or CompiledExpression
 */
export function parseValueLazy(
  value: number | string,
): number | CompiledExpression {
  if (typeof value === 'number') {
    return value;
  }

  if (isCalcExpression(value)) {
    return parseExpression(value);
  }

  // Try to parse as plain number
  const parsed = parseFloat(value);
  if (!isNaN(parsed)) {
    return parsed;
  }

  throw new Error(
    `Invalid value: "${value}". Expected number or calc() expression`,
  );
}

export function calculateFinalValue(
  value: number | CompiledExpression,
  context: ExpressionContext,
) {
  return typeof value === 'number'
    ? value
    : evaluateCompiledExpression(value, context);
}
