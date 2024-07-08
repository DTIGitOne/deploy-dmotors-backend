import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import userRouter from './Routers/userRouter.js';
import carsRouter from './Routers/carsRouter.js';
import mongoose from 'mongoose';
import adminRouter from './Routers/AdminRouter.js';
import http from 'http';
import messageRouter from './Routers/MessageRouter.js';

config();

// Create an instance of Express
const server = express();
server.use(cors());

// Create an HTTP server
const serverListen = http.createServer(server);

// Middleware
server.use(express.json());

// Routers
server.use('/users', userRouter);
server.use('/cars', carsRouter);
server.use('/admin', adminRouter);
server.use('/messages', messageRouter);

server.get('/Health', (req, res) => {
  res.status(200).send({ message: 'server is running' });
});

const port = process.env.PORT || process.env.SERVER_PORT || 3000;

const startServer = () => {
  serverListen.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to database');
    startServer();
  } catch (e) {
    console.error('There was an issue with connecting to the database');
    console.error(e);
  }
};

connectToDatabase();
