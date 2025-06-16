import axios from 'axios';
import { parseString } from 'xml2js';

export interface XMLParserConfig {
  xmlUrl?: string;
}

export class XMLParser {
  private xmlUrl: string;

  constructor(config: XMLParserConfig = {}) {
    this.xmlUrl = config.xmlUrl || 'https://antariahomes.com/export.xml';
  }

  async fetchAndParseXML(): Promise<any[]> {
    try {
      console.log('🔄 Fetching XML from:', this.xmlUrl);
      
      const response = await axios.get(this.xmlUrl, {
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024 // 50MB
      });

      console.log('✅ XML fetched, size:', response.data.length, 'characters');
      
      const parsed = await this.parseXML(response.data);
      console.log('✅ XML parsed successfully');
      console.log('🔍 XML structure analysis:');
      console.log('Root keys:', Object.keys(parsed));
      
      // Проверяем оба варианта - с заглавными и строчными буквами
      const exportData = parsed.Export || parsed.export;
      
      if (exportData) {
        console.log('📋 Found Export element, keys:', Object.keys(exportData));
        
        // Проверяем оба варианта написания
        const realtyObjects = exportData.RealtyObject || 
                             exportData.realtyobject || 
                             exportData.realtyObject ||
                             exportData.Realtyobject;
        
        if (realtyObjects) {
          const objects = Array.isArray(realtyObjects) ? realtyObjects : [realtyObjects];
          
          console.log(`📊 Found ${objects.length} listings to process`);
          
          // Показываем примеры структуры первых 5 объектов
          for (let i = 0; i < Math.min(5, objects.length); i++) {
            console.log(`\n🏠 Sample listing ${i + 1} structure:`, Object.keys(objects[i]));
          }
          
          return this.transformProperties(objects);
        } else {
          console.log('⚠️ No RealtyObject found in Export. Available keys:', Object.keys(exportData));
        }
      } else {
        console.log('⚠️ No Export element found. Root keys:', Object.keys(parsed));
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error fetching/parsing XML:', error);
      throw error;
    }
  }

  private parseXML(xml: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // Не нормализуем теги, чтобы сохранить оригинальный регистр
      parseString(xml, {
        explicitArray: true,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: false  // Важно! Сохраняем регистр тегов
      }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  private transformProperties(xmlProperties: any[]): any[] {
    console.log(`🔄 Transforming ${xmlProperties.length} properties...`);
    
    const transformed = xmlProperties.map((prop, index) => {
      try {
        // Безопасное извлечение значений с учетом разного регистра
        const safeGet = (obj: any, ...paths: string[]): any => {
          for (const path of paths) {
            const keys = path.split('.');
            let result = obj;
            for (const key of keys) {
              if (!result) break;
              // Проверяем разные варианты регистра
              result = result[key] || 
                      result[key.toLowerCase()] || 
                      result[key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()];
            }
            if (result !== undefined && result !== null) {
              return Array.isArray(result) ? result[0] : result;
            }
          }
          return '';
        };

        const safeNumber = (value: any): number => {
          const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
          return isNaN(num) ? 0 : num;
        };

        const safeString = (value: any): string => {
          if (!value) return '';
          return Array.isArray(value) ? value[0] : String(value);
        };

        const safeBoolean = (value: any): boolean => {
          const str = safeString(value).toLowerCase();
          return str === 'true' || str === '1' || str === 'yes';
        };

        // Извлекаем данные с учетом разного регистра тегов
        const id = safeGet(prop, 'Id', 'id');
        const objectId = safeGet(prop, 'ObjectId', 'objectid', 'objectId');
        const title = safeGet(prop, 'Title.0.En', 'Title.0.en', 'title.0.en', 'title.0.En') || 
                     safeGet(prop, 'Title.0.Ru', 'Title.0.ru', 'title.0.ru', 'title.0.Ru') || 
                     `Property ${objectId || id || index + 1}`;
        
        const price = safeNumber(safeGet(prop, 'Price', 'price'));
        const area = safeNumber(safeGet(prop, 'Area', 'area'));
        const bedrooms = safeNumber(safeGet(prop, 'NumBedrooms', 'numbedrooms', 'numBedrooms'));
        const bathrooms = safeNumber(safeGet(prop, 'NumBathrooms', 'numbathrooms', 'numBathrooms'));
        
        const isReserved = safeBoolean(safeGet(prop, 'IsReserved', 'isreserved', 'isReserved'));
        const isSold = safeBoolean(safeGet(prop, 'IsSold', 'issold', 'isSold'));
        const isActive = safeBoolean(safeGet(prop, 'Active', 'active'));
        
        let status = 'available';
        if (isSold) status = 'sold';
        else if (isReserved) status = 'reserved';
        else if (!isActive) status = 'off_market';

        const transformed = {
          id: safeString(id),
          xml_id: safeString(objectId),
          title: title,
          type: 'apartment', // По умолчанию
          status: status,
          price: price,
          currency: 'EUR',
          area_total: area,
          area: area,
          rooms: bedrooms,
          bedrooms: bedrooms,
          bathrooms: bathrooms,
          region: safeString(area), // Временно используем area как region
          source: 'antaria_xml',
          features: [],
          images: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (index < 5) {
          console.log(`✅ Transformed property ${index + 1}:`, {
            id: transformed.id,
            title: transformed.title,
            price: transformed.price,
            area: transformed.area,
            status: transformed.status
          });
        }

        return transformed;
      } catch (error) {
        console.error(`❌ Error transforming property ${index}:`, error);
        return null;
      }
    }).filter(prop => prop !== null);

    console.log(`✅ Successfully transformed ${transformed.length} properties`);
    return transformed;
  }
}
