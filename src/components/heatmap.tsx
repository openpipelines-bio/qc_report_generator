import Plot from "@ralphsmith80/solid-plotly.js";
import { Layout, PlotData } from "plotly.js-dist-min";
import { plotlyConfig } from "~/lib/plots";
import { FilterSettings, RawDataCategory, HeatmapData } from "~/types";
import { createMemo, Show } from "solid-js";
import * as _ from "lodash";

type HeatmapProps = {
  data: RawDataCategory;
  binData: HeatmapData;
  filterSettings: FilterSettings;
  colorFieldName?: string;
};

function getColorValue(dtype: string, colorValues: number[], binData: HeatmapData, groupValues: number[] | undefined, group: number | undefined): (number | undefined)[][] {
  // Create a 2D matrix to store bin colors [yBin][xBin]
  const binColors: (number | undefined)[][] = Array.from({ length: binData.numBinsY }, () => 
    Array.from({ length: binData.numBinsX }, () => undefined)
  );

  // Process each bin
  for (let yBin = 0; yBin < binData.numBinsY; yBin++) {
    for (let xBin = 0; xBin < binData.numBinsX; xBin++) {
      let values = binData.binIndices[yBin][xBin].map(i => colorValues[i]);

      // Filter values by group if provided
      if (groupValues && group !== undefined) {
        values = values.filter((_, idx) => groupValues[binData.binIndices[yBin][xBin][idx]] === group);
      }

      // Return 0 for empty bins instead of undefined
      if (values.length === 0) {
        binColors[yBin][xBin] = 0;
        continue;
      }

      if (dtype === "categorical") {
        // compute mode
        const mode = _.flow(
          _.countBy,
          _.toPairs,
          _.partialRight(_.maxBy, _.last),
          _.head
        )(values);
        binColors[yBin][xBin] = mode as number | undefined;
      } else if (["numeric", "integer", "boolean"].includes(dtype)) {
        // compute mean
        const mean = _.mean(values);
        binColors[yBin][xBin] = mean as number | undefined;
      }
    }
  }

  return binColors;
}

// Helper to convert bin grid data to heatmap grid
function createHeatmapGrid(binData: HeatmapData, binColors: (number | undefined)[][]) {
  return {
    x: binData.xBinCenters,
    y: binData.yBinCenters,
    z: binColors
  };
}

export function Heatmap(props: HeatmapProps) {
  // Get field for coloring
  const colorField = createMemo(() => 
    props.colorFieldName || props.filterSettings.field
  );
  
  // Create plot data
  const plotData = createMemo(() => {
    const colorColumn = props.data.columns.find(c => c.name === colorField());
    if (!colorColumn) return [];
    const colorValues = colorColumn.data as number[];
    
    const binColors = getColorValue(colorColumn.dtype, colorValues, props.binData, undefined, undefined);

    // Custom white-to-blue color scale
    const customColorScale: [number, string][] = [
      [0, 'rgba(240, 240, 240, 0.4)'],
      [0.01, 'rgba(255, 255, 255, 0.1)'],
      [0.1, 'rgba(240, 249, 255, 0.6)'],
      [0.3, 'rgba(204, 224, 255, 0.8)'],
      [0.5, 'rgba(102, 169, 255, 0.9)'],
      [0.7, 'rgba(51, 119, 255, 0.95)'],
      [1.0, 'rgba(0, 68, 204, 1)']
    ];

    // If no groupBy, just return a single heatmap
    if (!props.filterSettings.groupBy) {
      const heatmapGrid = createHeatmapGrid(props.binData, binColors);
      
      const plots: Partial<PlotData>[] = [{
        type: "heatmap",
        x: heatmapGrid.x,
        y: heatmapGrid.y,
        z: heatmapGrid.z,
        colorscale: customColorScale,
        hoverongaps: false,
        hovertemplate: 
          '<b>Cells in bin</b>: %{customdata}<br>' +
          '<b>X</b>: %{x:.2f}<br>' +
          '<b>Y</b>: %{y:.2f}<br>' +
          `<b>${props.filterSettings.label || colorField() || ""}</b>: %{z:.2f}` +
          '<extra></extra>',
        customdata: heatmapGrid.z.map((row, yIndex) => 
          row.map((_, xIndex) => {
            // Get cell count for this bin
            return props.binData.binIndices[yIndex][xIndex].length;
          })
        ),
        showscale: true,
        colorbar: {
          title: props.filterSettings.label || colorField() || "",
          titleside: "right",
          thickness: 15,
          len: 0.75,
          y: 0.5,
          yanchor: 'middle',
          x: 1.02, 
          xanchor: 'left'
        },
        xaxis: "x",
        yaxis: "y",
        name: "Total",
      } as Partial<PlotData>];
      
      return plots;
    }

    // If we have a groupBy, create multiple heatmaps
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return [];

    const groupValues = groupColumn.data;
    const definedGroups = [...new Set(groupValues)].filter(g => g !== undefined && g !== null).sort();
    const uniqueGroups = definedGroups;
    const plots: Partial<PlotData>[] = [];
    
    // Create heatmaps for each group
    uniqueGroups.forEach((group, i) => {
      const groupColor = getColorValue(colorColumn.dtype, colorValues, props.binData, groupValues, group);
      const groupName = groupColumn.categories?.[group] || `Group ${group}`;
      const heatmapGrid = createHeatmapGrid(props.binData, groupColor);
      
      const groupCounts = heatmapGrid.z.map((row, yIndex) => 
        row.map((_, xIndex) => {
          // Get cell count for this group in this bin
          return props.binData.binIndices[yIndex][xIndex].filter(idx => groupValues[idx] === group).length;
        })
      );
      
      plots.push({
        type: "heatmap",
        x: heatmapGrid.x,
        y: heatmapGrid.y,
        z: heatmapGrid.z,
        colorscale: customColorScale,
        hoverongaps: false,
        hovertemplate: 
          '<b>Cells in bin</b>: %{customdata}<br>' +
          '<b>X</b>: %{x:.2f}<br>' +
          '<b>Y</b>: %{y:.2f}<br>' +
          `<b>${props.filterSettings.label || colorField() || ""}</b>: %{z:.2f}` +
          '<extra></extra>',
        customdata: groupCounts,
        showscale: i === 0, // Only show colorbar for the first plot
        colorbar: i === 0 ? {
          title: props.filterSettings.label || colorField() || "",
          titleside: "right",
          thickness: 15,
          len: 0.75,
          y: 0.5,
          yanchor: 'middle',
          x: 1.02, 
          xanchor: 'left'
        } : undefined,
        xaxis: i === 0 ? "x" : `x${i+1}`,
        yaxis: i === 0 ? "y" : `y${i+1}`,
        name: groupName,
      } as Partial<PlotData>);
    });
    
    return plots;
  });
  
  // Create layout
  const plotLayout = createMemo(() => {
    // If no grouping, just return a simple layout
    if (!props.filterSettings.groupBy) {
      return {
        xaxis: {
          title: "X Position (µm)",
          fixedrange: false,
          automargin: true,
          zerolinewidth: 1,
          zerolinecolor: 'lightgray',
          gridwidth: 1,
        },
        yaxis: {
          title: "Y Position (µm)",
          fixedrange: false,
          automargin: true,
          scaleanchor: "x",
          scaleratio: 1,
          zerolinewidth: 1,
          zerolinecolor: 'lightgray',
          gridwidth: 1,
        },
        height: 600,
        showlegend: false,
        margin: { t: 20, r: 80, b: 60, l: 80 },
        hovermode: "closest"
      } as Partial<Layout>;
    }
    
    // For grouped plots, create a grid layout
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return {};

    const uniqueGroups = [...new Set(groupColumn.data)].filter(g => g !== undefined && g !== null).sort();
    const totalPlots = uniqueGroups.length;
    
    // Calculate grid dimensions
    const columns = Math.min(totalPlots, 2); // Maximum 2 columns
    const rows = Math.ceil(totalPlots / columns);
    const height = Math.max(600, rows * 400);
    
    const layout: Record<string, any> = {
      height: height,
      showlegend: false,
      margin: { t: 50, r: 120, b: 60, l: 80 },
      hovermode: "closest",
      grid: {
        rows: rows,
        columns: columns,
        pattern: 'independent',
        roworder: 'top to bottom'
      },
      annotations: []
    };
    
    // Set up axis properties for all plots
    uniqueGroups.forEach((group, i) => {
      const axisIndex = i === 0 ? "" : i + 1;
      const groupName = groupColumn.categories?.[group] || `Group ${group}`;
      
      layout[`xaxis${axisIndex}`] = {
        title: "X Position (µm)",
        fixedrange: false,
        automargin: true,
        zerolinewidth: 1,
        zerolinecolor: 'lightgray',
        gridwidth: 1
      };
      layout[`yaxis${axisIndex}`] = {
        title: "Y Position (µm)",
        fixedrange: false,
        automargin: true,
        scaleanchor: `x${axisIndex}`,
        scaleratio: 1,
        zerolinewidth: 1,
        zerolinecolor: 'lightgray',
        gridwidth: 1
      };
      
      layout.annotations.push({
        text: `<b>${groupName}</b>`,
        xref: `x${axisIndex} domain`,
        yref: `y${axisIndex} domain`,
        x: 0.5,
        y: 1.05,
        xanchor: "center",
        yanchor: "bottom",
        showarrow: false,
        font: { size: 14 }
      });
    });
    
    return layout;
  });
  
  return (
    <>
      <Show when={props.filterSettings.cutoffMin !== undefined || props.filterSettings.cutoffMax !== undefined}>
        <div class="absolute top-2 right-2 z-10 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
          Filter applied: {props.filterSettings.field}
        </div>
      </Show>
      <Plot
        data={plotData()}
        layout={plotLayout()}
        config={plotlyConfig()}
        style={{ width: "100%", height: "100%" }}
      />
    </>
  );
}