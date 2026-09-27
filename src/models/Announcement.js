const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    publishedAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

announcementSchema.index({ publishedAt: -1 });
announcementSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("Announcement", announcementSchema);