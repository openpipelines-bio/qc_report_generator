import { Accessor, For } from "solid-js";
import { useSettingsForm } from "./settings-form";


export function GlobalVisualizationSettings(props: {
  getCategoricalColumns: Accessor<string[]>;
}) {
  const form = useSettingsForm();

  const groupingEnabled = form.useStore(state => state.values.globalVisualization.groupingEnabled);

  return <div class="mb-4 p-4 bg-gray-50 rounded-md border">
    <h3 class="text-lg font-medium mb-2">Global Visualization Settings</h3>
    <div class="flex items-center gap-2 mb-2">
      <div class="flex items-center">
        <form.Field name="globalVisualization.groupingEnabled" >
          {(field) => (
            <input 
              type="checkbox" 
              id="enable-global-grouping"
              checked={field().state.value} 
              onChange={(e) => field().handleChange(e.target.checked)}
              class="mr-2 h-4 w-4"
            />
          )}
        </form.Field>
        <label for="enable-global-grouping" class="w-auto text-sm font-medium">
          Enable global grouping
        </label>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <label class="w-24">Group By:</label>
      <form.Field 
        name="globalVisualization.groupBy"
      >
        {(field) => (
          <select 
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            value={field().state.value}
            onChange={(e) => {
              field().handleChange(e.target.value);
            }}
            disabled={!groupingEnabled()}
          >
            <For each={props.getCategoricalColumns()}>
              {(column) => (
                <option value={column}>{column}</option>
              )}
            </For>
          </select>
        )}
      </form.Field>
    </div>
  </div>
}