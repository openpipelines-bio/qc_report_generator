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

type Props = {
  filterSettings: FilterSettings;
  updateFilterSettings: (fn: (settings: FilterSettings) => FilterSettings) => void;
}

export function FilterSettingsForm(props: Props) {
  return (
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
  )
}