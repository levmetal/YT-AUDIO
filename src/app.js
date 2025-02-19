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
    max: 100, // Límite de 100 solicitudes por IP por ventana de 15 minutos
    message: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo en 15 minutos.' // Mensaje personalizado para rate limit
}));

// Servir el archivo index.html (para la interfaz frontend si la tienes)
app.use(express.static(path.join(__dirname, '../')));

// Usar las rutas de audio (donde se define la lógica de yt-dlp)
app.use('/audio', audioRoutes);

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});