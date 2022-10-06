const express = require('express');
const path = require('path');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const session  = require('express-session')
const flash = require('connect-flash');

const app = express()

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'views'))
 
app.use(express.urlencoded({extended: true}))
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req,res,next)=>{
    res.locals.userLoggedIn = req.user;
    next();
})

app.get("/login", (req,res) => {
    res.render("user/login");
})

app.post("/login", (req,res)=>{
    res.send("Login post request received");
})

app.get("/register", (req,res) => {
    res.render("user/register");
})

app.post("/register", (req,res)=>{
    res.send("Register post request received");
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