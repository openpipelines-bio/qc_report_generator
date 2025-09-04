import { DataHeader, WorkerMessage, WorkerResponse } from './data-types';

interface CachedData {
  header: DataHeader | null;
  buffer: ArrayBuffer | null;
  payload: string | null;
}

// Cache to avoid reloading the same data
const cache: CachedData = {
  header: null,
  buffer: null,
  payload: null
};

/**
 * Load and decompress the payload from base64 data
 */
async function loadPayload(base64Data: string): Promise<ArrayBuffer> {
  if (cache.buffer) {
    return cache.buffer;
  }

  try {
    if (!base64Data) {
      throw new Error('No payload data provided');
    }

    // Decode base64 to Uint8Array
    const binaryString = atob(base64Data);
    const compressedData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressedData[i] = binaryString.charCodeAt(i);
    }

    // Check if DecompressionStream is available (modern browsers)
    if (typeof DecompressionStream !== 'undefined') {
      // Use native DecompressionStream for better performance
      const decompressStream = new DecompressionStream('gzip');
      const reader = decompressStream.readable.getReader();
      const writer = decompressStream.writable.getWriter();
      
      writer.write(compressedData);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }
      
      // Combine chunks into single ArrayBuffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      cache.buffer = combined.buffer;
    } else {
      // Fallback to pako for older browsers
      const pako = await import('pako');
      const decompressed = pako.ungzip(compressedData);
      cache.buffer = decompressed.buffer;
    }
    
    return cache.buffer;
  } catch (error) {
    throw new Error(`Failed to load payload: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse the header from the decompressed data
 */
async function parseHeader(buffer: ArrayBuffer): Promise<DataHeader> {
  if (cache.header) {
    return cache.header;
  }

  try {
    const view = new DataView(buffer);
    const headerLength = view.getUint32(0, true); // little-endian
    const headerBytes = new Uint8Array(buffer, 4, headerLength);
    const headerJson = new TextDecoder().decode(headerBytes);
    
    cache.header = JSON.parse(headerJson);
    return cache.header;
  } catch (error) {
    throw new Error(`Failed to parse header: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract a specific column from the binary data
 */
async function extractColumn(
  buffer: ArrayBuffer, 
  header: DataHeader, 
  columnName: string, 
  categoryKey: string
): Promise<ArrayBuffer> {
  try {
    const column = header.columns.find(
      col => col.name === columnName && col.categoryKey === categoryKey
    );
    
    if (!column) {
      throw new Error(`Column ${columnName} not found in category ${categoryKey}`);
    }

    // Calculate aligned data start offset
    const headerLength = new DataView(buffer).getUint32(0, true);
    const dataStart = 4 + headerLength;
    const alignment = 4;
    const padding = (alignment - (dataStart % alignment)) % alignment;
    const alignedDataStart = dataStart + padding;
    
    // Column offset is relative to aligned data start
    const absoluteOffset = alignedDataStart + column.offset;
    
    let typedArray: ArrayBuffer;
    
    switch (column.dtype) {
      case 'int32':
      case 'categorical':
        // Create a copy of the data to transfer
        const int32Data = new Int32Array(buffer, absoluteOffset, column.length);
        typedArray = new Int32Array(int32Data).buffer;
        break;
      case 'float32':
        // Create a copy of the data to transfer
        const float32Data = new Float32Array(buffer, absoluteOffset, column.length);
        typedArray = new Float32Array(float32Data).buffer;
        break;
      default:
        throw new Error(`Unsupported column type: ${column.dtype}`);
    }
    
    return typedArray;
  } catch (error) {
    throw new Error(`Failed to extract column: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract all columns for a specific category
 */
async function extractCategory(
  buffer: ArrayBuffer,
  header: DataHeader,
  categoryKey: string
): Promise<{ [columnName: string]: ArrayBuffer }> {
  try {
    const categoryColumns = header.columns.filter(col => col.categoryKey === categoryKey);
    
    if (categoryColumns.length === 0) {
      throw new Error(`No columns found for category ${categoryKey}`);
    }

    const result: { [columnName: string]: ArrayBuffer } = {};
    
    for (const column of categoryColumns) {
      const columnData = await extractColumn(buffer, header, column.name, categoryKey);
      result[column.name] = columnData;
    }
    
    return result;
  } catch (error) {
    throw new Error(`Failed to extract category: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Main worker message handler
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  try {
    const { type, columnName, categoryKey, payload } = event.data;
    
    if (type === 'setPayload' && payload) {
      // Store the payload for future use
      cache.payload = payload;
      self.postMessage({
        type: 'header',
        header: undefined // Acknowledge payload received
      } as WorkerResponse);
      
    } else if (type === 'loadHeader') {
      // Load and parse header
      if (!cache.payload) {
        throw new Error('No payload set. Call setPayload first.');
      }
      const buffer = await loadPayload(cache.payload);
      const header = await parseHeader(buffer);
      
      self.postMessage({
        type: 'header',
        header
      } as WorkerResponse);
      
    } else if (type === 'loadColumn' && columnName && categoryKey) {
      // Load specific column
      if (!cache.payload) {
        throw new Error('No payload set. Call setPayload first.');
      }
      const buffer = await loadPayload(cache.payload);
      const header = await parseHeader(buffer);
      const columnData = await extractColumn(buffer, header, columnName, categoryKey);
      
      self.postMessage({
        type: 'columnData',
        columnName,
        categoryKey,
        data: columnData
      } as WorkerResponse, { transfer: [columnData] }); // Transfer ArrayBuffer
      
    } else if (type === 'loadCategory' && categoryKey) {
      // Load all columns for a category
      if (!cache.payload) {
        throw new Error('No payload set. Call setPayload first.');
      }
      const buffer = await loadPayload(cache.payload);
      const header = await parseHeader(buffer);
      const categoryData = await extractCategory(buffer, header, categoryKey);
      
      // Prepare transferable objects
      const transferable = Object.values(categoryData);
      
      self.postMessage({
        type: 'categoryData',
        categoryKey,
        data: categoryData
      } as WorkerResponse, { transfer: transferable });
      
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
    
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    } as WorkerResponse);
  }
};
