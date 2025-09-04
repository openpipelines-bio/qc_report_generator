import { createEffect, createSignal, ParentComponent } from "solid-js";
import { TextField } from "./ui/text-field";
import { safeSetNumberValue } from "~/lib/form-utils";

type Props = {
  value: number | undefined;
  onChange: (value?: number) => void;
}

export const NumberField: ParentComponent<Props> = (props) => {
  const [value, setValue] = createSignal(props.value?.toString() || "");
  const [isValid, setIsValid] = createSignal(true);

  createEffect(() => {
    // Explicitly handle undefined/null values by setting to empty string
    setValue(props.value === undefined || props.value === null ? "" : props.value.toString());
  });

  return <TextField
    value={value()}
    validationState={isValid() ? "valid" : "invalid"}
    onChange={setValue}
    onFocusOut={(_) => {
      safeSetNumberValue(value(), props.onChange, setIsValid);
    }}
    onKeyPress={(e) => {
      if (e.key === "Enter") {
        safeSetNumberValue(value(), props.onChange, setIsValid);
      }
    }}
  >
    {props.children}
  </TextField>
}