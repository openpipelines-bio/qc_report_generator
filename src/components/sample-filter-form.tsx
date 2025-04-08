import { RawData } from "../types";
import { For, createEffect, createSignal } from "solid-js";

interface SampleMetadata {
  rna_num_barcodes?: number;
  rna_num_barcodes_filtered?: number;
  rna_sum_total_counts?: number;
  rna_median_total_counts?: number;
  rna_overall_num_nonzero_vars?: number;
  rna_median_num_nonzero_vars?: number;
}

interface SampleFilterFormProps {
  sampleIds: string[];
  selectedSamples: string[];
  onChange: (samples: string[]) => void;
  sampleMetadata?: Record<string, SampleMetadata>;
}

export function SampleFilterForm(props: SampleFilterFormProps) {
  const [viewMode, setViewMode] = createSignal<"simple" | "table">("simple");
  
  // Select all samples by default when component mounts
  createEffect(() => {
    if (props.sampleIds.length > 0 && props.selectedSamples.length === 0) {
      props.onChange([...props.sampleIds]);
    }
  });

  const toggleSample = (sampleId: string) => {
    if (props.selectedSamples.includes(sampleId)) {
      props.onChange(props.selectedSamples.filter(id => id !== sampleId));
    } else {
      props.onChange([...props.selectedSamples, sampleId]);
    }
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      props.onChange([...props.sampleIds]);
    } else {
      props.onChange([]);
    }
  };

  return (
    <div class="border p-4 rounded-md bg-gray-50 mb-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium">Sample selection</h3>
        <div class="flex space-x-2">
          <button 
            class={`px-3 py-1 text-sm rounded ${viewMode() === 'simple' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setViewMode('simple')}
          >
            Simple View
          </button>
          <button 
            class={`px-3 py-1 text-sm rounded ${viewMode() === 'table' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setViewMode('table')}
          >
            Table View
          </button>
        </div>
      </div>
      
      <div class="mb-2">
        <label class="inline-flex items-center">
          <input 
            type="checkbox" 
            checked={props.selectedSamples.length === props.sampleIds.length}
            ref={el => el.indeterminate = props.selectedSamples.length > 0 && props.selectedSamples.length < props.sampleIds.length}
            onChange={(e) => toggleAll(e.target.checked)}
            class="form-checkbox"
          />
          <span class="ml-2">Select All</span>
        </label>
      </div>
      
      {viewMode() === "simple" ? (
        <div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <For each={props.sampleIds}>
            {(sampleId) => (
              <label class="inline-flex items-center">
                <input 
                  type="checkbox" 
                  checked={props.selectedSamples.includes(sampleId)}
                  onChange={() => toggleSample(sampleId)}
                  class="form-checkbox" 
                />
                <span class="ml-2 text-sm truncate" title={sampleId}>{sampleId}</span>
              </label>
            )}
          </For>
        </div>
      ) : (
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-100">
              <tr>
                <th class="px-2 py-2 w-10">
                  <span class="sr-only">Select</span>
                </th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sample ID</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Barcodes</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Filtered Barcodes</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sum Total Counts</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Median Total Counts</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Overall Nonzero Vars</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Median Nonzero Vars</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <For each={props.sampleIds}>
                {(sampleId) => {
                  const metadata = props.sampleMetadata?.[sampleId] || {};
                  return (
                    <tr class={props.selectedSamples.includes(sampleId) ? "bg-blue-50" : ""}>
                      <td class="px-2 py-2 whitespace-nowrap">
                        <input 
                          type="checkbox" 
                          checked={props.selectedSamples.includes(sampleId)}
                          onChange={() => toggleSample(sampleId)}
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
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      )}
      
      <div class="mt-2 text-sm text-gray-500">
        {props.selectedSamples.length} of {props.sampleIds.length} samples selected
      </div>
    </div>
  );
}