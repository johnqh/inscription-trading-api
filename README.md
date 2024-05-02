# inscription-trading-api

This API provides a JSON-based interface with a MySQL database to store
indexing information, orders, and records.

## Installation

From a clone or archive of the repository, run `npm install` to install the
dependencies. Then run `npm run start` to start the server. By default, it runs
on port 3000.

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
the request. All properties must be present.

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

GET returns the holdings for a given `address` specied by the query string. A
`tick` can be specified to get the holdings of a particular tick.

**NOTE:** With the UniSat API, only the first 16 holdings are fetched. If the
tick is specified, it has to be one of the first 16 ticks or else nothing is
returned. Also, the address is required.

With the API, POST requests are ignored.

### /orders
