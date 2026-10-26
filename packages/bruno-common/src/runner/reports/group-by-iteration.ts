import { getRunnerSummary } from '../runner-summary';

// Flat runner results (CLI shape) as the per-iteration list the HTML report renders.
// `iterationIndex` is only present on data-driven runs; without it the run is one
// iteration carrying the run's own summary, as the CLI reported it before iterations.
export const groupResultsByIteration = (results: any[], runSummary?: any) => {
  if (!results.some((result) => result.iterationIndex !== undefined)) {
    return [{ iterationIndex: 0, results, summary: runSummary ?? getRunnerSummary(results) }];
  }

  const groups = new Map<number, any[]>();
  results.forEach((result) => {
    const iterationIndex = result.iterationIndex ?? 0;
    groups.set(iterationIndex, [...(groups.get(iterationIndex) || []), result]);
  });

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([iterationIndex, iterationResults]) => ({
      iterationIndex,
      results: iterationResults,
      summary: getRunnerSummary(iterationResults)
    }));
};
