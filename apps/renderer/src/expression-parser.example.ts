/**
 * Example usage of the expression parser
 *
 * This demonstrates how to evaluate calc() expressions with fragment references
 * using the compiled Expression approach for better performance
 */

import {
  parseExpression,
  evaluateCompiledExpression,
  evaluateExpression,
  isCalcExpression,
  parseValue,
  parseValueLazy,
  type ExpressionContext,
} from './expression-parser';
import type { Fragment } from './type';

// Example: Create a context with fragment timing data
function createExampleContext(): ExpressionContext {
  const fragments = new Map<
    string,
    Fragment & {
      time: {
        start: number;
        end: number;
        duration: number;
      };
    }
  >();

  // Fragment 1: intro (0s - 2s)
  fragments.set('intro', {
    id: 'intro',
    enabled: true,
    assetName: 'intro_video',
    duration: 2000,
    trimLeft: 0,
    overlayLeft: 0,
    overlayZIndex: 0,
    transitionIn: '',
    transitionInDuration: 0,
    transitionOut: '',
    transitionOutDuration: 0,
    objectFit: 'cover',
    objectFitContain: 'ambient',
    objectFitContainAmbientBlurStrength: 25,
    objectFitContainAmbientBrightness: -0.1,
    objectFitContainAmbientSaturation: 0.7,
    objectFitContainPillarboxColor: '#000000',
    chromakey: false,
    chromakeyBlend: 0,
    chromakeySimilarity: 0,
    chromakeyColor: '#00FF00',
    zIndex: 0,
    blendModeLeft: '',
    time: {
      start: 0,
      end: 2000,
      duration: 2000,
    },
  });

  // Fragment 2: main_content (2s - 10s)
  fragments.set('main_content', {
    id: 'main_content',
    enabled: true,
    assetName: 'main_video',
    duration: 8000,
    trimLeft: 0,
    overlayLeft: 0,
    overlayZIndex: 0,
    transitionIn: '',
    transitionInDuration: 0,
    transitionOut: '',
    transitionOutDuration: 0,
    objectFit: 'cover',
    objectFitContain: 'ambient',
    objectFitContainAmbientBlurStrength: 25,
    objectFitContainAmbientBrightness: -0.1,
    objectFitContainAmbientSaturation: 0.7,
    objectFitContainPillarboxColor: '#000000',
    chromakey: false,
    chromakeyBlend: 0,
    chromakeySimilarity: 0,
    chromakeyColor: '#00FF00',
    zIndex: 0,
    blendModeLeft: '',
    time: {
      start: 2000,
      end: 10000,
      duration: 8000,
    },
  });

  // Fragment 3: ending_screen (10s - 13s)
  fragments.set('ending_screen', {
    id: 'ending_screen',
    enabled: true,
    assetName: 'outro_video',
    duration: 3000,
    trimLeft: 0,
    overlayLeft: 0,
    overlayZIndex: 0,
    transitionIn: '',
    transitionInDuration: 0,
    transitionOut: '',
    transitionOutDuration: 0,
    objectFit: 'cover',
    objectFitContain: 'ambient',
    objectFitContainAmbientBlurStrength: 25,
    objectFitContainAmbientBrightness: -0.1,
    objectFitContainAmbientSaturation: 0.7,
    objectFitContainPillarboxColor: '#000000',
    chromakey: false,
    chromakeyBlend: 0,
    chromakeySimilarity: 0,
    chromakeyColor: '#00FF00',
    zIndex: 0,
    blendModeLeft: '',
    time: {
      start: 10000,
      end: 13000,
      duration: 3000,
    },
  });

  return { fragments };
}

// Example usage
export function runExamples() {
  const context = createExampleContext();

  console.log('=== Expression Parser Examples ===\n');

  // Example 1: Negative offset based on fragment start time
  const expr1 = 'calc(-1 * #ending_screen.time.start)';
  console.log(`Expression: ${expr1}`);
  console.log(`Result: ${evaluateExpression(expr1, context)}ms`);
  console.log(`Expected: -10000ms (negative of ending_screen start time)\n`);

  // Example 2: Add durations
  const expr2 = 'calc(#intro.time.duration + #main_content.time.duration)';
  console.log(`Expression: ${expr2}`);
  console.log(`Result: ${evaluateExpression(expr2, context)}ms`);
  console.log(`Expected: 10000ms (2000 + 8000)\n`);

  // Example 3: Complex calculation
  const expr3 = 'calc((#ending_screen.time.start - #intro.time.duration) / 2)';
  console.log(`Expression: ${expr3}`);
  console.log(`Result: ${evaluateExpression(expr3, context)}ms`);
  console.log(`Expected: 4000ms ((10000 - 2000) / 2)\n`);

  // Example 4: Using parseValue with different input types
  console.log('=== parseValue Examples ===\n');
  console.log('parseValue(5000, context):', parseValue(5000, context));
  console.log(
    'parseValue("calc(#intro.time.start)", context):',
    parseValue('calc(#intro.time.start)', context),
  );
  console.log('parseValue("1500", context):', parseValue('1500', context));

  // Example 5: Check if string is calc expression
  console.log('\n=== isCalcExpression Examples ===\n');
  console.log('isCalcExpression("calc(100 + 200)"):', isCalcExpression('calc(100 + 200)'));
  console.log('isCalcExpression("1000"):', isCalcExpression('1000'));
  console.log('isCalcExpression(1000):', isCalcExpression('1000'));

  // Example 6: Compile once, evaluate many times (efficient pattern)
  console.log('\n=== Compiled Expression Pattern (Efficient!) ===\n');

  // Parse expression once during HTML processing
  const compiled = parseExpression('calc(-1 * #ending_screen.time.start)');
  console.log('Compiled expression:', compiled.original);

  // Evaluate multiple times with different contexts (efficient)
  console.log('Evaluation 1:', evaluateCompiledExpression(compiled, context), 'ms');
  console.log('Evaluation 2:', evaluateCompiledExpression(compiled, context), 'ms');
  console.log('Evaluation 3:', evaluateCompiledExpression(compiled, context), 'ms');
  console.log('(No re-parsing needed!)\n');

  // Example 7: parseValueLazy - parse at load time, evaluate at runtime
  console.log('=== parseValueLazy Examples ===\n');
  const lazyValue = parseValueLazy('calc(#intro.time.duration)');
  console.log('Type of lazyValue:', typeof lazyValue);
  console.log('Is CompiledExpression?', typeof lazyValue === 'object' && 'expression' in lazyValue);
  console.log('Evaluated result:', parseValue(lazyValue, context), 'ms');
}

/**
 * Demonstrates the recommended workflow:
 * 1. Parse HTML and compile expressions
 * 2. Calculate fragment timing at runtime
 * 3. Evaluate compiled expressions with timing context
 */
export function demonstrateWorkflow() {
  console.log('\n=== RECOMMENDED WORKFLOW ===\n');

  // Step 1: Parse HTML (at load time)
  console.log('Step 1: Parse HTML and compile expressions');
  const overlayLeftExpression = 'calc(-1 * #ending_screen.time.start)';
  const compiled = parseExpression(overlayLeftExpression);
  console.log(`  Compiled: "${overlayLeftExpression}"\n`);

  // Step 2: Build sequence and calculate timing (at runtime)
  console.log('Step 2: Calculate fragment timing at runtime');
  const context = createExampleContext();
  console.log('  ending_screen.time.start =', context.fragments.get('ending_screen')?.time.start, 'ms\n');

  // Step 3: Evaluate compiled expression
  console.log('Step 3: Evaluate compiled expression with context');
  const result = evaluateCompiledExpression(compiled, context);
  console.log(`  Result: ${result}ms`);
  console.log(`  This gives the overlay offset for precise timing!\n`);
}

// Uncomment to run examples:
// runExamples();
// demonstrateWorkflow();
