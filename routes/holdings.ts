import express, { Request, Response } from 'express';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import axios from 'axios';
import connection from '../connection';

interface Holding extends RowDataPacket {
    tick: string,
    address: string,
    amt: number,
    updated_at_block: number
}

const router = express.Router();

// Get holdings from the UniSat API rather than the indexer
router.get('/', async (req: Request, res: Response) => {
    let addr = req.query.address;

    // Due to a change in design, address must always be provided
    if (!addr) {
        return res.status(400).send({ error: "Address not provided" })
    }

    let tick = req.query.tick;

    let data = await axios.get(
        `https://open-api-testnet.unisat.io/v1/indexer/address/${addr}/brc20/summary?start=0&limit=100`,
        { headers: { 'Authorization': `Bearer ${connection.apiKey}` } }
    );
    let output = data.data.data;
    let height = output.height;

    // Format unisat output to holdings
    let out: Holding[] = output.detail.map(
        (detail: any) => {
            return {
                tick: detail.ticker,
                address: addr,
                // Avail balance over overall balance since the value in
                // inscriptions can't be used
                amt: detail.availableBalance,
                updated_at_block: height
            }
        }
    );

    // While there is a different API call for a particular tick, it doesn't
    // give the height, filter the general output instead
    if (tick) {
        out = out.filter((holding) => holding.tick == tick);
    }

    res.send(out);
})

router.post('/', async (_req: Request, res: Response) => {
    // Since we are using the UniSat API for holdings, post is not needed anymore
    res.send({ message: 'Request ignored' });
})

export default router;
