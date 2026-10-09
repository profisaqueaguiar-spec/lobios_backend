const express = require('express');
const cors = require('cors');
const relatoRoutes = require('./routes/relatos.routes');
const rhRoutes = require('./routes/rh.routes')

const app = express();

app.use(cors());
app.use(express.json());

// Registro das rotas
app.use('/api/v1', relatoRoutes);
app.use('/api/v1', rhRoutes);

module.exports = app;