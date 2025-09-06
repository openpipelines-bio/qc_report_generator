import fs from 'fs';
import pako from 'pako';

/**
 * Test the new columnar binary format
 */
export async function testBinaryFormat(payloadPath) {
  console.log('🔧 Testing Binary Format...');
  
  try {
    // Read the base64 payload
    const base64Data = fs.readFileSync(payloadPath, 'utf8');
    console.log(`✓ Payload size: ${base64Data.length} characters`);
    
    // Decode and decompress
    const compressed = Buffer.from(base64Data, 'base64');
    const decompressed = pako.ungzip(compressed);
    console.log(`✓ Decompressed size: ${decompressed.length} bytes`);
    
    // Parse header
    const headerLength = new DataView(decompressed.buffer).getUint32(0, true);
    const headerBytes = decompressed.slice(4, 4 + headerLength);
    const header = JSON.parse(new TextDecoder().decode(headerBytes));
    
    console.log(`✓ Header parsed: ${header.columns.length} columns, ${Object.keys(header.categories).length} categories`);
    
    // Test data access
    if (header.columns.length > 0) {
      const firstColumn = header.columns[0];
      const dataStart = 4 + headerLength;
      
      // Account for padding to 4-byte alignment
      const alignment = 4;
      const padding = (alignment - (dataStart % alignment)) % alignment;
      const alignedDataStart = dataStart + padding;
      
      const columnStart = alignedDataStart + firstColumn.offset;
      
      let sampleData;
      if (firstColumn.dtype === 'float32') {
        sampleData = new Float32Array(decompressed.buffer, columnStart, Math.min(5, firstColumn.length));
      } else {
        sampleData = new Int32Array(decompressed.buffer, columnStart, Math.min(5, firstColumn.length));
      }
      
      console.log(`✓ Sample data from ${firstColumn.name}: [${Array.from(sampleData).join(', ')}]`);
    }
    
    console.log('✅ Binary format test passed!\n');
    return true;
    
  } catch (error) {
    console.error('❌ Binary format test failed:', error.message);
    return false;
  }
}

/**
 * Compare old vs new format sizes
 */
export async function compareSizes(dataPath, structurePath, payloadPath) {
  console.log('📊 Size Comparison...');
  
  try {
    // Original JSON sizes
    const originalData = fs.readFileSync(dataPath, 'utf8');
    const originalStructure = fs.readFileSync(structurePath, 'utf8');
    const originalTotal = originalData.length + originalStructure.length;
    
    // New binary size
    const binaryPayload = fs.readFileSync(payloadPath, 'utf8');
    
    console.log(`📄 Original JSON total: ${originalTotal.toLocaleString()} characters`);
    console.log(`🗜️  New binary format: ${binaryPayload.length.toLocaleString()} characters`);
    console.log(`📉 Compression ratio: ${((binaryPayload.length / originalTotal) * 100).toFixed(1)}%`);
    console.log(`💾 Size reduction: ${((1 - binaryPayload.length / originalTotal) * 100).toFixed(1)}%`);
    
    return true;
  } catch (error) {
    console.error('❌ Size comparison failed:', error.message);
    return false;
  }
}

// CLI usage
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const payloadPath = process.argv[2] || 'dist/payload.txt';
  const dataPath = process.argv[3] || 'resources_test/sc_dataset/data.json';
  const structurePath = process.argv[4] || 'resources_test/sc_dataset/structure.json';
  
  console.log('🧪 Testing New Data Format\n');
  
  const binaryTest = await testBinaryFormat(payloadPath);
  const sizeTest = await compareSizes(dataPath, structurePath, payloadPath);
  
  if (binaryTest && sizeTest) {
    console.log('🎉 All tests passed! New data format is working correctly.');
  } else {
    console.log('💥 Some tests failed.');
    process.exit(1);
  }
}
