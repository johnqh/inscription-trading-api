import express, { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import connection from '../connection';

interface Holding extends RowDataPacket {
    tick: string,
    address: string,
    amt: number,
    updated_at_block: number
}

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    let addr = req.query.address;
    let tick = req.query.tick;

    let query: string = 'SELECT * FROM holdings';
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

    let response: Holding[] = await selectHoldings(query, params);
    res.send(response);
})

router.post('/', async (req: Request, res: Response) => {
    const holding: Holding = req.body;

    // Validation
    if (typeof holding.tick !== 'string' ||
        typeof holding.address !== 'string' ||
        typeof holding.amt !== 'number' ||
        typeof holding.updated_at_block !== 'number') {
        return res.status(400).send({ error: 'Invalid input.' });
    }

    await updateHolding(holding);

    res.send({ message: 'Holding updated successfully.', holding });
})

export default router;

function selectHoldings(query: string, params: String[]): Promise<Holding[]> {
    return new Promise((resolve, reject) => {
        connection.query<Holding[]>(query, params, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

async function updateHolding(holding: Holding): Promise<void> {
    // Attempt to update the record if it exists
    connection.execute<ResultSetHeader>(
        `UPDATE holdings SET amt = ?, updated_at_block = ? WHERE tick = ? AND address = ?`,
        [holding.amt, holding.updated_at_block, holding.tick, holding.address],
        (err, res) => {
            if (err) {
                console.error(err);
                return;
            }
            // If no rows were affected by the update, insert a new record
            if (res.affectedRows === 0) {
                connection.execute(
                    `INSERT INTO holdings (tick, address, amt, updated_at_block) VALUES (?, ?, ?, ?)`,
                    [holding.tick, holding.address, holding.amt, holding.updated_at_block],
                    err => {
                        if (err) {
                            console.error(err);
                        }
                    }
                );
            }
        }
    );

}
