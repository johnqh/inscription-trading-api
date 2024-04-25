import express, { Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import connection from "../connection";

interface MatchFulfillment extends RowDataPacket {
  id: number;
  buyer_order: number;
  seller_order: number;
  unisat_txid: string;
  unisat_order_id: string;
  fulfillment_txid: string;
  inscription_change_txid: string;
  completed_order: number;
}

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  let query: string = "SELECT * FROM match_fulfillment";
  const params: String[] = [];

  // Open Connection
  if (!connection.connect()) {
    res.send({ message: "Connection failed" });
    return;
  }

  const rows: MatchFulfillment[] = await connection.select<MatchFulfillment>(
    query,
    params
  );

  connection.close();

  res.send(rows);
});

router.post("/", async (req: Request, res: Response) => {
  // handle optional fields
  let query: string = "INSERT INTO match_fulfillment (";
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

  res.send({ message: "Match added" });
});

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send({ error: "Match fulfillment id not provided" });
  }
  console.log(id);

  let sql = "UPDATE match_fulfillment SET ";
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

  res.send({ message: "Match updated" });
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send({ error: "Match fulfillment id not provided" });
  }

  // Open Connection
  if (!connection.connect()) {
    res.send({ message: "Connection failed" });
    return;
  }
  connection.execute("DELETE FROM match_fulfillment WHERE id = ?", [id]);
  connection.close();

  res.send({ message: "Match deleted" });
});

export default router;
