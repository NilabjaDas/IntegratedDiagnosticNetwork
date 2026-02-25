import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Drawer, Form, Button, Select, Input, InputNumber, List, Typography,
  message, Avatar, Card, Row, Col, Empty, Divider, Alert, Checkbox, Modal, Tag, DatePicker
} from "antd";
import { 
  UserAddOutlined, MedicineBoxOutlined, DeleteOutlined, CalculatorOutlined,
  CreditCardOutlined, QrcodeOutlined, DollarCircleOutlined, SearchOutlined,
  CloseCircleOutlined, ThunderboltFilled, HomeOutlined, WarningOutlined,
  ClearOutlined, UserOutlined
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createOrder, searchPatients, getOrders, getMyTests, getDoctors } from "../../redux/apiCalls"; 
import CreatePatientModal from "./CreatePatientModal";
import PaymentModal from "./PaymentModal";
import DiscountOverrideModal from "./DiscountOverrideModal"; 
import { patientSearchSuccess } from "../../redux/orderRedux";
import RapidOrderLayout from "./RapidOrderLayout"; 
import moment from "moment";
import dayjs from 'dayjs';

const { Option } = Select;
const { Title, Text } = Typography;

const getDeptColor = (dept) => {
    const colors = ['blue', 'cyan', 'geekblue', 'purple', 'magenta', 'green', 'volcano', 'orange'];
    let hash = 0;
    if (!dept) return 'default';
    for (let i = 0; i < dept.length; i++) {
        hash = dept.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const CreateOrderDrawer = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const patientSearchRef = useRef(null);
  const [isRapidMode, setIsRapidMode] = useState(false);

  // Redux Data
  const { tests, packages } = useSelector((state) => state[process.env.REACT_APP_TESTS_DATA_KEY] || state.test);
  const { searchResults } = useSelector((state) => state[process.env.REACT_APP_ORDERS_DATA_KEY] || state.order); 
  const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);
  
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isHomeCollection, setIsHomeCollection] = useState(false);
  
  const [patientId, setPatientId] = useState(null);
  const [selectedPatientOriginal, setSelectedPatientOriginal] = useState(null); 
  const [patientForm, setPatientForm] = useState({ name: "", age: "", gender: "Male" });

  const [totalAmount, setTotalAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [dueAmount, setDueAmount] = useState(0);
  
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null); 
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const paidAmount = Form.useWatch("paidAmount", form);
  const [scheduleDate, setScheduleDate] = useState(moment().format("YYYY-MM-DD"));

  useEffect(() => {
    getMyTests(dispatch, scheduleDate);
  }, [scheduleDate, dispatch]);

  useEffect(() => {
    if (open) {
       getDoctors(dispatch);
       if(!isRapidMode) {
         setTimeout(() => patientSearchRef.current?.focus(), 100);
       }
    }
  }, [open, isRapidMode, dispatch]);

  const disabledDate = (current) => current && current < dayjs().startOf('day');

  // --- NEW: SMART DOCTOR AVAILABILITY HELPER ---
  const getDoctorAvailability = (doctor, dateStr) => {
      const dayIndex = dayjs(dateStr).day();
      const daySchedule = doctor.schedule?.find(s => s.dayOfWeek === dayIndex);
      if (!daySchedule || !daySchedule.isAvailable) return [];

      let availableShifts = [...daySchedule.shifts];

      // Block Planned Leaves
      const plannedLeave = doctor.leaves?.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
      if (plannedLeave) {
          if (!plannedLeave.shiftNames || plannedLeave.shiftNames.length === 0) return [];
          availableShifts = availableShifts.filter(s => !plannedLeave.shiftNames.includes(s.shiftName));
      }

      // Block Ad-Hoc Cancellations
      const override = doctor.dailyOverrides?.find(o => o.date === dateStr);
      if (override && override.isCancelled) {
          if (!override.shiftNames || override.shiftNames.length === 0) return [];
          availableShifts = availableShifts.filter(s => !override.shiftNames.includes(s.shiftName));
      }

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

  const groupedItems = useMemo(() => {
      const groups = {};
      selectedItems.forEach(item => {
          const dept = item.department || "General / Other";
          if (!groups[dept]) groups[dept] = [];
          groups[dept].push(item);
      });
      return Object.keys(groups).sort().map(dept => ({
          dept, items: groups[dept], color: getDeptColor(dept)
      }));
  }, [selectedItems]);

  const handleValuesChange = () => {};

  useEffect(() => {
    const sum = selectedItems.reduce((acc, item) => acc + (item.price || 0), 0);
    setTotalAmount(sum);
    const currentDiscount = form.getFieldValue("discountAmount") || 0;
    const currentPaid = form.getFieldValue("paidAmount") || 0;
    const newNet = Math.max(0, sum - currentDiscount);
    setNetAmount(newNet);
    setDueAmount(Math.max(0, newNet - currentPaid));
  }, [selectedItems, form, Form.useWatch("discountAmount", form), Form.useWatch("paidAmount", form)]);

  const handlePatientSearch = (val) => {
    setSearchTerm(val); 
    if (val.length >= 2) searchPatients(dispatch, val);
  };

  const handleSelectRegistered = (val) => {
      setPatientId(val);
      setSearchTerm(""); 
      const selected = searchResults?.find(p => p._id === val);
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
      setTimeout(() => patientSearchRef.current?.focus(), 50);
  };

  const handlePatientFormChange = (field, value) => {
      setPatientForm(prev => ({ ...prev, [field]: value }));
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

  const activePackages = useMemo(() => packages.filter(p => p.isActive), [packages]);
  const activeDoctors = useMemo(() => doctors.filter(d => d.isActive), [doctors]);

  const filterServices = (input, option) => {
      const search = input.toLowerCase();
      const name = String(option.name || "").toLowerCase();
      const alias = String(option.alias || "").toLowerCase();
      return name.includes(search) || alias.includes(search);
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

  const handleRemoveItem = (id) => {
    const newItems = selectedItems.filter(i => i._id !== id);
    setSelectedItems(newItems);
    form.setFieldsValue({ serviceSelect: newItems.map(i => i._id) });
  };

  const handleHomeCollectionChange = (e) => {
      const checked = e.target.checked;
      if (checked) {
          const invalidTests = selectedItems.filter(t => t.homeCollectionAvailable === false);
          if (invalidTests.length > 0) {
              Modal.confirm({
                  title: <><WarningOutlined style={{color: 'orange'}}/> Home Collection Warning</>,
                  content: (
                      <div>
                          <p>The following tests/consultations are marked as <b>Not Available</b> for Home Collection:</p>
                          <ul>{invalidTests.map(t => <li key={t._id}>{t.name}</li>)}</ul>
                          <p>Do you still want to mark this as Home Collection?</p>
                      </div>
                  ),
                  onOk: () => {
                      setIsHomeCollection(true);
                      form.setFieldsValue({ isHomeCollection: true }); 
                  },
                  onCancel: () => {} 
              });
              return;
          }
      }
      setIsHomeCollection(checked);
  };

  const resetForm = () => {
      form.resetFields();
      setSelectedItems([]);
      handleClearSelection();
      setTotalAmount(0);
      setNetAmount(0);
      setDueAmount(0);
      setPendingSubmission(null);
      setSearchTerm("");
      setIsHomeCollection(false);
      form.setFieldsValue({ paymentMode: "Cash", discountAmount: 0, paidAmount: 0 });
  };

  const handleClose = (fullyClose = true) => {
    if (fullyClose) {
        resetForm();
        onClose();
    }
  };

  const onFinish = async (values) => {
    const dataToSubmit = pendingSubmission ? { ...pendingSubmission, discountOverrideCode: values.overrideCode } : values;

    if (!pendingSubmission) {
        if (!patientId && !patientForm.name) return message.error("Please select a Patient OR enter Walk-in Name");
        if (selectedItems.length === 0) return message.error("Please select services");
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
        items: selectedItems.map(i => ({ _id: i._id, type: i.type, shiftName: i.shiftName, isFollowUp: i.isFollowUp })),
        appointment: appointmentData,
        discountAmount, discountReason, paymentMode, discountOverrideCode,
        notes: notes || "", isHomeCollection, scheduleDate
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
        orderData.mobile = ""; 
    }

    if (paymentMode !== "Razorpay" && paidAmount > 0) {
        orderData.initialPayment = { mode: paymentMode, amount: paidAmount, transactionId, notes: notes || "Advance Payment" };
    }

    const res = await createOrder(dispatch, orderData);
    setLoading(false);

    if (res.status === 201) {
        message.success("Order Created Successfully!");
        setIsOverrideModalOpen(false);
        setPendingSubmission(null);
        
        if (paymentMode === "Razorpay" && paidAmount > 0) {
            setCreatedOrder({ ...res.data, dueAmountForModal: paidAmount }); 
            setIsPaymentModalOpen(true);
             handleClose(false); 
        } else {
            handleClose(true);
        }
        getOrders(dispatch); 
    } else if (res.requiresOverride) { 
        setPendingSubmission(values); 
        setIsOverrideModalOpen(true); 
    } else {
        message.error(res.message || "Creation Failed");
    }
  };

  const handleOverrideSubmit = (code) => {
      onFinish({ ...pendingSubmission, overrideCode: code });
  };

  return (
    <>
      <Drawer
        title={isRapidMode ? (
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span><ThunderboltFilled style={{color: '#faad14', marginRight: 8}}/> Rapid Order Mode</span>
                <Button onClick={() => setIsRapidMode(false)} size="small">Switch to Normal</Button>
            </div>
        ) : "Create New Order"}
        width={isRapidMode ? "100%" : 800}
        onClose={() => handleClose(true)}
        open={open}
        keyboard = {isRapidMode ? false :true}
        destroyOnClose
        bodyStyle={isRapidMode ? { padding: 0 } : {}}
        extra={!isRapidMode && (
            <Button type="dashed" danger icon={<ThunderboltFilled />} onClick={() => setIsRapidMode(true)}>
                Rapid Mode
            </Button>
        )}
        footer={!isRapidMode && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button danger type="text" icon={<ClearOutlined />} onClick={resetForm}>Reset Form</Button>
                <div>
                    <Button onClick={() => handleClose(true)} style={{ marginRight: 8 }}>Cancel</Button>
                    <Button type="primary" onClick={form.submit} loading={loading} icon={<CalculatorOutlined />}>Confirm & Book</Button>
                </div>
            </div>
        )}
      >
        {isRapidMode ? (
            <RapidOrderLayout onClose={() => handleClose(true)} onSwitchToNormal={() => setIsRapidMode(false)} />
        ) : (
        <Form layout="vertical" form={form} onFinish={onFinish} onValuesChange={handleValuesChange} initialValues={{ paymentMode: "Cash", discountAmount: 0, paidAmount: 0 }}>
          <Row gutter={24}>
              <Col span={14}>
                  <Card size="small" title="1. Patient Selection" style={{ marginBottom: 16 }}>
                      <Row gutter={8} align="middle">
                          <Col span={20}>
                              <Form.Item name="patientId" noStyle>
                                  <Select
                                      ref={patientSearchRef}
                                      showSearch
                                      placeholder="Search Registered Patient (Name / Mobile)"
                                      filterOption={false}
                                      onSearch={handlePatientSearch}
                                      onChange={handleSelectRegistered}
                                      value={patientId}
                                      searchValue={searchTerm} 
                                      suffixIcon={<SearchOutlined />}
                                      allowClear
                                      autoClearSearchValue={true}
                                      onClear={handleClearSelection}
                                  >
                                      {searchResults?.map(p => (
                                          <Option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.mobile})</Option>
                                      ))}
                                  </Select>
                              </Form.Item>
                          </Col>
                          <Col span={4}>
                              <Button block icon={<UserAddOutlined />} onClick={() => setIsPatientModalOpen(true)} title="Register New Patient" />
                          </Col>
                      </Row>
                      
                      {!patientId ? (
                          <>
                              <Divider style={{ margin: '12px 0', fontSize: 12, color: '#999' }}>OR Walk-In / Guest</Divider>
                              <div style={{ background: '#f6ffed', padding: 12, borderRadius: 6, border: '1px solid #b7eb8f' }}>
                                  <Row gutter={8}>
                                      <Col span={12}>
                                          <Text type="secondary" style={{fontSize: 11}}>Guest Name</Text>
                                          <Input value={patientForm.name} onChange={e => handlePatientFormChange('name', e.target.value)} placeholder="Patient Name" />
                                      </Col>
                                      <Col span={6}>
                                          <Text type="secondary" style={{fontSize: 11}}>Age</Text>
                                          <InputNumber style={{width: '100%'}} placeholder="Yrs" min={1} value={patientForm.age} onChange={v => handlePatientFormChange('age', v)} />
                                      </Col>
                                      <Col span={6}>
                                          <Text type="secondary" style={{fontSize: 11}}>Gender</Text>
                                          <Select value={patientForm.gender} onChange={v => handlePatientFormChange('gender', v)} style={{width: '100%'}}>
                                              <Option value="Male">Male</Option>
                                              <Option value="Female">Female</Option>
                                          </Select>
                                      </Col>
                                  </Row>
                              </div>
                          </>
                      ) : (
                          <div style={{ marginTop: 12, background: '#f0f5ff', padding: 12, borderRadius: 6, border: '1px solid #adc6ff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <Text strong style={{color: '#1d39c4'}}>
                                      <UserAddOutlined /> {patientForm.name} 
                                      <span style={{fontWeight: 'normal', color: '#666', fontSize: 12, marginLeft: 8}}>({selectedPatientOriginal?.uhid})</span>
                                  </Text>
                                  <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={handleClearSelection}>Clear Selection</Button>
                              </div>
                              <Row gutter={8}>
                                  <Col span={12}>
                                        <Text type="secondary" style={{fontSize: 11}}>Mobile</Text>
                                        <div style={{ fontWeight: 500 }}>{selectedPatientOriginal?.mobile}</div>
                                  </Col>
                                  <Col span={6}>
                                      <Text type="secondary" style={{fontSize: 11}}>Age (Edit)</Text>
                                      <InputNumber style={{width: '100%'}} min={1} value={patientForm.age} onChange={v => handlePatientFormChange('age', v)} status={patientForm.age !== selectedPatientOriginal?.age ? "warning" : ""} />
                                  </Col>
                                  <Col span={6}>
                                      <Text type="secondary" style={{fontSize: 11}}>Gender (Edit)</Text>
                                      <Select value={patientForm.gender} onChange={v => handlePatientFormChange('gender', v)} style={{width: '100%'}} status={patientForm.gender !== selectedPatientOriginal?.gender ? "warning" : ""}>
                                          <Option value="Male">Male</Option>
                                          <Option value="Female">Female</Option>
                                      </Select>
                                  </Col>
                              </Row>
                          </div>
                      )}
                  </Card>

                  <Card size="small" title="2. Services">
                      <Form.Item name="serviceSelect" style={{ marginBottom: 8 }}>
                        <Select
                            mode="multiple"
                            showSearch
                            style={{ width: '100%' }}
                            placeholder="Search Test, Package, or Doctor..."
                            filterOption={filterServices}
                            onChange={handleServicesChange}
                            value={selectedItems.map(i => i._id)}
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
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
                                            <Option key={t._id} value={t._id} name={t.name} alias={t.alias} disabled={isFull} style={isFull ? { opacity: 0.5, fontStyle: 'italic' } : {}}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                                    <span style={{ flex: 1, whiteSpace: 'normal' }}>
                                                        {t.name} {aliasText && <span style={{ color: '#ffffff', fontSize: '0.85em', fontStyle: 'italic', padding: '0px 3px 0px 3px', backgroundColor: '#a46500', borderRadius: '2px' }}>{String(aliasText).toUpperCase()}</span>}
                                                        {showLimit && <span style={{ color: isFull ? 'red' : '#1890ff', fontSize: '0.85em', marginLeft: 6 }}>{limitText}</span>}
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

                      <List
                          size="small"
                          dataSource={selectedItems}
                          locale={{ emptyText: <Empty description="No services selected" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                      >
                          {selectedItems.length === 0 ? null : (
                              groupedItems.map(group => (
                                  <div key={group.dept}>
                                      <Divider orientation="left" style={{ margin: '12px 0 8px', fontSize: 12 }}>
                                          <Tag color={group.color}>{group.dept}</Tag>
                                      </Divider>
                                      {group.items.map(item => (
                                          <List.Item 
                                            key={item._id}
                                            actions={[<DeleteOutlined onClick={() => handleRemoveItem(item._id)} style={{color:'red', cursor: 'pointer'}} />]}
                                            style={{padding: '4px 0'}}
                                          >
                                             <List.Item.Meta
                                                avatar={<Avatar size="small" icon={item.type === 'Consultation' ? <UserOutlined /> : <MedicineBoxOutlined />} style={{ backgroundColor: item.type === 'Package' ? '#87d068' : item.type === 'Consultation' ? '#722ed1' : '#1890ff' }} />}
                                            />
                                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                                <div style={{ flex: 1 }}>
                                                    <Text style={{ fontWeight: 'bold', fontSize: 13 }}>{item.name}</Text>
                                                    {item.type === "Package" && <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>PKG</Tag>}
                                                    
                                                    {/* NEW: Follow-up & Shift Controls */}
                                                    {item.type === "Consultation" && item.availableShifts?.length > 0 && (
                                                        <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                                                            <Select 
                                                                size="small"
                                                                value={item.shiftName} 
                                                                onChange={(val) => {
                                                                    const updated = selectedItems.map(i => i._id === item._id ? { ...i, shiftName: val } : i);
                                                                    setSelectedItems(updated);
                                                                }}
                                                                style={{ width: 180, fontSize: 11 }}
                                                            >
                                                                {item.availableShifts.map(s => (
                                                                    <Option key={s.shiftName} value={s.shiftName}>
                                                                        {s.shiftName} ({moment(s.startTime,"HH:mm").format("h:mm a")}-{moment(s.endTime,"HH:mm").format("h:mm a")})
                                                                    </Option>
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
                                                                Follow-up Visit
                                                            </Checkbox>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ width: 80, textAlign: "right", fontWeight: 500 }}>
                                                    ₹{item.price}
                                                </div>
                                            </div>
                                          </List.Item>
                                      ))}
                                  </div>
                              ))
                          )}
                      </List>
                  </Card>
              </Col>

              <Col span={10}>
                <Card size="small" title="3. Select Date" style={{ marginBottom: 16 }}>
                <DatePicker style={{width: '100%'}} value={scheduleDate ? dayjs(scheduleDate, "YYYY-MM-DD") : null} onChange={onScheduleDateChange} format="ddd, Do MMMM YYYY" disabledDate={disabledDate} allowClear={false} />
                </Card>
                  <Card size="small" title="4. Billing" style={{ height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text type="secondary">Total:</Text>
                          <Text strong>₹{totalAmount}</Text>
                      </div>
                      <Form.Item name="discountAmount" label="Discount">
                          <InputNumber style={{ width: '100%' }} min={0} max={totalAmount} prefix="₹" />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate={(prev, curr) => prev.discountAmount !== curr.discountAmount}>
                        {({ getFieldValue }) => getFieldValue("discountAmount") > 0 && (
                            <Form.Item name="discountReason" label="Discount Reason" rules={[{required: true, message: 'Reason required'}]}>
                                <Input placeholder="e.g. Staff, Senior Citizen" />
                            </Form.Item>
                        )}
                      </Form.Item>
                      <Divider style={{ margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                          <Title level={5}>Net Payable:</Title>
                          <Title level={4} type="success">₹{netAmount}</Title>
                      </div>
                      <Form.Item name="paidAmount" label={<div style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems:'center'}}><span>Advance / Paid Now</span><Checkbox style={{marginLeft: '10px'}} onChange={(e) => form.setFieldsValue({ paidAmount: e.target.checked ? netAmount : 0 })}>Pay Full</Checkbox></div>}>
                          <InputNumber style={{ width: '100%' }} min={0} max={netAmount} prefix="₹" />
                      </Form.Item>
                      {paidAmount > 0 && (
                        <div style={{ background: '#f9f9f9', padding: 10, borderRadius: 6, marginBottom: 16 }}>
                            <Form.Item name="paymentMode" label="Payment Mode" style={{ marginBottom: 8 }}>
                                <Select>
                                    <Option value="Cash"><DollarCircleOutlined /> Cash</Option>
                                    <Option value="Razorpay"><QrcodeOutlined /> Online / QR</Option>
                                    <Option value="Card"><CreditCardOutlined /> Card</Option>
                                </Select>
                            </Form.Item>
                            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.paymentMode !== curr.paymentMode}>
                                {({ getFieldValue }) => getFieldValue("paymentMode") !== "Razorpay" && (
                                    <Form.Item name="transactionId" label="Transaction Ref" style={{ marginBottom: 0 }}>
                                        <Input placeholder="Slip No / Ref ID" />
                                    </Form.Item>
                                )}
                            </Form.Item>
                        </div>
                      )}
                      <div style={{ marginBottom: 16 }}>
                          <Checkbox checked={isHomeCollection} onChange={handleHomeCollectionChange}>
                              <HomeOutlined /> Home Collection
                          </Checkbox>
                      </div>
                      <Alert message={`Balance Due: ₹${dueAmount}`} type={dueAmount > 0 ? "warning" : "success"} showIcon />
                  </Card>
              </Col>
          </Row>
          <Form.Item name="notes" label="Internal Notes" style={{ marginTop: 16 }}>
              <Input.TextArea rows={2} placeholder="e.g. Report required urgently..." />
          </Form.Item>
        </Form>
        )}
      </Drawer>

      <CreatePatientModal open={isPatientModalOpen} onCancel={() => setIsPatientModalOpen(false)} onSuccess={handleNewPatientCreated} initialSearchTerm={searchTerm} />
      <DiscountOverrideModal open={isOverrideModalOpen} onCancel={() => { setIsOverrideModalOpen(false); setPendingSubmission(null); setLoading(false); }} onSubmit={handleOverrideSubmit} />
      {createdOrder && (
          <PaymentModal open={isPaymentModalOpen} onCancel={() => { setIsPaymentModalOpen(false); handleClose(true); }} order={createdOrder} initialAmount={createdOrder.dueAmountForModal} onSuccess={() => { setIsPaymentModalOpen(false); handleClose(true); }} />
      )}
    </>
  );
};

export default CreateOrderDrawer;