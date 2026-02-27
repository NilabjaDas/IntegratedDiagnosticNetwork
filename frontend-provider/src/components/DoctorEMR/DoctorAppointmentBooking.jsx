import React, { useState, useEffect, useRef, useMemo } from "react";
import { Form, message, Badge } from "antd";
import { useDispatch, useSelector } from "react-redux";
import dayjs from "dayjs";

// API & Redux
import { createOrder, searchPatients, getDoctors, fetchDoctorMonthlyBookings, fetchMyInstitutionSettings } from "../../redux/apiCalls";
import { patientSearchSuccess } from "../../redux/orderRedux";

// Modals & Drawers
import CreatePatientModal from "../OrderManager/CreatePatientModal";
import PaymentModal from "../OrderManager/PaymentModal";
import DiscountOverrideModal from "../OrderManager/DiscountOverrideModal";
import OrderDetailsDrawer from "../OrderManager/OrderDetailsDrawer";

// Sub-components
import BookingPatientSelect from "./BookingComponents/BookingPatientSelect";
import BookingDoctorSelect from "./BookingComponents/BookingDoctorSelect";
import BookingBillingFooter from "./BookingComponents/BookingBillingFooter";
import BookingCalendar from "./BookingComponents/BookingCalendar";
import BookingPatientList from "./BookingComponents/BookingPatientList";

const DoctorAppointmentBooking = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  // Refs
  const patientSearchRef = useRef(null);
  const walkinNameRef = useRef(null);

  // --- REDUX ---
  const { searchResults } = useSelector((state) => state[process.env.REACT_APP_ORDERS_DATA_KEY] || state.order);
  const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);
  const activeDoctors = useMemo(() => doctors.filter(d => d.isActive), [doctors]);

  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [scheduleDate, setScheduleDate] = useState(dayjs());
  const [counters, setCounters] = useState([]); 
  
  // Doctor & Booking Selection
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);
  const [availableShifts, setAvailableShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [isFollowUp, setIsFollowUp] = useState(false);

  // Patient
  const [patientId, setPatientId] = useState(null);
  const [selectedPatientOriginal, setSelectedPatientOriginal] = useState(null);
  const [patientForm, setPatientForm] = useState({ name: "", age: "", gender: "Male" });

  // Billing
  const [totalAmount, setTotalAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [dueAmount, setDueAmount] = useState(0);
  const paidAmount = Form.useWatch("paidAmount", form) || 0;

  // Right Panel Data
  const [monthlyBookings, setMonthlyBookings] = useState([]);
  const [fetchingCalendar, setFetchingCalendar] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState(null); 

  // Modals
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);

  const activeDoctor = useMemo(() => doctors.find(d => d._id === selectedDoctorId || d.doctorId === selectedDoctorId), [doctors, selectedDoctorId]);

  const activeDoctorCabin = useMemo(() => {
    if (!activeDoctor || !activeDoctor.assignedCounterId) return null;
    return counters.find(c => c.counterId === activeDoctor.assignedCounterId);
  }, [activeDoctor, counters]);

  // --- INITIALIZATION ---
  useEffect(() => {
    getDoctors(dispatch);
    const loadInfrastructure = async () => {
        const settings = await fetchMyInstitutionSettings();
        if (settings && settings.counters) setCounters(settings.counters);
    };
    loadInfrastructure();
    setTimeout(() => { if (patientSearchRef.current) patientSearchRef.current.focus(); }, 100);
  }, [dispatch]);

  // --- SMART DOCTOR AVAILABILITY HELPER ---
const getDoctorAvailability = (doctor, dateObj) => {
    if (!doctor) return [];
    
    const dateStr = dateObj.format("YYYY-MM-DD");
    const dayIndex = dateObj.day();
    const weekOfMonth = Math.ceil(dateObj.date() / 7);

    let availableShifts = [];

    // 1. GET REGULAR SCHEDULE
    const daySchedule = doctor.schedule?.find(s => s.dayOfWeek === dayIndex);
    if (daySchedule && daySchedule.isAvailable) {
        availableShifts = daySchedule.shifts.filter(shift => {
            if (shift.repeatWeeks && shift.repeatWeeks.length > 0) {
                return shift.repeatWeeks.includes(weekOfMonth);
            }
            return true;
        });
    }

    // 2. APPLY LEAVES
    const plannedLeave = doctor.leaves?.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
    if (plannedLeave) {
        // If no specific shifts are mentioned, it's a full day leave. Wipe out regular shifts.
        if (!plannedLeave.shiftNames || plannedLeave.shiftNames.length === 0) {
            availableShifts = [];
        } else {
            // Otherwise, filter out the specific leave shifts
            availableShifts = availableShifts.filter(s => !plannedLeave.shiftNames.includes(s.shiftName));
        }
    }

    // 3. APPLY DAILY CANCELLATIONS (Overrides)
    const override = doctor.dailyOverrides?.find(o => o.date === dateStr);
    if (override && override.isCancelled) {
        if (!override.shiftNames || override.shiftNames.length === 0) {
            availableShifts = [];
        } else {
            availableShifts = availableShifts.filter(s => !override.shiftNames.includes(s.shiftName));
        }
    }

    // 4. ADD SPECIAL SHIFTS
    // Special shifts explicitly assigned to this date overrule regular days off and leaves.
    const specialShiftsForDay = doctor.specialShifts?.filter(s => s.date === dateStr) || [];
    
    specialShiftsForDay.forEach(specialShift => {
        // If a special shift has the same name as a regular shift (rare), it replaces it. 
        // Otherwise, it gets added to the available shifts.
        const existingIndex = availableShifts.findIndex(s => s.shiftName === specialShift.shiftName);
        if (existingIndex > -1) {
            availableShifts[existingIndex] = specialShift; 
        } else {
            availableShifts.push(specialShift);
        }
    });

    return availableShifts;
};
  // --- CALENDAR & DOCTOR SYNC ---
  useEffect(() => {
    if (activeDoctor) {
      loadMonthlyQueue(activeDoctor.doctorId, scheduleDate);
      const shifts = getDoctorAvailability(activeDoctor, scheduleDate);
      setAvailableShifts(shifts);
      
      if (shifts.length > 0 && !shifts.find(s => s.shiftName === selectedShift)) {
          setSelectedShift(shifts[0].shiftName);
          form.setFieldsValue({ shiftName: shifts[0].shiftName });
      } else if (shifts.length === 0) {
          setSelectedShift(null);
          form.setFieldsValue({ shiftName: null });
      }

      const price = isFollowUp ? (activeDoctor.fees?.followUpConsultation || 0) : (activeDoctor.fees?.newConsultation || 0);
      setTotalAmount(price);
    } else {
        setMonthlyBookings([]);
        setAvailableShifts([]);
        setSelectedShift(null);
        setTotalAmount(0);
    }
  }, [activeDoctor, scheduleDate, isFollowUp]);

  const loadMonthlyQueue = async (docId, dateObj) => {
      setFetchingCalendar(true);
      const data = await fetchDoctorMonthlyBookings(docId, dateObj.year(), dateObj.month() + 1);
      setMonthlyBookings(data || []);
      setFetchingCalendar(false);
  };

  // --- DISABLED DATES LOGIC ---
  const disabledDate = (current) => {
    if (current && current < dayjs().startOf('day')) return true;
    if (activeDoctor) {
        const shifts = getDoctorAvailability(activeDoctor, current);
        if (shifts.length === 0) return true;
    }
    return false;
  };

  const handleCalendarSelect = (date, info) => {
      if (disabledDate(date)) {
          if (info.source === 'date') message.warning("Doctor is not available on this date.");
          return;
      }
      setScheduleDate(date);
  };

  // --- BILLING CALCULATION ---
  useEffect(() => {
    const discount = form.getFieldValue("discountAmount") || 0;
    const paid = form.getFieldValue("paidAmount") || 0;
    const newNet = Math.max(0, totalAmount - discount);
    setNetAmount(newNet);
    setDueAmount(Math.max(0, newNet - paid));
  }, [totalAmount, form, Form.useWatch("discountAmount", form), Form.useWatch("paidAmount", form)]);

  // --- HANDLERS ---
  const handlePatientSearch = (val) => {
    setSearchTerm(val);
    if (val.length >= 2) searchPatients(dispatch, val);
  };

  const handleSelectRegistered = (val) => {
    setPatientId(val);
    setSearchTerm("");
    const selected = searchResults?.find((p) => p._id === val);
    if (selected) {
      setSelectedPatientOriginal(selected);
      setPatientForm({ name: `${selected.firstName} ${selected.lastName}`, age: selected.age, gender: selected.gender });
    }
  };

  const handleClearSelection = () => {
    setPatientId(null);
    dispatch(patientSearchSuccess(null));
    setSelectedPatientOriginal(null);
    setSearchTerm("");
    setPatientForm({ name: "", age: "", gender: "Male" });
    patientSearchRef.current?.focus();
  };

  const handleNewPatientCreated = (newPatient) => {
    setIsPatientModalOpen(false);
    setPatientId(newPatient._id);
    setSelectedPatientOriginal(newPatient);
    setPatientForm({ name: `${newPatient.firstName} ${newPatient.lastName}`, age: newPatient.age, gender: newPatient.gender });
    message.success(`Selected ${newPatient.firstName}`);
    searchPatients(dispatch, newPatient.mobile);
    form.setFieldsValue({ patientId: newPatient._id });
  };

  const resetForm = () => {
    form.resetFields();
    setSelectedDoctorId(null);
    setIsFollowUp(false);
    handleClearSelection();
    setScheduleDate(dayjs());
  };

  const onFinish = async (values) => {
    if (!patientId && !patientForm.name) return message.error("Patient details missing");
    if (!selectedDoctorId) return message.error("Please select a doctor");
    if (!selectedShift) return message.error("Doctor is unavailable on this date. Please select a valid shift.");

    const dataToSubmit = pendingSubmission ? { ...pendingSubmission, discountOverrideCode: values.overrideCode } : values;
    setLoading(true);

    const { discountAmount = 0, discountReason, paidAmount = 0, paymentMode, transactionId, notes, discountOverrideCode } = dataToSubmit;

    const orderData = {
      items: [{ _id: activeDoctor._id, type: 'Consultation', shiftName: selectedShift, isFollowUp: isFollowUp }],
      appointment: { doctorId: activeDoctor._id, date: scheduleDate.format("YYYY-MM-DD"), shiftName: selectedShift, isFollowUp: isFollowUp },
      discountAmount: discountAmount || 0,
      discountReason, paymentMode, discountOverrideCode,
      notes: notes || "",
      scheduleDate: scheduleDate.format("YYYY-MM-DD"),
    };

    if (patientId) {
      orderData.patientId = patientId;
      orderData.walkin = false;
      if (selectedPatientOriginal) {
        if (String(patientForm.age) !== String(selectedPatientOriginal.age) || patientForm.gender !== selectedPatientOriginal.gender) {
          orderData.updatedPatientData = true; orderData.age = patientForm.age; orderData.gender = patientForm.gender;
        }
      }
    } else {
      orderData.walkin = true; orderData.patientName = patientForm.name; orderData.age = patientForm.age; orderData.gender = patientForm.gender;
    }

    if (paymentMode !== "Razorpay" && paidAmount > 0) {
      orderData.initialPayment = { mode: paymentMode, amount: paidAmount, transactionId, notes: "Advance Payment" };
    }

    const res = await createOrder(dispatch, orderData);
    setLoading(false);

    if (res.status === 201) {
      message.success("Appointment Booked Successfully!");
      setIsOverrideModalOpen(false);
      setPendingSubmission(null);
      resetForm();

      if (paymentMode === "Razorpay" && paidAmount > 0) {
        setCreatedOrder({ ...res.data, dueAmountForModal: paidAmount });
        setIsPaymentModalOpen(true);
      }
      if (activeDoctor) loadMonthlyQueue(activeDoctor.doctorId, scheduleDate);
    } else if (res.requiresOverride) {
      setPendingSubmission(values);
      setIsOverrideModalOpen(true);
    } else {
      message.error(res.message || "Booking Failed");
    }
  };

  const dateCellRender = (value) => {
      const dateStr = value.format("YYYY-MM-DD");
      const dayBookings = monthlyBookings.filter(b => b.date === dateStr);
      if (dayBookings.length === 0) return null;
      return (
          <div style={{ textAlign: 'center', marginTop: 0 }}>
              <Badge count={dayBookings.length} style={{ backgroundColor: '#52c41a', transform: 'scale(0.8)' }} />
          </div>
      );
  };

  const dayBookings = useMemo(() => {
      return monthlyBookings.filter(b => b.date === scheduleDate.format("YYYY-MM-DD"));
  }, [monthlyBookings, scheduleDate]);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", background: "#f0f2f5", overflow: "hidden" }}>
      
      {/* --- LEFT PANEL: Booking Form (65vw) --- */}
      <div style={{ width: "65vw", display: "flex", flexDirection: "column", background: "#fff", borderRight: "1px solid #d9d9d9" }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ paymentMode: "Cash", discountAmount: 0, paidAmount: 0 }}
          style={{  display: "flex", flexDirection: "column" }}
        >
          <BookingPatientSelect 
            patientSearchRef={patientSearchRef} walkinNameRef={walkinNameRef}
            searchResults={searchResults} patientId={patientId} selectedPatientOriginal={selectedPatientOriginal}
            patientForm={patientForm} setPatientForm={setPatientForm}
            handlePatientSearch={handlePatientSearch} handleSelectRegistered={handleSelectRegistered}
            handleClearSelection={handleClearSelection} setIsPatientModalOpen={setIsPatientModalOpen}
            resetForm={resetForm}
          />
          
          <BookingDoctorSelect 
            activeDoctors={activeDoctors} selectedDoctorId={selectedDoctorId} setSelectedDoctorId={setSelectedDoctorId}
            activeDoctor={activeDoctor} activeDoctorCabin={activeDoctorCabin} scheduleDate={scheduleDate}
            availableShifts={availableShifts} selectedShift={selectedShift} setSelectedShift={setSelectedShift}
            isFollowUp={isFollowUp} setIsFollowUp={setIsFollowUp} totalAmount={totalAmount}
          />

          <BookingBillingFooter 
            form={form} totalAmount={totalAmount} netAmount={netAmount} dueAmount={dueAmount} paidAmount={paidAmount}
            loading={loading} selectedDoctorId={selectedDoctorId} availableShifts={availableShifts}
          />
        </Form>
      </div>

      {/* --- RIGHT PANEL: Mini-Calendar & Bookings (35vw) --- */}
      <div style={{ width: "35vw", display: "flex", flexDirection: "column", background: "#fff" }}>
        <BookingCalendar 
          selectedDoctorId={selectedDoctorId} scheduleDate={scheduleDate} setScheduleDate={setScheduleDate}
          handleCalendarSelect={handleCalendarSelect} dateCellRender={dateCellRender} disabledDate={disabledDate}
          monthlyBookings={monthlyBookings}
        />
        <BookingPatientList 
          selectedDoctorId={selectedDoctorId} dayBookings={dayBookings} setDetailOrderId={setDetailOrderId}
        />
      </div>

      {/* --- MODALS --- */}
      <CreatePatientModal open={isPatientModalOpen} onCancel={() => setIsPatientModalOpen(false)} onSuccess={handleNewPatientCreated} initialSearchTerm={searchTerm} />
      <DiscountOverrideModal open={isOverrideModalOpen} onCancel={() => { setIsOverrideModalOpen(false); setPendingSubmission(null); setLoading(false); }} onSubmit={(code) => onFinish({ ...pendingSubmission, overrideCode: code }) } />
      {createdOrder && (
        <PaymentModal open={isPaymentModalOpen} onCancel={() => { setIsPaymentModalOpen(false); resetForm(); }} order={createdOrder} initialAmount={createdOrder.dueAmountForModal} onSuccess={() => { setIsPaymentModalOpen(false); resetForm(); }} />
      )}
      <OrderDetailsDrawer open={!!detailOrderId} orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />
    </div>
  );
};

export default DoctorAppointmentBooking;