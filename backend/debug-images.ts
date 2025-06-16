import axios from 'axios';
import { parseString } from 'xml2js';

async function debugImages() {
  console.log('🔍 Debugging image extraction...\n');
  
  try {
    const response = await axios.get('https://antariahomes.com/export.xml');
    
    const parsed = await new Promise((resolve, reject) => {
      parseString(response.data, {
        explicitArray: true,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: false
      }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    const exportData = (parsed as any).Export;
    const realtyObjects = exportData.RealtyObject;
    
    // Ищем объекты с изображениями
    for (let i = 0; i < Math.min(10, realtyObjects.length); i++) {
      const prop = realtyObjects[i];
      console.log(`\n📋 Property ${i + 1} (ID: ${prop.ObjectId?.[0] || prop.Id?.[0]}):`);
      
      // Проверяем Images структуру
      if (prop.Images) {
        console.log('   Images structure:', Object.keys(prop.Images[0] || prop.Images));
        
        // MainImage
        if (prop.Images[0]?.MainImage) {
          console.log('   MainImage:', prop.Images[0].MainImage[0]);
        }
        
        // AdditionalImages
        if (prop.Images[0]?.AdditionalImages) {
          console.log('   AdditionalImages keys:', Object.keys(prop.Images[0].AdditionalImages[0]));
          if (prop.Images[0].AdditionalImages[0]?.AdditionalImage) {
            console.log('   First Additional:', prop.Images[0].AdditionalImages[0].AdditionalImage[0]);
            console.log('   Total Additional:', prop.Images[0].AdditionalImages[0].AdditionalImage.length);
          }
        }
        
        // Проверяем, есть ли изображения вообще
        const imageStr = JSON.stringify(prop.Images, null, 2);
        if (imageStr.length > 50) {
          console.log('   Images content preview:', imageStr.substring(0, 200) + '...');
        } else {
          console.log('   Images content:', imageStr);
        }
      } else {
        console.log('   ❌ No Images field found');
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugImages();
