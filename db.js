// db.js
import mongoose from 'mongoose';

export async function connectToDB() {
    try {
        await mongoose.connect('mongodb://pibotuser:PiBotPassUser**456!@localhost:27017/pibot?authSource=pibot', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Connected to MongoDB at mongodb://localhost:27017/pibot');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1); // Stop the server if DB connection fails
    }
}