/**
 * Test script for the new Web Worker data loader
 */

import { dataLoader } from '../src/lib/data-loader.js';

async function testWorkerLoader() {
  console.log('🔄 Testing Web Worker Data Loader...\n');

  try {
    // Check if progressive data is available
    console.log('📦 Checking for progressive data payload...');
    const hasPayload = dataLoader.hasProgressiveData();
    console.log(`   Has payload: ${hasPayload}\n`);

    if (!hasPayload) {
      console.log('ℹ️  No binary payload found. This is expected when testing with legacy data.');
      console.log('   To test with binary data:');
      console.log('   1. Run: node scripts/compress_data.js resources_test/sc_dataset/ index.html');
      console.log('   2. Check that index.html contains a payload script tag');
      console.log('   3. Open the HTML file in a browser\n');
      return;
    }

    // Initialize the loader
    console.log('🚀 Initializing data loader...');
    await dataLoader.init();
    console.log('   ✅ Data loader initialized\n');

    // Get header information
    console.log('📋 Getting data header...');
    const header = dataLoader.getHeader();
    console.log(`   Rows: ${header.rowCount}`);
    console.log(`   Columns: ${header.columns.length}`);
    console.log(`   Format version: ${header.formatVersion}\n`);

    // Show available categories
    console.log('📂 Available categories:');
    const categories = dataLoader.getAvailableCategories();
    categories.forEach(category => {
      console.log(`   - ${category}`);
    });
    console.log('');

    // Show columns for each category
    for (const category of categories.slice(0, 2)) { // Limit to first 2 for testing
      console.log(`📊 Columns in category "${category}":`);
      const columns = dataLoader.getAvailableColumns(category);
      columns.forEach(column => {
        const columnInfo = header.columns.find(col => 
          col.name === column && col.categoryKey === category
        );
        console.log(`   - ${column} (${columnInfo?.dtype})`);
      });
      console.log('');

      // Load one column as a test
      if (columns.length > 0) {
        const testColumn = columns[0];
        console.log(`🔄 Loading column "${testColumn}" from category "${category}"...`);
        const start = performance.now();
        
        const columnData = await dataLoader.loadColumn(testColumn, category);
        
        const end = performance.now();
        console.log(`   ✅ Loaded in ${(end - start).toFixed(2)}ms`);
        console.log(`   Type: ${columnData.dtype}`);
        console.log(`   Length: ${columnData.data.length}`);
        
        if (columnData.data.length > 0) {
          const firstValues = Array.from(columnData.data.slice(0, 5));
          console.log(`   First values: [${firstValues.join(', ')}...]`);
        }
        
        if (columnData.categories) {
          console.log(`   Categories: [${columnData.categories.slice(0, 5).join(', ')}...]`);
        }
        console.log('');
      }

      // Test loading entire category
      console.log(`🔄 Loading entire category "${category}"...`);
      const categoryStart = performance.now();
      
      const categoryData = await dataLoader.loadCategory(category);
      
      const categoryEnd = performance.now();
      console.log(`   ✅ Loaded ${Object.keys(categoryData).length} columns in ${(categoryEnd - categoryStart).toFixed(2)}ms`);
      
      Object.entries(categoryData).slice(0, 3).forEach(([name, data]) => {
        console.log(`   - ${name}: ${data.data.length} ${data.dtype} values`);
      });
      console.log('');
    }

    console.log('🎉 Web Worker test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing Web Worker:', error);
    
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  } finally {
    // Clean up
    dataLoader.destroy();
  }
}

// Run the test
testWorkerLoader();
