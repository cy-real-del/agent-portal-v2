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
      
      // Анализируем структуру
      if (parsed.Export || parsed.export) {
        console.log('📋 Analyzing XML structure...');
        console.log('Found export element, keys:', Object.keys(parsed.Export || parsed.export));
        
        if (parsed.Export || parsed.Export.RealtyObject || parsed.Export.realtyobject || parsed.export?.realtyobject) {
          const objects = Array.isArray(parsed.Export || parsed.Export.RealtyObject || parsed.Export.realtyobject || parsed.export?.realtyobject) 
            ? parsed.Export || parsed.Export.RealtyObject || parsed.Export.realtyobject || parsed.export?.realtyobject 
            : [parsed.Export || parsed.Export.RealtyObject || parsed.Export.realtyobject || parsed.export?.realtyobject];
          
          console.log(`📊 Found ${objects.length} listings to process`);
          
          // Показываем примеры структуры
          for (let i = 0; i < Math.min(100, objects.length); i++) {
            console.log(`\n🏠 Sample listing ${i + 1} structure:`, Object.keys(objects[i]));
            if (i < 5) {
              console.log('Sample data:', {
                id: objects[i].id?.[0],
                active: objects[i].active?.[0],
                publishedat: objects[i].publishedat?.[0],
                objectid: objects[i].objectid?.[0],
                objectcode: objects[i].objectcode?.[0],
                isreserved: objects[i].isreserved?.[0],
                issold: objects[i].issold?.[0],
                ispartnerobject: objects[i].ispartnerobject?.[0],
                title: objects[i].title?.[0],
                alias: objects[i].alias?.[0],
                city: objects[i].city?.[0]?.id?.[0],
                '...': '...'
              });
            }
            console.log(`🔑 Sample listing keys:`, Object.keys(objects[i]));
          }
          
          return this.transformProperties(objects);
        }
      }
      
      console.log('⚠️ Unexpected XML structure');
      return [];
    } catch (error) {
      console.error('❌ Error fetching/parsing XML:', error);
      throw error;
    }
  }

  private parseXML(xml: string): Promise<any> {
    return new Promise((resolve, reject) => {
      parseString(xml, {
        explicitArray: true,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: true
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
        // Безопасное извлечение значений
        const safeGet = (obj: any, path: string, defaultValue: any = '') => {
          const keys = path.split('.');
          let result = obj;
          for (const key of keys) {
            result = result?.[key];
            if (result === undefined) return defaultValue;
          }
          return Array.isArray(result) ? result[0] : result;
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

        // Извлекаем названия
        const title = safeGet(prop, 'title.0.en.0') || 
                      safeGet(prop, 'title.0.ru.0') || 
                      safeGet(prop, 'title.0') || 
                      `Property ${safeGet(prop, 'objectid.0', index + 1)}`;

        // Координаты
        const coords = safeGet(prop, 'coords.0', '').split(',');
        const latitude = coords.length === 2 ? safeNumber(coords[0]) : undefined;
        const longitude = coords.length === 2 ? safeNumber(coords[1]) : undefined;

        // Изображения
        let images: string[] = [];
        const imageData = safeGet(prop, 'images.0');
        if (imageData) {
          if (typeof imageData === 'string') {
            images = [imageData];
          } else if (imageData.image) {
            images = Array.isArray(imageData.image) 
              ? imageData.image.map((img: any) => safeString(img))
              : [safeString(imageData.image)];
          }
        }

        // Особенности
        let features: string[] = [];
        const featureData = safeGet(prop, 'features.0');
        if (featureData) {
          if (Array.isArray(featureData.feature)) {
            features = featureData.feature.map((f: any) => 
              safeGet(f, 'en.0') || safeGet(f, 'ru.0') || safeString(f)
            );
          }
        }

        // Определяем тип недвижимости
        const objectType = safeGet(prop, 'objecttype.0');
        const categoryId = safeGet(prop, 'category.0.id.0');
        let propertyType = 'property';
        
        if (objectType) {
          const typeMap: { [key: string]: string } = {
            'апартаменты': 'apartment',
            'apartments': 'apartment',
            'вилла': 'villa',
            'villa': 'villa',
            'дом': 'house',
            'house': 'house',
            'таунхаус': 'townhouse',
            'townhouse': 'townhouse',
            'пентхаус': 'penthouse',
            'penthouse': 'penthouse',
            'земля': 'land',
            'land': 'land',
            'коммерческая': 'commercial',
            'commercial': 'commercial'
          };
          
          const typeLower = objectType.toLowerCase();
          for (const [key, value] of Object.entries(typeMap)) {
            if (typeLower.includes(key)) {
              propertyType = value;
              break;
            }
          }
        }

        // Статус
        const isReserved = safeBoolean(safeGet(prop, 'isreserved.0'));
        const isSold = safeBoolean(safeGet(prop, 'issold.0'));
        const isActive = safeBoolean(safeGet(prop, 'active.0'));
        
        let status = 'available';
        if (isSold) status = 'sold';
        else if (isReserved) status = 'reserved';
        else if (!isActive) status = 'off_market';

        const transformed = {
          id: safeString(safeGet(prop, 'id.0')),
          xml_id: safeString(safeGet(prop, 'objectid.0')),
          title: title,
          type: propertyType,
          status: status,
          price: safeNumber(safeGet(prop, 'price.0')),
          currency: 'EUR',
          area_total: safeNumber(safeGet(prop, 'area.0')),
          area: safeNumber(safeGet(prop, 'area.0')),
          rooms: safeNumber(safeGet(prop, 'numbedrooms.0')),
          bedrooms: safeNumber(safeGet(prop, 'numbedrooms.0')),
          bathrooms: safeNumber(safeGet(prop, 'numbathrooms.0')),
          region: safeString(safeGet(prop, 'area.0')),
          location: safeString(safeGet(prop, 'locations.0')),
          latitude: latitude,
          longitude: longitude,
          features: features,
          images: images.filter(img => img && img.length > 0),
          source: 'antaria_xml',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (index < 5) {
          console.log(`✅ Transformed property ${index + 1}:`, transformed);
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
