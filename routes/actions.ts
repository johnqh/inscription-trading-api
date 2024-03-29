import express, { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import connection from '../connection';

interface Action extends RowDataPacket {
	address: string,
	tick: string,
	action: number,
	amt: number,
	destination?: string,
	block: number
}

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {

	// check query string
	let addr = req.query.address;
	let tick = req.query.tick;

	// response
	let query: string = "SELECT * FROM actions";
	let conditions: String[] = [];
	let params: String[] = [];

	// modify query based on request parameters
	if (addr) {
		conditions.push('address = ?');
		params.push(`${addr}`);
	}

	if (tick) {
		conditions.push('tick = ?');
		params.push(`${tick}`);
	}

	if (conditions.length) {
		query += ' WHERE ' + conditions.join(' AND ');
	}

	let response: Action[] = await connection.select<Action>(query, params);
	res.send(response);
});

router.post('/', async (req: Request, res: Response) => {
	const action: Action = req.body;

	// Validation
	if (typeof action.tick !== 'string' ||
		typeof action.address !== 'string' ||
		typeof action.action !== 'number' ||
		typeof action.amt !== 'number' ||
		typeof action.block !== 'number' ||
		(action.destination && typeof action.destination !== 'string')) {
		return res.status(400).send({ error: 'Invalid input.' });
	}

	await addAction(action);

	res.send({ message: 'Action added successfully.', request: action });
})

export default router;

async function addAction(request: Action): Promise<void> {
	// Allow nullable destination
	if (request.destination) {
		connection.conn.execute(
			`INSERT INTO actions (address, tick, action, amt, destination, block) VALUES (?, ?, ?, ?, ?, ?)`,
			[request.address, request.tick, request.action, request.amt, request.destination, request.block],
			err => {
				if (err) {
					console.error(err);
				}
			}
		);
	} else {
		connection.conn.execute(
			`INSERT INTO actions (address, tick, action, amt, block) VALUES (?, ?, ?, ?, ?)`,
			[request.address, request.tick, request.action, request.amt, request.block],
			err => {
				if (err) {
					console.error(err);
				}
			}
		);
	}
}
