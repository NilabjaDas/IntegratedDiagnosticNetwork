import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Form,
  Button,
  Select,
  Input,
  Avatar,
  InputNumber,
  List,
  Typography,
  message,
  Card,
  Row,
  Col,
  Divider,
  Checkbox,
  Tag,
  Tooltip,
  Modal,
  Space,
  DatePicker,
} from "antd";
import {
  UserAddOutlined,
  DeleteOutlined,
  SearchOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  ThunderboltFilled,
  HomeOutlined,
  WarningOutlined,
  ClearOutlined,
  LaptopOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import {
  createOrder,
  searchPatients,
  getOrders,
  getMyTests,
  getDoctors 
} from "../../redux/apiCalls";
import CreatePatientModal from "./CreatePatientModal";
import PaymentModal from "./PaymentModal";
import DiscountOverrideModal from "./DiscountOverrideModal";
import OrderDetailsDrawer from "./OrderDetailsDrawer"; 
import { patientSearchSuccess } from "../../redux/orderRedux";
import moment from "moment";
import dayjs from "dayjs";

const { Option } = Select;
const { Title, Text } = Typography;

const getDeptColor = (dept) => {
  const colors = [
    "blue",
    "cyan",
    "geekblue",
    "purple",
    "magenta",
    "green",
    "volcano",
    "orange",
  ];
  let hash = 0;
  if (!dept) return "default";
  for (let i = 0; i < dept.length; i++) {
    hash = dept.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const RapidOrderLayout = ({ onClose, onSwitchToNormal }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  // Refs
  const patientSearchRef = useRef(null);
  const walkinNameRef = useRef(null);
  const serviceSearchRef = useRef(null);

  // --- REDUX ---
  const { tests, packages } = useSelector(
    (state) => state[process.env.REACT_APP_TESTS_DATA_KEY] || state.test,
  );
  const { searchResults, orders } = useSelector(
    (state) => state[process.env.REACT_APP_ORDERS_DATA_KEY] || state.order,
  );
  const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);

  // --- STATE ---
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isHomeCollection, setIsHomeCollection] = useState(false);

  // Right Panel State
  const [orderSearchText, setOrderSearchText] = useState("");
  const [detailOrderId, setDetailOrderId] = useState(null); 

  // Patient
  const [patientId, setPatientId] = useState(null);
  const [selectedPatientOriginal, setSelectedPatientOriginal] = useState(null);
  const [patientForm, setPatientForm] = useState({
    name: "",
    age: "",
    gender: "Male",
  });

  // Billing
  const [totalAmount, setTotalAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [dueAmount, setDueAmount] = useState(0);
  const paidAmount = Form.useWatch("paidAmount", form) || 0;

  // Modals
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(
    moment().format("YYYY-MM-DD"),
  );

  useEffect(() => {
    getMyTests(dispatch, scheduleDate);
  }, [scheduleDate, dispatch]);

  const disabledDate = (current) => {
    return current && current < dayjs().startOf("day");
  };

// --- UPDATED: SMART DOCTOR AVAILABILITY HELPER ---
const getDoctorAvailability = (doctor, dateInput) => {
    if (!doctor) return [];
    
    // FIX: Safely convert the incoming string into a dayjs object first
    const targetDate = dayjs(dateInput); 
    
    const dateStr = targetDate.format("YYYY-MM-DD");
    const dayIndex = targetDate.day();
    const weekOfMonth = Math.ceil(targetDate.date() / 7);

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

  const onScheduleDateChange = (date) => {
    const newDateStr = date ? date.format("YYYY-MM-DD") : null;
    setScheduleDate(newDateStr);

    // --- RE-EVALUATE CART FOR CANCELLED DOCTORS ON NEW DATE ---
    if (newDateStr && selectedItems.length > 0) {
        let hasChanges = false;
        let droppedDocs = [];

        const updatedItems = selectedItems.map(item => {
            if (item.type !== 'Consultation') return item;
            const doc = doctors.find(d => d._id === item._id);
            if (!doc) return item;

            const availableShifts = getDoctorAvailability(doc, newDateStr);
            if (availableShifts.length === 0) {
                hasChanges = true;
                droppedDocs.push(doc.personalInfo.lastName);
                return null; // Drop from cart
            }

            let newShiftName = item.shiftName;
            if (!availableShifts.find(s => s.shiftName === item.shiftName)) {
                newShiftName = availableShifts[0].shiftName;
                hasChanges = true;
            }

            if (availableShifts.length !== item.availableShifts?.length || newShiftName !== item.shiftName) {
                hasChanges = true;
                return { ...item, availableShifts, shiftName: newShiftName };
            }
            return item;
        }).filter(Boolean);

        if (hasChanges) {
            setSelectedItems(updatedItems);
            form.setFieldsValue({ serviceSelect: updatedItems.map(i => i._id) });
            if (droppedDocs.length > 0) {
                message.warning(`Removed doctor(s) from cart due to unavailability on selected date: Dr. ${droppedDocs.join(', ')}`);
            }
        }
    }
  };

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    getOrders(dispatch);
    getDoctors(dispatch); 
    
    setTimeout(() => {
      if (patientSearchRef.current) {
        patientSearchRef.current.focus();
      }
    }, 100);
  }, [dispatch]);

  // --- SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        form.submit();
      }
      if (e.key === "F1") {
        e.preventDefault();
        patientSearchRef.current?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        if (walkinNameRef.current) {
          walkinNameRef.current.focus();
        } else if (patientId) {
          message.warning("Clear selected patient to enter Walk-in details");
        }
      }
      if (e.key === "F3") {
        e.preventDefault();
        serviceSearchRef.current?.focus();
      }
      if (e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const currentNet = form.getFieldValue("paidAmount") === netAmount ? 0 : netAmount;
        form.setFieldsValue({ paidAmount: currentNet });
      }
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        resetForm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, form, netAmount, patientId]);

  const displayedOrders = useMemo(() => {
    if (!orders) return [];
    const today = dayjs();
    return orders.filter((order) => {
      const orderDate = dayjs(order.createdAt);
      const searchLower = orderSearchText.toLowerCase();
      const matchesSearch =
        (order.patientDetails?.name || "").toLowerCase().includes(searchLower) ||
        (order.patient?.firstName || "").toLowerCase().includes(searchLower) ||
        (order.displayId || "").toLowerCase().includes(searchLower) ||
        (order.patientDetails?.mobile || "").includes(searchLower);

      if (!orderSearchText) return orderDate.isSame(today, "day");
      return matchesSearch;
    });
  }, [orders, orderSearchText]);

  const testsByDepartment = useMemo(() => {
    const groups = {};
    tests.forEach((t) => {
      if (!t.isActive) return;
      const dept = t.department || "Other";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(t);
    });
    return groups;
  }, [tests]);

  const activePackages = useMemo(() => packages.filter((p) => p.isActive), [packages]);
  const activeDoctors = useMemo(() => doctors.filter(d => d.isActive), [doctors]);

  const filterServices = (input, option) => {
    const search = input.toLowerCase();
    const name = String(option.name || "").toLowerCase();
    const alias = String(option.alias || "").toLowerCase();
    return name.includes(search) || alias.includes(search);
  };

  const groupedItems = useMemo(() => {
    const groups = {};
    selectedItems.forEach((item) => {
      const dept = item.department || "General / Other";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(item);
    });
    return Object.keys(groups)
      .sort()
      .map((dept) => ({
        dept,
        items: groups[dept],
        color: getDeptColor(dept),
      }));
  }, [selectedItems]);

  useEffect(() => {
    const sum = selectedItems.reduce((acc, item) => acc + (item.price || 0), 0);
    const discount = form.getFieldValue("discountAmount") || 0;
    const paid = form.getFieldValue("paidAmount") || 0;

    setTotalAmount(sum);
    const newNet = Math.max(0, sum - discount);
    setNetAmount(newNet);
    setDueAmount(Math.max(0, newNet - paid));
  }, [
    selectedItems,
    form,
    Form.useWatch("discountAmount", form),
    Form.useWatch("paidAmount", form),
  ]);

  const handleHomeCollectionChange = (e) => {
    const checked = e.target.checked;
    if (checked) {
      const invalidTests = selectedItems.filter((t) => t.homeCollectionAvailable === false);
      if (invalidTests.length > 0) {
        Modal.confirm({
          title: <><WarningOutlined style={{ color: "orange" }} /> Home Collection Warning</>,
          content: (
            <div>
              <p>These tests are marked <b>Not Available</b> for Home Collection:</p>
              <ul>{invalidTests.map((t) => <li key={t._id}>{t.name}</li>)}</ul>
              <p>Continue anyway?</p>
            </div>
          ),
          onOk: () => {
            setIsHomeCollection(true);
            form.setFieldsValue({ isHomeCollection: true });
          },
        });
        return;
      }
    }
    setIsHomeCollection(checked);
  };

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
      setPatientForm({
        name: `${selected.firstName} ${selected.lastName}`,
        age: selected.age,
        gender: selected.gender,
      });
      serviceSearchRef.current?.focus();
    }
  };

  const handleNewPatientCreated = (newPatient) => {
    setIsPatientModalOpen(false);
    setPatientId(newPatient._id);
    setSelectedPatientOriginal(newPatient);
    setPatientForm({
      name: `${newPatient.firstName} ${newPatient.lastName}`,
      age: newPatient.age,
      gender: newPatient.gender,
    });
    message.success(`Selected ${newPatient.firstName}`);
    searchPatients(dispatch, newPatient.mobile);
    form.setFieldsValue({ patientId: newPatient._id });
    if (serviceSearchRef.current) serviceSearchRef.current.focus();
  };

  const handleClearSelection = () => {
    setPatientId(null);
    dispatch(patientSearchSuccess(null));
    setSelectedPatientOriginal(null);
    setSearchTerm("");
    setPatientForm({ name: "", age: "", gender: "Male" });
    patientSearchRef.current?.focus();
  };

  const handleServicesChange = (values) => {
    const newItems = [];
    const dateStr = scheduleDate ? dayjs(scheduleDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");

    values.forEach((val) => {
      const testMatch = tests.find((t) => t._id === val);
      if (testMatch) {
        newItems.push({ ...testMatch, type: "Test" });
      } else {
        const pkgMatch = packages.find((p) => p._id === val);
        if (pkgMatch) {
          newItems.push({ ...pkgMatch, price: pkgMatch.offerPrice, type: "Package" });
        } else {
          // --- DOCTOR SELECTED ---
          const docMatch = doctors.find(d => d._id === val || d.doctorId === val);
          if (docMatch) {
            const availableShifts = getDoctorAvailability(docMatch, dateStr);
            
            if (availableShifts.length > 0) {
                const defaultShift = availableShifts[0].shiftName;
                newItems.push({
                    _id: docMatch._id,
                    name: `Consultation: Dr. ${docMatch.personalInfo?.firstName} ${docMatch.personalInfo?.lastName}`,
                    price: docMatch.fees?.newConsultation || 0,
                    type: 'Consultation',
                    department: 'Consultation',
                    homeCollectionAvailable: false,
                    shiftName: defaultShift,
                    availableShifts: availableShifts,
                    isFollowUp: false
                });
            }
          }
        }
      }
    });
    setSelectedItems(newItems);
  };

  const resetForm = () => {
    form.resetFields();
    setSelectedItems([]);
    setPatientId(null);
    setSelectedPatientOriginal(null);
    setPatientForm({ name: "", age: "", gender: "Male" });
    setIsHomeCollection(false);
    patientSearchRef.current?.focus();
    message.info("Form Reset");
  };

  const onFinish = async (values) => {
    const dataToSubmit = pendingSubmission
      ? { ...pendingSubmission, discountOverrideCode: values.overrideCode }
      : values;

    if (!pendingSubmission) {
      if (!patientId && !patientForm.name) return message.error("Patient details missing");
      if (selectedItems.length === 0) return message.error("No services selected");
    }

    setLoading(true);

    const { discountAmount = 0, discountReason, paidAmount = 0, paymentMode, transactionId, notes, discountOverrideCode } = dataToSubmit;

    // --- NEW: INJECT APPOINTMENT PAYLOAD ---
    const consultationItem = selectedItems.find(i => i.type === 'Consultation');
    const appointmentData = consultationItem ? {
        doctorId: consultationItem._id,
        date: scheduleDate,
        shiftName: consultationItem.shiftName,
        isFollowUp: consultationItem.isFollowUp || false
    } : null;

    const orderData = {
      items: selectedItems.map((i) => ({ _id: i._id, type: i.type, shiftName: i.shiftName, isFollowUp: i.isFollowUp })),
      appointment: appointmentData,
      discountAmount: discountAmount || 0,
      discountReason: discountReason,
      paymentMode: paymentMode,
      discountOverrideCode: discountOverrideCode,
      notes: notes || "",
      isHomeCollection: isHomeCollection,
      scheduleDate: scheduleDate,
    };

    if (patientId) {
      orderData.patientId = patientId;
      orderData.walkin = false;
      if (selectedPatientOriginal) {
        const hasChanged = String(patientForm.age) !== String(selectedPatientOriginal.age) || patientForm.gender !== selectedPatientOriginal.gender;
        if (hasChanged) {
          orderData.updatedPatientData = true;
          orderData.age = patientForm.age;
          orderData.gender = patientForm.gender;
        }
      }
    } else {
      orderData.walkin = true;
      orderData.patientName = patientForm.name;
      orderData.age = patientForm.age;
      orderData.gender = patientForm.gender;
    }

    if (paymentMode !== "Razorpay" && paidAmount > 0) {
      orderData.initialPayment = {
        mode: paymentMode,
        amount: paidAmount,
        transactionId: transactionId,
        notes: "Advance Payment",
      };
    }

    const res = await createOrder(dispatch, orderData);
    setLoading(false);

    if (res.status === 201) {
      message.success("Order Created!");
      setIsOverrideModalOpen(false);
      setPendingSubmission(null);
      resetForm();

      if (paymentMode === "Razorpay" && paidAmount > 0) {
        setCreatedOrder({
          ...res.data,
          dueAmountForModal: paidAmount,
        });
        setIsPaymentModalOpen(true);
      }
      getOrders(dispatch);
    } else if (res.requiresOverride) {
      setPendingSubmission(values);
      setIsOverrideModalOpen(true);
    } else {
      message.error(res.message || "Failed");
    }
  };

  const handleOrderSearch = (value) => {
    if (value.length > 2) {
      getOrders(dispatch, { search: value });
    }
  };

  return (
    <div style={{ display: "flex", height: "100%", background: "#f0f2f5", overflow: "hidden" }}>
      {/* --- LEFT PANEL: 70vw --- */}
      <div style={{ width: "70vw", display: "flex", flexDirection: "column", background: "#fff", borderRight: "1px solid #d9d9d9" }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ paymentMode: "Cash", discountAmount: 0, paidAmount: 0 }}
          style={{ height: "100%", display: "flex", flexDirection: "column" }}
        >
          {/* 1. TOP HEADER: Shortcuts & Reset */}
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #f0f0f0", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Space size={4}>
                <Tag color="blue"><LaptopOutlined /> RAPID MODE</Tag>
                <Tag><b>F1</b> Patient</Tag>
                <Tag><b>F2</b> Walk-in</Tag>
                <Tag><b>F3</b> Tests</Tag>
                <Tag><b>Alt+F</b> Full Pay</Tag>
                <Tag><b>Ctrl+Enter</b> Submit</Tag>
              </Space>
              <Tooltip title="Reset Form (Alt + R)">
                <Button size="small" type="dashed" danger icon={<ClearOutlined />} onClick={resetForm}>Reset</Button>
              </Tooltip>
            </div>

            <Row gutter={12} align="middle">
              <Col span={10}>
                <Input.Group compact>
                  <Select
                    ref={patientSearchRef}
                    showSearch
                    style={{ width: "calc(100% - 32px)" }}
                    placeholder="Search Patient (F1)"
                    filterOption={false}
                    onSearch={handlePatientSearch}
                    onChange={handleSelectRegistered}
                    value={patientId}
                    suffixIcon={<SearchOutlined />}
                    allowClear
                    onClear={handleClearSelection}
                    size="middle"
                  >
                    {searchResults?.map((p) => (
                      <Option key={p._id} value={p._id}>
                        {p.firstName} {p.lastName} ({p.mobile})
                      </Option>
                    ))}
                  </Select>
                  <Button icon={<UserAddOutlined />} onClick={() => setIsPatientModalOpen(true)} />
                </Input.Group>
              </Col>

              <Col span={14}>
                {!patientId ? (
                  <Row gutter={8}>
                    <Col span={10}>
                      <Input
                        ref={walkinNameRef}
                        placeholder="Walk-in Name (F2)"
                        value={patientForm.name}
                        onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
                      />
                    </Col>
                    <Col span={6}>
                      <InputNumber
                        placeholder="Age"
                        min={1}
                        style={{ width: "100%" }}
                        value={patientForm.age}
                        onChange={(v) => setPatientForm({ ...patientForm, age: v })}
                      />
                    </Col>
                    <Col span={8}>
                      <Select
                        value={patientForm.gender}
                        onChange={(v) => setPatientForm({ ...patientForm, gender: v })}
                        style={{ width: "100%" }}
                      >
                        <Option value="Male">Male</Option>
                        <Option value="Female">Female</Option>
                      </Select>
                    </Col>
                  </Row>
                ) : (
                  <div style={{ display: "flex", gap: 12, alignItems: "center", height: 32 }}>
                    <Tag color="blue" style={{ fontSize: 14 }}>{selectedPatientOriginal?.uhid}</Tag>
                    <Text strong>{patientForm.name}</Text>
                    <Text type="secondary">{selectedPatientOriginal?.mobile}</Text>
                    <Divider type="vertical" />
                    <InputNumber size="small" min={1} value={patientForm.age} onChange={(v) => setPatientForm({ ...patientForm, age: v })} style={{ width: 60 }} />
                    <Select size="small" value={patientForm.gender} onChange={(v) => setPatientForm({ ...patientForm, gender: v })} style={{ width: 80 }}>
                      <Option value="Male">M</Option>
                      <Option value="Female">F</Option>
                    </Select>
                    <Button type="text" danger icon={<CloseCircleOutlined />} onClick={handleClearSelection} size="small" />
                  </div>
                )}
              </Col>
            </Row>
          </div>

          {/* 2. MIDDLE: Test List */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "8px 16px", background: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                Add Tests, Packages, or Doctor Consultations
              </Text>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <Form.Item name="serviceSelect" noStyle>
                    <Select
                      ref={serviceSearchRef} 
                      mode="multiple"
                      showSearch
                      style={{ width: "100%" }}
                      placeholder="Search Test, Package, or Doctor..."
                      filterOption={filterServices}
                      onChange={handleServicesChange}
                      value={selectedItems.map((i) => i._id)}
                      tagRender={() => null}
                      autoClearSearchValue={true}
                      listHeight={300}
                    >
                      {/* DOCTORS GROUP WITH SMART DISABLING */}
                      {activeDoctors.length > 0 && (
                          <Select.OptGroup label="Doctors / Consultations">
                              {activeDoctors.map((d) => {
                                  const availShifts = getDoctorAvailability(d, scheduleDate || dayjs().format("YYYY-MM-DD"));
                                  const isDisabled = availShifts.length === 0;

                                  return (
                                      <Option 
                                          key={d._id} 
                                          value={d._id} 
                                          name={`Dr. ${d.personalInfo?.firstName} ${d.personalInfo?.lastName}`}
                                          alias={d.professionalInfo?.specialization}
                                          disabled={isDisabled}
                                      >
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                              <span style={isDisabled ? { color: '#ccc', textDecoration: 'line-through' } : {}}>
                                                  Dr. {d.personalInfo?.firstName} {d.personalInfo?.lastName} 
                                                  <span style={{fontSize: '0.85em', color: isDisabled ? '#ccc' : '#888'}}> ({d.professionalInfo?.specialization})</span>
                                              </span>
                                              <span style={{ fontWeight: 500, color: isDisabled ? '#ccc' : 'inherit' }}>
                                                  {isDisabled ? "Unavailable" : `₹${d.fees?.newConsultation}`}
                                              </span>
                                          </div>
                                      </Option>
                                  );
                              })}
                          </Select.OptGroup>
                      )}

                      {/* PACKAGES GROUP */}
                      {activePackages.length > 0 && (
                        <Select.OptGroup label="Packages">
                          {activePackages.map((p) => (
                            <Option key={p._id} value={p._id} name={p.name} alias={p.alias}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>{p.name} {p.alias && p.alias !== "nil" ? `(${p.alias})` : ""}</span>
                                <span style={{ fontWeight: 500 }}>₹{p.offerPrice}</span>
                              </div>
                            </Option>
                          ))}
                        </Select.OptGroup>
                      )}

                      {/* TESTS GROUPED BY DEPARTMENT */}
                      {Object.keys(testsByDepartment).sort().map((dept) => (
                        <Select.OptGroup key={dept} label={dept}>
                          {testsByDepartment[dept].map((t) => {
                            const showLimit = t.remainingSlots !== null;
                            const limitText = showLimit ? ` [${t.scheduledCount}/${t.dailyLimit}]` : "";
                            const isFull = t.isFullyBooked;
                            const aliasText = t.alias && t.alias !== "nil" ? `${t.alias}` : "";
                            return (
                              <Option key={t._id} value={t._id} name={t.name} alias={t.alias} disabled={isFull} style={isFull ? { opacity: 0.5, fontStyle: "italic" } : {}}>
                                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                                  <span style={{ flex: 1, whiteSpace: "normal" }}>
                                    {t.name}{" "}
                                    {aliasText && (
                                      <span style={{ color: "#ffffff", fontSize: "0.85em", fontStyle: "italic", padding: "0px 3px 0px 3px", backgroundColor: "#a46500", borderRadius: "2px" }}>
                                        {String(aliasText).toUpperCase()}
                                      </span>
                                    )}
                                    {showLimit && <span style={{ color: isFull ? "red" : "#1890ff", fontSize: "0.85em", marginLeft: 6 }}>{limitText}</span>}
                                  </span>
                                  <span style={{ fontWeight: 500, marginLeft: 8 }}>₹{t.price}</span>
                                </div>
                              </Option>
                            );
                          })}
                        </Select.OptGroup>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
                <DatePicker
                  value={scheduleDate ? dayjs(scheduleDate, "YYYY-MM-DD") : null}
                  onChange={onScheduleDateChange}
                  format="ddd, Do MMMM YYYY"
                  disabledDate={disabledDate}
                  allowClear={false}
                  style={{ width: "220px" }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px 16px" }}>
              {selectedItems.length === 0 ? (
                <div style={{ height: "100%", display: "flex", justifyContent: "center", alignItems: "center", color: "#ccc" }}>
                  <Text type="secondary">No services selected</Text>
                </div>
              ) : (
                groupedItems.map((group) => (
                  <div key={group.dept} style={{ marginTop: 16 }}>
                    <Divider orientation="left" style={{ margin: "0 0 8px 0", fontSize: 12 }}>
                      <Tag color={group.color}>{group.dept}</Tag>
                    </Divider>
                    <List
                      size="small"
                      dataSource={group.items}
                      renderItem={(item) => (
                        <List.Item
                          style={{ padding: "4px 8px", background: "#fff", marginBottom: 4, borderRadius: 4, border: "1px solid #f0f0f0" }}
                          actions={[
                            <DeleteOutlined
                              onClick={() => {
                                const newItems = selectedItems.filter((i) => i._id !== item._id);
                                setSelectedItems(newItems);
                                form.setFieldsValue({ serviceSelect: newItems.map((i) => i._id) });
                              }}
                              style={{ color: "red", cursor: "pointer" }}
                            />,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={
                              <Avatar
                                size="small"
                                icon={item.type === 'Consultation' ? <UserOutlined /> : <MedicineBoxOutlined />}
                                style={{
                                  backgroundColor: item.type === "Package" ? "#87d068" : item.type === "Consultation" ? "#722ed1" : "#1890ff",
                                }}
                              />
                            }
                          />
                          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                            <div style={{ flex: 1 }}>
                              <Text style={{ fontWeight: 'bold', fontSize: 13 }}>{item.name}</Text>
                              {item.type === "Package" && <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>PKG</Tag>}
                              
                              {/* NEW: Shift Selector & Follow-up for Doctors */}
                              {item.type === "Consultation" && item.availableShifts?.length > 0 && (
                                  <div style={{ marginTop: 4, display: 'flex', gap: 12, alignItems: 'center' }}>
                                      <Select 
                                          size="small"
                                          value={item.shiftName} 
                                          onChange={(val) => {
                                              const updated = selectedItems.map(i => i._id === item._id ? { ...i, shiftName: val } : i);
                                              setSelectedItems(updated);
                                          }}
                                          style={{ width: 160, fontSize: 11 }}
                                      >
                                          {item.availableShifts?.map(s => (
                                              <Option key={s.shiftName} value={s.shiftName}>{s.shiftName} ({moment(s.startTime,"hh:mm").format("h:mma")}-{moment(s.endTime,"hh:mm").format("h:mma")})</Option>
                                          ))}
                                      </Select>
                                      <Checkbox 
                                          checked={item.isFollowUp}
                                          onChange={(e) => {
                                              const isFup = e.target.checked;
                                              const docData = doctors.find(d => d._id === item._id);
                                              const newPrice = isFup ? (docData?.fees?.followUpConsultation || 0) : (docData?.fees?.newConsultation || 0);
                                              const updated = selectedItems.map(i => i._id === item._id ? { ...i, isFollowUp: isFup, price: newPrice } : i);
                                              setSelectedItems(updated);
                                          }}
                                          style={{ fontSize: 12 }}
                                      >
                                          Follow-up
                                      </Checkbox>
                                  </div>
                              )}
                            </div>
                            <div style={{ width: 80, textAlign: "right", fontWeight: 500 }}>
                                ₹{item.price}
                            </div>
                          </div>
                        </List.Item>
                      )}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. BOTTOM: Billing Footer */}
          <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #d9d9d9", boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
            <Row gutter={16} align="middle">
              <Col span={6}>
                <Checkbox checked={isHomeCollection} onChange={handleHomeCollectionChange}>
                  <HomeOutlined /> Home Collection
                </Checkbox>
                <Form.Item name="notes" noStyle>
                  <Input placeholder="Internal Notes..." style={{ marginTop: 8 }} size="small" />
                </Form.Item>
              </Col>

              <Col span={12} style={{ padding: "0 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f9fafc", border: "1px solid #e8e8e8", borderRadius: 8, padding: "10px 16px", height: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <Text type="secondary" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>Total Bill</Text>
                    <Text strong style={{ fontSize: 18, color: "#262626", lineHeight: 1.2 }}>₹{totalAmount}</Text>
                  </div>

                  <div style={{ fontSize: 24, color: "#d9d9d9", fontWeight: 300, paddingBottom: 4 }}>−</div>

                  <div style={{ width: 130, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <Text type="secondary" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Discount</Text>
                    </div>
                    <Form.Item name="discountAmount" noStyle>
                      <InputNumber style={{ width: "100%", borderRadius: 4, border: "1px solid #d9d9d9", fontWeight: 500 }} size="small" min={0} max={totalAmount} placeholder="0" controls={false} formatter={(value) => (value ? `₹ ${value}` : "")} parser={(value) => value.replace(/₹\s?|(,*)/g, "")} />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate={(prev, curr) => prev.discountAmount !== curr.discountAmount}>
                      {({ getFieldValue }) => getFieldValue("discountAmount") > 0 && (
                        <Form.Item name="discountReason" rules={[{ required: true, message: "Reason required" }]} style={{ marginBottom: 0, marginTop: 4 }}>
                          <Input size="small" placeholder="Why? (e.g. Staff)" style={{ fontSize: 10, background: "#fff1f0", borderColor: "#ffa39e", color: "#cf1322" }} />
                        </Form.Item>
                      )}
                    </Form.Item>
                  </div>

                  <div style={{ fontSize: 24, color: "#d9d9d9", fontWeight: 300, paddingBottom: 4 }}>=</div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", background: "#e6f7ff", padding: "6px 12px", borderRadius: 6, border: "1px solid #bae7ff" }}>
                    <Text style={{ fontSize: 10, fontWeight: 700, color: "#0050b3", textTransform: "uppercase" }}>NET PAYABLE</Text>
                    <Text style={{ fontSize: 22, fontWeight: "bold", color: "#1890ff", lineHeight: 1 }}>₹{netAmount}</Text>
                  </div>
                </div>
              </Col>

              <Col span={6}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <Form.Item name="paidAmount" noStyle>
                    <InputNumber placeholder="Advance" style={{ width: "100%" }} max={netAmount} addonBefore="Paid" />
                  </Form.Item>
                  <Tooltip title="Pay Full (Alt + F)">
                    <Checkbox checked={paidAmount === netAmount && netAmount > 0} onChange={(e) => form.setFieldsValue({ paidAmount: e.target.checked ? netAmount : 0 })}>Full</Checkbox>
                  </Tooltip>
                </div>
                {paidAmount > 0 && (
                  <Form.Item name="paymentMode" noStyle>
                    <Select style={{ width: "100%", marginBottom: 8 }} placeholder="Mode">
                      <Option value="Cash">Cash</Option>
                      <Option value="Razorpay">UPI / QR</Option>
                      <Option value="Card">Card</Option>
                    </Select>
                  </Form.Item>
                )}
                <Tooltip title="Ctrl + Enter">
                  <Button type="primary" htmlType="submit" loading={loading} block icon={<ThunderboltFilled />}>
                    {paidAmount < netAmount ? `Book (Due: ₹${dueAmount})` : "Book & Paid"}
                  </Button>
                </Tooltip>
              </Col>
            </Row>
          </div>
        </Form>
      </div>

      {/* --- RIGHT PANEL: 30vw --- */}
      <div style={{ width: "30vw", background: "#fafafa", display: "flex", flexDirection: "column", borderLeft: "1px solid #eee" }}>
        <div style={{ padding: "10px 16px", background: "#fff", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <Text strong><ClockCircleOutlined /> Orders (Today)</Text>
            <Button type="text" icon={<ReloadOutlined />} size="small" onClick={() => getOrders(dispatch)} />
          </div>
          <Input.Search placeholder="Search Order / Patient..." allowClear onSearch={handleOrderSearch} onChange={(e) => setOrderSearchText(e.target.value)} size="small" />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          <List
            dataSource={displayedOrders}
            locale={{ emptyText: "No orders found for today" }}
            renderItem={(item) => (
              <Card
                size="small"
                style={{ marginBottom: 8, borderRadius: 4, fontSize: 12, cursor: "pointer" }}
                bodyStyle={{ padding: 8 }}
                hoverable
                onClick={() => setDetailOrderId(item._id)}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text strong>{item.patientDetails?.name || item.patient?.firstName || "Walk-in"}</Text>
                  <Tag color={item.financials?.status === "Paid" ? "green" : item.financials?.status === "Cancelled" ? "default" : "orange"}>
                    {item.financials?.status?.toUpperCase()}
                  </Tag>
                </div>
                <div style={{ color: "#888", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>{item.displayId}</span>
                  <span>{dayjs(item.createdAt).format("hh:mm A")}</span>
                </div>
                <Divider style={{ margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{item.items?.length} items</span>
                  <Text strong>₹{item.financials?.netAmount}</Text>
                </div>
              </Card>
            )}
          />
        </div>
      </div>

      {/* --- MODALS --- */}
      <CreatePatientModal open={isPatientModalOpen} onCancel={() => setIsPatientModalOpen(false)} onSuccess={handleNewPatientCreated} initialSearchTerm={searchTerm} />
      <DiscountOverrideModal open={isOverrideModalOpen} onCancel={() => { setIsOverrideModalOpen(false); setPendingSubmission(null); setLoading(false); }} onSubmit={(code) => onFinish({ ...pendingSubmission, overrideCode: code }) } />
      
      {createdOrder && (
        <PaymentModal open={isPaymentModalOpen} onCancel={() => { setIsPaymentModalOpen(false); resetForm(); }} order={createdOrder} initialAmount={createdOrder.dueAmountForModal} onSuccess={() => { setIsPaymentModalOpen(false); resetForm(); }} />
      )}
      
      <OrderDetailsDrawer open={!!detailOrderId} orderId={detailOrderId} onClose={() => { setDetailOrderId(null); getOrders(dispatch); }} />
    </div>
  );
};

export default RapidOrderLayout;