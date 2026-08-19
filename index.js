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
// Signup ✅
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
// Signin ✅
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
//create organisation and add admin as member✅ 
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
    const insertIntoMember=await connectionpoll.query("INSERT INTO members (orgid,userid) VALUES ($1,$2) RETURNING id;",[createOrg.rows[0].id,userid]);
    if(insertIntoMember.rows.length===0){
        res.status(403).json({
            message:"Not add inside the member"
        });
        return;
    }
    // `INSERT INTO members (orgid,userid) VALUES ($1,$2) RETURNING id;`,[orgId,memberid]
    res.json({
        adminId: userid,
        message: "Oragnisation create!"
    })
})
// add member inside the organisation ✅
app.post("/organisation/:orgid",userAuth,async(req,res)=>{ 
    const orgId=req.params.orgid;
    const userEmail=req.body.email;
    const userid = req.userid;

    const orgInfo=await connectionpoll.query(`SELECT * from organisation WHERE id=$1`,[orgId]);
    // console.log("Org Info",orgInfo?.rows[0]);
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
            message:"This email is not register or you added a invalid email ! "
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
// Delete member from organisation ✅
app.delete("/organisation/:orgid",userAuth,async(req,res)=>{
    const userId=req.userid;
    const memberId=req.query.memberId;
    const orgId=req.params.orgid;
    console.log(userId,memberId,orgId);

    const orgInfo=await connectionpoll.query(`SELECT * FROM organisation WHERE id=$1`,[orgId]);

    if(orgInfo?.rows.length===0 || orgInfo?.rows[0]?.adminid!==userId){
        res.status(403).json({
            message:"You are not admin or organisation ot exist!"
        });
        return;
    }

    const deletMember=await connectionpoll.query(`DELETE FROM members WHERE orgid=$1 AND userid=$2`,[orgId,memberId]);
    if(deletMember.rowCount===0){
        res.status(403).json({
            message:"This member not exist inside organisation!"
        });
        return
    }
    console.log("Delete :",deletMember)

    res.json({
        message:"Member is delete."
    })
})
// Get all members of organisation ✅
app.get("/organisation/:orgid/members",userAuth,async(req,res)=>{
    const orgId=req.params.orgid;
    const userId=req.userid;
    const orgInfo=await connectionpoll.query(`SELECT * FROM organisation WHERE id=$1`,[orgId]);

    if(orgInfo?.rows.length===0 || orgInfo?.rows[0]?.adminid!==userId){
        res.status(403).json({
            message:"You are not admin or organisation ot exist!"
        });
        return;
    }

    const allMembers=await connectionpoll.query("SELECT * FROM members WHERE orgid=$1",[orgId]);
    if(allMembers?.rows.length===0){
        res.status(403).json({
            message:"No Memeber exist in organisation!"
        });
        return;
    }

    res.json({
        members:allMembers?.rows
    });
});

// Create board inside the organisation ✅
app.post("/organisation/:orgid/board",userAuth,async(req,res)=>{
    const userid=req.userid;
    const orgid=req.params.orgid;
    const boardName=req.body.boardName;
    console.log(userid,orgid,boardName);
    //user should member or admin
    const memberInfo=await connectionpoll.query("SELECT * FROM members WHERE orgid=$1 AND userid=$2",[orgid,userid]);
    console.log("Member Info",memberInfo?.rows[0]);
    if(memberInfo.rows.length===0){
        res.status(403).json({
            message:"You are not Member of organisation!"
        });
        return;
    };

    const createBoard=await connectionpoll.query("INSERT INTO boards (boardname,orgid,board_created_by) VALUES ($1,$2,$3) RETURNING id;",[boardName,orgid,userid]);
    if(createBoard.rows.length===0){
        res.json({
            message:"Their is some issue! Board is not create"
        });
        return;
    };
    res.json({
        id:createBoard?.rows[0]?.id,
        message:"Board is created! "
    });

})

// get all boards as per organization ✅
app.get("/organisation/:orgid/boards",userAuth,async(req,res)=>{
    const orgid=req.params.orgid;
    const userid=req.userid;

    const isMember=await connectionpoll.query("SELECT * FROM members WHERE orgid=$1 AND userid=$2",[orgid,userid]);
    if(isMember.rows.length===0){
        res.status(403).json({
            message:"this Info not provide to you..you are not member of this organisation"
        });
        return;
    }

    const allBoardsOrg=await connectionpoll.query("SELECT * FROM boards WHERE orgid=$1",[orgid]);
    console.log("All boars",allBoardsOrg?.rows);
    if(allBoardsOrg?.rows.length===0){
        res.json({
            message:"No board found for this orgaisation!"
        });
        return;
    }
    res.json({
        allboard:allBoardsOrg?.rows
    })
})
// Deleet the baord from organisation ✅
app.delete("/organisation/:orgid/boards",userAuth,async(req,res)=>{
    const userid=req.userid;
    const orgid=req.params.orgid;
    const boardid=req.query.boardid;
    // console.log(userid,orgid,boardid);

    // if board is created by that user then only board is deleted  or you are admin of organisation 
    const admin=await connectionpoll.query("SELECT adminid FROM organisation WHERE id=$1",[orgid]);
    // console.log(admin);
    if(admin?.rows[0].adminid!==userid){
        console.log("You are not admin of this organisation");
    }
    
    const boardInfo=await connectionpoll.query("SELECT * FROM boards WHERE id=$1 AND board_created_by=$2",[boardid,userid]);
    if(boardInfo?.rows.length===0){
        res.status(403).json({
            message:"You are not creator of this board or board is not exist!"
        });
        return;
    }
    else if(admin?.rows[0].adminid!==userid && boardInfo?.rows.length===0){
        res.status(403).json({
            message:"you are not admin of this organisation"
        });
        return;
    }
    const deleetBoard=connectionpoll.query("DELETE FROM boards WHERE id=$1",[boardid]);
    if(deleetBoard.rowCount===0){
        res.status(403).json({
            message:"Board is not deleted"
        });
        return;
    }

    res.json({
        // adminId:admin?.rows[0].adminid,
        message:"Board is deleted"
    })
})

// cerate issue by board  ✅
app.post("/:boardid/issues",userAuth,async(req,res)=>{
    const issue=req.body.issue;
    const userid=req.userid;
    const boardid=req.params.boardid;
    // const orgid=req.params.orgid;
    // const checkUser=await connectionpoll.query("SELECT * FROM users WHERE userid=$1",[userid]);
    // if(checkUser.rows.length===0){
    //     res.status(403).json({
    //         message:"user is not valide"
    //     });
    //     return;
    // }
    // console.log("user is Valide you can go ahe");
    // check tha user is in organisation where board is cerated 
    // const checkValideUser=await connectionpoll.query("SELECT orgid FROM boards where id=$1 AND SELECT orgid,userid  FROM members WHERE orgid=orgid AND userid=$2",[boardid,userid]);
    const checkValideUser=await connectionpoll.query(`SELECT * 
        FROM boards 
        JOIN members 
        ON boards.orgid =members.orgid
        WHERE boards.id=$1 AND members.userid=$2`,[boardid,userid]);
    console.log(checkValideUser?.rows);

    // const issueCreate=await connectionpoll.query("INSERT INTO issues (issue,userid,boardid,status) VALUES ($1,$2,$3,$4) RETURNING id;",[issue,userid,boardid,"pending"]);
    // if(issueCreate.rows.length===0){
    //     res.status(403).json({
    //         message:"Issue is not create!.."
    //     });
    //     return;
    // }
    // res.json({
    //     id:issueCreate.rows[0].id,
    //     message:"Issue is create"
    // });
});

// api that divide task as pending,in progess,done
app.get("/:boardid/issues",userAuth,async(req,res)=>{
    const boardid=req.params.boardid;
    try{
        const doneIssues=await connectionpoll.query("SELECT * FROM issues WHERE boardid=$1 AND status='done'",[boardid]);
        const pendingIssues=await connectionpoll.query("SELECT * FROM issues WHERE boardid=$1 AND status='pending'",[boardid]);
        const inProgressIssues=await connectionpoll.query("SELECT * FROM issues WHERE boardid=$1 AND status='in_progress'",[boardid]);
    
        res.json({
            doneIssues:doneIssues?.rows,
            pendingIssues:pendingIssues?.rows,
            inProgressIssues:inProgressIssues?.rows
        });

        }catch(err){
            res.status(403).json({
            error:err.message
            })
        }
});

// edit staus of task
app.post("/:boardid/:issueid/:status",userAuth,async(req,res)=>{
    const boardid=req.params.boardid;
    const status=req.params.status.toLowerCase();
    const issueid=req.params.issueid;
    const userid=req.userid;
    const validStatus = ["done", "in_progress", "pending"];
    
    if(!validStatus.includes(status)){
        res.status(403).json({
            message:"Status is not valide !"
        });
        return;
    }

    const currIssue=await connectionpoll.query("SELECT * FROM issues WHERE id=$1 AND boardid=$2",[issueid,boardid]);

    if(currIssue.rows.length===0){
        res.status(500).json({
            message:"Not get the issue!"
        });
       return;
    };

    const updateStatus=await connectionpoll.query("UPDATE issues SET status=$1 WHERE id=$2 AND boardid=$3",[status,issueid,boardid]);
    if(updateStatus.rowCount===0){
        res.status(403).json({
            message:"Oops! status is not update "
        });

        return;
    }
    res.json({
        message:"Status is updated "
    })
});

// delete issue
app.delete("/boards/:issueid/",async(req,res)=>{
    const issueid=req.params.issueid;

    const issueDelet=await connectionpoll.query("DELETE FROM issues WHERE id=$1;",[issueid]);
    if(issueDelet.rowCount===0){
        res.status(403).json({
            message:"Somthing went wrong! issue is not delete"
        });
        return;
    }

    res.json({
        message:"Issue deleted!"
    });
    
})

app.listen(4000);
