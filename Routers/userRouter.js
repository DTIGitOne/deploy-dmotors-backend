import express from 'express';
import { User } from '../Models/userModel.js';
import { isValidEmail , isValidLetters, isValidMongoString, isValidNumberCode , randomImageName } from '../Functions/Functions.js';
import { roleMiddleware , authMiddleware } from '../Middleware/auth.js';
import { config } from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from "bcrypt";
import crypto from 'crypto';
import { generateRandomSixDigitNumber } from '../Functions/Functions.js';
import verificationCodeModel from '../Models/verificationCodeModel.js';
import { sendForgotMailFunc, sendMailFunc } from '../mail/mailFunction.js';
import { sentEmailCounter } from '../mail/mailCounterFunction.js';
import { Profile } from '../Models/profileModel.js';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Car } from '../Models/carModel.js';
import { Review } from '../Models/ReviewModel.js';
import { Recommended } from '../Models/RecommencedModel.js';
import { Message } from '../Models/messageModel.js';
import { Chat } from '../Models/ChatModel.js';
config();

const userRouter = express.Router();

const storage = multer.memoryStorage();
const upload = multer({storage: storage});
 
const s3 = new S3Client({
   credentials: {
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_ACCESS,
   },
   region: process.env.BUCKET_LOCATION
});

// Login User //////////////////////////////////////////////////////////

userRouter.post('/login', authMiddleware, roleMiddleware("GUEST") , async ( req , res) => {
   const { username , email , password } = req.body || {};
   const role = req.role;

   if (role !== "GUEST") {
      return res.status(400).send("Already logged in");
   }

   if(!username) return res.status(404).send({usernameMessage: "username is missing"}); 
   if(!email) return res.status(404).send({emailMessage: "Email is missing"});
   if(!password) return res.status(404).send({passwordMessage: "Password is missing"}); 

   try {
     const findUserEmail = await User.findOne({ email: email });

     const findUserUsername = await User.findOne({ username: username });

     if (!findUserEmail) return res.status(404).send({Message: "Incorrect user details"});
     if (!findUserUsername) return res.status(404).send({Message: "Incorrect user details"});

     if (findUserEmail.email !== findUserUsername.email) return res.status(404).send({Message: "Incorrect user details"});
     if (findUserEmail.username !== findUserUsername.username) return res.status(404).send({Message: "Incorrect user details"});

     const match = await bcrypt.compare(password, findUserEmail.password);


     if(!match) {
       return res.status(404).send({Message: "Incorrect user details"});
     }; 

     if(findUserEmail.isVerified !== true) {
       try {
         try {
            await sentEmailCounter(findUserEmail._id);
         } catch (e) {
            return res.status(400).send({message: "Too many request, please wait before sending more requets"});
         };

         const randomSixDigitNumber = generateRandomSixDigitNumber();

         const existingVerificationCode = verificationCodeModel.findOne({user: findUserEmail._id});

         if(existingVerificationCode) {
            await verificationCodeModel.deleteMany({user: findUserEmail._id});
         };

         const newVerificationCode = new verificationCodeModel({
            user: findUserEmail._id,
            code: randomSixDigitNumber
         });

         try {
            await newVerificationCode.save();
        } catch (saveError) {
            return res.status(400).send({ message: "Error saving verification code", error: saveError });
        }

         await sendMailFunc(randomSixDigitNumber , findUserEmail.email);

         return res.status(403).send({message: "Account not verified (please check your email for new code", id: findUserEmail._id});
       } catch (e) {
         return res.status(400).send({message: "Something went wrong", error: e});
       }
     };

     const token = jwt.sign( { _id: findUserEmail._id , role: findUserEmail.role, username: findUserEmail.username } , process.env.JWT_KEY );

     return res.status(200).send({LoginMessage: "Login succesfull" , token});
   } catch (e) {
     return res.status(400).send(e);
   };
});

// create user //////////////////////////////////////////////////////////

userRouter.post('/signup', authMiddleware, roleMiddleware("GUEST") , async ({ body }, res) => {
   const { name, surname, username, email, password } = body || {};

   try {
      if (!name) return res.status(404).send({ nameMessage: "Name is missing" });
      if (name.length > 30) return res.status(404).send({ nameMessage: "Name is too long (over 30 characters)" });
      if (!isValidLetters(name)) return res.status(404).send({ nameMessage: "Name can only contain letters" });

      ///////////////////////////////////////////////////////////////
      if (!surname) return res.status(404).send({ surnameMessage: "Surname is missing" });
      if (surname.length > 40) return res.status(404).send({ surnameMessage: "Surname is too long (over 40 characters)" });
      if (!isValidLetters(surname)) return res.status(404).send({ surnameMessage: "Surname can only contain letters" });

      ///////////////////////////////////////////////////////////////
      if (!username) return res.status(404).send({ usernameMessage: "Username is missing" });
      if (username.length > 18) return res.status(404).send({ usernameMessage: "Username is too long" });
      if (username.length < 2) return res.status(404).send({ usernameMessage: "Username is too short" });

      ///////////////////////////////////////////////////////////////
      if (!email) return res.status(404).send({ emailMessage: "Email is missing" });
      if (!isValidEmail(email)) {
         return res.status(400).send({ emailMessage: "Incorrect email type" });
      }
      if (!password) return res.status(404).send({ passwordMessage: "Password is missing" });
      if (password.length < 8) return res.status(400).send({ passwordMessage: "Password must contain at least 8 characters" });

      
      try {
         const salt = await bcrypt.genSalt(15);

         const role = "CLIENT";

         const newUser = new User({
            role,
            name,
            surname,
            username,
            email,
            password
         });

         const hash = await bcrypt.hash ( newUser.password, salt);

         newUser.password = hash;

         const createUser = await newUser.save();

         const findUserEmail = await User.findOne({ email: email });

         const findUserUsername = await User.findOne({ username: username });

         if (findUserEmail.email !== findUserUsername.email) return res.status(404).send({Message: "Incorrect user details"});
         if (findUserEmail.username !== findUserUsername.username) return res.status(404).send({Message: "Incorrect user details"});

         const newProfile = new Profile({
            profileUser: findUserEmail._id
         });

         await newProfile.save();

         const randomSixDigitNumber = generateRandomSixDigitNumber();

         await verificationCodeModel.create({ user: createUser._id, code: randomSixDigitNumber });

         await sendMailFunc(randomSixDigitNumber , email);
         
         createUser.password = undefined;

         res.status(201).send({ message: `please check your email`, id: createUser._id });
      } catch (e) {
         if (e.code === 11000) {
            return res.status(400).send({ message: "username or email already exist" });
         }
         console.log(e);
         return res.status(500).send({ errorMessage: "There was an issue with creating your account", e });
      }
   } catch (e) {
      res.status(400).send({ e });
   }
});


userRouter.post('/create-review/:id', authMiddleware, roleMiddleware("CLIENT"), async (req, res) => {
   const { id } = req.params;
   const { ReviewMessage , rating } = req.body || {};
   const userIdToken = req.user._id.toString();


   if (!ReviewMessage) {
      return res.status(400).send({ message: "Review is missing" });
   }

   if (ReviewMessage.length > 100) {
      return res.status(400).send({ message: "Review is too long" });
   }

   if (!rating) {
      return res.status(400).send({ message: "Rating is missing" });
   }

   if (rating > 5) {
      return res.status(400).send({ message: "Rating cant be above 5" });
   }

   if (rating < 1) {
      return res.status(400).send({ message: "Rating cant be less than 1" });
   }

   if (id !== userIdToken) {
      return res.status(403).send("Forbidden");
   }

   try {
      const findGetReviews = await Review.findOne({ profileUser: userIdToken });

      if (findGetReviews) {
         return res.status(400).send({message: "User already has a review"});
      }

      const newReview = new Review({
         profileUser: userIdToken,
         ReviewMessage,
         rating
      });

      await newReview.save();
      res.status(201).send({ message: "Review created successfully" });
   } catch (e) {
      res.status(500).send({ message: "Something went wrong creating your review", error: e.message });
   }
});

userRouter.get('/reviews', authMiddleware, roleMiddleware("GUEST"), async (req, res) => {
   try {
     const reviews = await Review.aggregate([
       { $sample: { size: 5 } },
       {
         $lookup: {
           from: 'users',
           localField: 'profileUser',
           foreignField: '_id',
           as: 'user'
         }
       },
       { $unwind: '$user' },
       {
         $lookup: {
           from: 'profile',
           localField: 'user._id',
           foreignField: 'profileUser',
           as: 'profile'
         }
       },
       { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } }, 
       {
         $project: {
           ReviewMessage: 1,
           rating: 1,
           username: '$user.username',
           pfpURL: { $ifNull: ['$profile.pfpURL', 'defaultUser.png'] }
         }
       }
     ]);
 
     if (!reviews || reviews.length === 0) {
       console.log('No reviews found.');
       return res.status(404).json({ error: 'No reviews found' });
     }

     for (const review of reviews) {
       if (review.pfpURL) {
         const getObjectParams = {
           Bucket: process.env.BUCKET_NAME,
           Key: review.pfpURL,
         };
         const command = new GetObjectCommand(getObjectParams);
         const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
         review.pfpURL = url;
       }
     }
 
     res.status(200).json(reviews);
   } catch (err) {
     console.error('Error fetching reviews:', err);
     res.status(500).json({ error: 'An error occurred while fetching reviews' });
   }
 });
 

userRouter.post('/verify-gmail/:id', authMiddleware, roleMiddleware("GUEST") , async (req , res) => {
     const { code } = req.body || {};
     const { id } = req.params;
     if(!code || !id) return res.status(400).send("Missing data for email verification");
     if(!isValidMongoString(id)) return res.status(400).send("Invalid Id");
     if(!isValidNumberCode(code)) return res.status(400).send("Invalid code format");

     try {
       const isUser = await User.findById(id);
       if(!isUser) return res.status(400).send("No user found");
       const entry = await verificationCodeModel.findOne({code , user: id});
       if(!entry) return res.status(400).send({codeMessage:"Incorrect code"});
       await User.findByIdAndUpdate(id, {isVerified: true});
       await verificationCodeModel.findByIdAndDelete(entry._id);

       const token = jwt.sign({ _id: isUser._id , role: isUser.role, username: isUser.username }, process.env.JWT_KEY);

       res.status(200).send({message: "User email verified", token: token});
     } catch(e) {
      console.error("Error during verification process:", e);
      res.status(400).send({message:"Something went wrong", error: e});
     };
});

userRouter.get('/resend-verify-code/:id', authMiddleware, roleMiddleware("GUEST") , async ( req , res) => {
   const { id } = req.params || {};

   const existingUser = await User.findById(id);

   if(!existingUser) return res.status(400).send({message: "user dosent exist"});
   if(existingUser.isVerified === true) return res.status(400).send({message: "user already verified"});

   try {
      await sentEmailCounter(id);
   } catch (e) {
      return res.status(400).send({messageNumber: "Too many request, please wait before sending more requets"});
   };
 
   try {
         const randomSixDigitNumber = generateRandomSixDigitNumber();

         const existingVerificationCode = verificationCodeModel.findOne({user: id});

         if(existingVerificationCode) {
            await verificationCodeModel.deleteMany({user: id});
         };

         const newVerificationCode = new verificationCodeModel({
            user: id,
            code: randomSixDigitNumber
         });

         try {
            await newVerificationCode.save();
        } catch (saveError) {
            return res.status(400).send({ message: "Error saving verification code", error: saveError });
        }

         await sendMailFunc(randomSixDigitNumber , existingUser.email);

         return res.status(200).send({message: "New code has been sent"});
   } catch (e) {
      return res.status(400).send({ message: "Error saving verification code", error: e });
   };
   
});

// update user //////////////////////////////////////////////////////////

userRouter.patch('/update/:id', authMiddleware, roleMiddleware("CLIENT"), async (req, res) => {
   const { id } = req.params;
   const { password, newPassword, username } = req.body || {};
   const userIdToken = req.user._id.toString();

   if (!id) return res.status(400).send({ message: "Missing user ID" });
   if (id !== userIdToken) return res.status(400).send({ message: "Invalid ID" });

   if (username) {
      if (username.length > 18) return res.status(400).send({ usernameMessage: "Username is too long" });
      if (username.length < 2) return res.status(400).send({ usernameMessage: "Username is too short" });
   }

   if (newPassword) {
      if (newPassword.length < 8) return res.status(400).send({ passwordMessage: "Password must contain at least 8 characters" });
   }

   try {
      const findUser = await User.findById(id);

      if (!findUser) {
         return res.status(400).send("User doesn't exist");
      }

      const match = await bcrypt.compare(password, findUser.password);

      if (!match) {
         return res.status(400).send({ message: "Incorrect user details" });
      }

      const updates = {};

      if (username && username !== findUser.username) {
         updates.username = username;
      }

      if (newPassword) {
         const salt = await bcrypt.genSalt(15);
         const hash = await bcrypt.hash(newPassword, salt);
         updates.password = hash;
      }

      try {
         await User.findByIdAndUpdate(id, updates, { new: true });
         res.status(200).send({ message: "User updated successfully" });
      } catch (err) {
         if (err.code === 11000 && err.keyPattern && err.keyPattern.username) {
            return res.status(400).send({ message: "Username already exists" });
         }
         return res.status(400).send({ message: "Error updating user", error: err });
      }
   } catch (e) {
      return res.status(400).send({ message: "Error updating user", error: e });
   }
});


userRouter.post('/forgot-password', authMiddleware, roleMiddleware("GUEST"), async (req, res) => {
   const { email } = req.body || {};

   if (!email) {
      return res.status(400).send({ message: "Email is required" });
   }

   try {
      const user = await User.findOne({ email });

      if (!user) {
         return res.status(404).send({ message: "User not found" });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = Date.now() + 3600000; // 1 hour

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpires;
      await user.save();

      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      await sendForgotMailFunc(email, resetLink);

      res.status(200).send({ message: "Password reset email sent" });
   } catch(error) {
      res.status(500).send({ error: "An error occurred while processing your request", details: error.message });
   }
});

userRouter.patch('/reset-password', async (req, res) => {
   const { token, newPassword } = req.body;

   if (!token || !newPassword) {
      return res.status(400).send({ message: "Token and new password are required" });
   }

   try {
      const user = await User.findOne({ 
         resetPasswordToken: token,
         resetPasswordExpires: { $gt: Date.now() } 
      });

      if (!user) {
         return res.status(400).send({ message: "Invalid or expired token" });
      }

      const saltRounds = 15;
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(200).send({ message: "Password has been reset successfully" });
   } catch (error) {
      res.status(500).send({ error: "An error occurred while resetting your password", details: error.message });
   }
});


// update profile //////////////////////////////////////////////////////////

userRouter.patch('/profile/update/:id', upload.single('image'), authMiddleware, roleMiddleware("CLIENT"), async (req, res) => {
   const { id } = req.params;
   const { bio } = req.body || {};
   const userIdToken = req.user._id;
   const userIdTokenString = userIdToken.toString();

   if (!id) return res.status(400).send({ message: "missing user id" });
   if (id !== userIdTokenString) return res.status(400).send({ message: "invalid id" });

   try {
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

      if (bio.length > 190) {
         return res.status(400).send({bioMessage: `Bio too long (${bio.length})`});
      } 

      if (bio !== undefined && bio !== findProfile.bio && bio !== "undefined") {
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

//get user //////////////////////////////////////////////////////////

userRouter.get('/:id', authMiddleware, roleMiddleware("GUEST"), async (req, res) => {
   const { id } = req.params;

   if (!id) return res.status(400).send("No id provided");

   try {
       const user = await User.findById(id);

       if (!user) {
           return res.status(404).send({ message: 'User not found' });
       }

       const listings = await Car.find({ Seller: user._id });
       const profileExt = await Profile.find({ profileUser: user._id });

       for (const listing of listings) {
           if (listing.CarImages.length > 0) {
               const firstImageKey = listing.CarImages[0];
               const getObjectParams = {
                   Bucket: process.env.BUCKET_NAME,
                   Key: firstImageKey,
               };
               const command = new GetObjectCommand(getObjectParams);
               const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
               listing.CarImages = [url]; 
           }
       }

       for (const profile of profileExt) {
           const getObjectParams = {
               Bucket: process.env.BUCKET_NAME,
               Key: profile.pfpURL,
           };

           const command = new GetObjectCommand(getObjectParams);
           const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
           profile.pfpURL = url;
       }

       res.status(200).send({
           username: user.username,
           name: user.name,
           surname: user.surname,
           email: user.email,
           role: user.role,
           bio: profileExt.length > 0 ? profileExt[0].bio : "",
           pfp: profileExt.length > 0 ? profileExt[0].pfpURL : "",
           listings 
       });

   } catch (e) {
       console.error(e);
       res.status(500).send({ error: `An error occurred (User with the id:${id} does not exist)`, message: "User does not exist" });
   }
});


// delete user //////////////////////////////////////////////////////////

userRouter.delete('/delete/:id', authMiddleware, roleMiddleware("CLIENT"), async (req, res) => {
   try {
       const { id } = req.params;
       const userIdToken = req.user._id.toString(); 

       const findUser = await User.findById(id);

       if (!findUser) {
           return res.status(404).send({ message: 'User not found' });
       }

       if (findUser._id.toString() !== userIdToken) {
           return res.status(403).send({ message: 'Not authorized' });
       }

       const deletedMessages = await Message.deleteMany({ 
         $or: [{ sender: id }, { receiver: id }]
       });
       const deletedChats = await Chat.deleteMany({ users: id });
       const deletedUser = await User.findByIdAndDelete(id);
       const deletedCars = await Car.deleteMany({ Seller: id });
       const deletedProfile = await Profile.findOneAndDelete({ profileUser: id });
       const deletedReview = await Review.deleteMany({ profileUser: id });
       const deletedRecommended = await Recommended.deleteMany({ SelectedUser: id });

       res.status(200).send({ message: 'User deleted successfully', deleted: `User:${deletedUser},Cars:${deletedCars},Profile:${deletedProfile},Review:${deletedReview},Recommended:${deletedRecommended}` });
   } catch (error) {
       console.error('Error deleting user:', error);
       res.status(500).send({ error: 'An error occurred while deleting the user', details: error.message });
   }
})

export default userRouter;