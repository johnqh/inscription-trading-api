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
    let response: Deploy[] = await selectDeploy();

    if (response.length === 0) {
        return res.status(404).send({ error: 'No deploy information available.' });
    }

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

function selectDeploy(): Promise<Deploy[]> {
    return new Promise((resolve, reject) => {
        connection.query<Deploy[]>(
            "SELECT * FROM deploy",
            (err, res) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(res);
                }
            });
    });
}

async function addDeploy(deploy: Deploy): Promise<void> {
    connection.execute(
        `INSERT INTO deploy (tick, max, lim, block) VALUES (?, ?, ?, ?)`,
        [deploy.tick, deploy.max, deploy.lim, deploy.block],
        err => {
            if (err) {
                console.error(err);
            }
        }
    )
}
