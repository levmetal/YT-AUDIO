import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url'; // <-- Import fileURLToPath
import audioRoutes from './routes/audio.js';

const app = express();
const port = process.env.PORT || 3000;

// --- For fixing __dirname is not defined in ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- End of __dirname fix ---


// Middlewares
app.use(cors());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: 'Too many request from this ip' 
}));
//for frontend integration
app.use(express.static(path.join(__dirname, '../'))); 


app.use('/audio', audioRoutes);


app.listen(port, () => {
    console.log(`listening in http://localhost:${port}`);
});