import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true
    }],
    timestamp: { 
      type: Date, 
      default: Date.now }
}, { collection: 'chat' });

export const Chat = mongoose.model('chat', chatSchema);