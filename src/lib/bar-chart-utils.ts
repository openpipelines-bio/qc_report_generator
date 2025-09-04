import _ from "lodash";
import { Layout, PlotData } from "plotly.js-dist-min";
import { cutoffShape, recurringColours } from "./plots";
import { RawDataCategory } from "~/types";

export function createBarData(props: {
  data: RawDataCategory;
  valueName: string;
  groupName?: string;
  zoomMin?: number;
  zoomMax?: number;
}): Partial<PlotData>[] {
  const column = props.data.columns.find(
    (c) => c.name === props.valueName,
  );

  if (!column) {
    return [];
  }

  const sampleColumn = props.data.columns.find((c) => c.name === "sample_id")
  if (!sampleColumn) {
    return [];
  }
  const groupColumn = props.groupName
    ? props.data.columns.find((c) => c.name === props.groupName)
    : undefined;
  if (props.groupName && !groupColumn) {
    return [];
  }

  const x = column.data as number[];
  const y = sampleColumn.data.map((i) => sampleColumn.categories![i as number]);

  if (groupColumn === undefined) {
    return [
      {
        x: x,
        y: y,
        type: "bar",
        orientation: "h",
        marker: { color: recurringColours.pass },
      }
    ]
  } else {
    const col = groupColumn?.data.map((i) => groupColumn.categories![i as number]);
    return col.map((value, i) => (
      {
        x: [x[i]],
        y: [value],
        type: "bar",
        orientation: "h",
        name: value,
      }
    ))
  }
}

export function createBarLayout(props: {
  data: RawDataCategory;
  xTitle: string;
  minCutoff?: number;
  maxCutoff?: number;
  xType: "linear" | "log";
}): Partial<Layout> {
  const layout: Partial<Layout> = {
    xaxis: {
      type: props.xType,
      titlefont: {
        size: 14,
      },
      automargin: true,
      title: {
        text: props.xTitle,
        standoff: 15,
      },
    },
    yaxis: {
      type: "category",
      automargin: true,
      showticklabels: true,
      tickmode: "linear",
      dtick: 1,
    },
    shapes: cutoffShape("Min", props.minCutoff).concat(
      cutoffShape("Max", props.maxCutoff),
    ),
    showlegend: false,
    margin: {
      l: 200,
      t: 10,
      r: 10,
      b: 60,
    },
  };

  return layout;
}
