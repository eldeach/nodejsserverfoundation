const mariadb = require('mariadb');
const { resolve } = require('path');
const pool = mariadb.createPool({
     host: process.env.thisDB_host,
     port: process.env.thisDB_port,
     user: process.env.thisDB_user, 
     password: process.env.thisDB_password,
     connectionLimit: 5
});

async function selectFunc (reqQuery) {
    let conn;
    try {
      conn = await pool.getConnection();
      conn.query('USE ' + process.env.thisDB_name);
      const rows = await conn.query(reqQuery)
      return rows
    } catch (err) {
      throw err;
    } finally {
      if (conn) conn.end();
    }
  }

  async function insertFunc (insertTable, insertColums, insertValues, truncTbl) {
    let conn;
    try {
      conn = await pool.getConnection();
      conn.query('USE ' + process.env.thisDB_name);
      //const rows = await conn.query("INSERT INTO " + insertTable + " ("+insertColums+") VALUES("+insertValues+")")
      console.log("바이너리 전달받은 값  : " + insertValues[2])
      const rows = await conn.query("INSERT INTO " + insertTable + " ("+insertColums+") VALUES(?,?,UUID_TO_BIN(UUID()))", [insertValues[0],insertValues[1]])
      return rows
    } catch (err) {
      console.log(err)
    } finally {
      if (conn) conn.end();
    }
  }

  async function batchInsertFunc (insertTable, columNamesArr, valueCountArr, valueArrys, truncTbl) {
    let conn;
    try {
      conn = await pool.getConnection();
      conn.query('USE ' + process.env.thisDB_name);
      if (truncTbl){
        conn.query("SET FOREIGN_KEY_CHECKS = 0;")
        conn.query("TRUNCATE " + insertTable + ";")
        conn.query("SET FOREIGN_KEY_CHECKS = 1;")
      }
      const rows = await conn.batch("INSERT INTO " + insertTable + " ("+columNamesArr.join(', ')+") VALUES("+valueCountArr.join(', ')+")", valueArrys)
      //console.log(rows)
      return rows
    } catch (err) {
      console.log(err)
    } finally {
      if (conn) conn.end();
    }
  }

  async function truncateTable(truncTable){
    let conn;
    try {
      conn = await pool.getConnection();
      conn.query('USE ' + process.env.thisDB_name);
      const setFKfalse = await conn.query("SET FOREIGN_KEY_CHECKS = 0;")
      const truncTbl = await conn.query("TRUNCATE " + truncTable + ";")
      const setFKtrue = await conn.query("SET FOREIGN_KEY_CHECKS = 1;")

      // return rows
    } catch (err) {
      throw err;
    } finally {
      if (conn) conn.end();
    }
  }

  async function insertFunc1 (reqQuery,columNames, arr2) {
    let conn;
    let columStr = columNames.join(',')
    console.log(columStr)
    console.log(arr2)

    try {
      conn = await pool.getConnection();
      conn.query('USE ' + process.env.thisDB_name);
      const rows = await conn.query(reqQuery)
      return rows
    } catch (err) {
      throw err;
    } finally {
      if (conn) conn.end();
    }

  }

  module.exports={selectFunc, insertFunc, truncateTable, insertFunc1, batchInsertFunc}