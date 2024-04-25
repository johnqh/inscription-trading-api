import express, { Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import connection from "../connection";

export interface NftOrder extends RowDataPacket {
  id: number;
  seller_address: string;
  buyer_address: string;
  txid: string;
  inscription_id: string;
  inscription_number: string;
  name: string;
  price: number;
  expiration: number;
  expired: number;
  fulfilled: number;
}

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  // check query string
  let seller_addr = req.query.seller_address;

  // Retrieving Orders from SQL Table
  let query: string = "SELECT * FROM nft_orders";
  const conditions: string[] = [];
  const params: string[] = [];

  // Adding Filters if Specify by the App
  if (seller_addr) {
    conditions.push("seller_address = ?");
    params.push(`${seller_addr}`);
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
  const rows: NftOrder[] = await connection.select<NftOrder>(query, params);
  res.send(rows);
});

router.post("/", async (req: Request, res: Response) => {
  const {
    seller_address,
    buyer_address,
    txid,
    inscription_id,
    inscription_number,
    name,
    price,
    expiration,
    expired,
    fulfilled,
  } = req.body;

  // Open Connection
  if (!connection.connect()) {
    res.send({ message: "Connection failed" });
    return;
  }

  // Validate input as needed
  connection
    .getConnection()
    .execute(
      `INSERT INTO nft_orders (seller_address, buyer_address, inscription_id, inscription_number, name, price, expiration, expired, txid, fulfilled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [seller_address, buyer_address, inscription_id, inscription_number, name, price, expiration, expired, txid, fulfilled]
    );

  connection.close();

  res.send({ message: "Action added successfully." });
});

// PUT Modify an Order Record Given its ID
router.put("/:id", async (req: Request, res: Response) => {
  console.log(req.body);
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send({ error: "Order id not provided" });
  }
  console.log(id);

  let sql = "UPDATE nft_orders SET ";
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

  res.send({ message: "Action added successfully." });
});

export default router;
