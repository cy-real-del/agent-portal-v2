import { Router } from 'express';
import { PropertyModel } from '../models/PropertyJSON';

export const propertiesRouter = Router();

// GET /api/properties - получить все объекты с фильтрами
propertiesRouter.get('/', (req, res) => {
  try {
    const propertyModel: PropertyModel = req.app.locals.propertyModel;
    
    const filters = {
      type: req.query.type as string,
      status: req.query.status as string,
      region: req.query.region as string,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      minRooms: req.query.minRooms ? parseInt(req.query.minRooms as string) : undefined,
      maxRooms: req.query.maxRooms ? parseInt(req.query.maxRooms as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0
    };

    // Убираем undefined значения
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof typeof filters] === undefined) {
        delete filters[key as keyof typeof filters];
      }
    });

    const properties = propertyModel.getAll(filters);
    const total = propertyModel.getAll({ ...filters, limit: undefined, offset: undefined }).length;

    res.json({
      success: true,
      data: properties,
      pagination: {
        total,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
        page: Math.floor((filters.offset || 0) / (filters.limit || 100)) + 1,
        pages: Math.ceil(total / (filters.limit || 100))
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

// GET /api/properties/:id - получить конкретный объект
propertiesRouter.get('/:id', (req, res) => {
  try {
    const propertyModel: PropertyModel = req.app.locals.propertyModel;
    const property = propertyModel.getById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found',
        id: req.params.id
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

// GET /api/properties/search/:query - поиск по тексту
propertiesRouter.get('/search/:query', (req, res) => {
  try {
    const propertyModel: PropertyModel = req.app.locals.propertyModel;
    const query = req.params.query.toLowerCase();
    
    const allProperties = propertyModel.getAll({ limit: 1000 });
    const filteredProperties = allProperties.filter(property => 
      property.title.toLowerCase().includes(query) ||
      (property.description && property.description.toLowerCase().includes(query)) ||
      property.region.toLowerCase().includes(query) ||
      property.area.toLowerCase().includes(query) ||
      (property.developer && property.developer.toLowerCase().includes(query))
    );

    res.json({
      success: true,
      data: filteredProperties,
      query,
      count: filteredProperties.length
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
