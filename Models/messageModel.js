import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
   sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
   receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
   message: String,
   timestamp: { type: Date, default: Date.now }
 });

export const Message = mongoose.model('Message', messageSchema);