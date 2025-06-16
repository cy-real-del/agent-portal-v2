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
    
    // Анализируем типы недвижимости
    const typeStats = properties.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\n🏠 PROPERTY TYPES:`);
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    // Анализируем статусы
    const statusStats = properties.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\n📊 STATUS DISTRIBUTION:`);
    Object.entries(statusStats).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
    // Анализируем регионы
    const regionStats = properties.reduce((acc, p) => {
      const region = p.city || p.district || p.region || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\n🗺️ REGIONS:`);
    Object.entries(regionStats).slice(0, 10).forEach(([region, count]) => {
      console.log(`   ${region}: ${count}`);
    });
    
    if (propertiesWithImages.length > 0) {
      console.log(`\n🖼️ IMAGE SAMPLES (first 5 properties):`);
      
      propertiesWithImages.slice(0, 5).forEach((property, index) => {
        console.log(`\n${index + 1}. ${property.title || 'Untitled'} (ID: ${property.xml_id || property.id})`);
        console.log(`   Type: ${property.type} | Status: ${property.status}`);
        console.log(`   Price: €${property.price?.toLocaleString()} | Area: ${property.area}m²`);
        console.log(`   Location: ${property.city || property.district || property.region || 'Unknown'}`);
        console.log(`   Images (${property.images.length}):`);
        
        property.images.slice(0, 3).forEach((img, imgIndex) => {
          console.log(`     ${imgIndex + 1}. ${img}`);
        });
        
        if (property.images.length > 3) {
          console.log(`     ... and ${property.images.length - 3} more images`);
        }
        
        if (property.features && property.features.length > 0) {
          console.log(`   Features: ${property.features.slice(0, 3).join(', ')}${property.features.length > 3 ? ' ...' : ''}`);
        }
      });
    }
    
    // Проверяем качество URL
    console.log(`\n🔍 IMAGE URL QUALITY CHECK:`);
    const validUrls = [];
    const invalidUrls = [];
    
    properties.forEach(prop => {
      prop.images?.forEach(url => {
        if (url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
          validUrls.push(url);
        } else if (url.includes('/upload/') || url.includes('/images/')) {
          validUrls.push(url); // Antaria URLs are valid even without extension
        } else {
          invalidUrls.push(url);
        }
      });
    });
    
    console.log(`✅ Valid image URLs: ${validUrls.length}`);
    console.log(`❌ Invalid image URLs: ${invalidUrls.length}`);
    
    if (invalidUrls.length > 0) {
      console.log(`\n❌ INVALID URLs (first 3):`);
      invalidUrls.slice(0, 3).forEach((url, index) => {
        console.log(`${index + 1}. ${url}`);
      });
    }
    
    // Тест загрузки первого изображения
    if (validUrls.length > 0) {
      console.log(`\n🌐 Testing first image accessibility...`);
      try {
        const testUrl = validUrls[0];
        console.log(`Testing: ${testUrl}`);
        
        const response = await fetch(testUrl);
        console.log(`✅ Image accessible: ${response.status} ${response.statusText}`);
        console.log(`📏 Content-Type: ${response.headers.get('content-type')}`);
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          console.log(`📏 Content-Length: ${Math.round(parseInt(contentLength) / 1024)}KB`);
        }
      } catch (error) {
        console.log(`❌ Image not accessible: ${error.message}`);
      }
    }
    
    // Общая статистика данных
    console.log(`\n📋 DATA COMPLETENESS:`);
    const withTitle = properties.filter(p => p.title && p.title.length > 0).length;
    const withDescription = properties.filter(p => p.description && p.description.length > 0).length;
    const withFeatures = properties.filter(p => p.features && p.features.length > 0).length;
    const withCoords = properties.filter(p => p.latitude && p.longitude).length;
    
    console.log(`📝 With title: ${withTitle}/${properties.length} (${Math.round(withTitle/properties.length*100)}%)`);
    console.log(`📝 With description: ${withDescription}/${properties.length} (${Math.round(withDescription/properties.length*100)}%)`);
    console.log(`📝 With features: ${withFeatures}/${properties.length} (${Math.round(withFeatures/properties.length*100)}%)`);
    console.log(`🗺️ With coordinates: ${withCoords}/${properties.length} (${Math.round(withCoords/properties.length*100)}%)`);
    
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