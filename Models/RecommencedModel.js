import mongoose from "mongoose";

const recommendedSchema = new mongoose.Schema({
   SelectedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true
   },
   Brand: {
      type: Array,
      required: true
   },
   Model: {
      type: Array,
      required: true
   },
   currentIndex: {
      type: Number,
      required: true,
   },
}, { collection: 'recommended' });

export const Recommended = mongoose.model('recommended', recommendedSchema);