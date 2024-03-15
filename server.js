require('dotenv').config(); // If using dotenv to manage environment variables
const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json()); // Updated to use the built-in express middleware

// Database URL - Replace it with an Environment Variable in Production
const DATABASE_URL = 'mysql://ipuzqm4yw6y8028go5ll:pscale_pw_wWb0sNjbYk9o7gaKYbGlCmDCxTuSABmwdrHBR5RsEcJ@aws.connect.psdb.cloud/indexer-db?ssl={"rejectUnauthorized":true}';

// Function to create a database connection
async function createConnection() {
    const connection = await mysql.createConnection(DATABASE_URL);
    return connection;
}

// Root Route to Confirm the Server is Running
app.get('/', (req, res) => {
    res.send('Server is up and running!');
});

// GET Route to Retrieve Orders
app.get("/orders", async (req, res) => {
  const { address, tick } = req.query;
  let query = "SELECT * FROM orders";
  const conditions = [];
  const params = [];

  if (address) {
    conditions.push("address = ?");
    params.push(address);
  }

  if (tick) {
    conditions.push("tick = ?");
    params.push(tick);
  }

  if (conditions.length) {
    query += " WHERE " + conditions.join(" AND ");
  }

  const connection = await createConnection();
  const [rows] = await connection.execute(query, params);
  await connection.end();

  res.send(rows);
});

// POST Route to Insert a Order Record on the Order Table
app.post("/orders", async (req, res) => {
  const { address, tick, side, amt, price, expiration, expired } = req.body;
  
  // Validate input as needed
  const connection = await createConnection();
  await connection.execute(
    `INSERT INTO orders (address, tick, side, amt, price, expiration, expired) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [address, tick, side, amt, price, expiration, expired]
  );
  await connection.end();

  res.send({ message: "Action added successfully." });
});

// PUT Modify an Order Record Given its ID
app.put("/orders", async (req, res) => {
  const { id, address, tick, side, amt, price, expiration, expired } = req.body;

  // Validate input as needed
  const connection = await createConnection();
  await connection.execute(
    `UPDATE orders SET address = ?, tick = ?, side = ?, amt = ?, price = ?, expiration = ?, expired = ? WHERE id = ?`,
    [address, tick, side, amt, price, expiration, expired, id]
  );
  await connection.end();

  res.send({ message: "Action added successfully." });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

