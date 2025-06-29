import _ from "lodash";
import { Config, Layout, Shape } from "plotly.js-dist-min";
import { RawData } from "~/types";

// define a few colours
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

