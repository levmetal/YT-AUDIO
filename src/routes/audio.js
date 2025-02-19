const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();

// Ruta para obtener el audio
router.get('/:videoId', (req, res) => {
  const { videoId } = req.params;
  const ytdlp = spawn('yt-dlp', [
    '-x',
    '--audio-format', 'mp3',
    '--quiet',
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
      res.status(500).send('Error al procesar el audio');
    }
  });
});

module.exports = router;