import express, { Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import connection from "../connection";

interface NftHistoricalRecord extends RowDataPacket {
  id: number;
  address: string;
  action: string;
  txid: string;
  inscription_id: string;
  inscription_number: string;
  name: string;
  price: number;
  fee?: number;
  datetime: string;
}

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  // check query string
  let addr = req.query.address;

  let query: string = "SELECT * FROM nft_historical_records";
  const params: String[] = [];

  if (addr) {
    query += " WHERE address = ?";
    params.push(`${addr}`);
  }

  // Open Connection
  if (!connection.connect()) {
    res.send({ message: "Connection failed" });
    return;
  }

  const rows: NftHistoricalRecord[] =
    await connection.select<NftHistoricalRecord>(query, params);

  connection.close();

  res.send(rows);
});

router.post("/", async (req: Request, res: Response) => {
  // handle optional fields
  let query: string = "INSERT INTO nft_historical_records (";
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

  res.send({ message: "Record added" });
});

router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id) {
    return res
      .status(400)
      .send({ error: "Nft Historical Record id not provided" });
  }
  console.log(id);

  let sql = "UPDATE nft_historical_records SET ";
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

  res.send({ message: "Record added" });
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send({ error: "Record id not provided" });
  }

  // Open Connection
  if (!connection.connect()) {
    res.send({ message: "Connection failed" });
    return;
  }
  connection.execute("DELETE FROM nft_historical_records WHERE id = ?", [id]);
  connection.close();

  res.send({ message: "Record deleted" });
});

export default router;
