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
        nBins: 10, // todo: remove
        groupBy: "sample_id",
        xAxisType: "linear",
        yAxisType: "linear", // todo: remove
      },
      {
        type: "bar",
        field: "Confidently_mapped_reads_in_cells",
        label: "Confidently mapped reads in cells",
        groupBy: "sample_id",
        nBins: 10,
        yAxisType: "linear",
      },
      {
        type: "bar",
        field: "Estimated_number_of_cells",
        label: "Estimated number of cells",
        groupBy: "sample_id",
        nBins: 10,
        yAxisType: "linear",
      },
      {
        type: "bar",
        field: "Sequencing_saturation",
        label: "Sequencing saturation",
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
        cutoffMin: 200,
        cutoffMax: undefined,
        zoomMax: 2000,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "log",
      },
      {
        type: "histogram",
        field: "num_nonzero_vars",
        label: "Number of non-zero genes per cell",
        cutoffMin: 20,
        cutoffMax: undefined,
        zoomMax: 2000,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "log",
      },
      {
        type: "histogram",
        field: "fraction_mitochondrial_genes",
        label: "Fraction UMI of mitochondrial genes per cell",
        cutoffMin: undefined,
        cutoffMax: 0.08,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "log",
      },
      {
        type: "histogram",
        field: "fraction_ribosomal_genes",
        label: "Fraction UMI of ribosomal genes per cell",
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
        cutoffMin: undefined,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "log",
      },
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

  // page layout
  return (
    <div class="container mx-a space-y-2">
      <H1>OpenPipelines Ingestion QC Report</H1>
      <SampleFilterForm
        sampleIds={data()?.sample_summary_stats.columns.find(c => c.name === "sample_id")?.categories || []}
        selectedSamples={selectedSamples()}
        onChange={setSelectedSamples}
      />
      <For each={qcCategories}>
        {(category) => (
          <Show when={(settings[category.key] || []).length > 0}>
            <H2>{category.name}</H2>
            <div class="grid grid-cols-1 gap-4">
              <For each={settings[category.key]}>
                {(_, i) => {
                  return (
                    <div>
                      <H3>{settings[category.key][i()].label}</H3>
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

export default App;
