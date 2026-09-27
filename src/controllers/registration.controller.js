const crypto = require("crypto");

const Event = require("../models/Event");
const Participant = require("../models/Participant");
const Registration = require("../models/Registration");
const Payment = require("../models/Payment");

const { generateParticipantQR } = require("../services/qr.service");
const { generateRegistrationExcel } = require("../services/excel.service");

// =====================================================
// CREATE INDIVIDUAL REGISTRATION
// POST /api/registrations
// =====================================================

const createRegistration = async (req, res) => {
  try {
    const {
      eventId,
      name,
      collegeId,
      email,
      phone,
      department,
      year,
      customFields,
    } = req.body;

    // -------------------------------------------------
    // 1. Validate required fields
    // -------------------------------------------------

    if (
      !eventId ||
      !name ||
      !collegeId ||
      !email ||
      !phone ||
      !department ||
      !year
    ) {
      return res.status(400).json({
        success: false,
        message: "All required registration fields must be provided",
      });
    }

    // -------------------------------------------------
    // 2. Find event
    // -------------------------------------------------

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // -------------------------------------------------
    // 3. Event must be published
    // -------------------------------------------------

    if (event.status !== "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message: "Registration is not available for this event",
      });
    }

    // -------------------------------------------------
    // 4. Make sure event is an individual event
    // -------------------------------------------------

    if (event.registrationType !== "INDIVIDUAL") {
      return res.status(400).json({
        success: false,
        message:
          "This event uses team registration. Individual registration is not allowed.",
      });
    }

    // -------------------------------------------------
    // 5. Check registration period
    // -------------------------------------------------

    const now = new Date();

    const registrationStart = new Date(event.registrationStart);
    const registrationEnd = new Date(event.registrationEnd);

    if (now < registrationStart) {
      return res.status(400).json({
        success: false,
        message: "Registration has not started yet",
      });
    }

    if (now > registrationEnd) {
      return res.status(400).json({
        success: false,
        message: "Registration period is closed",
      });
    }

    // -------------------------------------------------
    // 6. Check event capacity
    // -------------------------------------------------

    if (event.registrationCount >= event.capacity) {
      return res.status(400).json({
        success: false,
        message: "Event registration capacity is full",
      });
    }

    // -------------------------------------------------
    // 7. Prevent duplicate registration
    // -------------------------------------------------

    const existingParticipant = await Participant.findOne({
      eventId: event._id,
      collegeId: collegeId.trim(),
    });

    if (existingParticipant) {
      return res.status(409).json({
        success: false,
        message: "This student is already registered for this event",
      });
    }

    // -------------------------------------------------
    // 8. Generate secure registration ID
    // -------------------------------------------------

    const registrationId =
      "REG-" + crypto.randomBytes(6).toString("hex").toUpperCase();

    // -------------------------------------------------
    // 9. Generate secure QR token
    // -------------------------------------------------

    const qrToken = crypto.randomBytes(32).toString("hex");

    // -------------------------------------------------
    // 10. Generate QR image
    // -------------------------------------------------

    const qrImage = await generateParticipantQR(qrToken);

    // -------------------------------------------------
    // 11. Create participant
    // -------------------------------------------------

    const participant = await Participant.create({
      registrationId,
      eventId: event._id,
      name: name.trim(),
      collegeId: collegeId.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      department: department.trim(),
      year: year.toString(),
      customFields: customFields || {},
      qrToken,
      attendanceStatus: "NOT_CHECKED_IN",
    });

    // -------------------------------------------------
    // 12. Determine initial payment status
    // -------------------------------------------------

    const paymentStatus =
      event.fee > 0 ? "PENDING_PAYMENT" : "PAYMENT_VERIFIED";

    // -------------------------------------------------
    // 13. Create registration
    // -------------------------------------------------

    const registration = await Registration.create({
      registrationId,
      eventId: event._id,
      registrationType: "INDIVIDUAL",
      participantIds: [participant._id],
      teamId: null,
      paymentStatus,
      status: "ACTIVE",
    });

    // -------------------------------------------------
    // 14. Increase registration count
    // -------------------------------------------------

    event.registrationCount += 1;

    await event.save();

    // -------------------------------------------------
    // 15. Response
    // -------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Registration created successfully",

      registration: {
        registrationId: registration.registrationId,
        eventId: event._id,
        participantId: participant._id,
        paymentStatus: registration.paymentStatus,

        participant: {
          name: participant.name,
          collegeId: participant.collegeId,
          email: participant.email,
          phone: participant.phone,
          department: participant.department,
          year: participant.year,
        },

        // QR image is returned only when registration is created
        qrCode: qrImage,
      },
    });
  } catch (error) {
    console.error("Create registration error:", error);

    // Duplicate key protection
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Registration already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// GET REGISTRATION
// GET /api/registrations/:registrationId
// =====================================================

const getRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;

    // -------------------------------------------------
    // Validate registration ID
    // -------------------------------------------------

    if (!registrationId) {
      return res.status(400).json({
        success: false,
        message: "Registration ID is required",
      });
    }

    // -------------------------------------------------
    // Find registration
    // -------------------------------------------------

    const registration = await Registration.findOne({
      registrationId: registrationId.trim().toUpperCase(),
    })
      .populate(
        "eventId",
        "title slug category description imageUrl date startTime endTime venue fee registrationStart registrationEnd"
      )
      .populate(
        "participantIds",
        "registrationId name collegeId email phone department year attendanceStatus checkedInAt"
      );

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // -------------------------------------------------
    // Response
    // -------------------------------------------------

    return res.status(200).json({
      success: true,

      registration: {
        registrationId: registration.registrationId,
        registrationType: registration.registrationType,
        paymentStatus: registration.paymentStatus,
        status: registration.status,

        event: registration.eventId,

        participants: registration.participantIds,
      },
    });
  } catch (error) {
    console.error("Get registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// ADMIN: GET REGISTRATIONS
// GET /api/admin/registrations
// =====================================================

const getRegistrations = async (req, res) => {
  try {
    const {
      eventId,
      paymentStatus,
      attendanceStatus,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const registrationQuery = {};

    // Filter by event
    if (eventId) {
      registrationQuery.eventId = eventId;
    }

    // Filter by payment status
    if (paymentStatus) {
      registrationQuery.paymentStatus = paymentStatus;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const registrations = await Registration.find(registrationQuery)
      .populate(
        "eventId",
        "title slug category date venue fee imageUrl"
      )
      .populate(
        "participantIds",
        "registrationId name collegeId email phone department year attendanceStatus checkedInAt"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    // Search participant information
    let filteredRegistrations = registrations;

    if (search) {
      const searchText = search.toLowerCase();

      filteredRegistrations = registrations.filter((registration) => {
        const registrationMatch =
          registration.registrationId
            ?.toLowerCase()
            .includes(searchText);

        const participantMatch = registration.participantIds?.some(
          (participant) =>
            participant.name?.toLowerCase().includes(searchText) ||
            participant.collegeId?.toLowerCase().includes(searchText) ||
            participant.email?.toLowerCase().includes(searchText)
        );

        return registrationMatch || participantMatch;
      });
    }

    // Attendance filter
    if (attendanceStatus) {
      filteredRegistrations = filteredRegistrations.filter(
        (registration) =>
          registration.participantIds?.some(
            (participant) =>
              participant.attendanceStatus === attendanceStatus
          )
      );
    }

    const total = await Registration.countDocuments(registrationQuery);

    return res.status(200).json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      count: filteredRegistrations.length,
      registrations: filteredRegistrations,
    });
  } catch (error) {
    console.error("Get registrations error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// ADMIN: GET SINGLE REGISTRATION
// GET /api/admin/registrations/:id
// =====================================================

const getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findById(id)
      .populate(
        "eventId",
        "title slug category description imageUrl date startTime endTime venue fee registrationStart registrationEnd"
      )
      .populate(
        "participantIds",
        "registrationId name collegeId email phone department year customFields attendanceStatus checkedInAt checkedInBy"
      )
      .populate("teamId", "teamId name leaderId status");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    return res.status(200).json({
      success: true,
      registration,
    });
  } catch (error) {
    console.error("Get registration by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const exportRegistrations = async (req, res) => {
  try {
    const {
      eventId,
      paymentStatus,
      attendanceStatus,
      search,
    } = req.query;

    const query = {};

    if (eventId) {
      query.eventId = eventId;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    const registrations = await Registration.find(query)
      .populate(
        "eventId",
        "title slug category fee"
      )
      .populate(
        "participantIds",
        "registrationId name collegeId email phone department year attendanceStatus checkedInAt"
      )
      .sort({ createdAt: -1 });

    let filteredRegistrations = registrations;

    if (search) {
      const searchText = search.toLowerCase().trim();

      filteredRegistrations = registrations.filter((registration) => {
        const registrationMatch =
          registration.registrationId
            ?.toLowerCase()
            .includes(searchText);

        const participantMatch =
          registration.participantIds?.some((participant) =>
            [
              participant.name,
              participant.collegeId,
              participant.email,
              participant.phone,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value).toLowerCase().includes(searchText)
              )
          );

        return registrationMatch || participantMatch;
      });
    }

    if (attendanceStatus) {
      filteredRegistrations = filteredRegistrations.filter((registration) =>
        registration.participantIds?.some(
          (participant) =>
            participant.attendanceStatus === attendanceStatus
        )
      );
    }

    const registrationIds = filteredRegistrations.map(
      (registration) => registration._id
    );

    const payments = await Payment.find({
      registrationId: { $in: registrationIds },
    }).sort({ createdAt: -1 });

    const paymentsMap = new Map();

    for (const payment of payments) {
      const key = payment.registrationId.toString();

      if (!paymentsMap.has(key)) {
        paymentsMap.set(key, payment);
      }
    }

    const buffer = await generateRegistrationExcel(
      filteredRegistrations,
      paymentsMap
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="registrations.xlsx"'
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Export registrations error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to export registrations",
    });
  }
};


module.exports = {
  createRegistration,
  getRegistration,
  getRegistrations,
  getRegistrationById,
  exportRegistrations,
};