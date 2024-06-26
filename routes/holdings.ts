import express, { Request, Response } from "express";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import axios from "axios";
import connection from "../connection";

interface Holding extends RowDataPacket {
  tick: string;
  address: string;
  amt: number;
  updated_at_block: number;
}

const router = express.Router();

// Get holdings from the UniSat API rather than the indexer
router.get("/", async (req: Request, res: Response) => {
  let addr = req.query.address;

  // Due to a change in design, address must always be provided
  if (!addr || addr == "undefined") {
    return res.status(400).send({ error: "Address not provided" });
  }

  let tick = req.query.tick;

  let data = await axios.get(
    `https://open-api-testnet.unisat.io/v1/indexer/address/${addr}/brc20/summary?start=0&limit=16`,
    { headers: { Authorization: `Bearer ${connection.apiKey}` } }
  );
  let output = data.data;

  // Handle error code -2003
  if (output.code == -2003) {
    return res
      .status(500)
      .send({ error: "API key exceeded quota, try again later" });
  }
  output = output.data;

  let height = output.height;

  // Format unisat output to holdings
  let out: Holding[] = output.detail.map((detail: any) => {
    return {
      tick: detail.ticker,
      address: addr,
      // Avail balance over overall balance since the value in
      // inscriptions can't be used
      amt: +detail.availableBalance,
      updated_at_block: height,
    };
  });

  // While there is a different API call for a particular tick, it doesn't
  // give the height, filter the general output instead
  if (tick) {
    out = out.filter((holding) => holding.tick == tick);
  }

  res.send(out);
});

// Get holdings from the UniSat API rather than the indexer
router.get("/nft", async (req: Request, res: Response) => {
  let addr = req.query.address;

  // Due to a change in design, address must always be provided
  if (!addr || addr == "undefined") {
    return res.status(400).send({ error: "Address not provided" });
  }

  let data = await axios.get(
    `https://open-api-testnet.unisat.io/v1/indexer/address/${addr}/inscription-utxo-data`,
    { headers: { Authorization: `Bearer ${connection.apiKey}` } }
  );

  let output = data.data;

  // Handle error code -2003
  if (output.code == -2003) {
    return res
      .status(500)
      .send({ error: "API key exceeded quota, try again later" });
  }

  output = output.data;

  let out: any[] = [];

  for (let utxo of output.utxo) {
    for (let inscription of utxo.inscriptions) {
      if (inscription.isBRC20) {
        continue;
      }
      out.push(inscription);
    }
  }

  res.send(out);
});

router.post("/", async (_req: Request, res: Response) => {
  // Since we are using the UniSat API for holdings, post is not needed anymore
  res.send({ message: "Request ignored" });
});

export default router;
