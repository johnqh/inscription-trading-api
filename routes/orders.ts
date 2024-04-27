import express, { Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import connection from "../connection";

export interface Order extends RowDataPacket {
  id: number;
  address: string;
  tick: string;
  side: number;
  amt: number;
  price: number;
  expiration: number;
  expired: number;
  txid: string;
  fulfilled: number;
}

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  // check query string
  let addr = req.query.address;
  let tick = req.query.tick;
  let id = req.query.id;

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

  // Getting a Single Order Record
  if (id) {
    conditions.push("id = ?");
    params.push(`${id}`);
  }

  // Adding Filters to the Query String
  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }

  // Open Connection
  if (!connection.connect()) {
    res.send([]);
    return;
  }

  // Retrieving Order Records in an Array
  const rows: Order[] = await connection.select<Order>(query, params);
  res.send(rows);
});

router.post("/", async (req: Request, res: Response) => {
  // handle optional fields
  let query: string = "INSERT INTO orders (";
  let values = "VALUES (";

  let params: any[] = [];

  for (const attr in req.body) {
    query += attr + ", ";
    values += "?, ";
    params.push(req.body[attr]);
  }

  // Remove the Last Comma & Space
  query = query.slice(0, -2);
  values = values.slice(0, -2);

  query += ") " + values + ")";

  // Open Connection
  if (!connection.connect()) {
    res.send({ message: "Connection failed" });
    return;
  }

  connection.execute(query, params);

  connection.close();

  res.send({ message: "Order added" });
});

// PUT Modify an Order Record Given its ID
router.put("/:id", async (req: Request, res: Response) => {
  console.log(req.body);
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send({ error: "Order id not provided" });
  }
  console.log(id);

  let sql = "UPDATE orders SET ";
  let values: any[] = [];

  for (const attr in req.body) {
    sql += attr + " = ?, ";
    values.push(req.body[attr]);
  }

  // Remove the Last Comma & Space
  sql = sql.slice(0, -2);

  sql += " WHERE id = ?";

  values.push(id);
  console.log(sql);
  console.log(values);

  // Open Connection
  if (!connection.connect()) {
    res.send({ message: "Connection failed" });
    return;
  }
  connection.execute(sql, values);

  connection.close();

  res.send({ message: "Order added successfully." });
});

export default router;
