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
          
          // Показываем примеры структуры первых 3 объектов
          for (let i = 0; i < Math.min(3, objects.length); i++) {
            console.log(`\n🏠 Sample listing ${i + 1} structure:`, Object.keys(objects[i]));
            // Показываем структуру фотографий
            const photos = this.extractImages(objects[i]);
            console.log(`📸 Found ${photos.length} images:`, photos.slice(0, 2));
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

  /**
   * Извлекает изображения из XML объекта Antaria XML format
   */
  private extractImages(prop: any): string[] {
    const images: string[] = [];
    
    try {
      // В Antaria XML Images это массив с одним объектом
      const imagesArray = prop.Images;
      if (imagesArray && Array.isArray(imagesArray) && imagesArray.length > 0) {
        const imagesObj = imagesArray[0]; // Берем первый (и единственный) элемент массива
        
        // 1. Главное изображение
        if (imagesObj.MainImage && Array.isArray(imagesObj.MainImage)) {
          const mainUrl = imagesObj.MainImage[0];
          if (mainUrl && typeof mainUrl === 'string' && mainUrl.trim().length > 0) {
            images.push(mainUrl.trim());
          }
        }
        
        // 2. Дополнительные изображения
        if (imagesObj.AdditionalImages && Array.isArray(imagesObj.AdditionalImages)) {
          const additionalImagesObj = imagesObj.AdditionalImages[0];
          if (additionalImagesObj && additionalImagesObj.AdditionalImage) {
            const additionalImages = additionalImagesObj.AdditionalImage;
            
            if (Array.isArray(additionalImages)) {
              for (const imageUrl of additionalImages) {
                if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
                  images.push(imageUrl.trim());
                }
              }
            }
          }
        }
      }

      // Убираем дубликаты и возвращаем
      return [...new Set(images)];

    } catch (error) {
      console.error('Error extracting images:', error);
      return [];
    }
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

        const safeGetText = (obj: any, lang: string = 'Ru'): string => {
          if (!obj) return '';
          if (typeof obj === 'string') return obj;
          
          // Попробуем получить текст на нужном языке
          const langText = obj[lang] || obj[lang.toLowerCase()] || obj[lang.toUpperCase()];
          if (langText) {
            return Array.isArray(langText) ? langText[0] : String(langText);
          }
          
          // Если не нашли - берем первое доступное значение
          const values = Object.values(obj);
          if (values.length > 0) {
            const firstValue = values[0];
            return Array.isArray(firstValue) ? String(firstValue[0]) : String(firstValue);
          }
          
          return '';
        };

        const safeNumber = (value: any): number => {
          if (!value) return 0;
          const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
          return isNaN(num) ? 0 : num;
        };

        const safeBoolean = (value: any): boolean => {
          const str = String(value).toLowerCase();
          return str === 'true' || str === '1' || str === 'yes';
        };

        // Извлекаем основные данные из Antaria XML структуры
        const id = safeGet(prop, 'Id');
        const objectId = safeGet(prop, 'ObjectId');
        const objectCode = safeGet(prop, 'ObjectCode');
        
        // Заголовок из многоязычной структуры
        const titleObj = safeGet(prop, 'Title');
        const title = safeGetText(titleObj) || objectCode || `Property ${objectId || id}`;
        
        // Ценовые данные
        const price = safeNumber(safeGet(prop, 'Price'));
        
        // Характеристики недвижимости
        const area = safeNumber(safeGet(prop, 'Area'));
        const bedrooms = safeNumber(safeGet(prop, 'NumBedrooms'));
        const bathrooms = safeNumber(safeGet(prop, 'NumBathrooms'));
        
        // Статус объекта
        const isActive = safeBoolean(safeGet(prop, 'Active'));
        const isReserved = safeBoolean(safeGet(prop, 'IsReserved'));
        const isSold = safeBoolean(safeGet(prop, 'IsSold'));
        
        let status = 'available';
        if (isSold) status = 'sold';
        else if (isReserved) status = 'reserved';
        else if (!isActive) status = 'off_market';
        
        // Местоположение
        const cityObj = safeGet(prop, 'City');
        const city = safeGetText(cityObj);
        const districtObj = safeGet(prop, 'District');
        const district = safeGetText(districtObj);
        const region = district || city || 'Cyprus';
        
        // Извлекаем изображения
        const images = this.extractImages(prop);

        const transformed = {
          id: String(id || objectId || index + 1),
          xml_id: String(objectId),
          object_code: objectCode || '',
          title: title,
          type: 'apartment',
          status: status,
          price: price,
          currency: 'EUR',
          area_total: area,
          area: area,
          rooms: bedrooms,
          bedrooms: bedrooms,
          bathrooms: bathrooms,
          city: city || '',
          district: district || '',
          region: region,
          source: 'antaria_xml',
          features: [],
          images: images,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (index < 3) {
          console.log(`✅ Transformed property ${index + 1}:`, {
            id: transformed.id,
            xml_id: transformed.xml_id,
            title: transformed.title,
            type: transformed.type,
            price: transformed.price,
            area: transformed.area,
            status: transformed.status,
            city: transformed.city,
            images_count: transformed.images.length,
            first_image: transformed.images[0] || 'none'
          });
        }

        return transformed;
      } catch (error) {
        console.error(`❌ Error transforming property ${index}:`, error);
        return null;
      }
    }).filter(prop => prop !== null);

    console.log(`✅ Successfully transformed ${transformed.length} properties`);
    console.log(`📸 Total images found: ${transformed.reduce((sum, prop) => sum + prop.images.length, 0)}`);
    
    return transformed;
  }
}
