const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

let dbPromise;

function getDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: path.join(process.cwd(), 'database.sqlite'),
      driver: sqlite3.Database
    });
  }
  return dbPromise;
}

// Emulate a subset of the pg `pool.query` API
const pool = {
  query: async (text, params) => {
    const db = await getDb();
    
    // Convert Postgres positional parameters ($1, $2) to SQLite syntax (?, ?)
    const sqliteText = text.replace(/\$\d+/g, '?');
    
    // SQLite uses db.all() for fetching and db.run() for execution
    const isSelectOrReturning = sqliteText.trim().toUpperCase().startsWith('SELECT') || sqliteText.toUpperCase().includes('RETURNING');
    
    try {
      if (isSelectOrReturning) {
        const rows = await db.all(sqliteText, params || []);
        return { rows, rowCount: rows.length };
      } else {
        const result = await db.run(sqliteText, params || []);
        return { 
          rows: result.lastID ? [{ id: result.lastID }] : [],
          rowCount: result.changes 
        };
      }
    } catch (err) {
      console.error('Error executing query:', sqliteText);
      console.error(err);
      throw err;
    }
  }
};

module.exports = pool;
