import Plot from "@ralphsmith80/solid-plotly.js";
import { Layout, PlotData } from "plotly.js-dist-min";
import { plotlyConfig } from "~/lib/plots";
import { FilterSettings, RawDataCategory, HexbinData } from "~/types";
import { createMemo, Show } from "solid-js";
import * as _ from "lodash";

type HexbinPlotProps = {
  data: RawDataCategory;
  hexbinData: HexbinData;
  filterSettings: FilterSettings;
  colorFieldName?: string;
};

function getColorValue(dtype: string, colorValues: number[], hexbinData: HexbinData, groupValues: number[] | undefined, group: number | undefined): (number | undefined)[] {
  const binColors = hexbinData.bins.map(bin => {
    let values = bin.indices.map(i => colorValues[i]);

    // Filter values by group if provided
    if (groupValues && group !== undefined) {
      values = values.filter((_, idx) => groupValues[bin.indices[idx]] === group);
    }

    // Return 0 for empty bins instead of undefined
    if (values.length === 0) {
      return 0;  // Return 0 instead of undefined for empty bins
    }

    if (dtype === "categorical") {
      // compute mode
      const mode = _.flow(
        _.countBy,
        _.toPairs,
        _.partialRight(_.maxBy, _.last),
        _.head
      )(values);
      return mode as number | undefined;
    }
    
    if (["numeric", "integer", "boolean"].includes(dtype)) {
      // compute mean
      const mean = _.mean(values);
      return mean as number | undefined;
    }
  });

  return binColors;
}

function generateHexagonVertices(centerX: number, centerY: number, size: number) {
  const vertices = [];
  const rotation = Math.PI / 6; // 30 degrees in radians
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + rotation;
    vertices.push({
      x: centerX + size * Math.cos(angle),
      y: centerY + size * Math.sin(angle)
    });
  }
  vertices.push({
    x: vertices[0].x,
    y: vertices[0].y
  });
  
  return vertices;
}

// Helper to get color from scale
function getColorFromScale(colorscale: [number, string][], value: number, allValues: (number | undefined)[]) {
  // Filter out undefined values
  const validValues = allValues.filter(v => v !== undefined) as number[];
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min;
  
  // Normalize the value
  const normalizedValue = range > 0 ? (value - min) / range : 0.5;
  
  // Find position in colorscale
  for (let i = 0; i < colorscale.length - 1; i++) {
    if (normalizedValue >= colorscale[i][0] && normalizedValue <= colorscale[i+1][0]) {
      return colorscale[i+1][1];
    }
  }
  
  return colorscale[colorscale.length - 1][1];
}

export function HexbinPlot(props: HexbinPlotProps) {
  // Get field for coloring
  const colorField = createMemo(() => 
    props.colorFieldName || props.filterSettings.field
  );
  
  // Create plot data
  const plotData = createMemo(() => {
    const colorColumn = props.data.columns.find(c => c.name === colorField());
    if (!colorColumn) return [];
    const colorValues = colorColumn.data as number[];
    
    // Calculate true hexagonal grid coordinates
    const binX = props.hexbinData.bins.map(bin => bin.x);
    const binY = props.hexbinData.bins.map(bin => bin.y);
    const binColors = getColorValue(colorColumn.dtype, colorValues, props.hexbinData, undefined, undefined);
    const binCounts = props.hexbinData.bins.map(bin => bin.indices.length);

    console.log("Hexbin plot data:", {
      binX,
      binY,
      binColors,
      binCounts,
    });

    // Calculate size based on distance between adjacent hexbin centers
    // Find the minimum distance between adjacent hexbins
    const distances = [];
    // Only check a sample of points to improve performance
    for (let i = 0; i < Math.min(binX.length, 50); i++) {
      for (let j = i + 1; j < Math.min(binX.length, 50); j++) {
        const dx = binX[i] - binX[j];
        const dy = binY[i] - binY[j];
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.0001) {
          distances.push(distance);
        }
      }
    }

    // Sort distances and find the minimum
    distances.sort((a, b) => a - b);
    let hexSize;
    if (distances.length > 0) {
      // Get the most common small distance
      const sampleSize = Math.max(1, Math.floor(distances.length * 0.05));
      const avgMinDistance = distances.slice(0, sampleSize).reduce((a, b) => a + b, 0) / sampleSize;
      
      hexSize = avgMinDistance / 2 * 0.95; 
    } else {
      // Fallback to the original calculation if no distances are found
      const totalBins = props.hexbinData.numBinsX * props.hexbinData.numBinsY;
      hexSize = Math.max(
        5,  // Minimum size
        Math.min(
          50,  // Maximum size
          40 * Math.sqrt(500 / totalBins)  // Scale based on bin density
        )
      );
    }

    console.log("Hexbin sizing:", {
      distances: distances.slice(0, 5),
      hexSize
    });

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

    // If no groupBy, just return a single plot
    if (!props.filterSettings.groupBy) {
      // Create one trace per hexbin
      const plots: Partial<PlotData>[] = [];
      
      // Create one trace for each hexbin
      props.hexbinData.bins.forEach((bin, index) => {
        const color = binColors[index];
        
        const vertices = generateHexagonVertices(binX[index], binY[index], hexSize);
        const isEmpty = bin.indices.length === 0;
        
        plots.push({
          type: "scatter",
          mode: "text+lines", 
          x: vertices.map(v => v.x),
          y: vertices.map(v => v.y),
          fill: "toself",
          fillcolor: isEmpty ? 'rgba(240, 240, 240, 0.4)' : getColorFromScale(customColorScale, color || 0, binColors),
          line: {
            color: 'rgba(0,0,0,0.3)',
            width: 0.5
          },
          hovertemplate: isEmpty ? 
            '<b>Empty bin</b><br>' +
            '<b>X</b>: ' + binX[index].toFixed(2) + '<br>' +
            '<b>Y</b>: ' + binY[index].toFixed(2) + 
            '<extra></extra>' :
            '<b>Cells in bin</b>: ' + binCounts[index] + '<br>' +
            '<b>X</b>: ' + binX[index].toFixed(2) + '<br>' +
            '<b>Y</b>: ' + binY[index].toFixed(2) + '<br>' +
            `<b>${props.filterSettings.label || colorField() || ""}</b>: ` + color?.toFixed(2) +
            '<extra></extra>',
          showlegend: false,
          xaxis: "x",
          yaxis: "y",
          name: "Total",
        } as Partial<PlotData>);
      });
      
      const min = Math.min(...binColors.filter(c => c !== undefined) as number[]);
      const max = Math.max(...binColors.filter(c => c !== undefined) as number[]);
      const range = max - min;
      
      props.hexbinData.bins.forEach((bin, index) => {
        const color = binColors[index];
        if (color === undefined) return;
        
        const fillColor = getColorFromScale(customColorScale, color, binColors);
        
        plots[index + 1].fillcolor = fillColor;
      });
      
      return plots;
    }

    // If we have a groupBy, create multiple plots
    const groupColumn = props.data.columns.find(c => c.name === props.filterSettings.groupBy);
    if (!groupColumn) return [];

    const groupValues = groupColumn.data;

    const definedGroups = [...new Set(groupValues)].filter(g => g !== undefined && g !== null).sort();

    const uniqueGroups = definedGroups;
    const plots: Partial<PlotData>[] = [];
    
    const allColorValues: number[] = [];
    uniqueGroups.forEach(group => {
      const groupColor = getColorValue(colorColumn.dtype, colorValues, props.hexbinData, groupValues, group);
      allColorValues.push(...groupColor.filter(c => c !== undefined) as number[]);
    });
    
    // Create a single colorbar trace for the entire figure
    plots.push({
      type: "scatter",
      mode: "markers",
      x: [null],
      y: [null],
      marker: {
        color: allColorValues,
        colorscale: customColorScale,
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
        showscale: true,
        size: 0.1
      },
      showlegend: false,
      hoverinfo: "none",
      visible: true,
      // Use paper coordinates for positioning
      xaxis: "paper",  
      yaxis: "paper",
      opacity: 0
    } as Partial<PlotData>);
    
    // Update each group's plot with correct axis numbering
    uniqueGroups.forEach((group, i) => {
      const groupColor = getColorValue(colorColumn.dtype, colorValues, props.hexbinData, groupValues, group);
      const groupName = groupColumn.categories?.[group] || `Group ${group}`;
      const groupCounts = props.hexbinData.bins.map(bin => {
        return bin.indices.filter(idx => groupValues[idx] === group).length;
      });
            
      // Create polygon-based hexbins for this group
      props.hexbinData.bins.forEach((bin, index) => {
        const color = groupColor[index];
        if (color === undefined) return;

        const vertices = generateHexagonVertices(binX[index], binY[index], hexSize);
        const isEmpty = bin.indices.length === 0;

        plots.push({
          type: "scatter",
          mode: "text+lines",
          x: vertices.map(v => v.x),
          y: vertices.map(v => v.y),
          fill: "toself",
          fillcolor: isEmpty ? 'rgba(240, 240, 240, 0.4)' : getColorFromScale(customColorScale, color || 0, groupColor),
          line: {
            color: 'rgba(0,0,0,0.3)',
            width: 0.5
          },
          hovertemplate: isEmpty ? 
            '<b>Empty bin</b><br>' +
            '<b>X</b>: ' + binX[index].toFixed(2) + '<br>' +
            '<b>Y</b>: ' + binY[index].toFixed(2) + 
            '<extra></extra>' :
            '<b>Cells in bin</b>: ' + groupCounts[index] + '<br>' +
            '<b>X</b>: ' + binX[index].toFixed(2) + '<br>' +
            '<b>Y</b>: ' + binY[index].toFixed(2) + '<br>' +
            `<b>${props.filterSettings.label || colorField() || ""}</b>: ` + color.toFixed(2) +
            '<extra></extra>',
          showlegend: false,
          xaxis: i === 0 ? "x" : `x${i+1}`,
          yaxis: i === 0 ? "y" : `y${i+1}`,
          name: groupName,
          coloraxis: "coloraxis"
        } as Partial<PlotData>);
      });
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