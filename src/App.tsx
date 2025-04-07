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
    name: "CellRanger Metrics",
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
        yAxisType: "log",
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
        yAxisType: "log",
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
        yAxisType: "log",
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
        yAxisType: "log",
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
        yAxisType: "log",
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

  // read data in memory
  createEffect(async () => {
    console.log("reading data");
    setData(await getData());
  });

  // Add this after your data() signal definition
  const filteredData = () => {
    const rawData = data();
    const samples = selectedSamples();
    
    if (!rawData || samples.length === 0) return rawData;
    
    // Create a deep copy to avoid modifying the original data
    const filtered = _.cloneDeep(rawData);
    
    // Filter each data category
    for (const key in filtered) {
      const category = filtered[key as keyof RawData];
      
      // Find sample_id column index
      const sampleIdCol = category.columns.find(col => col.name === "sample_id");
      
      if (sampleIdCol) {
        const sampleCategories = sampleIdCol.categories || [];
        
        // Get indices of selected samples
        const selectedIndices: number[] = [];
        for (let i = 0; i < category.num_rows; i++) {
          const sampleIndex = sampleIdCol.data[i] as number;
          const sampleName = sampleCategories[sampleIndex];
          if (samples.includes(sampleName)) {
            selectedIndices.push(i);
          }
        }
        
        // Filter each column's data
        category.columns = category.columns.map(col => ({
          ...col,
          data: selectedIndices.map(i => col.data[i])
        }));
        
        // Update row count
        category.num_rows = selectedIndices.length;
      }
    }
    
    return filtered;
  };

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

  // Somewhere in your App component
  const [selectedSamples, setSelectedSamples] = createSignal<string[]>([]);

  // Add this function to calculate cells passing all filters
  const qcPass = createMemo(() => {
    if (!data()) return null;
    
    const cellRnaData = data()!.cell_rna_stats;
    const numCells = cellRnaData.num_rows;
    const passFilter = new Array(numCells).fill(true);
    
    // Apply all active filters
    for (const filterSettings of settings.cell_rna_stats) {
      if (filterSettings.type !== "histogram") continue;
      
      const column = cellRnaData.columns.find(c => c.name === filterSettings.field);
      if (!column) continue;
      
      const values = column.data as number[];
      const cutoffMin = filterSettings.cutoffMin;
      const cutoffMax = filterSettings.cutoffMax;
      
      // Skip filters with no cutoffs
      if (cutoffMin === undefined && cutoffMax === undefined) continue;
      
      // Apply min/max cutoffs more efficiently
      for (let i = 0; i < numCells; i++) {
        // Skip cells that already failed
        if (!passFilter[i]) continue;
        
        // Check cutoffs
        if ((cutoffMin !== undefined && values[i] < cutoffMin) ||
            (cutoffMax !== undefined && values[i] > cutoffMax)) {
          passFilter[i] = false;
        }
      }
    }
    
    // Count cells passing all filters
    return passFilter.filter(Boolean).length;
  });

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
      <For each={qcCategories}>
        {(category) => (
          <Show when={(settings[category.key] || []).length > 0}>
            <H2>{category.name}</H2>
            <div class="grid grid-cols-1 gap-4">
              <For each={settings[category.key]}>
                {(_, i) => {
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
                                data={filteredData()![category.key]}
                                filterSettings={settings[category.key][i()]}
                              />
                            </Match>
                            <Match when={settings[category.key][i()].type === "histogram"}>
                              <Histogram
                                data={filteredData()![category.key]}
                                filterSettings={settings[category.key][i()]}
                                additionalAxes={category.additionalAxes}
                              />
                            </Match>
                          </Switch>
                          <FilterSettingsForm
                            filterSettings={settings[category.key][i()]}
                            updateFilterSettings={(fn) =>
                              setSettings(category.key, i(), produce(fn))
                            }
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
          <p># Cells after sample filtering: {filteredData()!.cell_rna_stats.num_rows}</p>
        </Show>
        <Show when={data()} fallback={<p># Cells after filtering: ...</p>}>
          <p># Cells after filtering: {qcPass()}</p>
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
                <DataSummaryTable data={filteredData()![category.key]} />
              </Show>
            </div>
          )}
        </For>
      </div>
      <div class="h-64" />
    </div>
  );
};

function transformSampleMetadata(data?: RawData) {
  if (!data?.sample_summary_stats) return {};
  
  const stats = data.sample_summary_stats;
  const result: Record<string, any> = {};
  
  // Find sample_id column to get sample names
  const sampleIdCol = stats.columns.find(col => col.name === "sample_id");
  if (!sampleIdCol || !sampleIdCol.categories) return {};
  
  // Get indices and sample names
  for (let i = 0; i < stats.num_rows; i++) {
    const sampleIdx = sampleIdCol.data[i] as number;
    const sampleId = sampleIdCol.categories[sampleIdx];
    
    // Create object for this sample
    result[sampleId] = {};
    
    // Add each metric to this sample
    for (const column of stats.columns) {
      if (column.name !== "sample_id") {
        result[sampleId][column.name] = column.data[i];
      }
    }
  }
  
  return result;
}

export default App;
