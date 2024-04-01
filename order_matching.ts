import {
  MinPriorityQueue,
  MaxPriorityQueue,
  IGetCompareValue,
} from "@datastructures-js/priority-queue";

import axios from "axios";
import sendBTC from "./send_btc";

const numbersQueue = new MinPriorityQueue<number>();

interface Order {
  address: string;
  size: number;
  price: number;
}

const getOrderValue: IGetCompareValue<Order> = (Order) => Order.price;

async function main() {
  // Buy/ Sell Queue
  const BuyQueue = new MaxPriorityQueue<Order>(getOrderValue);
  const SellQueue = new MaxPriorityQueue<Order>(getOrderValue);

  // Load Orders from Database
  const response = await axios.get("http://localhost:3000/orders");
  const orders = response.data;

  // Populating the Queue
  for (const order of orders) {
    if (order.side === 0) {
      SellQueue.push({
        address: order.address,
        size: order.amt,
        price: order.price,
      });
    } else {
      BuyQueue.push({
        address: order.address,
        size: order.amt,
        price: order.price,
      });
    }
  }

  let asksPending: Order[] = []; // All the Aks that were Too Expensive so Put Aside for Now
  let asksConsumed: Order[] = []; // Storing the Transfer that We Need to Fulfill this Order

  while (!BuyQueue.isEmpty()) {
    const bid = BuyQueue.pop();

    // Current Size of the Amount of Tokens to Give to Bidder (Amt)
    let remainingTokens = bid.size;

    while (!SellQueue.isEmpty() && remainingTokens > 0) {
      const ask = SellQueue.front();

      if (ask.price > bid.price) {
        asksPending.push(SellQueue.pop());
      } else if (ask.size <= remainingTokens) {
        // Asks Doesn't Have Enough Tokens to Fulfill the Order
        remainingTokens -= ask.size;
        asksConsumed.push(SellQueue.pop()); // Storing Address & Amount So What Address to Send & How Much to Send
      } else {
        // Asks Has More than Enough Tokens
        ask.size -= remainingTokens;

        // How Big The Order was & Needed to Create a NEw Order Because we are not using the whole ask so its not the same info
        asksConsumed.push({
          address: ask.address,
          size: remainingTokens,
          price: ask.price,
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
      // TODO: Perform Transfers
      try {
        for (let sender of asksConsumed)
        {
          let amt = sender.price * sender.size;
            sendBTC(sender.address, amt);
        }
      } catch(e) {
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
