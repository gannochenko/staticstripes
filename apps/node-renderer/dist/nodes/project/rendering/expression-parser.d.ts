import { Expression } from 'expr-eval';
export type TimeData = {
    start: number;
    end: number;
    duration: number;
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
export declare function parseExpression(expression: string): CompiledExpression;
/**
 * Evaluates a compiled expression with runtime context
 *
 * @param compiled - Compiled expression from parseExpression()
 * @param context - Context containing fragment data
 * @returns Evaluated numeric result (in milliseconds)
 */
export declare function evaluateCompiledExpression(compiled: CompiledExpression, context: ExpressionContext): number;
/**
 * Checks if a string contains a calc() expression
 * @param value - String to check
 * @returns True if value contains calc()
 */
export declare function isCalcExpression(value: string): boolean;
/**
 * Parses a value into either a number or a compiled expression for later evaluation
 * Use this during HTML parsing to compile expressions once
 * @param value - Value to parse (number or calc expression string)
 * @returns Number or CompiledExpression
 */
export declare function parseValueLazy(value: number | string): number | CompiledExpression;
export declare function calculateFinalValue(value: number | CompiledExpression, context: ExpressionContext): number;
//# sourceMappingURL=expression-parser.d.ts.map