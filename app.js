const express = require('express');
const path = require('path');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const session  = require('express-session')
const flash = require('connect-flash');
const client = require('./database/pgdatabase')

const app = express()

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'views'))
 
app.use(express.urlencoded({extended: true}))
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json())

app.use((req,res,next)=>{
    res.locals.userLoggedIn = req.user;
    next();
})

app.get("/login", (req,res) => {
    res.render("user/login");
})

app.post("/login", async(req,res)=>{
    res.send("Login post request received");
})

app.get("/register", (req,res) => {
    res.render("user/register");
})

app.post("/register", (req,res)=>{
    const {typeOfUser} = req.body;
    if(typeOfUser == "ngo"){
        res.render("user/registerNGO")
    }else{
        res.render("user/registerUser")
    }
    
})

app.post("/registerNGO", async(req,res)=>{
    try{
        const {username, email, password } = req.body;
        await client.query(
            "insert into super_user (username, user_password) values($1, $2) returning *", [username,password]
        )
        await client.query(
            "insert into ngo (ngo_mail) values($1) returning *", [email]
        )
    }catch(e){
        console.error(e.message)
    }
    res.redirect('/drives')
})

app.post("/registerUser", async(req,res)=>{
    try{
        const {username, email, password, firstname, lastname } = req.body;
        const newUser = await client.query(
            "insert into super_user (username, user_password) values($1, $2);", [username, password]
        )
        await client.query(
            "insert into person (user_first_name, user_last_name, user_mail) values($1, $2, $3);", [firstname, lastname, email]
        )
    }catch(e){
        console.error(e.message)
    }
    res.redirect('/drives')
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

app.get("/", (req,res) => {
    res.render("home");
})


app.listen(3000, ()=>{
    console.log("Listening on port 3000");
})