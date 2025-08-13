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

export interface FilterSettings {
  type: "histogram" | "bar" | "scatter";
  visualizationType?: "histogram" | "spatial";  // Only histogram and spatial
  field: string;
  label?: string;
  // yField can still stay as it might be used by the scatterplot component
  yField?: string;
  yLabel?: string;
  description?: string;
  cutoffMin?: number;
  cutoffMax?: number;
  cutoffMinY?: number;
  cutoffMaxY?: number;
  zoomMin?: number;
  zoomMax?: number;
  zoomMinY?: number;
  zoomMaxY?: number;
  nBins?: number;
  groupBy?: string;
  xAxisType?: "linear" | "log";
  yAxisType?: "linear" | "log";
  // Per-sample filters for spatial data
  perSampleFilters?: {
    [sampleId: string]: {
      cutoffMin?: number;
      cutoffMax?: number;
    };
  };
}

// New type definitions
export type ReportStructure = {
  categories: QCCategory[];
}

export type QCCategory = {
  name: string;
  key: keyof RawData;
  additionalAxes: boolean;
  defaultFilters: FilterSettings[];
};

export type Settings = {
  [key in keyof RawData]: FilterSettings[];
};

export type SampleMetadata = Record<string, {
  rna_num_barcodes?: number;
  rna_num_barcodes_filtered?: number;
  rna_sum_total_counts?: number;
  rna_median_total_counts?: number;
  rna_overall_num_nonzero_vars?: number;
  rna_median_num_nonzero_vars?: number;
  [key: string]: any;
}>;

export type HeatmapData = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  numBinsX: number;
  numBinsY: number;
  binWidthX: number;
  binWidthY: number;
  xBinCenters: number[];
  yBinCenters: number[];
  binIndices: number[][][];
};
