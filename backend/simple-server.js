const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8001;

app.use(cors({
  origin: ['http://localhost:3000', 'https://cy-real-del.github.io', 'file://'],
  credentials: true
}));
app.use(express.json());

// Читаем данные из JSON файла
let properties = [];
try {
  const dataPath = path.join(__dirname, 'data', 'properties.json');
  if (fs.existsSync(dataPath)) {
    const data = fs.readFileSync(dataPath, 'utf8');
    properties = JSON.parse(data);
    console.log(`📊 Loaded ${properties.length} properties from JSON`);
  }
} catch (error) {
  console.log('No properties data found');
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: { total_properties: properties.length },
    environment: 'development'
  });
});

app.get('/api/stats', (req, res) => {
  const total = properties.length;
  const prices = properties.map(p => p.price).filter(p => p > 0);
  
  res.json({
    success: true,
    stats: {
      total,
      price: {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: prices.reduce((a, b) => a + b, 0) / prices.length
      },
      by_status: properties.reduce((acc, p) => {
        const existing = acc.find(s => s.status === p.status);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ status: p.status, count: 1 });
        }
        return acc;
      }, [])
    }
  });
});

app.get('/api/properties', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;
  
  const result = properties.slice(offset, offset + limit);
  
  res.json({
    success: true,
    data: result,
    pagination: {
      total: properties.length,
      limit,
      offset
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple API server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Properties: ${properties.length} loaded`);
});
