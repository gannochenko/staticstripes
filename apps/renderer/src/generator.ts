import { ProjectStructure, Sequence, Fragment } from './type';
import { makeConcat, makeXFade, makeCopy } from './ffmpeg';
import { StreamDAG } from './dag';

export function generateFilterComplex(project: ProjectStructure): string {
  if (project.sequences.length === 0) {
    return '';
  }

  const dag = new StreamDAG();

  // Process each sequence
  const sequenceOutputs: string[] = [];
  for (let seqIdx = 0; seqIdx < project.sequences.length; seqIdx++) {
    const sequence = project.sequences[seqIdx];
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

  return dag.render();
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
 */
function buildConcatGraph(
  dag: StreamDAG,
  fragments: Fragment[],
  assetIndexMap: Map<string, number>,
  outputLabel: string,
): void {
  const inputs = fragments.map((frag) => {
    const inputIndex = assetIndexMap.get(frag.assetName) ?? 0;
    return `${inputIndex}:v`;
  });
  dag.add(makeConcat(inputs, outputLabel));
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
    const inputs = [];
    for (let i = 0; i <= concatEnd; i++) {
      const inputIndex = assetIndexMap.get(fragments[i].assetName) ?? 0;
      inputs.push(`${inputIndex}:v`);
      timeOffset += fragments[i].duration;
    }
    currentLabel = dag.add(makeConcat(inputs, dag.label()));
    nextFragmentIndex = concatEnd + 1;
  } else {
    // Start with first fragment
    const firstInputIndex = assetIndexMap.get(fragments[0].assetName) ?? 0;
    currentLabel = `${firstInputIndex}:v`;
    timeOffset = fragments[0].duration;
    nextFragmentIndex = 1;
  }

  // Process remaining fragments with xfade
  while (nextFragmentIndex < fragments.length) {
    const currFragment = fragments[nextFragmentIndex];
    const inputIndex = assetIndexMap.get(currFragment.assetName) ?? 0;

    // Adjust offset for overlap (now only overlayLeft matters)
    timeOffset += currFragment.overlayLeft;

    const isLast = nextFragmentIndex === fragments.length - 1;
    const nextLabel = isLast ? outputLabel : dag.label();
    const transitionDuration = Math.abs(currFragment.overlayLeft) / 1000;

    currentLabel = dag.add(
      makeXFade(currentLabel, `${inputIndex}:v`, nextLabel, {
        duration: transitionDuration,
        offset: timeOffset / 1000,
      }),
    );

    timeOffset += currFragment.duration;
    nextFragmentIndex++;
  }
}
