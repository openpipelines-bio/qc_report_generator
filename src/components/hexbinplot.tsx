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
        baseSizeMultiplier * Math.sqrt(500 / totalBins)  // Scale based on bin density
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

    // If no groupBy, just return a single plot
    if (!props.filterSettings.groupBy) {
      return [{
        type: "scatter",
        mode: "markers",
        x: filteredX,
        y: filteredY,
        marker: {
          symbol: "hexagon2",
          size: hexSize,
          color: filteredColor,
          colorscale: customColorScale,
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
    }

    // If we have a groupBy, create multiple plots
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return [];

    // We need to ensure consistent filtering between Total and individual plots
    const rawGroupData = groupColumn.data;

    // First, identify valid groups
    const definedGroups = [...new Set(rawGroupData)].filter(g => g !== undefined && g !== null).sort();
    const hasOnlySingleGroup = definedGroups.length === 1;

    // Create a processed version of groupData that handles undefined/null properly
    const processedGroupData: (number | string | undefined | null)[] = [];
    for (let i = 0; i < filteredIndices.length; i++) {
      // Get the original index before filtering
      const originalIndex = filteredIndices[i];
      // Get the group value for this data point
      let group = rawGroupData[originalIndex];
      
      // If there's only one group and this point has no group, assign it to that group
      if (hasOnlySingleGroup && (group === undefined || group === null)) {
        group = definedGroups[0];
      }
      
      processedGroupData.push(group);
    }

    // Now use the processed group data for all subsequent operations
    const uniqueGroups = definedGroups;
    const plots: Partial<PlotData>[] = [];
    
    // First add the "Total" plot with ALL valid filtered data
    plots.push({
      type: "scatter",
      mode: "markers",
      x: filteredX,
      y: filteredY,
      marker: {
        symbol: "hexagon2",
        size: hexSize,
        color: filteredColor,
        colorscale: customColorScale,
        // Only show colorbar if there are no group plots
        colorbar: uniqueGroups.length === 0 ? {
          title: props.filterSettings.label || colorField() || "",
          titleside: "right",
          thickness: 15,
          len: 0.75,
          y: 0.5,
          yanchor: 'middle'
        } : undefined,  // No colorbar for Total when we have group plots
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
      xaxis: "x",
      yaxis: "y",
      name: "Total",
      showlegend: false,
    } as Partial<PlotData>);

    // Then add individual plots for each group using the processed group data
    uniqueGroups.forEach((group, i) => {
      // Find indices within the already-filtered data
      const groupIndices = [];
      for (let j = 0; j < processedGroupData.length; j++) {
        if (processedGroupData[j] === group) {
          groupIndices.push(j);
        }
      }
      
      // Filter data for this group
      const groupX = groupIndices.map(idx => filteredX[idx]);
      const groupY = groupIndices.map(idx => filteredY[idx]);
      const groupColor = groupIndices.map(idx => filteredColor[idx]);
      const groupCounts = groupIndices.map(idx => filteredCounts[idx]);
      const groupName = groupColumn.categories?.[group] || `Group ${group}`;
      
      // Only show colorbar on the LAST plot, regardless of position
      const showColorbar = (i === uniqueGroups.length - 1);
      
      plots.push({
        type: "scatter",
        mode: "markers",
        x: groupX,
        y: groupY,
        marker: {
          symbol: "hexagon2",
          size: hexSize,
          color: groupColor,
          colorscale: customColorScale,
          colorbar: showColorbar ? {
            title: props.filterSettings.label || colorField() || "",
            titleside: "right",
            thickness: 15,
            len: 0.75,
            y: 0.5,
            yanchor: 'middle'
          } : undefined,
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
        customdata: groupCounts,
        xaxis: `x${i+2}`, // Start from x2 as x1 is for Total
        yaxis: `y${i+2}`, // Start from y2 as y1 is for Total
        name: groupName,
        showlegend: false,
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
          zerolinewidth: 1,     // Make zero line same width as other grid lines
          zerolinecolor: 'lightgray', // Match color with grid lines
          gridwidth: 1,         // Ensure consistent grid line width
        },
        yaxis: {
          title: "Y Position (µm)",
          fixedrange: false,
          automargin: true,
          scaleanchor: "x",     // This ensures equal scaling
          scaleratio: 1,        // This maintains the aspect ratio
          zerolinewidth: 1,     // Make zero line same width as other grid lines
          zerolinecolor: 'lightgray', // Match color with grid lines
          gridwidth: 1,         // Ensure consistent grid line width
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
    
    // Make sure to filter out undefined/null groups here too
    const uniqueGroups = [...new Set(groupColumn.data)].filter(g => g !== undefined && g !== null).sort();
    const totalPlots = uniqueGroups.length + 1; // +1 for Total plot
    
    // Calculate grid dimensions
    const columns = 2;
    const rows = Math.ceil(totalPlots / columns);
    const height = Math.max(600, rows * 400); // Base height of 400px per row
    
    const layout: Record<string, any> = {
      height: height,
      showlegend: false,
      margin: { t: 50, r: 80, b: 60, l: 80 },
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
    // First for the "Total" plot (always in top-left)
    layout.xaxis = {
      title: "X Position (µm)",
      fixedrange: false,
      automargin: true,
      zerolinewidth: 1,
      zerolinecolor: 'lightgray',
      gridwidth: 1
    };
    layout.yaxis = {
      title: "Y Position (µm)",
      fixedrange: false,
      automargin: true,
      scaleanchor: "x",
      scaleratio: 1,
      zerolinewidth: 1,
      zerolinecolor: 'lightgray',
      gridwidth: 1
    };
    
    // Add annotation for Total plot
    layout.annotations.push({
      text: "<b>Total</b>",
      xref: "x domain",
      yref: "y domain",
      x: 0.5,
      y: 1.05,
      xanchor: "center",
      yanchor: "bottom",
      showarrow: false,
      font: { size: 14 }
    });
    
    // Then for each group plot
    uniqueGroups.forEach((group, i) => {
      const axisIndex = i + 2; // +2 because "Total" uses x/y axes 1
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
    <Plot
      data={plotData()}
      layout={plotLayout()}
      config={plotlyConfig()}
      style={{ width: "100%", height: "100%" }}
    />
  );
}