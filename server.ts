import express, { Request, Response } from "express";
import dotenv from "dotenv";
import orders from "./routes/orders";
import parsed_block from "./routes/parsed_block";
import actions from "./routes/actions";
import holdings from "./routes/holdings";
import deploy from "./routes/deploy";
// import bodyParser from "body-parser";

// Get address for MySQL server
dotenv.config();
const databaseURL = process.env.DATABASE_URL;
console.log("Database: " + databaseURL);

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json()); // Updated to use the built-in express middleware

// Enables Body Parsing - For Handling HTML Order Form
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));

// Have root state that the API is running
app.get("/", (_req: Request, res: Response) => {
  res.send("API is running");
});

app.use("/parsed_block", parsed_block);
app.use("/actions", actions);
app.use("/holdings", holdings);
app.use("/deploy", deploy);
app.use("/orders", orders);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

/*
References
https://blog.stackademic.com/mastering-express-middleware-a-guide-to-body-parser-for-html-form-handling-d7ac91a9ccd8?gi=80f6ce56b9da
*/
