import dotenv from "dotenv"; // If using dotenv to manage environment variables
import mysql from "mysql2";

dotenv.config();
/* the DATABASE_URL variable is always going to be there, so assure that it is
 * fine */

let conn: mysql.Connection;
function connect(): mysql.Connection {
  conn = mysql.createConnection(process.env.DATABASE_URL!);
  return conn;
}

function getConnection()
{
  return conn;
}

function select<T extends mysql.RowDataPacket>(
  query: string,
  params: String[]
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.query<T[]>(query, params, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
  
}

function execute(sql: string, values: any[])
{
  conn.execute(sql, values);
}

function close() {
  conn.end();
}

// UniSat API Key. Required to get the holdings
const apiKey: string = process.env.API_KEY!;

export default { connect, getConnection, select, execute, close, apiKey };
