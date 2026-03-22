"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSProcessor = void 0;
const expression_parser_1 = require("./rendering/expression-parser");
/**
 * Processes CSS properties and converts them to fragment properties
 * for the rendering engine
 */
class CSSProcessor {
    /**
     * Converts parsed sequences to render-ready sequences
     */
    static processSequences(parsedSequences, css) {
        const renderSequences = [];
        for (const parsedSeq of parsedSequences) {
            const renderFragments = [];
            for (const parsedFragment of parsedSeq.fragments) {
                const renderFragment = this.processFragment(parsedFragment, css);
                if (renderFragment) {
                    renderFragments.push(renderFragment);
                }
            }
            renderSequences.push({
                fragments: renderFragments,
            });
        }
        return renderSequences;
    }
    /**
     * Processes a single fragment
     */
    static processFragment(parsedFragment, css) {
        // Get CSS properties for this element
        const styles = css.get(parsedFragment.element) || {};
        // Extract asset name from data-asset attribute or -asset CSS property
        const assetName = parsedFragment.element.attribs?.['data-asset'] ||
            styles['-asset'] ||
            '';
        if (!assetName) {
            console.warn(`⚠️  Fragment has no data-asset attribute or -asset property, skipping`);
            return null;
        }
        // Extract duration (in milliseconds)
        const durationStr = styles['-duration'] || '0ms';
        const duration = this.parseTimeOrExpression(durationStr);
        // Extract trim-start (support expressions)
        const trimLeftStr = styles['-trim-start'] || '0ms';
        const trimLeft = this.parseTimeOrExpression(trimLeftStr);
        // Extract overlay/offset
        const offsetStartStr = styles['-offset-start'] || '0ms';
        const overlayLeft = this.parseTimeOrExpression(offsetStartStr);
        // Extract transitions
        const transitionIn = this.parseTransition(styles['-transition-start']);
        const transitionOut = this.parseTransition(styles['-transition-end']);
        // Extract object-fit
        const objectFitStr = styles['-object-fit'] || 'contain';
        const objectFit = this.parseObjectFit(objectFitStr);
        // Extract visual filter
        const visualFilter = styles['filter'];
        // Extract sound property
        const sound = styles['-sound'] || 'on';
        // Build render fragment
        const renderFragment = {
            id: parsedFragment.id || `fragment_${Math.random().toString(36).substr(2, 9)}`,
            enabled: true,
            assetName,
            duration,
            trimLeft,
            overlayLeft,
            overlayZIndex: 0,
            transitionIn: transitionIn.type,
            transitionInDuration: transitionIn.duration,
            transitionOut: transitionOut.type,
            transitionOutDuration: transitionOut.duration,
            objectFit: objectFit.type,
            objectFitContain: objectFit.contain,
            objectFitContainAmbientBlurStrength: objectFit.ambientBlur,
            objectFitContainAmbientBrightness: objectFit.ambientBrightness,
            objectFitContainAmbientSaturation: objectFit.ambientSaturation,
            objectFitContainPillarboxColor: objectFit.pillarboxColor,
            objectFitKenBurns: 'zoom-in',
            objectFitKenBurnsZoom: 30,
            objectFitKenBurnsEffectDuration: typeof duration === 'number' ? duration : 0,
            objectFitKenBurnsEasing: 'ease-in-out',
            objectFitKenBurnsFocalX: 50,
            objectFitKenBurnsFocalY: 50,
            objectFitKenBurnsPanStartX: 0,
            objectFitKenBurnsPanStartY: 0,
            objectFitKenBurnsPanEndX: 100,
            objectFitKenBurnsPanEndY: 100,
            chromakey: false,
            chromakeyBlend: 0,
            chromakeySimilarity: 0,
            chromakeyColor: '#000000',
            visualFilter,
            sound,
            timecodeLabel: parsedFragment.timecode,
        };
        return renderFragment;
    }
    /**
     * Parses time string (e.g., "3000ms", "3s") to milliseconds
     */
    static parseTime(timeStr) {
        if (!timeStr)
            return 0;
        const trimmed = timeStr.trim();
        if (trimmed.endsWith('ms')) {
            return parseFloat(trimmed);
        }
        else if (trimmed.endsWith('s')) {
            return parseFloat(trimmed) * 1000;
        }
        return parseFloat(trimmed);
    }
    /**
     * Parses time string or calc() expression
     * Returns either a number (for simple time strings) or a CompiledExpression (for calc())
     */
    static parseTimeOrExpression(timeStr) {
        if (!timeStr)
            return 0;
        const trimmed = timeStr.trim();
        // Check if it's a calc() expression
        if (trimmed.startsWith('calc(')) {
            return (0, expression_parser_1.parseExpression)(trimmed);
        }
        // Otherwise parse as simple time value
        return this.parseTime(trimmed);
    }
    /**
     * Parses transition string (e.g., "fade-in 500ms")
     */
    static parseTransition(transitionStr) {
        if (!transitionStr) {
            return { type: '', duration: 0 };
        }
        const parts = transitionStr.trim().split(/\s+/);
        const type = parts[0] || '';
        const duration = parts[1] ? this.parseTime(parts[1]) : 0;
        return { type, duration };
    }
    /**
     * Parses object-fit string
     */
    static parseObjectFit(objectFitStr) {
        // Split on whitespace, but also split when a digit is followed by a hyphen (negative number)
        // This handles cases like "25-0.1" which should be ["25", "-0.1"]
        // This is necessary because CSS/HTML parsers may remove whitespace before negative numbers
        const normalized = objectFitStr.trim().replace(/(\d)(-\d)/g, '$1 $2');
        const parts = normalized.split(/\s+/);
        const type = parts[0];
        let contain = 'pillarbox';
        let ambientBlur = 20;
        let ambientBrightness = -0.3;
        let ambientSaturation = 0.8;
        let pillarboxColor = '#000000';
        if (type === 'contain' && parts.length > 1) {
            contain = parts[1];
            if (contain === 'ambient' && parts.length >= 5) {
                ambientBlur = parseFloat(parts[2]) || 20;
                ambientBrightness = parseFloat(parts[3]) || -0.3;
                ambientSaturation = parseFloat(parts[4]) || 0.8;
            }
        }
        return {
            type,
            contain,
            ambientBlur,
            ambientBrightness,
            ambientSaturation,
            pillarboxColor,
        };
    }
}
exports.CSSProcessor = CSSProcessor;
//# sourceMappingURL=css-processor.js.map