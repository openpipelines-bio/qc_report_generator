import { Accessor, For, Show, createSignal } from "solid-js";
import { useSettingsForm } from "./settings-form";

export function GlobalVisualizationSettings(props: {
  getCategoricalColumns: Accessor<string[]>;
}) {
  const form = useSettingsForm();
  const groupingEnabled = form.useStore(state => state.values.globalVisualization.groupingEnabled);
  const binning = form.useStore(state => state.values.binning);
  
  // Local signal to track linked state since it's not in the form model
  const [linkedResolutions, setLinkedResolutions] = createSignal(false);
  // State to track if bin settings dropdown is open
  const [binningOpen, setbinning] = createSignal(false);

  // Resolution presets
  const resolutionPresets = [
    { label: "Low", x: 50, y: 50 },
    { label: "Medium", x: 75, y: 75 },
    { label: "High", x: 100, y: 100 },
    { label: "Very High", x: 150, y: 150 }
  ];

  // Function to apply resolution presets
  const applyPreset = (x: number, y: number) => {
    form.setFieldValue("binning.numBinsX", x);
    form.setFieldValue("binning.numBinsY", y);
  };
  
  // Function to handle X resolution change with linked mode
  const handleXResolutionChange = (value: number) => {
    form.setFieldValue("binning.numBinsX", value);
    
    // If resolutions are linked, update Y to match X
    if (linkedResolutions()) {
      form.setFieldValue("binning.numBinsY", value);
    }
  };

  return (
    <div class="mb-4 p-4 bg-gray-50 rounded-md border">
      <h3 class="text-lg font-medium mb-2">Global Visualization Settings</h3>
      <div class="flex flex-col gap-2">
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
        <div class="flex items-center">
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

      {/* Binning settings */}
      <Show when={binning().enabled}>
        <div class="mt-4 border rounded-md bg-white overflow-hidden">
          {/* Collapsible Header */}
          <button 
            type="button"
            onClick={() => setbinning(!binningOpen())}
            class="w-full p-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <div class="flex items-center">
              <h3 class="font-medium">Binning Resolution</h3>
              <span class="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {binning().numBinsX} × {binning().numBinsY}
              </span>
            </div>
            <svg 
              class={`w-5 h-5 transform transition-transform ${binningOpen() ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          
          {/* Collapsible Content */}
          <div 
            class={`transition-all duration-300 ease-in-out overflow-hidden ${binningOpen() ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div class="p-4">
              {/* Visual representation of current resolution */}
              <div class="mb-4 flex justify-center">
                <div 
                  class="relative border border-gray-300 rounded-md bg-gray-50" 
                  style={{
                    width: "180px",
                    height: "120px",
                    overflow: "hidden"
                  }}
                >
                  <div 
                    class="absolute inset-0 grid" 
                    style={{
                      "grid-template-columns": `repeat(${Math.min(20, binning().numBinsX)}, 1fr)`,
                      "grid-template-rows": `repeat(${Math.min(15, binning().numBinsY)}, 1fr)`
                    }}
                  >
                    {Array.from({ length: Math.min(20, binning().numBinsX) * Math.min(15, binning().numBinsY) }).map((_, i) => (
                      <div class="border border-blue-200 bg-blue-50 opacity-60"></div>
                    ))}
                  </div>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-sm font-medium text-gray-700 bg-white/80 px-2 py-1 rounded">
                      {binning().numBinsX} × {binning().numBinsY}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Resolution presets */}
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Resolution Presets</label>
                <div class="flex gap-2 flex-wrap">
                  {resolutionPresets.map(preset => (
                    <button 
                      type="button"
                      class="px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                      onClick={() => applyPreset(preset.x, preset.y)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* X-axis resolution with form field */}
              <div class="mb-4">
                <div class="flex justify-between items-center mb-1">
                  <label class="block text-sm font-medium text-gray-700">X-Axis Resolution</label>
                  <span class="text-sm text-gray-500">{binning().numBinsX} bins</span>
                </div>
                <form.Field name="binning.numBinsX">
                  {(field) => (
                    <div class="space-y-2">
                      <input 
                        type="range" 
                        min="5" 
                        max="175"
                        step="5"
                        value={field().state.value} 
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          field().handleChange(value);
                          if (linkedResolutions()) {
                            form.setFieldValue("binning.numBinsY", value);
                          }
                        }}
                        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div class="flex justify-between text-xs text-gray-400 px-1">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>
              
              {/* Y-axis resolution with form field */}
              <div class="mb-4">
                <div class="flex justify-between items-center mb-1">
                  <label class="block text-sm font-medium text-gray-700">Y-Axis Resolution</label>
                  <span class="text-sm text-gray-500">{binning().numBinsY} bins</span>
                </div>
                <form.Field name="binning.numBinsY">
                  {(field) => (
                    <div class="space-y-2">
                      <input 
                        type="range" 
                        min="5" 
                        max="175"
                        step="5"
                        value={field().state.value} 
                        onChange={(e) => field().handleChange(parseInt(e.target.value))}
                        disabled={linkedResolutions()}
                        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-60"
                      />
                      <div class="flex justify-between text-xs text-gray-400 px-1">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>
              
              {/* Link X and Y resolutions option using local state */}
              <div class="mt-3 flex items-center">
                <input 
                  type="checkbox" 
                  id="link-resolutions"
                  checked={linkedResolutions()} 
                  onChange={(e) => {
                    setLinkedResolutions(e.target.checked);
                    if (e.target.checked) {
                      // If linking is enabled, set Y to match X
                      form.setFieldValue("binning.numBinsY", binning().numBinsX);
                    }
                  }}
                  class="mr-2 h-4 w-4"
                />
                <label for="link-resolutions" class="text-sm text-gray-700">
                  Link X and Y resolutions
                </label>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}