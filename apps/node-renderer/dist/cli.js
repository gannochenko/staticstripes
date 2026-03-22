#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const html_parser_1 = require("./lib/html-parser");
const node_factory_1 = require("./lib/node-factory");
const dag_validator_1 = require("./lib/dag-validator");
const dag_runner_1 = require("./lib/dag-runner");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function printUsage() {
    console.log(`
Node Renderer CLI

Usage:
  node-renderer <project.html> [options]

Options:
  --no-cache          Disable caching
  --verbose, -v       Verbose output
  --validate-only     Only validate, don't execute
  --help, -h          Show this help

Examples:
  node-renderer project.html
  node-renderer project.html --verbose
  node-renderer project.html --validate-only
  node-renderer project.html --no-cache
`);
}
function parseArgs() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        printUsage();
        return null;
    }
    const projectPath = args[0];
    const enableCache = !args.includes('--no-cache');
    const verbose = args.includes('--verbose') || args.includes('-v');
    const validate = args.includes('--validate-only');
    return {
        projectPath,
        enableCache,
        verbose,
        validate,
    };
}
function printSeparator(char = '=', length = 60) {
    console.log(char.repeat(length));
}
function printHeader(title) {
    console.log();
    printSeparator();
    console.log(`  ${title}`);
    printSeparator();
    console.log();
}
async function validateProject(projectPath, verbose) {
    printHeader('📋 Validating Project');
    // Check file exists
    if (!fs.existsSync(projectPath)) {
        console.error(`❌ File not found: ${projectPath}`);
        return false;
    }
    const absolutePath = path.resolve(projectPath);
    console.log(`📄 Project: ${path.basename(absolutePath)}`);
    console.log(`📁 Location: ${path.dirname(absolutePath)}`);
    console.log();
    try {
        // Parse HTML
        console.log('🔍 Parsing HTML...');
        const parser = new html_parser_1.HTMLParser();
        const result = await parser.parseFile(absolutePath);
        console.log(`✅ Found ${result.nodes.length} node(s)`);
        if (verbose) {
            result.nodes.forEach((node, i) => {
                const name = node.name || node.type;
                console.log(`   ${i + 1}. ${node.type} (${name})`);
            });
        }
        console.log();
        // Create nodes
        console.log('🏗️  Creating node instances...');
        const nodes = node_factory_1.NodeFactory.createNodes(result.nodes, result.outputs);
        console.log(`✅ Created ${nodes.length} node instance(s)`);
        console.log();
        // Validate DAG
        console.log('🔍 Validating DAG structure...');
        const validation = dag_validator_1.DAGValidator.validate(result.nodes, nodes, result.outputs);
        if (!validation.valid) {
            console.error('❌ Validation failed!\n');
            validation.errors.forEach((error, i) => {
                console.error(`  ${i + 1}. [${error.type}] ${error.message}`);
                if (error.nodeName)
                    console.error(`     Node: ${error.nodeName}`);
                if (error.field)
                    console.error(`     Field: ${error.field}`);
                if (error.reference)
                    console.error(`     Reference: ${error.reference}`);
            });
            return false;
        }
        console.log('✅ DAG structure is valid');
        console.log();
        // Show execution order
        if (validation.executionOrder) {
            console.log('📊 Execution order:');
            validation.executionOrder.forEach((nodeName, i) => {
                console.log(`   ${i + 1}. ${nodeName}`);
            });
            console.log();
        }
        // Show dependencies
        if (verbose && validation.dependencies.length > 0) {
            console.log('🔗 Dependencies:');
            validation.dependencies.forEach((dep) => {
                console.log(`   ${dep.from} → ${dep.to}`);
                console.log(`      via: ${dep.via}`);
            });
            console.log();
        }
        // Show node details
        if (verbose) {
            console.log('📦 Node Details:');
            nodes.forEach((node, i) => {
                const parsedNode = result.nodes[i];
                const name = parsedNode.name || parsedNode.type;
                console.log(`\n   ${name} (${node.getType()}):`);
                const inputs = node.getInputs();
                if (inputs.length > 0) {
                    console.log(`     Inputs: ${inputs.map((inp) => inp.name).join(', ')}`);
                }
                const outputs = node.getOutputs();
                if (outputs.length > 0) {
                    console.log(`     Outputs: ${outputs.map((out) => out.name).join(', ')}`);
                }
                const errors = node.validateParameters();
                if (errors.length > 0) {
                    console.log(`     ⚠️  Warnings: ${errors.length} parameter issue(s)`);
                }
            });
            console.log();
        }
        return true;
    }
    catch (error) {
        console.error('❌ Validation error:', error.message);
        if (verbose) {
            console.error(error.stack);
        }
        return false;
    }
}
async function executeProject(projectPath, enableCache, verbose) {
    printHeader('🚀 Executing Project');
    const absolutePath = path.resolve(projectPath);
    try {
        // Parse and validate
        const parser = new html_parser_1.HTMLParser();
        const result = await parser.parseFile(absolutePath);
        const nodes = node_factory_1.NodeFactory.createNodes(result.nodes, result.outputs);
        // Get project directory (directory containing project.html)
        const projectDir = path.dirname(absolutePath);
        // Extract output resolution and FPS from top-level outputs
        let outputResolution = { width: 1920, height: 1080 }; // default
        let outputFps = 30; // default
        if (result.outputs.length > 0) {
            const firstOutput = result.outputs[0];
            // Parse resolution "1080x1920"
            const [width, height] = firstOutput.resolution.split('x').map(Number);
            if (width && height) {
                outputResolution = { width, height };
            }
            if (firstOutput.fps) {
                outputFps = firstOutput.fps;
            }
        }
        // Create runner
        const runner = new dag_runner_1.DAGRunner(result.nodes, nodes, projectDir, {
            enableCache,
            outputResolution,
            outputFps,
            onNodeStart: (nodeName) => {
                console.log(`🔄 Executing: ${nodeName}`);
            },
            onNodeComplete: (result) => {
                const cacheStatus = result.fromCache ? '💾 (cached)' : '';
                const duration = `${result.duration}ms`;
                console.log(`✅ Completed: ${result.nodeName} ${cacheStatus} [${duration}]`);
                if (verbose && result.outputs) {
                    result.outputs.forEach((value, outputName) => {
                        console.log(`   Output ${outputName}: ${value}`);
                    });
                }
            },
            onNodeError: (nodeName, error) => {
                console.error(`❌ Failed: ${nodeName}`);
                console.error(`   Error: ${error.message}`);
                if (verbose) {
                    console.error(error.stack);
                }
            },
        }, result.outputs);
        console.log(`Cache: ${enableCache ? 'enabled' : 'disabled'}`);
        console.log();
        // Validate DAG
        const validation = dag_validator_1.DAGValidator.validate(result.nodes, nodes, result.outputs);
        if (!validation.valid) {
            printSeparator('=');
            console.log('  ❌ Validation Failed');
            printSeparator('=');
            console.log();
            console.log('Please fix the errors above and try again.');
            process.exit(1);
        }
        // Execute
        const startTime = Date.now();
        const execution = await runner.execute();
        const totalTime = Date.now() - startTime;
        console.log();
        printSeparator('-');
        if (execution.success) {
            console.log('✅ Execution completed successfully!');
            console.log();
            console.log(`📊 Summary:`);
            console.log(`   Nodes executed: ${execution.executedNodes.length}`);
            console.log(`   Total duration: ${execution.totalDuration}ms`);
            console.log(`   Wall clock time: ${totalTime}ms`);
            if (enableCache) {
                const cachedCount = execution.results.filter((r) => r.fromCache).length;
                console.log(`   Cache hits: ${cachedCount}/${execution.results.length}`);
            }
            if (verbose) {
                console.log();
                console.log('📦 Execution Context:');
                const context = runner.getContext();
                execution.executedNodes.forEach((nodeName) => {
                    const outputs = context.getNodeOutputs(nodeName);
                    if (outputs) {
                        console.log(`\n   ${nodeName}:`);
                        outputs.forEach((value, outputName) => {
                            console.log(`     ${outputName}: ${value}`);
                        });
                    }
                });
            }
            return true;
        }
        else {
            console.error('❌ Execution failed!');
            console.error();
            console.error(`📊 Summary:`);
            console.error(`   Failed at: ${execution.error?.nodeName}`);
            console.error(`   Error: ${execution.error?.error.message}`);
            console.error(`   Executed: ${execution.executedNodes.length} node(s)`);
            if (verbose && execution.error?.error.stack) {
                console.error();
                console.error('Stack trace:');
                console.error(execution.error.error.stack);
            }
            return false;
        }
    }
    catch (error) {
        console.error('❌ Execution error:', error.message);
        if (verbose) {
            console.error(error.stack);
        }
        return false;
    }
}
async function main() {
    const options = parseArgs();
    if (!options) {
        process.exit(0);
    }
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              Node-Based Video Renderer                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
    let success = false;
    // Validate first
    const validationSuccess = await validateProject(options.projectPath, options.verbose || false);
    if (!validationSuccess) {
        printHeader('❌ Validation Failed');
        console.error('Please fix the errors above and try again.');
        process.exit(1);
    }
    printHeader('✅ Validation Passed');
    // Execute if not validate-only
    if (!options.validate) {
        success = await executeProject(options.projectPath, options.enableCache !== false, options.verbose || false);
    }
    else {
        success = true;
    }
    console.log();
    printSeparator('=');
    if (success) {
        console.log('✨ Done!');
        process.exit(0);
    }
    else {
        console.log('❌ Failed!');
        process.exit(1);
    }
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map