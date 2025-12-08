// db.js
import mongoose from 'mongoose';

export async function connectToDB() {
    try {
        // await mongoose.connect('mongodb://admin:PiBotPassUser**456!@72.61.139.198:27017/pibot?authSource=admin');
        await mongoose.connect('mongodb://admin:PiBotPassUser**456!@localhost:27017/pibot?authSource=admin');

        console.log('✅ Connected to MongoDB at mongodb://72.61.139.198:27017/pibot');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1); // Stop the server if DB connection fails - manch
    }
}