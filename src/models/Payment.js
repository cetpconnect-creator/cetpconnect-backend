const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      default: null,
    },

    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    screenshotUrl: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "PAYMENT_SUBMITTED",
        "PAYMENT_VERIFIED",
        "PAYMENT_REJECTED",
      ],
      default: "PAYMENT_SUBMITTED",
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ eventId: 1, status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);