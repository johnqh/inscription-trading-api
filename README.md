# inscription-trading-api

This API provides a JSON-based interface with a MySQL database to store
indexing information, orders, and records for the BRC-20 inscription trading system.
It also includes an order matching system so that orders in the order book can be fulfilled.

## Database setup

A MySQL Database will need to be set up with the following tables:

`parsed_block`
```
last_parsed_block: int
```

`actions`
```
address: varchar
tick: varchar
action: int
amt: int
destination: varchar
block: int
```

`deploy`
```
tick: varchar
max: int
lim: int
block: int
```

`holdings`
```
tick: varchar
address: varchar
amt: int
updated_at_block: int
```

`orders`
```
id: int auto_increment
address: varchar
tick: varchar
side: int
amt: int
price: double
expiration: datetime
expired: int
```

`historical_records`
```
id: int auto_increment
address: varchar
action: enum("buy", "sell", "transfer_out", "transfer_in", "bought", "sold")
token_size: double
token: varchar
price: double
fee: double
btc_amount: double
datetime: datetime
```

`nft_orders`
```
id: int auto_increment
seller_address: varchar
buyer_address: varchar
txid: varchar
inscription_id: varchar
inscription_number: varchar
name: varchar
price: double
expiration: datetime
expired: int
fulfilled: int
```

`nft_historical_orders`
```
id: int auto_increment
address: varchar
action: varchar
txid: varchar
inscription_id: varchar
inscription_number: varchar
name: varchar
price: double
fee?: double
datetime: varchar
```

## Installation and Running

NodeJS is required to install and run the API and order matching.

From a clone or archive of the repository, run `npm install` to install the
dependencies. 

A `.env` file will need to be made in order to store secrets, or else the API
cannot communicate to the database or UniSat. The following variables are required:

```
DATABASE_URL=<url to mysql database>
API_KEY=<unisat api key>
EXCHANGE_WALLET=<exchange wallet for holding assets before order fulfillment>
```

Then run `npm run start` to start the API. By default, it runs
on port 3000.

To run order matching, run `ts-node order_matching.ts`. It is recommended to run it with a cronjob or some other periodic scheduler.

## Routes

### /actions

```
{
    address: string,
    tick: string,
    action: number, (0 for mint, 1 for transfer)
    amt: number,
    block: number,
    destination?: string (used for transfers)
}
```

GET returns an array of the actions stored in the database. With the query
string arguments `address` and `tick`, it can be filtered by address, tick, or
both.

POST adds an action to the database. The request should be in this form:


### /deploy

```
{
    tick: string,
    max: number, (the maximum number of tokens assigned to a tick)
    limit: number, (The maximum amount of tokens that can be minted at once)
    block: number (The block the token was deployed)
}
```

GET returns an array of the ticks that have been deployed until the last
parsed block. This route provides no query string options.

POST adds a deployed tick to the database.

### /historical\_records

```
{
    id: number,
    address: string,
    action: string, ("buy", "sell", "transfer_out", "transfer_in", "bought", "sold")
    token_size: number,
    token: string,
    price?: number, (null is market price)
    fee?: number, (fee paid after transaction is made)
    btc_amount?: number, (total btc_amount, including fee)
    datetime: string
}
```

GET returns an array of historical records. An `address` can be specified in
the query string to get only the historical records associated with a
particular address.

POST adds a historical record to the database.

#### /historical\_records/:id

PUT modifies a historical record with the provided `id` with the properties of
the request. Properties not included in the body will remain untouched.

DELETE removes the historical record with the given `id`.

### /holdings

```
{
    address: string
    tick: string
    amt: number
    updated_at_block: number
}
```

Address and tick form the primary key.

GET returns the holdings for a given `address` specied by the query string. A
`tick` can be specified to get the holdings of a particular tick.

POST adds a holding if the pair of address and tick are not already present in
the database, and updates the holding if they are not present

**NOTE:** With the UniSat API, only the first 16 holdings are fetched. If the
tick is specified, it has to be one of the first 16 ticks or else nothing is
returned. Also, the address is required. With the API, POST requests are
ignored.

### /orders

```
{
  id: number;
  address: string;
  tick: string;
  side: number;
  amt: number;
  price: number;
  expiration: number;
  expired: number;
}
```

GET returns an array of the orders stored in the database. Output can be
filtered by `address`, `tick`, or both by passing in the corresponding query
string.

POST adds an order to the database. The price is optional, and no price
indicates an order at market price. `id` is ignored since the database keeps
track of them.

#### /orders/:id

PUT modifies the order with the given `id`. Properties not included in the body will remain untouched.

### /nft\_orders

```
{
  id: number;
  seller_address: string;
  buyer_address: string;
  txid: string;
  inscription_id: string;
  inscription_number: string;
  name: string;
  price: number;
  expiration: number;
  expired: number;
  fulfilled: number;
}
```

GET returns an array of the nft orders stored in the database. Output can be
filtered by `seller_address` with the query string.

POST operates the same as it does in `orders`.

#### /nft\_orders/:id

PUT modifies the order with the given `id`. Properties not included in the body will remain untouched.

### /nft\_historical\_records

```
{
  id: number;
  address: string;
  action: string;
  txid: string;
  inscription_id: string;
  inscription_number: string;
  name: string;
  price: number;
  fee?: number;
  datetime: string;
}
```

GET returns an array of historical records. An `address` can be specified in
the query string to get only the historical records associated with a
particular address.

POST adds a historical record to the database.

#### /nft\_historical\_records/:id

PUT modifies a historical record with the provided `id` with the properties of
the request. Properties not included in the body will remain untouched.
DELETE removes the historical record with the given `id`.
