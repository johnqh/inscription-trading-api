
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
  const rows: Order[] = await connection.select<Order>(query, params);
  res.send(rows);
});

router.post("/", async (req: Request, res: Response) => {
  const { address, tick, side, amt, price, expiration, expired } = req.body;

  // Validate input as needed
  connection.conn.execute(
    `INSERT INTO orders (address, tick, side, amt, price, expiration, expired) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [address, tick, side, amt, price, expiration, expired]
  );
  connection.conn.end();

  res.send({ message: "Action added successfully." });
});

// PUT Modify an Order Record Given its ID
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
	if (!id) {
		return res.status(400).send({ error: "Order id not provided" })
	}

  const { address, tick, side, amt, price, expiration, expired } = req.body;

  // Validate input as needed
  connection.conn.execute(
    `UPDATE orders SET address = ?, tick = ?, side = ?, amt = ?, price = ?, expiration = ?, expired = ? WHERE id = ?`,
    [address, tick, side, amt, price, expiration, expired, id]
  );
  connection.conn.end();

  res.send({ message: "Action added successfully." });
});

export default router;
