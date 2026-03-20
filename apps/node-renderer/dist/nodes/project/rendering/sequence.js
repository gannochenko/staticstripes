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
            if (fragment.id === 'outro_message') {
                debugger;
            }
            const timeContext = {
                start: 0,
                end: 0,
                duration: calculatedDuration,
            };
            const asset = this.assetManager.getAssetByName(fragment.assetName);
            if (!asset) {
                return;
            }
            // Create video stream: use actual video if available, otherwise create blank stream
            let currentVideoStream;
            if (asset.hasVideo) {
                currentVideoStream = (0, stream_1.makeStream)(this.assetManager.getVideoInputLabelByAssetName(fragment.assetName), this.buf);
            }
            else {
                // Create blank transparent video stream for audio-only assets
                currentVideoStream = (0, stream_1.makeBlankStream)(calculatedDuration, this.output.resolution.width, this.output.resolution.height, this.output.fps, this.buf);
            }
            // Create audio stream: use actual audio if available, otherwise create silent stream
            // If fragment has -sound: off, always use silence
            let currentAudioStream;
            if (fragment.sound === 'off') {
                // Force silent audio when -sound: off
                currentAudioStream = (0, stream_1.makeSilentStream)(calculatedDuration, this.buf);
            }
            else if (asset.hasAudio) {
                currentAudioStream = (0, stream_1.makeStream)(this.assetManager.getAudioInputLabelByAssetName(fragment.assetName), this.buf);
            }
            else {
                // Create silent audio stream matching the video duration
                currentAudioStream = (0, stream_1.makeSilentStream)(calculatedDuration, this.buf);
            }
            // duration and clipping adjustment
            if (fragment.trimLeft != 0 || calculatedDuration < asset.duration) {
                // console.log('fragment.trimLeft=' + fragment.trimLeft);
                // console.log('fragment.duration=' + calculatedDuration);
                // console.log('asset.duration=' + asset.duration);
                // Only trim video if it came from an actual source
                if (asset.hasVideo) {
                    currentVideoStream.trim(fragment.trimLeft, fragment.trimLeft + calculatedDuration);
                }
                // Only trim audio if it came from an actual source AND sound is not off
                if (asset.hasAudio && fragment.sound !== 'off') {
                    currentAudioStream.trim(fragment.trimLeft, fragment.trimLeft + calculatedDuration);
                }
            }
            // Convert deprecated JPEG pixel format (yuvj420p) to standard yuv420p early
            // This prevents swscaler warnings from appearing in all subsequent filters
            if (asset.hasVideo && asset.type === 'image') {
                currentVideoStream.convertPixelFormat('yuv420p');
            }
            // Apply visual filter early for static images (before padding/cloning)
            // This is more efficient as ffmpeg processes the filter once, then clones the filtered frame
            if (asset.hasVideo &&
                asset.type === 'image' &&
                fragment.visualFilter) {
                currentVideoStream.filter(fragment.visualFilter);
            }
            if (asset.duration === 0 &&
                calculatedDuration > 0 &&
                asset.type === 'image' &&
                fragment.objectFit !== 'ken-burns') {
                // special case for images - extend static image to desired duration
                // Skip tpad for Ken Burns - zoompan will generate the frames
                currentVideoStream.tPad({
                    start: calculatedDuration,
                    startMode: 'clone',
                });
            }
            // stream normalization (only for actual video, not synthetic blank video)
            if (asset.hasVideo) {
                // fps reduction
                currentVideoStream.fps(this.output.fps);
                // fitting the video stream into the output frame
                if (fragment.objectFit === 'ken-burns') {
                    // Ken Burns effect (zoom/pan)
                    currentVideoStream.kenBurns({
                        effect: fragment.objectFitKenBurns,
                        zoom: fragment.objectFitKenBurnsZoom,
                        effectDuration: fragment.objectFitKenBurnsEffectDuration,
                        fragmentDuration: calculatedDuration,
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
                else if (fragment.objectFit === 'cover') {
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
                        options.pillarbox = {
                            color: fragment.objectFitContainPillarboxColor,
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
                if (fragment.visualFilter && asset.type !== 'image') {
                    currentVideoStream.filter(fragment.visualFilter);
                }
            }
            // transitions
            if (fragment.transitionIn === 'fade-in') {
                currentVideoStream.fade({
                    fades: [
                        {
                            type: 'in',
                            startTime: 0,
                            duration: fragment.transitionInDuration,
                        },
                    ],
                });
                currentAudioStream.fade({
                    fades: [
                        {
                            type: 'in',
                            startTime: 0,
                            duration: fragment.transitionInDuration,
                        },
                    ],
                });
            }
            if (fragment.transitionOut === 'fade-out') {
                currentVideoStream.fade({
                    fades: [
                        {
                            type: 'out',
                            startTime: calculatedDuration - fragment.transitionOutDuration,
                            duration: fragment.transitionOutDuration,
                        },
                    ],
                });
                currentAudioStream.fade({
                    fades: [
                        {
                            type: 'out',
                            startTime: calculatedDuration - fragment.transitionOutDuration,
                            duration: fragment.transitionOutDuration,
                        },
                    ],
                });
            }
            // console.log(
            //   'id=' +
            //     fragment.id +
            //     ' overlay=' +
            //     calculatedOverlayLeft +
            //     ' duration=' +
            //     fragment.duration,
            // );
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
                    // console.log('this.time=' + this.time);
                    // console.log('streamDuration=' + this.time);
                    // console.log('otherStreamDuration=' + calculatedDuration);
                    // console.log('otherStreamOffsetLeft=' + otherStreamOffsetLeft);
                    // use overlay
                    this.videoStream.overlayStream(currentVideoStream, {
                        flipLayers: fragment.overlayZIndex < 0,
                        offset: {
                            streamDuration: this.time,
                            otherStreamDuration: calculatedDuration,
                            otherStreamOffsetLeft: otherStreamOffsetLeft,
                        },
                    });
                    this.audioStream.overlayStream(currentAudioStream, {
                        offset: {
                            streamDuration: this.time,
                            otherStreamDuration: calculatedDuration,
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
                        startMode: 'add',
                        color: '#00000000',
                    });
                    // padding audio with a slient fragment
                    currentAudioStream.tPad({
                        start: calculatedOverlayLeft,
                    });
                }
                else if (calculatedOverlayLeft < 0) {
                    throw new Error('overlay cannot be negative for the first fragment in a sequence (fragment id = ' +
                        fragment.id +
                        ')');
                }
                // if (fragment.id === 'end_music') {
                //   console.log(
                //     this.expressionContext.fragments.get('ending_screen')!.time,
                //   );
                // }
                this.videoStream = currentVideoStream;
                this.audioStream = currentAudioStream;
            }
            timeContext.start = this.time + calculatedOverlayLeft;
            timeContext.end = this.time + calculatedDuration + calculatedOverlayLeft;
            this.time += calculatedDuration + calculatedOverlayLeft;
            this.expressionContext.fragments.set(fragment.id, {
                time: timeContext,
            });
            // Collect debug info
            this.debugInfo.push({
                id: fragment.id,
                assetName: fragment.assetName,
                startTime: timeContext.start,
                endTime: timeContext.end,
                duration: calculatedDuration,
                trimLeft: fragment.trimLeft,
                overlayLeft: calculatedOverlayLeft,
                enabled: fragment.enabled,
            });
            // console.log('new time=' + this.time);
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