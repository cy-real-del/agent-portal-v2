// backend/src/models/Property.ts
import Database from 'better-sqlite3';
import { z } from 'zod';

// Zod схема для валидации данных
export const PropertySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(['apartment', 'villa', 'house', 'studio', 'penthouse', 'plot']),
  status: z.enum(['available', 'reserved', 'sold', 'off_market']),
  price: z.number().positive(),
  currency: z.string().default('EUR'),
  area_total: z.number().positive(),
  area_covered: z.number().optional(),
  area_uncovered: z.number().optional(),
  rooms: z.number().int().min(0),
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  floor: z.number().int().optional(),
  total_floors: z.number().int().optional(),
  year_built: z.number().int().optional(),
  renovation_year: z.number().int().optional(),
  energy_class: z.string().optional(),
  condition: z.string().optional(),
  furnished: z.boolean().default(false),
  parking_spaces: z.number().int().min(0).default(0),
  
  // Location
  region: z.string(),
  area: z.string(),
  city: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  distance_to_sea: z.number().min(0).optional(),
  
  // Features
  features: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  
  // Images
  images: z.array(z.string()).default([]),
  main_image: z.string().optional(),
  virtual_tour: z.string().optional(),
  
  // Developer/Agent info
  developer: z.string().optional(),
  agent_name: z.string().optional(),
  agent_phone: z.string().optional(),
  agent_email: z.string().optional(),
  
  // Complex info
  complex_id: z.string().optional(),
  complex_name: z.string().optional(),
  
  // Metadata
  source: z.string().default('xml'),
  xml_id: z.string().optional(),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
  last_xml_update: z.date().optional()
});

export type Property = z.infer<typeof PropertySchema>;

export class PropertyModel {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables() {
    // Создание таблицы properties
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        price REAL NOT NULL,
        currency TEXT DEFAULT 'EUR',
        area_total REAL NOT NULL,
        area_covered REAL,
        area_uncovered REAL,
        rooms INTEGER NOT NULL,
        bedrooms INTEGER DEFAULT 0,
        bathrooms INTEGER DEFAULT 0,
        floor INTEGER,
        total_floors INTEGER,
        year_built INTEGER,
        renovation_year INTEGER,
        energy_class TEXT,
        condition TEXT,
        furnished BOOLEAN DEFAULT FALSE,
        parking_spaces INTEGER DEFAULT 0,
        
        -- Location
        region TEXT NOT NULL,
        area TEXT NOT NULL,
        city TEXT,
        address TEXT,
        postal_code TEXT,
        latitude REAL,
        longitude REAL,
        distance_to_sea REAL,
        
        -- JSON fields for arrays
        features TEXT DEFAULT '[]',
        amenities TEXT DEFAULT '[]',
        images TEXT DEFAULT '[]',
        
        -- Additional fields
        main_image TEXT,
        virtual_tour TEXT,
        developer TEXT,
        agent_name TEXT,
        agent_phone TEXT,
        agent_email TEXT,
        complex_id TEXT,
        complex_name TEXT,
        
        -- Metadata
        source TEXT DEFAULT 'xml',
        xml_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_xml_update DATETIME,
        
        -- Indexes
        UNIQUE(xml_id) ON CONFLICT REPLACE
      )
    `);

    // Создание индексов для быстрого поиска
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
      CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
      CREATE INDEX IF NOT EXISTS idx_properties_region ON properties(region);
      CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
      CREATE INDEX IF NOT EXISTS idx_properties_rooms ON properties(rooms);
      CREATE INDEX IF NOT EXISTS idx_properties_xml_id ON properties(xml_id);
    `);

    // Таблица для логов импорта
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS import_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        imported_count INTEGER DEFAULT 0,
        updated_count INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        error_message TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        duration_ms INTEGER
      )
    `);
  }

  // Создание/обновление объекта
  upsert(property: Partial<Property>): Property {
    const validated = PropertySchema.parse(property);
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO properties (
        id, title, description, type, status, price, currency,
        area_total, area_covered, area_uncovered, rooms, bedrooms, bathrooms,
        floor, total_floors, year_built, renovation_year, energy_class, condition,
        furnished, parking_spaces, region, area, city, address, postal_code,
        latitude, longitude, distance_to_sea, features, amenities, images,
        main_image, virtual_tour, developer, agent_name, agent_phone, agent_email,
        complex_id, complex_name, source, xml_id, created_at, updated_at, last_xml_update
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      validated.id,
      validated.title,
      validated.description || null,
      validated.type,
      validated.status,
      validated.price,
      validated.currency,
      validated.area_total,
      validated.area_covered || null,
      validated.area_uncovered || null,
      validated.rooms,
      validated.bedrooms,
      validated.bathrooms,
      validated.floor || null,
      validated.total_floors || null,
      validated.year_built || null,
      validated.renovation_year || null,
      validated.energy_class || null,
      validated.condition || null,
      validated.furnished,
      validated.parking_spaces,
      validated.region,
      validated.area,
      validated.city || null,
      validated.address || null,
      validated.postal_code || null,
      validated.latitude || null,
      validated.longitude || null,
      validated.distance_to_sea || null,
      JSON.stringify(validated.features),
      JSON.stringify(validated.amenities),
      JSON.stringify(validated.images),
      validated.main_image || null,
      validated.virtual_tour || null,
      validated.developer || null,
      validated.agent_name || null,
      validated.agent_phone || null,
      validated.agent_email || null,
      validated.complex_id || null,
      validated.complex_name || null,
      validated.source,
      validated.xml_id || null,
      validated.created_at.toISOString(),
      validated.updated_at.toISOString(),
      validated.last_xml_update?.toISOString() || null
    );

    return validated;
  }

  // Получение всех объектов с фильтрами
  findAll(filters: {
    type?: string;
    status?: string;
    region?: string;
    minPrice?: number;
    maxPrice?: number;
    minRooms?: number;
    maxRooms?: number;
    limit?: number;
    offset?: number;
  } = {}): Property[] {
    let query = 'SELECT * FROM properties WHERE 1=1';
    const params: any[] = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.region) {
      query += ' AND region = ?';
      params.push(filters.region);
    }
    if (filters.minPrice) {
      query += ' AND price >= ?';
      params.push(filters.minPrice);
    }
    if (filters.maxPrice) {
      query += ' AND price <= ?';
      params.push(filters.maxPrice);
    }
    if (filters.minRooms) {
      query += ' AND rooms >= ?';
      params.push(filters.minRooms);
    }
    if (filters.maxRooms) {
      query += ' AND rooms <= ?';
      params.push(filters.maxRooms);
    }

    query += ' ORDER BY updated_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.parseRow);
  }

  // Получение объекта по ID
  findById(id: string): Property | null {
    const row = this.db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as any;
    return row ? this.parseRow(row) : null;
  }

  // Получение статистики
  getStats() {
    const totalCount = this.db.prepare('SELECT COUNT(*) as count FROM properties').get() as any;
    const statusStats = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM properties 
      GROUP BY status
    `).all() as any[];
    
    const typeStats = this.db.prepare(`
      SELECT type, COUNT(*) as count 
      FROM properties 
      GROUP BY type
    `).all() as any[];

    const regionStats = this.db.prepare(`
      SELECT region, COUNT(*) as count, AVG(price) as avg_price
      FROM properties 
      GROUP BY region
    `).all() as any[];

    return {
      total: totalCount.count,
      by_status: statusStats,
      by_type: typeStats,
      by_region: regionStats
    };
  }

  // Логирование импорта
  logImport(data: {
    source: string;
    status: 'started' | 'completed' | 'failed';
    imported_count?: number;
    updated_count?: number;
    errors_count?: number;
    error_message?: string;
    duration_ms?: number;
  }) {
    const stmt = this.db.prepare(`
      INSERT INTO import_logs (source, status, imported_count, updated_count, errors_count, error_message, duration_ms, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.source,
      data.status,
      data.imported_count || 0,
      data.updated_count || 0,
      data.errors_count || 0,
      data.error_message || null,
      data.duration_ms || null,
      data.status === 'completed' || data.status === 'failed' ? new Date().toISOString() : null
    );
  }

  private parseRow(row: any): Property {
    return {
      ...row,
      furnished: Boolean(row.furnished),
      features: JSON.parse(row.features || '[]'),
      amenities: JSON.parse(row.amenities || '[]'),
      images: JSON.parse(row.images || '[]'),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      last_xml_update: row.last_xml_update ? new Date(row.last_xml_update) : undefined
    };
  }

  close() {
    this.db.close();
  }
}