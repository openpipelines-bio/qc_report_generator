import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/small-card";
import { FilterSettings, RawDataCategory, RawData } from "~/types";
import { TextFieldInput, TextFieldLabel } from "./ui/text-field";
import { NumberField } from "./number-field";
import { createSignal, Show } from "solid-js";

// Update the props to include the global group by, force group by, and isGlobalGroupingEnabled
type Props = {
  filterSettings: FilterSettings;
  updateFilterSettings: (fn: (settings: FilterSettings) => FilterSettings) => void;
  data: RawDataCategory;
  globalGroupBy?: string | undefined;
  forceGroupBy?: string | undefined;
  isGlobalGroupingEnabled?: boolean;
  category?: keyof RawData;
}

export function FilterSettingsForm(props: Props) {
  const [isExpanded, setIsExpanded] = createSignal(false);
  
  // Get all categorical columns from the data
  const getCategoricalColumns = () => {
    const categoricalColumns = props.data.columns
      .filter(col => col.dtype === "categorical")
      .map(col => col.name);
    
    // Add a "<none>" option at the beginning
    return ["<none>", ...categoricalColumns];
  };

  // Remove getNumericalColumns() function as it's no longer needed

  // Add a constant to check if the data has spatial coordinates
  const hasSpatialCoordinates = () => {
    const hasX = props.data.columns.some(c => c.name === "x_coord");
    const hasY = props.data.columns.some(c => c.name === "y_coord");
    return hasX && hasY;
  };

  // Inside the component, add this function to calculate filter impact
  const getFilterImpact = () => {
    // Only apply for histogram plots with thresholds and in cell_rna_stats category
    if (props.category !== 'cell_rna_stats' || 
        props.filterSettings.visualizationType !== 'histogram' || 
        (props.filterSettings.cutoffMin === undefined && props.filterSettings.cutoffMax === undefined)) {
      return null;
    }
    
    const cellsData = props.data;
    if (!cellsData || !cellsData.columns) return null;
    
    const field = props.filterSettings.field;
    const min = props.filterSettings.cutoffMin;
    const max = props.filterSettings.cutoffMax;
    
    const colIndex = cellsData.columns.findIndex(c => c.name === field);
    if (colIndex < 0) return null;
    
    const colData = cellsData.columns[colIndex].data;
    const totalCells = colData.length;
    let affectedCount = 0;
    
    for (let i = 0; i < totalCells; i++) {
      const val = colData[i];
      if ((min !== undefined && val < min) || (max !== undefined && val > max)) {
        affectedCount++;
      }
    }
    
    const percent = Math.round((affectedCount / totalCells) * 100);
    const isHighImpact = percent > 30;
    
    return { affectedCount, totalCells, percent, isHighImpact };
  };
  
  // Update these variable definitions
  const isBarPlot = props.filterSettings.type === "bar";
  const isHistogram = (props.filterSettings.type === "histogram" || props.filterSettings.visualizationType === "histogram");
  
  // Add a function to check if we're in spatial mode
  const isSpatial = () => {
    return props.filterSettings.visualizationType === "spatial" &&
           hasSpatialCoordinates();
  };
  
  return (
    <div>
      <button 
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md flex justify-between items-center mb-2"
      >
        <span>Visualisation Settings {isBarPlot ? "" : "& Filter Thresholds"}</span>
        <span class="transition-transform duration-200" classList={{ "rotate-180": isExpanded() }}>
          ▼
        </span>
      </button>
      
      {isExpanded() && (
        <div class="flex flex-col gap-4">
          <div class="flex flex-row gap-2">
            <Card>
              <CardHeader>
                <CardTitle>Visualisation settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div class="grid grid-cols-2 gap-2">
                  {/* Only show Min/Max zoom fields for histograms */}
                  {isHistogram && (
                    <>
                      <NumberField
                        value={props.filterSettings.zoomMin}
                        onChange={(value) => props.updateFilterSettings((settings) => { 
                          settings.zoomMin = value;
                          return settings;
                        })}
                      >
                        <TextFieldLabel>Min</TextFieldLabel>
                        <TextFieldInput />
                      </NumberField>
                      <NumberField
                        value={props.filterSettings.zoomMax}
                        onChange={(value) => props.updateFilterSettings((settings) => {
                          settings.zoomMax = value;
                          return settings;
                        })}
                      >
                        <TextFieldLabel>Max</TextFieldLabel>
                        <TextFieldInput />
                      </NumberField>
                    </>
                  )}
                  
                  {/* Remove the Y-field selection section entirely */}
                  
                  <div class="relative">
                    <Select
                      value={props.forceGroupBy || (props.isGlobalGroupingEnabled && props.globalGroupBy) || props.filterSettings.groupBy || "sample_id"}
                      onChange={(value) =>
                        props.updateFilterSettings((settings) => {
                          settings.groupBy = value === null ? undefined : value;
                          return settings;
                        })
                      }
                      options={getCategoricalColumns()}
                      itemComponent={(props) => (
                        <SelectItem item={props.item}>
                          {props.item.rawValue}
                        </SelectItem>
                      )}
                      disabled={!!(props.forceGroupBy || (props.isGlobalGroupingEnabled && props.globalGroupBy))}
                    >
                      <Label>
                        Group By {props.forceGroupBy ? "(Fixed)" : (props.isGlobalGroupingEnabled && props.globalGroupBy) ? "(Global)" : ""}
                      </Label>
                      <SelectTrigger aria-label="Select grouping column">
                        <SelectValue<string>>
                          {(state) => state.selectedOption()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                    {props.forceGroupBy && (
                      <div class="text-xs text-gray-500 mt-1">
                        This plot always uses "{props.forceGroupBy}" grouping
                      </div>
                    )}
                    {!props.forceGroupBy && props.isGlobalGroupingEnabled && props.globalGroupBy && (
                      <div class="text-xs text-gray-500 mt-1">
                        Global group by setting is active
                      </div>
                    )}
                  </div>
                  
                  {/* Only show #Bins for histograms */}
                  {isHistogram && (
                    <NumberField
                      value={props.filterSettings.nBins}
                      onChange={(value) => props.updateFilterSettings((settings) => {
                        settings.nBins = value || 50;
                        return settings;
                      })}
                    >
                      <TextFieldLabel># Bins</TextFieldLabel>
                      <TextFieldInput />
                    </NumberField>
                  )}
                  
                  {/* Always show X-Axis Scale */}
                  <Select
                    value={props.filterSettings.xAxisType || "linear"}
                    onChange={(value) =>
                      props.updateFilterSettings((settings) => {
                        settings.xAxisType = value as "log" | "linear";
                        return settings;
                      })
                    }
                    options={["linear", "log"]}
                    itemComponent={(props) => (
                      <SelectItem item={props.item}>
                        {props.item.rawValue}
                      </SelectItem>
                    )}
                  >
                    <Label>X-Axis Scale</Label>
                    <SelectTrigger aria-label="Select X-axis scale">
                      <SelectValue<"linear" | "log">>
                        {(state) => state.selectedOption()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                  
                  {/* Update Y-Axis Scale to only show for histograms */}
                  {isHistogram && (
                    <Select
                      value={props.filterSettings.yAxisType || "linear"}
                      onChange={(value) =>
                        props.updateFilterSettings((settings) => {
                          settings.yAxisType = value as "log" | "linear";
                          return settings;
                        })
                      }
                      options={["linear", "log"]}
                      itemComponent={(props) => (
                        <SelectItem item={props.item}>
                          {props.item.rawValue}
                        </SelectItem>
                      )}
                    >
                      <Label>Y-Axis Scale</Label>
                      <SelectTrigger aria-label="Select Y-axis scale">
                        <SelectValue<"linear" | "log">>
                          {(state) => state.selectedOption()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                  )}
                  
                  {/* Add hexbin controls */}
                  <Show when={isSpatial()}>
                    <div class="col-span-2">
                      <div class="mt-2">
                        <label class="block text-sm font-medium text-gray-700 mb-1">
                          Hexbin Size
                        </label>
                        <div class="flex items-center gap-2">
                          <input
                            type="range"
                            min="5"
                            max="50"
                            step="5"
                            value={props.filterSettings.binSize || 20}
                            onInput={(e) => props.updateFilterSettings(settings => {
                              settings.binSize = parseInt(e.target.value);
                              return settings;
                            })}
                            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <span class="text-sm text-gray-500 w-10 text-right">
                            {props.filterSettings.binSize || 20}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Show>
                </div>
              </CardContent>
            </Card>
            
            {/* Only show Filter thresholds card for cell_rna_stats */}
            {props.category === "cell_rna_stats" && (
              <Card>
                <CardHeader>
                  <CardTitle>Filter thresholds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="grid grid-cols-2 gap-2">
                    <NumberField
                      value={props.filterSettings.cutoffMin}
                      onChange={(value) => {
                        props.updateFilterSettings((settings) => {
                          settings.cutoffMin = value;
                          return settings;
                        });
                      }}
                    >
                      <TextFieldLabel>Min</TextFieldLabel>
                      <TextFieldInput />
                    </NumberField>
                    <NumberField
                      value={props.filterSettings.cutoffMax}
                      onChange={(value) => props.updateFilterSettings((settings) => {
                        settings.cutoffMax = value;
                        return settings;
                      })}
                    >
                      <TextFieldLabel>Max</TextFieldLabel>
                      <TextFieldInput />
                    </NumberField>
                    
                    {props.category === 'cell_rna_stats' && (props.filterSettings.cutoffMin !== undefined || props.filterSettings.cutoffMax !== undefined) && (
                      () => {
                        const impact = getFilterImpact();
                        return impact && (
                          <div class="col-span-2 mt-2 text-sm text-gray-600">
                            <div class="flex items-center">
                              <span class="mr-2">Filter impact:</span>
                              <span class={impact.isHighImpact ? "text-amber-600 font-medium" : ""}>
                                Removing {impact.affectedCount} of {impact.totalCells} cells ({impact.percent}%)
                              </span>
                              {impact.isHighImpact && <span class="text-amber-600 ml-2">⚠️ High impact</span>}
                            </div>
                          </div>
                        );
                      }
                    )()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}