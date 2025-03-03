import { For, createEffect } from "solid-js";

export function SampleFilterForm(props: {
  sampleIds: string[];
  selectedSamples: string[];
  onChange: (samples: string[]) => void;
}) {
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
      <h3 class="text-lg font-medium mb-2">Filter Samples</h3>
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
      <div class="mt-2 text-sm text-gray-500">
        {props.selectedSamples.length} of {props.sampleIds.length} samples selected
      </div>
    </div>
  );
}