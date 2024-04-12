import orderMatching from "./order_matching";
import axios from "axios";
orderMatching();

function main() {
  axios.put("http://localhost:3000/orders/1", {
    fulfilled: 0,
  });
}

// main();
