
import express, { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import connection from '../connection';

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

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
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

router.post("/", async (req: Request, res: Response) => {
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
router.put("/", async (req: Request, res: Response) => {
  const { id, address, tick, side, amt, price, expiration, expired } = req.body;

  // Validate input as needed
  await connection.execute(
    `UPDATE orders SET address = ?, tick = ?, side = ?, amt = ?, price = ?, expiration = ?, expired = ? WHERE id = ?`,
    [address, tick, side, amt, price, expiration, expired, id]
  );
  await connection.end();

  res.send({ message: "Action added successfully." });
});

export default router;

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
