import mongoose from "mongoose";

const verificationCodeSchema = new mongoose.Schema({
   code: {
      type: String,
      required: true
   },
   user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users"
   },
   createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: '1200s' } //delete code after 1h
   }
}, { collection: 'vetificationcode' });

const verificationCodeModel = mongoose.model("vetificationcode", verificationCodeSchema);

export default verificationCodeModel;