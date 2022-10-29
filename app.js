const express = require('express');
const path = require('path');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const session  = require('express-session')
const flash = require('connect-flash');
const client = require('./database/pgdatabase')
const bcrypt = require('bcryptjs')
const cors = require('cors');
const pgSession = require('connect-pg-simple')(session);
require('dotenv').config()

const app = express()

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname,'views'))

app.use(express.urlencoded({extended: true}))
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json())

app.use(
    cors({
        origin: 'http://localhost:3001',
        methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
        credentials: true,
    })
)

app.use(session({
  store: new pgSession({
    pool : client,
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET ,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 15 * 24 * 60 * 60 * 1000 } // 15 days
}));

app.use(flash());

app.use((req,res,next)=>{
    res.locals.userLoggedIn = req.session.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
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
    const {username, password, ngoName, ngoMail, organization, phoneNumber, govtId, add1, add2, city, state, zipCode , ngoImage} = req.body;

    if(username == null || password == null || ngoName == null || ngoMail == null || phoneNumber == null || govtId == null || 
        add1==null || city == null || state == null || zipCode == null){
            return res.sendStatus(403)
    }

    try{
        const hashedPassword = bcrypt.hashSync(password, 10)
        var existing = await client.query(
            "select * from superuser where user_name = $1", [username]
        )
        if(existing.rows.length > 0){
            res.redirect('/registerNGO')
        }else{
            const data = await client.query(
                "insert into superuser (user_name, user_password, type_user) values($1, $2, $3) returning *", [username,hashedPassword,'N']
            )
            await client.query(
                "insert into ngo values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10 , $11);", [govtId, username, ngoName, organization, ngoMail, add1+(add2?" "+add2:""), city, state, zipCode, phoneNumber , ngoImage]
            )

            if (data.rows.length === 0) {
                res.sendStatus(403)
            }

            const user = data.rows[0]
            
            req.session.user = {
                id: user.id,
                username: user.user_name,
                type: user.type_user
            }

            res.redirect('/drives')
        }


    }catch(e){
        console.error(e.message)
        return res.sendStatus(403)
    }
})

app.get("/registerUser", (req,res)=>{
    res.render("user/personRegistration")
})

app.post("/registerUser", async(req,res)=>{
    const {username, password, firstName, middleName, lastName, email, phnNumber, gender, aadhaar, dateOfBirth, add1, add2, city, state, zipCode , userImage} = req.body;
    
    if (username == null || password == null || firstName == null || lastName == null || email == null || phnNumber == null ||
        gender == null || aadhaar == null || dateOfBirth == null || add1 == null || city == null || state == null || zipCode == null){
            return res.sendStatus(403)
    }

    try{
        const hashedPassword = bcrypt.hashSync(password, 10)
        var existing = await client.query(
            "select * from superuser where user_name = $1", [username]
        )
        if(existing.rows.length > 0){
            
        }else{
            var bday = +new Date(dateOfBirth)
            var age = ~~((Date.now() - bday)/(31557600000));
            const data = await client.query(
                "insert into superuser (user_name, user_password , type_user) values($1, $2 , $3) returning *"
                ,[username, hashedPassword, 'P']
            )
            await client.query(
                "insert into person (user_name, user_aadhar, user_first_name, user_middle_name, user_last_name, user_date_of_birth, user_contact, user_age, user_gender, user_mail, user_address, user_city, user_state, user_zip_code , user_image) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14 , $15);"
                ,[username, aadhaar, firstName, middleName, lastName, dateOfBirth, phnNumber, age, gender, email,  add1+(add2?" "+add2:""), city, state, zipCode , userImage]
            )

            if (data.rows.length === 0) {
                res.sendStatus(403)
            }

            const user = data.rows[0]
            
            req.session.user = {
                id: user.id,
                username: user.user_name,
                type: user.type_user,
            }

            res.redirect('/drives')
        }
    }catch(e){
        console.error(e.message)
        res.redirect('/register')
    }
})

app.get("/login", (req,res) => {
    res.render("user/login");
})

app.post("/login", async(req,res)=>{
    const {username, password } = req.body;

    if(username == null || password == null){
        res.sendStatus(403)
    }
    try{
        const data = await client.query(
            "select user_name, user_password, type_user from superuser where user_name = $1",[username]
        )
        
        if(data.rows.length == 0){
            res.sendStatus(403)
        }
        const user = data.rows[0]

        const matches = bcrypt.compareSync(password, user.user_password)
        if(!matches) { 
            res.send("Incorrect")
            return res.sendStatus(403)
        }

        req.session.user = {
            id: user.id,
            username: user.user_name,
            type: user.type_user
        }
    }catch(e){
        console.error(e.message)
    }

    res.redirect('/drives')
})

app.get("/logout",async (req,res)=>{
    try{
        req.flash('success','Logged Out!!')
        req.session.destroy()
        res.redirect('/')
    }catch(e){
        console.log(e)
    }
})

app.get("/drives", async(req,res) => {
    try{
        const data = await client.query(
            "select * from drives;"
        )
        const drives = data.rows
    
        res.render('drives/index', {drives})
    }catch (e) {
        res.sendStatus(403)
    }
})

app.post("/drives", async(req,res)=>{
    const {title , driveType , driveVenue , driveDate , driveTime , driveManager , driveDescription , driveImage  } = req.body;
    try{
        const data = await client.query(
            "insert into drives (drive_name, drive_type, ngo_username , drive_description , drive_date , drive_time , drive_location , drive_manager , drive_image) values($1, $2 , $3, $4, $5, $6 , $7, $8, $9 ) returning *"
            ,[title , driveType, req.session.user.username , driveDescription , driveDate , driveTime  , driveVenue , driveManager , driveImage])
            
    }catch(e){
        console.error(e.message)
    }
        
    res.redirect('/drives')
})


app.get("/drives/new", (req,res)=>{
    res.render("drives/new")
})

app.get("/drives/:id", async(req,res)=>{
    const { id } = req.params
    try{
        const data = await client.query(
            "select * from drives where drive_id = $1;", [id]
        )

        if(data.rows.length==0){
            req.flash('error', 'Drive does not exist!!')
            res.redirect('/drives')
        }

        const drive = data.rows[0]

        res.render("drives/driveinfo",{drive})
    }catch (e){
        res.sendStatus(403)
    }
})
app.post("/drives/:id", async(req,res)=>{
    const { id } = req.params

    const today = new Date()
    const day = today.getDate()        
    const month = today.getMonth()+1
    const year = today.getFullYear()
    try{

// retrive user_id using username from person table-----(not working)

    const user_id = await client.query("select * from person where person.user_name=$1;" , [req.session.user.username])
// console.log(user_id)
// console.log(month + "-" + day + "-" + year)

        const data = await client.query(
            "insert into connects_to (user_id, drive_id, date_of_registration) values($1, $2 , $3) returning * "
            ,[user_id , id , (year + "-" + month + "-" + day) ])
            
    }catch(e){
        console.error(e.message)
    }
        
    res.redirect('/drives')
})


app.get("/ngoProfile", async(req,res) => {
    try{
        const data = await client.query(
            "select * from ngo where ngo_username = $1;", [req.session.user.username]
        )
        if(data.rows.length == 0){
            res.sendStatus(403)
        }
        const ngo = data.rows[0]
        res.render("ngo/ngoprofile",{ngo});
    }catch(e){
        console.log(e)
        res.sendStatus(403)
    }
})

app.get("/personProfile", async(req,res) => {
    try{
        const data = await client.query(
            "select * from person where user_name = $1;", [req.session.user.username]
        )
        if(data.rows.length == 0){
            res.sendStatus(403)
        }
        const person = data.rows[0]
        res.render("user/personprofile", {person});
    }catch(e){
        console.log(e)
        res.sendStatus(403)
    }
})


app.get("/", (req,res) => {
    res.render("home");
})



app.listen(3000, ()=>{
    console.log("Listening on port 3000");
})