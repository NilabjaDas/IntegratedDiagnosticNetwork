import React, { useState, useEffect, useRef } from "react";
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
  Modal
} from "antd";
import { 
  UserAddOutlined, 
  MedicineBoxOutlined, 
  DeleteOutlined, 
  CalculatorOutlined,
  CreditCardOutlined,
  QrcodeOutlined,
  DollarCircleOutlined,
  SearchOutlined
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createOrder, searchPatients } from "../redux/apiCalls";
import CreatePatientModal from "./CreatePatientModal";
import PaymentModal from "./PaymentModal";
import DiscountOverrideModal from "./DiscountOverrideModal"; 

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
  const [patientId, setPatientId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Search State for Pre-filling
  const [searchTerm, setSearchTerm] = useState("");

  // Billing State
  const [totalAmount, setTotalAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [dueAmount, setDueAmount] = useState(0);
  
  // Modals
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null); 
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Override State
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);

  // Watch Paid Amount to show/hide Payment Mode
  const paidAmount = Form.useWatch("paidAmount", form);

  // --- BILLING CALCULATOR ---
  const handleValuesChange = (changedValues, allValues) => {
    const discount = allValues.discountAmount || 0;
    const paid = allValues.paidAmount || 0;
    
    const newNet = Math.max(0, totalAmount - discount);
    const newDue = Math.max(0, newNet - paid);
    
    setNetAmount(newNet);
    setDueAmount(newDue);
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


  // --- HANDLERS ---

  const handlePatientSearch = (val) => {
    setSearchTerm(val); // Store for pre-fill
    if (val.length >= 4) searchPatients(dispatch, val);
  };

  const handleNewPatientCreated = (newPatient) => {
    console.log(newPatient)
    setIsPatientModalOpen(false);
    setPatientId(newPatient._id);
    message.success(`Selected ${newPatient.firstName}`);
    searchPatients(dispatch, newPatient.mobile);
    form.setFieldsValue({ patientId: newPatient._id });
  };

  const handleServicesChange = (values) => {
      // values is array of IDs
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
    // Sync the Select component value
    form.setFieldsValue({ serviceSelect: newItems.map(i => i._id) });
  };

  // --- SUBMISSION LOGIC ---

  const onFinish = async (values) => {
    const dataToSubmit = pendingSubmission 
        ? { ...pendingSubmission, discountOverrideCode: values.overrideCode }
        : values;

    if (!pendingSubmission) {
        if (!patientId) return message.error("Please select a patient");
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
        patientId: patientId,
        items: selectedItems.map(i => ({ _id: i._id, type: i.type })),
        discountAmount,
        discountReason,
        paymentMode, // Store intended mode even if online
        discountOverrideCode,
        notes
    };

    // Only attach initialPayment for Manual modes here.
    // For Razorpay, we create the order first, then handle payment in the modal.
    if (paymentMode !== "Razorpay" && paidAmount > 0) {
        orderData.initialPayment = {
            mode: paymentMode,
            amount: paidAmount,
            transactionId,
            notes: notes || "Advance Payment"
        };
    }

    const res = await createOrder(dispatch, orderData);
    setLoading(false);

    if (res.status === 201) {
        message.success("Order Created Successfully!");
        setIsOverrideModalOpen(false);
        setPendingSubmission(null);
        
        if (paymentMode === "Razorpay" && paidAmount > 0) {
            // Chain Online Payment
            // Pass the 'paidAmount' as the amount to collect in the modal
            setCreatedOrder({ ...res.data, dueAmountForModal: paidAmount }); 
            setIsPaymentModalOpen(true);
            // Keep drawer open until payment logic handles closure or user cancels
             handleClose(false); // Close main drawer, show modal
        } else {
            handleClose(true);
        }

    } else if (res.status === 403 && (res.data?.requiresOverride || res.message?.toLowerCase().includes("limit"))) {
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
        setPatientId(null);
        setTotalAmount(0);
        setNetAmount(0);
        setDueAmount(0);
        setPendingSubmission(null);
        setSearchTerm("");
        onClose();
    }
  };

  return (
    <>
      <Drawer
        title="Create New Order"
        width={800}
        onClose={() => handleClose(true)}
        open={open}
        destroyOnClose
        maskClosable={false}
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
              {/* Left Col */}
              <Col span={14}>
                  <Card size="small" title="1. Patient" style={{ marginBottom: 16 }}>
                      <Row gutter={8}>
                          <Col span={20}>
                              <Form.Item name="patientId" noStyle rules={[{ required: true, message: "Select Patient" }]}>
                                  <Select
                                      showSearch
                                      placeholder="Search Name / Mobile / UHID..."
                                      filterOption={false}
                                      onSearch={handlePatientSearch}
                                      onChange={(val) => setPatientId(val)}
                                      value={patientId}
                                      suffixIcon={<SearchOutlined />}
                                  >
                                      {searchResults.map(p => (
                                          <Option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.mobile})</Option>
                                      ))}
                                  </Select>
                              </Form.Item>
                          </Col>
                          <Col span={4}>
                              <Button 
                                block 
                                type="primary" 
                                icon={<UserAddOutlined />} 
                                onClick={() => setIsPatientModalOpen(true)}
                                title="Register New Patient"
                              />
                          </Col>
                      </Row>
                  </Card>

                  <Card size="small" title="2. Services">
                      <Form.Item name="serviceSelect" style={{ marginBottom: 8 }}>
                          <Select
                              mode="multiple"
                              showSearch
                              placeholder="Add Test / Package..."
                              optionFilterProp="children"
                              onChange={handleServicesChange}
                              value={selectedItems.map(i => i._id)}
                              // Hide tags in input, we show list below
                              tagRender={() => null} 
                          >
                              <Select.OptGroup label="Packages">
                                  {packages?.map(p => <Option key={p._id} value={p._id}>{p.name} (₹{p.offerPrice})</Option>)}
                              </Select.OptGroup>
                              <Select.OptGroup label="Tests">
                                  {tests?.map(t => <Option key={t._id} value={t._id}>{t.name} (₹{t.price})</Option>)}
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

              {/* Right Col */}
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

                      <Form.Item name="paidAmount" label="Advance / Paid Now">
                          <InputNumber style={{ width: '100%' }} min={0} max={netAmount} prefix="₹" />
                      </Form.Item>

                      {/* CONDITIONAL: Show Payment Mode only if user is paying something */}
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

      {/* Modals */}
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

      {/* Payment Modal for Online Advance */}
      {createdOrder && (
          <PaymentModal 
            open={isPaymentModalOpen}
            onCancel={() => {
                setIsPaymentModalOpen(false);
                handleClose(true);
            }}
            order={createdOrder}
            // Pass the specific advance amount to collect (not the full due)
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