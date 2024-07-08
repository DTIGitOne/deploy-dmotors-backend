import express from 'express';
import { Message } from '../Models/messageModel.js';
import { authMiddleware, roleMiddleware } from '../Middleware/auth.js';
import { User } from '../Models/userModel.js';
import { Profile } from '../Models/profileModel.js';
import { Chat } from '../Models/ChatModel.js';
import multer from 'multer';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const messageRouter = express.Router();

const storage = multer.memoryStorage();
const upload = multer({storage: storage});
 
const s3 = new S3Client({
   credentials: {
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_ACCESS,
   },
   region: process.env.BUCKET_LOCATION
});

messageRouter.get('/getchat/:id', authMiddleware, roleMiddleware("CLIENT"), async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id.toString();

  if (id !== userId) return res.status(403).send("Forbidden");

  try {
    const chats = await Chat.find({ users: userId }).populate('users', 'username');

    const chatsWithLatestMessage = await Promise.all(chats.map(async (chat) => {
      const latestMessage = await Message.findOne({ 
        sender: { $in: chat.users },
        receiver: { $in: chat.users }
      })
      .sort({ timestamp: -1 })
      .limit(1);

      return {
        chat: chat.toObject(),
        latestMessage: latestMessage ? latestMessage.toObject() : null,
      };
    }));

    chatsWithLatestMessage.sort((a, b) => {
      if (!a.latestMessage && !b.latestMessage) return 0;
      if (!a.latestMessage) return 1;
      if (!b.latestMessage) return -1;
      return b.latestMessage.timestamp - a.latestMessage.timestamp;
    });

    const filteredChats = chatsWithLatestMessage.map(({ chat, latestMessage }) => {
      const otherUsers = chat.users.filter(user => user._id.toString() !== userId);
      return {
        ...chat,
        users: otherUsers,
        latestMessage,
      };
    });

    const uniqueUserIds = [...new Set(filteredChats.flatMap(chat => chat.users.map(user => user._id.toString())))];

    const userProfiles = await Profile.find({ profileUser: { $in: uniqueUserIds } });

    const userData = await User.find({ _id: { $in: uniqueUserIds } }, 'username');

    const userIdToUsername = userData.reduce((acc, user) => {
      acc[user._id.toString()] = user.username;
      return acc;
    }, {});

    const profilesWithUsernames = await Promise.all(userProfiles.map(async (profile) => {
      const profileWithUsername = {
        ...profile.toObject(),
        username: userIdToUsername[profile.profileUser.toString()]
      };

      if (profileWithUsername.pfpURL) {
        const getObjectParams = {
          Bucket: process.env.BUCKET_NAME,
          Key: profileWithUsername.pfpURL,
        };

        const command = new GetObjectCommand(getObjectParams);
        profileWithUsername.pfpURL = await getSignedUrl(s3, command, { expiresIn: 3600 });
      }

      return profileWithUsername;
    }));

    const result = filteredChats.map(chat => {
      const chatProfiles = chat.users.map(user => profilesWithUsernames.find(profile => profile.profileUser.toString() === user._id.toString()));
      return {
        ...chat,
        users: chatProfiles,
      };
    });

    res.status(200).json(result);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

messageRouter.post('/send', async (req, res) => {
   const { sender, receiver, message } = req.body;
 
   try {
      const findChat = await Chat.findOne({
         users: { $all: [sender, receiver] }
       });

       const newMessage = await Message.create({ sender, receiver, message });

       if(!findChat) {
         const newChat = new Chat({
            users: [ sender , receiver ],
         });

         await newChat.save();
       };


     res.status(201).json(newMessage);
   } catch (error) {
     console.error('Error sending message:', error);
     res.status(500).json({ error: 'Failed to send message' });
   }
 });

 messageRouter.post('/createchat/:id', authMiddleware, roleMiddleware("CLIENT"), async (req, res) => {
  const { id } = req.params
  const userIdToken = req.user._id;
  console.log(userIdToken);

  try {
     const findChat = await Chat.findOne({
        users: { $all: [id, userIdToken] }
      });

      if(!findChat) {
        const newChat = new Chat({
           users: [ id , userIdToken ],
        });

        await newChat.save();
      };

      const findNewChat = await Chat.findOne({
        users: { $all: [id, userIdToken] }
      });


    res.status(201).send(findNewChat);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});
 
 messageRouter.get('/:userId/:otherUserId', async (req, res) => {
   const { userId, otherUserId } = req.params;
 
   try {
     const messages = await Message.find({
       $or: [
         { sender: userId, receiver: otherUserId },
         { sender: otherUserId, receiver: userId }
       ]
     }).sort({ timestamp: 1 });
 
     res.json(messages);
   } catch (error) {
     console.error('Error fetching messages:', error);
     res.status(500).json({ error: 'Failed to fetch messages' });
   }
 });

export default messageRouter;