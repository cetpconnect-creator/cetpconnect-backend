// controllers/event.controller.js

const Event = require("../models/Event");
const User = require("../models/User");

const {
  getCache,
  setCache,
  deleteCache,
} = require("../services/redis.service");

// =====================================================
// ACCESS CONTROL
// =====================================================

async function getAccessibleEventIds(req) {
  if (!req.user) {
    const error = new Error(
      "Authentication required."
    );

    error.statusCode = 401;

    throw error;
  }

  if (req.user.role === "SUPER_ADMIN") {
    return null;
  }

  const user = await User.findById(
    req.user.userId
  ).select(
    "assignedEvents isActive role"
  );

  if (!user) {
    const error = new Error(
      "User not found."
    );

    error.statusCode = 401;

    throw error;
  }

  if (!user.isActive) {
    const error = new Error(
      "Your account is inactive."
    );

    error.statusCode = 403;

    throw error;
  }

  return (
    user.assignedEvents || []
  ).map((id) =>
    id.toString()
  );
}

async function checkEventAccess(
  req,
  eventId
) {
  const accessibleEventIds =
    await getAccessibleEventIds(req);

  if (
    accessibleEventIds === null
  ) {
    return true;
  }

  if (
    !accessibleEventIds.includes(
      eventId.toString()
    )
  ) {
    const error = new Error(
      "You are not authorized to access this event."
    );

    error.statusCode = 403;

    throw error;
  }

  return true;
}

// =====================================================
// CREATE
// =====================================================

const createEvent = async (
  req,
  res
) => {
  try {
    const {
      title,
      slug,
      category,
      description,
      rules,
      date,
      startTime,
      endTime,
      venue,
      registrationStart,
      registrationEnd,
      fee,
      capacity,
      registrationType,
      minTeamSize,
      maxTeamSize,
      prizeMoney,
      registrationFields,
      status,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Event title is required.",
      });
    }

    if (!slug?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Event slug is required.",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message:
          "Event date is required.",
      });
    }

    if (!startTime) {
      return res.status(400).json({
        success: false,
        message:
          "Start time is required.",
      });
    }

    if (!endTime) {
      return res.status(400).json({
        success: false,
        message:
          "End time is required.",
      });
    }

    if (!venue?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Venue is required.",
      });
    }

    if (!registrationStart) {
      return res.status(400).json({
        success: false,
        message:
          "Registration start is required.",
      });
    }

    if (!registrationEnd) {
      return res.status(400).json({
        success: false,
        message:
          "Registration end is required.",
      });
    }

    if (
      !capacity ||
      Number(capacity) < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Capacity must be greater than 0.",
      });
    }

    const existingEvent =
      await Event.findOne({
        slug: slug
          .trim()
          .toLowerCase(),
      });

    if (existingEvent) {
      return res.status(409).json({
        success: false,
        message:
          "Event with this slug already exists.",
      });
    }

    const posterFile =
      req.files?.poster?.[0];

    const paymentQrFile =
      req.files?.paymentQr?.[0];

    const imageUrl =
      posterFile?.path || "";

    const paymentQrUrl =
      paymentQrFile?.path || "";

    let parsedRules = [];

    if (rules) {
      try {
        parsedRules =
          Array.isArray(rules)
            ? rules
            : JSON.parse(rules);
      } catch {
        parsedRules = String(rules)
          .split("\n")
          .map((item) =>
            item.trim()
          )
          .filter(Boolean);
      }
    }

    let parsedRegistrationFields =
      [];

    if (registrationFields) {
      try {
        parsedRegistrationFields =
          Array.isArray(
            registrationFields
          )
            ? registrationFields
            : JSON.parse(
              registrationFields
            );
      } catch {
        parsedRegistrationFields =
          [];
      }
    }

    /* =====================================================
   PARSE PRIZE MONEY
===================================================== */

    let parsedPrizeMoney = {
      first: null,
      second: null,
      third: null,
    };

    if (prizeMoney) {
      try {
        const parsed =
          typeof prizeMoney === "string"
            ? JSON.parse(prizeMoney)
            : prizeMoney;

        parsedPrizeMoney = {
          first:
            parsed?.first !== undefined &&
              parsed?.first !== null &&
              parsed?.first !== ""
              ? Number(parsed.first)
              : null,

          second:
            parsed?.second !== undefined &&
              parsed?.second !== null &&
              parsed?.second !== ""
              ? Number(parsed.second)
              : null,

          third:
            parsed?.third !== undefined &&
              parsed?.third !== null &&
              parsed?.third !== ""
              ? Number(parsed.third)
              : null,
        };
      } catch {
        parsedPrizeMoney = {
          first: null,
          second: null,
          third: null,
        };
      }
    }

    const event =
      await Event.create({
        title: title.trim(),

        slug: slug
          .trim()
          .toLowerCase(),

        category:
          category || "YUKTHIX",

        description:
          description?.trim() || "",

        imageUrl,

        rules: parsedRules,

        date,

        startTime,

        endTime,

        venue: venue.trim(),

        registrationStart,

        registrationEnd,

        fee: Number(fee) || 0,

        capacity:
          Number(capacity),

        registrationCount: 0,

        registrationType:
          registrationType ||
          "INDIVIDUAL",

        minTeamSize:
          registrationType ===
            "TEAM"
            ? Number(
              minTeamSize
            ) || 2
            : null,

        maxTeamSize:
          registrationType ===
            "TEAM"
            ? Number(
              maxTeamSize
            ) || 4
            : null,

        paymentQrUrl,

        prizeMoney:
          parsedPrizeMoney,

        registrationFields:
          parsedRegistrationFields,

        status:
          status || "DRAFT",

        createdBy:
          req.user.userId,
      });

    await deleteCache("cetpconnect:events:published");

    return res.status(201).json({
      success: true,
      message:
        "Event created successfully.",
      event,
    });
  } catch (error) {
    console.error(
      "CREATE EVENT ERROR:",
      error
    );

    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An event with this slug already exists.",
      });
    }

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to create event.",
    });
  }
};

// =====================================================
// GET ALL ADMIN EVENTS
// =====================================================

const getAllEvents = async (
  req,
  res
) => {
  try {
    const accessibleEventIds =
      await getAccessibleEventIds(req);

    const query = {};

    if (
      accessibleEventIds !== null
    ) {
      query._id = {
        $in: accessibleEventIds,
      };
    }

    const events =
      await Event.find(query)
        .populate(
          "createdBy",
          "username name role"
        )
        .sort({
          createdAt: -1,
        })
        .lean();

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error(
      "GET ALL EVENTS ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to load events.",
    });
  }
};

// =====================================================
// GET SINGLE ADMIN EVENT
// =====================================================

const getAdminEvent = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const event =
      await Event.findById(id)
        .populate(
          "createdBy",
          "username name role"
        )
        .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message:
          "Event not found.",
      });
    }

    await checkEventAccess(
      req,
      event._id
    );

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error(
      "GET ADMIN EVENT ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to load event.",
    });
  }
};

// =====================================================
// UPDATE
// =====================================================

const updateEvent = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const event =
      await Event.findById(id);


    if (!event) {
      return res.status(404).json({
        success: false,
        message:
          "Event not found.",
      });
    }

    const oldSlug = event.slug;

    await checkEventAccess(
      req,
      event._id
    );

    const allowedFields = [
      "title",
      "slug",
      "category",
      "description",
      "date",
      "startTime",
      "endTime",
      "venue",
      "registrationStart",
      "registrationEnd",
      "fee",
      "capacity",
      "registrationType",
      "minTeamSize",
      "maxTeamSize",
      "status",
    ];

    for (
      const field of allowedFields
    ) {
      if (
        req.body[field] !==
        undefined
      ) {
        event[field] =
          req.body[field];
      }
    }

    if (
      req.body.slug !==
      undefined
    ) {
      const duplicate =
        await Event.findOne({
          slug: String(
            req.body.slug
          )
            .trim()
            .toLowerCase(),

          _id: {
            $ne: event._id,
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "An event with this slug already exists.",
        });
      }

      event.slug =
        String(req.body.slug)
          .trim()
          .toLowerCase();
    }

    if (
      req.body.rules !==
      undefined
    ) {
      try {
        event.rules =
          Array.isArray(
            req.body.rules
          )
            ? req.body.rules
            : JSON.parse(
              req.body.rules
            );
      } catch {
        event.rules = String(
          req.body.rules
        )
          .split("\n")
          .map((item) =>
            item.trim()
          )
          .filter(Boolean);
      }
    }

    if (
      req.body.registrationFields !==
      undefined
    ) {
      try {
        event.registrationFields =
          Array.isArray(
            req.body
              .registrationFields
          )
            ? req.body
              .registrationFields
            : JSON.parse(
              req.body
                .registrationFields
            );
      } catch {
        event.registrationFields =
          [];
      }
    }

    /* =====================================================
   UPDATE PRIZE MONEY
===================================================== */

    if (
      req.body.prizeMoney !== undefined
    ) {
      try {
        const parsed =
          typeof req.body.prizeMoney === "string"
            ? JSON.parse(
              req.body.prizeMoney
            )
            : req.body.prizeMoney;

        event.prizeMoney = {
          first:
            parsed?.first !== undefined &&
              parsed?.first !== null &&
              parsed?.first !== ""
              ? Number(parsed.first)
              : null,

          second:
            parsed?.second !== undefined &&
              parsed?.second !== null &&
              parsed?.second !== ""
              ? Number(parsed.second)
              : null,

          third:
            parsed?.third !== undefined &&
              parsed?.third !== null &&
              parsed?.third !== ""
              ? Number(parsed.third)
              : null,
        };
      } catch {
        event.prizeMoney = {
          first: null,
          second: null,
          third: null,
        };
      }
    }

    if (
      req.body.fee !==
      undefined
    ) {
      event.fee =
        Number(req.body.fee) || 0;
    }

    if (
      req.body.capacity !==
      undefined
    ) {
      event.capacity =
        Number(
          req.body.capacity
        ) || 1;
    }

    if (
      req.body.registrationType ===
      "INDIVIDUAL"
    ) {
      event.minTeamSize = null;
      event.maxTeamSize = null;
    }

    if (
      req.body.minTeamSize !==
      undefined &&
      req.body.registrationType ===
      "TEAM"
    ) {
      event.minTeamSize =
        Number(
          req.body.minTeamSize
        ) || 2;
    }

    if (
      req.body.maxTeamSize !==
      undefined &&
      req.body.registrationType ===
      "TEAM"
    ) {
      event.maxTeamSize =
        Number(
          req.body.maxTeamSize
        ) || 4;
    }

    const posterFile =
      req.files?.poster?.[0];

    if (posterFile) {
      event.imageUrl =
        posterFile.path;
    }

    const paymentQrFile =
      req.files?.paymentQr?.[0];

    if (paymentQrFile) {
      event.paymentQrUrl =
        paymentQrFile.path;
    }

    await event.save();

    await deleteCache(
      "cetpconnect:events:published"
    );

    await deleteCache(
      `cetpconnect:event:slug:${oldSlug}`
    );

    await deleteCache(
      `cetpconnect:event:slug:${event.slug}`
    );

    return res.status(200).json({
      success: true,
      message:
        "Event updated successfully.",
      event,
    });
  } catch (error) {
    console.error(
      "UPDATE EVENT ERROR:",
      error
    );

    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        success: false,
        message:
          "An event with this slug already exists.",
      });
    }

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to update event.",
    });
  }
};

// =====================================================
// DELETE
// =====================================================

const deleteEvent = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const event =
      await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message:
          "Event not found.",
      });
    }

    const oldSlug = event.slug;

    await event.deleteOne();

    await deleteCache(
      "cetpconnect:events:published"
    );

    await deleteCache(
      `cetpconnect:event:slug:${oldSlug}`
    );

    return res.status(200).json({
      success: true,
      message:
        "Event deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE EVENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to delete event.",
    });
  }
};

// =====================================================
// PUBLIC EVENTS
// =====================================================

const getPublishedEvents = async (req, res) => {
  const CACHE_KEY = "cetpconnect:events:published";
  const CACHE_TTL = 60 * 60 * 24; // 24 hours

  try {
    // ==========================================
    // 1. TRY REDIS CACHE
    // ==========================================

    const cachedEvents = await getCache(CACHE_KEY);

    if (cachedEvents) {
      console.log("⚡ /api/events → Redis HIT");

      return res.status(200).json(cachedEvents);
    }

    console.log("🐢 /api/events → Redis MISS");

    // ==========================================
    // 2. REDIS MISS → GET FROM MONGODB
    // ==========================================

    const events = await Event.find({
      status: "PUBLISHED",
    })
      .select(
        [
          "title",
          "slug",
          "category",
          "description",
          "imageUrl",
          "rules",
          "date",
          "startTime",
          "endTime",
          "venue",
          "registrationStart",
          "registrationEnd",
          "fee",
          "capacity",
          "prizeMoney",
          "registrationType",
          "minTeamSize",
          "maxTeamSize",
          "paymentQrUrl",
          "registrationFields",
          "status",
          "createdAt",
        ].join(" ")
      )
      .sort({
        date: 1,
      })
      .lean();

    const response = {
      success: true,
      count: events.length,
      events,
    };

    // ==========================================
    // 3. STORE RESULT IN REDIS
    // ==========================================

    await setCache(
      CACHE_KEY,
      response,
      CACHE_TTL
    );

    // ==========================================
    // 4. RETURN RESPONSE
    // ==========================================

    return res.status(200).json(response);
  } catch (error) {
    console.error(
      "GET PUBLISHED EVENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load published events.",
    });
  }
};

// =====================================================
// PUBLIC EVENT BY SLUG
// =====================================================

const getEventBySlug = async (req, res) => {
  const slug = String(req.params.slug || "")
    .trim()
    .toLowerCase();

  const CACHE_KEY = `cetpconnect:event:slug:${slug}`;
  const CACHE_TTL = 60 * 60 * 24; // 24 hours

  try {
    // ==========================================
    // 1. TRY REDIS
    // ==========================================

    const cachedEvent = await getCache(CACHE_KEY);

    if (cachedEvent) {
      console.log(
        `⚡ /api/events/${slug} → Redis HIT`
      );

      return res.status(200).json(cachedEvent);
    }

    console.log(
      `🐢 /api/events/${slug} → Redis MISS`
    );

    // ==========================================
    // 2. GET FROM MONGODB
    // ==========================================

    const event = await Event.findOne({
      slug,
      status: "PUBLISHED",
    }).lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    const response = {
      success: true,
      event,
    };

    // ==========================================
    // 3. STORE IN REDIS
    // ==========================================

    await setCache(
      CACHE_KEY,
      response,
      CACHE_TTL
    );

    // ==========================================
    // 4. RETURN
    // ==========================================

    return res.status(200).json(response);
  } catch (error) {
    console.error(
      "GET EVENT BY SLUG ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load event.",
    });
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getAdminEvent,
  updateEvent,
  deleteEvent,
  getPublishedEvents,
  getEventBySlug,
  getAccessibleEventIds,
  checkEventAccess,
};