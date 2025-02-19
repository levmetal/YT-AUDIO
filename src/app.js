const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const audioRoutes = require('./routes/audio');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 solicitudes por IP
}));

// Servir el archivo index.html
app.use(express.static(path.join(__dirname, '../')));

// Usar las rutas de audio
app.use('/audio', audioRoutes);

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});