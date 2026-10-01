const mongoose = require("mongoose");

/* =========================================================
   REGISTRATION FIELD
========================================================= */

const registrationFieldSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      label: {
        type: String,
        required: true,
        trim: true,
      },

      type: {
        type: String,
        enum: [
          "text",
          "email",
          "phone",
          "number",
          "select",
        ],
        default: "text",
      },

      required: {
        type: Boolean,
        default: false,
      },

      options: {
        type: [String],
        default: [],
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   PRIZE MONEY
========================================================= */

const prizeMoneySchema =
  new mongoose.Schema(
    {
      first: {
        type: Number,
        default: null,
        min: 0,
      },

      second: {
        type: Number,
        default: null,
        min: 0,
      },

      third: {
        type: Number,
        default: null,
        min: 0,
      },
    },
    {
      _id: false,
    }
  );

/* =========================================================
   EVENT
========================================================= */

const eventSchema =
  new mongoose.Schema(
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
        enum: [
          "YUKTHIX",
          "VAAGA",
        ],
        required: true,
      },

      description: {
        type: String,
        required: true,
        trim: true,
      },

      imageUrl: {
        type: String,
        trim: true,
        default: "",
      },

      rules: {
        type: [String],
        default: [],
      },

      /* =====================================================
         EVENT DATE / TIME
      ===================================================== */

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
        trim: true,
      },

      /* =====================================================
         REGISTRATION WINDOW
      ===================================================== */

      registrationStart: {
        type: Date,
        required: true,
      },

      registrationEnd: {
        type: Date,
        required: true,
      },

      /* =====================================================
         REGISTRATION / PAYMENT
      ===================================================== */

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
        enum: [
          "INDIVIDUAL",
          "TEAM",
        ],
        required: true,
      },

      minTeamSize: {
        type: Number,
        default: null,
        min: 1,
      },

      maxTeamSize: {
        type: Number,
        default: null,
        min: 1,
      },

      paymentQrUrl: {
        type: String,
        trim: true,
        default: "",
      },

      /* =====================================================
         PRIZE MONEY
         
         Optional:
         first only
         first + second
         first + second + third
         or none
      ===================================================== */

      prizeMoney: {
        type: prizeMoneySchema,
        default: () => ({
          first: null,
          second: null,
          third: null,
        }),
      },

      /* =====================================================
         CUSTOM REGISTRATION FIELDS
      ===================================================== */

      registrationFields: {
        type: [registrationFieldSchema],
        default: [],
      },

      /* =====================================================
         STATUS
      ===================================================== */

      status: {
        type: String,
        enum: [
          "DRAFT",
          "PUBLISHED",
          "CLOSED",
          "CANCELLED",
        ],
        default: "DRAFT",
      },

      /* =====================================================
         CREATOR
      ===================================================== */

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

module.exports =
  mongoose.model(
    "Event",
    eventSchema
  );