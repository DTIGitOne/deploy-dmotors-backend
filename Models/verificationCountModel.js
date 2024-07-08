import mongoose from "mongoose";

const verificationCountSchema = new mongoose.Schema({
   user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users"
   },
   counter: {
      type: Number,
      requireed: true
   },
   createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: '1h' } //delete code after 1h
   }
}, { collection: 'verificationcount' });

const verificationCountModel = mongoose.model("verificationcount", verificationCountSchema);

export default verificationCountModel;