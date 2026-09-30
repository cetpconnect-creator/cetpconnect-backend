const Participant = require("../models/Participant");
const User = require("../models/User");

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
    event: participant.eventId,
  };
}

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

    await checkEventAccess(req, participant.eventId._id);

    if (participant.attendanceStatus === "CHECKED_IN") {
      return res.status(409).json({
        success: false,
        message: "Participant is already checked in",
        participant: participantResponse(participant),
        event: participant.eventId,
        checkIn: {
          checkedInAt: participant.checkedInAt,
        },
      });
    }

    participant.attendanceStatus = "CHECKED_IN";
    participant.checkedInAt = new Date();
    participant.checkedInBy = req.user.userId;

    await participant.save();

    const populatedParticipant = await Participant.findById(
      participant._id
    )
      .populate("eventId", "title slug category venue")
      .populate("checkedInBy", "name username role")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      participant: participantResponse(populatedParticipant),
      event: populatedParticipant.eventId,
      checkIn: {
        checkedInAt: populatedParticipant.checkedInAt,
        checkedInBy: populatedParticipant.checkedInBy,
      },
    });
  } catch (error) {
    console.error("Check-in processing error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
}

/**
 * QR CODE CHECK-IN
 */
const scanQRCode = async (req, res) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken || !qrToken.trim()) {
      return res.status(400).json({
        success: false,
        message: "QR token is required",
      });
    }

    const participant = await Participant.findOne({
      qrToken: qrToken.trim(),
    })
      .select("+qrToken")
      .populate("eventId", "title slug category venue");

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Invalid QR code",
      });
    }

    return performCheckIn(req, res, participant);
  } catch (error) {
    console.error("QR check-in error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

/**
 * REGISTRATION ID CHECK-IN
 */
const checkInByRegistrationId = async (req, res) => {
  try {
    const { registrationId } = req.body;

    if (!registrationId || !registrationId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Registration ID is required",
      });
    }

    const normalizedRegistrationId = registrationId
      .trim()
      .toUpperCase();

    const participant = await Participant.findOne({
      registrationId: {
        $regex: `^${normalizedRegistrationId}$`,
        $options: "i",
      },
    })
      .populate(
        "eventId",
        "title slug category venue"
      );

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: `Participant with registration ID ${normalizedRegistrationId} was not found`,
      });
    }

    return performCheckIn(req, res, participant);
  } catch (error) {
    console.error(
      "Registration ID check-in error:",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

module.exports = {
  scanQRCode,
  checkInByRegistrationId,
};