import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import orders from './routes/orders';

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

app.use('/orders', orders);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
