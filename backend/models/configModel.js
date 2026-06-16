import mongoose from 'mongoose';

const configSchema = new mongoose.Schema({
  disclaimerChecked: {
    type: Boolean,
    default: false
  },
  strategyType: {
    type: String,
    enum: ['OD SOFT', 'OD SOFT 2'],
    default: 'OD SOFT'
  },
  showSupportResistance: {
    type: Boolean,
    default: true
  },
  src: {
    type: String,
    enum: ['Close', 'Open', 'High', 'Low'],
    default: 'Close'
  },
  length: {
    type: Number,
    default: 50
  },
  filterType: {
    type: String,
    enum: ['Type 1', 'Type 2'],
    default: 'Type 1'
  },
  movementSource: {
    type: String,
    enum: ['Close', 'Open'],
    default: 'Close'
  },
  rangeSize: {
    type: Number,
    default: 3.5
  },
  rangeScale: {
    type: String,
    enum: ['Average Change', 'ATR', 'Standard Deviation'],
    default: 'ATR'
  },
  rangePeriod: {
    type: Number,
    default: 14
  },
  isSideways: {
    type: Boolean,
    default: false
  },
  fyersAppId: {
    type: String,
    default: ''
  },
  fyersSecretId: {
    type: String,
    default: ''
  },
  fyersAccessToken: {
    type: String,
    default: ''
  }
}, { timestamps: true });

const Config = mongoose.model('Config', configSchema);
export default Config;
