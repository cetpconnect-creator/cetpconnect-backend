const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    registrationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    collegeId: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    year: {
      type: String,
      required: true,
      trim: true,
    },

    customFields: {
      type: Map,
      of: String,
      default: {},
    },

    qrToken: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    attendanceStatus: {
      type: String,
      enum: ["NOT_CHECKED_IN", "CHECKED_IN"],
      default: "NOT_CHECKED_IN",
    },

    checkedInAt: {
      type: Date,
      default: null,
    },

    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

participantSchema.index({ eventId: 1 });
participantSchema.index({ teamId: 1 });
participantSchema.index({ eventId: 1, collegeId: 1 });

module.exports = mongoose.model("Participant", participantSchema);