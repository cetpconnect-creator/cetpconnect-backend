const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    registrationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    registrationType: {
      type: String,
      enum: ["INDIVIDUAL", "TEAM"],
      required: true,
    },

    participantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Participant",
      },
    ],

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },

    paymentStatus: {
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

    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

registrationSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model("Registration", registrationSchema);