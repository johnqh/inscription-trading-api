import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import orders from './routes/orders';
import parsed_block from './routes/parsed_block';
import actions from './routes/actions';
import holdings from './routes/holdings';
import deploy from './routes/deploy';

// Get address for MySQL server
dotenv.config();
const databaseURL = process.env.DATABASE_URL;
console.log("Database: " + databaseURL);

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json()); // Updated to use the built-in express middleware

// Have root state that the API is running
app.get('/', (_req: Request, res: Response) => {
  res.send("API is running");
});

app.use('/parsed_block', parsed_block);
app.use('/actions', actions);
app.use('/holdings', holdings);
app.use('/deploy', deploy);
app.use('/orders', orders);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
