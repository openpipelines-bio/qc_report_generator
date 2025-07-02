import Plot from "@ralphsmith80/solid-plotly.js";
import { Layout, PlotData } from "plotly.js-dist-min";
import { plotlyConfig } from "~/lib/plots";
import { FilterSettings, RawDataCategory } from "~/types";
import { createMemo } from "solid-js";

type HexbinPlotProps = {
  data: RawDataCategory;
  filterSettings: FilterSettings;
  colorFieldName?: string;
};

export function HexbinPlot(props: HexbinPlotProps) {
  // Get field for coloring
  const colorField = createMemo(() => 
    props.colorFieldName || props.filterSettings.field
  );
  
  // Create plot data
  const plotData = createMemo(() => {
    const xColumn = props.data.columns.find(c => c.name === "x_coord");
    const yColumn = props.data.columns.find(c => c.name === "y_coord");
    const colorColumn = props.data.columns.find(c => c.name === colorField());
    const countColumn = props.data.columns.find(c => c.name === "cell_count");
    
    if (!xColumn || !yColumn || !colorColumn) return [];
    
    // Calculate true hexagonal grid coordinates
    const xValues = xColumn.data as number[];
    const yValues = yColumn.data as number[];
    const colorValues = colorColumn.data as number[];
    
    // Get cell counts (or default to 1 if count column doesn't exist)
    const cellCounts = countColumn ? countColumn.data as number[] : Array(xValues.length).fill(1);
    
    // Filter out bins with 0 cells
    const filteredIndices = cellCounts.map((count, idx) => ({ count, idx }))
                                      .filter(item => item.count > 0)
                                      .map(item => item.idx);
    
    // Apply the filter to all data arrays
    const filteredX = filteredIndices.map(i => xValues[i]);
    const filteredY = filteredIndices.map(i => yValues[i]);
    const filteredColor = filteredIndices.map(i => colorValues[i]);
    const filteredCounts = filteredIndices.map(i => cellCounts[i]);
    
    // Find min/max coordinates (use filtered values)
    const xMin = Math.min(...filteredX.filter(x => !isNaN(x)));
    const xMax = Math.max(...filteredX.filter(x => !isNaN(x)));
    const yMin = Math.min(...filteredY.filter(y => !isNaN(y)));
    const yMax = Math.max(...filteredY.filter(y => !isNaN(y)));
    
    // Get row and column info from the data (not computed)
    const uniqueXCoords = new Set(filteredX.map(x => Math.round(x * 100) / 100)).size;
    const uniqueYCoords = new Set(filteredY.map(y => Math.round(y * 100) / 100)).size;
    const numBinsX = uniqueXCoords;
    const numBinsY = uniqueYCoords;

    // Base size on the density of bins, with a scaling factor
    const totalBins = numBinsX * numBinsY;
    const baseSizeMultiplier = 20; // Adjust this number to change overall size
    const hexSize = Math.max(
      5,  // Minimum size
      Math.min(
        30,  // Maximum size
        baseSizeMultiplier * Math.sqrt(1000 / totalBins)  // Scale based on bin density
      )
    );
    
    // Custom white-to-blue color scale
    const customColorScale = [
      [0, 'rgba(255, 255, 255, 0.1)'],  // Almost transparent white for lowest values
      [0.1, 'rgba(240, 249, 255, 0.6)'], // Very light blue with some transparency
      [0.3, 'rgba(204, 224, 255, 0.8)'], // Light blue
      [0.5, 'rgba(102, 169, 255, 0.9)'], // Medium blue
      [0.7, 'rgba(51, 119, 255, 0.95)'], // Stronger blue
      [1.0, 'rgba(0, 68, 204, 1)']       // Deep blue for highest values
    ];
    
    // For scatter plot with hexagon markers to represent binned data
    return [{
      type: "scatter",
      mode: "markers",
      x: filteredX,
      y: filteredY,
      marker: {
        symbol: "hexagon2", // Use hexagon2 for flat-top orientation (better tesselation)
        size: hexSize,  // Use the corrected size calculation
        color: filteredColor,
        colorscale: customColorScale, // Use the custom white-to-blue scale
        colorbar: {
          title: props.filterSettings.label || colorField() || "",
          titleside: "right",
          thickness: 15,
          len: 0.75,
          y: 0.5,
          yanchor: 'middle'
        },
        line: {
          width: 0.5,
          color: 'rgba(0,0,0,0.3)'
        }
      },
      hovertemplate: 
        '<b>Cells in bin</b>: %{customdata}<br>' +
        '<b>X</b>: %{x:.2f}<br>' +
        '<b>Y</b>: %{y:.2f}<br>' +
        `<b>${props.filterSettings.label || colorField() || ""}</b>: %{marker.color:.2f}` +
        '<extra></extra>',
      customdata: filteredCounts,
    } as Partial<PlotData>];
  });
  
  // Create layout
  const plotLayout = createMemo(() => {
    return {
      xaxis: {
        title: "X Position (µm)",
        fixedrange: false,
        automargin: true,
      },
      yaxis: {
        title: "Y Position (µm)",
        fixedrange: false,
        automargin: true,
        scaleanchor: "x",  // This ensures equal scaling
        scaleratio: 1,     // This maintains the aspect ratio
      },
      height: 600,
      showlegend: false,
      margin: { t: 20, r: 80, b: 60, l: 80 },
      hovermode: "closest"
    } as Partial<Layout>;
  });
  
  return (
    <Plot
      data={plotData()}
      layout={plotLayout()}
      config={plotlyConfig()}
      style={{ width: "100%", height: "100%" }}
    />
  );
}