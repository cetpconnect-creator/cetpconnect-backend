const ExcelJS = require("exceljs");

const getCustomFieldValue = (customFields, fieldName) => {
  if (!customFields || !fieldName) return "";

  if (typeof customFields.get === "function") {
    return customFields.get(fieldName) ?? "";
  }

  return customFields[fieldName] ?? "";
};

const generateRegistrationExcel = async (registrations, paymentsMap) => {
  const workbook = new ExcelJS.Workbook();

  const worksheet = workbook.addWorksheet("Registrations");

  /*
   * ---------------------------------------------------------
   * Collect all custom registration fields
   * ---------------------------------------------------------
   */

  const customFieldsMap = new Map();

  for (const registration of registrations) {
    const fields = registration.eventId?.registrationFields || [];

    for (const field of fields) {
      if (!field?.name) continue;

      const name = String(field.name).trim();

      if (!customFieldsMap.has(name)) {
        customFieldsMap.set(name, {
          name,
          label: field.label || name,
        });
      }
    }
  }

  const customFields = Array.from(customFieldsMap.values());

  /*
   * ---------------------------------------------------------
   * Base Excel columns
   * ---------------------------------------------------------
   */

  const columns = [
    {
      header: "Registration ID",
      key: "registrationId",
      width: 22,
    },
    {
      header: "Registration Type",
      key: "registrationType",
      width: 20,
    },
    {
      header: "Registration Status",
      key: "registrationStatus",
      width: 22,
    },
    {
      header: "Registration Date",
      key: "registrationDate",
      width: 22,
    },

    // Event
    {
      header: "Event",
      key: "event",
      width: 25,
    },
    {
      header: "Event Slug",
      key: "eventSlug",
      width: 25,
    },
    {
      header: "Category",
      key: "category",
      width: 15,
    },
    {
      header: "Event Date",
      key: "eventDate",
      width: 18,
    },
    {
      header: "Start Time",
      key: "startTime",
      width: 15,
    },
    {
      header: "End Time",
      key: "endTime",
      width: 15,
    },
    {
      header: "Venue",
      key: "venue",
      width: 30,
    },
    {
      header: "Event Fee",
      key: "eventFee",
      width: 15,
    },

    // Team
    {
      header: "Team ID",
      key: "teamId",
      width: 22,
    },
    {
      header: "Team Name",
      key: "teamName",
      width: 25,
    },
    {
      header: "Team Status",
      key: "teamStatus",
      width: 18,
    },
    {
      header: "Team Leader",
      key: "teamLeader",
      width: 25,
    },
    {
      header: "Team Leader Registration ID",
      key: "teamLeaderRegistrationId",
      width: 28,
    },
    {
      header: "Team Leader College ID",
      key: "teamLeaderCollegeId",
      width: 25,
    },

    // Participant
    {
      header: "Participant Registration ID",
      key: "participantRegistrationId",
      width: 28,
    },
    {
      header: "Participant Name",
      key: "name",
      width: 25,
    },
    {
      header: "College ID",
      key: "collegeId",
      width: 18,
    },
    {
      header: "Email",
      key: "email",
      width: 30,
    },
    {
      header: "Phone",
      key: "phone",
      width: 18,
    },
    {
      header: "Department",
      key: "department",
      width: 25,
    },
    {
      header: "Year",
      key: "year",
      width: 10,
    },

    // Payment
    {
      header: "Payment Status",
      key: "paymentStatus",
      width: 22,
    },
    {
      header: "Payment Amount",
      key: "amount",
      width: 16,
    },
    {
      header: "Payment Screenshot",
      key: "screenshotUrl",
      width: 45,
    },
    {
      header: "Payment Submitted At",
      key: "paymentSubmittedAt",
      width: 25,
    },
    {
      header: "Payment Verified At",
      key: "paymentVerifiedAt",
      width: 25,
    },
    {
      header: "Payment Rejected At",
      key: "paymentRejectedAt",
      width: 25,
    },
    {
      header: "Payment Rejection Reason",
      key: "paymentRejectionReason",
      width: 35,
    },

    // Attendance
    {
      header: "Attendance",
      key: "attendanceStatus",
      width: 20,
    },
    {
      header: "Checked In At",
      key: "checkedInAt",
      width: 25,
    },
  ];

  /*
   * ---------------------------------------------------------
   * Add dynamic custom registration fields
   * ---------------------------------------------------------
   */

  for (const field of customFields) {
    columns.push({
      header: field.label,
      key: `custom_${field.name}`,
      width: 25,
    });
  }

  worksheet.columns = columns;

  /*
   * ---------------------------------------------------------
   * Generate rows
   * ---------------------------------------------------------
   */

  for (const registration of registrations) {
    const event = registration.eventId || {};
    const team = registration.teamId || null;

    const registrationId = registration._id?.toString();

    /*
     * Payment lookup
     *
     * Individual:
     * paymentsMap.get(registration._id)
     *
     * Team:
     * paymentsMap.get("TEAM:" + team._id)
     */

    let payment = paymentsMap.get(registrationId);

    if (!payment && team?._id) {
      payment = paymentsMap.get(`TEAM:${team._id.toString()}`);
    }

    /*
     * Team leader
     */

    const teamLeader = team?.leaderId || null;

    for (const participant of registration.participantIds || []) {
      const row = {
        registrationId: registration.registrationId || "",

        registrationType:
          registration.registrationType || "",

        registrationStatus:
          registration.status || "",

        registrationDate: registration.createdAt
          ? new Date(registration.createdAt).toLocaleString()
          : "",

        /*
         * Event
         */

        event: event.title || "",

        eventSlug: event.slug || "",

        category: event.category || "",

        eventDate: event.date
          ? new Date(event.date).toLocaleDateString()
          : "",

        startTime: event.startTime || "",

        endTime: event.endTime || "",

        venue: event.venue || "",

        eventFee:
          event.fee !== undefined && event.fee !== null
            ? event.fee
            : 0,

        /*
         * Team
         */

        teamId: team?.teamId || "",

        teamName: team?.name || "",

        teamStatus: team?.status || "",

        teamLeader: teamLeader?.name || "",

        teamLeaderRegistrationId:
          teamLeader?.registrationId || "",

        teamLeaderCollegeId:
          teamLeader?.collegeId || "",

        /*
         * Participant
         */

        participantRegistrationId:
          participant.registrationId || "",

        name: participant.name || "",

        collegeId: participant.collegeId || "",

        email: participant.email || "",

        phone: participant.phone || "",

        department: participant.department || "",

        year: participant.year || "",

        /*
         * Payment
         */

        paymentStatus:
          registration.paymentStatus ||
          payment?.status ||
          "",

        amount:
          payment?.amount !== undefined &&
          payment?.amount !== null
            ? payment.amount
            : event.fee || 0,

        screenshotUrl:
          payment?.screenshotUrl || "",

        paymentSubmittedAt: payment?.submittedAt
          ? new Date(payment.submittedAt).toLocaleString()
          : "",

        paymentVerifiedAt: payment?.verifiedAt
          ? new Date(payment.verifiedAt).toLocaleString()
          : "",

        paymentRejectedAt: payment?.rejectedAt
          ? new Date(payment.rejectedAt).toLocaleString()
          : "",

        paymentRejectionReason:
          payment?.rejectionReason || "",

        /*
         * Attendance
         */

        attendanceStatus:
          participant.attendanceStatus || "",

        checkedInAt: participant.checkedInAt
          ? new Date(participant.checkedInAt).toLocaleString()
          : "",
      };

      /*
       * -------------------------------------------------------
       * Dynamic custom fields
       * -------------------------------------------------------
       */

      for (const field of customFields) {
        row[`custom_${field.name}`] =
          getCustomFieldValue(
            participant.customFields,
            field.name
          );
      }

      worksheet.addRow(row);
    }
  }

  /*
   * ---------------------------------------------------------
   * Excel formatting
   * ---------------------------------------------------------
   */

  worksheet.getRow(1).font = {
    bold: true,
  };

  worksheet.getRow(1).alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };

  worksheet.getRow(1).height = 30;

  worksheet.freezePanes = "A2";

  /*
   * Auto filter across every column
   */

  const lastColumn = worksheet.columnCount;

  worksheet.autoFilter = {
    from: "A1",
    to: `${worksheet.getColumn(lastColumn).letter}1`,
  };

  /*
   * Wrap long text
   */

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "top",
        wrapText: true,
      };
    });
  });

  /*
   * ---------------------------------------------------------
   * Return Excel buffer
   * ---------------------------------------------------------
   */

  return workbook.xlsx.writeBuffer();
};

module.exports = {
  generateRegistrationExcel,
};