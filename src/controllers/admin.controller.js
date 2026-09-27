const Registration = require("../models/Registration");
const Participant = require("../models/Participant");
const Event = require("../models/Event");

const getDashboard = async (req, res) => {
  try {
    const [
      totalRegistrations,
      totalParticipants,
      paymentPending,
      paymentSubmitted,
      paymentVerified,
      paymentRejected,
      checkedInParticipants,
      events,
    ] = await Promise.all([
      Registration.countDocuments({ status: "ACTIVE" }),

      Participant.countDocuments(),

      Registration.countDocuments({
        paymentStatus: "PENDING_PAYMENT",
      }),

      Registration.countDocuments({
        paymentStatus: "PAYMENT_SUBMITTED",
      }),

      Registration.countDocuments({
        paymentStatus: "PAYMENT_VERIFIED",
      }),

      Registration.countDocuments({
        paymentStatus: "PAYMENT_REJECTED",
      }),

      Participant.countDocuments({
        attendanceStatus: "CHECKED_IN",
      }),

      Event.find({})
        .select("title slug category registrationCount capacity status")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      dashboard: {
        totalRegistrations,
        totalParticipants,
        payments: {
          pending: paymentPending,
          submitted: paymentSubmitted,
          verified: paymentVerified,
          rejected: paymentRejected,
        },
        attendance: {
          checkedIn: checkedInParticipants,
          notCheckedIn:
            totalParticipants - checkedInParticipants,
        },
        events,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
};

module.exports = {
  getDashboard,
};