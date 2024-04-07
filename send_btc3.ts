// Import libraries
const bitcore = require("bitcore-lib");
const axios = require("axios");
import dotenv from "dotenv";
dotenv.config();

// tb1qeuzkvusgyxekclxwzjl49n9g30ankw60ly2l5m
// tb1q74fe9eutw0h4ej2q0d6aw7veadrfc545d7f53k

const privateKey: string = process.env.WALLET_PRIVATE_KEY || ''; 

let walletA = {
  addr: "tb1qeuzkvusgyxekclxwzjl49n9g30ankw60ly2l5m",
  privateKey: privateKey,
};

let walletB = {
  addr: "tb1q74fe9eutw0h4ej2q0d6aw7veadrfc545d7f53k",
};

// Send Bitcoin
function sendBTC(
  fromAddress: string,
  toAddress: string,
  privateKey: string,
  amount: number
) {
  // 2. Connect to a node
  const network = "BTCTEST";

  // Get the UTXOs (unspent transaction outputs) from the sender wallet, that will be used as input for the transaction
  axios
    .get(
      `https://api.blockcypher.com/v1/btc/test3/addrs/${fromAddress}?unspentOnly=true&includeScript=true`
    )
    .then((firstResponse: any) => {
      let inputs: any = [];
      let utxos = firstResponse.data.txrefs;

      let totalAmountAvailable = 0; // To evaluate, if we have enough funds to send the transaction
      let inputCount = 0; // To later calculate the transaction size (fees)

      // Loop through the UTXOs we Fetched
      for (const element of utxos) {
        let utxo: any = {}; // Generate utxo object to specify input for transaction

        utxo.satoshis = element.value; // 100 million satoshi = 1 Bitcoin

        if (utxo.satoshis !== 10963) {
          console.log("EXCLUDING: " + utxo.satoshis);
          continue;
        }

        console.log("INCLUDING: " + utxo.satoshis);
        utxo.script = element.script; // Script contains basic instructions for the transaction (a receipt address and a valid private key are present)
        utxo.address = firstResponse.data.address; // Address of the sender wallet
        utxo.txid = element.tx_hash; // Transaction ID of the transaction behind the utxo
        utxo.outputIndex = element.tx_output_n; // To identify the utxo

        totalAmountAvailable += utxo.satoshis; // increase the available funds by the amount within the utxo
        inputCount += 1;

        inputs.push(utxo);
        break;
      }

      // 2. Generate transaction
      const transaction = new bitcore.Transaction();
      const satoshiToSend = amount; // 100 million satoshi = 1 Bitcoin
      let outputCount = 2; // one for recipient, one for change

      // calculate fee for the Miners
      const transactionSize =
        inputCount * 180 + outputCount * 34 + 10 - inputCount;
      let fee = transactionSize * 30; // 33 satoshi per byte

      console.log("MINER'S FEE: " + fee);

      if (totalAmountAvailable - satoshiToSend - fee < 0) {
        // Check, if funds are sufficient to send transaction
        throw new Error("Insufficient funds");
      }

      // Specify transaction
      transaction.from(inputs);
      transaction.to(toAddress, satoshiToSend); // Where to Send the Transaction
      transaction.change(fromAddress); // The change of the Transaction
      transaction.fee(Math.round(fee)); // Miner Fees
      transaction.sign(privateKey); // Signature

      // Convert Transaction to a Stream of Bytes to Transfer through Network (Security Purposes)
      const serializedTransaction = transaction.serialize();
      console.log("SERIALIZED: " + serializedTransaction);

      // broadcast transaction
        // axios({
        //   method: "POST",
        //   url: `https://blockstream.info/testnet/api/tx`,
        //   data: { tx: serializedTransaction },
        // }).then((result: any) => {
        //   console.log(result.data); // log the result
        // });
    });
}
console.log(typeof walletA.privateKey);
sendBTC(walletA.addr, walletB.addr, walletA.privateKey, 546);
export default sendBTC;

/*
-------------------- References --------------------
Tutorial - https://github.com/janlucasandmann/bitcoinNodeJSTutorial/blob/main/btctr.js
BlockCypher API - https://www.blockcypher.com/dev/bitcoin/#push-raw-transaction-endpoint
*/
