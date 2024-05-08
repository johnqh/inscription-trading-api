import express, { Request, Response } from "express";
import connection from "../connection";
import axios from "axios";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  let data = await axios.get(
    `https://open-api-testnet.unisat.io/v1/indexer/brc20/list?start=0&limit=75`,
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

  res.send(output.detail);
});

router.post("/", async (req: Request, res: Response) => {
  // Since we are using the UniSat API for deploy, post is not needed anymore
  res.send({ message: "Request ignored" });
});

export default router;
