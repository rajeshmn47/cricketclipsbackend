const jwt = require("jsonwebtoken");
const User = require("../models/user");

module.exports.checkloggedinuser = function (req, res, next) {
    //console.log('checking')
    const tokenheader = req.body.headers || req.headers.servertoken;
    const activatekey = process.env.activatekey;
    console.log(tokenheader, "tokenheader")
    if (tokenheader) {
        jwt.verify(tokenheader, activatekey, (err, decoded) => {
            if (!err) {
                req.body.uidfromtoken = decoded.userid;
            }
            next();
        });
    } else {
        res.status(400).json({
            success: false,
            message: "not authenticated"
        });
    }
}

module.exports.checkloggedinadmin = async function (req, res, next) {
    //console.log('checking')
    const tokenheader = req.body.headers || req.headers.servertoken;
    const activatekey = process.env.activatekey;
    if (tokenheader) {
        jwt.verify(tokenheader, activatekey, async (err, decoded) => {
            if (!err) {
                const user = await User.findById(decoded.userid);
                if (user.role.toLowerCase() !== "admin") {
                    return res.status(403).json({
                        success: false, message: "forbidden"
                    })
                }
                req.body.uidfromtoken = decoded.userid;
            }
            next();
        });
    } else {
        res.status(400).json({
            success: false,
            message: "not authenticated"
        });
    }
}