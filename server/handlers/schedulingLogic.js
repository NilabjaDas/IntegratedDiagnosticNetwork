const moment = require("moment");

/**
 * Generates exact time slots for a doctor on a specific date, accounting for shifts and breaks.
 */
const generateDoctorSlots = (scheduleForDay, consultationRules) => {
    if (!scheduleForDay || !scheduleForDay.isAvailable || scheduleForDay.shifts.length === 0) {
        return [];
    }

    const { slotDurationMinutes } = consultationRules;
    const slots = [];

    const timeToMins = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const minsToTime = (mins) => {
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    scheduleForDay.shifts.forEach(shift => {
        let currentMins = timeToMins(shift.startTime);
        const endMins = timeToMins(shift.endTime);

        while (currentMins + slotDurationMinutes <= endMins) {
            let isInBreak = false;
            let breakEndMins = 0;

            if (scheduleForDay.breaks) {
                for (const b of scheduleForDay.breaks) {
                    const bStart = timeToMins(b.startTime);
                    const bEnd = timeToMins(b.endTime);

                    if ((currentMins >= bStart && currentMins < bEnd) || 
                        (currentMins < bStart && (currentMins + slotDurationMinutes) > bStart)) {
                        isInBreak = true;
                        breakEndMins = bEnd;
                        break;
                    }
                }
            }

            if (isInBreak) {
                currentMins = breakEndMins;
            } else {
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
    const dayOfWeek = moment(dateString).day(); 
    const scheduleForDay = doctor.schedule.find(s => s.dayOfWeek === dayOfWeek);

    const generatedSlots = generateDoctorSlots(scheduleForDay, doctor.consultationRules);

    if (generatedSlots.length === 0) return { error: "Doctor is not available on this day." };
    if (serialNumber > generatedSlots.length && !doctor.consultationRules.allowOverbooking) {
        return { error: "Serial number exceeds doctor's capacity for the day." };
    }

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

// --- NEW: SMART ETA CALCULATOR (SMART QUEUE) ---
/**
 * Calculates the ETA for a serial number based on shift start time, 
 * average patient time, and ad-hoc delays.
 */
const calculateInitialETA = (doctor, dateString, shiftName, sequence) => {
    const dayOfWeek = moment(dateString).day();
    const daySchedule = doctor.schedule?.find(s => s.dayOfWeek === dayOfWeek);
    if (!daySchedule || !daySchedule.isAvailable) return null;

    const shift = daySchedule.shifts?.find(s => s.shiftName === shiftName);
    if (!shift) return null;

    // --- FIX: CHECK GRANULAR SHIFT OVERRIDES ---
    let delayMinutes = 0;
    const overridesForToday = doctor.dailyOverrides?.filter(o => o.date === dateString);
    
    if (overridesForToday && overridesForToday.length > 0) {
        // Find the override that specifically targets THIS shift (or targets all shifts)
        const shiftOverride = overridesForToday.find(o => 
            !o.shiftNames || o.shiftNames.length === 0 || o.shiftNames.includes(shiftName)
        );

        if (shiftOverride) {
            if (shiftOverride.isCancelled) return "CANCELLED";
            delayMinutes = shiftOverride.delayMinutes || 0;
        }
    }

    const [startHour, startMinute] = shift.startTime.split(':').map(Number);
    const shiftStart = moment(dateString).set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
    
    shiftStart.add(delayMinutes, 'minutes');

    const avgTime = doctor.consultationRules?.avgTimePerPatientMinutes || 15;
    const minutesToWait = (sequence - 1) * avgTime;
    const estimatedTime = shiftStart.add(minutesToWait, 'minutes');

    return {
        etaFormatted: estimatedTime.format("hh:mm A"),
        etaDate: estimatedTime.toDate(),
        isOverbooked: sequence > shift.maxTokens
    };
};

module.exports = { generateDoctorSlots, estimateTimeForSerialNumber, calculateInitialETA };