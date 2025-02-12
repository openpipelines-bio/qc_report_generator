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

function histogramData(props: {
  data: RawDataCategory;
  valueName: string;
  numBins: number;
  groupName?: string;
  zoomMin?: number;
  zoomMax?: number;
  additionalAxes?: boolean;
}): Partial<PlotData>[] {
  const column = props.data.columns.find(
    (c) => c.name === props.valueName,
  );

  if (!column) {
    return [];
  }

  const groupColumn = props.groupName
    ? props.data.columns.find((c) => c.name === props.groupName)
    : undefined;
  if (props.groupName && !groupColumn) {
    return [];
  }

  const values = column.data as number[];

  const globalMin = _.min(values)!;
  const globalMax = _.max(values)!;
  const actualMin = props.zoomMin !== undefined ? props.zoomMin : globalMin;
  const actualMax = props.zoomMax !== undefined ? props.zoomMax : globalMax;
  const binSize = (actualMax - actualMin) / props.numBins;

  // bin overall data
  const binCounts = _.fill(Array(props.numBins + 2), 0);
  for (const v of values) {
    if (v < actualMin) {
      binCounts[0] += 1;
    } else if (v >= actualMax) {
      binCounts[props.numBins + 1] += 1;
    } else {
      const bin = Math.floor((v - actualMin) / binSize) + 1;
      binCounts[bin] += 1;
    }
  }

  // bin grouped data
  var groupValues: number[] | undefined = undefined;
  var groupCounts: number[][] | undefined = undefined;

  if (groupColumn) {
    groupValues = groupColumn.data as number[];
    groupCounts = _.fill(Array(groupColumn.categories!.length), 0).map(() =>
      _.fill(Array(props.numBins + 2), 0),
    );

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const gr = groupValues[i];
      if (v < actualMin) {
        groupCounts[gr][0] += 1;
      } else if (v >= actualMax) {
        groupCounts[gr][props.numBins + 1] += 1;
      } else {
        const bin = Math.floor((v - actualMin) / binSize) + 1;
        groupCounts[gr][bin] += 1;
      }
    }
  }

  // determine x-axis values and labels
  const roundingBase = Math.floor(Math.log10(binSize));
  const roundFun = (v: number) => v.toFixed(_.clamp(-roundingBase, 0, 15));

  const x0 = binCounts.map((_, i) => actualMin + binSize * (i - 1));
  const x1 = binCounts.map((_, i) => actualMin + binSize * i);
  const x = x0.map((start, i) => (start + x1[i]) / 2);
  const binLabels = binCounts.map((count, i) => {
    const left = i === 0 ? globalMin : x0[i];
    const right = i === props.numBins + 1 ? globalMax : x1[i];
    return `[${roundFun(left)}, ${roundFun(right)}): ${count}`;
  });

  const plotOverall =
    (props.additionalAxes && props.groupName !== undefined) ||
    (!props.additionalAxes && props.groupName === undefined);

  const overall: Partial<PlotData>[] = plotOverall
    ? [
        {
          type: "bar" as const,
          x: x,
          y: binCounts,
          marker: { color: recurringColours.pass },
          hovertext: binLabels,
          hoverinfo: "text",
          name: "Overall",
          xaxis: "x",
          yaxis: "y",
        },
      ]
    : [];

  const perGroup: Partial<PlotData>[] = (groupCounts ?? []).map((counts, i) => {
    const binLabels = counts.map((count, j) => {
      const left = j === 0 ? globalMin : x0[j];
      const right = j === props.numBins + 1 ? globalMax : x1[j];
      return `[${roundFun(left)}, ${roundFun(right)}): ${count}`;
    });
    const yAxis = props.additionalAxes ? `y${i + 2}` : "y";
    return {
      type: "bar" as const,
      x: x,
      y: counts,
      name: groupColumn?.categories![i],
      hovertext: binLabels,
      hoverinfo: "text",
      xaxis: "x",
      yaxis: yAxis,
    };
  });

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
  var height = 200;

  var groupNames: string[] | undefined = undefined;
  var sampleYAxes: { [key: string]: Partial<Layout["yaxis"]> } = {};
  var grid: Partial<Layout["grid"]> = {};

  // look for the grouping column
  const groupColumn = props.groupName
    ? props.data.columns.find((c) => c.name === props.groupName)
    : undefined;

  if (groupColumn && props.additionalAxes) {
    groupNames = groupColumn.categories;
    sampleYAxes = Object.fromEntries(
      groupNames!.map((label, i) => {
        const key = `yaxis${i + 2}`;
        const value = {
          title: label,
          fixedrange: true,
          type: props.yType,
        };
        return [key, value];
      }),
    );
    grid = {
      columns: 1,
      rows: groupNames!.length + 1,
      subplots: ["xy"].concat(groupNames!.map((_, i) => `xy${i + 2}`)),
    };
    height = 50 * (groupNames!.length + 1);
  }

  return {
    xaxis: {
      title: props.xTitle,
      type: props.xType,
      fixedrange: true,
    },
    yaxis: {
      title: "Total",
      fixedrange: true,
      type: props.yType,
    },
    ...sampleYAxes,
    shapes: cutoffShape("Min", props.minCutoff).concat(
      cutoffShape("Max", props.maxCutoff),
    ),
    showlegend: false,
    height: height,
    barmode: "stack",
    grid: grid,
    margin: {
      b: 60,
      t: 10,
      l: 60,
      r: 10,
    },
  };
}

export function Histogram(props: Props) {
  return <Plot
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
  />;
}