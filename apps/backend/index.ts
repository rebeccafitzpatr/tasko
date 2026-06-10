import express, {type Request, type Response} from 'express';
import cors from 'cors';
import { SQL } from 'bun'

const dbUrl = process.env.MYSQL_PUBLIC_URL;
if (!dbUrl) {
  throw new Error('MY_SQL_PUBLIC_URL environment variable is not set');
}
const app = express();
app.use(cors());
app.use(express.json());

let mysql;
try {
  mysql = new SQL(new URL(dbUrl));
  const test = await mysql`SELECT 1 + 1 AS result`;
  console.log('DB test result:', test);
} catch (err) {
  console.error('DB connection/test failed:', (err as any).message ?? err);
  process.exit(1);
}






//initialise bun backend server
app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
}); 

