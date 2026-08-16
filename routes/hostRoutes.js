const express=require("express");

const router=express.Router();

const {createHost, verifyHost}= require("../controllers/hostController");


router.post("/",createHost);
router.put("/verify/:id", verifyHost);


module.exports=router;