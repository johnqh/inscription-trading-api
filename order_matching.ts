import {
  MinPriorityQueue,
  MaxPriorityQueue,
  IGetCompareValue,
} from "@datastructures-js/priority-queue";
import moment from "moment";

import axios from "axios";
import {
  placeInscriptionOrder,
  completeOrder,
  checkStatus,
  fulfillOrder,
  sendBTC,
} from "./fulfill_order";
import { Order } from "./routes/orders";
import sleep from "sleep";

const apiPrefix = "http://localhost:3000";
const exchange_wallet = process.env.EXCHANGE_WALLET || "";

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
  let orders: Order[] = [];
  let txids: string[] = [];

  try {
    const restURL = `https://blockstream.info/testnet/api/address/${exchange_wallet}/utxo`;
    const res = await axios.get(restURL);
    txids = res.data.map((utxo: any) => utxo.txid);

    // Load Orders from Database
    const response = await axios.get(`${apiPrefix}/orders`);
    orders = response.data;
  } catch (e) {
    console.log(e);
    return;
  }

  // Buy/ Sell Queue
  const BuyQueue = new MaxPriorityQueue<HistoricalRecord>(
    getHistoricalRecordValue
  );
  const SellQueue = new MaxPriorityQueue<HistoricalRecord>(
    getHistoricalRecordValue
  );

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
    let buy_txid = "";

    if (bidOrder && bidOrder.txid) {
      buy_txid = bidOrder.txid;
    }

    // The Buyer's Payment is Not in the Exchange Wallet Yet (Transaction Not Confirmed)
    if (!buy_txid || !txids.includes(buy_txid)) {
      console.log("Not in the list");
      console.log(buy_txid);
      continue;
    }

    delete bid.order; // delete order because it doesn't exist in the Historical Record

    while (!SellQueue.isEmpty() && remainingTokens > 0) {
      const ask = SellQueue.front();

      if (ask.token !== bid.token) {
        continue;
      }

      const askOrder = ask.order;
      let ask_txid = "";

      if (askOrder && askOrder.txid) {
        ask_txid = askOrder.txid;
      }

      // The Seller's Inscription is Not in the Exchange Wallet Yet (Transaction Not Confirmed)
      if (!ask_txid || !txids.includes(ask_txid)) {
        continue;
      }

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
                amt: ask.token_size,
              });

              // Split Seller's Order into Two
              await axios.post(`${apiPrefix}/orders/${askOrder.id}`, {
                amt: askOrder.amt - ask.token_size,
                address: askOrder.addresss,
                tick: askOrder.tick,
                side: askOrder.side,
                price: askOrder.price,
                expiration: askOrder.expiration,
                expired: askOrder.expired,
                txid: askOrder.txid,
                fulfilled: 0,
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

        for (let seller of asksConsumed) {
          console.log("SENDING: " + seller.btc_amount);
          console.log(`${bid.address},
            ${seller.address},
            ${bid.token},
            ${String(seller.token_size)},
            ${buy_txid}`);

          // Update Match Fulfillment to Begin the Process of Fulfilling the Order
          await axios.post(`${apiPrefix}/match_fulfillment`, {
            buyer_order: bidOrder ? bidOrder.id : 0,
            seller_order: seller.order ? seller.order.id : 0,
            unisat_txid: null,
            unisat_order_id: null,
            fulfillment_txid: null,
          });
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

  // Create & Broadcast Transactions
  await processOngoingMatches(txids);
  await processNftOrders(txids);
}

// Creates & Broadcast Transactions for Orders that are Matched
async function processOngoingMatches(uxtos: string[]) {
  try {
    // Entire List of Previously Matched Orders
    const response = await axios.get(`${apiPrefix}/match_fulfillment`);
    const matches = response.data;

    // Looping through Each Match (Buyer & Seller)
    for (const match of matches) {
      // Order has Been Completed so Don't Bother Processing Again
      if (match.completed_order) {
        continue;
      }
      // Retrieving Buyer's Order Information
      let buyer_order = await axios.get(
        `${apiPrefix}/orders?id=${match.buyer_order}`
      )[0];

      // Retrieving Seller's Order Information
      let seller_order = await axios.get(
        `${apiPrefix}/orders?id=${match.seller_order}`
      )[0];

      // UniSat Order ID Used to Cehck on Inscription Status ONLY
      if (!match.unisat_order_id) {
        // No Order ID so Place Inscription Order
        const data = await placeInscriptionOrder(
          seller_order.tick,
          seller_order.amt
        );

        // UniSat Address we Pay for our Inscribe Transfer Order
        const unisat = data.payAddress;

        // Send Payment to UniSat
        const inscription_change_txid = await sendBTC(
          exchange_wallet,
          unisat,
          data.amount,
          buyer_order.txid
        );

        await axios.put(`${apiPrefix}/match_fulfillment/${match.id}`, {
          unisat_order_id: data.orderId,
          inscription_change_txid: inscription_change_txid,
        });
      } else if (!match.unisat_txid) {
        // TXID: UniSat ==> Exchange (Inscription)
        let txid = await checkStatus(match.unisat_order_id);

        if (txid) {
          await axios.put(`${apiPrefix}/match_fulfillment/${match.id}`, {
            unisat_txid: txid,
          });
        }
      } else if (!match.fulfillment_txid) {
        // Need Inscription & The Change to Pay Everybody (Buer & Seller)
        if (
          uxtos.includes(match.unisat_txid) &&
          uxtos.includes(match.inscription_change_txid)
        ) {
          let txid = await fulfillOrder(
            exchange_wallet,
            buyer_order.address,
            seller_order.address,
            match.unisat_txid,
            match.inscription_change_txid
          );

          // TXID of Entire Transaction (Exchange, Seller, Buyer)
          await axios.put(`${apiPrefix}/match_fulfillment/${match.id}`, {
            fulfillment_txid: txid,
          });
        }
      } else if (!match.completed_order) {
        const restURL = `https://blockstream.info/testnet/api/address/${buyer_order.address}/utxo`;
        const res = await axios.get(restURL);
        let txids = res.data.map((utxo: any) => utxo.txid);

        // Buyer has TXID in his Wallet Thus Transaction went Through
        if (txids.includes(match.fulfillment_txid)) {
          await axios.put(`${apiPrefix}/match_fulfillment/${match.id}`, {
            completed_order: 1,
          });
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
}

async function processNftOrders(uxtos: string[]) {
  try {
    const response = await axios.get(`${apiPrefix}/nft_orders`);
    const orders = response.data;

    for (const order of orders) {
      if (
        !order.seller_txid ||
        !uxtos.includes(order.seller_txid) ||
        !order.buyer_txid ||
        !uxtos.includes(order.buyer_txid)
      ) {
        continue;
      }

      if (!order.fulfilled) {
        // NFT -> Buyer, BTC -> Seller, 1% -> Exchange
        await fulfillOrder(
          exchange_wallet,
          order.buyer_address,
          order.seller_address,
          order.seller_txid,
          order.buyer_txid
        );

        await axios.put(`${apiPrefix}/nft_orders/${order.id}`, {
          fulfilled: 1,
        });
      } else if (order.fulfillment_txid && !order.completed_order) {
        const restURL = `https://blockstream.info/testnet/api/address/${order.buyer_address}/utxo`;
        const res = await axios.get(restURL);
        let txids = res.data.map((utxo: any) => utxo.txid);

        // Buyer has TXID in his Wallet Thus Transaction went Through
        if (txids.includes(order.fulfillment_txid)) {
          await axios.put(`${apiPrefix}/match_fulfillment/${order.id}`, {
            completed_order: 1,
          });
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
}

async function main() {
  let count = 0;

  while (true) {
    await orderMatching();
    count += 1;
    console.log(count);
    sleep.sleep(10);
  }
}

main();

/*
-------------------- References --------------------
Priority Queue - https://www.npmjs.com/package/@datastructures-js/priority-queue
*/
