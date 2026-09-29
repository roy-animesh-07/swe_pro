const mongoose = require('mongoose');

// Single configuration document describing when the court sits.
// workingDays uses JavaScript day numbers: 0 = Sunday ... 6 = Saturday.
const courtCalendarSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'default' },
    workingDays: { type: [Number], required: true },
    timeSlots: { type: [String], required: true },
    holidays: { type: [String], default: [] }, // YYYY-MM-DD dates on which the court does not sit
  },
  { collection: 'court_calendar', timestamps: true }
);

module.exports = mongoose.model('CourtCalendar', courtCalendarSchema);
