const Participant = require("../models/Participant");
const User = require("../models/User");
const Registration = require("../models/Registration");
const Payment = require("../models/Payment");
const Team = require("../models/Team");

/* =========================================================
   EVENT ACCESS
========================================================= */

async function checkEventAccess(req, eventId) {
  if (!req.user) {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }

  if (req.user.role === "SUPER_ADMIN") {
    return;
  }

  const user = await User.findById(req.user.userId).select(
    "assignedEvents isActive role"
  );

  if (!user) {
    const error = new Error("User account not found");
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error("User account is inactive");
    error.statusCode = 403;
    throw error;
  }

  const assignedEvents = (user.assignedEvents || []).map((id) =>
    id.toString()
  );

  if (!assignedEvents.includes(eventId.toString())) {
    const error = new Error(
      "You are not authorized to check in participants for this event"
    );

    error.statusCode = 403;
    throw error;
  }
}

/* =========================================================
   PARTICIPANT RESPONSE
========================================================= */

function participantResponse(participant) {
  return {
    participantId: participant._id,
    registrationId: participant.registrationId,
    name: participant.name,
    collegeId: participant.collegeId,
    email: participant.email,
    phone: participant.phone,
    department: participant.department,
    year: participant.year,

    attendanceStatus: participant.attendanceStatus,
    checkedInAt: participant.checkedInAt,

    event: participant.eventId || null,

    teamId: participant.teamId || null,
  };
}

/* =========================================================
   PAYMENT STATUS
========================================================= */

function getPaymentReason(status) {
  switch (status) {
    case "PAYMENT_VERIFIED":
      return "Payment has been verified.";

    case "PAYMENT_SUBMITTED":
      return "Payment has been submitted and is waiting for verification.";

    case "PAYMENT_REJECTED":
      return "Payment was rejected. Please contact the event team.";

    case "PENDING_PAYMENT":
      return "Payment has not been completed yet.";

    default:
      return "Payment has not been verified yet.";
  }
}

/* =========================================================
   FIND PAYMENT FOR PARTICIPANT
========================================================= */

async function getParticipantPaymentInfo(participant) {
  let registration = null;
  let team = null;
  let payment = null;

  /*
   * TEAM PARTICIPANT
   */
  if (participant.teamId) {
    team = await Team.findById(participant.teamId)
      .select("teamId name status eventId")
      .lean();

    registration = await Registration.findOne({
      teamId: participant.teamId,
    })
      .select(
        "_id registrationId registrationType paymentStatus status eventId teamId"
      )
      .lean();

    if (registration?._id) {
      payment = await Payment.findOne({
        registrationId: registration._id,
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    /*
     * Fallback in case the payment is stored directly
     * against the team.
     */
    if (!payment) {
      payment = await Payment.findOne({
        teamId: participant.teamId,
      })
        .sort({ createdAt: -1 })
        .lean();
    }
  }

  /*
   * INDIVIDUAL PARTICIPANT
   */
  if (!participant.teamId) {
    registration = await Registration.findOne({
      participantIds: participant._id,
    })
      .select(
        "_id registrationId registrationType paymentStatus status eventId teamId"
      )
      .lean();

    if (registration?._id) {
      payment = await Payment.findOne({
        registrationId: registration._id,
      })
        .sort({ createdAt: -1 })
        .lean();
    }
  }

  const paymentStatus =
    payment?.status ||
    registration?.paymentStatus ||
    team?.status ||
    "PENDING_PAYMENT";

  return {
    registration,
    team,
    payment,
    paymentStatus,
    paymentReason: getPaymentReason(paymentStatus),
  };
}

/* =========================================================
   MAIN CHECK-IN PROCESS
========================================================= */

async function performCheckIn(req, res, participant) {
  try {
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Participant not found",
      });
    }

    if (!participant.eventId) {
      return res.status(400).json({
        success: false,
        message: "Participant is not linked to an event",
      });
    }

    const eventId =
      participant.eventId?._id || participant.eventId;

    await checkEventAccess(req, eventId);

    /* =====================================================
       GET PAYMENT STATUS FIRST
    ===================================================== */

    const paymentInfo =
      await getParticipantPaymentInfo(participant);

    /* =====================================================
       ALREADY CHECKED IN
       IMPORTANT: RETURN 200, NOT AN ERROR
    ===================================================== */

    if (participant.attendanceStatus === "CHECKED_IN") {
      return res.status(200).json({
        success: true,

        alreadyCheckedIn: true,

        allowed: false,

        message: "Participant is already checked in.",

        participant: participantResponse(participant),

        event: participant.eventId,

        payment: {
          status: paymentInfo.paymentStatus,
          verified:
            paymentInfo.paymentStatus === "PAYMENT_VERIFIED",
          reason: paymentInfo.paymentReason,
        },

        checkIn: {
          alreadyCheckedIn: true,
          checkedInAt: participant.checkedInAt,
          checkedInBy: participant.checkedInBy || null,
        },
      });
    }

    /* =====================================================
       PAYMENT CHECK
       IMPORTANT: DO NOT RETURN 4xx FOR PAYMENT PROBLEM
    ===================================================== */

    if (
      paymentInfo.paymentStatus !==
      "PAYMENT_VERIFIED"
    ) {
      return res.status(200).json({
        success: false,

        allowed: false,

        alreadyCheckedIn: false,

        code: "PAYMENT_NOT_VERIFIED",

        message: "Check-in is not allowed.",

        reason: paymentInfo.paymentReason,

        participant: participantResponse(participant),

        event: participant.eventId,

        payment: {
          status: paymentInfo.paymentStatus,
          verified: false,
          reason: paymentInfo.paymentReason,

          rejectionReason:
            paymentInfo.payment?.rejectionReason || "",
        },

        checkIn: {
          allowed: false,
        },
      });
    }

    /* =====================================================
       PAYMENT VERIFIED
       NOW CHECK-IN
    ===================================================== */

    participant.attendanceStatus = "CHECKED_IN";
    participant.checkedInAt = new Date();
    participant.checkedInBy = req.user.userId;

    await participant.save();

    /* =====================================================
       GET UPDATED PARTICIPANT
    ===================================================== */

    const populatedParticipant =
      await Participant.findById(participant._id)
        .populate(
          "eventId",
          "title slug category venue date startTime endTime"
        )
        .populate(
          "checkedInBy",
          "name username role"
        )
        .lean();

    return res.status(200).json({
      success: true,

      allowed: true,

      alreadyCheckedIn: false,

      message: "Check-in successful.",

      participant:
        participantResponse(populatedParticipant),

      event: populatedParticipant.eventId,

      payment: {
        status: "PAYMENT_VERIFIED",
        verified: true,
        reason: "Payment has been verified.",
      },

      checkIn: {
        allowed: true,
        alreadyCheckedIn: false,
        checkedInAt:
          populatedParticipant.checkedInAt,
        checkedInBy:
          populatedParticipant.checkedInBy,
      },
    });
  } catch (error) {
    console.error(
      "Check-in processing error:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message || "Server error",
    });
  }
}

/* =========================================================
   QR CODE CHECK-IN
========================================================= */

const scanQRCode = async (req, res) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken || !qrToken.trim()) {
      return res.status(400).json({
        success: false,
        message: "QR token is required",
      });
    }

    const participant =
      await Participant.findOne({
        qrToken: qrToken.trim(),
      })
        .select("+qrToken")
        .populate(
          "eventId",
          "title slug category venue date startTime endTime"
        );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Invalid QR code",
      });
    }

    return performCheckIn(
      req,
      res,
      participant
    );
  } catch (error) {
    console.error(
      "QR check-in error:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message || "Server error",
    });
  }
};

/* =========================================================
   REGISTRATION ID CHECK-IN
========================================================= */

const checkInByRegistrationId =
  async (req, res) => {
    try {
      const { registrationId } = req.body;

      if (
        !registrationId ||
        !registrationId.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Registration ID is required",
        });
      }

      const normalizedRegistrationId =
        registrationId.trim().toUpperCase();

      const participant =
        await Participant.findOne({
          registrationId: {
            $regex:
              `^${normalizedRegistrationId}$`,
            $options: "i",
          },
        }).populate(
          "eventId",
          "title slug category venue date startTime endTime"
        );

      if (!participant) {
        return res.status(404).json({
          success: false,
          message:
            `Participant with registration ID ${normalizedRegistrationId} was not found`,
        });
      }

      return performCheckIn(
        req,
        res,
        participant
      );
    } catch (error) {
      console.error(
        "Registration ID check-in error:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        success: false,
        message:
          error.message || "Server error",
      });
    }
  };

module.exports = {
  scanQRCode,
  checkInByRegistrationId,
};