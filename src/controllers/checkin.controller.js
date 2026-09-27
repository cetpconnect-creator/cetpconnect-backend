const Participant = require("../models/Participant");
const User = require("../models/User");

const scanQRCode = async (req, res) => {
  try {
    const { qrToken } = req.body;

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        message: "QR token is required",
      });
    }

    // Find participant and reveal the hidden QR token
    const participant = await Participant.findOne({
      qrToken,
    })
      .select("+qrToken")
      .populate("eventId", "title slug category");

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Invalid QR code",
      });
    }

    // ------------------------------------------------
    // EVENT-LEVEL AUTHORIZATION
    // ------------------------------------------------

    // SUPER_ADMIN can scan any event
    if (req.user.role !== "SUPER_ADMIN") {
      const user = await User.findById(req.user.userId).select(
        "assignedEvents isActive role"
      );

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User account is inactive",
        });
      }

      const hasEventAccess = user.assignedEvents.some(
        (eventId) =>
          eventId.toString() === participant.eventId._id.toString()
      );

      if (!hasEventAccess) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to check in participants for this event",
        });
      }
    }

    // ------------------------------------------------
    // ALREADY CHECKED IN
    // ------------------------------------------------

    if (participant.attendanceStatus === "CHECKED_IN") {
      return res.status(409).json({
        success: false,
        message: "Participant is already checked in",
        participant: {
          registrationId: participant.registrationId,
          name: participant.name,
          collegeId: participant.collegeId,
          attendanceStatus: participant.attendanceStatus,
          checkedInAt: participant.checkedInAt,
          event: participant.eventId,
        },
      });
    }

    // ------------------------------------------------
    // CHECK IN
    // ------------------------------------------------

    participant.attendanceStatus = "CHECKED_IN";
    participant.checkedInAt = new Date();
    participant.checkedInBy = req.user.userId;

    await participant.save();

    return res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      participant: {
        participantId: participant._id,
        registrationId: participant.registrationId,
        name: participant.name,
        collegeId: participant.collegeId,
        department: participant.department,
        year: participant.year,
        attendanceStatus: participant.attendanceStatus,
        checkedInAt: participant.checkedInAt,
        event: participant.eventId,
      },
    });
  } catch (error) {
    console.error("QR check-in error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  scanQRCode,
};