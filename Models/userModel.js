import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
   role: {
      type: String,
      required: true,
   },
   name: {
      type: String,
      required: true,
   },
   surname: {
      type: String,
      required: true,
   },
   username: {
      type: String,
      required: true,
      unique: true
   },
   email: {
      type: String,
      required: true,
      unique: true
   },
   isVerified: {
      type: Boolean,
      default: false,
   },
   password: {
      type: String,
      required: true
   },
   resetPasswordToken: {
      type: String,
   },
   resetPasswordExpires: {
      type: Date,
   },
}, { collection: 'users' });

export const User = mongoose.model('users', userSchema);
