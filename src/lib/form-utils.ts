export function safeSetNumberValue(
  value: string | undefined,
  onChange: (value?: number) => void,
  setValid?: (valid: boolean) => void
): boolean {
  if (value === undefined || value === "") {
    setValid?.(true);
    onChange(undefined);
    return true;
  }

  const float = parseFloat(value);
  if (!isFinite(float)) {
    setValid?.(false);
    return false;
  } else {
    setValid?.(true);
    onChange(float);
    return true;
  }
}

export function isValidNumber(value: string): boolean {
  if (value === "" || value === undefined) return true;
  const float = parseFloat(value);
  return isFinite(float);
}
