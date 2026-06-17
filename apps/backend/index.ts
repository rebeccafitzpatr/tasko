import express, {type Request, type Response} from 'express';
import cors from 'cors';
import { SQL } from 'bun'
import path from 'path';

import apiRouter from './api.js';

const dbUrl = process.env.MYSQL_PUBLIC_URL;
if (!dbUrl) {
  throw new Error('MYSQL_PUBLIC_URL environment variable is not set');
}
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(origin => origin.trim()).filter(Boolean);
console.log('Allowed origins from env:', allowedOrigins);

const whitelistOrigins: string[] = [
  ...allowedOrigins,
].filter(Boolean) as string[];


app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g., curl) by default
    if (!origin) return callback(null, true);
    if (whitelistOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

let mysql;

try {
  mysql = new SQL({
    adapter: 'mysql',
    hostname: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    database: process.env.MYSQL_DATABASE,
    username: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    tls: true,
  });
  const test = await mysql`SELECT 1 + 1 AS result`
  console.log('DB test result:', test);
} catch (err) {
  console.error('DB connection/test failed:', (err as Error).message);
  process.exit(1);
}

  app.use('/api', apiRouter);






//initialise bun backend server
app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
}); 

