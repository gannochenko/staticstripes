"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stream = exports.FilterBuffer = exports.VisualFilter = exports.Colors = exports.ChromakeyBlend = exports.ChromakeySimilarity = exports.Direction = exports.AMBIENT = exports.PILLARBOX = void 0;
exports.makeStream = makeStream;
exports.makeSilentStream = makeSilentStream;
exports.makeBlankStream = makeBlankStream;
const ffmpeg_1 = require("./ffmpeg");
exports.PILLARBOX = 'pillarbox';
exports.AMBIENT = 'ambient';
var Direction;
(function (Direction) {
    Direction[Direction["CW"] = 0] = "CW";
    Direction[Direction["CW2"] = 1] = "CW2";
    Direction[Direction["CCW"] = 2] = "CCW";
    Direction[Direction["CCW2"] = 3] = "CCW2";
})(Direction || (exports.Direction = Direction = {}));
var ChromakeySimilarity;
(function (ChromakeySimilarity) {
    ChromakeySimilarity[ChromakeySimilarity["Strict"] = 0.1] = "Strict";
    ChromakeySimilarity[ChromakeySimilarity["Good"] = 0.3] = "Good";
    ChromakeySimilarity[ChromakeySimilarity["Forgiving"] = 0.5] = "Forgiving";
    ChromakeySimilarity[ChromakeySimilarity["Loose"] = 0.7] = "Loose";
})(ChromakeySimilarity || (exports.ChromakeySimilarity = ChromakeySimilarity = {}));
var ChromakeyBlend;
(function (ChromakeyBlend) {
    ChromakeyBlend[ChromakeyBlend["Hard"] = 0] = "Hard";
    ChromakeyBlend[ChromakeyBlend["Smooth"] = 0.1] = "Smooth";
    ChromakeyBlend[ChromakeyBlend["Soft"] = 0.2] = "Soft";
})(ChromakeyBlend || (exports.ChromakeyBlend = ChromakeyBlend = {}));
var Colors;
(function (Colors) {
    Colors["Transparent"] = "#00000000";
})(Colors || (exports.Colors = Colors = {}));
var VisualFilter;
(function (VisualFilter) {
    VisualFilter["InstagramClarendon"] = "instagram-clarendon";
    VisualFilter["InstagramGingham"] = "instagram-gingham";
    VisualFilter["InstagramJuno"] = "instagram-juno";
    VisualFilter["InstagramLark"] = "instagram-lark";
    VisualFilter["InstagramLudwig"] = "instagram-ludwig";
    VisualFilter["InstagramNashville"] = "instagram-nashville";
    VisualFilter["InstagramValencia"] = "instagram-valencia";
    VisualFilter["InstagramXProII"] = "instagram-xpro2";
    VisualFilter["InstagramWillow"] = "instagram-willow";
    VisualFilter["InstagramLoFi"] = "instagram-lofi";
    VisualFilter["InstagramInkwell"] = "instagram-inkwell";
    VisualFilter["InstagramMoon"] = "instagram-moon";
    VisualFilter["InstagramHudson"] = "instagram-hudson";
    VisualFilter["InstagramToaster"] = "instagram-toaster";
    VisualFilter["InstagramWalden"] = "instagram-walden";
    VisualFilter["InstagramRise"] = "instagram-rise";
    VisualFilter["InstagramAmaro"] = "instagram-amaro";
    VisualFilter["InstagramMayfair"] = "instagram-mayfair";
    VisualFilter["InstagramEarlybird"] = "instagram-earlybird";
    VisualFilter["InstagramSutro"] = "instagram-sutro";
    VisualFilter["InstagramAden"] = "instagram-aden";
    VisualFilter["InstagramCrema"] = "instagram-crema";
})(VisualFilter || (exports.VisualFilter = VisualFilter = {}));
class FilterBuffer {
    filters = [];
    append(filter) {
        this.filters.push(filter);
    }
    render() {
        return this.filters.map((filter) => filter.render()).join(';');
    }
}
exports.FilterBuffer = FilterBuffer;
function makeStream(label, buf) {
    return new Stream(label, buf);
}
function makeSilentStream(duration, buf) {
    const filter = (0, ffmpeg_1.makeAnullsrc)({ duration });
    buf.append(filter);
    return new Stream(filter.outputs[0], buf);
}
function makeBlankStream(duration, width, height, fps, buf) {
    const filter = (0, ffmpeg_1.makeColor)({
        duration,
        width,
        height,
        fps,
        color: '#00000000',
    });
    buf.append(filter);
    return new Stream(filter.outputs[0], buf);
}
class Stream {
    looseEnd;
    buf;
    constructor(looseEnd, buf) {
        this.looseEnd = looseEnd;
        this.buf = buf;
    }
    trim(start, end) {
        const res = (0, ffmpeg_1.makeTrim)([this.looseEnd], start, end);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    fitOutputSimple(dimensions) {
        // Step 1: Scale video to fit within dimensions while maintaining aspect ratio
        // Using 'force_original_aspect_ratio=decrease' ensures the video fits inside the box
        const scaleRes = (0, ffmpeg_1.makeScale)([this.looseEnd], {
            width: dimensions.width,
            height: dimensions.height,
            flags: 'force_original_aspect_ratio=decrease',
        });
        this.looseEnd = scaleRes.outputs[0];
        this.buf.append(scaleRes);
        // Step 2: Pad to exact dimensions with black bars (centered)
        const padRes = (0, ffmpeg_1.makePad)([this.looseEnd], {
            width: dimensions.width,
            height: dimensions.height,
            // x and y default to '(ow-iw)/2' and '(oh-ih)/2' which centers the video
        });
        this.looseEnd = padRes.outputs[0];
        this.buf.append(padRes);
        return this;
    }
    fitOutputCover(dimensions) {
        // Step 1: Scale video to cover dimensions while maintaining aspect ratio
        // Using 'force_original_aspect_ratio=increase' ensures the video fills the entire box
        const scaleRes = (0, ffmpeg_1.makeScale)([this.looseEnd], {
            width: dimensions.width,
            height: dimensions.height,
            flags: 'force_original_aspect_ratio=increase',
        });
        this.looseEnd = scaleRes.outputs[0];
        this.buf.append(scaleRes);
        // Step 2: Crop to exact dimensions (centered)
        const cropRes = (0, ffmpeg_1.makeCrop)([this.looseEnd], {
            width: dimensions.width,
            height: dimensions.height,
            // x and y default to '(in_w-out_w)/2' and '(in_h-out_h)/2' which centers the crop
        });
        this.looseEnd = cropRes.outputs[0];
        this.buf.append(cropRes);
        return this;
    }
    fitOutputContain(dimensions, options = {}) {
        if (options.ambient) {
            const blurStrength = options.ambient?.blurStrength ?? 20;
            const brightness = options.ambient?.brightness ?? -0.3;
            const saturation = options.ambient?.saturation ?? 0.8;
            // Split input into 2 streams: background and foreground
            const splitRes = (0, ffmpeg_1.makeSplit)([this.looseEnd]);
            this.buf.append(splitRes);
            const [bgLabel, fgLabel] = splitRes.outputs;
            // // Background stream: cover + blur + darken
            const bgScaleRes = (0, ffmpeg_1.makeScale)([bgLabel], {
                width: dimensions.width,
                height: dimensions.height,
                flags: 'force_original_aspect_ratio=increase',
            });
            this.buf.append(bgScaleRes);
            const bgCropRes = (0, ffmpeg_1.makeCrop)(bgScaleRes.outputs, {
                width: dimensions.width,
                height: dimensions.height,
            });
            this.buf.append(bgCropRes);
            const bgBlurRes = (0, ffmpeg_1.makeGblur)(bgCropRes.outputs, {
                sigma: blurStrength,
                steps: 2,
            });
            this.buf.append(bgBlurRes);
            const bgFinal = (0, ffmpeg_1.makeEq)(bgBlurRes.outputs, {
                brightness,
                saturation,
            });
            this.buf.append(bgFinal);
            ////////////////////////////////////////////////////////////////////////////////////
            const fgScale = (0, ffmpeg_1.makeScale)([fgLabel], {
                width: dimensions.width,
                height: dimensions.height,
                flags: 'force_original_aspect_ratio=decrease',
            });
            this.buf.append(fgScale);
            // Step 2: Pad to exact dimensions with black bars (centered)
            const fgFinal = (0, ffmpeg_1.makePad)(fgScale.outputs, {
                width: dimensions.width,
                height: dimensions.height,
                color: '#00000000', // transparent
                // x and y default to '(ow-iw)/2' and '(oh-ih)/2' which centers the video
            });
            this.buf.append(fgFinal);
            ////////////////////////////////////////////////////////////////////////////////////
            // Overlay foreground centered on background
            // (W-w)/2 and (H-h)/2 center the overlay on the background
            const overlayRes = (0, ffmpeg_1.makeOverlay)([bgFinal.outputs[0], fgFinal.outputs[0]], {
                x: '(W-w)/2',
                y: '(H-h)/2',
            });
            this.buf.append(overlayRes);
            this.looseEnd = overlayRes.outputs[0];
        }
        else {
            // usual pillarbox
            const color = options?.pillarbox?.color ?? '#000000';
            const scaleRes = (0, ffmpeg_1.makeScale)([this.looseEnd], {
                width: dimensions.width,
                height: dimensions.height,
                flags: 'force_original_aspect_ratio=decrease',
            });
            this.looseEnd = scaleRes.outputs[0];
            this.buf.append(scaleRes);
            // Step 2: Pad to exact dimensions with black bars (centered)
            const padRes = (0, ffmpeg_1.makePad)([this.looseEnd], {
                width: dimensions.width,
                height: dimensions.height,
                color: color,
                // x and y default to '(ow-iw)/2' and '(oh-ih)/2' which centers the video
            });
            this.looseEnd = padRes.outputs[0];
            this.buf.append(padRes);
        }
        return this;
    }
    chromakey(parameters) {
        // Apply chromakey filter
        const chromakeyRes = (0, ffmpeg_1.makeChromakey)([this.looseEnd], {
            color: parameters.color,
            similarity: parameters.similarity,
            blend: parameters.blend,
        });
        this.looseEnd = chromakeyRes.outputs[0];
        this.buf.append(chromakeyRes);
        return this;
    }
    kenBurns(parameters) {
        // Apply Ken Burns effect
        const kenBurnsRes = (0, ffmpeg_1.makeKenBurns)([this.looseEnd], {
            effect: parameters.effect,
            zoom: parameters.zoom,
            effectDuration: parameters.effectDuration,
            fragmentDuration: parameters.fragmentDuration,
            easing: parameters.easing,
            width: parameters.width,
            height: parameters.height,
            fps: parameters.fps,
            focalX: parameters.focalX,
            focalY: parameters.focalY,
            panStartX: parameters.panStartX,
            panStartY: parameters.panStartY,
            panEndX: parameters.panEndX,
            panEndY: parameters.panEndY,
        });
        this.looseEnd = kenBurnsRes.outputs[0];
        this.buf.append(kenBurnsRes);
        return this;
    }
    fps(value) {
        const res = (0, ffmpeg_1.makeFps)([this.looseEnd], value);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    convertPixelFormat(format) {
        const res = (0, ffmpeg_1.makeFormat)([this.looseEnd], format);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    blur(strength) {
        const res = (0, ffmpeg_1.makeGblur)([this.looseEnd], {
            sigma: strength,
        });
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    fade(options) {
        const res = (0, ffmpeg_1.makeFade)([this.looseEnd], options);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    transpose(value) {
        const res = (0, ffmpeg_1.makeTranspose)([this.looseEnd], value);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    cwRotate(direction) {
        switch (direction) {
            case Direction.CW:
                // 90° clockwise: transpose=1
                this.transpose(1);
                break;
            case Direction.CCW:
                // 90° counterclockwise: transpose=2
                this.transpose(2);
                break;
            case Direction.CW2:
            case Direction.CCW2:
                // 180° rotation (same for both directions): hflip + vflip
                const hflipRes = (0, ffmpeg_1.makeHflip)([this.looseEnd]);
                this.looseEnd = hflipRes.outputs[0];
                this.buf.append(hflipRes);
                const vflipRes = (0, ffmpeg_1.makeVflip)([this.looseEnd]);
                this.looseEnd = vflipRes.outputs[0];
                this.buf.append(vflipRes);
                break;
        }
        return this;
    }
    concatStream(stream) {
        return this.concatStreams([stream]);
    }
    concatStreams(streams) {
        // todo: check streams type here, it can either be all audio or all video
        const res = (0, ffmpeg_1.makeConcat)([
            this.looseEnd,
            ...streams.map((st) => st.getLooseEnd()),
        ]);
        this.looseEnd = res.outputs[0];
        if (res.outputs.length > 1) {
            throw new Error('concat produced several outputs, possible mixup between video and audio streams');
        }
        this.buf.append(res);
        return this;
    }
    mixStream(stream, options) {
        return this.mixStreams([stream], options);
    }
    mixStreams(streams, options) {
        const res = (0, ffmpeg_1.makeAmix)([this.looseEnd, ...streams.map((st) => st.getLooseEnd())], options);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    tPad(options = {}) {
        const res = (0, ffmpeg_1.makeTPad)([this.looseEnd], options);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    /*
    this stream becomes the bottom layer, and the joining stream - top layer
    For video: uses overlay filter
    For audio: uses amix filter
    */
    overlayStream(stream, options) {
        const offset = options.offset;
        const flip = !!options.flipLayers;
        const isAudio = this.looseEnd.isAudio;
        // Validate that both streams are of the same type
        if (isAudio !== stream.getLooseEnd().isAudio) {
            throw new Error('overlayStream: both streams must be of the same type (both video or both audio)');
        }
        if (!offset || !offset.otherStreamOffsetLeft) {
            // usual overlay/mix, no offset
            if (isAudio) {
                const res = (0, ffmpeg_1.makeAmix)([this.looseEnd, stream.getLooseEnd()], {
                    normalize: false,
                });
                this.looseEnd = res.outputs[0];
                this.buf.append(res);
            }
            else {
                const res = (0, ffmpeg_1.makeOverlay)(flip
                    ? [stream.getLooseEnd(), this.looseEnd]
                    : [this.looseEnd, stream.getLooseEnd()]);
                this.looseEnd = res.outputs[0];
                this.buf.append(res);
            }
        }
        else {
            if (offset.streamDuration === undefined) {
                throw new Error('exact duration of the fragment in the stream must be provided');
            }
            if (offset.otherStreamDuration === undefined) {
                throw new Error('exact duration of the fragment in the joining stream must be provided');
            }
            const offsetLeft = offset.otherStreamOffsetLeft;
            console.log(`🔍 [overlayStream] offset.otherStreamOffsetLeft = ${offsetLeft}, offset.streamDuration = ${offset.streamDuration}, offset.otherStreamDuration = ${offset.otherStreamDuration}`);
            if (offsetLeft > 0) {
                // Pad the joining stream on the left with transparent frames
                // offsetLeft is in seconds, convert to milliseconds
                console.log(`🔍 [overlayStream] Applying offset padding: ${offsetLeft}s = ${offsetLeft * 1000}ms, mode=clone (default), color=transparent`);
                stream.tPad({
                    start: offsetLeft * 1000,
                    // NO startMode - defaults to 'clone' which preserves the last frame
                    ...(isAudio ? {} : { color: Colors.Transparent }),
                });
                // Pad the main stream on the right if needed
                const mainLeftover = offset.otherStreamDuration + offsetLeft - offset.streamDuration;
                if (mainLeftover > 0) {
                    this.tPad({
                        stop: mainLeftover,
                        ...(isAudio ? {} : { color: Colors.Transparent }),
                    });
                }
                // Mix or overlay the streams
                if (isAudio) {
                    const res = (0, ffmpeg_1.makeAmix)([this.looseEnd, stream.getLooseEnd()], {
                        normalize: false,
                    });
                    this.looseEnd = res.outputs[0];
                    this.buf.append(res);
                }
                else {
                    const overlayRes = (0, ffmpeg_1.makeOverlay)(flip
                        ? [stream.getLooseEnd(), this.looseEnd]
                        : [this.looseEnd, stream.getLooseEnd()]);
                    this.looseEnd = overlayRes.outputs[0];
                    this.buf.append(overlayRes);
                }
            }
            else if (offsetLeft < 0) {
                throw new Error('negative offset is not supported for overlayStream');
            }
        }
        return this;
    }
    endTo(label) {
        const res = (0, ffmpeg_1.makeNull)([this.looseEnd]);
        res.outputs[0] = label;
        this.buf.append(res);
        return this;
    }
    /**
     * Applies an Instagram-style filter to the video stream
     * @param filterName - The filter to apply
     */
    filter(filterName) {
        if (this.looseEnd.isAudio) {
            throw new Error('filter() can only be applied to video streams');
        }
        switch (filterName) {
            case VisualFilter.InstagramClarendon:
                // Brightens, increases contrast and saturation
                const clarendonEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.2,
                    brightness: 0.1,
                    saturation: 1.3,
                });
                this.looseEnd = clarendonEq.outputs[0];
                this.buf.append(clarendonEq);
                break;
            case VisualFilter.InstagramGingham:
                // Vintage washed-out look
                const ginghamEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    saturation: 0.6,
                    brightness: 0.05,
                });
                this.looseEnd = ginghamEq.outputs[0];
                this.buf.append(ginghamEq);
                const ginghamBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.1,
                    bm: 0.05,
                });
                this.looseEnd = ginghamBalance.outputs[0];
                this.buf.append(ginghamBalance);
                break;
            case VisualFilter.InstagramJuno:
                // High contrast, saturated, cool tones
                const junoEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.3,
                    saturation: 1.4,
                });
                this.looseEnd = junoEq.outputs[0];
                this.buf.append(junoEq);
                const junoBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    bh: 0.15,
                    gh: 0.1,
                });
                this.looseEnd = junoBalance.outputs[0];
                this.buf.append(junoBalance);
                break;
            case VisualFilter.InstagramLark:
                // Brightens, desaturated, cool tones
                const larkEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    brightness: 0.15,
                    saturation: 0.7,
                });
                this.looseEnd = larkEq.outputs[0];
                this.buf.append(larkEq);
                const larkBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    bm: 0.1,
                });
                this.looseEnd = larkBalance.outputs[0];
                this.buf.append(larkBalance);
                break;
            case VisualFilter.InstagramLudwig:
                // Cool tones, subtle vignette
                const ludwigBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    bm: 0.08,
                    bs: 0.05,
                });
                this.looseEnd = ludwigBalance.outputs[0];
                this.buf.append(ludwigBalance);
                const ludwigVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4',
                });
                this.looseEnd = ludwigVignette.outputs[0];
                this.buf.append(ludwigVignette);
                break;
            case VisualFilter.InstagramNashville:
                // Warm vintage, pink tint, vignette
                const nashvilleBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.2,
                    rh: 0.1,
                    bm: -0.1,
                });
                this.looseEnd = nashvilleBalance.outputs[0];
                this.buf.append(nashvilleBalance);
                const nashvilleEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 0.9,
                    saturation: 1.2,
                });
                this.looseEnd = nashvilleEq.outputs[0];
                this.buf.append(nashvilleEq);
                const nashvilleVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4.5',
                });
                this.looseEnd = nashvilleVignette.outputs[0];
                this.buf.append(nashvilleVignette);
                break;
            case VisualFilter.InstagramValencia:
                // Warm tones, slight fade
                const valenciaBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.15,
                    gm: 0.05,
                });
                this.looseEnd = valenciaBalance.outputs[0];
                this.buf.append(valenciaBalance);
                const valenciaEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 0.95,
                    brightness: 0.05,
                });
                this.looseEnd = valenciaEq.outputs[0];
                this.buf.append(valenciaEq);
                break;
            case VisualFilter.InstagramXProII:
                // High contrast, warm highlights, cool shadows, vignette
                const xproBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rh: 0.2,
                    bs: 0.15,
                });
                this.looseEnd = xproBalance.outputs[0];
                this.buf.append(xproBalance);
                const xproEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.4,
                    saturation: 1.2,
                });
                this.looseEnd = xproEq.outputs[0];
                this.buf.append(xproEq);
                const xproVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4',
                });
                this.looseEnd = xproVignette.outputs[0];
                this.buf.append(xproVignette);
                break;
            case VisualFilter.InstagramWillow:
                // Black and white-ish, desaturated, slight yellow tint
                const willowEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    saturation: 0.2,
                    brightness: 0.05,
                });
                this.looseEnd = willowEq.outputs[0];
                this.buf.append(willowEq);
                const willowBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.05,
                    gm: 0.05,
                });
                this.looseEnd = willowBalance.outputs[0];
                this.buf.append(willowBalance);
                break;
            case VisualFilter.InstagramLoFi:
                // High contrast, high saturation, vignette
                const lofiEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.5,
                    saturation: 1.4,
                });
                this.looseEnd = lofiEq.outputs[0];
                this.buf.append(lofiEq);
                const lofiVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4',
                });
                this.looseEnd = lofiVignette.outputs[0];
                this.buf.append(lofiVignette);
                break;
            case VisualFilter.InstagramInkwell:
                // Classic black and white
                const inkwellEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    saturation: 0,
                    contrast: 1.1,
                });
                this.looseEnd = inkwellEq.outputs[0];
                this.buf.append(inkwellEq);
                break;
            case VisualFilter.InstagramMoon:
                // Black and white with high contrast and cool tone
                const moonEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    saturation: 0,
                    contrast: 1.4,
                    brightness: -0.05,
                });
                this.looseEnd = moonEq.outputs[0];
                this.buf.append(moonEq);
                const moonBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    bs: 0.1,
                    bm: 0.08,
                });
                this.looseEnd = moonBalance.outputs[0];
                this.buf.append(moonBalance);
                const moonVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4.5',
                });
                this.looseEnd = moonVignette.outputs[0];
                this.buf.append(moonVignette);
                break;
            case VisualFilter.InstagramHudson:
                // Cool tones, high contrast, vignette
                const hudsonBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    bm: 0.2,
                    bs: 0.15,
                });
                this.looseEnd = hudsonBalance.outputs[0];
                this.buf.append(hudsonBalance);
                const hudsonEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.3,
                });
                this.looseEnd = hudsonEq.outputs[0];
                this.buf.append(hudsonEq);
                const hudsonVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4.5',
                });
                this.looseEnd = hudsonVignette.outputs[0];
                this.buf.append(hudsonVignette);
                break;
            case VisualFilter.InstagramToaster:
                // Warm tones, vignette
                const toasterBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.25,
                    rh: 0.15,
                });
                this.looseEnd = toasterBalance.outputs[0];
                this.buf.append(toasterBalance);
                const toasterEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.2,
                });
                this.looseEnd = toasterEq.outputs[0];
                this.buf.append(toasterEq);
                const toasterVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4',
                });
                this.looseEnd = toasterVignette.outputs[0];
                this.buf.append(toasterVignette);
                break;
            case VisualFilter.InstagramWalden:
                // Increased exposure, yellow tones
                const waldenBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.1,
                    gm: 0.1,
                });
                this.looseEnd = waldenBalance.outputs[0];
                this.buf.append(waldenBalance);
                const waldenEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    brightness: 0.15,
                    saturation: 1.1,
                });
                this.looseEnd = waldenEq.outputs[0];
                this.buf.append(waldenEq);
                break;
            case VisualFilter.InstagramRise:
                // Soft, warm glow
                const riseBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.12,
                    rh: 0.08,
                });
                this.looseEnd = riseBalance.outputs[0];
                this.buf.append(riseBalance);
                const riseEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    brightness: 0.1,
                    contrast: 0.9,
                    saturation: 1.15,
                });
                this.looseEnd = riseEq.outputs[0];
                this.buf.append(riseEq);
                break;
            case VisualFilter.InstagramAmaro:
                // Increases contrast, adds vignette, cool tone
                const amaroBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    bm: 0.1,
                });
                this.looseEnd = amaroBalance.outputs[0];
                this.buf.append(amaroBalance);
                const amaroEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.3,
                    saturation: 1.2,
                });
                this.looseEnd = amaroEq.outputs[0];
                this.buf.append(amaroEq);
                const amaroVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4.5',
                });
                this.looseEnd = amaroVignette.outputs[0];
                this.buf.append(amaroVignette);
                break;
            case VisualFilter.InstagramMayfair:
                // Warm center, cool edges, vignette
                const mayfairBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rh: 0.15,
                    bs: 0.1,
                });
                this.looseEnd = mayfairBalance.outputs[0];
                this.buf.append(mayfairBalance);
                const mayfairEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.1,
                    saturation: 1.15,
                });
                this.looseEnd = mayfairEq.outputs[0];
                this.buf.append(mayfairEq);
                const mayfairVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4',
                });
                this.looseEnd = mayfairVignette.outputs[0];
                this.buf.append(mayfairVignette);
                break;
            case VisualFilter.InstagramEarlybird:
                // Vintage sepia, vignette
                const earlybirdBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.2,
                    gm: 0.1,
                    bm: -0.15,
                });
                this.looseEnd = earlybirdBalance.outputs[0];
                this.buf.append(earlybirdBalance);
                const earlybirdEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    contrast: 1.2,
                    saturation: 1.1,
                });
                this.looseEnd = earlybirdEq.outputs[0];
                this.buf.append(earlybirdEq);
                const earlybirdVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/4',
                });
                this.looseEnd = earlybirdVignette.outputs[0];
                this.buf.append(earlybirdVignette);
                break;
            case VisualFilter.InstagramSutro:
                // Muted colors, purple/brown tint, vignette
                const sutroBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.1,
                    bm: 0.15,
                });
                this.looseEnd = sutroBalance.outputs[0];
                this.buf.append(sutroBalance);
                const sutroEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    saturation: 0.8,
                    contrast: 1.2,
                });
                this.looseEnd = sutroEq.outputs[0];
                this.buf.append(sutroEq);
                const sutroVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/3.5',
                });
                this.looseEnd = sutroVignette.outputs[0];
                this.buf.append(sutroVignette);
                break;
            case VisualFilter.InstagramAden:
                // Muted, cool tones, slight vignette
                const adenBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    bm: 0.12,
                });
                this.looseEnd = adenBalance.outputs[0];
                this.buf.append(adenBalance);
                const adenEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    saturation: 0.85,
                    brightness: 0.08,
                });
                this.looseEnd = adenEq.outputs[0];
                this.buf.append(adenEq);
                const adenVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/5',
                });
                this.looseEnd = adenVignette.outputs[0];
                this.buf.append(adenVignette);
                break;
            case VisualFilter.InstagramCrema:
                // Creamy warmth, slight vignette
                const cremaBalance = (0, ffmpeg_1.makeColorBalance)([this.looseEnd], {
                    rm: 0.08,
                    gm: 0.05,
                });
                this.looseEnd = cremaBalance.outputs[0];
                this.buf.append(cremaBalance);
                const cremaEq = (0, ffmpeg_1.makeEq)([this.looseEnd], {
                    brightness: 0.05,
                    contrast: 0.95,
                });
                this.looseEnd = cremaEq.outputs[0];
                this.buf.append(cremaEq);
                const cremaVignette = (0, ffmpeg_1.makeVignette)([this.looseEnd], {
                    angle: 'PI/5',
                });
                this.looseEnd = cremaVignette.outputs[0];
                this.buf.append(cremaVignette);
                break;
            default:
                throw new Error(`Unknown Instagram filter: ${filterName}`);
        }
        return this;
    }
    volume(percent) {
        const res = (0, ffmpeg_1.makeVolume)([this.looseEnd], percent);
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    drawTimecode(text, options = {}) {
        const res = (0, ffmpeg_1.makeDrawtext)([this.looseEnd], { text, ...options });
        this.looseEnd = res.outputs[0];
        this.buf.append(res);
        return this;
    }
    getLooseEnd() {
        return this.looseEnd;
    }
    render() {
        return this.buf.render();
    }
}
exports.Stream = Stream;
//# sourceMappingURL=stream.js.map