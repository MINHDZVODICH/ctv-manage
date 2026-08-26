import dotenv from 'dotenv';

dotenv.config();

import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 4000);
createApp().listen(PORT);
