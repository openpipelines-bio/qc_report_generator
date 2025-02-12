export type RawDataColumn = {
  name: string;
  dtype: "categorical" | "numeric" | "boolean" | "integer";
  data: any[];
  categories?: string[];
};

export type RawDataCategory = {
  num_rows: number;
  num_columns: number;
  columns: RawDataColumn[];
};

export type RawData = {
  [key: string]: RawDataCategory;
};

export type FilterSettings = {
  type: "bar" | "histogram";
  field: string;
  label: string;
  cutoffMin?: number;
  cutoffMax?: number;
  zoomMin?: number;
  zoomMax?: number;
  nBins: number;
  xAxisType?: "log" | "linear";
  yAxisType?: "log" | "linear";
  groupBy?: string;
};

export type BinSettings = {
  discrete: boolean;
  num_bins: number;
  min: number;
  max: number;
  values?: {
    i: number;
    x: number;
    x0: number;
    x1: number;
    count_qc_pass: number;
    count_qc_fail: number;
  }[];
};
