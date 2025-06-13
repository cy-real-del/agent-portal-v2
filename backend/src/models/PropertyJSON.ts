import fs from 'fs';
import path from 'path';
import { z } from 'zod';

export const PropertySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(['apartment', 'villa', 'house', 'studio', 'penthouse', 'plot']),
  status: z.enum(['available', 'reserved', 'sold', 'off_market']),
  price: z.number().positive(),
  currency: z.string().default('EUR'),
  area_total: z.number().positive(),
  rooms: z.number().int().min(0),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  region: z.string(),
  area: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  distance_to_sea: z.number().min(0).optional(),
  features: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  main_image: z.string().optional(),
  developer: z.string().optional(),
  complex_name: z.string().optional(),
  source: z.string().default('xml'),
  xml_id: z.string().optional(),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date())
});

export type Property = z.infer<typeof PropertySchema>;

export class PropertyModel {
  private dataFile: string;
  private properties: Property[] = [];

  constructor(dataPath: string) {
    this.dataFile = path.join(dataPath, 'properties.json');
    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const parsed = JSON.parse(data);
        this.properties = parsed.map((p: any) => ({
          ...p,
          created_at: new Date(p.created_at),
          updated_at: new Date(p.updated_at)
        }));
        console.log(`Loaded ${this.properties.length} properties from JSON`);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.properties = [];
    }
  }

  private saveData() {
    try {
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataFile, JSON.stringify(this.properties, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  upsert(property: Partial<Property>): Property {
    const validated = PropertySchema.parse(property);
    
    const index = this.properties.findIndex(p => p.id === validated.id || p.xml_id === validated.xml_id);
    if (index >= 0) {
      this.properties[index] = { ...validated, updated_at: new Date() };
    } else {
      this.properties.push(validated);
    }
    
    this.saveData();
    return validated;
  }

  findAll(filters: any = {}): Property[] {
    let filtered = [...this.properties];

    if (filters.type) filtered = filtered.filter(p => p.type === filters.type);
    if (filters.status) filtered = filtered.filter(p => p.status === filters.status);
    if (filters.region) filtered = filtered.filter(p => p.region === filters.region);
    if (filters.minPrice) filtered = filtered.filter(p => p.price >= filters.minPrice);
    if (filters.maxPrice) filtered = filtered.filter(p => p.price <= filters.maxPrice);
    if (filters.minRooms) filtered = filtered.filter(p => p.rooms >= filters.minRooms);
    if (filters.maxRooms) filtered = filtered.filter(p => p.rooms <= filters.maxRooms);

    filtered.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

    if (filters.offset) filtered = filtered.slice(filters.offset);
    if (filters.limit) filtered = filtered.slice(0, filters.limit);

    return filtered;
  }

  findById(id: string): Property | null {
    return this.properties.find(p => p.id === id) || null;
  }

  getStats() {
    const total = this.properties.length;
    const statusStats = this.properties.reduce((acc: any[], p) => {
      const existing = acc.find(s => s.status === p.status);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ status: p.status, count: 1 });
      }
      return acc;
    }, []);

    const regionStats = this.properties.reduce((acc: any[], p) => {
      const existing = acc.find(s => s.region === p.region);
      if (existing) {
        existing.count++;
        existing.total_price += p.price;
        existing.avg_price = existing.total_price / existing.count;
      } else {
        acc.push({ region: p.region, count: 1, total_price: p.price, avg_price: p.price });
      }
      return acc;
    }, []);

    return {
      total,
      by_status: statusStats,
      by_region: regionStats,
      price: total > 0 ? {
        min: Math.min(...this.properties.map(p => p.price)),
        max: Math.max(...this.properties.map(p => p.price)),
        avg: this.properties.reduce((sum, p) => sum + p.price, 0) / this.properties.length
      } : { min: 0, max: 0, avg: 0 }
    };
  }

  logImport(data: any) {
    console.log('📊 Import log:', data);
  }

  close() {}
}
