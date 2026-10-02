const crypto = require("crypto");

const Event = require("../models/Event");
const Participant = require("../models/Participant");
const Registration = require("../models/Registration");
const Payment = require("../models/Payment");
const User = require("../models/User");

const { generateParticipantQR } = require("../services/qr.service");
const { generateRegistrationExcel } = require("../services/excel.service");

// =====================================================
// HELPER
// GET EVENTS USER IS ALLOWED TO ACCESS
// =====================================================

const getAccessibleEventIds = async (req) => {
  const role = req.user?.role;
  const userId = req.user?.userId;

  // SUPER_ADMIN can access everything
  if (role === "SUPER_ADMIN") {
    return null;
  }

  const user = await User.findById(userId)
    .select("assignedEvents isActive role")
    .lean();

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error("User account is inactive");
    error.statusCode = 401;
    throw error;
  }

  const assignedEvents = Array.isArray(user.assignedEvents)
    ? user.assignedEvents
    : [];

  return assignedEvents;
};

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
      rawValue === undefined || rawValue === null
        ? ""
        : String(rawValue).trim();

    // Only save fields configured for this event
    normalized[key] = value;

    // Required validation
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

    // Email validation
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

    // Phone validation
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

    // Number validation
    if (field.type === "number") {
      if (Number.isNaN(Number(value))) {
        const error = new Error(
          `${field.label || key} must be a valid number.`
        );

        error.statusCode = 400;
        throw error;
      }
    }

    // Select validation
    if (field.type === "select") {
      const options = Array.isArray(field.options)
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
        message:
          "All required registration fields must be provided",
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.status !== "PUBLISHED") {
      return res.status(400).json({
        success: false,
        message:
          "Registration is not available for this event",
      });
    }

    if (event.registrationType !== "INDIVIDUAL") {
      return res.status(400).json({
        success: false,
        message:
          "This event uses team registration. Individual registration is not allowed.",
      });
    }

    const now = new Date();

    const registrationStart =
      new Date(event.registrationStart);

    const registrationEnd =
      new Date(event.registrationEnd);

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

    if (event.registrationCount >= event.capacity) {
      return res.status(400).json({
        success: false,
        message: "Event registration capacity is full",
      });
    }

    // =====================================================
    // CUSTOM FIELD VALIDATION
    // =====================================================

    const normalizedCustomFields =
      validateAndNormalizeCustomFields(
        event.registrationFields || [],
        customFields || {}
      );

    const normalizedCollegeId =
      collegeId.trim();

    const existingParticipant =
      await Participant.findOne({
        eventId: event._id,
        collegeId: normalizedCollegeId,
      });

    if (existingParticipant) {
      return res.status(409).json({
        success: false,
        message:
          "This student is already registered for this event",
      });
    }

    const registrationId =
      "REG-" +
      crypto
        .randomBytes(6)
        .toString("hex")
        .toUpperCase();

    const qrToken =
      crypto.randomBytes(32).toString("hex");

    const qrImage =
      await generateParticipantQR(qrToken);

    const participant =
      await Participant.create({
        registrationId,
        eventId: event._id,

        name: name.trim(),

        collegeId: normalizedCollegeId,

        email: email.trim().toLowerCase(),

        phone: phone.trim(),

        department: department.trim(),

        year: year.toString(),

        // Event-specific fields
        customFields: normalizedCustomFields,

        qrToken,

        attendanceStatus: "NOT_CHECKED_IN",
      });

    const paymentStatus =
      event.fee > 0
        ? "PENDING_PAYMENT"
        : "PAYMENT_VERIFIED";

    let registration;

    try {
      registration =
        await Registration.create({
          registrationId,

          eventId: event._id,

          registrationType: "INDIVIDUAL",

          participantIds: [
            participant._id,
          ],

          teamId: null,

          paymentStatus,

          status: "ACTIVE",
        });
    } catch (registrationError) {
      await Participant.findByIdAndDelete(
        participant._id
      );

      throw registrationError;
    }

    event.registrationCount += 1;

    await event.save();

    return res.status(201).json({
      success: true,

      message:
        "Registration created successfully",

      registration: {
        registrationId:
          registration.registrationId,

        eventId: event._id,

        participantId:
          participant._id,

        paymentStatus:
          registration.paymentStatus,

        participant: {
          name: participant.name,

          collegeId:
            participant.collegeId,

          email:
            participant.email,

          phone:
            participant.phone,

          department:
            participant.department,

          year:
            participant.year,

          customFields:
            participant.customFields || {},
        },

        qrCode: qrImage,
      },
    });
  } catch (error) {
    console.error(
      "Create registration error:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Registration already exists",
      });
    }

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// GET PUBLIC REGISTRATION
// GET /api/registrations/:registrationId
// =====================================================

const getRegistration = async (req, res) => {
  try {
    const { registrationId } = req.params;

    if (!registrationId) {
      return res.status(400).json({
        success: false,
        message:
          "Registration ID is required",
      });
    }

    const normalizedRegistrationId =
      registrationId
        .trim()
        .toUpperCase();

    const registration =
      await Registration.findOne({
        registrationId:
          normalizedRegistrationId,
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
            "registrationId name collegeId email phone department year customFields attendanceStatus checkedInAt +qrToken",
        })
        .populate(
          "teamId",
          "teamId name leaderId status"
        );

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    /*
     * Generate fresh QR image data for every participant.
     *
     * qrToken is stored securely in Participant
     * but is temporarily selected here so we can
     * regenerate the QR image.
     */

    const participants =
      await Promise.all(
        registration.participantIds.map(
          async (participant) => {
            let qrCode = "";

            if (participant.qrToken) {
              qrCode =
                await generateParticipantQR(
                  participant.qrToken
                );
            }

            return {
              _id:
                participant._id,

              registrationId:
                participant.registrationId,

              name:
                participant.name,

              collegeId:
                participant.collegeId,

              email:
                participant.email,

              phone:
                participant.phone,

              department:
                participant.department,

              year:
                participant.year,

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
      "Get registration error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =====================================================
// ADMIN / STAFF: GET REGISTRATIONS
// GET /api/admin/registrations
// =====================================================

const getRegistrations = async (req, res) => {
  try {
    const {
      eventId,
      search,
      paymentStatus,
      registrationType,
      status,
      attendanceStatus,
      page = 1,
      limit = 20,
    } = req.query;

    // -------------------------------------------------
    // ROLE ACCESS
    // -------------------------------------------------

    const accessibleEventIds =
      await getAccessibleEventIds(req);

    // -------------------------------------------------
    // BASE QUERY
    // -------------------------------------------------

    const registrationQuery = {};

    if (accessibleEventIds !== null) {
      registrationQuery.eventId = {
        $in: accessibleEventIds,
      };
    }

    if (eventId) {
      if (accessibleEventIds === null) {
        registrationQuery.eventId = eventId;
      } else {
        const hasAccess =
          accessibleEventIds.some(
            (id) =>
              id.toString() ===
              eventId.toString()
          );

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message:
              "You are not authorized to view registrations for this event",
          });
        }

        registrationQuery.eventId =
          eventId;
      }
    }

    if (paymentStatus) {
      registrationQuery.paymentStatus =
        paymentStatus;
    }

    if (registrationType) {
      registrationQuery.registrationType =
        registrationType;
    }

    if (status) {
      registrationQuery.status = status;
    }

    // -------------------------------------------------
    // FETCH DATA
    // -------------------------------------------------

    let registrations =
      await Registration.find(
        registrationQuery
      )
        .populate(
          "eventId",
          "title slug category date venue fee imageUrl capacity status registrationCount"
        )
        .populate(
          "participantIds",
          "registrationId name collegeId email phone department year customFields attendanceStatus checkedInAt"
        )
        .populate(
          "teamId",
          "teamId name leaderId status"
        )
        .sort({ createdAt: -1 })
        .lean();

    // -------------------------------------------------
    // SEARCH
    // -------------------------------------------------

    if (search && search.trim()) {
      const searchText =
        search.trim().toLowerCase();

      registrations =
        registrations.filter(
          (registration) => {
            const registrationMatch =
              registration.registrationId
                ?.toLowerCase()
                .includes(searchText);

            const eventMatch =
              registration.eventId?.title
                ?.toLowerCase()
                .includes(searchText);

            const participantMatch =
              registration.participantIds?.some(
                (participant) => {
                  return [
                    participant.name,
                    participant.collegeId,
                    participant.email,
                    participant.phone,
                    participant.department,
                  ]
                    .filter(Boolean)
                    .some((value) =>
                      String(value)
                        .toLowerCase()
                        .includes(searchText)
                    );
                }
              );

            const teamMatch =
              registration.teamId?.teamId
                ?.toLowerCase()
                .includes(searchText) ||
              registration.teamId?.name
                ?.toLowerCase()
                .includes(searchText);

            return (
              registrationMatch ||
              eventMatch ||
              participantMatch ||
              teamMatch
            );
          }
        );
    }

    // -------------------------------------------------
    // ATTENDANCE FILTER
    // -------------------------------------------------

    if (attendanceStatus) {
      registrations =
        registrations.filter(
          (registration) =>
            registration.participantIds?.some(
              (participant) =>
                participant.attendanceStatus ===
                attendanceStatus
            )
        );
    }

    // -------------------------------------------------
    // TOTAL
    // -------------------------------------------------

    const total =
      registrations.length;

    // -------------------------------------------------
    // PAGINATION
    // -------------------------------------------------

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      100
    );

    const totalPages =
      total === 0
        ? 1
        : Math.ceil(
            total / limitNumber
          );

    const safePage = Math.min(
      pageNumber,
      totalPages
    );

    const skip =
      (safePage - 1) *
      limitNumber;

    const paginatedRegistrations =
      registrations.slice(
        skip,
        skip + limitNumber
      );

    // -------------------------------------------------
    // NORMALIZE RESPONSE
    // -------------------------------------------------

    const normalizedRegistrations =
      paginatedRegistrations.map(
        (registration) => {
          const firstParticipant =
            registration
              .participantIds?.[0] ||
            null;

          const team =
            registration.teamId ||
            null;

          return {
            _id:
              registration._id,

            registrationId:
              registration.registrationId,

            registrationType:
              registration.registrationType,

            paymentStatus:
              registration.paymentStatus,

            status:
              registration.status,

            createdAt:
              registration.createdAt,

            event:
              registration.eventId ||
              null,

            participants:
              registration.participantIds ||
              [],

            participant:
              firstParticipant,

            team: team
              ? {
                  teamId:
                    team.teamId,

                  teamName:
                    team.name,

                  leaderId:
                    team.leaderId,

                  status:
                    team.status,
                }
              : null,
          };
        }
      );

    return res.status(200).json({
      success: true,

      page: safePage,

      limit: limitNumber,

      total,

      count:
        normalizedRegistrations.length,

      pagination: {
        page: safePage,
        limit: limitNumber,
        total,
        totalPages,

        hasNextPage:
          safePage < totalPages,

        hasPreviousPage:
          safePage > 1,
      },

      registrations:
        normalizedRegistrations,
    });
  } catch (error) {
    console.error(
      "Get registrations error:",
      error
    );

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
      message: "Server error",
    });
  }
};

// =====================================================
// GET SINGLE REGISTRATION
// GET /api/admin/registrations/:id
// =====================================================

const getRegistrationById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (!id || !id.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Registration ID is required",
      });
    }

    const registrationId =
      id.trim().toUpperCase();

    const registration =
      await Registration.findOne({
        registrationId,
      })
        .populate(
          "eventId",
          "title slug category description imageUrl date startTime endTime venue fee registrationStart registrationEnd capacity status registrationCount registrationFields"
        )
        .populate(
          "participantIds",
          "registrationId name collegeId email phone department year customFields attendanceStatus checkedInAt checkedInBy"
        )
        .populate(
          "teamId",
          "teamId name leaderId status"
        )
        .lean();

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // -------------------------------------------------
    // EVENT ACCESS CHECK
    // -------------------------------------------------

    const accessibleEventIds =
      await getAccessibleEventIds(req);

    if (accessibleEventIds !== null) {
      const eventId =
        registration.eventId?._id?.toString();

      const hasAccess =
        eventId &&
        accessibleEventIds.some(
          (assignedEventId) =>
            assignedEventId.toString() ===
            eventId
        );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to view this registration",
        });
      }
    }

    // -------------------------------------------------
    // NORMALIZED RESPONSE
    // -------------------------------------------------

    const firstParticipant =
      registration
        .participantIds?.[0] ||
      null;

    const team =
      registration.teamId ||
      null;

    return res.status(200).json({
      success: true,

      registration: {
        _id:
          registration._id,

        registrationId:
          registration.registrationId,

        registrationType:
          registration.registrationType,

        paymentStatus:
          registration.paymentStatus,

        status:
          registration.status,

        createdAt:
          registration.createdAt,

        event:
          registration.eventId,

        participants:
          registration.participantIds ||
          [],

        participant:
          firstParticipant,

        team: team
          ? {
              teamId:
                team.teamId,

              teamName:
                team.name,

              leaderId:
                team.leaderId,

              status:
                team.status,
            }
          : null,
      },
    });
  } catch (error) {
    console.error(
      "Get registration by ID error:",
      error
    );

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
      message: "Server error",
    });
  }
};

// =====================================================
// EXPORT REGISTRATIONS
// GET /api/admin/registrations/export
// =====================================================

const exportRegistrations = async (
  req,
  res
) => {
  try {
    const {
      eventId,
      paymentStatus,
      attendanceStatus,
      search,
    } = req.query;

    // -------------------------------------------------
    // ROLE ACCESS
    // -------------------------------------------------

    const accessibleEventIds =
      await getAccessibleEventIds(req);

    const query = {};

    if (accessibleEventIds !== null) {
      query.eventId = {
        $in: accessibleEventIds,
      };
    }

    // -------------------------------------------------
    // EVENT FILTER
    // -------------------------------------------------

    if (eventId) {
      if (
        accessibleEventIds === null
      ) {
        query.eventId = eventId;
      } else {
        const hasAccess =
          accessibleEventIds.some(
            (assignedEventId) =>
              assignedEventId.toString() ===
              eventId.toString()
          );

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            message:
              "You are not authorized to export this event's registrations",
          });
        }

        query.eventId = eventId;
      }
    }

    // -------------------------------------------------
    // PAYMENT FILTER
    // -------------------------------------------------

    if (paymentStatus) {
      query.paymentStatus =
        paymentStatus;
    }

    // -------------------------------------------------
    // LOAD REGISTRATIONS
    // -------------------------------------------------

    let registrations =
      await Registration.find(query)
        .populate(
          "eventId",
          [
            "title",
            "slug",
            "category",
            "fee",
            "date",
            "startTime",
            "endTime",
            "venue",
            "registrationFields",
          ].join(" ")
        )
        .populate(
          "participantIds",
          [
            "registrationId",
            "name",
            "collegeId",
            "email",
            "phone",
            "department",
            "year",
            "customFields",
            "attendanceStatus",
            "checkedInAt",
          ].join(" ")
        )
        .populate({
          path: "teamId",
          select:
            "teamId name leaderId status eventId",
          populate: {
            path: "leaderId",
            select:
              "registrationId name collegeId email phone department year",
          },
        })
        .sort({
          createdAt: -1,
        });

    // -------------------------------------------------
    // SEARCH
    // -------------------------------------------------

    if (
      search &&
      search.trim()
    ) {
      const searchText =
        search
          .trim()
          .toLowerCase();

      registrations =
        registrations.filter(
          (registration) => {
            const registrationMatch =
              registration.registrationId
                ?.toLowerCase()
                .includes(searchText);

            const participantMatch =
              registration.participantIds?.some(
                (participant) =>
                  [
                    participant.name,
                    participant.collegeId,
                    participant.email,
                    participant.phone,
                  ]
                    .filter(Boolean)
                    .some((value) =>
                      String(value)
                        .toLowerCase()
                        .includes(
                          searchText
                        )
                    )
              );

            const teamMatch =
              registration.teamId?.teamId
                ?.toLowerCase()
                .includes(searchText) ||
              registration.teamId?.name
                ?.toLowerCase()
                .includes(searchText);

            return (
              registrationMatch ||
              participantMatch ||
              teamMatch
            );
          }
        );
    }

    // -------------------------------------------------
    // ATTENDANCE FILTER
    // -------------------------------------------------

    if (attendanceStatus) {
      registrations =
        registrations.filter(
          (registration) =>
            registration.participantIds?.some(
              (participant) =>
                participant.attendanceStatus ===
                attendanceStatus
            )
        );
    }

    // -------------------------------------------------
    // GET PAYMENTS
    // -------------------------------------------------

    const registrationIds =
      registrations.map(
        (registration) =>
          registration._id
      );

    const teamObjectIds =
      registrations
        .map(
          (registration) =>
            registration.teamId?._id
        )
        .filter(Boolean);

    /*
     * Get both:
     *
     * 1. Payments linked to registration
     * 2. Payments linked directly to team
     *
     * This is important because your payment
     * model supports both registrationId and teamId.
     */

    const paymentQuery = {
      $or: [
        {
          registrationId: {
            $in: registrationIds,
          },
        },
        {
          teamId: {
            $in: teamObjectIds,
          },
        },
      ],
    };

    const payments =
      registrationIds.length ||
      teamObjectIds.length
        ? await Payment.find(
            paymentQuery
          ).sort({
            createdAt: -1,
          })
        : [];

    // -------------------------------------------------
    // PAYMENT MAP
    // -------------------------------------------------

    const paymentsMap =
      new Map();

    for (const payment of payments) {
      /*
       * Registration payment
       */

      if (
        payment.registrationId
      ) {
        const registrationKey =
          payment.registrationId.toString();

        if (
          !paymentsMap.has(
            registrationKey
          )
        ) {
          paymentsMap.set(
            registrationKey,
            payment
          );
        }
      }

      /*
       * Team payment
       */

      if (payment.teamId) {
        const teamKey =
          `TEAM:${payment.teamId.toString()}`;

        if (
          !paymentsMap.has(
            teamKey
          )
        ) {
          paymentsMap.set(
            teamKey,
            payment
          );
        }
      }
    }

    // -------------------------------------------------
    // GENERATE EXCEL
    // -------------------------------------------------

    const buffer =
      await generateRegistrationExcel(
        registrations,
        paymentsMap
      );

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

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
    console.error(
      "Export registrations error:",
      error
    );

    if (error.statusCode) {
      return res.status(
        error.statusCode
      ).json({
        success: false,
        message:
          error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to export registrations",
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createRegistration,
  getRegistration,
  getRegistrations,
  getRegistrationById,
  exportRegistrations,
};