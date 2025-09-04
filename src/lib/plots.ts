import _ from "lodash";
import { Config, Layout, Shape, PlotData } from "plotly.js-dist-min";
import { RawData, HeatmapData } from "~/types";
import { wrapText } from "./text-utils";

export const recurringColours = {
  green: "#4daf4a",
  red: "#e41a1c",
  pass: "#636363",
  fail: "#bdbdbd",
}

export function cutoffShape(
  label: "Min" | "Max",
  value?: number,
): Partial<Shape>[] {
  if (value) {
    const color = label === "Min" ? recurringColours.green : recurringColours.red;
    const xanchor = label === "Min" ? "left" : "right";
    return [
      {
        type: "line",
        y0: 0,
        y1: 1,
        x0: value,
        x1: value,
        yref: "paper",
        line: {
          width: 3,
          dash: "dot",
        },
        label: {
          text: label,
          xanchor: xanchor,
          yanchor: "top",
          textposition: "end",
          textangle: 0,
        },
      },
    ];
  }
  return [];
}

export function violinData(data: RawData, valueName: string) {
  const x = data.cell_rna_stats.columns.find((c) => c.name === valueName)?.data;
  const y = data.cell_rna_stats.columns.find(
    (c) => c.name === "sample_id",
  )?.data;

  return [
    {
      type: "violin" as const,
      x: x,
      y: y,
      orientation: "h",
    },
  ];
}

export function violinLayout(
  dataLabel: string,
  minCutoff?: number,
  maxCutoff?: number,
  type: "log" | "linear" = "log",
): Partial<Layout> {
  return {
    xaxis: {
      title: dataLabel,
      type: type,
      fixedrange: true,
    },
    yaxis: {
      title: "Sample",
      fixedrange: true,
    },
    shapes: cutoffShape("Min", minCutoff).concat(cutoffShape("Max", maxCutoff)),
    height: 500,
  };
}

export function plotlyConfig(): Partial<Config> {
  return {
    displaylogo: false,
    displayModeBar: false,
  };
}

export function createAxisAnnotation(
  text: string, 
  position: number, 
  fontSize: number = 13
): Partial<Layout["annotations"][0]> {
  const wrappedText = wrapText(text);
  
  return {
    text: wrappedText,
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

export function createScatterTrace(
  x: Array<number | string | Date | null>, 
  y: Array<number | string | Date | null>, 
  name: string, 
  color?: Array<number | string> | string | undefined, 
  isSpatial: boolean = false, 
  axisIndex: number = 0,
  showColorbar: boolean = false,
  colorbarTitle?: string  
): Partial<PlotData> {
  return {
    type: "scatter",
    mode: "markers",
    x, y, name,
    marker: {
      size: isSpatial ? 6 : 8,
      opacity: 0.7,
      color,
      line: { width: isSpatial ? 1 : 0, color: 'rgba(0,0,0,0.3)' },
      colorbar: showColorbar ? {
        title: colorbarTitle || "",
        titleside: "right",
        thickness: 15,
        len: 300,        
        lenmode: 'pixels', 
        y: 0.5,           
        yanchor: 'middle', 
        x: 1.05,
        xanchor: "left"
      } : undefined
    },
    xaxis: axisIndex > 0 ? `x${axisIndex}` : "x",
    yaxis: axisIndex > 0 ? `y${axisIndex}` : "y",
    showlegend: axisIndex === 0, 
  };
}

export function createBasicLayout(
  xTitle: string, 
  yTitle: string, 
  height?: number, 
  isSpatial: boolean = false
): Partial<Layout> {
  return {
    xaxis: {
      title: xTitle,
      automargin: true,
      fixedrange: true,
      scaleanchor: isSpatial ? "y" : undefined,
      scaleratio: isSpatial ? 1 : undefined,
    },
    yaxis: {
      title: yTitle,
      automargin: true,
      fixedrange: true,
    },
    height: height || 400,
    margin: {
      l: 60,
      r: 60,
      t: 40,
      b: 60,
    },
  };
}

export function getHeatmapColorValue(
  dtype: string, 
  colorValues: number[], 
  binData: HeatmapData, 
  groupValues: number[] | undefined, 
  group: number | undefined
): (number | undefined)[][] {
  const binColors: (number | undefined)[][] = Array.from({ length: binData.numBinsY }, () => 
    Array.from({ length: binData.numBinsX }, () => undefined)
  );

  for (let yBin = 0; yBin < binData.numBinsY; yBin++) {
    for (let xBin = 0; xBin < binData.numBinsX; xBin++) {
      let values = binData.binIndices[yBin][xBin].map(i => colorValues[i]);

      if (groupValues && group !== undefined) {
        values = values.filter((_, idx) => groupValues[binData.binIndices[yBin][xBin][idx]] === group);
      }

      if (values.length === 0) {
        binColors[yBin][xBin] = 0;
        continue;
      }

      if (dtype === "categorical") {
        const mode = _.flow(
          _.countBy,
          _.toPairs,
          _.partialRight(_.maxBy, _.last),
          _.head
        )(values);
        binColors[yBin][xBin] = mode as number | undefined;
      } else if (["numeric", "integer", "boolean"].includes(dtype)) {
        const mean = _.mean(values);
        binColors[yBin][xBin] = mean as number | undefined;
      }
    }
  }

  return binColors;
}

export function createHeatmapGrid(binData: HeatmapData, binColors: (number | undefined)[][]) {
  return {
    x: binData.xBinCenters,
    y: binData.yBinCenters,
    z: binColors,
  };
}

