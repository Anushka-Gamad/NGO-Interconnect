const Pool = require('pg').Pool;

const client = new Pool({
    host: 'localhost',
    user: 'postgres',
    port: 5432,
    password :'qwerty',
    database: 'NGOInterConnect'
})


module.exports = client;


function registerUser(x , user_name , email , password){
    client.connect();
    client.query("insert into user values (");

    client.end;
}

function login(email , password){
    client.connect();
    // client.query();
    client.end;
}

function view_drives(){
    client.connect();
    // client.query();
    client.end;
}

function register_to_drive(){
    client.connect();
    // client.query();
    client.end;
}