const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
})

// test the db connection
pool.connect()
.then((client) => {
    console.log("Database Connected Successfully")
    client.release()
})
.catch((err) => {
    console.log("Database Connection Failed", err)
})

module.exports = pool