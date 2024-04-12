import express, { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import connection from '../connection';

interface HistoricalRecord extends RowDataPacket {
	id: number,
	address: string,
	action: string,
	token_size: number,
	token: string,
	price?: number,
	fee?: number,
	btc_amount?: number,
	datetime: string
}

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
	// check query string
	let addr = req.query.address;

	let query: string = "SELECT * FROM historical_records";
	const params: String[] = [];

	if (addr) {
		query += " WHERE address = ?";
		params.push(`${addr}`);
	}

	// Open Connection
	connection.connect();

	const rows: HistoricalRecord[] = await connection.select<HistoricalRecord>(query, params);

	connection.close();

	res.send(rows);
});

router.post('/', async (req: Request, res: Response) => {
  const {
    address,
    action,
    token_size,
    token,
    price,
    fee,
    btc_amount,
    datetime,
  } = req.body;

  // handle optional fields
  let query: string =
    "INSERT INTO historical_records (address, action, token_size, token, datetime";
  let values = "VALUES (?, ?, ?, ?, ?";
  let params: any[] = [address, action, token_size, token, datetime];

  if (price) {
    query += ", price";
    values += ", ?";
    params.push(price);
  }

  if (fee) {
    query += ", fee";
    values += ", ?";
    params.push(fee);
  }

  if (btc_amount) {
    query += ", btc_amount";
    values += ", ?";
    params.push(btc_amount);
  }

  query += ") " + values + ")";

  // Open Connection
  connection.connect();

  connection.execute(query, params);

  connection.close();

  res.send({ message: "Record added" });
});

router.put('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send({ error: "Record id not provided" });
  }

  const {
    address,
    action,
    token_size,
    token,
    price,
    fee,
    btc_amount,
    datetime,
  } = req.body;
  let query: string =
    "UPDATE orders SET address = ?, action = ?, token_size = ?, token = ?, price = ?, fee = ?, btc_amount = ?, datetime = ? WHERE id = ?";

  // Open Connection
  connection.connect();
  connection.execute(query, [
    address,
    action,
    token_size,
    token,
    price,
    fee,
    btc_amount,
    datetime,
  ]);
  connection.close();

  res.send({ message: "Record added" });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!id) {
    return res.status(400).send({ error: "Record id not provided" });
  }

  // Open Connection
  connection.connect();
  connection.execute("DELETE FROM historical_records WHERE id = ?", [id]);
  connection.close();

  res.send({ message: "Record deleted" });
});

export default router;
