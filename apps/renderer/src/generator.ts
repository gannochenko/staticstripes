import { ProjectStructure, Sequence, Fragment } from './type';
import { makeConcat, makeXFade, makeCopy, makeFps, makeScale } from './filtercomplex';
import { StreamDAG } from './dag';

export function generateFilterComplex(project: ProjectStructure): string {
  const dag = buildDAG(project);
  return dag.render();
}

/**
 * Builds the StreamDAG from a project structure
 * Exposed for debugging and analysis
 */
export function buildDAG(project: ProjectStructure): StreamDAG {
  if (project.sequences.length === 0) {
    return new StreamDAG();
  }

  const dag = new StreamDAG();

  // Filter out audio-only sequences (sequences where all assets are audio-only)
  const videoSequences = project.sequences.filter((sequence) => {
    return sequence.fragments.some((fragment) => {
      const asset = project.assets.get(fragment.assetName);
      // Include if asset has video (video or image)
      return asset && (asset.type === 'video' || asset.type === 'image');
    });
  });

  if (videoSequences.length === 0) {
    console.warn('No video sequences found in project');
    return new StreamDAG();
  }

  // Process each video sequence
  const sequenceOutputs: string[] = [];
  for (let seqIdx = 0; seqIdx < videoSequences.length; seqIdx++) {
    const sequence = videoSequences[seqIdx];
    const outputLabel = dag.label();

    const output = generateSequenceGraph(
      dag,
      sequence,
      project.assetIndexMap,
      outputLabel,
    );
    sequenceOutputs.push(output);
  }

  // Connect all sequences with concat
  if (sequenceOutputs.length === 1) {
    // Single sequence, just copy to output
    dag.add(makeCopy(sequenceOutputs[0], 'outv'));
  } else {
    // Multiple sequences, concat them in time
    dag.add(makeConcat(sequenceOutputs, 'outv'));
  }

  return dag;
}

/**
 * Generates filter graph for a single sequence
 */
function generateSequenceGraph(
  dag: StreamDAG,
  sequence: Sequence,
  assetIndexMap: Map<string, number>,
  outputLabel: string,
): string {
  const { fragments } = sequence;

  if (fragments.length === 0) {
    return outputLabel;
  }

  if (fragments.length === 1) {
    // Single fragment, just copy it
    const fragment = fragments[0];
    const inputIndex = assetIndexMap.get(fragment.assetName) ?? 0;
    dag.add(makeCopy(`${inputIndex}:v`, outputLabel));
    return outputLabel;
  }

  // Check if we can use simple concat for all (no overlaps anywhere)
  const hasOverlaps = fragments.some((frag) => frag.overlayLeft !== 0);

  if (!hasOverlaps) {
    // Use concat filter for everything (faster)
    buildConcatGraph(dag, fragments, assetIndexMap, outputLabel);
  } else {
    // Mix of overlapping and non-overlapping: use hybrid approach
    buildHybridGraph(dag, fragments, assetIndexMap, outputLabel);
  }

  return outputLabel;
}

/**
 * Builds a graph with a single concat filter for all fragments
 * Adds scale and fps normalization to all inputs
 */
function buildConcatGraph(
  dag: StreamDAG,
  fragments: Fragment[],
  assetIndexMap: Map<string, number>,
  outputLabel: string,
): void {
  const normalizedInputs = fragments.map((frag) => {
    const inputIndex = assetIndexMap.get(frag.assetName) ?? 0;
    // Scale to output resolution
    const scaledLabel = dag.label();
    dag.add(makeScale(`${inputIndex}:v`, scaledLabel, { width: 1920, height: 1080 }));
    // Normalize FPS to match output
    const fpsLabel = dag.label();
    dag.add(makeFps(scaledLabel, fpsLabel, 30));
    return fpsLabel;
  });
  dag.add(makeConcat(normalizedInputs, outputLabel));
}

/**
 * Builds a hybrid graph: concat for non-overlapping prefix, xfade for the rest
 */
function buildHybridGraph(
  dag: StreamDAG,
  fragments: Fragment[],
  assetIndexMap: Map<string, number>,
  outputLabel: string,
): void {
  // Find the longest prefix of consecutive non-overlapping fragments
  let concatEnd = 0;
  for (let i = 0; i < fragments.length - 1; i++) {
    const hasOverlap = fragments[i + 1].overlayLeft !== 0;
    if (hasOverlap) {
      break;
    }
    concatEnd = i + 1;
  }

  let currentLabel = '';
  let timeOffset = 0;
  let nextFragmentIndex = 0;

  // If we have 2+ non-overlapping fragments at the start, concat them
  if (concatEnd >= 1) {
    const normalizedInputs = [];
    for (let i = 0; i <= concatEnd; i++) {
      const inputIndex = assetIndexMap.get(fragments[i].assetName) ?? 0;
      // Scale to output resolution
      const scaledLabel = dag.label();
      dag.add(makeScale(`${inputIndex}:v`, scaledLabel, { width: 1920, height: 1080 }));
      // Normalize FPS to match output
      const fpsLabel = dag.label();
      dag.add(makeFps(scaledLabel, fpsLabel, 30));
      normalizedInputs.push(fpsLabel);
      timeOffset += fragments[i].duration;
    }
    currentLabel = dag.label();
    dag.add(makeConcat(normalizedInputs, currentLabel));
    nextFragmentIndex = concatEnd + 1;
  } else {
    // Start with first fragment (scale it)
    const firstInputIndex = assetIndexMap.get(fragments[0].assetName) ?? 0;
    const scaledLabel = dag.label();
    dag.add(makeScale(`${firstInputIndex}:v`, scaledLabel, { width: 1920, height: 1080 }));
    // Normalize FPS and timebase before xfade
    currentLabel = dag.label();
    dag.add(makeFps(scaledLabel, currentLabel, 30));
    timeOffset = fragments[0].duration;
    nextFragmentIndex = 1;
  }

  // Process remaining fragments with xfade
  while (nextFragmentIndex < fragments.length) {
    const currFragment = fragments[nextFragmentIndex];
    const inputIndex = assetIndexMap.get(currFragment.assetName) ?? 0;

    // Scale and normalize FPS before xfade
    const scaledLabel = dag.label();
    dag.add(makeScale(`${inputIndex}:v`, scaledLabel, { width: 1920, height: 1080 }));
    const scaledInput = dag.label();
    dag.add(makeFps(scaledLabel, scaledInput, 30));

    // Adjust offset for overlap (now only overlayLeft matters)
    timeOffset += currFragment.overlayLeft;

    const isLast = nextFragmentIndex === fragments.length - 1;
    const nextLabel = isLast ? outputLabel : dag.label();
    const transitionDuration = Math.abs(currFragment.overlayLeft) / 1000;

    currentLabel = dag.add(
      makeXFade(currentLabel, scaledInput, nextLabel, {
        duration: transitionDuration,
        offset: timeOffset / 1000,
      }),
    );

    timeOffset += currFragment.duration;
    nextFragmentIndex++;
  }
}
