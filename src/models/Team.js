const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    teamId: {
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

    name: {
      type: String,
      required: true,
      trim: true,
    },

    leaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      default: null,
    },

    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAYMENT_SUBMITTED",
        "PAYMENT_VERIFIED",
        "PAYMENT_REJECTED",
        "CANCELLED",
      ],
      default: "PENDING_PAYMENT",
    },
  },
  {
    timestamps: true,
  }
);

teamSchema.index({ eventId: 1 });

module.exports = mongoose.model("Team", teamSchema);