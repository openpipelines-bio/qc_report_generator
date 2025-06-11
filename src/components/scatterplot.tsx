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
    
    if (!props.filterSettings.groupBy) {
      return [createTrace(
        xValues, 
        yValues, 
        "All Data", 
        props.colorFieldName ? getColorValues() : undefined,
        isSpatial(),
        0,
        props.colorFieldName !== undefined,
        props.filterSettings.label || props.colorFieldName || "" // Use the human-readable label when available
      )];
    }
    
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return [];
    
    const groupValues = groupColumn.data;
    const uniqueGroups = [...new Set(groupValues)].sort();
    
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
  
  // Create plot layout
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
        height: 400,
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
    
    const height = Math.max(400, 400 * rows);
    
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