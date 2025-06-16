// backend/test-xml-parser.ts
import { XMLParser } from './src/services/XMLParser';

async function testXMLParser() {
  console.log('🧪 Testing Enhanced Antaria XML Parser for complete data extraction...\n');
  
  try {
    const parser = new XMLParser();
    
    // Парсим XML
    const properties = await parser.fetchAndParseXML();
    
    if (properties.length === 0) {
      console.log('❌ No properties found');
      return;
    }
    
    console.log(`\n📊 PARSING RESULTS:`);
    console.log(`📝 Total properties: ${properties.length}`);
    
    // Анализируем изображения
    const propertiesWithImages = properties.filter(p => p.images && p.images.length > 0);
    const totalImages = properties.reduce((sum, p) => sum + (p.images?.length || 0), 0);
    
    console.log(`📸 Properties with images: ${propertiesWithImages.length}/${properties.length} (${Math.round(propertiesWithImages.length/properties.length*100)}%)`);
    console.log(`📸 Total images found: ${totalImages}`);
    console.log(`📸 Average images per property: ${(totalImages / properties.length).toFixed(1)}`);
    
    if (propertiesWithImages.length > 0) {
      console.log(`\n🖼️ IMAGE SAMPLES (first 3 properties):`);
      
      propertiesWithImages.slice(0, 3).forEach((property, index) => {
        console.log(`\n${index + 1}. ${property.title || 'Untitled'} (ID: ${property.xml_id || property.id})`);
        console.log(`   Type: ${property.type} | Status: ${property.status}`);
        console.log(`   Price: €${property.price?.toLocaleString()} | Area: ${property.area}m²`);
        console.log(`   Images (${property.images.length}):`);
        
        property.images.slice(0, 2).forEach((img, imgIndex) => {
          console.log(`     ${imgIndex + 1}. ${img}`);
        });
        
        if (property.images.length > 2) {
          console.log(`     ... and ${property.images.length - 2} more images`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Запускаем тест
testXMLParser().then(() => {
  console.log('\n✅ Test completed');
}).catch(error => {
  console.error('❌ Test error:', error);
});
