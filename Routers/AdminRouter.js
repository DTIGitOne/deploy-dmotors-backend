import express from 'express';
import { roleMiddleware , authMiddleware } from '../Middleware/auth.js';
import { User } from '../Models/userModel.js';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Profile } from '../Models/profileModel.js';
import { Car } from '../Models/carModel.js';
import { randomImageName } from '../Functions/Functions.js';

const storage = multer.memoryStorage();
const upload = multer({storage: storage});
 
const s3 = new S3Client({
   credentials: {
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_ACCESS,
   },
   region: process.env.BUCKET_LOCATION
});

const adminRouter = express.Router();

//get users //////////////////////////////////////////////////////////

adminRouter.get('/users', authMiddleware, roleMiddleware("ADMIN"), async (req, res) => {
   try {
      const { page = 1, limit = 10 } = req.query;

      const users = await User.find()
         .skip((page - 1) * limit)
         .limit(parseInt(limit))
         .select('name surname username email isVerified role'); 

      const usersWithPfpURL = await Promise.all(users.map(async (user) => {
         const profile = await Profile.findOne({ profileUser: user._id }).select('pfpURL');

         if (!profile) {
            return {
               ...user.toObject(),
               pfpURL: 'defaultUser.png'
            };
         }

         const getObjectParams = {
            Bucket: process.env.BUCKET_NAME,
            Key: profile.pfpURL, 
         };
         const command = new GetObjectCommand(getObjectParams);
         const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

         return {
            ...user.toObject(),
            pfpURL: url
         };
      }));

      const totalUsers = await User.countDocuments();
      const totalPages = Math.ceil(totalUsers / limit);

      res.status(200).send({ 
         users: usersWithPfpURL,
         totalPages,
         currentPage: parseInt(page)
      });
   } catch (e) {
      console.error(e);
      res.status(400).send({ errorMessage: "An error has occurred" });
   }
});

// delete user ////////////////////////////////////////////////////////// 

adminRouter.delete('/delete/:id', authMiddleware, roleMiddleware("ADMIN"), async (req, res) => {
   try {
       const { id } = req.params;

       const findCar = await Car.findById(id);

       if (!findCar) {
           return res.status(404).send({ message: 'Car not found' });
       }

       const objectsToDelete = findCar.CarImages.map((key) => ({ Key: key }));

       const deleteParams = {
           Bucket: process.env.BUCKET_NAME,
           Delete: { Objects: objectsToDelete }
       };
       const deleteCommand = new DeleteObjectsCommand(deleteParams);
       await s3.send(deleteCommand);

       const deletedCar = await Car.findByIdAndDelete(id);

       res.status(200).send({ message: 'Car deleted successfully', deletedCar });
   } catch (error) {
       console.error('Error deleting car:', error);
       res.status(500).send({ error: 'An error occurred while deleting the car', details: error.message });
   }
});

// update user profile  //////////////////////////////////////////////////////////

adminRouter.patch('/profile/update/:id', upload.single('image'), authMiddleware, roleMiddleware("ADMIN"), async (req, res) => {
   const { id } = req.params;
   const { bio } = req.body || {};

   if (!id) return res.status(400).send({ message: "missing user id" });

   try {
      const findUser = await User.findById(id);

      if (!findUser) return res.status(400).send("User dosent exist");

      if (findUser.role === "ADMIN") return res.status(400).send("Please update an admin account through private route");

      const findProfile = await Profile.findOne({ profileUser: id });

      if (!findProfile) {
         return res.status(404).send({ message: "Profile not found" });
      }

      let currentPfpName = undefined;

      if(findProfile.pfpURL) {
        currentPfpName = findProfile.pfpURL;
        if(currentPfpName === "defaultUser.png") {
          currentPfpName = undefined
        }
      }

      const updates = {};

      if(req.file) {
         const buffer = await sharp(req.file.buffer).resize({height: 1080, width: 1920, fit: "contain"}).toBuffer()
         const imageName = currentPfpName ? currentPfpName : randomImageName();
         const params = {
           Bucket: process.env.BUCKET_NAME,
           Key: imageName,
           Body: buffer,
           ContentType: req.file.mimetype,
         }
   
         const command = new PutObjectCommand(params)
         await s3.send(command)

         updates.pfpURL = imageName;
      }

      if (bio !== undefined && bio !== findProfile.bio) {
         updates.bio = bio;
      }

      const updatedProfile = await Profile.findByIdAndUpdate(findProfile._id, { $set: updates }, { new: true });

      if (!updatedProfile) {
        return res.status(404).send({ message: "Profile not found" });
      }

      res.status(200).send({ message: "Profile updated successfully", updatedProfile });
   } catch (e) {
      console.log(e);
      res.status(500).send({ message: "An error occurred while updating profile details", error: e });
   }
});

// update user data  //////////////////////////////////////////////////////////b

adminRouter.patch('/update/:id', authMiddleware, roleMiddleware("ADMIN"), async ( req , res ) => {
   const { id } = req.params;
   const { username ,  role } = req.body || {};

   if(!id) return res.status(400).send({message: "missing user id"});

   if (username) {
      if (username.length > 18) return res.status(404).send({ usernameMessage: "Username is too long" });
      if (username.length < 2) return res.status(404).send({ usernameMessage: "Username is too short" });
   }

   const findUser = await User.findById(id);

   try {
      const updates = {};
      if(username !== findUser.username) {
         updates.username = username;
      };
      if (role && findUser.role !== "ADMIN") {
         updates.role = role;
      };

      const updatedUser = await User.findByIdAndUpdate(id, { $set: updates }, { new: true });

      if (!updatedUser) {
        return res.status(404).send({ message: "User not found" });
      }

      res.status(200).send({ message: "User updated successfully" });
   } catch (e) {
      res.status(500).send({ message: "An error occurred while updating user details", error: e });
   };
});

export default adminRouter;