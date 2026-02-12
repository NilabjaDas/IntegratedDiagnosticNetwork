import React, { useState, useEffect } from "react";
import {
  Drawer,
  Form,
  Button,
  Select,
  Input,
  InputNumber,
  List,
  Typography,
  message,
  Avatar,
  Card,
  Row,
  Col,
  Empty,
  Divider,
  Statistic,
  Alert,
  Checkbox
} from "antd";
import { 
  UserAddOutlined, 
  MedicineBoxOutlined, 
  DeleteOutlined, 
  CalculatorOutlined,
  CreditCardOutlined,
  QrcodeOutlined,
  DollarCircleOutlined,
  SearchOutlined,
  CloseCircleOutlined
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createOrder, searchPatients } from "../redux/apiCalls";
import CreatePatientModal from "./CreatePatientModal";
import PaymentModal from "./PaymentModal";
import DiscountOverrideModal from "./DiscountOverrideModal"; 
import { patientSearchSuccess } from "../redux/orderRedux";

const { Option } = Select;
const { Title, Text } = Typography;

const CreateOrderDrawer = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  
  // Redux Data
  const { tests, packages } = useSelector((state) => state[process.env.REACT_APP_TESTS_DATA_KEY] || state.test);
  const { searchResults } = useSelector((state) => state[process.env.REACT_APP_ORDERS_DATA_KEY] || state.order); 
  
  // Local State
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // --- PATIENT STATE ---
  const [patientId, setPatientId] = useState(null);
  const [selectedPatientOriginal, setSelectedPatientOriginal] = useState(null); 
  
  // Unified Form: Used for Walk-in Entry OR Editing Registered Patient (Age/Gender)
  const [patientForm, setPatientForm] = useState({
      name: "",
      age: "",
      gender: "Male"
  });

  // Billing State
  const [totalAmount, setTotalAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [dueAmount, setDueAmount] = useState(0);
  
  // Modals
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null); 
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);

  const paidAmount = Form.useWatch("paidAmount", form);

  // --- BILLING CALCULATOR ---
  const handleValuesChange = (changedValues, allValues) => {
    const discount = allValues.discountAmount || 0;
    const paid = allValues.paidAmount || 0;
    const newNet = Math.max(0, totalAmount - discount);
    setNetAmount(newNet);
    setDueAmount(Math.max(0, newNet - paid));
  };

  useEffect(() => {
    const sum = selectedItems.reduce((acc, item) => acc + (item.price || 0), 0);
    setTotalAmount(sum);
    const currentDiscount = form.getFieldValue("discountAmount") || 0;
    const currentPaid = form.getFieldValue("paidAmount") || 0;
    const newNet = Math.max(0, sum - currentDiscount);
    setNetAmount(newNet);
    setDueAmount(Math.max(0, newNet - currentPaid));
  }, [selectedItems, form]);


  // --- HANDLERS: PATIENT ---

  const handlePatientSearch = (val) => {
    setSearchTerm(val); 
    if (val.length >= 2) searchPatients(dispatch, val);
  };

  // 1. Registered Patient Selected
  const handleSelectRegistered = (val) => {
      setPatientId(val);
      setSearchTerm(""); // Clear search text
      
      const selected = searchResults?.find(p => p._id === val);
      if (selected) {
          setSelectedPatientOriginal(selected);
          // Populate form to allow Age/Gender editing
          setPatientForm({
              name: `${selected.firstName} ${selected.lastName}`,
              age: selected.age,
              gender: selected.gender
          });
      }
  };

  // 2. Clear Selection (Reset to Walk-in Mode)
  const handleClearSelection = () => {
      setPatientId(null);
        dispatch(patientSearchSuccess(null));
      setSelectedPatientOriginal(null);
      setSearchTerm(""); // Clear search input
      setPatientForm({ name: "", age: "", gender: "Male" }); 
  };

  // 3. Handle Form Changes
  const handlePatientFormChange = (field, value) => {
      setPatientForm(prev => ({ ...prev, [field]: value }));
  };

  const handleNewPatientCreated = (newPatient) => {
    setIsPatientModalOpen(false);
    setPatientId(newPatient._id);
    setSelectedPatientOriginal(newPatient);
    setPatientForm({
        name: `${newPatient.firstName} ${newPatient.lastName}`,
        age: newPatient.age,
        gender: newPatient.gender
    });
    message.success(`Selected ${newPatient.firstName}`);
    searchPatients(dispatch, newPatient.mobile);
    form.setFieldsValue({ patientId: newPatient._id });
  };

  // --- HANDLERS: SERVICES ---

  const handleServicesChange = (values) => {
      const newItems = [];
      values.forEach(val => {
          const testMatch = tests.find(t => t._id === val);
          if (testMatch) {
             newItems.push({ ...testMatch, type: 'Test' });
          } else {
             const pkgMatch = packages.find(p => p._id === val);
             if (pkgMatch) {
                newItems.push({ ...pkgMatch, price: pkgMatch.offerPrice, type: 'Package' });
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

  // --- SUBMISSION ---

  const onFinish = async (values) => {
    const dataToSubmit = pendingSubmission 
        ? { ...pendingSubmission, discountOverrideCode: values.overrideCode }
        : values;

    if (!pendingSubmission) {
        if (!patientId && !patientForm.name) {
            return message.error("Please select a Patient OR enter Walk-in Name");
        }
        if (selectedItems.length === 0) return message.error("Please select services");
    }

    setLoading(true);

    const { 
        discountAmount = 0,
        discountReason, 
        paidAmount = 0, 
        paymentMode, 
        transactionId, 
        notes,
        discountOverrideCode 
    } = dataToSubmit;

    const orderData = {
        items: selectedItems.map(i => ({ _id: i._id, type: i.type })),
        discountAmount,
        discountReason,
        paymentMode, 
        discountOverrideCode,
        notes: notes || ""
    };

    // --- PATIENT LOGIC ---
    if (patientId) {
        // SCENARIO A: Registered Patient
        orderData.patientId = patientId;
        orderData.walkin = false;

        // Check for updates to Age/Gender
        if (selectedPatientOriginal) {
            const hasChanged = 
                String(patientForm.age) !== String(selectedPatientOriginal.age) || 
                patientForm.gender !== selectedPatientOriginal.gender;
            
            if (hasChanged) {
                orderData.updatedPatientData = true; // Flag for backend
                orderData.age = patientForm.age;
                orderData.gender = patientForm.gender;
            }
        }
    } else {
        // SCENARIO B: Walk-in Patient
        orderData.walkin = true;
        orderData.patientName = patientForm.name;
        orderData.age = patientForm.age;
        orderData.gender = patientForm.gender;
        orderData.mobile = ""; 
    }

    // Advance Payment
    if (paymentMode !== "Razorpay" && paidAmount > 0) {
        orderData.initialPayment = {
            mode: paymentMode,
            amount: paidAmount,
            transactionId,
            notes: notes || "Advance Payment"
        };
    }
console.log(orderData)

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

  const handleClose = (fullyClose = true) => {
    if (fullyClose) {
        form.resetFields();
        setSelectedItems([]);
        handleClearSelection();
        setTotalAmount(0);
        setNetAmount(0);
        setDueAmount(0);
        setPendingSubmission(null);
        setSearchTerm("");
        onClose();
    }
  };

  // --- FILTER: Name + Alias + Substring ---
  const filterServices = (input, option) => {
      if (!input) return true;
      const text = input.toLowerCase();
      const name = option.children ? String(option.children).toLowerCase() : '';
      const alias = option.alias ? String(option.alias).toLowerCase() : '';
      return name.includes(text) || alias.includes(text);
  };
  return (
    <>
      <Drawer
        title="Create New Order"
        width={800}
        onClose={() => handleClose(true)}
        open={open}
        destroyOnClose
        extra={
             <Statistic title="Net Payable" value={netAmount} prefix="₹" valueStyle={{ fontSize: 16, color: '#1890ff' }} />
        }
        footer={
          <div style={{ textAlign: "right" }}>
            <Button onClick={() => handleClose(true)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" onClick={form.submit} loading={loading} icon={<CalculatorOutlined />}>
               Confirm & Book
            </Button>
          </div>
        }
      >
        <Form 
            layout="vertical" 
            form={form} 
            onFinish={onFinish}
            onValuesChange={handleValuesChange}
            initialValues={{ 
                paymentMode: "Cash", 
                discountAmount: 0,
                paidAmount: 0
            }}
        >
          
          <Row gutter={24}>
              {/* Left Col: Patient & Services */}
              <Col span={14}>
                  <Card size="small" title="1. Patient Selection" style={{ marginBottom: 16 }}>
                      
                      {/* SECTION A: SEARCH BAR */}
                      <Row gutter={8} align="middle">
                          <Col span={20}>
                              <Form.Item name="patientId" noStyle>
                                  <Select
                                      showSearch
                                      placeholder="Search Registered Patient (Name / Mobile)"
                                      filterOption={false}
                                      onSearch={handlePatientSearch}
                                      onChange={handleSelectRegistered}
                                      value={patientId}
                                      searchValue={searchTerm} 
                                      suffixIcon={<SearchOutlined />}
                                      allowClear
                                      autoClearSearchValue = {true}
                                      onClear={handleClearSelection}
                                  >
                                      {searchResults?.map(p => (
                                          <Option key={p._id} value={p._id}>
                                              {/* Simple Display: Name (Mobile) */}
                                              {p.firstName} {p.lastName} ({p.mobile})
                                          </Option>
                                      ))}
                                  </Select>
                              </Form.Item>
                          </Col>
                          <Col span={4}>
                              <Button 
                                block 
                                icon={<UserAddOutlined />} 
                                onClick={() => setIsPatientModalOpen(true)}
                                title="Register New Patient"
                              />
                          </Col>
                      </Row>
                      {/* SECTION B: DYNAMIC UI */}
                      {!patientId ? (
                          // MODE 1: WALK-IN (Inputs Active)
                          <>
                              <Divider style={{ margin: '12px 0', fontSize: 12, color: '#999' }}>OR Walk-In / Guest</Divider>
                              <div style={{ background: '#f6ffed', padding: 12, borderRadius: 6, border: '1px solid #b7eb8f' }}>
                                  <Row gutter={8}>
                                      <Col span={12}>
                                          <Text type="secondary" style={{fontSize: 11}}>Guest Name</Text>
                                          <Input 
                                              value={patientForm.name} 
                                              onChange={e => handlePatientFormChange('name', e.target.value)}
                                              placeholder="Patient Name"
                                          />
                                      </Col>
                                      <Col span={6}>
                                          <Text type="secondary" style={{fontSize: 11}}>Age</Text>
                                          <InputNumber 
                                              style={{width: '100%'}} 
                                              placeholder="Yrs"
                                              value={patientForm.age}
                                              onChange={v => handlePatientFormChange('age', v)}
                                          />
                                      </Col>
                                      <Col span={6}>
                                          <Text type="secondary" style={{fontSize: 11}}>Gender</Text>
                                          <Select 
                                              value={patientForm.gender} 
                                              onChange={v => handlePatientFormChange('gender', v)}
                                              style={{width: '100%'}}
                                          >
                                              <Option value="Male">Male</Option>
                                              <Option value="Female">Female</Option>
                                          </Select>
                                      </Col>
                                  </Row>
                              </div>
                          </>
                      ) : (
                          // MODE 2: REGISTERED PATIENT (Details View + Editing)
                          <div style={{ marginTop: 12, background: '#f0f5ff', padding: 12, borderRadius: 6, border: '1px solid #adc6ff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <Text strong style={{color: '#1d39c4'}}>
                                      <UserAddOutlined /> {patientForm.name} 
                                      <span style={{fontWeight: 'normal', color: '#666', fontSize: 12, marginLeft: 8}}>
                                          ({selectedPatientOriginal?.uhid})
                                      </span>
                                  </Text>
                                  <Button size="small" type="text" danger icon={<CloseCircleOutlined />} onClick={handleClearSelection}>
                                      Clear Selection
                                  </Button>
                              </div>
                              <Row gutter={8}>
                                  <Col span={12}>
                                       <Text type="secondary" style={{fontSize: 11}}>Mobile</Text>
                                       <div style={{ fontWeight: 500 }}>{selectedPatientOriginal?.mobile}</div>
                                  </Col>
                                  <Col span={6}>
                                      <Text type="secondary" style={{fontSize: 11}}>Age (Edit)</Text>
                                      <InputNumber 
                                          style={{width: '100%'}} 
                                          value={patientForm.age}
                                          onChange={v => handlePatientFormChange('age', v)}
                                          status={patientForm.age !== selectedPatientOriginal?.age ? "warning" : ""}
                                      />
                                  </Col>
                                  <Col span={6}>
                                      <Text type="secondary" style={{fontSize: 11}}>Gender (Edit)</Text>
                                      <Select 
                                          value={patientForm.gender} 
                                          onChange={v => handlePatientFormChange('gender', v)}
                                          style={{width: '100%'}}
                                          status={patientForm.gender !== selectedPatientOriginal?.gender ? "warning" : ""}
                                      >
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
                              placeholder="Search Test / Package (Name or Alias)..."
                              filterOption={filterServices}
                              onChange={handleServicesChange}
                              value={selectedItems.map(i => i._id)}
                              tagRender={() => null} 
                          >
                              <Select.OptGroup label="Packages">
                                  {packages?.map(p => (
                                      <Option key={p._id} value={p._id} alias={p.alias}>
                                          {p.name} (₹{p.offerPrice})
                                      </Option>
                                  ))}
                              </Select.OptGroup>
                              <Select.OptGroup label="Tests">
                                  {tests?.map(t => (
                                      <Option key={t._id} value={t._id} alias={t.alias}>
                                          {t.name} (₹{t.price})
                                      </Option>
                                  ))}
                              </Select.OptGroup>
                          </Select>
                      </Form.Item>

                      <List
                          size="small"
                          dataSource={selectedItems}
                          locale={{ emptyText: <Empty description="No services selected" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                          renderItem={item => (
                              <List.Item actions={[<DeleteOutlined onClick={() => handleRemoveItem(item._id)} style={{color:'red'}} />]}>
                                  <List.Item.Meta
                                      avatar={<Avatar size="small" icon={<MedicineBoxOutlined />} style={{ backgroundColor: item.type === 'Package' ? '#87d068' : '#1890ff' }} />}
                                      title={<span style={{fontSize: 13}}>{item.name}</span>}
                                  />
                                  <div>₹{item.price}</div>
                              </List.Item>
                          )}
                      />
                  </Card>
              </Col>

              <Col span={10}>
                  <Card size="small" title="3. Billing" style={{ height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text type="secondary">Total:</Text>
                          <Text strong>₹{totalAmount}</Text>
                      </div>
                      
                      <Form.Item name="discountAmount" label="Discount">
                          <InputNumber style={{ width: '100%' }} min={0} max={totalAmount} prefix="₹" />
                      </Form.Item>
                      
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) => prev.discountAmount !== curr.discountAmount}
                      >
                        {({ getFieldValue }) => 
                            getFieldValue("discountAmount") > 0 && (
                                <Form.Item name="discountReason" label="Discount Reason" rules={[{required: true, message: 'Reason required'}]}>
                                    <Input placeholder="e.g. Staff, Senior Citizen" />
                                </Form.Item>
                            )
                        }
                      </Form.Item>

                      <Divider style={{ margin: '12px 0' }} />
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                          <Title level={5}>Net Payable:</Title>
                          <Title level={4} type="success">₹{netAmount}</Title>
                      </div>

                      <Form.Item 
                        name="paidAmount" 
                        label={
                            <div style={{display:'flex', justifyContent:'space-between', width:'100%', alignItems:'center'}}>
                                <span>Advance / Paid Now</span>
                                <Checkbox style={{marginLeft: '10px'}} onChange={(e) => {
                                    if(e.target.checked) form.setFieldsValue({ paidAmount: netAmount });
                                }}>Pay Full</Checkbox>
                            </div>
                        }
                      >
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

                            <Form.Item 
                                noStyle 
                                shouldUpdate={(prev, curr) => prev.paymentMode !== curr.paymentMode}
                            >
                                {({ getFieldValue }) => 
                                    getFieldValue("paymentMode") !== "Razorpay" && (
                                        <Form.Item name="transactionId" label="Transaction Ref" style={{ marginBottom: 0 }}>
                                            <Input placeholder="Slip No / Ref ID" />
                                        </Form.Item>
                                    )
                                }
                            </Form.Item>
                        </div>
                      )}

                      <Alert 
                        message={`Balance Due: ₹${dueAmount}`} 
                        type={dueAmount > 0 ? "warning" : "success"} 
                        showIcon 
                      />
                  </Card>
              </Col>
          </Row>
          
          <Form.Item name="notes" label="Internal Notes" style={{ marginTop: 16 }}>
              <Input.TextArea rows={2} placeholder="e.g. Report required urgently..." />
          </Form.Item>

        </Form>
      </Drawer>

      <CreatePatientModal 
        open={isPatientModalOpen} 
        onCancel={() => setIsPatientModalOpen(false)}
        onSuccess={handleNewPatientCreated}
        initialSearchTerm={searchTerm}
      />

      <DiscountOverrideModal 
        open={isOverrideModalOpen}
        onCancel={() => {
            setIsOverrideModalOpen(false);
            setPendingSubmission(null);
            setLoading(false);
        }}
        onSubmit={handleOverrideSubmit}
      />

      {createdOrder && (
          <PaymentModal 
            open={isPaymentModalOpen}
            onCancel={() => {
                setIsPaymentModalOpen(false);
                handleClose(true);
            }}
            order={createdOrder}
            initialAmount={createdOrder.dueAmountForModal} 
            onSuccess={() => {
                setIsPaymentModalOpen(false);
                handleClose(true);
            }}
          />
      )}
    </>
  );
};

export default CreateOrderDrawer;