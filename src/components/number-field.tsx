import { createEffect, createSignal, ParentComponent } from "solid-js";
import { TextField } from "./ui/text-field";

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

  function safeSetValue(value?: string) {
    if (value === undefined || value === "") {
      setValue("");
      setIsValid(true);
      props.onChange(undefined);
    } else {
      const float = parseFloat(value);
      if (!isFinite(float)) {
        setIsValid(false);
      } else {
        props.onChange(float);
      }
    }
  }

  return <TextField
    value={value()}
    validationState={isValid() ? "valid" : "invalid"}
    onChange={setValue}
    onFocusOut={(_) => {
      safeSetValue(value())
    }}
    onKeyPress={(e) => {
      if (e.key === "Enter") {
        safeSetValue(value())
      }
    }}
  >
    {props.children}
  </TextField>
}