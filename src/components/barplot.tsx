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
      type: props.xType,
      titlefont: {
        size: 14,  // Increased from 12 to 16 for better visibility
      },
      automargin: true,
      title: {
        text: props.xTitle,
        standoff: 15, // Increased standoff to accommodate larger font
      },
    },
    yaxis: {
      type: "category",
      automargin: true,  // Automatically adjust margins to fit all labels
      showticklabels: true,  // Ensure all tick labels are shown
      tickmode: "linear",  // Use all categories as ticks
      dtick: 1,  // Show every tick
    },
    shapes: cutoffShape("Min", props.minCutoff).concat(
      cutoffShape("Max", props.maxCutoff),
    ),
    showlegend: false,
    margin: {
      l: 200,
      t: 10,
      r: 10,
      b: 60, // Slightly increased bottom margin to fit larger title
    },
  };

  return layout;
}

export function BarPlot(props: Props) {
  // Calculate height based on number of samples - minimum 400px, plus 20px per sample
  const dataLength = props.data.num_rows;
  const dynamicHeight = Math.max(400, dataLength * 20);
  
  return (
    <div style={{ height: `${dynamicHeight}px`, width: "100%" }}>
      <Plot
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
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}