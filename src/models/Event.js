const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    category: {
      type: String,
      enum: ["YUKTHIX", "VAAGA"],
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },

    rules: {
      type: String,
      default: "",
    },

    date: {
      type: Date,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    venue: {
      type: String,
      required: true,
    },

    registrationStart: {
      type: Date,
      required: true,
    },

    registrationEnd: {
      type: Date,
      required: true,
    },

    fee: {
      type: Number,
      required: true,
      min: 0,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    registrationCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    registrationType: {
      type: String,
      enum: ["INDIVIDUAL", "TEAM"],
      required: true,
    },

    minTeamSize: {
      type: Number,
      default: null,
    },

    maxTeamSize: {
      type: Number,
      default: null,
    },

    paymentQrUrl: {
      type: String,
      default: "",
    },

    registrationFields: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"],
      default: "DRAFT",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Event", eventSchema);