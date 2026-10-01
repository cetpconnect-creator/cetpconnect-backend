const crypto = require("crypto");

const Event = require("../models/Event");
const Team = require("../models/Team");
const Participant = require("../models/Participant");
const Registration = require("../models/Registration");

const {
  generateParticipantQR,
} = require("../services/qr.service");

// =====================================================
// HELPER
// VALIDATE EVENT-SPECIFIC CUSTOM FIELDS
// =====================================================

const validateAndNormalizeCustomFields = (
  fields = [],
  values = {}
) => {
  let source = values;

  // Support JSON string as well as normal object
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      source = {};
    }
  }

  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    source = {};
  }

  const normalized = {};

  for (const field of fields) {
    const key = String(field.name || "").trim();

    if (!key) {
      continue;
    }

    const rawValue = source[key];

    const value =
      rawValue === undefined ||
      rawValue === null
        ? ""
        : String(rawValue).trim();

    // Only store fields configured for this event
    normalized[key] = value;

    // Required field
    if (field.required && !value) {
      const error = new Error(
        `${field.label || key} is required.`
      );

      error.statusCode = 400;
      throw error;
    }

    // Optional empty field
    if (!value) {
      continue;
    }

    // Email
    if (field.type === "email") {
      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(value)) {
        const error = new Error(
          `${field.label || key} must be a valid email address.`
        );

        error.statusCode = 400;
        throw error;
      }
    }

    // Phone
    if (field.type === "phone") {
      const phoneRegex =
        /^[0-9+\-\s()]{7,20}$/;

      if (!phoneRegex.test(value)) {
        const error = new Error(
          `${field.label || key} must be a valid phone number.`
        );

        error.statusCode = 400;
        throw error;
      }
    }

    // Number
    if (field.type === "number") {
      if (Number.isNaN(Number(value))) {
        const error = new Error(
          `${field.label || key} must be a valid number.`
        );

        error.statusCode = 400;
        throw error;
      }
    }

    // Select
    if (field.type === "select") {
      const options = Array.isArray(
        field.options
      )
        ? field.options.map((option) =>
            String(option).trim()
          )
        : [];

      if (!options.includes(value)) {
        const error = new Error(
          `${field.label || key} has an invalid selection.`
        );

        error.statusCode = 400;
        throw error;
      }
    }
  }

  return normalized;
};

// =====================================================
// CREATE TEAM REGISTRATION
// =====================================================

const createTeamRegistration = async (
  req,
  res
) => {
  let createdTeam = null;

  const createdParticipants = [];

  try {
    const {
      eventId,
      teamName,
      members,
    } = req.body;

    // =====================================================
    // 1. VALIDATE INPUT
    // =====================================================

    if (
      !eventId ||
      !teamName ||
      !Array.isArray(members)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "eventId, teamName and members are required",
      });
    }

    if (members.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "At least one team member is required",
      });
    }

    // =====================================================
    // 2. FIND EVENT
    // =====================================================

    const event =
      await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // =====================================================
    // 3. EVENT VALIDATION
    // =====================================================

    if (event.status !== "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message:
          "Registration is not available for this event",
      });
    }

    if (
      event.registrationType !== "TEAM"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This event does not use team registration",
      });
    }

    // =====================================================
    // 4. REGISTRATION PERIOD
    // =====================================================

    const now = new Date();

    if (
      event.registrationStart &&
      now < new Date(event.registrationStart)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Registration has not started yet",
      });
    }

    if (
      event.registrationEnd &&
      now > new Date(event.registrationEnd)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Registration period is closed",
      });
    }

    // =====================================================
    // 5. TEAM SIZE
    // =====================================================

    if (
      members.length < event.minTeamSize ||
      members.length > event.maxTeamSize
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Team size must be between ${event.minTeamSize} and ${event.maxTeamSize}`,
      });
    }

    // =====================================================
    // 6. CAPACITY
    // =====================================================

    if (
      event.registrationCount +
        members.length >
      event.capacity
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Event registration capacity is full",
      });
    }

    // =====================================================
    // 7. COLLEGE IDS
    // =====================================================

    const collegeIds =
      members.map((member) =>
        String(member.collegeId).trim()
      );

    const uniqueCollegeIds =
      new Set(collegeIds);

    if (
      uniqueCollegeIds.size !==
      collegeIds.length
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Duplicate college ID found in team",
      });
    }

    // =====================================================
    // 8. CHECK EXISTING PARTICIPANTS
    // =====================================================

    const existingParticipants =
      await Participant.find({
        eventId: event._id,

        collegeId: {
          $in: collegeIds,
        },
      }).select("collegeId");

    if (
      existingParticipants.length > 0
    ) {
      return res.status(409).json({
        success: false,

        message:
          "One or more students are already registered",

        collegeIds:
          existingParticipants.map(
            (participant) =>
              participant.collegeId
          ),
      });
    }

    // =====================================================
    // 9. VALIDATE CUSTOM FIELDS
    // =====================================================

    /*
     * Every team member uses the custom fields
     * configured for this specific event.
     */

    const normalizedMembers =
      members.map((member) => ({
        ...member,

        customFields:
          validateAndNormalizeCustomFields(
            event.registrationFields || [],
            member.customFields || {}
          ),
      }));

    // =====================================================
    // 10. GENERATE TEAM ID
    // =====================================================

    const teamId =
      "TEAM-" +
      crypto
        .randomBytes(5)
        .toString("hex")
        .toUpperCase();

    // =====================================================
    // 11. GENERATE TEAM REGISTRATION ID
    // =====================================================

    const registrationId =
      "REG-" +
      crypto
        .randomBytes(6)
        .toString("hex")
        .toUpperCase();

    // =====================================================
    // 12. PAYMENT STATUS
    // =====================================================

    const paymentStatus =
      event.fee > 0
        ? "PENDING_PAYMENT"
        : "PAYMENT_VERIFIED";

    // =====================================================
    // 13. CREATE TEAM
    // =====================================================

    createdTeam =
      await Team.create({
        teamId,

        eventId:
          event._id,

        name:
          teamName.trim(),

        status:
          event.fee > 0
            ? "PENDING_PAYMENT"
            : "PAYMENT_VERIFIED",
      });

    // =====================================================
    // 14. CREATE PARTICIPANTS
    // =====================================================

    const participantResults = [];

    for (
      const member of normalizedMembers
    ) {
      // Every participant gets a UNIQUE registration ID
      const participantRegistrationId =
        "REG-" +
        crypto
          .randomBytes(6)
          .toString("hex")
          .toUpperCase();

      // Secure QR token
      const qrToken =
        crypto.randomBytes(32).toString("hex");

      // QR image
      const qrCode =
        await generateParticipantQR(
          qrToken
        );

      const participant =
        await Participant.create({
          registrationId:
            participantRegistrationId,

          eventId:
            event._id,

          teamId:
            createdTeam._id,

          name:
            String(member.name).trim(),

          collegeId:
            String(
              member.collegeId
            ).trim(),

          email:
            String(member.email)
              .trim()
              .toLowerCase(),

          phone:
            String(member.phone).trim(),

          department:
            String(
              member.department
            ).trim(),

          year:
            String(member.year),

          // Event-specific fields
          customFields:
            member.customFields || {},

          qrToken,

          attendanceStatus:
            "NOT_CHECKED_IN",
        });

      createdParticipants.push(
        participant
      );

      participantResults.push({
        participant,

        qrCode,
      });
    }

    // =====================================================
    // 15. SET TEAM LEADER
    // =====================================================

    createdTeam.leaderId =
      participantResults[0]
        .participant._id;

    await createdTeam.save();

    // =====================================================
    // 16. CREATE REGISTRATION
    // =====================================================

    const registration =
      await Registration.create({
        registrationId,

        eventId:
          event._id,

        registrationType:
          "TEAM",

        participantIds:
          participantResults.map(
            (item) =>
              item.participant._id
          ),

        teamId:
          createdTeam._id,

        paymentStatus,

        status: "ACTIVE",
      });

    // =====================================================
    // 17. UPDATE EVENT COUNT
    // =====================================================

    event.registrationCount +=
      members.length;

    await event.save();

    // =====================================================
    // 18. SUCCESS RESPONSE
    // =====================================================

    return res.status(201).json({
      success: true,

      message:
        "Team registration created successfully",

      registration: {
        registrationId:
          registration.registrationId,

        teamId:
          createdTeam.teamId,

        teamName:
          createdTeam.name,

        eventId:
          event._id,

        paymentStatus,

        members:
          participantResults.map(
            (item) => ({
              participantId:
                item.participant._id,

              participantRegistrationId:
                item.participant
                  .registrationId,

              name:
                item.participant.name,

              collegeId:
                item.participant
                  .collegeId,

              email:
                item.participant.email,

              phone:
                item.participant.phone,

              department:
                item.participant
                  .department,

              year:
                item.participant.year,

              customFields:
                item.participant
                  .customFields || {},

              qrCode:
                item.qrCode,
            })
          ),
      },
    });
  } catch (error) {
    console.error(
      "================================="
    );

    console.error(
      "TEAM REGISTRATION ERROR"
    );

    console.error(
      "Message:",
      error.message
    );

    console.error(
      "Name:",
      error.name
    );

    console.error(
      "Code:",
      error.code
    );

    console.error(
      "KeyValue:",
      error.keyValue
    );

    console.error(
      "Errors:",
      error.errors
    );

    console.error(
      "Stack:",
      error.stack
    );

    console.error(
      "================================="
    );

    // =====================================================
    // CLEANUP PARTIAL PARTICIPANTS
    // =====================================================

    try {
      if (
        createdParticipants.length > 0
      ) {
        await Participant.deleteMany({
          _id: {
            $in:
              createdParticipants.map(
                (participant) =>
                  participant._id
              ),
          },
        });
      }

      // Cleanup partial team
      if (createdTeam) {
        await Team.findByIdAndDelete(
          createdTeam._id
        );
      }
    } catch (cleanupError) {
      console.error(
        "Cleanup error:",
        cleanupError.message
      );
    }

    // =====================================================
    // DUPLICATE ERROR
    // =====================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,

        message:
          "Duplicate registration detected",

        details:
          error.keyValue || null,
      });
    }

    // =====================================================
    // MONGOOSE VALIDATION ERROR
    // =====================================================

    if (
      error.name ===
      "ValidationError"
    ) {
      return res.status(400).json({
        success: false,

        message:
          "Validation error",

        details:
          Object.values(
            error.errors
          ).map(
            (err) =>
              err.message
          ),
      });
    }

    // =====================================================
    // CUSTOM FIELD VALIDATION ERROR
    // =====================================================

    if (error.statusCode) {
      return res.status(
        error.statusCode
      ).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message:
        "Failed to create team registration",

      error:
        error.message,
    });
  }
};


const getTeamRegistration = async (req, res) => {
  try {
    const { teamId } = req.params;

    if (!teamId) {
      return res.status(400).json({
        success: false,
        message: "Team ID is required",
      });
    }

    const Team = require("../models/Team");
    const Registration = require("../models/Registration");
    const { generateParticipantQR } = require("../services/qr.service");

    const team = await Team.findOne({
      teamId: teamId.trim().toUpperCase(),
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const registration = await Registration.findOne({
      teamId: team._id,
    })
      .populate(
        "eventId",
        [
          "title",
          "slug",
          "category",
          "description",
          "imageUrl",
          "date",
          "startTime",
          "endTime",
          "venue",
          "fee",
          "registrationStart",
          "registrationEnd",
          "paymentQrUrl",
          "registrationType",
          "minTeamSize",
          "maxTeamSize",
          "registrationFields",
        ].join(" ")
      )
      .populate({
        path: "participantIds",
        select:
          "registrationId name collegeId email phone department year attendanceStatus checkedInAt +qrToken customFields",
      })
      .populate(
        "teamId",
        "teamId name leaderId status"
      );

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Team registration not found",
      });
    }

    const participants = await Promise.all(
      registration.participantIds.map(
        async (participant) => {
          let qrCode = "";

          if (participant.qrToken) {
            qrCode = await generateParticipantQR(
              participant.qrToken
            );
          }

          return {
            _id: participant._id,
            registrationId:
              participant.registrationId,
            name: participant.name,
            collegeId: participant.collegeId,
            email: participant.email,
            phone: participant.phone,
            department: participant.department,
            year: participant.year,
            customFields:
              participant.customFields || {},
            attendanceStatus:
              participant.attendanceStatus,
            checkedInAt:
              participant.checkedInAt,
            qrCode,
          };
        }
      )
    );

    return res.status(200).json({
      success: true,

      registration: {
        registrationId:
          registration.registrationId,

        registrationType:
          registration.registrationType,

        paymentStatus:
          registration.paymentStatus,

        status:
          registration.status,

        event:
          registration.eventId,

        team:
          registration.teamId || null,

        participants,
      },
    });
  } catch (error) {
    console.error(
      "Get team registration error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load team registration",
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createTeamRegistration,
  getTeamRegistration,
};