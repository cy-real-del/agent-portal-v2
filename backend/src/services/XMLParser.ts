import axios from 'axios';
import { parseString } from 'xml2js';
import { Property } from '../models/PropertyJSON';

export class XMLParser {
  private xmlUrl: string;

  constructor(config: { xmlUrl: string }) {
    this.xmlUrl = config.xmlUrl;
  }

  async fetchAndParseXML(): Promise<Property[]> {
    try {
      console.log(`📥 Fetching XML from: ${this.xmlUrl}`);
      
      const response = await axios.get(this.xmlUrl, {
        timeout: 30000,
        headers: { 'User-Agent': 'Agent Portal XML Importer 1.0' }
      });

      console.log(`📊 XML fetched, size: ${response.data.length} characters`);

      const xmlData = await this.parseXMLString(response.data);
      console.log('🔍 XML structure analysis:');
      console.log('Root keys:', Object.keys(xmlData));
      
      const properties = this.convertToProperties(xmlData);
      
      console.log(`✅ Parsed ${properties.length} properties from XML`);
      return properties;

    } catch (error) {
      console.error('❌ Error fetching/parsing XML:', error);
      throw error;
    }
  }

  private parseXMLString(xmlString: string): Promise<any> {
    return new Promise((resolve, reject) => {
      parseString(xmlString, {
        explicitArray: false,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: true,
        trim: true
      }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  private convertToProperties(xmlData: any): Property[] {
    const properties: Property[] = [];

    try {
      const listings = this.extractListings(xmlData);
      console.log(`🔍 Found ${listings.length} listings to process`);
      
      for (let i = 0; i < Math.min(listings.length, 5); i++) {
        const listing = listings[i];
        console.log(`\n📝 Sample listing ${i + 1} structure:`, Object.keys(listing));
        console.log('Sample data:', JSON.stringify(listing, null, 2).substring(0, 500) + '...');
      }
      
      for (const listing of listings) {
        try {
          const property = this.convertListing(listing);
          if (property) properties.push(property);
        } catch (error) {
          console.warn('⚠️  Error converting listing:', error);
        }
      }

    } catch (error) {
      console.error('❌ Error processing XML data:', error);
      throw error;
    }

    return properties;
  }

  private extractListings(xmlData: any): any[] {
    console.log('🔍 Analyzing XML structure...');
    
    // Проверяем структуру export
    if (xmlData.export) {
      console.log('Found export element, keys:', Object.keys(xmlData.export));
      
      // Пробуем разные возможные пути в export
      const exportData = xmlData.export;
      
      if (exportData.properties) {
        console.log('Found properties in export');
        if (exportData.properties.property) {
          const props = Array.isArray(exportData.properties.property) ? 
            exportData.properties.property : [exportData.properties.property];
          console.log(`Found ${props.length} properties`);
          return props;
        }
      }
      
      if (exportData.listings) {
        console.log('Found listings in export');
        if (exportData.listings.listing) {
          const listings = Array.isArray(exportData.listings.listing) ? 
            exportData.listings.listing : [exportData.listings.listing];
          console.log(`Found ${listings.length} listings`);
          return listings;
        }
      }
      
      if (exportData.property) {
        console.log('Found direct property in export');
        const props = Array.isArray(exportData.property) ? 
          exportData.property : [exportData.property];
        console.log(`Found ${props.length} direct properties`);
        return props;
      }
      
      if (exportData.listing) {
        console.log('Found direct listing in export');
        const listings = Array.isArray(exportData.listing) ? 
          exportData.listing : [exportData.listing];
        console.log(`Found ${listings.length} direct listings`);
        return listings;
      }
      
      // Попробуем найти любые массивы в export
      const exportKeys = Object.keys(exportData);
      console.log('Export contains keys:', exportKeys);
      
      for (const key of exportKeys) {
        const value = exportData[key];
        if (Array.isArray(value) && value.length > 0) {
          console.log(`Found array in export.${key} with ${value.length} items`);
          return value;
        } else if (value && typeof value === 'object') {
          // Проверяем есть ли массивы внутри этого объекта
          const subKeys = Object.keys(value);
          console.log(`Checking sub-object ${key}, keys:`, subKeys);
          
          for (const subKey of subKeys) {
            const subValue = value[subKey];
            if (Array.isArray(subValue) && subValue.length > 0) {
              console.log(`Found array in export.${key}.${subKey} with ${subValue.length} items`);
              return subValue;
            }
          }
        }
      }
    }
    
    // Fallback: ищем в корне
    const rootKeys = Object.keys(xmlData);
    console.log('Root XML keys:', rootKeys);
    
    for (const key of rootKeys) {
      const value = xmlData[key];
      if (Array.isArray(value) && value.length > 0) {
        console.log(`Found array in root.${key} with ${value.length} items`);
        return value;
      }
    }

    console.warn('❓ No recognizable property listings found');
    return [];
  }

  private convertListing(listing: any): Property | null {
    try {
      // Выводим структуру первых нескольких объектов для отладки
      const sampleKeys = Object.keys(listing);
      if (Math.random() < 0.1) { // 10% вероятность вывода для отладки
        console.log('🔍 Sample listing keys:', sampleKeys);
      }
      
      const id = this.getValue(listing, [
        'id', 'property_id', 'listing_id', 'ref', 'reference', 'code'
      ]) || `xml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const title = this.getValue(listing, [
        'title', 'name', 'headline', 'description', 'desc'
      ]) || 'Untitled Property';
      
      const description = this.getValue(listing, [
        'description', 'details', 'summary', 'desc', 'long_description'
      ]);
      
      const rawType = this.getValue(listing, [
        'type', 'property_type', 'category', 'kind'
      ]);
      const type = this.normalizeType(rawType);
      
      const rawStatus = this.getValue(listing, [
        'status', 'availability', 'state', 'available'
      ]);
      const status = this.normalizeStatus(rawStatus);
      
      const price = this.getNumber(listing, [
        'price', 'cost', 'amount', 'value', 'sale_price', 'asking_price'
      ]) || 0;
      
      const area_total = this.getNumber(listing, [
        'area', 'size', 'total_area', 'living_area', 'floor_area', 'sqm'
      ]) || 0;
      
      const rooms = this.getNumber(listing, [
        'rooms', 'total_rooms', 'room_count', 'bedrooms'
      ]) || 1;
      
      const bedrooms = this.getNumber(listing, [
        'bedrooms', 'bed_rooms', 'bedroom_count'
      ]) || 0;
      
      const bathrooms = this.getNumber(listing, [
        'bathrooms', 'bath_rooms', 'bathroom_count'
      ]) || 1;

      const region = this.getValue(listing, [
        'region', 'state', 'city', 'location', 'area'
      ]) || 'Unknown';
      
      const area = this.getValue(listing, [
        'area', 'district', 'locality', 'neighborhood', 'suburb'
      ]) || 'Unknown';
      
      const latitude = this.getNumber(listing, [
        'latitude', 'lat', 'coord_lat', 'geo_lat'
      ]);
      
      const longitude = this.getNumber(listing, [
        'longitude', 'lng', 'lon', 'coord_lng', 'geo_lng'
      ]);
      
      const distance_to_sea = this.getNumber(listing, [
        'distance_to_sea', 'sea_distance', 'beach_distance', 'distance_beach'
      ]);

      const features = this.getArray(listing, [
        'features', 'amenities', 'characteristics', 'extras'
      ]);
      
      const images = this.getImages(listing);
      const developer = this.getValue(listing, [
        'developer', 'builder', 'constructor', 'agent'
      ]);
      
      const complex_name = this.getValue(listing, [
        'complex', 'project', 'development', 'building'
      ]);

      // Проверяем минимальные требования
      if (price <= 0 && area_total <= 0) {
        console.warn(`⚠️  Skipping property with no price or area: ${title}`);
        return null;
      }

      const property: Property = {
        id,
        title,
        description,
        type,
        status,
        price: price || 100000, // default price если не указана
        currency: 'EUR',
        area_total: area_total || 50, // default area если не указана
        rooms,
        bedrooms,
        bathrooms,
        region,
        area,
        latitude,
        longitude,
        distance_to_sea,
        features,
        images,
        main_image: images[0],
        developer,
        complex_name,
        source: 'xml',
        xml_id: id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return property;

    } catch (error) {
      console.error('❌ Error converting listing:', error);
      return null;
    }
  }

  private getValue(obj: any, paths: string[]): string | undefined {
    for (const path of paths) {
      const value = obj[path];
      if (value && typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      // Также проверяем числа как строки
      if (value && typeof value === 'number') {
        return String(value);
      }
    }
    return undefined;
  }

  private getNumber(obj: any, paths: string[]): number | undefined {
    for (const path of paths) {
      const value = obj[path];
      if (value !== null && value !== undefined) {
        const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return undefined;
  }

  private getArray(obj: any, paths: string[]): string[] {
    for (const path of paths) {
      const value = obj[path];
      if (Array.isArray(value)) {
        return value.map(v => String(v).trim()).filter(v => v);
      } else if (typeof value === 'string') {
        return value.split(/[,;|]/).map(v => v.trim()).filter(v => v);
      }
    }
    return [];
  }

  private getImages(listing: any): string[] {
    const images: string[] = [];
    const imagePaths = ['images', 'photos', 'image', 'photo', 'picture', 'media'];
    
    for (const path of imagePaths) {
      const value = listing[path];
      if (Array.isArray(value)) {
        value.forEach(img => {
          const url = typeof img === 'string' ? img : img?.url || img?.src || img?.href;
          if (url && url.startsWith('http')) images.push(url);
        });
      } else if (typeof value === 'string' && value.startsWith('http')) {
        images.push(value);
      } else if (value && typeof value === 'object') {
        const url = value.url || value.src || value.href;
        if (url && url.startsWith('http')) images.push(url);
      }
    }

    return images;
  }

  private normalizeType(type?: string): Property['type'] {
    if (!type) return 'apartment';
    const t = type.toLowerCase();
    if (t.includes('villa')) return 'villa';
    if (t.includes('house')) return 'house';
    if (t.includes('studio')) return 'studio';
    if (t.includes('penthouse')) return 'penthouse';
    if (t.includes('plot') || t.includes('land')) return 'plot';
    return 'apartment';
  }

  private normalizeStatus(status?: string): Property['status'] {
    if (!status) return 'available';
    const s = status.toLowerCase();
    if (s.includes('sold')) return 'sold';
    if (s.includes('reserved')) return 'reserved';
    if (s.includes('off') || s.includes('unavailable')) return 'off_market';
    return 'available';
  }
}
