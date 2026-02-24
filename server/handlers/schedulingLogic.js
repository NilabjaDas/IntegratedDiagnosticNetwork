const moment = require("moment");

/**
 * Generates exact time slots for a doctor on a specific date, accounting for shifts and breaks.
 * @param {Object} scheduleForDay - The schedule object for the specific day of the week
 * @param {Object} consultationRules - slotDurationMinutes, etc.
 * @returns {Array} - Array of start times (e.g., ["08:00", "08:15", "08:30", "08:45", "10:15"...])
 */
const generateDoctorSlots = (scheduleForDay, consultationRules) => {
    if (!scheduleForDay || !scheduleForDay.isAvailable || scheduleForDay.shifts.length === 0) {
        return [];
    }

    const { slotDurationMinutes } = consultationRules;
    const slots = [];

    // Helper to convert "HH:mm" to minutes since midnight for easy math
    const timeToMins = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    // Helper to format minutes back to "HH:mm"
    const minsToTime = (mins) => {
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    // Iterate through each shift (e.g., Morning Shift, Evening Shift)
    scheduleForDay.shifts.forEach(shift => {
        let currentMins = timeToMins(shift.startTime);
        const endMins = timeToMins(shift.endTime);

        while (currentMins + slotDurationMinutes <= endMins) {
            
            // Check if the current proposed slot overlaps with any break
            let isInBreak = false;
            let breakEndMins = 0;

            if (scheduleForDay.breaks) {
                for (const b of scheduleForDay.breaks) {
                    const bStart = timeToMins(b.startTime);
                    const bEnd = timeToMins(b.endTime);

                    // If slot starts during a break, OR slot cuts into a break
                    if ((currentMins >= bStart && currentMins < bEnd) || 
                        (currentMins < bStart && (currentMins + slotDurationMinutes) > bStart)) {
                        isInBreak = true;
                        breakEndMins = bEnd;
                        break;
                    }
                }
            }

            if (isInBreak) {
                // Fast-forward the clock to the end of the break
                currentMins = breakEndMins;
            } else {
                // Valid slot found! Add it.
                slots.push(minsToTime(currentMins));
                currentMins += slotDurationMinutes;
            }
        }
    });

    return slots;
};

/**
 * Calculates the Estimated Time of Arrival (ETA) for a specific serial number.
 */
const estimateTimeForSerialNumber = (dateString, doctor, serialNumber) => {
    // Find the day of the week (0 = Sunday, 1 = Monday)
    const dayOfWeek = moment(dateString).day(); 
    
    // Get the doctor's schedule for this specific day
    const scheduleForDay = doctor.schedule.find(s => s.dayOfWeek === dayOfWeek);

    const generatedSlots = generateDoctorSlots(scheduleForDay, doctor.consultationRules);

    if (generatedSlots.length === 0) return { error: "Doctor is not available on this day." };
    if (serialNumber > generatedSlots.length && !doctor.consultationRules.allowOverbooking) {
        return { error: "Serial number exceeds doctor's capacity for the day." };
    }

    // Array is 0-indexed, so Serial 1 is index 0.
    // If overbooked (Serial 51 but only 50 slots), we just use the last slot + extra time
    if (serialNumber > generatedSlots.length) {
        const lastSlot = generatedSlots[generatedSlots.length - 1];
        const [h, m] = lastSlot.split(':').map(Number);
        const overbookMins = (h * 60 + m) + (doctor.consultationRules.slotDurationMinutes * (serialNumber - generatedSlots.length));
        
        const hOver = Math.floor(overbookMins / 60).toString().padStart(2, '0');
        const mOver = (overbookMins % 60).toString().padStart(2, '0');
        return { estimatedTime: `${hOver}:${mOver}`, isOverbooked: true };
    }

    return { estimatedTime: generatedSlots[serialNumber - 1], isOverbooked: false };
};

module.exports = { generateDoctorSlots, estimateTimeForSerialNumber };