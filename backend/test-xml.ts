import axios from 'axios';
import { parseString } from 'xml2js';

async function testXML() {
  try {
    console.log('Fetching XML...');
    const response = await axios.get('https://antariahomes.com/export.xml', {
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024
    });
    
    console.log('XML size:', response.data.length, 'characters');
    console.log('First 500 chars:', response.data.substring(0, 500));
    
    parseString(response.data, {
      explicitArray: true,
      mergeAttrs: true,
      normalize: true,
      normalizeTags: true
    }, (err, result) => {
      if (err) {
        console.error('Parse error:', err);
        return;
      }
      
      console.log('\nParsed structure:');
      console.log('Root keys:', Object.keys(result));
      
      if (result.Export || result.export) {
        console.log('Export keys:', Object.keys(result.Export || result.export));
        console.log('Export date:', result.Export || result.export.date);
        
        if (result.Export || result.export.realtyobject) {
          const objects = Array.isArray(result.Export || result.export.realtyobject) 
            ? result.Export || result.export.realtyobject 
            : [result.Export || result.export.realtyobject];
          
          console.log('\nTotal objects:', objects.length);
          console.log('\nFirst object structure:');
          console.log(JSON.stringify(objects[0], null, 2).substring(0, 1000));
        }
      }
    });
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

testXML();
