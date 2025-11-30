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
  Modal
} from "antd";
import { 
  UserAddOutlined, 
  MedicineBoxOutlined, 
  DeleteOutlined, 
  CalculatorOutlined,
  CreditCardOutlined,
  QrcodeOutlined,
  DollarCircleOutlined
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createOrder, searchPatients } from "../redux/apiCalls";
import CreatePatientModal from "./CreatePatientModal";
import PaymentModal from "./PaymentModal"; // Import to chain online payment

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
  
  // Billing State
  const [totalAmount, setTotalAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [dueAmount, setDueAmount] = useState(0);
  
  // Modals
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null); // For chaining payment
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // --- BILLING CALCULATOR ---
  const handleValuesChange = (changedValues, allValues) => {
    const discount = allValues.discountAmount || 0;
    const paid = allValues.paidAmount || 0;
    
    const newNet = Math.max(0, totalAmount - discount);
    const newDue = Math.max(0, newNet - paid);
    
    setNetAmount(newNet);
    setDueAmount(newDue);
  };

  // Recalculate when items change
  useEffect(() => {
    const sum = selectedItems.reduce((acc, item) => acc + (item.price || 0), 0);
    setTotalAmount(sum);
    
    // Trigger re-calc of Net/Due based on current form values
    const currentDiscount = form.getFieldValue("discountAmount") || 0;
    const currentPaid = form.getFieldValue("paidAmount") || 0;
    
    const newNet = Math.max(0, sum - currentDiscount);
    setNetAmount(newNet);
    setDueAmount(Math.max(0, newNet - currentPaid));
    
    // Auto-fill "Paid Amount" with full amount if user hasn't edited it yet (Optional UX)
    // For now, we let user type it.
  }, [selectedItems, form]);


  // --- HANDLERS ---

  const handlePatientSearch = (val) => {
    if (val.length >= 4) searchPatients(dispatch, val);
  };

  const handlePatientSelect = (val) => {
    if (val === "NEW_PATIENT") {
        setPatientId(null);
        setIsPatientModalOpen(true);
    } else {
        setPatientId(val);
    }
  };

  const handleNewPatientCreated = (newPatient) => {
    setIsPatientModalOpen(false);
    setPatientId(newPatient._id);
    message.success(`Selected ${newPatient.firstName}`);
    searchPatients(dispatch, newPatient.mobile);
    form.setFieldsValue({ patientId: newPatient._id }); // Sync UI
  };

  const handleAddItem = (value) => {
    if (selectedItems.find(i => i._id === value)) return message.warning("Item already added");

    const testMatch = tests.find(t => t._id === value);
    if (testMatch) {
        setSelectedItems([...selectedItems, { ...testMatch, type: 'Test' }]);
    } else {
        const pkgMatch = packages.find(p => p._id === value);
        if (pkgMatch) {
            setSelectedItems([...selectedItems, { ...pkgMatch, price: pkgMatch.offerPrice, type: 'Package' }]);
        }
    }
  };

  const handleRemoveItem = (id) => {
    setSelectedItems(selectedItems.filter(i => i._id !== id));
  };

  const onFinish = async (values) => {
    if (!patientId) return message.error("Please select a patient");
    if (selectedItems.length === 0) return message.error("Please select services");

    setLoading(true);

    const { discountAmount = 0,discountReason, paidAmount = 0, paymentMode, transactionId, notes } = values;

    const orderData = {
        patientId,
        items: selectedItems.map(i => ({ _id: i._id, type: i.type })),
        discountAmount,
        discountReason,
        paymentMode
    };

    // LOGIC: If Cash/Card, we record payment NOW.
    // If Razorpay, we create order -> then open Payment Modal.
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
        
        if (paymentMode === "Razorpay" && paidAmount > 0) {
            // Chain the Online Payment Flow
            setCreatedOrder(res.data);
            setIsPaymentModalOpen(true);
            // We DO NOT close the drawer yet, or we close it and let the modal take over.
            // Let's close the main drawer to clean up UI.
            handleClose(false); // Pass false to NOT clear state needed for modal? 
            // Actually, PaymentModal needs 'createdOrder'. 
            // If we unmount this component, PaymentModal might disappear if it's inside.
            // Strategy: Keep this drawer open? No, clutter.
            // Strategy: The PaymentModal is rendered inside this component. 
            // We must keep this component mounted OR move PaymentModal to a global level.
            // Simple fix: Close this Drawer but keep the Payment Modal visible? 
            // AntD Drawers/Modals are independent. 
            // But if CreateOrderDrawer unmounts, its children unmount.
            // We will just keep CreateOrderDrawer open but show the PaymentModal on top.
            // Once PaymentModal closes, we close everything.
        } else {
            handleClose();
        }
    } else if (res.status === 403) {
       // Specific UI for Limit Error
       Modal.error({
           title: "Authorization Failed",
           content: res.message, // "You are only authorized to give up to 10%..."
       });
    } else {
        message.error(res.message || "Creation Failed");
    }
  };

  const handleClose = (fullyClose = true) => {
    if (fullyClose) {
        form.resetFields();
        setSelectedItems([]);
        setPatientId(null);
        setTotalAmount(0);
        setNetAmount(0);
        setDueAmount(0);
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
          
          {/* --- TOP SECTION: PATIENT & ITEMS --- */}
          <Row gutter={24}>
              {/* Left Col: Patient & Services */}
              <Col span={14}>
                  <Card size="small" title="1. Patient" style={{ marginBottom: 16 }}>
                      <Form.Item name="patientId" noStyle rules={[{ required: true, message: "Select Patient" }]}>
                          <Select
                              showSearch
                              placeholder="Search Mobile / UHID..."
                              filterOption={false}
                              onSearch={handlePatientSearch}
                              onChange={handlePatientSelect}
                              value={patientId}
                              notFoundContent={
                                <Button type="link" icon={<UserAddOutlined />} onClick={() => setIsPatientModalOpen(true)}>
                                    Register New Patient
                                </Button>
                              }
                          >
                              {searchResults.map(p => (
                                  <Option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.mobile})</Option>
                              ))}
                              <Option value="NEW_PATIENT" style={{ color: '#1890ff' }}>+ Add New</Option>
                          </Select>
                      </Form.Item>
                  </Card>

                  <Card size="small" title="2. Services">
                      <Form.Item style={{ marginBottom: 8 }}>
                          <Select
                              showSearch
                              placeholder="Add Test / Package..."
                              optionFilterProp="children"
                              onSelect={handleAddItem}
                              value={null}
                          >
                              <Select.OptGroup label="Packages">
                                  {packages.map(p => <Option key={p._id} value={p._id}>{p.name} (₹{p.offerPrice})</Option>)}
                              </Select.OptGroup>
                              <Select.OptGroup label="Tests">
                                  {tests.map(t => <Option key={t._id} value={t._id}>{t.name} (₹{t.price})</Option>)}
                              </Select.OptGroup>
                          </Select>
                      </Form.Item>

                      <List
                          size="small"
                          dataSource={selectedItems}
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

              {/* Right Col: Billing & Payment */}
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
                                <Form.Item name="discountReason" label="Discount Reason">
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

                      <Form.Item name="paymentMode" label="Payment Mode">
                          <Select>
                              <Option value="Cash"><DollarCircleOutlined /> Cash</Option>
                              <Option value="Razorpay"><QrcodeOutlined /> Online / QR</Option>
                              <Option value="Card"><CreditCardOutlined /> Card</Option>
                          </Select>
                      </Form.Item>

                      <Form.Item name="paidAmount" label="Advance / Paid Now">
                          <InputNumber style={{ width: '100%' }} min={0} max={netAmount} prefix="₹" />
                      </Form.Item>

                      <Form.Item 
                        noStyle 
                        shouldUpdate={(prev, curr) => prev.paymentMode !== curr.paymentMode}
                      >
                        {({ getFieldValue }) => 
                            getFieldValue("paymentMode") !== "Razorpay" && (
                                <Form.Item name="transactionId" label="Transaction Ref (Optional)">
                                    <Input placeholder="Slip No / Ref ID" />
                                </Form.Item>
                            )
                        }
                      </Form.Item>

                      <Alert
                        message={`Balance Due: ₹${dueAmount}`} 
                        type={dueAmount > 0 ? "warning" : "success"} 
                        showIcon 
                        style={{ marginTop: 16 }}
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
      />

      {/* Chain Payment Modal if Online was selected */}
      {createdOrder && (
          <PaymentModal 
            open={isPaymentModalOpen}
            onCancel={() => {
                setIsPaymentModalOpen(false);
                handleClose(true); // Close parent drawer when payment modal closes
            }}
            order={createdOrder}
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