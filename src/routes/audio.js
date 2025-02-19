const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();
const path = require('path');

// Ruta para obtener el audio
router.get('/:videoId', (req, res) => {
  const { videoId } = req.params;
  const ytdlp = spawn('yt-dlp', [
    '-x',
    '--audio-format', 'mp3',
    '--quiet',
    '--cookies', path.join(__dirname, 'cookies.txt'), // Ruta al archivo de cookies
    '-o', '-',
    `https://www.youtube.com/watch?v=${videoId}`
  ]);

  // Configurar headers para streaming
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', 'inline; filename="audio.mp3"');

  // Pipe del output de yt-dlp a la respuesta HTTP
  ytdlp.stdout.pipe(res);

  // Manejo de errores
  ytdlp.stderr.on('data', (data) => {
    console.error(`Error: ${data}`);
  });

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      if (!res.headersSent) {
        res.status(500).send('Error al procesar el audio');
      }
    }
  });
});

module.exports = router;