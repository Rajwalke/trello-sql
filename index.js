const express = require('express');
const { Pool } = require('pg')
const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { signupSchema, signinSchema, organisationSchema } = require("./validation.js")
const { userAuth } = require("./userAuth.js")
const cookieparser = require('cookie-parser');


const connectionpoll = new Pool({
    connectionString: "postgresql://neondb_owner:npg_a5tSXmRosNY4@ep-sparkling-water-aunkkyvt-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
})
app.use(express.json());
app.use(cookieparser())

app.post("/signup", async (req, res) => {

    const { data, success, error } = signupSchema.safeParse(req.body);
    // console.log("ERROR:", error?.issues[0]?.message);
    if (!success) {
        res.status(403).json({
            message: "Invalide data-" + error?.issues[0]?.message
        });
        return;
    }
    const username = data.username;
    const email = data.email;
    const password = data.password;
    const hashPassword = await bcrypt.hash(password, 10);

    // console.log("HASHPASSWORD", hashPassword);
    const newUser = await connectionpoll.query(`INSERT INTO users (username,email,password) VALUES ($1,$2,$3) RETURNING id;`, [username, email, hashPassword]);
    if (newUser?.rows.length === 0) {
        res.status(403).json({
            message: "Already Signup! Please Signin!"
        });
        return;
    }
    // console.log("USER", newUser);

    res.json({
        message: "signup successfully!"
    })

})

app.post("/signin", async (req, res) => {

    const { data, success, error } = signinSchema.safeParse(req.body);
    if (!success) {
        res.status(403).json({
            message: error?.issues[0]?.message
        })
        return;
    }
    const email = data.email;
    const password = data.password;
    const userInfo = await connectionpoll.query(`SELECT * FROM users WHERE email=$1`, [email]);
    if (userInfo?.rows?.length === 0) {
        res.status(403).json({
            message: "Invalide credentials! Please signup !"
        });
        return;
    }
    const hashPassword = userInfo.rows[0].password;
    const isValidePassword = await bcrypt.compare(password, hashPassword);
    if (!isValidePassword) {
        res.status(403).json({
            message: "Incorrect Password!"
        });
        return;
    }
    console.log("USER ID", userInfo?.rows[0]?.id)
    const token = jwt.sign({
        id: userInfo?.rows[0]?.id
    }, "Raj@2004");
    // console.log("USER ID", token)
    res.cookie("token", token);
    res.json({
        id: userInfo?.rows[0]?.id,
        message: "signin successfully!"
    })

})

app.post("/organisation", userAuth, async (req, res) => {
    const { data, success, error } = organisationSchema.safeParse(req.body);
    if (!success) {
        res.status(403).json({
            message: error?.issues[0]?.message
        });
        return;
    }
    const orgName = data.orgName;
    // const description = data.description;
    const userid = req.userid;

    const createOrg = await connectionpoll.query(`INSERT INTO organisation (orgName,adminId) VALUES ($1,$2) RETURNING id;`, [orgName,userid]);
    console.log("create Org", createOrg);
    if (createOrg.rows.length === 0) {
        res.status(403).json({
            message: "Isuue while creating the organisation"
        });
        return;
    }
    res.json({
        adminId: userid,
        message: "Oragnisation create!"
    })
})

app.post("/organisation/:orgid",userAuth,async(req,res)=>{
    const orgId=req.params.orgid;
    const userEmail=req.body.email;
    const userid = req.userid;

    const orgInfo=await connectionpoll.query(`SELECT * from organisation WHERE id=$1`,[orgId]);

    if(orgInfo?.rows.length===0 || orgInfo?.rows[0]?.adminid!==userid){
        res.status(403).json({
            message:"You are not admin or organisation not exist"
        });
        return;
    }
    // member is not alreayd inside the organisation
    let memberid=await connectionpoll.query(`SELECT id from users WHERE email=$1`,[userEmail]);
   
    if(memberid?.rows.length===0){
        res.status(403).json({
            message:"This email is not register ! "
        });
        return;
    }else{
        memberid=memberid?.rows[0]?.id;
    }
    const isAlreadyMember=await connectionpoll.query(`SELECT * FROM members WHERE userid=$1 AND orgid=$2`,[memberid,orgId]);

    if(isAlreadyMember?.rows.length>=1){
        res.status(403).json({
            message:"This user is alredy member of the organisation."
        });
        return;
    }

    const addMember=await connectionpoll.query(`INSERT INTO members (orgid,userid) VALUES ($1,$2) RETURNING id;`,[orgId,memberid]);
    console.log("addMember",addMember)
    
    res.json({
        id:addMember?.rows[0]?.id,
        message:"new member is added"
    })
})

app.listen(4000);