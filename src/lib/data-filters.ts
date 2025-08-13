import { RawData, FilterSettings } from "../types";

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
  
  // Get sample column for per-sample filtering
  const sampleIdColumn = cellRnaData.columns.find(c => c.name === "sample_id");
  const sampleIdData = sampleIdColumn?.data;
  const sampleCategories = sampleIdColumn?.categories;
  
  // Apply all active filters
  for (const filterSettings of cellRnaFilters) {
    if (filterSettings.type !== "histogram") continue;
    
    const column = cellRnaData.columns.find(c => c.name === filterSettings.field);
    if (!column) continue;
    
    const values = column.data as number[];
    let cutoffMin = filterSettings.cutoffMin;
    let cutoffMax = filterSettings.cutoffMax;
    
    // Skip filters with no cutoffs (unless there are per-sample filters)
    if (cutoffMin === undefined && cutoffMax === undefined && !filterSettings.perSampleFilters) continue;
    
    // Apply min/max cutoffs more efficiently
    for (let i = 0; i < numCells; i++) {
      // Skip cells that already failed
      if (!passFilter[i]) continue;
      
      let effectiveCutoffMin = cutoffMin;
      let effectiveCutoffMax = cutoffMax;
      
      // Check for per-sample filters for spatial data
      if (filterSettings.perSampleFilters && sampleIdData && sampleCategories) {
        const sampleIndex = sampleIdData[i] as number;
        const sampleId = sampleCategories[sampleIndex];
        const sampleFilter = filterSettings.perSampleFilters[sampleId];
        
        if (sampleFilter) {
          // Use per-sample thresholds if available
          effectiveCutoffMin = sampleFilter.cutoffMin !== undefined ? sampleFilter.cutoffMin : effectiveCutoffMin;
          effectiveCutoffMax = sampleFilter.cutoffMax !== undefined ? sampleFilter.cutoffMax : effectiveCutoffMax;
        }
      }
      
      // Check cutoffs
      if ((effectiveCutoffMin !== undefined && values[i] < effectiveCutoffMin) ||
          (effectiveCutoffMax !== undefined && values[i] > effectiveCutoffMax)) {
        passFilter[i] = false;
      }
    }
  }
  
  // Count cells passing all filters
  return passFilter.filter(Boolean).length;
}

export function getPassingCellIndices(cellsData: any, cellFilters: FilterSettings[]): Set<number> {
  const passingCellIndices = new Set<number>();
  
  // Start with all cells passing
  for (let i = 0; i < cellsData.num_rows; i++) {
    passingCellIndices.add(i);
  }
  
  // Get sample column for per-sample filtering
  const sampleIdColumn = cellsData.columns.find((col: { name: string }) => col.name === "sample_id");
  const sampleIdData = sampleIdColumn?.data;
  const sampleCategories = sampleIdColumn?.categories;
  
  // Apply each filter
  for (const filter of cellFilters) {
    if (filter.cutoffMin !== undefined || filter.cutoffMax !== undefined || filter.perSampleFilters) {
      const columnIndex: number = cellsData.columns.findIndex((col: { name: string }) => col.name === filter.field);
      if (columnIndex !== -1) {
        const columnData = cellsData.columns[columnIndex].data;
        
        // Filter cells based on min/max thresholds
        for (let i = 0; i < cellsData.num_rows; i++) {
          if (!passingCellIndices.has(i)) continue; // Skip already filtered
          
          const value = columnData[i];
          let cutoffMin = filter.cutoffMin;
          let cutoffMax = filter.cutoffMax;
          
          // Check for per-sample filters for spatial data
          if (filter.perSampleFilters && sampleIdData && sampleCategories) {
            const sampleIndex = sampleIdData[i] as number;
            const sampleId = sampleCategories[sampleIndex];
            const sampleFilter = filter.perSampleFilters[sampleId];
            
            if (sampleFilter) {
              // Use per-sample thresholds if available
              cutoffMin = sampleFilter.cutoffMin !== undefined ? sampleFilter.cutoffMin : cutoffMin;
              cutoffMax = sampleFilter.cutoffMax !== undefined ? sampleFilter.cutoffMax : cutoffMax;
            }
          }
          
          if ((cutoffMin !== undefined && value < cutoffMin) || 
              (cutoffMax !== undefined && value > cutoffMax)) {
            passingCellIndices.delete(i);
          }
        }
      }
    }
  }
  
  return passingCellIndices;
}