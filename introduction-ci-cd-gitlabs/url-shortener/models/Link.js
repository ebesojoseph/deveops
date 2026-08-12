const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    clicks: {
      type: Number,
      default: 0,
    },
    lastClickedAt: {
      type: Date,
      default: null,
    },
    qrDataUrl: {
      type: String, // cached base64 PNG data URI for the QR code
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Link', linkSchema);
