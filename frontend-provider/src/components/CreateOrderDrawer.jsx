import React, { useState } from "react";
import {
  Drawer,
  Form,
  Button,
  Select,
  Input,
  List,
  Typography,
  message,
  Avatar,
  Card,
  Row,
  Col,
  Empty
} from "antd";
import { UserAddOutlined, MedicineBoxOutlined, DeleteOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createOrder, searchPatients } from "../redux/apiCalls";
import CreatePatientModal from "./CreatePatientModal"; // New Import

const { Option } = Select;
const { Title } = Typography;

const CreateOrderDrawer = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  
  const { tests, packages } = useSelector((state) => state[process.env.REACT_APP_TESTS_DATA_KEY]);
  const { searchResults } = useSelector((state) => state[process.env.REACT_APP_ORDERS_DATA_KEY]); 
  
  const [selectedItems, setSelectedItems] = useState([]);
  const [patientId, setPatientId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // State for Create Patient Modal
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);

  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.price || 0), 0);

  // --- HANDLERS ---

const handlePatientSearch = (val) => {
    // Updated threshold to 4 characters as requested
    if (val.length >= 4) {
        searchPatients(dispatch, val);
    }
  };

  const handlePatientSelect = (val) => {
    if (val === "NEW_PATIENT") {
        setPatientId(null); // Reset selection to prevent "NEW_PATIENT" being set as ID
        setIsPatientModalOpen(true);
    } else {
        setPatientId(val);
    }
  };

  // Callback when a new patient is created successfully
  const handleNewPatientCreated = (newPatient) => {
    setIsPatientModalOpen(false);
    // 1. Manually inject into search results so we can select it
    // (Or simpler: just set the ID directly and show a label)
    setPatientId(newPatient._id);
    message.success(`Selected ${newPatient.firstName} ${newPatient.lastName}`);
    
    // Optional: Refresh search results to include this new person
    searchPatients(dispatch, newPatient.mobile);
  };

  const handleAddItem = (value) => {
    if (selectedItems.find(i => i._id === value)) return;

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
    if (selectedItems.length === 0) return message.error("Please select at least one test");

    setLoading(true);
    const orderData = {
        patientId,
        items: selectedItems.map(i => ({ _id: i._id, type: i.type })),
        paymentMode: values.paymentMode,
        discountAmount: 0 
    };

    const res = await createOrder(dispatch, orderData);
    setLoading(false);

    if (res.status === 201) {
        message.success("Order Created Successfully!");
        handleClose();
    } else {
        message.error("Failed to create order");
    }
  };

  const handleClose = () => {
    form.resetFields();
    setSelectedItems([]);
    setPatientId(null);
    onClose();
  };

  return (
    <>
      <Drawer
        title="Create New Order"
        width={720}
        onClose={handleClose}
        open={open}
        destroyOnClose
        maskClosable={false}
        footer={
          <div style={{ textAlign: "right" }}>
            <Button onClick={handleClose} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button type="primary" onClick={form.submit} loading={loading}>
              Place Order (₹{totalAmount})
            </Button>
          </div>
        }
      >
        <Form layout="vertical" form={form} onFinish={onFinish}>
          
          {/* --- 1. PATIENT SELECTION --- */}
          <Card title="Patient Details" size="small" style={{ marginBottom: 20 }}>
              <Form.Item label="Search Patient (Name, Mobile or UHID)" required>
                  <Select
                      showSearch
                      placeholder="Enter mobile number..."
                      defaultActiveFirstOption={false}
                      showArrow={false}
                      filterOption={false}
                      onSearch={handlePatientSearch}
                      onChange={handlePatientSelect}
                      value={patientId}
                      notFoundContent={
                        <div style={{ padding: 8, textAlign: 'center' }}>
                            <Button type="link" icon={<UserAddOutlined />} onClick={() => setIsPatientModalOpen(true)}>
                                No patient found. Add New?
                            </Button>
                        </div>
                      }
                  >
                      {searchResults.map(p => (
                          <Option key={p._id} value={p._id}>
                              {p.firstName} {p.lastName} ({p.mobile})
                          </Option>
                      ))}
                      {/* Always show Add New option at bottom */}
                      <Option value="NEW_PATIENT" style={{ borderTop: '1px solid #eee', color: '#1890ff' }}>
                          <UserAddOutlined /> + Register New Patient
                      </Option>
                  </Select>
              </Form.Item>
          </Card>

          {/* --- 2. TEST SELECTION --- */}
          <Card title="Add Services" size="small" style={{ marginBottom: 20 }}>
              <Form.Item label="Search Services">
                  <Select
                      showSearch
                      placeholder="Type test name..."
                      optionFilterProp="children"
                      onSelect={handleAddItem}
                      value={null}
                  >
                      <Select.OptGroup label="Packages">
                          {packages.map(p => (
                              <Option key={p._id} value={p._id} label={p.name}>
                                  {p.name} - ₹{p.offerPrice}
                              </Option>
                          ))}
                      </Select.OptGroup>
                      <Select.OptGroup label="Individual Tests">
                          {tests.map(t => (
                              <Option key={t._id} value={t._id} label={t.name}>
                                  {t.name} - ₹{t.price}
                              </Option>
                          ))}
                      </Select.OptGroup>
                  </Select>
              </Form.Item>

              <List
                  itemLayout="horizontal"
                  dataSource={selectedItems}
                  locale={{ emptyText: <Empty description="No tests added yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={item => (
                      <List.Item
                          actions={[<Button danger icon={<DeleteOutlined />} type="text" onClick={() => handleRemoveItem(item._id)} />]}
                      >
                          <List.Item.Meta
                              avatar={<Avatar icon={<MedicineBoxOutlined />} style={{ backgroundColor: item.type === 'Package' ? '#87d068' : '#1890ff' }} />}
                              title={item.name}
                              description={item.type}
                          />
                          <div>₹{item.price}</div>
                      </List.Item>
                  )}
              />
          </Card>

          {/* --- 3. PAYMENT --- */}
          <Card title="Payment" size="small">
              <Row gutter={16} align="middle">
                  <Col span={12}>
                      <Title level={4} style={{ margin: 0 }}>Total Payble: ₹{totalAmount}</Title>
                  </Col>
                  <Col span={12}>
                      <Form.Item name="paymentMode" label="Payment Mode" initialValue="Cash" style={{ marginBottom: 0 }}>
                          <Select>
                              <Option value="Cash">Cash</Option>
                              <Option value="UPI">UPI</Option>
                              <Option value="Card">Card</Option>
                          </Select>
                      </Form.Item>
                  </Col>
              </Row>
          </Card>

        </Form>
      </Drawer>

      {/* --- CREATE PATIENT MODAL --- */}
      <CreatePatientModal 
        open={isPatientModalOpen} 
        onCancel={() => setIsPatientModalOpen(false)}
        onSuccess={handleNewPatientCreated}
      />
    </>
  );
};

export default CreateOrderDrawer;