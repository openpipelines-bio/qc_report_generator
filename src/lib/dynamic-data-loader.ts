import { dataLoader } from './data-loader';
import { RawData, FilterSettings } from '../types';
import { progressiveDataAdapter } from './progressive-data-adapter';

export interface ChartDataRequest {
  categoryKey: string;
  columnNames: string[];
  filterSettings?: FilterSettings;
  groupBy?: string;
}

export interface ChartDataResponse {
  data: any;
  metadata: {
    loadTime: number;
    dataSize: number;
    cacheHit: boolean;
    source: 'progressive' | 'legacy' | 'cache';
  };
}

/**
 * Dynamic data loading service for charts
 * Loads only the specific data needed for each chart
 */
class DynamicDataLoader {
  private cache = new Map<string, { data: any; timestamp: number; size: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  private loadingPromises = new Map<string, Promise<any>>();
  
  /**
   * Load data specifically for a chart
   */
  async loadChartData(request: ChartDataRequest): Promise<ChartDataResponse> {
    const startTime = performance.now();
    const cacheKey = this.getCacheKey(request);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`💾 Cache hit for chart data: ${request.categoryKey}`);
      return {
        data: cached.data,
        metadata: {
          loadTime: performance.now() - startTime,
          dataSize: cached.size,
          cacheHit: true,
          source: 'cache'
        }
      };
    }
    
    // Check if already loading to prevent duplicate requests
    if (this.loadingPromises.has(cacheKey)) {
      console.log(`⏳ Waiting for existing load: ${request.categoryKey}`);
      const data = await this.loadingPromises.get(cacheKey)!;
      return {
        data,
        metadata: {
          loadTime: performance.now() - startTime,
          dataSize: this.estimateDataSize(data),
          cacheHit: false,
          source: 'progressive'
        }
      };
    }
    
    // Start new loading operation
    const loadPromise = this.doLoadChartData(request);
    this.loadingPromises.set(cacheKey, loadPromise);
    
    try {
      const data = await loadPromise;
      const dataSize = this.estimateDataSize(data);
      
      // Cache the result
      this.setCache(cacheKey, data, dataSize);
      
      console.log(`📊 Dynamic load completed: ${request.categoryKey} (${(dataSize / 1024).toFixed(1)} KB)`);
      
      return {
        data,
        metadata: {
          loadTime: performance.now() - startTime,
          dataSize,
          cacheHit: false,
          source: progressiveDataAdapter.hasProgressiveData() ? 'progressive' : 'legacy'
        }
      };
    } finally {
      this.loadingPromises.delete(cacheKey);
    }
  }
  
  /**
   * Preload data for multiple charts
   */
  async preloadChartData(requests: ChartDataRequest[]): Promise<void> {
    console.log(`🚀 Preloading ${requests.length} chart datasets...`);
    
    const preloadPromises = requests.map(request => 
      this.loadChartData(request).catch(error => {
        console.warn(`Failed to preload chart data for ${request.categoryKey}:`, error);
        return null;
      })
    );
    
    await Promise.allSettled(preloadPromises);
    console.log(`✅ Chart data preloading completed`);
  }
  
  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`🧹 Cleared ${cleared} expired cache entries`);
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    
    return {
      entryCount: this.cache.size,
      totalSize,
      averageSize: entries.length > 0 ? totalSize / entries.length : 0,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0
    };
  }
  
  private async doLoadChartData(request: ChartDataRequest): Promise<any> {
    if (progressiveDataAdapter.hasProgressiveData()) {
      return this.loadProgressiveChartData(request);
    } else {
      return this.loadLegacyChartData(request);
    }
  }
  
  private async loadProgressiveChartData(request: ChartDataRequest): Promise<any> {
    const { categoryKey, columnNames } = request;
    
    if (columnNames.length <= 3) {
      // For small requests, load individual columns
      const columnData: Record<string, any> = {};
      
      for (const columnName of columnNames) {
        try {
          columnData[columnName] = await progressiveDataAdapter.loadColumnData(categoryKey, columnName);
        } catch (error) {
          console.warn(`Failed to load column ${columnName} from ${categoryKey}:`, error);
          // Fall back to loading entire category
          return progressiveDataAdapter.loadCategoryData(categoryKey);
        }
      }
      
      return this.formatColumnData(columnData, request);
    } else {
      // For larger requests, load entire category
      return progressiveDataAdapter.loadCategoryData(categoryKey);
    }
  }
  
  private async loadLegacyChartData(request: ChartDataRequest): Promise<any> {
    // Access the existing data loading system
    const { getData } = await import('./get-data');
    
    try {
      // Get the full data for the category
      const fullData = await getData();
      const categoryData = fullData[request.categoryKey];
      
      if (!categoryData) {
        throw new Error(`Category ${request.categoryKey} not found in data`);
      }
      
      // If specific columns are requested, filter to only those columns
      if (request.columnNames && request.columnNames.length > 0) {
        const filteredColumns = categoryData.columns.filter(col => 
          request.columnNames.includes(col.name)
        );
        
        return {
          ...categoryData,
          columns: filteredColumns,
          num_cols: filteredColumns.length
        };
      }
      
      // Return the full category data
      return categoryData;
    } catch (error) {
      console.error(`Failed to load legacy data for ${request.categoryKey}:`, error);
      throw error;
    }
  }
  
  private formatColumnData(columnData: Record<string, any>, request: ChartDataRequest): any {
    // Transform individual column data into the expected format
    const columns = Object.entries(columnData).map(([name, data]) => ({
      name,
      data,
      dtype: this.inferDataType(data)
    }));
    
    return {
      columns,
      num_rows: columns[0]?.data?.length || 0
    };
  }
  
  private inferDataType(data: any[]): string {
    if (data.length === 0) return 'unknown';
    const sample = data[0];
    
    if (typeof sample === 'number') return 'numeric';
    if (typeof sample === 'string') return 'categorical';
    return 'unknown';
  }
  
  private getCacheKey(request: ChartDataRequest): string {
    const { categoryKey, columnNames, filterSettings, groupBy } = request;
    return JSON.stringify({
      categoryKey,
      columnNames: columnNames.sort(),
      filterSettings,
      groupBy
    });
  }
  
  private getFromCache(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }
  
  private setCache(key: string, data: any, size: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      size
    });
    
    // Cleanup expired entries periodically
    if (this.cache.size % 10 === 0) {
      this.clearExpiredCache();
    }
  }
  
  private estimateDataSize(data: any): number {
    // Rough estimation of data size in bytes
    return JSON.stringify(data).length * 2; // Approximate UTF-16 encoding
  }
}

// Export singleton instance
export const dynamicDataLoader = new DynamicDataLoader();
