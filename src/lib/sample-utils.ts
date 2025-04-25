import { RawData } from "../types";

export function transformSampleMetadata(data?: RawData) {
  if (!data?.sample_summary_stats) return {};
  
  const stats = data.sample_summary_stats;
  const result: Record<string, any> = {};
  
  // Find sample_id column to get sample names
  const sampleIdCol = stats.columns.find(col => col.name === "sample_id");
  if (!sampleIdCol || !sampleIdCol.categories) return {};
  
  // Get indices and sample names
  for (let i = 0; i < stats.num_rows; i++) {
    const sampleIdx = sampleIdCol.data[i] as number;
    const sampleId = sampleIdCol.categories[sampleIdx];
    
    // Create object for this sample
    result[sampleId] = {};
    
    // Add each metric to this sample
    for (const column of stats.columns) {
      if (column.name !== "sample_id") {
        result[sampleId][column.name] = column.data[i];
      }
    }
  }
  
  return result;
}