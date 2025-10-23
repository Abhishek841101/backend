
import mongoose from 'mongoose';

const connectDB = async (DATABASE_URL) => {
  try {
    mongoose.set('strictQuery', true); 

    const DB_OPTIONS = {
      dbName: "geekshop",
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    await mongoose.connect(DATABASE_URL, DB_OPTIONS);
    console.log('Connected Successfully...');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1); 
  }
};

export default connectDB;
