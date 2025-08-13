import { For, Match, Switch, createSignal } from "solid-js";
import { useSettingsForm } from "./settings-form";
import { RawData } from "~/types";

interface SampleMetadata {
  rna_num_barcodes?: number;
  rna_num_barcodes_filtered?: number;
  rna_sum_total_counts?: number;
  rna_median_total_counts?: number;
  rna_overall_num_nonzero_vars?: number;
  rna_median_num_nonzero_vars?: number;
}

interface SampleFilterFormProps {
  sampleMetadata: Record<string, SampleMetadata>;
  data?: RawData;
}

function SimpleViewMode(props: SampleFilterFormProps) {
  const form = useSettingsForm();

  return (
    <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      <For each={Object.keys(props.sampleMetadata)}>
        {(sampleId) => (
          <form.Field name="sampleSelection.selectedSamples">
            {(field) => (
              <label class="inline-flex items-center">
                <input 
                  type="checkbox" 
                  checked={field().state.value.includes(sampleId)}
                  onChange={() => {
                    const currentSelection = field().state.value;
                    if (currentSelection.includes(sampleId)) {
                      field().handleChange(currentSelection.filter(id => id !== sampleId));
                    } else {
                      field().handleChange([...currentSelection, sampleId]);
                    }
                  }}
                  class="form-checkbox" 
                />
                <span class="ml-2 text-sm truncate" title={sampleId}>{sampleId}</span>
              </label>
            )}
          </form.Field>
        )}
      </For>
    </div>
  )
}

function TableViewMode(props: SampleFilterFormProps) {
  const form = useSettingsForm();

  return (
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-2 py-2 w-10">
              <span class="sr-only">Select</span>
            </th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sample ID</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Barcodes</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              <div class="flex items-center">
                <span>Filtered Barcodes</span>
                <div class="ml-1 relative group">
                  <svg class="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div class="bg-black text-white text-xs rounded py-1 px-2 max-w-xs">
                      Cells that passed pre-filtering (min. total counts = {props.data?.cell_rna_stats?.min_total_counts ?? "N/A"}, min. non-zero genes = {props.data?.cell_rna_stats?.min_num_nonzero_vars ?? "N/A"})
                    </div>
                  </div>
                </div>
              </div>
            </th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sum Total Counts</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Median Total Counts</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Overall Nonzero Vars</th>
            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Median Nonzero Vars</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <For each={Object.keys(props.sampleMetadata)}>
            {(sampleId) => {
              const metadata = props.sampleMetadata?.[sampleId] || {};
              return (
                <form.Field name="sampleSelection.selectedSamples">
                  {(field) =>
                      <tr class={field().state.value.includes(sampleId) ? "bg-blue-50" : ""}>
                        <td class="px-2 py-2 whitespace-nowrap">
                          <input 
                            type="checkbox" 
                            checked={field().state.value.includes(sampleId)}
                            onChange={() => {
                              const currentSelection = field().state.value;
                              if (currentSelection.includes(sampleId)) {
                                field().handleChange(currentSelection.filter(id => id !== sampleId));
                              } else {
                                field().handleChange([...currentSelection, sampleId]);
                              }
                            }}
                            class="form-checkbox" 
                          />
                        </td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm font-medium">{sampleId}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">{metadata.rna_num_barcodes?.toLocaleString() || "-"}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">{metadata.rna_num_barcodes_filtered?.toLocaleString() || "-"}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">{metadata.rna_sum_total_counts?.toLocaleString() || "-"}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">{metadata.rna_median_total_counts?.toLocaleString() || "-"}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">{metadata.rna_overall_num_nonzero_vars?.toLocaleString() || "-"}</td>
                        <td class="px-3 py-2 whitespace-nowrap text-sm">{metadata.rna_median_num_nonzero_vars?.toLocaleString() || "-"}</td>
                      </tr>
                  }
                </form.Field>
              );
            }}
          </For>
        </tbody>
      </table>
    </div>
  )
}

export function SampleFilterForm(props: SampleFilterFormProps) {
  const [viewMode, setViewMode] = createSignal<"simple" | "table">("simple");
  const form = useSettingsForm();
  const store = form.useStore(state => state.values.sampleSelection);

  return (
    <div class="border p-4 rounded-md bg-gray-50 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium">Sample selection</h3>
        
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
              transform: viewMode() === 'simple' 
                ? 'translateX(0)' 
                : 'translateX(calc(100% + 4px))'
            }}
          />
          
          <div class="absolute inset-0 flex w-full h-full">
            <div 
              class="flex items-center justify-center w-1/2 cursor-pointer"
              onClick={() => setViewMode('simple')}
            >
              <span 
                class={`text-sm font-medium transition-colors duration-200 ${
                  viewMode() === 'simple' ? 'text-gray-800' : 'text-gray-500'
                }`}
              >
                Simple
              </span>
            </div>
            
            <div 
              class="flex items-center justify-center w-1/2 cursor-pointer"
              onClick={() => setViewMode('table')}
            >
              <span 
                class={`text-sm font-medium transition-colors duration-200 ${
                  viewMode() === 'table' ? 'text-gray-800' : 'text-gray-500'
                }`}
              >
                Table
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="mb-2">
        <form.Field name="sampleSelection.selectedSamples">
          {(field) => (
            <label class="inline-flex items-center">
              <input 
                type="checkbox" 
                checked={
                  field().state.value.length === Object.keys(props.sampleMetadata).length
                }
                ref={el => 
                  el.indeterminate = field().state.value.length > 0 && field().state.value.length < Object.keys(props.sampleMetadata).length
                }
                onChange={(e) =>
                  e.target.checked 
                    ? field().handleChange(Object.keys(props.sampleMetadata)) 
                    : field().handleChange([])
                }
                class="form-checkbox"
              />
              <span class="ml-2">Select All</span>
            </label>
          )}
        </form.Field>
      </div>

      <Switch>
        <Match when={viewMode() === "simple"}>
          <SimpleViewMode {...props} />
        </Match>
        <Match when={viewMode() === "table"}>
          <TableViewMode {...props} />
        </Match>
      </Switch>
      
      <div class="mt-2 text-sm text-gray-500">
        {store().selectedSamples.length} of {Object.keys(props.sampleMetadata).length} samples selected
      </div>

      {/* Add info about pre-filtering */}
      <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
        <div class="flex items-start">
          <div class="flex-shrink-0 mt-0.5">
            <svg class="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h4 class="font-medium text-blue-800">
              Data was pre-filtered with thresholds (min. total counts = {props.data?.cell_rna_stats?.min_total_counts ?? "N/A"}, min. non-zero genes = {props.data?.cell_rna_stats?.min_num_nonzero_vars ?? "N/A"}). 
              The "Filtered Barcodes" column shows the number of cells that passed this initial filtering.
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}