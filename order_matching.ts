import {
  MinPriorityQueue,
  MaxPriorityQueue,
  IGetCompareValue,
} from "@datastructures-js/priority-queue";
import moment from "moment";

import axios from "axios";
import completeOrder from "./fulfill_order";

const apiPrefix = "http://localhost:3000";

const numbersQueue = new MinPriorityQueue<number>();

interface HistoricalRecord {
  address: string;
  price: number;
  action: string;
  token_size: number;
  token: string;
  fee?: number;
  btc_amount?: number;
  datetime: string;
  txid?: string; // optional
}

const getHistoricalRecordValue: IGetCompareValue<HistoricalRecord> = (
  HistoricalRecord
) => HistoricalRecord.price;

async function main() {
  // Buy/ Sell Queue
  const BuyQueue = new MaxPriorityQueue<HistoricalRecord>(
    getHistoricalRecordValue
  );
  const SellQueue = new MaxPriorityQueue<HistoricalRecord>(
    getHistoricalRecordValue
  );

  // Load Orders from Database
  const response = await axios.get(`${apiPrefix}/orders`);
  const orders = response.data;

  // Populating the Queue
  for (const order of orders) {
    if (order.side === 0) {
      SellQueue.push({
        address: order.address,
        price: order.price,
        action: "Sell",
        token_size: order.amt,
        token: order.tick,
        fee: order.price * order.amt * 0.01,
        btc_amount: order.price * order.amt,
        datetime: moment().format("YYYY-MM-DD HH:mm:ss"),
      });
    } else {
      BuyQueue.push({
        address: order.address,
        price: order.price,
        action: "Buy",
        token_size: order.amt,
        token: order.tick,
        fee: order.price * order.amt * 0.01,
        btc_amount: order.price * order.amt,
        datetime: moment().format("YYYY-MM-DD HH:mm:ss"),
        txid: order.txid,
      });
    }
  }

  let asksPending: HistoricalRecord[] = []; // All the Aks that were Too Expensive so Put Aside for Now
  let asksConsumed: HistoricalRecord[] = []; // Storing the Transfer that We Need to Fulfill this Order

  while (!BuyQueue.isEmpty()) {
    const bid = BuyQueue.pop();

    // Current Size of the Amount of Tokens to Give to Bidder (Amt)
    let remainingTokens = bid.token_size;
    const txid = bid.txid || "";
    delete bid.txid; // delete from historical record

    while (!SellQueue.isEmpty() && remainingTokens > 0) {
      const ask = SellQueue.front();

      if (ask.price > bid.price) {
        asksPending.push(SellQueue.pop());
      } else if (ask.token_size <= remainingTokens) {
        // Asks Doesn't Have Enough Tokens to Fulfill the Order
        remainingTokens -= ask.token_size;
        asksConsumed.push(SellQueue.pop()); // Storing Address & Amount So What Address to Send & How Much to Send
      } else {
        // Asks Has More than Enough Tokens
        ask.token_size -= remainingTokens;

        // How Big The Order was & Needed to Create a NEw Order Because we are not using the whole ask so its not the same info
        asksConsumed.push({
          address: ask.address,
          token_size: remainingTokens,
          price: ask.price,
          action: "Sell",
          token: ask.token,
          fee: ask.fee,
          btc_amount: ask.price * remainingTokens,
          datetime: ask.datetime,
        });
        remainingTokens = 0;
      }
    }

    // Didn't Fulfill the Order
    if (remainingTokens > 0) {
      // Putting the Asks back in the Sell Queue
      for (const ask of asksConsumed) {
        SellQueue.push(ask);
      }
    } else {
      // Did Fulfill the Order

      for (const ask of asksConsumed) {
        // Populate Historical Record Table for Seller(s)
        // axios.post(`${apiPrefix}/historical_records`, ask);
      }

      // Populate Historical Record Table for Buyer
      // axios.post(`${apiPrefix}/historical_records`, bid);

      // TODO: Perform Transfers
      try {
        for (let seller of asksConsumed) {
          console.log("SENDING: " + seller.btc_amount);
          console.log(`${bid.address},
            ${seller.address},
            ${bid.token},
            ${String(seller.token_size)},
            ${txid}`);
          completeOrder(
            bid.address,
            seller.address,
            bid.token,
            String(seller.token_size),
            txid
          );
        }
      } catch (e) {
        console.log(e);
      }
    }

    console.log("-------Asks Consumed------------");
    console.log(asksConsumed);
    asksConsumed = [];
  }

  // Putting the Asks that were TOO Expensive Back in the Sell Queue
  for (const ask of asksPending) {
    SellQueue.push(ask);
  }

  console.log("----------Sell Queue------------");
  console.log(SellQueue.toArray());

  console.log("-------Asks Pending------------");
  console.log(asksPending);
  asksPending = [];
}

main();

/*
-------------------- References --------------------
Priority Queue - https://www.npmjs.com/package/@datastructures-js/priority-queue
*/
