import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
   profileUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true
   },
   ReviewMessage: {
      type: String,
      required: true
   },
   rating: {
      type: Number,
      requireed: true
   },
}, { collection: 'reviews' });

export const Review = mongoose.model('reviews', reviewSchema);