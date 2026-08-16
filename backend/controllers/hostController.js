const Host = require("../models/Host");


const createHost = async(req,res)=>{

    try{

        const host = new Host(req.body);

        await host.save();


        res.status(201).json({
            message:"Host Verification Submitted",
            host:host
        });


    }
    catch(error){

        res.status(500).json({
            error:error.message
        });

    }

};
const verifyHost = async(req,res)=>{

    try{

        const host = await Host.findByIdAndUpdate(

            req.params.id,

            {
                verificationStatus:"Verified"
            },

            {
                new:true
            }

        );


        res.json({

            message:"Host Verified and Garage Published",

            host:host

        });


    }
    catch(error){

        res.status(500).json({

            error:error.message

        });

    }

};
module.exports = {
    createHost,
    verifyHost
};