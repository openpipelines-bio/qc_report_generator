/**
 * PROGRESSIVE CHART COMPONENTS  
 * =============================
 * 
 * Use these components for CUSTOM DATA WORKFLOWS and complex data sources.
 * Perfect for pre-computed data, aggregations, and multi-source integrations.
 * 
 * WHEN TO USE:
 * ✅ Pre-computed or aggregated data
 * ✅ Non-columnar data structures (JSON, computed metrics, etc.)
 * ✅ Cross-category analysis (combining multiple datasets)
 * ✅ External APIs or custom data transformations
 * ✅ Real-time calculations or dynamic aggregations
 * 
 * COMPONENTS:
 * - ProgressiveWrapper: General-purpose wrapper with optional custom loading
 * - AggregatedChart: Specialized for pre-computed aggregations
 * - MultiSourceChart: Combines data from multiple sources
 * 
 * FLEXIBILITY BENEFITS:
 * - Maximum flexibility for any data source
 * - Custom loading and transformation pipelines
 * - Multi-source data integration
 * - Real-time computation support
 */

import { JSX, Show, createSignal, onMount } from 'solid-js';
import { createViewportLoader, ChartPlaceholder, ChartErrorBoundary } from '../lib/progressive-loading';

/**
 * Progressive chart wrapper for pre-computed or custom data sources
 * Use this when:
 * - Data is already processed/aggregated
 * - Working with non-columnar data structures  
 * - Combining data from multiple sources
 * - Using external APIs or computed datasets
 * - Pre-computed summaries or rollups
 * 
 * @example
 * // Simple wrapper for pre-loaded data
 * <ProgressiveWrapper title="Sample Distribution">
 *   <BarChart data={preComputedData} />
 * </ProgressiveWrapper>
 * 
 * @example
 * // With custom data loading
 * <ProgressiveWrapper
 *   title="QC Summary"
 *   dataLoader={async () => {
 *     const rawData = await fetchQcData();
 *     return computeQcSummary(rawData);
 *   }}
 * >
 *   {(summaryData) => <SummaryDashboard data={summaryData} />}
 * </ProgressiveWrapper>
 * 
 * @example
 * // Cross-sample comparison
 * <ProgressiveWrapper
 *   title="Sample Comparison"
 *   loadingMessage="Computing cross-sample metrics..."
 *   dataLoader={async () => {
 *     const samples = getSelectedSamples();
 *     return await computeSampleComparison(samples);
 *   }}
 * >
 *   {(comparison) => <ComparisonChart data={comparison} />}
 * </ProgressiveWrapper>
 */

interface ProgressiveWrapperProps {
  title: string;
  height?: string;
  loadingMessage?: string;
  // Optional custom data loader - if not provided, renders children immediately
  dataLoader?: () => Promise<any>;
  children: JSX.Element | ((data?: any) => JSX.Element);
}

export function ProgressiveWrapper(props: ProgressiveWrapperProps): JSX.Element {
  // If no custom data loader, use viewport loading with immediate rendering
  if (!props.dataLoader) {
    const { setElement } = createViewportLoader(
      async () => null, // No actual loading needed
      { threshold: 0.1 }
    );
    
    return (
      <div ref={setElement}>
        {typeof props.children === 'function' ? props.children() : props.children}
      </div>
    );
  }

  // Custom data loading with viewport trigger
  const { data, loading, error, setElement } = createViewportLoader(
    props.dataLoader,
    { threshold: 0.1 }
  );

  const retryLoad = () => {
    window.location.reload(); // Simple retry for now
  };

  return (
    <div ref={setElement}>
      <Show
        when={!error()}
        fallback={
          <ChartErrorBoundary 
            error={error()!} 
            title={props.title}
            onRetry={retryLoad}
          />
        }
      >
        <Show
          when={data() !== null}
          fallback={
            <ChartPlaceholder title={props.title} height={props.height}>
              {props.loadingMessage && (
                <div class="text-xs text-gray-400 mt-2">
                  {props.loadingMessage}
                </div>
              )}
            </ChartPlaceholder>
          }
        >
          {typeof props.children === 'function' ? props.children(data()) : props.children}
        </Show>
      </Show>
    </div>
  );
}

/**
 * Specialized wrapper for pre-computed aggregations
 * 
 * @example
 * // QC metrics overview across all samples
 * <AggregatedChart
 *   title="QC Metrics Overview"
 *   aggregationFn={async () => {
 *     const allSamples = await getAllSamples();
 *     return {
 *       totalCells: allSamples.reduce((sum, s) => sum + s.cellCount, 0),
 *       averageQuality: computeAverageQuality(allSamples),
 *       qualityDistribution: computeQualityDistribution(allSamples),
 *       failureReasons: analyzeFailures(allSamples)
 *     };
 *   }}
 * >
 *   {(overview) => (
 *     <div>
 *       <MetricsSummary metrics={overview} />
 *       <QualityDistributionChart data={overview.qualityDistribution} />
 *       <FailureAnalysis data={overview.failureReasons} />
 *     </div>
 *   )}
 * </AggregatedChart>
 * 
 * @example
 * // Dynamic filtering aggregation
 * <AggregatedChart
 *   title="Filtered Sample Stats"
 *   aggregationFn={async () => {
 *     const filteredData = applyCurrentFilters(rawData);
 *     return computeFilteredStatistics(filteredData);
 *   }}
 * >
 *   {(stats) => <FilteredStatsTable data={stats} />}
 * </AggregatedChart>
 */
interface AggregatedChartProps {
  title: string;
  height?: string;
  aggregationFn: () => Promise<any>;
  children: (aggregatedData: any) => JSX.Element;
}

export function AggregatedChart(props: AggregatedChartProps): JSX.Element {
  return (
    <ProgressiveWrapper
      title={props.title}
      height={props.height}
      loadingMessage="Computing aggregations..."
      dataLoader={props.aggregationFn}
    >
      {(data) => props.children(data)}
    </ProgressiveWrapper>
  );
}

/**
 * Wrapper for charts that combine multiple data sources
 * 
 * @example
 * // Multi-omics integration
 * <MultiSourceChart
 *   title="Integrated Multi-omics Analysis"
 *   dataSources={[
 *     async () => await loadRnaData(selectedSamples),
 *     async () => await loadProteinData(selectedSamples),
 *     async () => await loadSpatialData(selectedSamples)
 *   ]}
 *   combiner={(sources) => {
 *     const [rna, protein, spatial] = sources;
 *     return integrateOmicsData({
 *       rna: rna,
 *       protein: protein,
 *       spatial: spatial,
 *       alignment: computeCellAlignment(rna, protein, spatial)
 *     });
 *   }}
 * >
 *   {(integrated) => (
 *     <div>
 *       <OmicsOverview data={integrated} />
 *       <IntegratedScatterPlot data={integrated} />
 *       <CrossModalityCorrelation data={integrated} />
 *     </div>
 *   )}
 * </MultiSourceChart>
 * 
 * @example
 * // Cross-category QC analysis
 * <MultiSourceChart
 *   title="Comprehensive QC Dashboard"
 *   dataSources={[
 *     () => getCellMetrics(),
 *     () => getGeneMetrics(), 
 *     () => getSampleMetadata(),
 *     () => getQcThresholds()
 *   ]}
 *   combiner={([cells, genes, samples, thresholds]) => {
 *     return createQcDashboardData(cells, genes, samples, thresholds);
 *   }}
 * >
 *   {(qcData) => <ComprehensiveQcDashboard data={qcData} />}
 * </MultiSourceChart>
 * 
 * @example
 * // Time-series or batch comparison
 * <MultiSourceChart
 *   title="Batch Effect Analysis"
 *   dataSources={[
 *     () => getBatchMetadata(),
 *     () => getCurrentCellData(),
 *     () => getHistoricalBatches()
 *   ]}
 *   combiner={([metadata, current, historical]) => {
 *     return analyzeBatchEffects(metadata, current, historical);
 *   }}
 * >
 *   {(analysis) => <BatchEffectVisualization data={analysis} />}
 * </MultiSourceChart>
 */
interface MultiSourceChartProps {
  title: string;
  height?: string;
  dataSources: Array<() => Promise<any>>;
  combiner: (sources: any[]) => any;
  children: (combinedData: any) => JSX.Element;
}

export function MultiSourceChart(props: MultiSourceChartProps): JSX.Element {
  const loadCombinedData = async () => {
    const sourceData = await Promise.all(props.dataSources.map(loader => loader()));
    return props.combiner(sourceData);
  };

  return (
    <ProgressiveWrapper
      title={props.title}
      height={props.height}
      loadingMessage="Loading from multiple sources..."
      dataLoader={loadCombinedData}
    >
      {(data) => props.children(data)}
    </ProgressiveWrapper>
  );
}
