import fs from "fs";
import pako from "pako";

/**
 * New columnar binary format data compression
 * Replaces the old msgpack approach with typed binary arrays
 */

// Get input and output file paths from command line arguments
const inputFilePath = process.argv[2];
const outputFilePath = process.argv[3];
const structureFilePath = process.argv[4]; // Optional structure file

if (!inputFilePath || !outputFilePath) {
  console.error("Usage: node compress_data.js <data.json> <output.ts> [structure.json]");
  console.error("For TypeScript output: node compress_data.js data.json src/data/dataset.ts");
  console.error("For binary payload: node compress_data.js data.json payload.txt structure.json");
  process.exit(1);
}

// Determine output format based on file extension
const isTypeScriptOutput = outputFilePath.endsWith('.ts');
const isBinaryOutput = !isTypeScriptOutput && structureFilePath;

if (isBinaryOutput && !structureFilePath) {
  console.error("Structure file required for binary output format");
  process.exit(1);
}

// Create output directory if it doesn't exist
const outputDir = outputFilePath.substring(0, outputFilePath.lastIndexOf("/"));
if (outputDir && !fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Compressing ${inputFilePath}...`);
const data = JSON.parse(fs.readFileSync(inputFilePath, "utf8"));

if (isTypeScriptOutput) {
  // Legacy TypeScript module output (backward compatibility)
  const { encode } = await import("@msgpack/msgpack");
  const compressed = pako.gzip(encode(data));
  const encoded = Buffer.from(compressed).toString("base64");
  fs.writeFileSync(outputFilePath, `export const compressed_data = "${encoded}";`);
  console.log(`Legacy TypeScript module written to ${outputFilePath}`);
  
} else if (isBinaryOutput) {
  // New columnar binary format
  const structure = JSON.parse(fs.readFileSync(structureFilePath, "utf8"));
  const binaryPayload = packColumnaryBinary(data, structure);
  fs.writeFileSync(outputFilePath, binaryPayload);
  console.log(`Binary payload written to ${outputFilePath}`);
  
} else {
  // Default: assume base64 text output
  const compressed = pako.gzip(JSON.stringify(data));
  const encoded = Buffer.from(compressed).toString("base64");
  fs.writeFileSync(outputFilePath, encoded);
  console.log(`Base64 data written to ${outputFilePath}`);
}

/**
 * Pack data into columnar binary format with gzip compression
 */
function packColumnaryBinary(data, structure) {
  console.log('Using new columnar binary format...');
  
  // Create header with metadata
  const header = {
    version: 1,
    categories: structure.categories.reduce((acc, cat) => {
      acc[cat.key] = {
        name: cat.name,
        key: cat.key,
        additionalAxes: cat.additionalAxes || false,
        defaultFilters: cat.defaultFilters || []
      };
      return acc;
    }, {}),
    columns: [],
    totalSize: 0
  };
  
  const dataBuffers = [];
  let currentDataOffset = 0;
  
  // Process each category and convert to typed arrays
  for (const [categoryKey, categoryData] of Object.entries(data)) {
    if (!categoryData?.columns) {
      console.warn(`Skipping category ${categoryKey}: no columns found`);
      continue;
    }
    
    console.log(`Processing category: ${categoryKey}`);
    
    for (const column of categoryData.columns) {
      if (!Array.isArray(column.data)) {
        console.warn(`Skipping column ${column.name}: data is not an array`);
        continue;
      }
      
      let typedArray;
      let dtype;
      
      // Determine the appropriate typed array based on data
      if (column.dtype === 'categorical') {
        // Store categorical data as indices
        typedArray = new Int32Array(column.data);
        dtype = 'categorical';
      } else if (column.data.every(v => Number.isInteger(v) && v >= -2147483648 && v <= 2147483647)) {
        typedArray = new Int32Array(column.data);
        dtype = 'int32';
      } else {
        // Convert to numbers and use Float32Array
        const numericData = column.data.map(v => parseFloat(v) || 0);
        typedArray = new Float32Array(numericData);
        dtype = 'float32';
      }
      
      // Add column metadata to header (offset will be adjusted later)
      header.columns.push({
        name: column.name,
        categoryKey: categoryKey,
        dtype: dtype,
        offset: currentDataOffset, // Relative to data section for now
        length: typedArray.length,
        categories: column.categories || undefined
      });
      
      // Store the binary data
      dataBuffers.push(typedArray.buffer);
      currentDataOffset += typedArray.byteLength;
      
      console.log(`  Column ${column.name}: ${dtype}, ${typedArray.length} elements, ${typedArray.byteLength} bytes`);
    }
  }
  
  // Serialize header to JSON bytes (with relative offsets)
  const headerJson = JSON.stringify(header);
  const headerBytes = new TextEncoder().encode(headerJson);
  
  // Create the final binary layout: [header_length:4][header:N][padding][data:M]
  // Calculate padding needed for 4-byte alignment of data section
  const dataStartOffset = 4 + headerBytes.length;
  const alignment = 4;
  const padding = (alignment - (dataStartOffset % alignment)) % alignment;
  const alignedDataStart = dataStartOffset + padding;
  
  const totalLength = alignedDataStart + currentDataOffset;
  const combinedBuffer = new ArrayBuffer(totalLength);
  const combinedView = new Uint8Array(combinedBuffer);
  
  // Write header length (little-endian uint32)
  const headerLengthView = new DataView(combinedBuffer, 0, 4);
  headerLengthView.setUint32(0, headerBytes.length, true);
  
  // Write header
  combinedView.set(headerBytes, 4);
  
  // Padding bytes are automatically zero in new ArrayBuffer
  
  // Write all data buffers at aligned offset
  let dataOffset = alignedDataStart;
  for (const buffer of dataBuffers) {
    combinedView.set(new Uint8Array(buffer), dataOffset);
    dataOffset += buffer.byteLength;
  }
  
  console.log(`Total uncompressed size: ${totalLength} bytes`);
  console.log(`Header size: ${headerBytes.length} bytes`);
  console.log(`Data size: ${currentDataOffset} bytes`);
  
  // Compress with gzip
  const compressed = pako.gzip(combinedView);
  console.log(`Compressed size: ${compressed.length} bytes (${(compressed.length / totalLength * 100).toFixed(1)}% of original)`);
  
  // Encode as base64
  const base64 = Buffer.from(compressed).toString("base64");
  console.log(`Base64 size: ${base64.length} characters`);
  
  return base64;
}
