import Plot from "@ralphsmith80/solid-plotly.js";
import _ from "lodash";
import { Layout, PlotData } from "plotly.js-dist-min";
import { cutoffShape, plotlyConfig, recurringColours } from "~/lib/plots";
import { FilterSettings, RawDataCategory } from "~/types";
import { createMemo } from "solid-js";

type Props = {
  data: RawDataCategory;
  filterSettings: FilterSettings;
  additionalAxes: boolean;
  colorFieldName?: string;
};

// Helper function to create an axis annotation
function createAxisAnnotation(
  text: string, 
  position: number, 
  fontSize: number = 13
): Partial<Layout["annotations"][0]> {
  return {
    text,
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

// Helper function to detect if we're plotting spatial coordinates
function isSpatialPlot(xField: string, yField: string): boolean {
  return (xField === "spatial_coord_x" && yField === "spatial_coord_y");
}

// Add this helper function to generate friendly names for the color scale
function getColorbarTitle(fieldName: string | undefined): string {
  if (!fieldName) return '';
  
  const friendlyNames: {[key: string]: string} = {
    'total_counts': 'UMI Count',
    'num_nonzero_vars': 'Gene Count',
    'fraction_mitochondrial': 'Mito %',
    'fraction_ribosomal': 'Ribo %',
    'pct_of_counts_in_top_50_vars': 'Top 50 Genes %',
    'cellbender_cell_probability': 'Cell Probability',
    'cellbender_background_fraction': 'Background %',
    'cellbender_cell_size': 'Cell Size',
    'cellbender_droplet_efficiency': 'Droplet Efficiency'
  };
  
  return friendlyNames[fieldName] || fieldName;
}

// Update scatterData function to handle the subplot layout for grouped spatial plots
function scatterData(props: {
  data: RawDataCategory;
  xFieldName: string;
  yFieldName: string;
  colorFieldName?: string;
  groupName?: string;
  additionalAxes?: boolean;
  zoomMinX?: number;
  zoomMaxX?: number;
  zoomMinY?: number;
  zoomMaxY?: number;
  isSpatial?: boolean;
}): Partial<PlotData>[] {
  const xColumn = props.data.columns.find(c => c.name === props.xFieldName);
  const yColumn = props.data.columns.find(c => c.name === props.yFieldName);
  
  if (!xColumn || !yColumn) return [];

  const xValues = xColumn.data as number[];
  const yValues = yColumn.data as number[];
  
  // Handle color field if provided
  let colorValues: any[] = [];
  let colorCategories: string[] = [];
  
  if (props.colorFieldName) {
    const colorColumn = props.data.columns.find(c => c.name === props.colorFieldName);
    if (colorColumn) {
      colorValues = colorColumn.data;
      colorCategories = colorColumn.categories || [];
    }
  }
  
  const groupColumn = props.groupName
    ? props.data.columns.find(c => c.name === props.groupName)
    : undefined;
  if (props.groupName && !groupColumn) return [];

  // Default marker settings
  const defaultMarkerProps = {
    size: props.isSpatial ? 6 : 8,
    opacity: 0.7,
    color: props.colorFieldName ? colorValues : recurringColours.pass,
    colorscale: 'Viridis',
    showscale: props.colorFieldName && props.isSpatial ? true : false,  // Show color scale
    colorbar: props.colorFieldName && props.isSpatial ? {
      title: getColorbarTitle(props.colorFieldName), // Change to simple string
      thickness: 15,
      len: 0.5,
      y: 0.5,
      yanchor: 'middle' as "middle" | "top" | "bottom",
      outlinewidth: 0,
    } : undefined,
    line: {
      width: props.isSpatial ? 1 : 0,
      color: 'rgba(0,0,0,0.3)'
    }
  };

  // If no grouping is requested, return a single scatter plot
  if (!groupColumn) {
    const trace: Partial<PlotData> = {
      type: "scatter" as const,
      mode: "markers" as const,
      x: xValues,
      y: yValues,
      marker: defaultMarkerProps,
      name: "All Data"
    };
    
    // Add text hover if we have categories for color
    if (props.colorFieldName && colorCategories.length > 0) {
      trace.text = colorValues.map(val => colorCategories[val as number] || val);
      trace.hoverinfo = "x+y+text";
    }
    
    return [trace];
  }
  
  // With grouping
  const groupValues = groupColumn.data as number[];
  const uniqueGroups = Array.from(new Set(groupValues)).sort((a, b) => a - b);
  const groupNames = groupColumn.categories
    ? uniqueGroups.map(idx => groupColumn.categories![idx as number])
    : uniqueGroups.map(v => `Group ${v}`);
  
  // Create one trace per group
  const traces: Partial<PlotData>[] = uniqueGroups.map((groupIdx, i) => {
    // Filter data points that belong to this group
    const indices = groupValues.map((val, idx) => val === groupIdx ? idx : -1).filter(idx => idx !== -1);
    const filteredX = indices.map(idx => xValues[idx]);
    const filteredY = indices.map(idx => yValues[idx]);
    
    let filteredColors: any[] = [];
    if (props.colorFieldName) {
      filteredColors = indices.map(idx => colorValues[idx]);
    }
    
    // Set up marker properties
    let markerProps;
    if (props.colorFieldName) {
      markerProps = {
        ...defaultMarkerProps,
        color: filteredColors,
        // Only show colorbar on the first subplot in grouped view
        showscale: i === 0 && props.isSpatial,
        colorbar: i === 0 && props.isSpatial ? {
          title: getColorbarTitle(props.colorFieldName), // Change to simple string
          thickness: 15,
          len: 0.5,
          y: 0.5,
          yanchor: 'middle' as "middle" | "top" | "bottom",
          outlinewidth: 0,
          // Position the colorbar to the right of all plots
          x: 1.05
        } : undefined
      };
    } else {
      // Use object destructuring to avoid TypeScript errors with delete
      const { color, colorscale, showscale, colorbar, ...restMarkerProps } = defaultMarkerProps;
      markerProps = restMarkerProps;
    }
    
    // Create the trace
    const trace: Partial<PlotData> = {
      type: "scatter" as const,
      mode: "markers" as const,
      x: filteredX,
      y: filteredY,
      name: groupNames[i],
      marker: markerProps,
    };
    
    // For spatial plots with grouping and additional axes, set xaxis and yaxis subplot references
    if (props.isSpatial && props.additionalAxes) {
      trace.xaxis = `x${i+1}`;
      trace.yaxis = `y${i+1}`;
      trace.showlegend = false; // Hide legend for spatial groups as we'll use annotations
    } else {
      trace.xaxis = "x";
      trace.yaxis = props.additionalAxes ? `y${i + 1}` : "y";
    }
    
    // Add text hover if we have categories for color
    if (props.colorFieldName && colorCategories.length > 0) {
      trace.text = filteredColors.map(val => colorCategories[val as number] || val);
      trace.hoverinfo = "x+y+text";
    }
    
    return trace;
  });
  
  return traces;
}

// Update the scatterLayout function to fix title positioning and prevent overlapping

function scatterLayout(props: {
  data: RawDataCategory;
  xTitle: string;
  yTitle: string;
  xMinCutoff?: number;
  xMaxCutoff?: number;
  yMinCutoff?: number;
  yMaxCutoff?: number;
  groupName?: string;
  additionalAxes: boolean;
  xType: "log" | "linear";
  yType: "log" | "linear";
  isSpatial?: boolean;
}): Partial<Layout> {
  // Initial setup remains the same
  let height = props.isSpatial ? 600 : 400;
  const annotations: Partial<Layout["annotations"][0]>[] = [];
  let groupYAxes: { [key: string]: Partial<Layout["yaxis"]> } = {};
  let groupXAxes: { [key: string]: Partial<Layout["xaxis"]> } = {};
  let grid: Partial<Layout["grid"]> = {};
  
  // Get group information if available
  const groupColumn = props.groupName
    ? props.data.columns.find(c => c.name === props.groupName)
    : undefined;

  // Configure layout for spatial plot
  if (props.isSpatial) {
    // For spatial plots, configure equal scaling and other settings
    const spatialLayout: Partial<Layout> = {
      showlegend: props.groupName ? true : false,
      legend: props.groupName ? {
        orientation: "h",
        yanchor: "bottom",
        y: 1.02,
        xanchor: "right",
        x: 1
      } : undefined,
      // Significantly increase bottom margin to make room for x-axis labels and titles
      margin: { t: 30, r: 30, b: 120, l: 70 },
      dragmode: "pan",
      hovermode: "closest",
    };

    // If we have grouping, adjust layout to create one subplot per group
    if (groupColumn && props.additionalAxes) {
      const actualValues = groupColumn.data as number[];
      const uniqueIndices = Array.from(new Set(actualValues)).sort((a, b) => a - b);
      const groupNames = groupColumn.categories 
        ? uniqueIndices.map(idx => groupColumn.categories![idx as number])
        : uniqueIndices.map(v => `Group ${v}`);
      
      // Always use 2 columns for the grid layout (unless there's only 1 group)
      const numGroups = groupNames.length;
      const cols = numGroups > 1 ? 2 : 1;
      const rows = Math.ceil(numGroups / cols);
      
      // Increase height to accommodate more space between plots
      height = Math.max(300 * rows, 500); // Calculate height based on number of rows
      
      // Create grid layout with more padding between rows and columns
      grid = {
        rows: rows,
        columns: cols,
        pattern: "independent",
        roworder: "top to bottom",
        ygap: 0.20, // Increased gap between rows to accommodate titles (20% of the available height)
        xgap: 0.12, // Slightly increased gap between columns
      };
      
      // Create subplots for each group
      for (let i = 0; i < groupNames.length; i++) {
        const row = Math.floor(i / cols) + 1;
        const col = (i % cols) + 1;
        
        // Calculate domain ranges with consideration for gaps
        const effectiveRowHeight = 1 / rows;
        const yStart = 1 - row * effectiveRowHeight;
        const yEnd = 1 - (row - 1) * effectiveRowHeight;
        
        // Adjust for gaps between plots
        const adjustedYStart = yStart + (row > 1 ? grid.ygap! / (2 * rows) : 0);
        const adjustedYEnd = yEnd - (row < rows ? grid.ygap! / (2 * rows) : 0);
        
        // Create x-axis for this subplot with tick labels
        groupXAxes[`xaxis${i+1}`] = {
          scaleanchor: `y${i+1}` as any,
          scaleratio: 1,
          showgrid: true,
          gridcolor: 'rgba(200,200,200,0.2)',
          zeroline: false,
          showticklabels: true,
          title: {
            text: "X Position (µm)",
            font: { size: 12 },
            standoff: 20, // Increase standoff to create more space for axis title
          },
          tickfont: { size: 10 },
          domain: [(col-1)/cols, col/cols],
          automargin: true,
        };
        
        // Create y-axis for this subplot with tick labels
        groupYAxes[`yaxis${i+1}`] = {
          showgrid: true,
          gridcolor: 'rgba(200,200,200,0.2)',
          zeroline: false,
          showticklabels: true,
          title: {
            text: "Y Position (µm)",
            font: { size: 12 },
            standoff: 10, // Add standoff to create more space between axis and title
          },
          tickfont: { size: 10 },
          domain: [adjustedYStart, adjustedYEnd],
          // Add extra space for left axis ticks and titles
          automargin: true,
        };
        
        // Add annotation for group name BELOW the plot with increased spacing
        annotations.push({
          text: groupNames[i],
          font: { size: 14, color: '#333', family: 'Arial, sans-serif', weight: 700 },
          showarrow: false,
          xref: 'paper',
          yref: 'paper',
          x: (col - 0.5) / cols,
          // Position title even lower to avoid overlap with x-axis labels
          y: adjustedYStart - 0.12, 
          xanchor: 'center',
          yanchor: 'top',
          bgcolor: 'rgba(255,255,255,0.8)',
          borderpad: 4,
        });
      }
      
      // Return combined layout
      return {
        ...spatialLayout,
        height,
        grid,
        ...groupXAxes,
        ...groupYAxes,
        annotations,
      };
    } else {
      // Single spatial plot with tick labels and axis titles
      return {
        ...spatialLayout,
        height,
        xaxis: {
          scaleanchor: "y",
          scaleratio: 1,
          showgrid: true,
          gridcolor: 'rgba(200,200,200,0.2)',
          zeroline: false,
          showticklabels: true,
          title: {
            text: "X Position (µm)",
            font: { size: 14 },
            standoff: 15, // Add space between axis and title
          },
          tickfont: { size: 10 },
          automargin: true,
        },
        yaxis: {
          showgrid: true,
          gridcolor: 'rgba(200,200,200,0.2)',
          zeroline: false,
          showticklabels: true,
          title: {
            text: "Y Position (µm)",
            font: { size: 14 },
            standoff: 15, // Add space between axis and title
          },
          tickfont: { size: 10 },
          automargin: true,
        },
      };
    }
  }
  
  // Non-spatial plot layout logic remains unchanged
  if (groupColumn && props.additionalAxes) {
    // Get only the group values that actually exist in the filtered data
    const actualValues = groupColumn.data as number[];
    const uniqueIndices = Array.from(new Set(actualValues)).sort((a, b) => a - b);
    
    // Map these to category names
    const groupNames = groupColumn.categories 
      ? uniqueIndices.map(idx => groupColumn.categories![idx as number])
      : uniqueIndices.map(v => `Group ${v}`);
    
    const totalPlots = groupNames.length;
    const plotHeight = 1.0 / totalPlots;
    
    // Create annotations for each group
    groupNames.forEach((label, i) => {
      const midPoint = 1.0 - ((i + 0.5) * plotHeight);
      annotations.push(createAxisAnnotation(label, midPoint));
    });
    
    // Create y-axes configuration
    groupYAxes = Object.fromEntries(
      groupNames.map((_, i) => {
        return [`yaxis${i + 1}`, {
          side: "left" as const,
          title: i === Math.floor(groupNames.length / 2) ? props.yTitle : "",
          fixedrange: true,
          type: props.yType,
          automargin: true,
          showticklabels: true,
        }];
      })
    );
    
    // Configure subplot grid
    grid = {
      columns: 1,
      rows: groupNames.length,
      subplots: groupNames.map((_, i) => `xy${i + 1}`),
    };
    
    // Adjust height based on number of plots
    height = Math.max(400, 200 * groupNames.length);
  } else {
    // Single plot
    groupYAxes = {
      yaxis: {
        title: props.yTitle,
        fixedrange: true,
        type: props.yType,
        automargin: true,
        showticklabels: true,
      }
    };
  }

  return {
    xaxis: {
      title: props.xTitle,
      type: props.xType,
      fixedrange: true,
      automargin: true,
      titlefont: { size: 14 },
    },
    ...groupYAxes,
    annotations,
    showlegend: true,
    height,
    grid,
    margin: {
      b: 60,
      t: 20,
      l: 80,
      r: 30,
      pad: 4,
    },
  };
}

// Update the ScatterPlot component function to use these axis labels
export function ScatterPlot(props: Props) {
  // Check if spatial coordinates exist in the data
  const hasSpatialCoords = createMemo(() => {
    const hasX = props.data.columns.some(c => c.name === "spatial_coord_x");
    const hasY = props.data.columns.some(c => c.name === "spatial_coord_y"); 
    return hasX && hasY;
  });
  
  // Prioritize spatial coordinates if they exist
  const xFieldName = createMemo(() => {
    if (hasSpatialCoords() && props.filterSettings.visualizationType === "spatial") {
      return "spatial_coord_x";
    }
    return props.filterSettings.field;
  });
  
  const yFieldName = createMemo(() => {
    if (hasSpatialCoords() && props.filterSettings.visualizationType === "spatial") {
      return "spatial_coord_y";
    }
    return props.filterSettings.yField || 
      (props.data.columns[0]?.name !== xFieldName() ? 
        props.data.columns[0]?.name : 
        props.data.columns[1]?.name);
  });
  
  // Determine if this is a spatial plot
  const isSpatialPlot = createMemo(() => 
    xFieldName() === "spatial_coord_x" && yFieldName() === "spatial_coord_y"
  );
  
  // If we don't have proper x and y fields, return error message
  if (!xFieldName() || !yFieldName()) {
    return <div>Error: Missing X or Y field for scatter plot</div>;
  }
  
  // Choose appropriate color field for spatial plots
  const effectiveColorField = createMemo(() => {
    if (isSpatialPlot()) {
      // For spatial plots, prioritize total_counts as color if available
      const hasUMI = props.data.columns.some(c => c.name === "total_counts");
      if (hasUMI) return "total_counts";
      
      // Second choice: num_nonzero_vars
      const hasGenes = props.data.columns.some(c => c.name === "num_nonzero_vars");
      if (hasGenes) return "num_nonzero_vars";
    }
    
    return props.colorFieldName;
  });

  // Add a new function to get a human-readable color field label
  const getColorFieldLabel = createMemo(() => {
    const fieldName = effectiveColorField();
    if (!fieldName) return '';
    
    const friendlyNames: {[key: string]: string} = {
      'total_counts': 'UMI Count',
      'num_nonzero_vars': 'Gene Count',
      'fraction_mitochondrial': 'Mito %',
      'fraction_ribosomal': 'Ribo %',
      'pct_of_counts_in_top_50_vars': 'Top 50 Genes %',
      'cellbender_cell_probability': 'Cell Probability',
      'cellbender_background_fraction': 'Background %',
      'cellbender_cell_size': 'Cell Size',
      'cellbender_droplet_efficiency': 'Droplet Efficiency'
    };
    
    return friendlyNames[fieldName] || fieldName;
  });
  
  // Modify scatterLayout to show a single colorbar for all subplots
  const customLayout = createMemo(() => {
    const baseLayout = scatterLayout({
      data: props.data,
      xTitle: isSpatialPlot() ? "X Position (µm)" : (props.filterSettings.label || xFieldName()),
      yTitle: isSpatialPlot() ? "Y Position (µm)" : (props.filterSettings.yLabel || yFieldName()),
      xMinCutoff: props.filterSettings.cutoffMin,
      xMaxCutoff: props.filterSettings.cutoffMax,
      yMinCutoff: props.filterSettings.cutoffMinY,
      yMaxCutoff: props.filterSettings.cutoffMaxY,
      groupName: props.filterSettings.groupBy,
      additionalAxes: props.additionalAxes,
      xType: props.filterSettings.xAxisType || "linear",
      yType: props.filterSettings.yAxisType || "linear",
      isSpatial: isSpatialPlot(),
    });
    
    // For grouped spatial plots, customize colorbar position
    if (isSpatialPlot() && props.filterSettings.groupBy && props.additionalAxes) {
      return {
        ...baseLayout,
        // Add a title for the colorbar at the top right
        annotations: [
          ...(baseLayout.annotations || []),
          {
            text: getColorFieldLabel(),
            font: { size: 14, color: '#333' },
            showarrow: false,
            xref: 'paper',
            yref: 'paper',
            x: 1.02,
            y: 1,
            xanchor: 'left',
            yanchor: 'top'
          }
        ]
      };
    }
    
    return baseLayout;
  });
  
  return (
    <Plot
      data={scatterData({
        data: props.data,
        xFieldName: xFieldName(),
        yFieldName: yFieldName(),
        colorFieldName: effectiveColorField(),
        groupName: props.filterSettings.groupBy,
        additionalAxes: props.additionalAxes,
        zoomMinX: props.filterSettings.zoomMin,
        zoomMaxX: props.filterSettings.zoomMax,
        zoomMinY: props.filterSettings.zoomMinY,
        zoomMaxY: props.filterSettings.zoomMaxY,
        isSpatial: isSpatialPlot(),
      })}
      layout={customLayout()}
      config={{
        ...plotlyConfig(),
        scrollZoom: isSpatialPlot(),
        displayModeBar: true,
        modeBarButtonsToAdd: ['select2d', 'lasso2d'],
        modeBarButtonsToRemove: ['autoScale2d'],
      }}
      useResizeHandler={true}
      style={{ width: "100%", height: "100%" }}
    />
  );
}