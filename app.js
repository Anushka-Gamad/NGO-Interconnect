const express = require('express');
const path = require('path');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const session  = require('express-session')
const flash = require('connect-flash');
// const client = require('./database/pgdatabase')
const bcrypt = require('bcryptjs')
const cors = require('cors')

const app = express()

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'views'))
 
app.use(express.urlencoded({extended: true}))
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json())
app.use(flash());

app.use(
    cors({
        origin: 'http://localhost:3001',
        methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
        credentials: true,
    })
)

const pg = require('pg');
const expressSession = require('express-session');
const pgSession = require('connect-pg-simple')(expressSession);

const pgPool = new pg.Pool({
    user: 'postgres',
    host: 'localhost',
    database:'NGOInterConnect',
    password: 'qwerty',
    port: 5432
});

app.use(expressSession({
  store: new pgSession({
    pool : pgPool,
    createTableIfMissing: true
  }),
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  // Insert express-session options here
}));

// const { Client } = require('pg')
// const conObject = {
//     user: process.env.USER,
//     host: process.env.HOST,
//     database: process.env.DATABASE,
//     password: process.env.PASSWORD,
//     port: process.env.PORT,
// }

// const client = new Client(conObject)
// client.connect()

// // session store and session config
// const store = new (require('connect-pg-simple')(session))({
//     conObject,
// })

// app.use(
//     session({
//         store: store,
//         secret: "session secret",
//         saveUninitialized: false,
//         resave: false,
//         cookie: {
//             secure: false,
//             httpOnly: false,
//             sameSite: false,
//             maxAge: 1000 * 60 * 60 * 24,
//         },
//     })
// )

app.use((req,res,next)=>{
    res.locals.userLoggedIn = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})

app.get("/login", (req,res) => {
    res.render("user/login");
})

app.post("/login", async(req,res)=>{
    console.log("Login post request received");
    try{
        const {username, password } = req.body;
        const user = await client.query(
            "select * from superuser where user_name = $1",[username]
        )
        if (user.user_name && user.password){
            if(user.password == password){
                res.render('/person-profile');
                
            }else{
                res.send("Incorrect password")
            }
        }else if(!user.user_name){
            res.render('/register');
        }
    }catch(e){
        console.error(e.message)
    }
})

app.get("/register", (req,res) => {
    res.render("user/register");
})

app.post("/register", (req,res)=>{
    const {typeOfUser} = req.body;
    if(typeOfUser == "ngo"){
        res.redirect("/registerNGO")
    }else{
        res.redirect("/registerUser")
    }
})

app.get("/registerNGO", (req,res)=>{  
    res.render("ngo/ngoRegistration")
})

app.post("/registerNGO", async(req,res)=>{
    const {username, password, ngoName, ngoMail, organization, phoneNumber, govtId, add1, add2, city, state, zipCode} = req.body;
    try{
        var existing = await client.query(
            "select * from superuser where user_name = $1", [username]
        )
        if(existing.rows.length > 0){
            res.redirect('/registerNGO')
        }else{
            await client.query(
                "insert into superuser (user_name, user_password, type_user) values($1, $2, $3);", [username,password,'N']
            )
            await client.query(
                "insert into ngo values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);", [govtId, username, ngoName, organization, ngoMail, add1+" "+add2, city, state, zipCode, phoneNumber]
            )
            res.redirect('/drives')
        }
    }catch(e){
        console.error(e.message)
    }
})

app.get("/registerUser", (req,res)=>{
    res.render("user/personRegistration")
})

app.post("/registerUser", async(req,res)=>{
    const {username, password, firstName, middleName, lastName, email, phnNumber, gender, aadhaar, dateOfBirth, add1, add2, city, state, zipCode} = req.body;
    try{
        var existing = await client.query(
            "select * from superuser where user_name = $1", [username]
        )
        if(existing.rows.length > 0){
            
        }else{
            var bday = +new Date(dateOfBirth)
            var age = ~~((Date.now() - bday)/(31557600000));
            await client.query(
                "insert into superuser (user_name, user_password , type_user) values($1, $2 , $3);"
                ,[username, password, 'P']
            )
            await client.query(
                "insert into person (user_name, user_aadhar, user_first_name, user_middle_name, user_last_name, user_date_of_birth, user_contact, user_age, user_gender, user_mail, user_address, user_city, user_state, user_zip_code) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);"
                ,[username, aadhaar, firstName, middleName, lastName, dateOfBirth, phnNumber, age, gender, email, add1+" "+add2, city, state, zipCode]
            )
            res.redirect('/drives')
        }
    }catch(e){
        console.error(e.message)
        // await client.query(
        //     "delete from superuser where user_name = $1;", [username]
        // )
        res.redirect('/register')
    }
})

app.get("/drives", (req,res) => {
    res.render('drives/index')
})


app.post("/drives", (req,res) =>{
    res.send("Adding new drive")
})


app.get("/drives/new", (req,res)=>{
    res.render("drives/new")
})


app.get("/ngo-profile", (req,res) => {
    res.render("ngo/ngo-profile");
})

app.get("/person-profile", (req,res) => {
    res.render("user/person-profile");
})

app.get("/", (req,res) => {
    res.render("home");
})


app.listen(3000, ()=>{
    console.log("Listening on port 3000");
})