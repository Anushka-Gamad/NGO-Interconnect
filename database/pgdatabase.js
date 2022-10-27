const Pool = require('pg').Pool;

const client = new Pool({
    host: 'localhost',
    user: 'postgres',
    port: 5432,
    password :'qwerty',
    database: 'NGOInterConnect'
})

module.exports = client;