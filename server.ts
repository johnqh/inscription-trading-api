import express, { Request, Response } from "express";
import { RowDataPacket } from "mysql2"; // Representing 1 Row of an SQL Table
import connection from "./connection"; // Connecting to the Database

const app = express();
const port = 3000;

// Order Class
interface Order extends RowDataPacket {
  id: number;
  address: string;
  tick: string;
  side: number;
  amt: number;
  price: number;
  expiration: number;
  expired: number;
}

// Middleware to parse JSON bodies
app.use(express.json()); // Updated to use the built-in express middleware

// Root Route to Confirm the Server is Running
app.get("/", async (req: Request, res: Response) => {
  res.send("Server is up and running!");
});

// GET Route to Retrieve Orders
app.get("/orders", async (req: Request, res: Response) => {
  // check query string
  let addr = req.query.address;
  let tick = req.query.tick;

  // Retrieving Orders from SQL Table
  let query: string = "SELECT * FROM orders";
  const conditions: string[] = [];
  const params: string[] = [];

  // Adding Filters if Specify by the App
  if (addr) {
    conditions.push("address = ?");
    params.push(`${addr}`);
  }

  // Adding Filters if Specify by the App
  if (tick) {
    conditions.push("tick = ?");
    params.push(`${tick}`);
  }

  // Adding Filters to the Query String
  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }

  // Retrieving Order Records in an Array
  const rows: Order[] = await selectOrders(query, params);
  res.send(rows);
});


// Executing the Query and Returnig the Results
function selectOrders(query: string, params: String[]): Promise<Order[]> {
  return new Promise((resolve, reject) => {
    connection.query<Order[]>(query, params, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

// POST Route to Insert a Order Record on the Order Table
app.post("/orders", async (req: Request, res: Response) => {
  const { address, tick, side, amt, price, expiration, expired } = req.body;

  // Validate input as needed
  await connection.execute(
    `INSERT INTO orders (address, tick, side, amt, price, expiration, expired) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [address, tick, side, amt, price, expiration, expired]
  );
  await connection.end();

  res.send({ message: "Action added successfully." });
});

// PUT Modify an Order Record Given its ID
app.put("/orders", async (req: Request, res: Response) => {
  const { id, address, tick, side, amt, price, expiration, expired } = req.body;

  // Validate input as needed
  await connection.execute(
    `UPDATE orders SET address = ?, tick = ?, side = ?, amt = ?, price = ?, expiration = ?, expired = ? WHERE id = ?`,
    [address, tick, side, amt, price, expiration, expired, id]
  );
  await connection.end();

  res.send({ message: "Action added successfully." });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
