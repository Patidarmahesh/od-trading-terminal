import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import apiRoutes from './routes/apiRoutes.js';
import { setDbConnected, setSocketIo, initializeData } from './controllers/dataController.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Pass io instance to controller
setSocketIo(io);

// Connect to MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/od_software_db';
mongoose.connect(mongoURI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    setDbConnected(true);
    initializeData();
  })
  .catch(err => {
    console.warn('MongoDB connection failed. Falling back to local in-memory configuration database. Error:', err.message);
    setDbConnected(false);
    initializeData();
  });

// Socket.io connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// API Routes
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'in-memory' });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server & WebSocket running on port ${PORT}`);
});

// mongodb+srv://patidar123mahesh456_db_user:<db_password>@cluster0.dtpqf3k.mongodb.net/?appName=Cluster0
