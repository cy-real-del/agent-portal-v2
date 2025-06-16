import { XMLParser } from '../services/XMLParser';
import { PropertyModel } from '../models/PropertyJSON';
import path from 'path';
import fs from 'fs';

export class XMLImportJob {
  private xmlParser: XMLParser;
  private propertyModel: PropertyModel;

  constructor() {
    this.xmlParser = new XMLParser();
    const dataDir = process.env.DATA_DIR || (process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'data'));
    this.propertyModel = new PropertyModel(dataDir);
  }

  async run(): Promise<any> {
    const startTime = new Date();
    
    try {
      console.log('🚀 Starting XML import job...');
      
      // Получаем и парсим XML
      const properties = await this.xmlParser.fetchAndParse();
      console.log(`✅ Parsed ${properties.length} properties from XML`);
      
      if (properties.length === 0) {
        console.log('⚠️ No properties found in XML');
        return {
          total: 0,
          imported: 0,
          updated: 0,
          errors: 0,
          duration: Date.now() - startTime.getTime()
        };
      }
      
      // Получаем текущие свойства для сравнения
      const existingProperties = this.propertyModel.getAll();
      console.log(`📊 Found ${existingProperties.total} existing properties`);
      
      // Импортируем или обновляем свойства
      const result = this.propertyModel.upsertBatch(properties);
      
      const endTime = new Date();
      const stats = {
        total: properties.length,
        imported: result.imported,
        updated: result.updated,
        errors: result.errors,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime()
      };
      
      console.log('✅ XML import completed successfully!');
      console.log(`📊 Stats: ${result.imported} new, ${result.updated} updated, ${result.errors} errors`);
      console.log(`⏱️ Duration: ${(stats.duration / 1000).toFixed(2)}s`);
      
      return stats;
    } catch (error) {
      console.error('❌ XML import failed:', error);
      
      const endTime = new Date();
      return {
        total: 0,
        imported: 0,
        updated: 0,
        errors: 1,
        error: error instanceof Error ? error.message : String(error),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }
}

// Если запущен напрямую
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
