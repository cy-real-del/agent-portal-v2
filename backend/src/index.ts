import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cron from 'node-cron';
import path from 'path';

import { PropertyModel } from './models/PropertyJSON';
import { XMLImportJob } from './jobs/importXML';
import { propertiesRouter } from './routes/properties';
import { healthRouter } from './routes/health';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://cy-real-del.github.io'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Инициализация базы данных
const dataDir = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const propertyModel = new PropertyModel(dataDir);
app.locals.propertyModel = propertyModel;

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/properties', propertiesRouter);

// API для импорта
app.post('/api/import/xml', async (req, res) => {
  try {
    console.log('🚀 Manual XML import triggered');
    const importJob = new XMLImportJob();
    const stats = await importJob.run();
    
    res.json({
      success: true,
      message: 'XML import completed successfully',
      stats
    });
  } catch (error) {
    console.error('XML import error:', error);
    res.status(500).json({
      success: false,
      message: 'XML import failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Статистика
app.get('/api/stats', (req, res) => {
  try {
    const stats = propertyModel.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});

// Error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Автоматический импорт XML каждые 6 часов
const importInterval = process.env.XML_IMPORT_INTERVAL || '0 */6 * * *';
console.log(`🕐 Scheduled XML import: ${importInterval}`);

cron.schedule(importInterval, async () => {
  console.log('🔄 Running scheduled XML import...');
  try {
    const importJob = new XMLImportJob();
    const stats = await importJob.run();
    console.log('✅ Scheduled import completed:', stats);
  } catch (error) {
    console.error('❌ Scheduled import failed:', error);
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Agent Portal Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: JSON file in data/`);
  console.log(`🌐 CORS enabled for: localhost:3000, cy-real-del.github.io`);
  
  // Запуск первого импорта при старте
  if (process.env.AUTO_IMPORT_ON_START === 'true') {
    console.log('🚀 Running initial XML import...');
    const importJob = new XMLImportJob();
    importJob.run()
      .then(stats => console.log('✅ Initial import completed:', stats))
      .catch(error => console.error('❌ Initial import failed:', error));
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  propertyModel.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  propertyModel.close();
  process.exit(0);
});

export default app;
