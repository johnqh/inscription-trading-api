import dotenv from "dotenv"; // If using dotenv to manage environment variables
import mysql from "mysql2";

dotenv.config();
/* the DATABASE_URL variable is always going to be there, so assure that it is
 * fine */

const conn = mysql.createConnection(process.env.DATABASE_URL!);

function select<T extends mysql.RowDataPacket>(query: string, params: String[]): Promise<T[]> {
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

export default {conn, select}
