import Plot from "@ralphsmith80/solid-plotly.js";
import { Layout, PlotData } from "plotly.js-dist-min";
import { plotlyConfig } from "~/lib/plots";
import { FilterSettings, RawDataCategory } from "~/types";
import { createMemo } from "solid-js";

type Props = {
  data: RawDataCategory;
  filterSettings: FilterSettings;
  additionalAxes: boolean;
  colorFieldName?: string;
};

// Create trace for a set of data points
function createTrace(
  x: Array<number | string | Date | null>, 
  y: Array<number | string | Date | null>, 
  name: string, 
  color?: Array<number | string> | string | undefined, 
  isSpatial: boolean = false, 
  axisIndex: number = 0
): Partial<PlotData> {
  return {
    type: "scatter",
    mode: "markers",
    x, y, name,
    marker: {
      size: isSpatial ? 6 : 8,
      opacity: 0.7,
      color,
      line: { width: isSpatial ? 1 : 0, color: 'rgba(0,0,0,0.3)' }
    },
    xaxis: axisIndex > 0 ? `x${axisIndex}` : "x",
    yaxis: axisIndex > 0 ? `y${axisIndex}` : "y",
    showlegend: axisIndex === 0, // Only show legend for the first trace
  };
}

// Create basic layout with axes
function createLayout(
  xTitle: string, 
  yTitle: string, 
  height?: number, 
  isSpatial: boolean = false
): Partial<Layout> {
  return {
    xaxis: {
      title: xTitle,
      fixedrange: !isSpatial,
      automargin: true,
    },
    yaxis: {
      title: yTitle,
      fixedrange: !isSpatial,
      automargin: true,
    },
    height: height || 400,
    showlegend: true,
    margin: { t: 20, r: 30, b: 60, l: 80 },
    hovermode: "closest"
  };
}

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

export function ScatterPlot(props: Props) {
  // Check if data has spatial coordinates
  const hasSpatialCoords = createMemo(() => {
    return props.data.columns.some(c => c.name === "x_coord") &&
           props.data.columns.some(c => c.name === "y_coord");
  });
  
  // Determine x and y field names
  const xFieldName = createMemo(() => {
    return (hasSpatialCoords() && props.filterSettings.visualizationType === "spatial") 
      ? "x_coord" : props.filterSettings.field;
  });
  
  const yFieldName = createMemo(() => {
    if (hasSpatialCoords() && props.filterSettings.visualizationType === "spatial") {
      return "y_coord";
    }
    // Fallback to first available column that's not the x field
    return props.filterSettings.yField || 
      (props.data.columns[0]?.name !== xFieldName() ? 
        props.data.columns[0]?.name : props.data.columns[1]?.name);
  });
  
  const isSpatial = createMemo(() => 
    xFieldName() === "x_coord" && yFieldName() === "y_coord"
  );
  
  // If we don't have proper fields, show error
  if (!xFieldName() || !yFieldName()) {
    return <div>Error: Missing X or Y field for scatter plot</div>;
  }
  
  // Create plot data
  const plotData = createMemo(() => {
    const xColumn = props.data.columns.find(c => c.name === xFieldName());
    const yColumn = props.data.columns.find(c => c.name === yFieldName());
    
    if (!xColumn || !yColumn) return [];
    
    const xValues = xColumn.data;
    const yValues = yColumn.data;
    
    // Simple case - no grouping
    if (!props.filterSettings.groupBy) {
      return [createTrace(
        xValues, 
        yValues, 
        "All Data", 
        props.colorFieldName ? getColorValues() : undefined,
        isSpatial()
      )];
    }
    
    // Handle grouped data
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return [];
    
    const groupValues = groupColumn.data;
    const uniqueGroups = [...new Set(groupValues)].sort();
    
    // For multiple plots per group
    if (props.additionalAxes) {
      const plots: Partial<PlotData>[] = [];
      
      // Create individual plots for each group
      uniqueGroups.forEach((group, i) => {
        const indices = groupValues.map((val, idx) => val === group ? idx : -1).filter(idx => idx !== -1);
        const filteredX = indices.map(idx => xValues[idx]);
        const filteredY = indices.map(idx => yValues[idx]);
        const groupName = groupColumn.categories?.[group] || `Group ${group}`;
        
        plots.push(createTrace(
          filteredX, 
          filteredY, 
          groupName,
          props.colorFieldName ? indices.map(idx => getColorValues()?.[idx]) : undefined,
          isSpatial(),
          i + 1
        ));
      });
      
      return plots;
    }
    
    // Regular grouped plot (all on same axes)
    return uniqueGroups.map((group, i) => {
      const indices = groupValues.map((val, idx) => val === group ? idx : -1).filter(idx => idx !== -1);
      const filteredX = indices.map(idx => xValues[idx]);
      const filteredY = indices.map(idx => yValues[idx]);
      const groupName = groupColumn.categories?.[group] || `Group ${group}`;
      
      return createTrace(
        filteredX, 
        filteredY, 
        groupName,
        props.colorFieldName ? indices.map(idx => getColorValues()?.[idx]) : undefined,
        isSpatial()
      );
    });
  });
  
  // Get color values if needed
  function getColorValues() {
    const colorField = isSpatial() ? props.filterSettings.field : props.colorFieldName;
    if (!colorField) return undefined;
    
    const colorColumn = props.data.columns.find(c => c.name === colorField);
    return colorColumn?.data;
  }
  
  // Create plot layout
  const plotLayout = createMemo(() => {
    const xTitle = isSpatial() ? "X Position (µm)" : (props.filterSettings.label || xFieldName());
    const yTitle = isSpatial() ? "Y Position (µm)" : (props.filterSettings.yLabel || yFieldName());
    
    // Simple case - no grouping or additionalAxes is false
    if (!props.filterSettings.groupBy || !props.additionalAxes) {
      return createLayout(xTitle, yTitle, isSpatial() ? 600 : 400, isSpatial());
    }
    
    // Handle grouped data with additionalAxes
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return createLayout(xTitle, yTitle, 400, isSpatial());
    
    const groupValues = groupColumn.data;
    const uniqueGroups = [...new Set(groupValues)].sort();
    const numGroups = uniqueGroups.length;
    
    // Calculate grid dimensions
    const columns = 2;
    const rows = Math.ceil(numGroups / columns);
    
    // Calculate height based on number of rows - increase per-row height for better spacing
    const height = Math.max(400, 400 * rows);
    
    // Create a base layout with consistent sizing for subplots
    const layout: Record<string, any> = {
      height: height,
      showlegend: false,
      margin: { t: 50, r: 30, b: 60, l: 80 },
      hovermode: "closest",
      annotations: [],
      // Add proper spacing between plots
      grid: {
        rows: rows,
        columns: columns,
        pattern: 'independent',
        roworder: 'top to bottom',
        xgap: 0.15, // 15% spacing between columns
        ygap: 0.3   // Increased to 30% spacing between rows
      }
    };
    
    // Create axes for each group
    uniqueGroups.forEach((group, i) => {
      const row = Math.floor(i / columns) + 1; // 1-indexed for Plotly grid
      const col = (i % columns) + 1; // 1-indexed for Plotly grid
      
      const groupName = groupColumn.categories?.[group] || `Group ${group}`;
      
      // Add x-axis (let Plotly handle domain calculations)
      layout[`xaxis${i+1}`] = {
        title: xTitle,
        fixedrange: !isSpatial(),
        automargin: true,
        anchor: `y${i+1}`
      };
      
      // Add y-axis (let Plotly handle domain calculations)
      layout[`yaxis${i+1}`] = {
        title: col === 1 ? yTitle : '', // Only add title to leftmost column
        fixedrange: !isSpatial(),
        automargin: true,
        anchor: `x${i+1}`
      };
      
      // Add annotation for group name with better positioning
      layout.annotations.push({
        text: `<b>${groupName}</b>`,
        xref: `x${i+1} domain`,
        yref: `y${i+1} domain`,
        x: 0.5,
        y: 1.05,
        xanchor: 'center',
        yanchor: 'bottom',
        showarrow: false,
        font: { size: 14 },
      });
    });

    return layout;
  });
  
  return (
    <Plot
      data={plotData()}
      layout={plotLayout()}
      config={{
        ...plotlyConfig(),
        scrollZoom: isSpatial(),
        displayModeBar: true,
      }}
      useResizeHandler={true}
      style={{ width: "100%", height: "100%" }}
    />
  );
}