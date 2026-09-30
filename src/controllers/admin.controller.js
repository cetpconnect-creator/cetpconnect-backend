const Registration = require("../models/Registration");
const Participant = require("../models/Participant");
const Event = require("../models/Event");
const User = require("../models/User");

const getDashboard = async (req, res) => {
  try {
    const { role, userId } = req.user;

    let eventFilter = {};

    // =====================================================
    // SUPER ADMIN
    // Can see everything
    // =====================================================
    if (role === "SUPER_ADMIN") {
      eventFilter = {};
    } else {
      // ===================================================
      // FACULTY / EVENT MANAGER / STUDENT COORDINATOR
      // Can only see assigned events
      // ===================================================

      const user = await User.findById(userId)
        .select("assignedEvents isActive role")
        .lean();

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User account is inactive",
        });
      }

      const assignedEvents = Array.isArray(user.assignedEvents)
        ? user.assignedEvents
        : [];

      eventFilter = {
        _id: { $in: assignedEvents },
      };
    }

    // =====================================================
    // GET EVENTS AVAILABLE TO THIS USER
    // =====================================================

    const events = await Event.find(eventFilter)
      .select(
        "title slug category registrationCount capacity status"
      )
      .sort({ createdAt: -1 })
      .lean();

    const eventIds = events.map((event) => event._id);

    // =====================================================
    // NO ASSIGNED EVENTS
    // =====================================================

    if (
      role !== "SUPER_ADMIN" &&
      eventIds.length === 0
    ) {
      return res.status(200).json({
        success: true,
        dashboard: {
          totalRegistrations: 0,
          totalParticipants: 0,

          payments: {
            pending: 0,
            submitted: 0,
            verified: 0,
            rejected: 0,
          },

          attendance: {
            checkedIn: 0,
            notCheckedIn: 0,
          },

          events: [],
        },
      });
    }

    // =====================================================
    // REGISTRATION FILTER
    // =====================================================

    const registrationFilter =
      role === "SUPER_ADMIN"
        ? { status: "ACTIVE" }
        : {
            status: "ACTIVE",
            eventId: { $in: eventIds },
          };

    // =====================================================
    // PARTICIPANT FILTER
    // =====================================================

    const participantFilter =
      role === "SUPER_ADMIN"
        ? {}
        : {
            eventId: { $in: eventIds },
          };

    // =====================================================
    // LOAD DASHBOARD DATA
    // =====================================================

    const [
      totalRegistrations,
      totalParticipants,
      paymentPending,
      paymentSubmitted,
      paymentVerified,
      paymentRejected,
      checkedInParticipants,
    ] = await Promise.all([
      Registration.countDocuments(registrationFilter),

      Participant.countDocuments(participantFilter),

      Registration.countDocuments({
        ...registrationFilter,
        paymentStatus: "PENDING_PAYMENT",
      }),

      Registration.countDocuments({
        ...registrationFilter,
        paymentStatus: "PAYMENT_SUBMITTED",
      }),

      Registration.countDocuments({
        ...registrationFilter,
        paymentStatus: "PAYMENT_VERIFIED",
      }),

      Registration.countDocuments({
        ...registrationFilter,
        paymentStatus: "PAYMENT_REJECTED",
      }),

      Participant.countDocuments({
        ...participantFilter,
        attendanceStatus: "CHECKED_IN",
      }),
    ]);

    // =====================================================
    // RESPONSE
    // =====================================================

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