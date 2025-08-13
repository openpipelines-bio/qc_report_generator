import {
  createEffect,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  type Component,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { ReportStructure, FilterSettings, RawData, Settings } from "./types";
import * as _ from "lodash";
import { H1, H2, H3 } from "./components/heading";
import { getData, getReportStructure } from "./lib/get-data";
import { Histogram } from "./components/histogram";
import { FilterSettingsForm } from "./components/app/filter-settings-form";
import { DataSummaryTable } from "./components/app/data-summary-table";
import { BarPlot } from "./components/barplot";
import { ScatterPlot } from "./components/scatterplot";
import { createMemo } from "solid-js";
import { SampleFilterForm } from "./components/app/sample-filter-form";
import { filterData, calculateQcPassCells, getPassingCellIndices } from "./lib/data-filters";
import { transformSampleMetadata } from "./lib/sample-utils";
import { createSettingsForm, SettingsFormProvider } from "./components/app/settings-form";
import { GlobalVisualizationSettings } from "./components/app/global-visualization-settings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./components/ui/collapsible";
import { Heatmap } from "~/components/heatmap";


const App: Component = () => {
  const [reportStructure, setReportStructure] = createSignal<ReportStructure>({categories: []});
  const [data, setData] = createSignal<RawData>();

  // create form
  const form = createSettingsForm();

  const filters = form.useStore(state => state.values.filters);

  // read data in memory
  createEffect(async () => {
    console.log("reading qc categories");
    setReportStructure(await getReportStructure());

    console.log("reading data");
    const data = await getData();
    setData(data);
    
    // make sure to set the initial selected samples
    const sampleIds = data.sample_summary_stats?.columns.find(col => col.name === "sample_id")?.categories || [];
    form.setFieldValue("sampleSelection.selectedSamples", sampleIds);

    // check if the data has spatial coordinates
    // TODO: allow users to select which coordinates to use
    const columnNames = data.cell_rna_stats?.columns.map(c => c.name) || [];
    const hasSpatialCoordinates = columnNames.includes("x_coord") && columnNames.includes("y_coord");
    form.setFieldValue("binning.enabled", hasSpatialCoordinates);
    
    // For spatial data, force grouping to be enabled and groupBy to sample_id
    if (hasSpatialCoordinates) {
      form.setFieldValue("globalVisualization.groupingEnabled", true);
      form.setFieldValue("globalVisualization.groupBy", "sample_id");
    }
  });

  const sampleMetadata = createMemo(() => {
    return transformSampleMetadata(data());
  });

  // Detect if the data has spatial coordinates
  const isSpatialData = createMemo(() => {
    if (!data()) return false;
    const columnNames = data()!.cell_rna_stats?.columns.map(c => c.name) || [];
    return columnNames.includes("x_coord") && columnNames.includes("y_coord");
  });

  // Add a function to get all categorical columns
  const getCategoricalColumns = createMemo(() => {
    if (!data()) return ["sample_id"];
    
    // Find unique categorical columns across all data categories
    const allColumns = new Set<string>();
    
    // Check each category for categorical columns
    for (const category of reportStructure().categories) {
      const categoryData = data()?.[category.key];
      if (categoryData) {
        categoryData.columns
          .filter(col => col.dtype === "categorical")
          .forEach(col => allColumns.add(col.name));
      }
    }
    
    // Make sure sample_id is included and first
    const columnsArray = Array.from(allColumns);
    if (columnsArray.includes("sample_id")) {
      // If sample_id exists, put it first
      return ["sample_id", ...columnsArray.filter(c => c !== "sample_id")];
    }
    
    return columnsArray;
  });

  // Use the imported filter function
  const selectedSamples = form.useStore(state => state.values.sampleSelection.selectedSamples);
  const filteredData = createMemo(() => {
    return filterData(data(), selectedSamples());
  });

  // Modify the fullyFilteredData memo to use the applied settings instead of the current settings
  const fullyFilteredData = createMemo(() => {
    const sampleFiltered = filteredData();

    if (!sampleFiltered) return undefined;
    if (!filters().enabled) {
      return sampleFiltered;
    }
    
    // Copy the data structure
    const result = {...sampleFiltered};
    
    // Get cell QC filter settings from applied settings, not live settings
    const cellFilters = filters().appliedSettings.cell_rna_stats || [];
    
    // Get the cell IDs that pass QC filters using the helper function
    const cellsData = sampleFiltered.cell_rna_stats;
    const passingCellIndices = getPassingCellIndices(cellsData, cellFilters);
    
    // Filter the cell_rna_stats data
    const passingIndices = Array.from(passingCellIndices);
    if (passingIndices.length < cellsData.num_rows) {
      result.cell_rna_stats = {
        ...cellsData,
        num_rows: passingIndices.length,
        columns: cellsData.columns.map(col => ({
          ...col,
          data: passingIndices.map(i => col.data[i])
        }))
      };
    }
    
    return result;
  });

  const binning = form.useStore(state => state.values.binning);

  const binIndices = createMemo(() => {
    // TODO: Could compute the binIndices on the filteredData, and only apply the QC filtering afterwards to
    // avoid recomputing the indices every time the filters change.
    const dataSource = filters().enabled ? fullyFilteredData() : filteredData();
    if (!dataSource) return undefined;
    if (!binning().enabled) return undefined;

    // Get the x and y coordinates from the cell_rna_stats data
    const xCol = dataSource.cell_rna_stats.columns.find(col => col.name === binning().xCol);
    const yCol = dataSource.cell_rna_stats.columns.find(col => col.name === binning().yCol);

    if (!xCol || !yCol) return undefined;
    if (xCol.dtype !== "numeric" || yCol.dtype !== "numeric") {
      console.error("Grid binning requires numeric coordinates");
      return undefined;
    }
    const xCoord = xCol!.data as number[];
    const yCoord = yCol!.data as number[];

    if (!xCoord || !yCoord) return undefined;

    // Add a small offset to avoid having cells fall exactly on the bin edges
    const xMin = _.min(xCoord)! - 1e-6;
    const xMax = _.max(xCoord)! + 1e-6;
    const yMin = _.min(yCoord)! - 1e-6;
    const yMax = _.max(yCoord)! + 1e-6;
    const numBinsX = binning().numBinsX;
    const numBinsY = binning().numBinsY;
    const binWidthX = (xMax - xMin) / numBinsX;
    const binWidthY = (yMax - yMin) / numBinsY;

    // Create regular rectangular grid - bins represent center coordinates
    const xBinCenters = Array.from({ length: numBinsX }, (_, i) => 
      xMin + (i + 0.5) * binWidthX
    );
    const yBinCenters = Array.from({ length: numBinsY }, (_, i) => 
      yMin + (i + 0.5) * binWidthY
    );

    // Create 2D array to store cell indices for each bin
    const binIndices: number[][][] = Array.from({ length: numBinsY }, () => 
      Array.from({ length: numBinsX }, () => [])
    );

    // Assign each cell to its corresponding bin
    for (let i = 0; i < xCoord.length; i++) {
      const px = xCoord[i];
      const py = yCoord[i];

      // Find bin indices
      const xBin = Math.floor((px - xMin) / binWidthX);
      const yBin = Math.floor((py - yMin) / binWidthY);
      
      // Ensure we're within bounds
      if (xBin >= 0 && xBin < numBinsX && yBin >= 0 && yBin < numBinsY) {
        binIndices[yBin][xBin].push(i);
      }
    }

    return {
      xMin,
      xMax,
      yMin,
      yMax,
      numBinsX,
      numBinsY,
      binWidthX,
      binWidthY,
      xBinCenters,
      yBinCenters,
      binIndices
    };
  })

  // initialise filtersettings
  const [settings, setSettings] = createStore<Settings>(
    Object.fromEntries(Object.keys(data() ?? {}).map((key) => [key, []])),
  );

  createEffect(() => {
    for (const category of reportStructure().categories) {
      console.log(`setting ${category.name} filters`);

      const columnNames =
        data()?.[category.key].columns.map((x) => x.name) ?? [];

      // check if default columns are present
      const newFilters = category.defaultFilters.flatMap((defaultPlot) => {
        if (columnNames.includes(defaultPlot.field)) {
          return [defaultPlot];
        } else {
          return [];
        }
      });

      setSettings(category.key, newFilters);
    }
  });

  // Use the imported cell counting function
  const qcPass = createMemo(() => {
    return calculateQcPassCells(filteredData(), settings.cell_rna_stats || []);
  });

  // Export current filter settings as YAML using hybrid approach
  const exportFiltersAsYaml = async () => {
    // Get a clean copy of settings
    const exportSettings = JSON.parse(JSON.stringify(settings));
    
    // Create flat YAML with prefixed field names and keep the header as comments
    let yamlContent = "# OpenPipelines Ingestion QC Filter Settings\n";
    yamlContent += "# Generated on " + new Date().toISOString() + "\n\n";
    
    // Add spatial data indication if applicable
    if (isSpatialData()) {
      yamlContent += "# Spatial data detected - includes per-sample filters\n\n";
    }
    
    // Iterate through all categories and filters
    for (const categoryKey in exportSettings) {
      exportSettings[categoryKey].forEach((filter: FilterSettings) => {
        // Add global min/max thresholds if they exist
        if (filter.cutoffMin !== undefined) {
          yamlContent += `min_${filter.field}: ${filter.cutoffMin}\n`;
        }
        
        if (filter.cutoffMax !== undefined) {
          yamlContent += `max_${filter.field}: ${filter.cutoffMax}\n`;
        }
        
        // Add per-sample filters for spatial data
        if (filter.perSampleFilters && isSpatialData()) {
          yamlContent += `# Per-sample filters for ${filter.field}\n`;
          
          for (const sampleId in filter.perSampleFilters) {
            const sampleFilter = filter.perSampleFilters[sampleId];
            
            if (sampleFilter.cutoffMin !== undefined) {
              yamlContent += `min_${filter.field}_${sampleId}: ${sampleFilter.cutoffMin}\n`;
            }
            
            if (sampleFilter.cutoffMax !== undefined) {
              yamlContent += `max_${filter.field}_${sampleId}: ${sampleFilter.cutoffMax}\n`;
            }
          }
          yamlContent += "\n";
        }
      });
    }
    
    // Create the blob with the YAML content
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    
    try {
      // Check if the File System Access API is available
      if ('showSaveFilePicker' in window) {
        // Use the modern File System Access API
        const options = {
          types: [{
            description: 'YAML files',
            accept: { 'text/yaml': ['.yaml'] }
          }],
          suggestedName: 'qc_filters.yaml'
        };
        
        // @ts-ignore - TypeScript might not recognize this API yet
        const fileHandle = await window.showSaveFilePicker(options);
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // Fall back to the traditional approach
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'qc_filters.yaml'; // Default filename
        
        // Add to the document and click
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }
    } catch (err) {
      console.error("Error saving file:", err);
      // If the user canceled the save dialog, don't show an error
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        alert("Failed to save file. " + err);
      }
    }
  };

  // page layout
  return (
    <SettingsFormProvider form={form}>
      <div class="container mx-a space-y-2">
        <H1>OpenPipelines Ingestion QC Report</H1>
        <SampleFilterForm sampleMetadata={sampleMetadata()} />
        <GlobalVisualizationSettings getCategoricalColumns={getCategoricalColumns} isSpatialData={isSpatialData} />
        <For each={reportStructure().categories}>
          {(category) => (
            <Show when={(settings[category.key] || []).length > 0}>
              <H2>{category.name}</H2>
              
              {/* Add descriptive text based on category */}
              {/* TODO: move descriptive text into the report structure itself */}
              <div class="mb-4 text-gray-700">
                {category.key === "sample_summary_stats" && (
                  <p>
                    These metrics provide sample-level quality control measures. Each plot represents data 
                    aggregated at the sample level and is always grouped by sample ID.
                  </p>
                )}
                
                {category.key === "metrics_cellranger_stats" && (
                  <p>
                    These metrics are provided by CellRanger and show sample-level sequencing statistics. 
                    All CellRanger metrics are always grouped by sample ID regardless of global visualization settings.
                  </p>
                )}
                
                {category.key === "cell_rna_stats" && (
                  <p>
                    These metrics provide cell-level quality control measures. You can use the Global Visualization 
                    Settings above to group these metrics by different categorical variables (e.g., sample_id, 
                    predicted cell type). These groupings allow you to identify quality differences across 
                    biological or technical groups.
                  </p>
                )}
              </div>
              
              <div class="grid grid-cols-1 gap-4">
                <For each={settings[category.key]}>
                  {(setting, i) => {
                    const globalVisualization = form.useStore(state => state.values.globalVisualization);

                    // Extract the groupBy logic into a reactive memo
                    const currentFilterGroupBy = createMemo(() => {
                      if (category.key === "metrics_cellranger_stats") {
                        return "sample_id"; // CellRanger metrics always use sample_id
                      } else if (globalVisualization().groupingEnabled) {
                        return globalVisualization().groupBy; // Use global setting when enabled
                      } else {
                        return setting.groupBy || "sample_id"; // Use plot's own setting or default
                      }
                    });
                    
                    const [isPlotExpanded, setIsPlotExpanded] = createSignal(true);
                    
                    return (
                      <div>
                        <div class="flex justify-between items-center mb-2">
                          <H3>{setting.label}</H3>
                          
                          {/* Add the visualization toggle in the top-right corner */}
                          <Show when={category.key === "cell_rna_stats" && 
                                    setting.type === "histogram" && 
                                    binning().enabled}>
                            <div 
                              class="relative rounded-full bg-gray-200 shadow-sm overflow-hidden"
                              style={{ height: "32px", width: "180px" }}
                            >
                              <div 
                                class="absolute bg-white rounded-full shadow transition-transform duration-200"
                                style={{
                                  width: "calc(50% - 4px)",
                                  height: "calc(100% - 4px)",
                                  top: "2px",
                                  left: "2px",
                                  transform: setting.visualizationType !== 'spatial' 
                                    ? 'translateX(0)' 
                                    : 'translateX(calc(100% + 4px))'
                                }}
                              />
                              
                              <div class="absolute inset-0 flex w-full h-full">
                                <div 
                                  class="flex items-center justify-center w-1/2 cursor-pointer"
                                  onClick={() => setSettings(category.key, i(), "visualizationType", "histogram" )}
                                >
                                  <span 
                                    class={`text-sm font-medium transition-colors duration-200 ${
                                      setting.visualizationType !== 'spatial' ? 'text-gray-800' : 'text-gray-500'
                                    }`}
                                  >
                                    Histogram
                                  </span>
                                </div>
                                
                                <div 
                                  class="flex items-center justify-center w-1/2 cursor-pointer"
                                  onClick={() => setSettings(category.key, i(), "visualizationType", "spatial" )}
                                >
                                  <span 
                                    class={`text-sm font-medium transition-colors duration-200 ${
                                      setting.visualizationType === 'spatial' ? 'text-gray-800' : 'text-gray-500'
                                    }`}
                                  >
                                    Spatial
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Show>
                        </div>
                        
                        <Show when={setting.description}>
                          <p class="text-gray-600 text-sm mb-2">{setting.description}</p>
                        </Show>

                        <Collapsible open={isPlotExpanded()} onOpenChange={setIsPlotExpanded}>
                          <CollapsibleTrigger
                            class="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md flex justify-between items-center mb-2"
                          >
                            Plot Visibility 
                            <span class="transition-transform duration-200" classList={{ "rotate-180": !isPlotExpanded() }}>▼</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div class="flex flex-col space-y-2">
                              <Switch>
                                <Match when={!data()}>
                                  <div>Loading...</div>
                                </Match>
                                <Match when={setting.type === "bar"}>
                                  <BarPlot
                                    data={(filters().enabled ? fullyFilteredData() : filteredData())![category.key]}
                                    filterSettings={{
                                      ...setting,
                                      groupBy: currentFilterGroupBy()
                                    }}
                                  />
                                </Match>
                                <Match when={setting.type === "histogram" && 
                                            (setting.visualizationType === "histogram" || !setting.visualizationType)}>
                                  <Histogram
                                    data={(filters().enabled ? fullyFilteredData() : filteredData())![category.key]}
                                    filterSettings={{
                                      ...setting,
                                      groupBy: currentFilterGroupBy()
                                    }}
                                    additionalAxes={category.additionalAxes}
                                  />
                                </Match>
                                {/* Spatial visualization with conditional binning */}
                                <Match when={setting.type === "histogram" && setting.visualizationType === "spatial"}>
                                  <Show when={binning().enabled && binIndices()}>
                                    <Heatmap
                                      data={(filters().enabled ? fullyFilteredData() : filteredData())![category.key]}
                                      binData={binIndices()!}
                                      filterSettings={{
                                        ...setting,
                                        groupBy: currentFilterGroupBy()
                                      }}
                                      colorFieldName={setting.field}
                                    />
                                  </Show>
                                  
                                  <Show when={!binning().enabled || !binIndices()}>
                                    <ScatterPlot
                                      data={(filters().enabled ? fullyFilteredData() : filteredData())?.cell_rna_stats!}
                                      filterSettings={{
                                        ...setting,
                                        groupBy: currentFilterGroupBy()
                                      }}
                                      additionalAxes={category.additionalAxes}
                                      colorFieldName={setting.field}
                                    />
                                  </Show>
                                </Match>
                              </Switch>
                              <FilterSettingsForm
                                filterSettings={setting}
                                updateFilterSettings={(fn) =>
                                  setSettings(category.key, i(), produce(fn))
                                }
                                data={filteredData()![category.key]}
                                globalGroupBy={category.key === "metrics_cellranger_stats" ? undefined : (globalVisualization().groupingEnabled ? globalVisualization().groupBy : undefined)}
                                forceGroupBy={category.key === "metrics_cellranger_stats" ? "sample_id" : undefined}
                                isGlobalGroupingEnabled={globalVisualization().groupingEnabled}
                                category={category.key} // Pass the category key
                                isSpatialData={isSpatialData()} // Pass spatial data flag
                                settings={settings} // Pass settings
                                setSettings={setSettings} // Pass setSettings function
                                filterIndex={i()} // Pass filter index
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>
          )}
        </For>
        <div>
          <H2>Results</H2>
          <Show when={data()} fallback={<p># Cells before filtering: ...</p>}>
            <p># Cells before filtering: {data()!.cell_rna_stats.num_rows}</p>
          </Show>
          <Show when={data()} fallback={<p># Cells after filtering: ...</p>}>
            <p># Cells after filtering: {filters().enabled ? qcPass() : data()!.cell_rna_stats.num_rows}</p>
            <div class="mt-4 flex gap-2">
              <form.Field name="filters">
                {(field) => (
                  <button 
                    onClick={() => {
                      // Take a snapshot of the current settings and save it as the applied settings
                      field().handleChange({
                        enabled: true,
                        appliedSettings: JSON.parse(JSON.stringify(settings))
                      });
                    }}
                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Apply Filters to Plots
                  </button>
                )}
              </form.Field>
              <form.Field name="filters.enabled">
                {(field) => (
                  <button 
                    onClick={() => {
                      // First, disable filters
                      field().handleChange(false);
                      
                      // Then reset all filter cutoffs in settings
                      for (const categoryKey in settings) {
                        settings[categoryKey].forEach((filter, index) => {
                          setSettings(categoryKey, index, produce(s => {
                            s.cutoffMin = undefined;
                            s.cutoffMax = undefined;
                            s.perSampleFilters = undefined;
                          }));
                        });
                      }
                      
                      // Also reset the appliedSettings to ensure the form is consistent
                      form.setFieldValue("filters.appliedSettings", JSON.parse(JSON.stringify(settings)));
                    }}
                    class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    disabled={field().state.value === false}
                  >
                    Reset to Default View
                  </button>
                )}
              </form.Field>
              
              <button 
                onClick={exportFiltersAsYaml}
                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Export Filters as YAML
              </button>
              
              {filters().enabled && (
                <p class="text-sm text-green-600 flex items-center">
                  ✓ Filters applied - Plots show only cells that pass all thresholds
                </p>
              )}
            </div>
          </Show>
        </div>
        <div>
          <H2>Overview of loaded data</H2>
          <p>
            This overview is meant to give a quick glance at the data that has
            been loaded.
          </p>
          <For each={reportStructure().categories}>
            {(category) => (
              <div>
                <H3>{category.name}</H3>
                <Show when={data()}>
                  <DataSummaryTable data={(filters().enabled ? fullyFilteredData() : filteredData())![category.key]} />
                </Show>
              </div>
            )}
          </For>
        </div>
        <div class="h-64" />
      </div>
    </SettingsFormProvider>
  );
};

export default App;
