const jwt = require("jsonwebtoken")
const userAuth = (req, res, next) => {
    const token = req.cookies.token;
    // console.log("TOKEN IS", token);
    if (!token) {
        res.status(403).json({
            message: "You are not authanticate!"
        });
        return;
    }
    try {
        const parseTheToken = jwt.verify(token, "Raj@2004");
        req.userid = parseTheToken.id;
        next();
    } catch (err) {
        res.status(403).json({
            message: "Something went wrong"
        })
    }
}

module.exports = {
    userAuth
}