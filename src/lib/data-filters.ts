import { RawData } from "../types";

export function filterData(rawData: RawData | undefined, samples: string[]): RawData | undefined {
  if (!rawData || samples.length === 0) return rawData;
  
  // Create a new object but avoid deep cloning
  const filtered: RawData = {};
  
  // Filter each data category
  for (const key in rawData) {
    const category = rawData[key as keyof RawData];
    const filteredCategory = { ...category }; // shallow clone
    
    // Find sample_id column index
    const sampleIdCol = category.columns.find(col => col.name === "sample_id");
    
    if (sampleIdCol) {
      const sampleCategories = sampleIdCol.categories || [];
      const selectedSamplesSet = new Set(samples);
      
      // Create an index array of rows to include - only iterate once
      const selectedIndices: number[] = [];
      
      // Check if we're working with a typed array for better performance
      const data = sampleIdCol.data;
      for (let i = 0; i < category.num_rows; i++) {
        const sampleIndex = data[i] as number;
        const sampleName = sampleCategories[sampleIndex];
        if (selectedSamplesSet.has(sampleName)) {
          selectedIndices.push(i);
        }
      }
      
      // More efficient column filtering
      filteredCategory.columns = category.columns.map(col => {
        // For better performance with large arrays
        const originalData = col.data;
        
        // Always create a regular array to match the RawDataColumn type
        const newData = new Array(selectedIndices.length);
        for (let i = 0; i < selectedIndices.length; i++) {
          newData[i] = originalData[selectedIndices[i]];
        }
        
        return {
          ...col,
          data: newData
        };
      });
      
      // Update row count
      filteredCategory.num_rows = selectedIndices.length;
    }
    
    filtered[key] = filteredCategory;
  }
  
  return filtered;
}

// Add the cell counting function here as well
export function calculateQcPassCells(data: RawData | undefined, cellRnaFilters: any[]): number | null {
  if (!data) return null;
  
  const cellRnaData = data.cell_rna_stats;
  const numCells = cellRnaData.num_rows;
  const passFilter = new Array(numCells).fill(true);
  
  // Apply all active filters
  for (const filterSettings of cellRnaFilters) {
    if (filterSettings.type !== "histogram") continue;
    
    const column = cellRnaData.columns.find(c => c.name === filterSettings.field);
    if (!column) continue;
    
    const values = column.data as number[];
    const cutoffMin = filterSettings.cutoffMin;
    const cutoffMax = filterSettings.cutoffMax;
    
    // Skip filters with no cutoffs
    if (cutoffMin === undefined && cutoffMax === undefined) continue;
    
    // Apply min/max cutoffs more efficiently
    for (let i = 0; i < numCells; i++) {
      // Skip cells that already failed
      if (!passFilter[i]) continue;
      
      // Check cutoffs
      if ((cutoffMin !== undefined && values[i] < cutoffMin) ||
          (cutoffMax !== undefined && values[i] > cutoffMax)) {
        passFilter[i] = false;
      }
    }
  }
  
  // Count cells passing all filters
  return passFilter.filter(Boolean).length;
}