const bitcoin = require("bitcoinjs-lib");
const fetch = require("node-fetch");
const fs = require("fs");

// Your network (testnet in this case)
const network = bitcoin.networks.testnet;

// Load your private key (WIF)
const privateKeyWIF = fs.readFileSync("./key.txt").toString(); // Replace with your private key
const keyPair = bitcoin.ECPair.fromWIF(privateKeyWIF, network);
const { address } = bitcoin.payments.p2wpkh({
  pubkey: keyPair.publicKey,
  network,
});

async function createTransaction() {
  // Fetch UTXOs (Unspent Transaction Outputs) for your address
  const utxosResponse = await fetch(
    `https://api.blockcypher.com/v1/btc/test3/addrs/${address}?unspentOnly=true`
  );
  const utxosData = await utxosResponse.json();

  // Create a transaction builder
  const txb = new bitcoin.TransactionBuilder(network);

  // Sum of available funds
  let totalUtxoValue = 0;

  // Add inputs from UTXOs
  utxosData.txrefs.forEach((txref: any, index: any) => {
    txb.addInput(txref.tx_hash, txref.tx_output_n);
    totalUtxoValue += txref.value;
  });

  // Destination address and amount to send (in satoshis)
  const targetAddress = "tb1q74fe9eutw0h4ej2q0d6aw7veadrfc545d7f53k"; // Replace with destination address
  const amountToSend = 10; // Replace with amount in satoshis

  // Calculate fee (example: 1 satoshi per byte)
  const fee = txb.buildIncomplete().byteLength() * 1;
  console.log("FEE: " + fee);

  // Add output
  txb.addOutput(targetAddress, amountToSend);

  // Send change back to self, if any
  const change = totalUtxoValue - amountToSend - fee;
  if (change > 0) {
    txb.addOutput(address, change);
  }

  // Sign each input
  for (let i = 0; i < txb.__inputs.length; i++) {
    txb.sign(i, keyPair);
  }

  // Build the transaction and get the hexadecimal representation
  const tx = txb.build();
  const txHex = tx.toHex();

  return txHex;
}

async function broadcastTransaction() {
  const txHex = await createTransaction();

  // Broadcast the transaction
  const broadcastResponse = await fetch(
    "https://api.blockcypher.com/v1/btc/test3/txs/push",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tx: txHex }),
    }
  );

  const broadcastData = await broadcastResponse.json();
  console.log(broadcastData);
}

broadcastTransaction();
