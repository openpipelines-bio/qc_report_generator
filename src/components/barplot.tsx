import Plot from "@ralphsmith80/solid-plotly.js";
import _ from "lodash";
import { Layout, PlotData } from "plotly.js-dist-min";
import { cutoffShape, plotlyConfig, recurringColours } from "~/lib/plots";
import { FilterSettings, RawDataCategory } from "~/types";

type Props = {
  data: RawDataCategory;
  filterSettings: FilterSettings;
};

function barData(props: {
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

  // todo: parameterise yName separately
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

function barLayout(props: {
  data: RawDataCategory;
  xTitle: string;
  minCutoff?: number;
  maxCutoff?: number;
  xType: "linear" | "log";
}): Partial<Layout> {
  const layout: Partial<Layout> = {
    xaxis: {
      title: props.xTitle,
      type: props.xType,
    },
    yaxis: {
      type: "category"
    },
    shapes: cutoffShape("Min", props.minCutoff).concat(
      cutoffShape("Max", props.maxCutoff),
    ),
    showlegend: false,
    margin: {
      l: 200,
      t: 10,
      r: 10,
    },
  };

  return layout;
}

export function BarPlot(props: Props) {
  return <Plot
    data={barData({
      data: props.data,
      valueName: props.filterSettings.field,
      groupName: props.filterSettings.groupBy,
      zoomMin: props.filterSettings.zoomMin,
      zoomMax: props.filterSettings.zoomMax,
    })}
    layout={barLayout({
      data: props.data,
      xTitle: props.filterSettings.label,
      minCutoff: props.filterSettings.cutoffMin,
      maxCutoff: props.filterSettings.cutoffMax,
      xType: props.filterSettings.xAxisType || "linear",
    })}
    config={plotlyConfig()}
    useResizeHandler={true}
  />;
}