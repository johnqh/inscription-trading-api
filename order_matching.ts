import {
  MinPriorityQueue,
  MaxPriorityQueue,
  IGetCompareValue,
} from "@datastructures-js/priority-queue";
import moment from "moment";

import axios from "axios";
import completeOrder from "./fulfill_order";
import { Order } from "./routes/orders";

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
  order?: Order; // Optional
}

const getHistoricalRecordValue: IGetCompareValue<HistoricalRecord> = (
  HistoricalRecord
) => HistoricalRecord.price;

async function orderMatching() {
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
    // Order is Fulfilled Thus Don't Want to Process it
    if (order.fulfilled == 1) {
      continue;
    }

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
        order: order,
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
        order: order,
      });
    }
  }

  let asksPending: HistoricalRecord[] = []; // All the Aks that were Too Expensive so Put Aside for Now
  let asksConsumed: HistoricalRecord[] = []; // Storing the Transfer that We Need to Fulfill this Order

  console.log("BUY");
  console.log(BuyQueue.toArray());
  console.log("SELL");
  console.log(SellQueue.toArray());

  while (!BuyQueue.isEmpty()) {
    const bid = BuyQueue.pop();

    // Current Size of the Amount of Tokens to Give to Bidder (Amt)
    let remainingTokens = bid.token_size;
    const bidOrder = bid.order;
    let txid = "";

    if (bidOrder && bidOrder.txid) {
      txid = bidOrder.txid;
    }

    delete bid.order; // delete order because it doesn't exist in the Historical Record

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

        // How Big The Order was & Needed to Create a New Order Because we are not using the whole ask so its not the same info
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

      // Perform Transfers
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

        // Looping through the Seller's the Buyer Consumed
        for (const ask of asksConsumed) {
          let askOrder = ask.order;
          delete ask.order; // Delete from Historical Records

          // Populate Historical Record Table for Seller(s)
          await axios.post(`${apiPrefix}/historical_records`, ask);

          // Edge Case for Last Seller whose's Tokens were Not All Used Up
          if (askOrder) {
            if (ask.token_size < askOrder.amt) {
              // Update Amount of Last Order if It was Not All used up by the Buyer
              await axios.put(`${apiPrefix}/orders/${askOrder.id}`, {
                amt: askOrder.amt - ask.token_size,
              });
            } else {
              // Update Fulfilled to True to Avoid Reprcossing old Orders
              await axios.put(`${apiPrefix}/orders/${askOrder.id}`, {
                fulfilled: 1,
              });
            }
          }
        }

        // Populate Historical Record Table for Buyer
        await axios.post(`${apiPrefix}/historical_records`, bid);

        // Update Fulfilled to True to Avoid Reprcossing old Orders
        await axios.put(`${apiPrefix}/orders/${bidOrder ? bidOrder.id : ""}`, {
          fulfilled: 1,
        });
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

export default orderMatching;

/*
-------------------- References --------------------
Priority Queue - https://www.npmjs.com/package/@datastructures-js/priority-queue
*/
