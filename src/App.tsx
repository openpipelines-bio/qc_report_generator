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
import { FilterSettings, RawData } from "./types";
import * as _ from "lodash";
import { H1, H2, H3 } from "./components/heading";
import { getData } from "./lib/decompress";
import { Histogram } from "./components/histogram";
import { FilterSettingsForm } from "./components/filter-settings-form";
import { DataSummaryTable } from "./components/data-summary-table";
import { BarPlot } from "./components/barplot";
import { createMemo } from "solid-js";
import { SampleFilterForm } from "./components/sample-filter-form";
import { filterData, calculateQcPassCells, getPassingCellIndices } from "./lib/data-filters";
import { transformSampleMetadata } from "./lib/sample-utils";

type QCCategory = {
  name: string;
  key: keyof RawData;
  additionalAxes: boolean;
  defaultFilters: FilterSettings[];
};

const qcCategories: QCCategory[] = [
  {
    name: "Sample QC",
    key: "sample_summary_stats",
    additionalAxes: false,
    defaultFilters: [],
  },
  {
    name: "SampleQC",
    key: "metrics_cellranger_stats",
    additionalAxes: false,
    defaultFilters: [
      {
        type: "bar",
        field: "Number_of_reads_in_the_library",
        label: "Number of reads per library",
        description: "Sequencing depth per sample. Higher values generally indicate more comprehensive cell profiling.",
        nBins: 10,
        groupBy: "sample_id",
        xAxisType: "linear",
        yAxisType: "linear",
      },
      {
        type: "bar",
        field: "Confidently_mapped_reads_in_cells",
        label: "Confidently mapped reads in cells",
        description: "Number of reads that were mapped unambiguously to the reference genome within cell-containing droplets.",
        groupBy: "sample_id",
        nBins: 10,
        yAxisType: "linear",
      },
      {
        type: "bar",
        field: "Estimated_number_of_cells",
        label: "Estimated number of cells",
        description: "CellRanger's estimate of the number of cells per sample based on the UMI count distribution.",
        groupBy: "sample_id",
        nBins: 10,
        yAxisType: "linear",
      },
      {
        type: "bar",
        field: "Sequencing_saturation",
        label: "Sequencing saturation",
        description: "Fraction of reads that are duplicates of existing UMIs. Higher values suggest deeper sequencing coverage.",
        groupBy: "sample_id",
        nBins: 10,
        yAxisType: "linear",
      },
    ],
  },
  {
    name: "Cell RNA QC",
    key: "cell_rna_stats",
    additionalAxes: true,
    defaultFilters: [
      {
        type: "histogram",
        field: "total_counts",
        label: "Total UMI per cell",
        description: "Total number of RNA molecules detected per cell. Low values typically indicate empty droplets or low-quality cells that should be filtered out.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        zoomMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "num_nonzero_vars",
        label: "Number of non-zero genes per cell",
        description: "Count of unique genes detected in each cell. Low gene counts often indicate poor-quality cells.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        zoomMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "fraction_mitochondrial",
        label: "Fraction UMI of mitochondrial genes per cell",
        description: "Proportion of cell's RNA from mitochondrial genes.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "fraction_ribosomal",
        label: "Fraction UMI of ribosomal genes per cell",
        description: "Proportion of cell's RNA from ribosomal protein genes. Extreme values may indicate stress responses or cell cycle abnormalities.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "pct_of_counts_in_top_50_vars",
        label: "Fraction UMI in top 50 genes per cell",
        description: "Proportion of RNA molecules from the 50 most-expressed genes in each cell.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "cellbender_cell_probability",
        label: "CellBender cell probability",
        description: "CellBender's statistical confidence (0-1) that a barcode represents a real cell, with higher values indicating stronger confidence.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "cellbender_background_fraction",
        label: "CellBender background fraction",
        description: "Estimated percentage of each cell's RNA that comes from the ambient solution rather than the cell itself.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "cellbender_cell_size",
        label: "CellBender cell size",
        description: "CellBender's estimate of the true number of RNA molecules in each cell after removing ambient contamination. Reflects actual cell RNA content rather than raw UMI counts.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "cellbender_droplet_efficiency",
        label: "CellBender droplet efficiency",
        description: "CellBender's estimate of how efficiently each droplet captured RNA molecules. Higher values indicate more reliable RNA sampling within individual droplets.",
        cutoffMin: undefined,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      }
    ],
  },
];

const App: Component = () => {
  const [data, setData] = createSignal<RawData>();
  const [selectedSamples, setSelectedSamples] = createSignal<string[]>([]);
  const [globalGroupBy, setGlobalGroupBy] = createSignal<string>("sample_id");

  // Add a new signal to track if global grouping is enabled
  const [isGlobalGroupingEnabled, setIsGlobalGroupingEnabled] = createSignal(true);
  const [filtersApplied, setFiltersApplied] = createSignal(false);

  // Add a new state to store the applied filter settings
  const [appliedFilterSettings, setAppliedFilterSettings] = createStore<Settings>({});

  // Add a function to get all categorical columns
  const getCategoricalColumns = createMemo(() => {
    if (!data()) return ["sample_id"];
    
    // Find unique categorical columns across all data categories
    const allColumns = new Set<string>();
    
    // Check each category for categorical columns
    for (const category of qcCategories) {
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
  const filteredData = createMemo(() => {
    return filterData(data(), selectedSamples());
  });

  // Modify the fullyFilteredData memo to use the applied settings instead of the current settings
  const fullyFilteredData = createMemo(() => {
    if (!filtersApplied()) {
      // If filters aren't applied, just return the sample-filtered data
      return filteredData();
    }
    
    // Start with the sample-filtered data
    const sampleFiltered = filteredData();
    if (!sampleFiltered) return undefined;
    
    // Copy the data structure
    const result = {...sampleFiltered};
    
    // Get cell QC filter settings from applied settings, not live settings
    const cellFilters = appliedFilterSettings.cell_rna_stats || [];
    
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

  // read data in memory
  createEffect(async () => {
    console.log("reading data");
    setData(await getData());
  });

  // initialise filtersettings
  type Settings = {
    [key in keyof RawData]: FilterSettings[];
  };
  const [settings, setSettings] = createStore<Settings>(
    Object.fromEntries(Object.keys(data() ?? {}).map((key) => [key, []])),
  );

  for (const category of qcCategories) {
    createEffect(() => {
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
    });
  }

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
    
    // Iterate through all categories and filters
    for (const categoryKey in exportSettings) {
      exportSettings[categoryKey].forEach((filter: FilterSettings) => {
        // Add min threshold if it exists
        if (filter.cutoffMin !== undefined) {
          yamlContent += `min_${filter.field}: ${filter.cutoffMin}\n`;
        }
        
        // Add max threshold if it exists
        if (filter.cutoffMax !== undefined) {
          yamlContent += `max_${filter.field}: ${filter.cutoffMax}\n`;
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
    <div class="container mx-a space-y-2">
      <H1>OpenPipelines Ingestion QC Report</H1>
      <SampleFilterForm
        sampleIds={data()?.sample_summary_stats.columns.find(c => c.name === "sample_id")?.categories || []}
        selectedSamples={selectedSamples()}
        onChange={setSelectedSamples}
        sampleMetadata={transformSampleMetadata(data())}
      />
      <div class="mb-4 p-4 bg-gray-50 rounded-md border">
        <h3 class="text-lg font-medium mb-2">Global Visualization Settings</h3>
        <div class="flex items-center gap-2 mb-2">
          <div class="flex items-center">
            <input 
              type="checkbox" 
              id="enable-global-grouping"
              checked={isGlobalGroupingEnabled()} 
              onChange={(e) => setIsGlobalGroupingEnabled(e.target.checked)}
              class="mr-2 h-4 w-4"
            />
            <label for="enable-global-grouping" class="w-auto text-sm font-medium">
              Enable global grouping
            </label>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <label class="w-24">Group By:</label>
          <select 
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            value={globalGroupBy()}
            onChange={(e) => setGlobalGroupBy(e.target.value)}
            disabled={!isGlobalGroupingEnabled()}
          >
            <For each={getCategoricalColumns()}>
              {(column) => (
                <option value={column}>{column}</option>
              )}
            </For>
          </select>
        </div>
      </div>
      <For each={qcCategories}>
        {(category) => (
          <Show when={(settings[category.key] || []).length > 0}>
            <H2>{category.name}</H2>
            
            {/* Add descriptive text based on category */}
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
                {(_, i) => {
                  // Extract the groupBy logic into a reactive memo
                  const currentFilterGroupBy = createMemo(() => {
                    if (category.key === "metrics_cellranger_stats") {
                      return "sample_id"; // CellRanger metrics always use sample_id
                    } else if (isGlobalGroupingEnabled()) {
                      return globalGroupBy(); // Use global setting when enabled
                    } else {
                      return settings[category.key][i()].groupBy || "sample_id"; // Use plot's own setting or default
                    }
                  });
                  
                  const [isExpanded, setIsExpanded] = createSignal(true); // Start expanded
                  
                  return (
                    <div>
                      <H3>{settings[category.key][i()].label}</H3>
                      {/* Add description display here */}
                      <Show when={settings[category.key][i()].description}>
                        <p class="text-gray-600 text-sm mb-2">{settings[category.key][i()].description}</p>
                      </Show>
                      
                      <button 
                        onClick={() => setIsExpanded(!isExpanded())}
                        class="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md flex justify-between items-center mb-2"
                      >
                        <span>Plot Visibility</span>
                        <span class="transition-transform duration-200" classList={{ "rotate-180": !isExpanded() }}>
                          ▼
                        </span>
                      </button>
                      
                      {isExpanded() && (
                        <div class="flex flex-col space-y-2">
                          <Switch>
                            <Match when={!data()}>
                              <div>Loading...</div>
                            </Match>
                            <Match when={settings[category.key][i()].type === "bar"}>
                              <BarPlot
                                data={(filtersApplied() ? fullyFilteredData() : filteredData())![category.key]}
                                filterSettings={{
                                  ...settings[category.key][i()],
                                  groupBy: currentFilterGroupBy() // Use the extracted logic
                                }}
                              />
                            </Match>
                            <Match when={settings[category.key][i()].type === "histogram"}>
                              <Histogram
                                data={(filtersApplied() ? fullyFilteredData() : filteredData())![category.key]}
                                filterSettings={{
                                  ...settings[category.key][i()],
                                  groupBy: currentFilterGroupBy() // Use the extracted logic
                                }}
                                additionalAxes={category.additionalAxes}
                              />
                            </Match>
                          </Switch>
                          <FilterSettingsForm
                            filterSettings={settings[category.key][i()]}
                            updateFilterSettings={(fn) =>
                              setSettings(category.key, i(), produce(fn))
                            }
                            data={(filtersApplied() ? fullyFilteredData() : filteredData())![category.key]}
                            globalGroupBy={category.key === "metrics_cellranger_stats" ? undefined : (isGlobalGroupingEnabled() ? globalGroupBy() : undefined)}
                            forceGroupBy={category.key === "metrics_cellranger_stats" ? "sample_id" : undefined}
                            isGlobalGroupingEnabled={isGlobalGroupingEnabled()}
                            category={category.key} // Pass the category key
                          />
                        </div>
                      )}
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
          <p># Cells after filtering: {qcPass()}</p>
          <div class="mt-4 flex gap-2">
            <button 
              onClick={() => {
                // Take a snapshot of the current settings and save it as the applied settings
                setAppliedFilterSettings(JSON.parse(JSON.stringify(settings)));
                setFiltersApplied(true);
              }}
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Apply Filters to Plots
            </button>
            
            <button 
              onClick={() => {
                setFiltersApplied(false);
                // No need to clear applied settings - they'll be ignored when filtersApplied is false
              }}
              class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Reset to Default View
            </button>
            
            <button 
              onClick={exportFiltersAsYaml}
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Export Filters as YAML
            </button>
            
            {filtersApplied() && (
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
        <For each={qcCategories}>
          {(category) => (
            <div>
              <H3>{category.name}</H3>
              <Show when={data()}>
                <DataSummaryTable data={(filtersApplied() ? fullyFilteredData() : filteredData())![category.key]} />
              </Show>
            </div>
          )}
        </For>
      </div>
      <div class="h-64" />
    </div>
  );
};

export default App;
