const express = require('express');
const path = require('path');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const session  = require('express-session')
const flash = require('connect-flash');
const client = require('./database/pgdatabase')
const bcrypt = require('bcryptjs')
const cors = require('cors');
const emailService = require('./service/emailService');
const { AuthenticationMD5Password } = require('pg-protocol/dist/messages');
const pgSession = require('connect-pg-simple')(session);
const { verify } = require('crypto');

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
            const data2 = await client.query(
                "insert into ngo values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10 , $11) returning *", [govtId, username, ngoName, organization, ngoMail, add1+(add2?" "+add2:""), city, state, zipCode, phoneNumber , ngoImage]
            )

            if (data.rows.length === 0) {
                res.sendStatus(403)
            }

            if(data2.rows.length ===0){
                await client.query(
                    "delete from superuser where user_name = $1", [username]
                )
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
            const data2 = await client.query(
                "insert into person (user_name, user_aadhar, user_first_name, user_middle_name, user_last_name, user_date_of_birth, user_contact, user_age, user_gender, user_mail, user_address, user_city, user_state, user_zip_code , user_image) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14 , $15) returning *"
                ,[username, aadhaar, firstName, middleName, lastName, dateOfBirth, phnNumber, age, gender, email,  add1+(add2?" "+add2:""), city, state, zipCode , userImage]
            )

            if (data.rows.length === 0) {
                res.sendStatus(403)
            }

            if(data2.rows.length ===0){
                await client.query(
                    "delete from superuser where user_name = $1", [username]
                )
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
            "SELECT * from drives where drive_date > CURRENT_DATE order by drive_date;"
        )

        const drives = data.rows
    
        res.render('drives/index', {drives})
    }catch (e) {
        res.sendStatus(403)
    }
})

app.get("/drives/new", (req,res)=>{
    res.render("drives/new")
})

app.post("/drives", async(req,res)=>{
    const {title , driveType , driveVenue , driveDate , driveTime , driveManager , driveDescription , driveImage  } = req.body;
    try{
        const data = await client.query(
            "insert into drives (drive_name, drive_type, ngo_username , drive_description , drive_date , drive_time , drive_location , drive_manager , drive_image) values($1, $2 , $3, $4, $5, $6 , $7, $8, $9 ) returning *"
            ,[title , driveType, req.session.user.username , driveDescription , driveDate , driveTime  , driveVenue , driveManager , driveImage])
        
        const driveID = data.rows.drive_id

        // return res.send(data.rows)

        // console.log(driveID)
        
        // const today = new Date()
        // const day = today.getDate()        
        // const month = today.getMonth()+1
        // const year = today.getFullYear()

        // const d1 = await client.query (
        //     "insert into uploads (drive_id, ngo_username, upload_date) values ($1, $2, $3) returning *",
        //     [driveID, req.session.user.username, (year + "-" + month + "-" + day)]
        // )
    }catch(e){
        console.error(e.message)
    }
        
    res.redirect('/drives')
})

app.get("/drives/:id", async(req,res)=>{
    const { id } = req.params
    try{
        const data = await client.query(
            "select * from drives where drive_id = $1;", [id]
        )
        if(data.rows.length==0){
            // req.flash('error', 'Drive does not exist!!')
            return res.redirect('/drives')
        }

        const drive = data.rows[0]
        
        res.render("drives/driveinfo",{drive})
    }catch (e){
        res.sendStatus(403)
    }
})

app.get("/drives/:id/edit", async(req,res)=>{
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
        
        res.render("drives/edit",{drive})
    }catch (e){
        res.sendStatus(403)
    }
})

app.put("/drives/:id", async(req,res)=>{
    const { id } = req.params
    const {title , driveType , driveVenue , driveDate , driveTime , driveManager , driveDescription , driveImage  } = req.body;
    try{
        const data = await client.query (
            "update drives set drive_name = $1, drive_type = $2, drive_description = $3, drive_date = $4, drive_time = $5, drive_location = $6, drive_manager = $7, drive_image = $8 where drive_id = $9 returning *"
            ,[title , driveType, driveDescription , driveDate , driveTime  , driveVenue , driveManager , driveImage, id]
        )
        
        if(data.rows.length == 0){
            res.redirect(`/drives/${id}/edit`)
        }

    }catch(e){
        console.error(e.message)
    }
        
    res.redirect(`/drives/${id}`)
})

app.get('/ngo', async(req,res)=>{   
    try{
        const data = await client.query(
            "SELECT * from ngo;"
        )

        const ngos = data.rows
         
        res.render('ngo/viewNgo', {ngos})
    }catch (e) {
        res.sendStatus(403)
    }
})
// ------------------------------------------------------------------------------
app.get('/person/:id/participating', async(req,res)=>{   
    try{
        // const data = await client.query(
        //     "SELECT * from Person;"
        // )
        const today = new Date()
        const day = today.getDate()        
        const month = today.getMonth()+1
        const year = today.getFullYear()
        const { id } = req.params
        const data = await client.query("SELECT * from person p , connects_to c , drives d where p.user_name=$1 and c.user_id=p.user_id and c.drive_id = d.drive_id and d.drive_date > $2" , [id,(year + "-" + month + "-" + day)])

        const drives = data.rows
         
        res.render('user/DrivesParticipation.ejs', {drives})
    }catch (e) {
        res.sendStatus(403)
    }
})

app.get('/drives/:id/viewpaticipants', async(req,res)=>{   
    const { id } = req.params
    try{
        const data = await client.query("SELECT * from person p , connects_to c where c.drive_id=$1 and c.user_id=p.user_id" , [id])
        const persons = data.rows
        res.render('drives/ViewParticipants.ejs', {persons})

    }catch (e) {
        res.sendStatus(403)
    }
})
// ------------------------------------------------------------------------------

app.get("/viewmembers/:ngoUname", async(req,res)=>{
    const { ngoUname } = req.params

    try{
        const data = await client.query(
            "SELECT * from member natural join person where ngo_username=$1;",[ngoUname]
        )

        const views = data.rows
        
        res.render('ngo/viewmembers', {views})
    }catch (e) {
        res.sendStatus(403)
    }
})

app.get("/ngo/:id", async(req,res)=>{
    const { id } = req.params
    try{
        const data2 = await client.query(
            "select * from ngo where ngo_username = $1;", [id]
        )

        if(data2.rows.length == 0){
            res.sendStatus(403)
        }
        const ngo = data2.rows[0]

        const data1 = await client.query(
            "select * from drives where ngo_username = $1;", [id]
        )

        const drives = data1.rows;

        const data = {ngo,drives};

        if(!req.session.user){
            res.redirect('/login')
        }else{
            res.render("ngo/ngoprofile",{data});
        }
    }catch(e){
        console.log(e)
        res.sendStatus(403)
    }
})

app.get("/connect/:id", async (req,res)=>{
    const { id } = req.params

    const today = new Date()
    const day = today.getDate()        
    const month = today.getMonth()+1
    const year = today.getFullYear()
    try{
        const data = await client.query(
            "select * from person where user_name = $1 ;" , [req.session.user.username]
        )

        const user_id = data.rows[0].user_id

        const data1 = await client.query(
            "insert into connects_to (user_id, drive_id, date_of_registration) values($1, $2 , $3) returning * "
            ,[user_id , id , (year + "-" + month + "-" + day) ]
        )
                        
    }catch(e){
        console.error(e.message)
    }
    
    res.redirect('/drives')
})

app.get("/member/:id", async (req,res)=>{
    const { id } = req.params

    const today = new Date()
    const day = today.getDate()        
    const month = today.getMonth()+1
    const year = today.getFullYear()
    try{
        const data = await client.query(
            "select * from person where user_name = $1 ;" ,[req.session.user.username] 
        )

        const datango = await client.query(
            "select * from ngo where ngo_username = $1 ;" , [id]
        )

        const user_id = data.rows[0].user_id
        const ngo_username  = datango.rows[0].ngo_username

        const data1 = await client.query(
            "insert into member (user_id, ngo_username, start_date) values($1, $2 , $3) returning * "
            ,[user_id , ngo_username , (year + "-" + month + "-" + day) ]
        )
                        
    }catch(e){
        console.error(e.message)
    }
    
    res.redirect('/ngo')
})

app.post("/donate/:id", async(req,res)=>{
    const { id } = req.params
    const {amount} = req.body;
    const today = new Date()
    const day = today.getDate()        
    const month = today.getMonth()+1
    const year = today.getFullYear()

    if(amount == null || amount<=0){
        res.sendStatus(403)

    }
    try{
        const data = await client.query(
            "select * from person where user_name = $1 ;", [req.session.user.username]
        )

        const user_id = data.rows[0].user_id
        
        const data1 = await client.query(
            "insert into donate (user_id, ngo_username,amount,pay_date) values($1, $2 , $3, $4) returning * "
            ,[user_id , id , amount, (year + "-" + month + "-" + day) ]
        )
    }
    catch(e){

        console.error(e.message)
    }
    res.redirect(`/ngo/${id}`)
})

app.post("/feedback/:id", async(req,res)=>{
    const { id } = req.params
    const {feedback} = req.body;
    const today = new Date()
    const day = today.getDate()        
    const month = today.getMonth()+1
    const year = today.getFullYear()

    if(feedback == null ){
        res.sendStatus(403)

    }
    try{
        const data = await client.query(
            "select * from person where user_name = $1 ;", [req.session.user.username]
        )

        const user_id = data.rows[0].user_id
        
        const data1 = await client.query(
            "insert into feedback (user_id, ngo_username,feedback_date,feedback) values($1, $2 , $3, $4) returning * "
            ,[user_id , id , (year + "-" + month + "-" + day),feedback ]
        )
    }
    catch(e){

        console.error(e.message)
    }
    res.redirect(`/ngo/${id}`)
})

app.post("/report/:username", async(req,res)=>{
    const { username } = req.params
    const { Report } = req.body;
    if(Report == null ){
        res.sendStatus(403)
     }
    try{
        const data = await client.query(
            "select * from person where user_name = $1 ;", [req.session.user.username]
        )
        const UID = data.rows[0].user_id
        
        const data1 = await client.query(
            "insert into report (user_id, ngo_username,description) values($1, $2 , $3) returning * "
            ,[UID , username , Report]
        )
    }
    catch(e){

        console.error(e.message)
    }
    res.redirect(`/ngo/${username}`)
})

app.get("/person/:id", async(req,res) => {
    const {id } = req.params
    try{
        const data0 = await client.query(
            "select * from person where user_name = $1;", [id]
        )
        if(data0.rows.length == 0){
            res.sendStatus(403)
        }
        const person = data0.rows[0]
        const data1 = await client.query(
            "select * from drives where drive_id in(select drive_id from connects_to where user_id = $1);",[person.user_id]
        )

        const drives = data1.rows;

        const data = {person, drives}
        res.render("user/personprofile", {data});
    }catch(e){
        console.log(e)
        res.sendStatus(403)
    }
})

app.get("/", (req,res) => {
    res.render("home");
})

app.get("/OTPtest/:id", async(req, res) => {
    const {id } = req.params
    const datango = await client.query(
        "select * from ngo where ngo_username = $1 ;" , [id]
    )
    const UID = datango.rows[0].ngo_mail

    emailService(UID,id)
   
})
app.get("/OTPtestuser/:id", async(req, res) => {
    const {id } = req.params
    const datango = await client.query(
        "select * from person where user_name = $1 ;" , [id]
    )
    const UID = datango.rows[0].user_mail

    emailService(UID,id)
   
})

app.post("/verify/:username", async(req,res)=>{
    const { username } = req.params
    const { OTP } = req.body;
    if(OTP == null ){
        res.sendStatus(403)
     }
     const data = await client.query(
        "select * from superuser where user_name = $1 ;" , [username]
    )

    try{
        if(OTP==data.rows[0].otp)
        {
            const data = await client.query(
                "UPDATE ngo SET verify = 'V' WHERE ngo_username  = $1 ;", [username]
            )
        }
        else
        {
            res.redirect(`/ngo/${username}`)

        }
        
       
    }
    catch(e){

        console.error(e.message)
    }
    res.redirect(`/ngo/${username}`)
})
app.post("/verifyuser/:username", async(req,res)=>{
    const { username } = req.params
    const { OTP } = req.body;
    if(OTP == null ){
        res.sendStatus(403)
     }
     const data = await client.query(
        "select * from superuser where user_name = $1 ;" , [username]
    )

    try{
        if(OTP==data.rows[0].otp)
        {
            const data = await client.query(
                "UPDATE person SET verify = 'V' WHERE user_name  = $1 ;", [username]
            )
        }
        else
        {
            res.redirect(`/person/${username}`)

        }
        
       
    }
    catch(e){

        console.error(e.message)
    }
    res.redirect(`/ngo/${username}`)
})
app.listen(3000, ()=>{
    console.log("Listening on port 3000");
})