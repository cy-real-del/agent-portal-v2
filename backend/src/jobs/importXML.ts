import { XMLParser } from '../services/XMLParser';
import { PropertyModel } from '../models/PropertyJSON';
import path from 'path';
import fs from 'fs';

interface ImportStats {
  total: number;
  imported: number;
  updated: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export class XMLImportJob {
  private propertyModel: PropertyModel;
  private xmlParser: XMLParser;

  constructor() {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.propertyModel = new PropertyModel(dataDir);
    this.xmlParser = new XMLParser({
      xmlUrl: process.env.XML_URL || 'https://antariahomes.com/export.xml'
    });
  }

  async run(): Promise<ImportStats> {
    const stats: ImportStats = {
      total: 0,
      imported: 0,
      updated: 0,
      errors: 0,
      startTime: new Date()
    };

    console.log('🚀 Starting XML import job...');
    this.propertyModel.logImport({ source: 'antaria_xml', status: 'started' });

    try {
      const existingProperties = new Set(
        this.propertyModel.findAll().map(p => p.xml_id).filter(Boolean)
      );

      console.log('📥 Fetching and parsing XML...');
      const properties = await this.xmlParser.fetchAndParseXML();
      stats.total = properties.length;

      console.log(`📊 Found ${properties.length} properties in XML`);

      for (const property of properties) {
        try {
          const isExisting = existingProperties.has(property.xml_id || '');
          
          this.propertyModel.upsert(property);
          
          if (isExisting) {
            stats.updated++;
            console.log(`✏️  Updated: ${property.title} (${property.id})`);
          } else {
            stats.imported++;
            console.log(`➕ Imported: ${property.title} (${property.id})`);
          }

        } catch (error) {
          stats.errors++;
          console.error(`❌ Error processing property ${property.id}:`, error);
        }
      }

      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      this.propertyModel.logImport({
        source: 'antaria_xml',
        status: 'completed',
        imported_count: stats.imported,
        updated_count: stats.updated,
        errors_count: stats.errors,
        duration_ms: stats.duration
      });

      console.log('✅ XML import completed successfully!');
      console.log(`📈 Stats: ${stats.imported} new, ${stats.updated} updated, ${stats.errors} errors`);
      console.log(`⏱️  Duration: ${(stats.duration / 1000).toFixed(2)}s`);

    } catch (error) {
      stats.endTime = new Date();
      stats.duration = stats.endTime.getTime() - stats.startTime.getTime();

      this.propertyModel.logImport({
        source: 'antaria_xml',
        status: 'failed',
        errors_count: 1,
        error_message: error instanceof Error ? error.message : String(error),
        duration_ms: stats.duration
      });

      console.error('❌ XML import failed:', error);
      throw error;
    }

    return stats;
  }

  close() {
    this.propertyModel.close();
  }
}

// Запуск как standalone script
if (require.main === module) {
  const job = new XMLImportJob();
  
  job.run()
    .then(stats => {
      console.log('Import completed:', stats);
      process.exit(0);
    })
    .catch(error => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}
