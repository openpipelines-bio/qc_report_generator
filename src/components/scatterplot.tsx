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

// Improved hexbin implementation for perfectly tessellated grid
function hexbin(
  xValues: Array<number>,
  yValues: Array<number>,
  colorValues?: Array<number>,
  binSize: number = 20
) {
  // Create a map to store counts for each hexagon
  const hexCounts = new Map<string, {count: number, sumColor: number, x: number, y: number}>();
  
  // Find the min/max values to determine the grid bounds
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  
  // Hexagonal grid constants - these values are critical for proper tessellation
  const hexWidth = binSize * 2;
  const hexHeight = Math.sqrt(3) * binSize;
  
  // For perfect tessellation, the horizontal distance between centers is 3/2 radius
  const dx = 1.5 * binSize;
  // The vertical distance between centers is sqrt(3) * radius
  const dy = hexHeight;
  
  // Calculate grid boundaries without extra padding
  const xStart = Math.floor(xMin / dx) * dx;
  const xEnd = Math.ceil(xMax / dx) * dx;
  const yStart = Math.floor(yMin / dy) * dy;
  const yEnd = Math.ceil(yMax / dy) * dy;
  
  // Create grid of hexagon centers
  const hexCenters = [];
  
  for (let y = yStart; y <= yEnd; y += dy) {
    // For odd rows, offset the x position by dx/2
    const isOddRow = Math.round(y / dy) % 2 !== 0;
    const xOffset = isOddRow ? dx / 2 : 0;
    
    for (let x = xStart; x <= xEnd; x += dx) {
      const centerX = x + xOffset;
      const centerY = y;
      
      const key = `${Math.round(centerX * 10000)},${Math.round(centerY * 10000)}`;
      
      hexCenters.push({ x: centerX, y: centerY, key });
      
      // Initialize with zero counts - this ensures ALL grid cells are represented
      hexCounts.set(key, { 
        count: 0, 
        sumColor: 0, 
        x: centerX,
        y: centerY
      });
    }
  }
  
  // Assign data points to hexagons - this ensures accurate counts
  for (let i = 0; i < xValues.length; i++) {
    const x = xValues[i];
    const y = yValues[i];
    
    // Find the nearest hexagon center
    // This is the critical part for accurate counting
    let minDist = Infinity;
    let nearestCenter = null;
    
    for (const center of hexCenters) {
      const dist = Math.pow(center.x - x, 2) + Math.pow(center.y - y, 2);
      if (dist < minDist) {
        minDist = dist;
        nearestCenter = center;
      }
    }
    
    if (nearestCenter) {
      const binData = hexCounts.get(nearestCenter.key);
      if (binData) {
        binData.count += 1;
        if (colorValues && colorValues[i] !== undefined) {
          binData.sumColor += colorValues[i];
        }
        hexCounts.set(nearestCenter.key, binData);
      }
    }
  }
  
  // Convert to arrays for plotting
  const xCenters: number[] = [];
  const yCenters: number[] = [];
  const counts: number[] = [];
  const avgColors: number[] = [];
  
  hexCounts.forEach((bin) => {
    // Include ALL hexagons for complete coverage, but make empty ones transparent
    // if (bin.count > 0) {
    xCenters.push(bin.x);
    yCenters.push(bin.y);
    counts.push(bin.count);
    if (colorValues) {
      avgColors.push(bin.count > 0 ? bin.sumColor / bin.count : 0);
    }
    // }
  });
  
  return {
    x: xCenters,
    y: yCenters,
    counts: counts,
    avgColors: colorValues ? avgColors : undefined
  };
}

// Create a uniform hexbin visualization with fixed-size hexagons
function createUniformHexbinTrace(
  xValues: Array<number>,
  yValues: Array<number>,
  colorValues?: Array<number>,
  name: string = "Hexbin",
  colorbarTitle?: string,
  binSize: number = 20
): Partial<PlotData> {
  // Use our custom hexbin function to create the bins
  const hexbinData = hexbin(xValues, yValues, colorValues, binSize);
  
  // Calculate the proper marker size to ensure hexagons touch each other
  const hexWidth = binSize * 2;
  const scaleFactor = window.innerWidth / 1200; // Adapt to screen size
  const markerSize = hexWidth * 1.732 * scaleFactor; // √3 ≈ 1.732
  
  return {
    type: "scatter",
    mode: "markers",
    x: hexbinData.x,
    y: hexbinData.y,
    name,
    marker: {
      symbol: 'hexagon',
      size: markerSize,
      color: hexbinData.avgColors || hexbinData.counts,
      // Keep the YlGnBu colorscale but ensure it goes from light to dark
      colorscale: 'YlGnBu', 
      reversescale: true, // Ensure low values are light, high values are dark
      colorbar: {
        title: colorbarTitle || "Count",
        titleside: "right",
        thickness: 15,
        len: 300,
        lenmode: 'pixels',
        y: 0.5,
        yanchor: 'middle',
        x: 1.05,
        xanchor: "left"
      },
      line: {
        width: 0.5, 
        color: 'rgba(255,255,255,0.5)'
      },
      opacity: 1.0,
    },
    hovertemplate: 'Count: %{marker.color}<br>X: %{x}<br>Y: %{y}<extra></extra>',
  };
}

// Standard scatter plot trace creation
function createTrace(
  x: Array<number | string | Date | null>, 
  y: Array<number | string | Date | null>, 
  name: string, 
  color?: Array<number | string> | string | undefined, 
  isSpatial: boolean = false, 
  axisIndex: number = 0,
  showColorbar: boolean = false,
  colorbarTitle?: string  
): Partial<PlotData> {
  return {
    type: "scatter",
    mode: "markers",
    x, y, name,
    marker: {
      size: isSpatial ? 6 : 8,
      opacity: 0.7,
      color,
      line: { width: isSpatial ? 1 : 0, color: 'rgba(0,0,0,0.3)' },
      colorbar: showColorbar ? {
        title: colorbarTitle || "",
        titleside: "right",
        thickness: 15,
        len: 300,        
        lenmode: 'pixels', 
        y: 0.5,           
        yanchor: 'middle', 
        x: 1.05,
        xanchor: "left"
      } : undefined
    },
    xaxis: axisIndex > 0 ? `x${axisIndex}` : "x",
    yaxis: axisIndex > 0 ? `y${axisIndex}` : "y",
    showlegend: axisIndex === 0, 
  };
}

// Create basic layout with axes
function createLayout(
  xTitle: string, 
  yTitle: string, 
  height?: number, 
  isSpatial: boolean = false
): Partial<Layout> {
  if (isSpatial) {
    // For spatial plots with hexbins, ensure equal aspect ratio
    return {
      xaxis: {
        title: xTitle,
        fixedrange: false, // Allow zooming for spatial plots
        automargin: true,
        scaleanchor: "y", // Force equal aspect ratio
        constrain: "domain",
      },
      yaxis: {
        title: yTitle,
        fixedrange: false, // Allow zooming for spatial plots
        automargin: true,
      },
      height: height || 600,
      showlegend: true,
      margin: { t: 20, r: 80, b: 60, l: 80 },
      hovermode: "closest",
      plot_bgcolor: 'rgba(240,240,240,0.1)', // Light background
      dragmode: 'zoom', // Enable zoom mode by default
    };
  }
  
  // Return standard layout for non-spatial plots
  return {
    xaxis: {
      title: xTitle,
      fixedrange: true, 
      automargin: true,
    },
    yaxis: {
      title: yTitle,
      fixedrange: true,
      automargin: true,
    },
    height: height || 400,
    showlegend: true,
    margin: { t: 20, r: 30, b: 60, l: 80 },
    hovermode: "closest"
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
  
  // Hexbin is always used when in spatial mode
  const useHexbin = createMemo(() => 
    isSpatial() && props.filterSettings.visualizationType === "spatial"
  );
  
  if (!xFieldName() || !yFieldName()) {
    return <div>Error: Missing X or Y field for scatter plot</div>;
  }
  
  // Create plot data
  const plotData = createMemo(() => {
    const xColumn = props.data.columns.find(c => c.name === xFieldName());
    const yColumn = props.data.columns.find(c => c.name === yFieldName());
    
    if (!xColumn || !yColumn) return [];
    
    const xValues = xColumn.data as number[];
    const yValues = yColumn.data as number[];
    
    // For hexbin visualization on spatial plots
    if (useHexbin() && isSpatial()) {
      const colorColumn = props.colorFieldName ? 
        props.data.columns.find(c => c.name === props.colorFieldName) : undefined;
      const colorValues = colorColumn?.data as number[] | undefined;
      
      const binSize = props.filterSettings.binSize || 20;
      
      // If no grouping, create a single hexbin visualization
      if (!props.filterSettings.groupBy) {
        return [createUniformHexbinTrace(
          xValues,
          yValues,
          colorValues,
          "All Data",
          props.filterSettings.label || props.colorFieldName || "Count",
          binSize
        )];
      }
      
      // Handle grouped hexbins
      const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
      if (!groupColumn) return [];
      
      const groupValues = groupColumn.data;
      const uniqueGroups = [...new Set(groupValues)].sort();
      
      if (props.additionalAxes) {
        const plots: Partial<PlotData>[] = [];
        
        // Create individual hexbin plots for each group
        uniqueGroups.forEach((group, i) => {
          const indices = groupValues.map((val, idx) => val === group ? idx : -1).filter(idx => idx !== -1);
          const filteredX = indices.map(idx => xValues[idx]);
          const filteredY = indices.map(idx => yValues[idx]);
          const filteredColors = colorValues ? indices.map(idx => colorValues[idx]) : undefined;
          
          const groupName = groupColumn.categories?.[group] || `Group ${group}`;
          const trace = createUniformHexbinTrace(
            filteredX,
            filteredY,
            filteredColors,
            groupName,
            props.filterSettings.label || props.colorFieldName || "Count",
            binSize
          );
          
          // Add axis information for subplots
          trace.xaxis = `x${i + 1}`;
          trace.yaxis = `y${i + 1}`;
          
          plots.push(trace);
        });
        
        return plots;
      }
      
      // Create overlapped hexbin plots for each group (non-additional axes mode)
      return uniqueGroups.map((group, i) => {
        const indices = groupValues.map((val, idx) => val === group ? idx : -1).filter(idx => idx !== -1);
        const filteredX = indices.map(idx => xValues[idx]);
        const filteredY = indices.map(idx => yValues[idx]);
        const filteredColors = colorValues ? indices.map(idx => colorValues[idx]) : undefined;
        
        const groupName = groupColumn.categories?.[group] || `Group ${group}`;
        return createUniformHexbinTrace(
          filteredX,
          filteredY,
          filteredColors,
          groupName,
          props.filterSettings.label || props.colorFieldName || "Count",
          binSize
        );
      });
    }
    
    // Regular scatter plot code
    if (!props.filterSettings.groupBy) {
      return [createTrace(
        xValues, 
        yValues, 
        "All Data", 
        props.colorFieldName ? getColorValues() : undefined,
        isSpatial(),
        0,
        props.colorFieldName !== undefined,
        props.filterSettings.label || props.colorFieldName || "" 
      )];
    }
    
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return [];
    
    const groupValues = groupColumn.data;
    const uniqueGroups = [...new Set(groupValues)].sort();
    
    if (props.additionalAxes) {
      const plots: Partial<PlotData>[] = [];
      
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
          i + 1,
          i === uniqueGroups.length - 1 && props.colorFieldName !== undefined,
          props.filterSettings.label || props.colorFieldName || ""
        ));
      });
      
      return plots;
    }
    
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
        isSpatial(),
        0,
        i === 0 && props.colorFieldName !== undefined,
        props.filterSettings.label || props.colorFieldName || ""
      );
    });
  });
  
  function getColorValues() {
    const colorField = isSpatial() ? props.filterSettings.field : props.colorFieldName;
    if (!colorField) return undefined;
    
    const colorColumn = props.data.columns.find(c => c.name === colorField);
    return colorColumn?.data;
  }
  
  // Create plot layout with equal aspect ratio for spatial plots
  const plotLayout = createMemo(() => {
    const xTitle = isSpatial() ? "X Position (µm)" : (props.filterSettings.label || xFieldName());
    const yTitle = isSpatial() ? "Y Position (µm)" : (props.filterSettings.yLabel || yFieldName());
    
    if (!props.filterSettings.groupBy || !props.additionalAxes) {
      return createLayout(xTitle, yTitle, isSpatial() ? 600 : 400, isSpatial());
    }
    
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return createLayout(xTitle, yTitle, 400, isSpatial());
    
    const groupValues = groupColumn.data;
    const uniqueGroups = [...new Set(groupValues)].sort();
    const numGroups = uniqueGroups.length;
    
    if (numGroups === 1) {
      const groupName = groupColumn.categories?.[uniqueGroups[0]] || `Group ${uniqueGroups[0]}`;
      
      const layout: Record<string, any> = {
        height: isSpatial() ? 600 : 400,
        showlegend: false,
        margin: { t: 50, r: 30, b: 60, l: 80 },
        hovermode: "closest",
        annotations: [{
          text: `<b>${groupName}</b>`,
          xref: 'paper',
          yref: 'paper',
          x: 0.5,
          y: 1,
          xanchor: 'center',
          yanchor: 'bottom',
          showarrow: false,
          font: { size: 16 },
        }],
        xaxis: {
          title: xTitle,
          fixedrange: !isSpatial(),
          automargin: true,
          scaleanchor: isSpatial() ? "y" : undefined,
          constrain: isSpatial() ? "domain" : undefined,
        },
        yaxis: {
          title: yTitle,
          fixedrange: !isSpatial(),
          automargin: true,
        }
      };
      
      return layout;
    }
    
    const columns = 2;
    const rows = Math.ceil(numGroups / columns);
    
    const height = isSpatial() ? 
      Math.max(600, 600 * rows) : 
      Math.max(400, 400 * rows);
    
    const layout: Record<string, any> = {
      height: height,
      showlegend: false,
      margin: { t: 50, r: props.colorFieldName ? 80 : 30, b: 60, l: 80 },
      hovermode: "closest",
      annotations: [],
      grid: {
        rows: rows,
        columns: columns,
        pattern: 'independent',
        roworder: 'top to bottom',
        xgap: 0.15, 
        ygap: 0.3   
      }
    };
    
    uniqueGroups.forEach((group, i) => {
      const row = Math.floor(i / columns) + 1;
      const col = (i % columns) + 1;
      const groupName = groupColumn.categories?.[group] || `Group ${group}`;
      
      layout[`xaxis${i+1}`] = {
        title: xTitle,
        fixedrange: !isSpatial(),
        automargin: true,
        scaleanchor: isSpatial() ? `y${i+1}` : undefined,
        constrain: isSpatial() ? "domain" : undefined,
      };
      
      layout[`yaxis${i+1}`] = {
        title: col === 1 ? yTitle : '',
        fixedrange: !isSpatial(),
        automargin: true,
      };
      
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
      config={plotlyConfig()}
      style={{ width: "100%", height: "100%" }}
    />
  );
}