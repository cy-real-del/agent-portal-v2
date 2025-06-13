import { Router } from 'express';
import { PropertyModel } from '../models/PropertyJSON';

export const healthRouter = Router();

// GET /api/health - проверка работоспособности API
healthRouter.get('/', (req, res) => {
  try {
    const propertyModel: PropertyModel = req.app.locals.propertyModel;
    const stats = propertyModel.getStats();
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        connected: true,
        total_properties: stats.total
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
