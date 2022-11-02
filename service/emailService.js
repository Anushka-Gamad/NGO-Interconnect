const nodemailer = require('nodemailer');
const getOTP = require('./generateOtpSevice');

const emailService = (sendTo) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "ngointerconnect2022@gmail.com",
            pass: "hmdvvtzpitoqsnqw"
        }
    });
    const otp = getOTP();
    const mailOptions = {
        from: "ngointerconnect2022@gmail.com",
        to: sendTo,
        subject: "email verfiyusing OTP",
        html:"<h1> Your OTP is:" + otp + "</h1>"
    };
    transporter.sendMail(mailOptions, (error, info) =>{
        if(error){
            console.log(error);
        }
        else{
            console.log("email sent: " + info.response);
        }
    });
};

module.exports = emailService;