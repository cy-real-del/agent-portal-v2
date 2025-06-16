import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

// Property schema
const PropertySchema = z.object({
  id: z.string(),
  xml_id: z.string().optional(),
  object_code: z.string().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  status: z.string().default('available'),
  price: z.number().default(0),
  currency: z.string().default('EUR'),
  area_total: z.number().optional(),
  area: z.number().optional(),
  rooms: z.number().optional(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  region: z.string().optional(),
  features: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  source: z.string().default('xml'),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export type Property = z.infer<typeof PropertySchema>;

export class PropertyModel {
  private static inMemoryData: Property[] = [];
  private static useMemory = process.env.NODE_ENV === 'production';
  
  private dataDir: string;
  private dataFile: string;
  private properties: Property[] = [];

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.dataFile = path.join(this.dataDir, 'properties.json');
    this.loadData();
  }

  private loadData(): void {
    try {
      if (PropertyModel.useMemory) {
        this.properties = PropertyModel.inMemoryData;
        console.log(`📊 Loaded ${this.properties.length} properties from memory`);
        return;
      }

      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        console.log(`📁 Created data directory: ${this.dataDir}`);
      }

      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf-8');
        const parsed = JSON.parse(data);
        this.properties = parsed.properties || [];
        console.log(`📊 Loaded ${this.properties.length} properties from JSON`);
        
        // Логируем статистику изображений
        const withImages = this.properties.filter(p => p.images && p.images.length > 0);
        console.log(`📸 Properties with images: ${withImages.length}/${this.properties.length}`);
      } else {
        this.properties = [];
        this.saveData();
        console.log(`📁 Created new empty properties file`);
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
      this.properties = [];
    }
  }

  private saveData(): void {
    try {
      if (PropertyModel.useMemory) {
        PropertyModel.inMemoryData = [...this.properties];
        console.log(`💾 Saved ${this.properties.length} properties to memory`);
        return;
      }

      const data = {
        properties: this.properties,
        updated_at: new Date().toISOString(),
        total_count: this.properties.length,
        metadata: {
          images_count: this.properties.reduce((sum, p) => sum + (p.images?.length || 0), 0),
          with_images: this.properties.filter(p => p.images && p.images.length > 0).length
        }
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.properties.length} properties to JSON`);
    } catch (error) {
      console.error('❌ Error saving data:', error);
    }
  }

  getAll(filters: any = {}): { data: Property[], total: number } {
    let filtered = [...this.properties];

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter(p => p.type === filters.type);
    }
    if (filters.status) {
      filtered = filtered.filter(p => p.status === filters.status);
    }
    if (filters.min_price) {
      filtered = filtered.filter(p => p.price >= Number(filters.min_price));
    }
    if (filters.max_price) {
      filtered = filtered.filter(p => p.price <= Number(filters.max_price));
    }
    if (filters.region) {
      filtered = filtered.filter(p => p.region?.toLowerCase().includes(filters.region.toLowerCase()));
    }

    // Sort
    if (filters.sort) {
      const [field, order] = filters.sort.split('_');
      filtered.sort((a: any, b: any) => {
        const aVal = a[field] || 0;
        const bVal = b[field] || 0;
        if (order === 'asc') return aVal - bVal;
        return bVal - aVal;
      });
    }

    // Pagination
    const limit = Number(filters.limit) || 100;
    const offset = Number(filters.offset) || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      data: paginated,
      total: filtered.length
    };
  }

  getById(id: string): Property | null {
    return this.properties.find(p => p.id === id || p.xml_id === id) || null;
  }

  getStats() {
    const total = this.properties.length;
    
    const by_status = Object.entries(
      this.properties.reduce((acc: any, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {})
    ).map(([status, count]) => ({ status, count }));

    const by_region = Object.entries(
      this.properties.reduce((acc: any, p) => {
        const region = p.region || p.city || 'Unknown';
        if (!acc[region]) acc[region] = { count: 0, total_price: 0 };
        acc[region].count++;
        acc[region].total_price += p.price;
        return acc;
      }, {})
    ).map(([region, data]: [string, any]) => ({
      region,
      count: data.count,
      total_price: data.total_price,
      avg_price: Math.round(data.total_price / data.count)
    }));

    const prices = this.properties.map(p => p.price).filter(p => p > 0);
    const price = {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
      avg: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
    };

    // Статистика изображений
    const with_images = this.properties.filter(p => p.images && p.images.length > 0).length;
    const total_images = this.properties.reduce((sum, p) => sum + (p.images?.length || 0), 0);
    
    const images_stats = {
      with_images,
      without_images: total - with_images,
      total_images,
      avg_images_per_property: total > 0 ? Math.round((total_images / total) * 10) / 10 : 0
    };

    return { 
      total, 
      by_status, 
      by_region, 
      price,
      images: images_stats
    };
  }

  create(data: any): Property {
    const property = PropertySchema.parse({
      ...data,
      id: data.id || Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    this.properties.push(property);
    this.saveData();
    return property;
  }

  update(id: string, data: any): Property | null {
    const index = this.properties.findIndex(p => p.id === id || p.xml_id === id);
    if (index === -1) return null;

    const updated = {
      ...this.properties[index],
      ...data,
      updated_at: new Date().toISOString()
    };

    this.properties[index] = PropertySchema.parse(updated);
    this.saveData();
    return this.properties[index];
  }

  upsertBatch(items: any[]): { imported: number, updated: number, errors: number } {
    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const item of items) {
      try {
        const id = item.id || item.xml_id;
        if (!id) {
          console.error('❌ Item missing ID:', item);
          errors++;
          continue;
        }

        const existing = this.properties.find(p => 
          p.id === id || 
          p.xml_id === id || 
          (item.xml_id && p.xml_id === item.xml_id)
        );
        
        if (existing) {
          this.update(existing.id, item);
          updated++;
        } else {
          this.create({ ...item, id });
          imported++;
        }
      } catch (error) {
        errors++;
        console.error('❌ Error processing item:', error);
      }
    }

    console.log(`✅ Import complete: ${imported} new, ${updated} updated, ${errors} errors`);
    
    // Логируем статистику изображений после импорта
    const withImages = this.properties.filter(p => p.images && p.images.length > 0);
    const totalImages = this.properties.reduce((sum, p) => sum + (p.images?.length || 0), 0);
    console.log(`📸 After import: ${withImages.length}/${this.properties.length} properties have images (${totalImages} total images)`);
    
    this.saveData();
    return { imported, updated, errors };
  }

  close() {
    // Save final state if needed
    this.saveData();
  }
}
