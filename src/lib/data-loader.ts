import { DataHeader, WorkerMessage, WorkerResponse, TypedColumnData } from './data-types';

/**
 * Progressive data loader that uses Web Workers for decompression
 * and provides a clean interface for components to request data
 */
export class DataLoader {
  private worker: Worker | null = null;
  private header: DataHeader | null = null;
  private columnCache = new Map<string, ArrayBuffer>();
  private categoryCache = new Map<string, { [columnName: string]: ArrayBuffer }>();
  private pendingRequests = new Map<string, Promise<any>>();

  /**
   * Initialize the worker and load the header
   */
  async init(): Promise<void> {
    if (this.header) {
      return; // Already initialized
    }

    // Create worker
    this.worker = new Worker('/src/lib/loader.worker.ts', { type: 'module' });
    
    // Send payload to worker
    const payloadElement = document.getElementById('payload');
    const base64Data = payloadElement?.textContent?.trim() || '';
    
    if (!base64Data) {
      throw new Error('No payload found in HTML');
    }

    // Send payload to worker
    const payloadPromise = new Promise<void>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'header') {
          this.worker!.removeEventListener('message', handleMessage);
          resolve();
        } else if (event.data.type === 'error') {
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({ type: 'setPayload', payload: base64Data } as WorkerMessage);
    });

    await payloadPromise;
    
    // Request header
    const headerPromise = new Promise<DataHeader>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'header' && event.data.header) {
          this.worker!.removeEventListener('message', handleMessage);
          resolve(event.data.header);
        } else if (event.data.type === 'error') {
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      this.worker.addEventListener('message', handleMessage);
      this.worker.postMessage({ type: 'loadHeader' } as WorkerMessage);
    });

    this.header = await headerPromise;
  }

  /**
   * Get the data header (must call init() first)
   */
  getHeader(): DataHeader {
    if (!this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }
    return this.header;
  }

  /**
   * Load a specific column of data
   */
  async loadColumn(columnName: string, categoryKey: string): Promise<TypedColumnData> {
    if (!this.worker || !this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }

    const cacheKey = `${categoryKey}:${columnName}`;
    
    // Check if already cached
    if (this.columnCache.has(cacheKey)) {
      const buffer = this.columnCache.get(cacheKey)!;
      return this.bufferToTypedColumn(buffer, columnName, categoryKey);
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      const buffer = await this.pendingRequests.get(cacheKey)!;
      return this.bufferToTypedColumn(buffer, columnName, categoryKey);
    }

    // Start new request
    const promise = new Promise<ArrayBuffer>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'columnData' && 
            event.data.columnName === columnName && 
            event.data.categoryKey === categoryKey &&
            event.data.data) {
          this.worker!.removeEventListener('message', handleMessage);
          resolve(event.data.data as ArrayBuffer);
        } else if (event.data.type === 'error') {
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({ 
        type: 'loadColumn', 
        columnName, 
        categoryKey 
      } as WorkerMessage);
    });

    this.pendingRequests.set(cacheKey, promise);

    try {
      const buffer = await promise;
      this.columnCache.set(cacheKey, buffer);
      this.pendingRequests.delete(cacheKey);
      return this.bufferToTypedColumn(buffer, columnName, categoryKey);
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Load all columns for a category
   */
  async loadCategory(categoryKey: string): Promise<{ [columnName: string]: TypedColumnData }> {
    if (!this.worker || !this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }

    // Check if already cached
    if (this.categoryCache.has(categoryKey)) {
      const buffers = this.categoryCache.get(categoryKey)!;
      const result: { [columnName: string]: TypedColumnData } = {};
      
      for (const [columnName, buffer] of Object.entries(buffers)) {
        result[columnName] = this.bufferToTypedColumn(buffer, columnName, categoryKey);
      }
      
      return result;
    }

    // Check if request is already pending
    if (this.pendingRequests.has(categoryKey)) {
      const buffers = await this.pendingRequests.get(categoryKey)!;
      return this.buffersToTypedCategory(buffers, categoryKey);
    }

    // Start new request
    const promise = new Promise<{ [columnName: string]: ArrayBuffer }>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === 'categoryData' && 
            event.data.categoryKey === categoryKey &&
            event.data.data) {
          this.worker!.removeEventListener('message', handleMessage);
          resolve(event.data.data as { [columnName: string]: ArrayBuffer });
        } else if (event.data.type === 'error') {
          this.worker!.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      this.worker!.addEventListener('message', handleMessage);
      this.worker!.postMessage({ 
        type: 'loadCategory', 
        categoryKey 
      } as WorkerMessage);
    });

    this.pendingRequests.set(categoryKey, promise);

    try {
      const buffers = await promise;
      this.categoryCache.set(categoryKey, buffers);
      this.pendingRequests.delete(categoryKey);
      return this.buffersToTypedCategory(buffers, categoryKey);
    } catch (error) {
      this.pendingRequests.delete(categoryKey);
      throw error;
    }
  }

  /**
   * Convert ArrayBuffer to TypedColumnData
   */
  private bufferToTypedColumn(buffer: ArrayBuffer, columnName: string, categoryKey: string): TypedColumnData {
    if (!this.header) {
      throw new Error('Header not loaded');
    }

    const column = this.header.columns.find(
      col => col.name === columnName && col.categoryKey === categoryKey
    );

    if (!column) {
      throw new Error(`Column ${columnName} not found in category ${categoryKey}`);
    }

    switch (column.dtype) {
      case 'int32':
      case 'categorical':
        return {
          name: columnName,
          dtype: column.dtype,
          data: new Int32Array(buffer),
          categories: column.categories
        };
      case 'float32':
        return {
          name: columnName,
          dtype: column.dtype,
          data: new Float32Array(buffer)
        };
      default:
        throw new Error(`Unsupported column type: ${column.dtype}`);
    }
  }

  /**
   * Convert multiple buffers to TypedColumnData objects
   */
  private buffersToTypedCategory(
    buffers: { [columnName: string]: ArrayBuffer }, 
    categoryKey: string
  ): { [columnName: string]: TypedColumnData } {
    const result: { [columnName: string]: TypedColumnData } = {};
    
    for (const [columnName, buffer] of Object.entries(buffers)) {
      result[columnName] = this.bufferToTypedColumn(buffer, columnName, categoryKey);
    }
    
    return result;
  }

  /**
   * Get available categories from header
   */
  getAvailableCategories(): string[] {
    if (!this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }

    return Array.from(new Set(this.header.columns.map(col => col.categoryKey)));
  }

  /**
   * Get available columns for a category
   */
  getAvailableColumns(categoryKey: string): string[] {
    if (!this.header) {
      throw new Error('DataLoader not initialized. Call init() first.');
    }

    return this.header.columns
      .filter(col => col.categoryKey === categoryKey)
      .map(col => col.name);
  }

  /**
   * Check if data is in new binary format
   */
  hasProgressiveData(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    
    const payloadElement = document.getElementById('payload');
    return !!(payloadElement?.textContent?.trim());
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.header = null;
    this.columnCache.clear();
    this.categoryCache.clear();
    this.pendingRequests.clear();
  }
}

// Singleton instance for the app
export const dataLoader = new DataLoader();
