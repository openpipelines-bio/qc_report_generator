import Plot from "@ralphsmith80/solid-plotly.js";
import _ from "lodash";
import { Layout, PlotData } from "plotly.js-dist-min";
import { cutoffShape, plotlyConfig, recurringColours } from "~/lib/plots";
import { FilterSettings, RawDataCategory } from "~/types";

type Props = {
  data: RawDataCategory;
  filterSettings: FilterSettings;
  additionalAxes: boolean;
};

// Helper function to calculate bin counts
function calculateBinCounts(
  values: number[], 
  actualMin: number, 
  actualMax: number, 
  numBins: number, 
  groupValues?: number[]
): { binCounts: number[], groupCounts?: number[][] } {
  const binSize = (actualMax - actualMin) / numBins;
  const binCounts = _.fill(Array(numBins + 2), 0);
  let groupCounts: number[][] | undefined = undefined;
  
  if (groupValues) {
    const groupCount = Math.max(...groupValues) + 1;
    groupCounts = _.fill(Array(groupCount), 0).map(() => 
      _.fill(Array(numBins + 2), 0)
    );
  }
  
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    let bin: number;
    
    if (v < actualMin) {
      bin = 0;
    } else if (v >= actualMax) {
      bin = numBins + 1;
    } else {
      bin = Math.floor((v - actualMin) / binSize) + 1;
    }
    
    binCounts[bin] += 1;
    
    if (groupValues && groupCounts) {
      groupCounts[groupValues[i]][bin] += 1;
    }
  }
  
  return { binCounts, groupCounts };
}

// Helper function to create bin labels
function createBinLabels(
  counts: number[], 
  x0: number[], 
  x1: number[],
  roundFun: (v: number) => string,
  globalMin: number,
  globalMax: number,
  numBins: number
): string[] {
  return counts.map((count, i) => {
    const left = i === 0 ? globalMin : x0[i];
    const right = i === numBins + 1 ? globalMax : x1[i];
    return `[${roundFun(left)}, ${roundFun(right)}): ${count}`;
  });
}

// Helper function to create an axis annotation
function createAxisAnnotation(
  text: string, 
  position: number, 
  fontSize: number = 13
): Partial<Layout["annotations"][0]> {
  return {
    text,
    x: 0,
    y: position,
    xref: 'paper',
    yref: 'paper',
    xanchor: 'right',
    yanchor: 'middle',
    showarrow: false,
    font: { size: fontSize },
    xshift: -40,
    textangle: "0"
  };
}

function histogramData(props: {
  data: RawDataCategory;
  valueName: string;
  numBins: number;
  groupName?: string;
  zoomMin?: number;
  zoomMax?: number;
  additionalAxes?: boolean;
}): Partial<PlotData>[] {
  const column = props.data.columns.find(c => c.name === props.valueName);
  if (!column) return [];

  const groupColumn = props.groupName
    ? props.data.columns.find(c => c.name === props.groupName)
    : undefined;
  if (props.groupName && !groupColumn) return [];

  const values = column.data as number[];
  const groupValues = groupColumn ? groupColumn.data as number[] : undefined;

  const globalMin = _.min(values)!;
  const globalMax = _.max(values)!;
  const actualMin = props.zoomMin !== undefined ? props.zoomMin : globalMin;
  const actualMax = props.zoomMax !== undefined ? props.zoomMax : globalMax;
  const binSize = (actualMax - actualMin) / props.numBins;

  // Calculate all bin counts in one pass
  const { binCounts, groupCounts } = calculateBinCounts(
    values, actualMin, actualMax, props.numBins, groupValues
  );

  // Calculate x-axis values for all bins
  const roundingBase = Math.floor(Math.log10(binSize));
  const roundFun = (v: number) => v.toFixed(_.clamp(-roundingBase, 0, 15));
  const x0 = binCounts.map((_, i) => actualMin + binSize * (i - 1));
  const x1 = binCounts.map((_, i) => actualMin + binSize * i);
  const x = x0.map((start, i) => (start + x1[i]) / 2);
  
  // Create bin labels for main histogram
  const binLabels = createBinLabels(
    binCounts, x0, x1, roundFun, globalMin, globalMax, props.numBins
  );

  // Determine whether to display overall histogram
  const plotOverall = (props.additionalAxes && props.groupName !== undefined) ||
                     (!props.additionalAxes && props.groupName === undefined);

  // Create the overall histogram
  const overall: Partial<PlotData>[] = plotOverall
    ? [{
        type: "bar" as const,
        x: x,
        y: binCounts,
        marker: { color: recurringColours.pass },
        hovertext: binLabels,
        hoverinfo: "text",
        name: "Overall",
        xaxis: "x",
        yaxis: "y",
      }]
    : [];

  // Create per-group histograms
  const perGroup: Partial<PlotData>[] = groupCounts 
    ? groupCounts.map((counts, i) => {
        const groupLabels = createBinLabels(
          counts, x0, x1, roundFun, globalMin, globalMax, props.numBins
        );
        
        return {
          type: "bar" as const,
          x: x,
          y: counts,
          name: groupColumn?.categories![i],
          hovertext: groupLabels,
          hoverinfo: "text",
          xaxis: "x",
          yaxis: props.additionalAxes ? `y${i + 2}` : "y",
        };
      })
    : [];

  return overall.concat(perGroup);
}

function histogramLayout(props: {
  data: RawDataCategory;
  xTitle: string;
  minCutoff?: number;
  maxCutoff?: number;
  groupName?: string;
  additionalAxes: boolean;
  xType: "log" | "linear";
  yType: "log" | "linear";
}): Partial<Layout> {
  // Initial setup
  let height = 200;
  const annotations: Partial<Layout["annotations"][0]>[] = [];
  let sampleYAxes: { [key: string]: Partial<Layout["yaxis"]> } = {};
  let grid: Partial<Layout["grid"]> = {};
  let plotHeight = 1.0;

  // Get group information if available
  const groupColumn = props.groupName
    ? props.data.columns.find(c => c.name === props.groupName)
    : undefined;
    
  if (groupColumn && props.additionalAxes) {
    const groupNames = groupColumn.categories!;
    const totalPlots = groupNames.length + 1;
    plotHeight = 1.0 / totalPlots;
    
    // Create annotations for each group
    groupNames.forEach((label, i) => {
      const plotIndex = i + 1;
      const midPoint = 1.0 - (plotIndex * plotHeight + plotHeight/2);
      annotations.push(createAxisAnnotation(label, midPoint));
    });
    
    // Create y-axes configuration without titles
    sampleYAxes = Object.fromEntries(
      groupNames.map((_, i) => {
        return [`yaxis${i + 2}`, {
          side: "left" as const,
          fixedrange: true,
          type: props.yType,
          automargin: true,
          showticklabels: true,
        }];
      })
    );
    
    // Configure subplot grid
    grid = {
      columns: 1,
      rows: groupNames.length + 1,
      subplots: ["xy"].concat(groupNames.map((_, i) => `xy${i + 2}`)),
    };
    
    // Adjust height based on number of plots
    height = 75 * (groupNames.length + 1);
  }

  // Add the "Total" annotation for the main plot
  annotations.push(createAxisAnnotation("Total", 1.0 - plotHeight/2));

  // Return the complete layout configuration
  return {
    xaxis: {
      title: props.xTitle,
      type: props.xType,
      fixedrange: true,
      automargin: true,
    },
    yaxis: {
      side: "left" as const,
      fixedrange: true,
      type: props.yType,
      automargin: true,
      showticklabels: true,
    },
    ...sampleYAxes,
    annotations,
    shapes: cutoffShape("Min", props.minCutoff).concat(
      cutoffShape("Max", props.maxCutoff),
    ),
    showlegend: false,
    height,
    barmode: "stack",
    grid,
    margin: {
      b: 60,
      t: 20,
      l: 125,
      r: 10,
      pad: 4,
    },
  };
}

export function Histogram(props: Props) {
  return (
    <Plot
      data={histogramData({
        data: props.data,
        valueName: props.filterSettings.field,
        groupName: props.filterSettings.groupBy,
        numBins: props.filterSettings.nBins,
        zoomMin: props.filterSettings.zoomMin,
        zoomMax: props.filterSettings.zoomMax,
        additionalAxes: props.additionalAxes,
      })}
      layout={histogramLayout({
        data: props.data,
        groupName: props.filterSettings.groupBy,
        xTitle: props.filterSettings.label,
        minCutoff: props.filterSettings.cutoffMin,
        maxCutoff: props.filterSettings.cutoffMax,
        xType: props.filterSettings.xAxisType || "linear",
        yType: props.filterSettings.yAxisType || "linear",
        additionalAxes: props.additionalAxes,
      })}
      config={plotlyConfig()}
      useResizeHandler={true}
    />
  );
}