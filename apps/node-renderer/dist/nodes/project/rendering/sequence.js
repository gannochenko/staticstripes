"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sequence = void 0;
const expression_parser_1 = require("./expression-parser");
const stream_1 = require("./stream");
class Sequence {
    buf;
    definition;
    output;
    assetManager;
    expressionContext;
    time = 0; // time is absolute
    videoStream;
    audioStream;
    debugInfo = []; // Collect debug info during build
    constructor(buf, definition, output, assetManager, expressionContext) {
        this.buf = buf;
        this.definition = definition;
        this.output = output;
        this.assetManager = assetManager;
        this.expressionContext = expressionContext;
    }
    build() {
        let firstOne = true;
        this.definition.fragments.forEach((fragment) => {
            if (!fragment.enabled) {
                return;
            }
            const calculatedOverlayLeft = (0, expression_parser_1.calculateFinalValue)(fragment.overlayLeft, this.expressionContext);
            const calculatedDuration = (0, expression_parser_1.calculateFinalValue)(fragment.duration, this.expressionContext);
            const calculatedTrimLeft = (0, expression_parser_1.calculateFinalValue)(fragment.trimLeft, this.expressionContext);
            const asset = this.assetManager.getAssetByName(fragment.assetName);
            if (!asset) {
                return;
            }
            // If fragment duration is 0 (not explicitly set), use asset's natural duration
            // This prevents creating null sources with duration=0ms which causes FFmpeg to hang
            const effectiveDuration = calculatedDuration > 0 ? calculatedDuration : asset.duration;
            const timeContext = {
                start: 0,
                end: 0,
                duration: effectiveDuration,
            };
            // Create video stream: use actual video if available, otherwise create blank stream
            let currentVideoStream;
            if (asset.hasVideo) {
                currentVideoStream = (0, stream_1.makeStream)(this.assetManager.getVideoInputLabelByAssetName(fragment.assetName), this.buf);
            }
            else {
                // Create blank transparent video stream for audio-only assets
                // If effectiveDuration is 0, don't create a synthetic stream with 0 duration
                // Instead, FFmpeg will use the audio stream's duration automatically
                if (effectiveDuration > 0) {
                    currentVideoStream = (0, stream_1.makeBlankStream)(effectiveDuration, this.output.resolution.width, this.output.resolution.height, this.output.fps, this.buf);
                }
                else {
                    // For audio-only assets with unknown duration, create a long blank stream
                    // and let FFmpeg trim it to match the audio duration
                    currentVideoStream = (0, stream_1.makeBlankStream)(asset.duration || 10000, // Default to 10 seconds if unknown
                    this.output.resolution.width, this.output.resolution.height, this.output.fps, this.buf);
                }
            }
            // Create audio stream: use actual audio if available, otherwise create silent stream
            // If fragment has -sound: off, always use silence
            let currentAudioStream;
            if (fragment.sound === "off") {
                // Force silent audio when -sound: off
                if (effectiveDuration > 0) {
                    currentAudioStream = (0, stream_1.makeSilentStream)(effectiveDuration, this.buf);
                }
                else {
                    currentAudioStream = (0, stream_1.makeSilentStream)(asset.duration || 10000, this.buf);
                }
            }
            else if (asset.hasAudio) {
                currentAudioStream = (0, stream_1.makeStream)(this.assetManager.getAudioInputLabelByAssetName(fragment.assetName), this.buf);
            }
            else {
                // Create silent audio stream matching the video duration
                // If effectiveDuration is 0, don't create a synthetic stream with 0 duration
                if (effectiveDuration > 0) {
                    currentAudioStream = (0, stream_1.makeSilentStream)(effectiveDuration, this.buf);
                }
                else {
                    // For video-only assets with unknown duration, create a long silent stream
                    // and let FFmpeg trim it to match the video duration
                    currentAudioStream = (0, stream_1.makeSilentStream)(asset.duration || 10000, this.buf);
                }
            }
            if ((calculatedTrimLeft != 0 || (effectiveDuration < asset.duration && effectiveDuration > 0))) {
                // Only trim video if it came from an actual source
                if (asset.hasVideo && effectiveDuration > 0) {
                    currentVideoStream.trim(calculatedTrimLeft, calculatedTrimLeft + effectiveDuration);
                }
                // Only trim audio if it came from an actual source AND sound is not off
                if (asset.hasAudio && fragment.sound !== "off" && effectiveDuration > 0) {
                    currentAudioStream.trim(calculatedTrimLeft, calculatedTrimLeft + effectiveDuration);
                }
            }
            // Convert deprecated JPEG pixel format (yuvj420p) to standard yuv420p early
            // This prevents swscaler warnings from appearing in all subsequent filters
            // For PNG/APNG images with alpha, use yuva420p to preserve transparency
            if (asset.hasVideo && asset.type === "image") {
                const hasAlpha = asset.path.toLowerCase().match(/\.(png|apng)$/);
                currentVideoStream.convertPixelFormat(hasAlpha ? "yuva420p" : "yuv420p");
            }
            // Apply visual filter early for static images (before padding/cloning)
            // This is more efficient as ffmpeg processes the filter once, then clones the filtered frame
            if (asset.hasVideo && asset.type === "image" && fragment.visualFilter) {
                currentVideoStream.filter(fragment.visualFilter);
            }
            if (asset.duration === 0 &&
                effectiveDuration > 0 &&
                asset.type === "image" &&
                !asset.path.toLowerCase().endsWith(".apng") &&
                fragment.objectFit !== "ken-burns") {
                // special case for static images (PNG, JPG, etc) - extend to desired duration
                // APNG files are animated and should NOT be cloned
                // Skip tpad for Ken Burns - zoompan will generate the frames
                currentVideoStream.tPad({
                    start: effectiveDuration,
                    startMode: "clone",
                });
            }
            // stream normalization (only for actual video, not synthetic blank video)
            if (asset.hasVideo) {
                // fps reduction
                currentVideoStream.fps(this.output.fps);
                // fitting the video stream into the output frame
                if (fragment.objectFit === "ken-burns") {
                    // Ken Burns effect (zoom/pan)
                    currentVideoStream.kenBurns({
                        effect: fragment.objectFitKenBurns,
                        zoom: fragment.objectFitKenBurnsZoom,
                        effectDuration: fragment.objectFitKenBurnsEffectDuration,
                        fragmentDuration: effectiveDuration,
                        easing: fragment.objectFitKenBurnsEasing,
                        width: this.output.resolution.width,
                        height: this.output.resolution.height,
                        fps: this.output.fps,
                        focalX: fragment.objectFitKenBurnsFocalX,
                        focalY: fragment.objectFitKenBurnsFocalY,
                        panStartX: fragment.objectFitKenBurnsPanStartX,
                        panStartY: fragment.objectFitKenBurnsPanStartY,
                        panEndX: fragment.objectFitKenBurnsPanEndX,
                        panEndY: fragment.objectFitKenBurnsPanEndY,
                    });
                }
                else if (fragment.objectFit === "cover") {
                    currentVideoStream.fitOutputCover(this.output.resolution);
                }
                else {
                    const options = {};
                    if (fragment.objectFitContain === stream_1.AMBIENT) {
                        options.ambient = {
                            blurStrength: fragment.objectFitContainAmbientBlurStrength,
                            brightness: fragment.objectFitContainAmbientBrightness,
                            saturation: fragment.objectFitContainAmbientSaturation,
                        };
                    }
                    else if (fragment.objectFitContain === stream_1.PILLARBOX) {
                        // For PNG/APNG files with alpha, use transparent padding instead of black
                        const isPngWithAlpha = asset.path
                            .toLowerCase()
                            .match(/\.(png|apng)$/);
                        const pillarboxColor = isPngWithAlpha
                            ? "#00000000"
                            : fragment.objectFitContainPillarboxColor;
                        options.pillarbox = {
                            color: pillarboxColor,
                        };
                    }
                    currentVideoStream.fitOutputContain(this.output.resolution, options);
                }
            }
            // adding effects if needed (only for actual video, not synthetic blank video)
            if (asset.hasVideo) {
                // chromakey
                if (fragment.chromakey) {
                    currentVideoStream.chromakey({
                        blend: fragment.chromakeyBlend,
                        similarity: fragment.chromakeySimilarity,
                        color: fragment.chromakeyColor,
                    });
                }
                // visual filter (for video assets - images are filtered earlier before padding)
                if (fragment.visualFilter && asset.type !== "image") {
                    currentVideoStream.filter(fragment.visualFilter);
                }
            }
            // transitions
            if (fragment.transitionIn === "fade-in") {
                currentVideoStream.fade({
                    fades: [
                        {
                            type: "in",
                            startTime: 0,
                            duration: fragment.transitionInDuration,
                        },
                    ],
                });
                currentAudioStream.fade({
                    fades: [
                        {
                            type: "in",
                            startTime: 0,
                            duration: fragment.transitionInDuration,
                        },
                    ],
                });
            }
            if (fragment.transitionOut === "fade-out") {
                currentVideoStream.fade({
                    fades: [
                        {
                            type: "out",
                            startTime: effectiveDuration - fragment.transitionOutDuration,
                            duration: fragment.transitionOutDuration,
                        },
                    ],
                });
                currentAudioStream.fade({
                    fades: [
                        {
                            type: "out",
                            startTime: effectiveDuration - fragment.transitionOutDuration,
                            duration: fragment.transitionOutDuration,
                        },
                    ],
                });
            }
            // merging to the main streams
            if (!firstOne) {
                // attach current streams to the main ones, depending on the stated overlap
                if (calculatedOverlayLeft === 0) {
                    // just concat with the previous one, faster
                    this.videoStream.concatStream(currentVideoStream);
                    this.audioStream.concatStream(currentAudioStream);
                }
                else {
                    const otherStreamOffsetLeft = this.time + calculatedOverlayLeft;
                    // use overlay
                    this.videoStream.overlayStream(currentVideoStream, {
                        flipLayers: fragment.overlayZIndex < 0,
                        offset: {
                            streamDuration: this.time,
                            otherStreamDuration: effectiveDuration,
                            otherStreamOffsetLeft: otherStreamOffsetLeft,
                        },
                    });
                    this.audioStream.overlayStream(currentAudioStream, {
                        offset: {
                            streamDuration: this.time,
                            otherStreamDuration: effectiveDuration,
                            otherStreamOffsetLeft: otherStreamOffsetLeft,
                        },
                    });
                }
            }
            else {
                // here an overlay can only be positive
                if (calculatedOverlayLeft > 0) {
                    // padding video with a transparent fragment
                    currentVideoStream.tPad({
                        start: calculatedOverlayLeft,
                        startMode: "add",
                        color: "#00000000",
                    });
                    // padding audio with a slient fragment
                    currentAudioStream.tPad({
                        start: calculatedOverlayLeft,
                    });
                }
                else if (calculatedOverlayLeft < 0) {
                    throw new Error("overlay cannot be negative for the first fragment in a sequence (fragment id = " +
                        fragment.id +
                        ")");
                }
                this.videoStream = currentVideoStream;
                this.audioStream = currentAudioStream;
            }
            timeContext.start = this.time + calculatedOverlayLeft;
            timeContext.end = this.time + effectiveDuration + calculatedOverlayLeft;
            this.time += effectiveDuration + calculatedOverlayLeft;
            this.expressionContext.fragments.set(fragment.id, {
                time: timeContext,
            });
            // Collect debug info
            this.debugInfo.push({
                id: fragment.id,
                assetName: fragment.assetName,
                startTime: timeContext.start,
                endTime: timeContext.end,
                duration: effectiveDuration,
                trimLeft: calculatedTrimLeft,
                overlayLeft: calculatedOverlayLeft,
                enabled: fragment.enabled,
            });
            firstOne = false;
        });
    }
    isEmpty() {
        return !this.definition.fragments.some((fragment) => {
            if (!fragment.enabled) {
                return false;
            }
            // Check if fragment has a valid asset
            const asset = this.assetManager.getAssetByName(fragment.assetName);
            return !!asset;
        });
    }
    overlayWith(sequence) {
        // DON'T pass offset to overlayStream!
        // The first fragment of the overlaying sequence already has tPad applied in sequence.build()
        // (see lines 290-300 where we apply tPad for firstOne with calculatedOverlayLeft > 0)
        // Passing offset here would apply tPad TWICE, doubling the delay!
        this.videoStream.overlayStream(sequence.getVideoStream(), {});
        this.audioStream.overlayStream(sequence.getAudioStream(), {});
    }
    getVideoStream() {
        return this.videoStream;
    }
    getAudioStream() {
        return this.audioStream;
    }
    getDebugInfo() {
        return this.debugInfo;
    }
    getTotalDuration() {
        return this.time;
    }
}
exports.Sequence = Sequence;
//# sourceMappingURL=sequence.js.map