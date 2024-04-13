import express, { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import connection from '../connection';

interface Deploy extends RowDataPacket {
    tick: string,
    max: number,
    lim: number,
    block: number
}

const router = express.Router();

router.get('/', async (_req: Request, res: Response) => {
    let response: Deploy[] = await connection.select<Deploy>("SELECT * FROM deploy", []);
    res.send(response);
})

router.post('/', async (req: Request, res: Response) => {
    const deploy: Deploy = req.body;

    // Validation
    if (typeof deploy.max !== 'number' ||
        typeof deploy.lim !== 'number' ||
        typeof deploy.block !== 'number' ||
        typeof deploy.tick !== 'string') {
        return res.status(400).send({ error: 'Invalid input.' });
    }

    await addDeploy(deploy);

    res.send({ message: 'Deploy token inserted successfully.', deploy });
})

export default router;

async function addDeploy(deploy: Deploy): Promise<void> {
    connection.conn.execute(
        `INSERT INTO deploy (tick, max, lim, block) VALUES (?, ?, ?, ?)`,
        [deploy.tick, deploy.max, deploy.lim, deploy.block],
        err => {
            if (err) {
                console.error(err);
            }
        }
    )
}
