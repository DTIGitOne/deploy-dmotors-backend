import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
   profileUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true
   },
   pfpURL: {
      type: String,
      default: 'defaultUser.png',
   },
   bio: {
      type: String,
   }
}, { collection: 'profile' });

export const Profile = mongoose.model('profile', profileSchema);