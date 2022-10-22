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
app.get("/person-profile", (req,res) => {
    res.render("user/person-profile");
})

app.post("/register", (req,res)=>{
    const {typeOfUser} = req.body;
    if(typeOfUser == "ngo"){
        res.render("user/ngoRegistration")
    }else{
        res.render("user/personRegistration")
    }
    
})

app.post("/registerNGO", async(req,res)=>{
    try{
        const {username, email, password } = req.body;
        await client.query(
            "insert into superuser (user_name, user_password) values($1, $2);", [username,password]
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
            "insert into superuser (user_name, user_password , type_user) values($1, $2 , 1) ;", [username, password]
        )
        await client.query(
            "insert into person (user_name , user_first_name, user_last_name, user_mail) values($1, $2, $3, $4, $5);", [username, firstname, lastname, email]
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