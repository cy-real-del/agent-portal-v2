import { Router } from 'express';
import { PropertyModel } from '../models/PropertyJSON';

export const propertiesRouter = Router();

// GET /api/properties
propertiesRouter.get('/', async (req, res) => {
  try {
    const propertyModel = req.app.locals.propertyModel as PropertyModel;
    
    const filters = {
      type: req.query.type as string,
      status: req.query.status as string,
      min_price: req.query.min_price as string,
      max_price: req.query.max_price as string,
      region: req.query.region as string,
      sort: req.query.sort as string,
      limit: req.query.limit as string || '100',
      offset: req.query.offset as string || '0'
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters] === undefined) {
        delete filters[key as keyof typeof filters];
      }
    });

    const result = propertyModel.getAll(filters);
    const limit = Number(filters.limit);
    const offset = Number(filters.offset);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        pages: Math.ceil(result.total / limit)
      },
      filters
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/properties/:id
propertiesRouter.get('/:id', async (req, res) => {
  try {
    const propertyModel = req.app.locals.propertyModel as PropertyModel;
    const property = propertyModel.getById(req.params.id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/properties/search
propertiesRouter.get('/search', async (req, res) => {
  try {
    const propertyModel = req.app.locals.propertyModel as PropertyModel;
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const result = propertyModel.getAll();
    const searchTerm = q.toLowerCase();
    
    const filtered = result.data.filter(property => {
      const title = property.title?.toLowerCase() || '';
      const region = property.region?.toLowerCase() || '';
      const type = property.type?.toLowerCase() || '';
      
      return title.includes(searchTerm) || 
             region.includes(searchTerm) || 
             type.includes(searchTerm);
    });

    res.json({
      success: true,
      data: filtered,
      total: filtered.length,
      query: q
    });
  } catch (error) {
    console.error('Error searching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search properties',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
