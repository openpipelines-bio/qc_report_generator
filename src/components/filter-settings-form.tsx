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
import { FilterSettings } from "~/types";
import { TextFieldInput, TextFieldLabel } from "./ui/text-field";
import { NumberField } from "./number-field";
import { createSignal } from "solid-js";

type Props = {
  filterSettings: FilterSettings;
  updateFilterSettings: (fn: (settings: FilterSettings) => FilterSettings) => void;
}

export function FilterSettingsForm(props: Props) {
  const [isExpanded, setIsExpanded] = createSignal(false);
  
  return (
    <div>
      <button 
        onClick={() => setIsExpanded(!isExpanded())}
        class="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md flex justify-between items-center mb-2"
      >
        <span>Figure Settings</span>
        <span class="transition-transform duration-200" classList={{ "rotate-180": isExpanded() }}>
          ▼
        </span>
      </button>
      
      {isExpanded() && (
        <div class="flex flex-row gap-2">
          <Card>
            <CardHeader>
              <CardTitle>Visualisation settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-2 gap-2">
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
                <Select
                  value={props.filterSettings.groupBy || "<none>"}
                  onChange={(value) =>
                    props.updateFilterSettings((settings) => {
                      settings.groupBy = value === null || value === "<none>" ? undefined : value;
                      return settings;
                    })
                  }
                  options={["<none>", "sample_id"]}
                  itemComponent={(props) => (
                    <SelectItem item={props.item}>
                      {props.item.rawValue}
                    </SelectItem>
                  )}
                >
                  <Label>Group By</Label>
                  <SelectTrigger aria-label="Select axis type">
                    <SelectValue<"sample_id">>
                      {(state) => state.selectedOption()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
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
              </div>
            </CardContent>
          </Card>
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
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}