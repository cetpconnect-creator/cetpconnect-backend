const ExcelJS = require("exceljs");

const generateRegistrationExcel = async (registrations, paymentsMap) => {
  const workbook = new ExcelJS.Workbook();

  const worksheet = workbook.addWorksheet("Registrations");

  worksheet.columns = [
    { header: "Registration ID", key: "registrationId", width: 22 },
    { header: "Event", key: "event", width: 25 },
    { header: "Category", key: "category", width: 15 },
    { header: "Registration Type", key: "registrationType", width: 20 },
    { header: "Participant Name", key: "name", width: 25 },
    { header: "College ID", key: "collegeId", width: 18 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Department", key: "department", width: 25 },
    { header: "Year", key: "year", width: 10 },
    { header: "Payment Status", key: "paymentStatus", width: 22 },
    { header: "Payment Amount", key: "amount", width: 16 },
    { header: "Payment Screenshot", key: "screenshotUrl", width: 40 },
    { header: "Attendance", key: "attendanceStatus", width: 20 },
    { header: "Checked In At", key: "checkedInAt", width: 25 },
  ];

  for (const registration of registrations) {
    const payment = paymentsMap.get(registration._id.toString());

    for (const participant of registration.participantIds || []) {
      worksheet.addRow({
        registrationId: registration.registrationId,
        event: registration.eventId?.title || "",
        category: registration.eventId?.category || "",
        registrationType: registration.registrationType,
        name: participant.name,
        collegeId: participant.collegeId,
        email: participant.email,
        phone: participant.phone,
        department: participant.department,
        year: participant.year,
        paymentStatus: registration.paymentStatus,
        amount: payment?.amount || registration.eventId?.fee || 0,
        screenshotUrl: payment?.screenshotUrl || "",
        attendanceStatus: participant.attendanceStatus,
        checkedInAt: participant.checkedInAt
          ? new Date(participant.checkedInAt).toLocaleString()
          : "",
      });
    }
  }

  worksheet.getRow(1).font = { bold: true };
  worksheet.freezePanes = "A2";
  worksheet.autoFilter = {
    from: "A1",
    to: "O1",
  };

  return workbook.xlsx.writeBuffer();
};

module.exports = {
  generateRegistrationExcel,
};