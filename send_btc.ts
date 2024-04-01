const bitcoin = require("bitcoinjs-lib");
const ECPairFactory = require("ecpair");
const ecc = require("tiny-secp256k1");
const CryptoAccount = require("send-crypto");
const fs = require("fs");

async function sendBTC(address: string, amount: number) {
  const network = bitcoin.networks.testnet;

  // Load your private key (WIF)
  const ECPair = ECPairFactory.ECPairFactory(ecc);
  const privateKeyWIF = fs.readFileSync("./key.txt").toString();
  console.log(privateKeyWIF);
  const keyPair = ECPair.fromWIF(privateKeyWIF, network);

  /* Load account from private key */
  //const privateKey = process.env.PRIVATE_KEY || CryptoAccount.newPrivateKey();
  const privateKey = keyPair.privateKey;
  console.log(privateKey);
  const account = new CryptoAccount(privateKey, { network: "testnet" });

  console.log(await account.address("BTC"));

  console.log(await account.getBalance("BTC"));
  console.log(
    await account.getBalance("BTC", {
      address: "tb1qeuzkvusgyxekclxwzjl49n9g30ankw60ly2l5m",
    })
  );

  const balance = await account.getBalance("BTC");
  console.log("Balance: " + balance);
  await account.send(
    address,
    amount,
    "BTC",
    {
      fee: 1,
    }
  );

  /*const txHash = await account
            .send("bc1q...", 0.01, "BTC")
            .on("transactionHash", console.log)
            .on("confirmation", console.log);*/

  console.log(await account.getBalance("BTC"));
  console.log(
    await account.getBalance("BTC", {
      address: "tb1qeuzkvusgyxekclxwzjl49n9g30ankw60ly2l5m",
    })
  );
}

export default sendBTC;

/*
https://stackoverflow.com/questions/77190806/how-to-send-bitcoin-btc-using-send-crypto-using-wif-key-in-node-js
*/
