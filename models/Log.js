import mongoose from 'mongoose';

const LogSchema = new mongoose.Schema({
  mnemonic: String,
  action: String,
  result: String,
  name: String,
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model('Log', LogSchema);
