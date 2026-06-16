import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  side: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL']
  },
  entryPrice: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    default: 50
  },
  status: {
    type: String,
    default: 'OPEN',
    enum: ['OPEN', 'CLOSED']
  },
  pnl: {
    type: Number,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Trade = mongoose.model('Trade', tradeSchema);

export default Trade;
