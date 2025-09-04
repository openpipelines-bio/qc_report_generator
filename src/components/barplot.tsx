import Plot from "@ralphsmith80/solid-plotly.js";
import _ from "lodash";
import { Layout, PlotData } from "plotly.js-dist-min";
import { cutoffShape, plotlyConfig, recurringColours } from "~/lib/plots";
import { createBarData, createBarLayout } from "~/lib/bar-chart-utils";
import { FilterSettings, RawDataCategory } from "~/types";

type Props = {
  data: RawDataCategory;
  filterSettings: FilterSettings;
};

export function BarPlot(props: Props) {
  const dataLength = props.data.num_rows;
  const dynamicHeight = Math.max(400, dataLength * 20);
  
  return (
    <div style={{ height: `${dynamicHeight}px`, width: "100%" }}>
      <Plot
        data={createBarData({
          data: props.data,
          valueName: props.filterSettings.field,
          groupName: props.filterSettings.groupBy,
          zoomMin: props.filterSettings.zoomMin,
          zoomMax: props.filterSettings.zoomMax,
        })}
        layout={createBarLayout({
          data: props.data,
          xTitle: props.filterSettings.label || props.filterSettings.field,
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