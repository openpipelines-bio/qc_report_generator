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
        description: "Shows the total sequencing depth for each sample. Higher values generally indicate more comprehensive cell profiling.",
        nBins: 10,
        groupBy: "sample_id",
        xAxisType: "linear",
        yAxisType: "linear",
      },
      {
        type: "bar",
        field: "Confidently_mapped_reads_in_cells",
        label: "Confidently mapped reads in cells",
        description: "Indicates the number of reads that mapped unambiguously to the reference genome within cell-containing droplets.",
        groupBy: "sample_id",
        nBins: 10,
        yAxisType: "linear",
      },
      {
        type: "bar",
        field: "Estimated_number_of_cells",
        label: "Estimated number of cells",
        description: "Shows CellRanger's estimate of the number of cells in each sample based on the UMI count distribution.",
        groupBy: "sample_id",
        nBins: 10,
        yAxisType: "linear",
      },
      {
        type: "bar",
        field: "Sequencing_saturation",
        label: "Sequencing saturation",
        description: "Indicates the fraction of reads that are duplicates of existing UMIs. Higher values suggest deeper sequencing coverage.",
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
        description: "Distribution of total UMI counts per cell. Very low counts may indicate empty droplets or dead cells.",
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
        description: "Number of genes detected in each cell. Low gene counts may indicate poor-quality cells or empty droplets.",
        cutoffMin: 20,
        cutoffMax: undefined,
        zoomMax: 2000,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "log",
      },
      {
        type: "histogram",
        field: "fraction_mitochondrial",
        label: "Fraction UMI of mitochondrial genes per cell",
        description: "Proportion of transcripts from mitochondrial genes. High values often indicate stressed or dying cells.",
        cutoffMin: undefined,
        cutoffMax: 0.08,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "log",
      },
      {
        type: "histogram",
        field: "fraction_ribosomal",
        label: "Fraction UMI of ribosomal genes per cell",
        description: "Proportion of transcripts from ribosomal genes. Can indicate cell state and RNA quality.",
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
        description: "Proportion of UMIs from the 50 most-expressed genes. High values may indicate low complexity or specialized cell types.",
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
        description: "Probability that a barcode corresponds to a cell (vs. background) according to CellBender's model.",
        cutoffMin: 0.5,
        cutoffMax: undefined,
        nBins: 50,
        groupBy: "sample_id",
        yAxisType: "linear",
      },
      {
        type: "histogram",
        field: "cellbender_background_fraction",
        label: "CellBender background fraction",
        description: "Estimated fraction of UMIs that come from ambient RNA rather than the cell itself.",
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
        description: "Estimate of true RNA content per cell after removing ambient RNA background.",
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
        description: "Estimate of RNA capture efficiency for each droplet in the experiment.",
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

  // page layout
  return (
    <div class="container mx-a space-y-2">
      <H1>OpenPipelines Ingestion QC Report</H1>
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
                      {/* Add description display here */}
                      <Show when={settings[category.key][i()].description}>
                        <p class="text-gray-600 text-sm mb-2">{settings[category.key][i()].description}</p>
                      </Show>
                      <div class="flex flex-col space-y-2">
                        <Switch>
                          <Match when={!data()}>
                            <div>Loading...</div>
                          </Match>
                          <Match when={settings[category.key][i()].type === "bar"}>
                            <BarPlot
                              data={data()![category.key]}
                              filterSettings={settings[category.key][i()]}
                            />
                          </Match>
                          <Match when={settings[category.key][i()].type === "histogram"}>
                            <Histogram
                              data={data()![category.key]}
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
        </Show>
        {/* <Show when={qcPass()} fallback={<p># Cells after filtering: ...</p>}>
          <p># Cells after filtering: {_.sum(qcPass()!)}</p>
        </Show> */}
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
                <DataSummaryTable data={data()![category.key]} />
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
