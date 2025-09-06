import { dataLoader } from './data-loader';
import { RawData } from '../types';

export interface ProgressiveDataAdapter {
  /**
   * Check if progressive data is available
   */
  hasProgressiveData(): boolean;
  
  /**
   * Load column data for a specific chart
   */
  loadColumnData(categoryKey: string, columnName: string): Promise<number[] | string[]>;
  
  /**
   * Load category data for a chart (all columns in a category)
   */
  loadCategoryData(categoryKey: string): Promise<any>;
  
  /**
   * Preload data for critical path (first visible charts)
   */
  preloadCriticalData(): Promise<void>;
}

class ProgressiveDataAdapterImpl implements ProgressiveDataAdapter {
  private preloadPromise: Promise<void> | null = null;
  
  hasProgressiveData(): boolean {
    return dataLoader.hasProgressiveData();
  }
  
  async loadColumnData(categoryKey: string, columnName: string): Promise<number[] | string[]> {
    if (!this.hasProgressiveData()) {
      throw new Error('Progressive data not available');
    }
    
    try {
      const columnData = await dataLoader.loadColumn(columnName, categoryKey);
      
      // Convert ArrayBuffer to the appropriate typed array based on data type
      if (columnData instanceof ArrayBuffer) {
        const view = new Float32Array(columnData);
        return Array.from(view);
      }
      
      // Handle TypedColumnData
      if (typeof columnData === 'object' && columnData !== null && 'data' in columnData) {
        return (columnData as any).data as number[] | string[];
      }
      
      return columnData as unknown as number[] | string[];
    } catch (error) {
      console.warn(`Failed to load progressive column data for ${categoryKey}.${columnName}:`, error);
      throw error;
    }
  }
  
  async loadCategoryData(categoryKey: string): Promise<any> {
    if (!this.hasProgressiveData()) {
      throw new Error('Progressive data not available');
    }
    
    try {
      return await dataLoader.loadCategory(categoryKey);
    } catch (error) {
      console.warn(`Failed to load progressive category data for ${categoryKey}:`, error);
      throw error;
    }
  }
  
  async preloadCriticalData(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    
    if (!this.hasProgressiveData()) {
      return;
    }
    
    this.preloadPromise = this._doPreloadCriticalData();
    return this.preloadPromise;
  }
  
  private async _doPreloadCriticalData(): Promise<void> {
    // Preload data that's likely to be needed immediately
    const criticalCategories = ['sample_summary_stats', 'cell_rna_stats'];
    const criticalColumns = ['sample_id', 'total_counts', 'n_genes_by_counts'];
    
    const preloadPromises: Promise<any>[] = [];
    
    // Preload critical columns
    for (const categoryKey of criticalCategories) {
      for (const columnName of criticalColumns) {
        preloadPromises.push(
          this.loadColumnData(categoryKey, columnName).catch(() => {
            // Ignore errors for preloading - not all columns exist in all categories
          })
        );
      }
    }
    
    await Promise.allSettled(preloadPromises);
  }
}

// Export singleton instance
export const progressiveDataAdapter = new ProgressiveDataAdapterImpl();

/**
 * Enhanced data loading function that uses progressive loading when available
 */
export async function getDataForChart(
  categoryKey: string, 
  columnNames?: string[]
): Promise<RawData[keyof RawData]> {
  
  if (progressiveDataAdapter.hasProgressiveData() && columnNames && columnNames.length < 5) {
    // Use progressive loading for small, targeted requests
    try {
      const categoryData = await progressiveDataAdapter.loadCategoryData(categoryKey);
      
      // Filter to only requested columns if specified
      if (columnNames) {
        const filteredColumns = categoryData.columns.filter((col: any) => 
          columnNames.includes(col.name)
        );
        return {
          ...categoryData,
          columns: filteredColumns
        };
      }
      
      return categoryData;
    } catch (error) {
      console.warn(`Progressive loading failed for ${categoryKey}, falling back to full data:`, error);
    }
  }
  
  // Fall back to getting data from the main dataset
  // This would typically come from the already loaded RawData
  throw new Error('Chart data loading fallback not implemented - need access to full dataset');
}
