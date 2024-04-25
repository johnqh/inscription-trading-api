require("dotenv").config();

import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { toXOnly } from "bitcoinjs-lib/src/psbt/bip371";
import sleep from "sleep";

const axios = require("axios").default;
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

// ------------------------------ Set Up Testnet Environment ------------------------------
const env = {
  ["development"]: {
    network: bitcoin.networks.testnet,
    blockStreamApi: "https://blockstream.info/testnet/api",
    explorer: "https://live.blockcypher.com/btc-testnet/tx",
  },
};

const { network, blockStreamApi, explorer } = env["development"];

// ------------------------------ Auxiliary Functions ------------------------------
/**
 * Prepare Wallet from a Wallet Import Format (WIF) Private Key
 * Each Network -> Each Address has own Private Key.
 */
export const initKeyPair = (WIF = process.env.WALLET_PRIVATE_KEY) => {
  if (!WIF) throw new Error("WALLET_PRIVATE_KEY is not set");
  // Decode WIF Private Key
  const keyPair = ECPair.fromWIF(WIF, network);
  return {
    keyPair,
    publicKey: keyPair.publicKey,
  };
};

// Native Segwit P2WPKH, bech32 address type with 42 chars. Start with tb1q or bc1q
// Ex: tb1q2fzh9f7ss8eu56fnv2zhr56a0wd3g64xp7d4xk
export const getNativeSegwitP2WPKH = (publicKeyBuffer: Buffer) => {
  return bitcoin.payments.p2wpkh({
    pubkey: publicKeyBuffer,
    network: network,
  });
};

// P2PKH type with 34 chars
// Ex: mo1xu79z1354YicBa5EXwMh7HrCAfRdPSW
export const getLegacyP2PKH = (publicKeyBuffer: Buffer) => {
  return bitcoin.payments.p2pkh({ pubkey: publicKeyBuffer, network: network });
};

// Nested Segwit P2SH(P2WPKH) with 35 chars
// Ex: 2N2EUQ12PhPr9Q7UKdp4xSReKgcVGUSUaYp
export const getNestedSegwitP2SH_P2WPKH = (publicKeyBuffer: Buffer) => {
  return bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
      network: network,
    }),
    network: network,
  });
};

// Taproot P2TR with 62 chars. Start with tb1p or bc1p
// Ex: tb1pmamsssqlv0j7dda8g04phcsn0qzndy6kff4hq293e85drju0f7sq5uzedx
export const getTaprootP2TR = (
  keyPair: bitcoin.Signer
): { payment: any; signer: any } => {
  function tweakSigner(signer: bitcoin.Signer, opts: any = {}): bitcoin.Signer {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion,@typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let privateKey: Uint8Array | undefined = signer.privateKey!;
    if (!privateKey)
      throw new Error("Private key is required for tweaking signer!");

    if (signer.publicKey[0] === 3) privateKey = ecc.privateNegate(privateKey);

    function tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
      return bitcoin.crypto.taggedHash(
        "TapTweak",
        Buffer.concat(h ? [pubKey, h] : [pubKey])
      );
    }

    const tweakedPrivateKey = ecc.privateAdd(
      privateKey,
      tapTweakHash(toXOnly(signer.publicKey), opts.tweakHash)
    );

    if (!tweakedPrivateKey) throw new Error("Invalid tweaked private key!");

    return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
      network: opts.network,
    });
  }

  // Tweak the original keypair
  const signer = tweakSigner(keyPair, { network });
  // Generate an address from the tweaked public key
  return {
    payment: bitcoin.payments.p2tr({
      pubkey: toXOnly(signer.publicKey),
      network,
    }),
    signer,
  };
};

/**
 * Support 4 address types: Native Segwit P2WPKH, Nested Segwit P2SH(P2WPKH), Legacy P2PKH, Taproot P2TR
 * Ex: await sendBitcoin('tb1q2fzh9f7ss8eu56fnv2zhr56a0wd3g64xp7d4xk', 'mo1xu79z1354YicBa5EXwMh7HrCAfRdPSW', 1000);
 */

// Creates and Brodcasts a Bitcoin Transaction: Sends BTC
export const sendBTC = async (
  exchange: string,
  to: string,
  amount: number,
  utxo_txid: string,
  feeRate = 30,
  maxFeeRate = 30
) => {
  // ------------------------------ Auxiliary Functions ------------------------------
  const { keyPair } = initKeyPair();

  // --------------- Auxiliary Functions: Address ---------------

  // Detect Address Type: Their are 4 Adddress Types
  enum AddressType {
    NATIVE_SEGWIT_P2WPKH = "Native Segwit P2WPKH",
    NESTED_SEGWIT_P2SH_P2PKH = "Nested Segwit P2SH_P2PKH",
    TAPROOT_P2TR = "Taproot P2TR",
    LEGACY_P2PKH = "Legacy P2PKH",
  }
  const detectAddressType = (address: string): AddressType => {
    if (address.startsWith("tb1q") || address.startsWith("bc1q"))
      return AddressType.NATIVE_SEGWIT_P2WPKH;
    if (address.startsWith("tb1p") || address.startsWith("bc1p"))
      return AddressType.TAPROOT_P2TR;
    if (address.length > 34) return AddressType.NESTED_SEGWIT_P2SH_P2PKH;
    return AddressType.LEGACY_P2PKH;
  };

  // --------------- Auxiliary Functions: Address Type - Sign Payment ---------------

  // This Config will be Set Based on Address Type
  let signer: bitcoin.Signer,
    payment: bitcoin.Payment,
    sender: string | undefined;

  const addressType = detectAddressType(exchange);
  switch (addressType) {
    // ----- Native Segwit P2WPKH -----
    case AddressType.NATIVE_SEGWIT_P2WPKH: {
      signer = keyPair;
      payment = getNativeSegwitP2WPKH(keyPair.publicKey);
      sender = payment.address;
      break;
    }
    // ----- Nested Segwit P2SH(P2WPKH) -----
    case AddressType.NESTED_SEGWIT_P2SH_P2PKH: {
      signer = keyPair;
      payment = getNestedSegwitP2SH_P2WPKH(keyPair.publicKey);
      sender = payment.address;
      break;
    }
    // ----- Legacy P2PKH -----
    case AddressType.LEGACY_P2PKH: {
      signer = keyPair;
      payment = getLegacyP2PKH(keyPair.publicKey);
      sender = payment.address;
      break;
    }
    // ----- Taproot P2TR -----
    case AddressType.TAPROOT_P2TR: {
      const taprootP2TR = getTaprootP2TR(keyPair);
      signer = taprootP2TR.signer;
      payment = taprootP2TR.payment;
      sender = payment.address;
      break;
    }
    default:
      throw new Error("Invalid address type");
  }
  if (sender?.toLowerCase() !== exchange.toLowerCase()) {
    throw new Error(
      `The signer does not match with sender address type. Decoded address is ${sender} while input is ${exchange}`
    );
  }

  // --------------- Auxiliary Functions: UTXO ---------------
  interface IUTXO {
    txid: string;
    vout: number;
    value: number;
  }

  const getUTXO = async (address: string): Promise<IUTXO[]> => {
    const restURL = `${blockStreamApi}/address/${address}/utxo`;
    const res = await axios.get(restURL);
    return res.data;
  };

  const getTxHex = async (txId: string): Promise<string> => {
    const restURL = `${blockStreamApi}/tx/${txId}/hex`;
    const res = await axios.get(restURL);
    return res.data;
  };

  // --------------- Auxiliary Function: Brodcast Transaction on Bitcoin Blockchain ---------------
  const broadcast = async (txHex: string) => {
    try {
      console.log("Broadcasting tx:", txHex);
      const res = await axios.post(`${blockStreamApi}/tx`, txHex);
      return res.data;
    } catch (e: any) {
      console.error("Broadcast tx error:", e.message, e.response?.data);
    }
  };

  const utxos = await getUTXO(sender);

  if (!utxos.length) throw new Error("No UTXO found");

  const totalUnspent = utxos.reduce((sum, { value }) => sum + value, 0);

  // --------------- Auxiliary Function: Build Transaction ---------------
  const estimateFee = (
    signer: any,
    psbt: any,
    sender: string,
    remainBal: number,
    feeRate: number /* satoshis per byte */
  ) => {
    const tPsbt = psbt.clone();
    tPsbt.addOutput({ address: to, value: remainBal }); // btc_utxo
    tPsbt.signAllInputs(signer);
    tPsbt.finalizeAllInputs();
    const estTx = tPsbt.extractTransaction(true);
    const bytes = estTx.byteLength();
    const vBytes = estTx.virtualSize();
    const finalFee = vBytes * feeRate + 1; // Add 1 satoshi to pass min relay fee not met

    return { bytes, vBytes, finalFee };
  };

  const psbt = new bitcoin.Psbt({ network, maximumFeeRate: maxFeeRate });
  const inputs: any[] = [];
  let totalInput = 0;

  let utxo_amount: number = 0;

  for (const utxo of utxos) {
    // BTC UXTO (Seller, Covers both Miner's Fee)
    if (utxo.txid !== utxo_txid) {
      console.log("EXCLUDING: " + utxo.value);
      continue;
    }

    totalInput += utxo.value;

    console.log("INCLUDING: " + utxo.value);

    type Input = { [key: string]: any };

    const input: Input = { hash: utxo.txid, index: utxo.vout };

    if (addressType != AddressType.LEGACY_P2PKH) {
      // Add witnessUtxo data
      input["witnessUtxo"] = { script: payment.output!, value: utxo.value };

      if (addressType == AddressType.TAPROOT_P2TR) {
        input["tapInternalKey"] = toXOnly(keyPair.publicKey);
      }

      if (addressType == AddressType.NESTED_SEGWIT_P2SH_P2PKH) {
        input["redeemScript"] = payment.redeem!.output;
      }
    } else {
      const hex = await getTxHex(utxo.txid);
      input["nonWitnessUtxo"] = Buffer.from(hex, "hex");
    }

    inputs.push(input);
  }

  // UTXOs from Exchange's Wallet to Buyer's Wallet
  psbt.addInputs(inputs);
  psbt.addOutput({ address: to, value: amount });

  // Validate final output with fee
  let remainBal = totalInput - amount;
  console.log("REMAINING BALANCE: " + remainBal);

  // Miner's Fee
  const { bytes, vBytes, finalFee } = estimateFee(
    signer,
    psbt,
    sender,
    remainBal,
    feeRate
  );

  console.log(
    `Size ${bytes}, vSize ${vBytes}. Total unspent ${totalUnspent}, FeeRate ${feeRate}, MaxFeeRate ${maxFeeRate}, Fee ${finalFee}`
  );

  // Change of the Transaction goes to the Exchange Wallet which is the 1% of the Exchange Fee
  psbt.addOutput({ address: sender, value: remainBal - finalFee });

  // Sign Transaction
  psbt.signAllInputs(signer);
  psbt.finalizeAllInputs();

  console.log("inputs: " + psbt.txInputs.map((input) => input.hash));
  console.log("output: " + psbt.txOutputs.map((output) => output.value));

  // Broadcast Transaction
  const tx = psbt.extractTransaction(true);
  const txId = await broadcast(tx.toHex());
  txId && console.log(`Transaction successfully broadcasted! TxId is ${txId}`);
  return txId;
};

// Creates and Brodcasts a Bitcoin Transaction: Sends Inscription to Buyer, BTC to Seller, and 1% to Exchange
const fulfillOrder = async (
  exchange: string,
  buyer: string,
  seller: string,
  brc_utxo_txid: string,
  btc_utxo_txid: string,
  feeRate = 30,
  maxFeeRate = 30
) => {
  // ------------------------------ Auxiliary Functions ------------------------------
  const { keyPair } = initKeyPair();

  // --------------- Auxiliary Functions: Address ---------------

  // Detect Address Type: Their are 4 Adddress Types
  enum AddressType {
    NATIVE_SEGWIT_P2WPKH = "Native Segwit P2WPKH",
    NESTED_SEGWIT_P2SH_P2PKH = "Nested Segwit P2SH_P2PKH",
    TAPROOT_P2TR = "Taproot P2TR",
    LEGACY_P2PKH = "Legacy P2PKH",
  }
  const detectAddressType = (address: string): AddressType => {
    if (address.startsWith("tb1q") || address.startsWith("bc1q"))
      return AddressType.NATIVE_SEGWIT_P2WPKH;
    if (address.startsWith("tb1p") || address.startsWith("bc1p"))
      return AddressType.TAPROOT_P2TR;
    if (address.length > 34) return AddressType.NESTED_SEGWIT_P2SH_P2PKH;
    return AddressType.LEGACY_P2PKH;
  };

  // --------------- Auxiliary Functions: Address Type - Sign Payment ---------------

  // This Config will be Set Based on Address Type
  let signer: bitcoin.Signer,
    payment: bitcoin.Payment,
    sender: string | undefined;

  const addressType = detectAddressType(exchange);
  switch (addressType) {
    case AddressType.NATIVE_SEGWIT_P2WPKH: {
      signer = keyPair;
      payment = getNativeSegwitP2WPKH(keyPair.publicKey);
      sender = payment.address;
      break;
    }
    case AddressType.NESTED_SEGWIT_P2SH_P2PKH: {
      signer = keyPair;
      payment = getNestedSegwitP2SH_P2WPKH(keyPair.publicKey);
      sender = payment.address;
      break;
    }
    case AddressType.LEGACY_P2PKH: {
      signer = keyPair;
      payment = getLegacyP2PKH(keyPair.publicKey);
      sender = payment.address;
      break;
    }
    case AddressType.TAPROOT_P2TR: {
      const taprootP2TR = getTaprootP2TR(keyPair);
      signer = taprootP2TR.signer;
      payment = taprootP2TR.payment;
      sender = payment.address;
      break;
    }
    default:
      throw new Error("Invalid address type");
  }
  if (sender?.toLowerCase() !== exchange.toLowerCase()) {
    throw new Error(
      `The signer does not match with sender address type. Decoded address is ${sender} while input is ${exchange}`
    );
  }

  // --------------- Auxiliary Functions: UTXO ---------------
  interface IUTXO {
    txid: string;
    vout: number;
    value: number;
  }

  const getUTXO = async (address: string): Promise<IUTXO[]> => {
    const restURL = `${blockStreamApi}/address/${address}/utxo`;
    const res = await axios.get(restURL);
    return res.data;
  };

  const getTxHex = async (txId: string): Promise<string> => {
    const restURL = `${blockStreamApi}/tx/${txId}/hex`;
    const res = await axios.get(restURL);
    return res.data;
  };

  // --------------- Auxiliary Function: Brodcast Transaction on Bitcoin Blockchain ---------------
  const broadcast = async (txHex: string) => {
    try {
      console.log("Broadcasting tx:", txHex);
      const res = await axios.post(`${blockStreamApi}/tx`, txHex);
      return res.data;
    } catch (e: any) {
      console.error("Broadcast tx error:", e.message, e.response?.data);
    }
  };

  const utxos = await getUTXO(sender);

  if (!utxos.length) throw new Error("No UTXO found");

  const totalUnspent = utxos.reduce((sum, { value }) => sum + value, 0);

  // --------------- Auxiliary Function: Build Trnsaction ---------------
  const estimateFee = (
    signer: any,
    psbt: any,
    sender: string,
    remainBal: number,
    feeRate: number /* satoshis per byte */
  ) => {
    const tPsbt = psbt.clone();
    tPsbt.addOutput({ address: seller, value: Math.floor(remainBal / 2) }); // btc_utxo
    tPsbt.addOutput({ address: sender, value: Math.floor(remainBal / 2) });
    tPsbt.signAllInputs(signer);
    tPsbt.finalizeAllInputs();
    const estTx = tPsbt.extractTransaction(true);
    const bytes = estTx.byteLength();
    const vBytes = estTx.virtualSize();
    const finalFee = vBytes * feeRate + 1; // Add 1 satoshi to pass min relay fee not met

    return { bytes, vBytes, finalFee };
  };

  const psbt = new bitcoin.Psbt({ network, maximumFeeRate: maxFeeRate });
  const inputs: any[] = [];
  let totalInput = 0;

  let brc_utxo_amount: number = 0;
  let btc_utxo_amount: number = 0;

  // Loop thorugh UTXOs
  for (const utxo of utxos) {
    // BRC-20 UXTO (Buyer) & BTC UXTO (Seller, Covers both Miner's Fee)
    if (utxo.txid !== brc_utxo_txid && utxo.txid !== btc_utxo_txid) {
      console.log("EXCLUDING: " + utxo.value);
      continue;
    }

    totalInput += utxo.value;

    console.log("INCLUDING: " + utxo.value);

    type Input = { [key: string]: any };

    const input: Input = { hash: utxo.txid, index: utxo.vout };

    if (addressType != AddressType.LEGACY_P2PKH) {
      // Add witnessUtxo data
      input["witnessUtxo"] = { script: payment.output!, value: utxo.value };

      if (addressType == AddressType.TAPROOT_P2TR) {
        input["tapInternalKey"] = toXOnly(keyPair.publicKey);
      }

      if (addressType == AddressType.NESTED_SEGWIT_P2SH_P2PKH) {
        input["redeemScript"] = payment.redeem!.output;
      }
    } else {
      const hex = await getTxHex(utxo.txid);
      input["nonWitnessUtxo"] = Buffer.from(hex, "hex");
    }

    // Make Sure BRC-20 is First in the Inputs Array, So its Becomes the First Output to the Buyer
    if (utxo.txid == brc_utxo_txid) {
      inputs.unshift(input);
      brc_utxo_amount = utxo.value;
    } else {
      inputs.push(input);
      btc_utxo_amount = utxo.value;
    }
  }

  // UTXOs from Exchange's Wallet to Buyer's Wallet which is the Inscription
  psbt.addInputs(inputs);
  psbt.addOutput({ address: buyer, value: brc_utxo_amount });

  // Validate final output with fee
  let remainBal = totalInput - brc_utxo_amount;
  console.log("REMAINING BALANCE: " + remainBal);

  // Miner's Fee
  const { bytes, vBytes, finalFee } = estimateFee(
    signer,
    psbt,
    sender,
    remainBal,
    feeRate
  );

  console.log(
    `Size ${bytes}, vSize ${vBytes}. Total unspent ${totalUnspent}, FeeRate ${feeRate}, MaxFeeRate ${maxFeeRate}, Fee ${finalFee}`
  );

  // Seller Receives After we Take our Cut (1%) and the Miner's Fee
  let seller_net = Math.floor(btc_utxo_amount * 0.99 - finalFee);
  console.log("SELLER NET: " + seller_net);

  // UTXOs from Exchange Wallet to Seller's Wallet which is the BTC
  psbt.addOutput({ address: seller, value: seller_net });

  // Update Remaining Balance
  remainBal -= seller_net;

  // Change of the Transaction goes to the Exchange Wallet which is the 1% of the Exchange Fee
  psbt.addOutput({ address: sender, value: remainBal - finalFee });

  // Sign Transaction
  psbt.signAllInputs(signer);
  psbt.finalizeAllInputs();

  console.log("inputs: " + psbt.txInputs.map((input) => input.hash));
  console.log("output: " + psbt.txOutputs.map((output) => output.value));

  // Broadcast Transaction
  const tx = psbt.extractTransaction(true);
  const txId = await broadcast(tx.toHex());
  txId && console.log(`Transaction successfully broadcasted! TxId is ${txId}`);
  return txId;
};

const exchange_wallet = process.env.EXCHANGE_WALLET || "";
const apiKey = process.env.REACT_APP_API_KEY || "";
const apiPrefix = "https://open-api-testnet.unisat.io";

// Need to Inscribe Transfer First Before Transferring It
async function placeInscriptionOrder(tick: string, amount: string) {
  try {
    const response = await axios.post(
      apiPrefix + "/v2/inscribe/order/create/brc20-transfer",
      {
        receiveAddress: exchange_wallet,
        feeRate: 30,
        outputValue: 546,
        devAddress: "",
        devFee: 0,
        brc20Ticker: tick,
        brc20Amount: amount,
      },
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );
    let responseData = response.data;
    return responseData.data;
  } catch (error: any) {
    console.error("Error:", error.message);
    return null;
  }
}

// Checks the Status of our Order from UniSat - Inscribe Transfer
async function checkStatus(orderID: string) {
  try {
    let response = await axios.get(
      apiPrefix + "/v2/inscribe/order/" + orderID,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    // Testing Purposes
    console.log("----- RESPONSE DATA -----");
    console.log(response.data);

    // Status has 3 Phases: Pending, Inscribing, Minted
    let status = response.data.data.status;

    // Inscription is Now Transferable
    if (status == "minted") {
      let inscriptionID = response.data.data.files[0].inscriptionId;
      let res = await axios.get(
        "https://open-api-testnet.unisat.io/v1/indexer/inscription/info/" +
          inscriptionID,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      // TXID: Needed to Send from Exchange => Buyer
      console.log(res.data.data.utxo.txid);
      return res.data.data.utxo.txid;
    } else {
      return null;
    }
  } catch (e: any) {
    console.log(e);
    return null;
  }
}

// Sends Inscription to Buyer, BTC to Seller, and 1% to Exchange
async function completeOrder(
  buyer: string,
  seller: string,
  tick: string,
  amount: string,
  utxo_txid: string
) {
  // Testing Purposes
  console.log("HERE");
  console.log(utxo_txid);

  // Inscribe Transfer Order to UniSat
  const response: any = await placeInscriptionOrder(tick, amount);

  // Testing Purposes
  console.log("----- RESPONSE FROM UNISAT -----");
  console.log(response);

  // UniSat Address we Pay for our Inscribe Transfer Order
  const unisat = response.payAddress;

  // Send Payment to UniSat
  const inscription_change_txid = await sendBTC(
    exchange_wallet,
    unisat,
    response.amount,
    utxo_txid
  );

  // Testing Purposes
  console.log("----- INSCRIPTION CHANGE FROM UNISAT INSCRIPTION FEE -----");
  console.log(inscription_change_txid);

  let inscription_txid = "";

  // Waiting for our UniSat Inscribe Transfer Order to be Ready (minted)
  while ((inscription_txid = await checkStatus(response.orderId)) == null) {
    console.log("----- Still checking status -----");
    sleep.sleep(10);
  }

  await fulfillOrder(
    exchange_wallet,
    buyer,
    seller,
    inscription_txid,
    inscription_change_txid
  );
}

export { placeInscriptionOrder, checkStatus, fulfillOrder, completeOrder };

/*
------- References ----
Send BTC Tutorial - https://nhancv.medium.com/send-a-btc-bitcoin-transaction-with-bitcoinjs-psbt-24fd0d5b42d0
BRC-20 - https://leather.gitbook.io/guides/bitcoin/sending-brc-20-tokens
UniSat Testnet API Endpoints - https://open-api-testnet.unisat.io/swagger.html
Mempool Testnet Blockchain Explorer - https://mempool.space/testnet
*/
