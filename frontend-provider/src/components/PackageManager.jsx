import React, { useState } from "react";
import {
  Table,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  message,
  Card,
  Row,
  Col,
  Divider,
  Statistic
} from "antd";
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  GiftOutlined,
  ManOutlined,
  WomanOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createPackage, updatePackage, deletePackage } from "../redux/apiCalls";

const { Option } = Select;
const { TextArea } = Input;

const PackageManager = () => {
  const dispatch = useDispatch();
  
  // Use your env key or default to 'test' slice based on your setup
  const { packages, tests, isFetching } = useSelector((state) => 
    state[process.env.REACT_APP_TESTS_DATA_KEY]
  );

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  // Helper to calculate total price of selected tests
  const [selectedTestsCost, setSelectedTestsCost] = useState(0);

  const handleTestsChange = (selectedIds) => {
    const total = tests
      .filter((t) => selectedIds.includes(t._id))
      .reduce((sum, t) => sum + (t.price || 0), 0);
    setSelectedTestsCost(total);
  };

  const handleOpenDrawer = (item = null) => {
    setEditingItem(item);
    if (item) {
      // Edit Mode
      // Ensure we treat 'tests' as IDs whether they are populated objects or just strings
      const ids = item.tests.map((t) => t._id || t);
      
      form.setFieldsValue({
        ...item,
        testIds: ids, 
        offerPrice: item.offerPrice 
      });
      
      handleTestsChange(ids);
    } else {
      // Add Mode
      form.resetFields();
      form.setFieldsValue({
        targetGender: "Both",
        isActive: true
      });
      setSelectedTestsCost(0);
    }
    setIsDrawerOpen(true);
  };

  const handleSubmit = async (values) => {
    const payload = {
      ...values,
      actualPrice: selectedTestsCost,
    };

    if (editingItem) {
      const res = await updatePackage(dispatch, editingItem._id, payload);
      if (res && res.status === 200) {
        message.success("Package updated successfully!");
        setIsDrawerOpen(false);
      } else {
        message.error("Update failed.");
      }
    } else {
      const res = await createPackage(dispatch, payload);
      if (res && res.status === 201) {
        message.success("Package created successfully!");
        setIsDrawerOpen(false);
      } else {
        message.error(res?.message || "Creation failed.");
      }
    }
  };

  const handleDelete = (id) => {
    deletePackage(dispatch, id);
  };

  const columns = [
    {
      title: "Package Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <span>
          <GiftOutlined style={{ color: "#faad14", marginRight: 8 }} />
          <b>{text}</b>
          <br />
          <small style={{ color: "#888" }}>{record.code} | {record.category}</small>
        </span>
      ),
    },
    {
      title: "Targeting",
      key: "targeting",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color="geekblue">{record.targetGender}</Tag>
          <span style={{ fontSize: "12px" }}>{record.ageGroup}</span>
        </Space>
      ),
    },
    {
      title: "Content",
      dataIndex: "tests",
      key: "tests",
      maxWidth: 300,
      render: (pkgTests) => (
        <div style={{ maxHeight: '60px', overflowY: 'auto' }}>
          <Space wrap>
            {pkgTests && pkgTests.map((t) => {
              // 1. Get the ID (handle both populated object and direct ID string)
              const testId = t._id || t;
              
              // 2. Lookup the full test details from the Redux 'tests' list
              const fullTest = tests.find(item => item._id === testId);

              return (
                <Tag key={testId}>
                  {fullTest ? fullTest.name : "Unknown Test"}
                </Tag>
              );
            })}
          </Space>
        </div>
      ),
    },
    {
      title: "Offer Price",
      dataIndex: "offerPrice",
      key: "offerPrice",
      render: (price) => <b style={{ color: "green" }}>₹ {price}</b>,
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleOpenDrawer(record)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenDrawer()}>
          Create New Package
        </Button>
      </div>

      <Table
        dataSource={packages}
        columns={columns}
        rowKey="_id"
        loading={isFetching}
        pagination={{ pageSize: 8 }}
      />

      <Drawer
        title={editingItem ? "Edit Package" : "Create New Package"}
        width={720}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        bodyStyle={{ paddingBottom: 80 }}
        extra={
          <Space>
            <Button onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={form.submit}>
              {editingItem ? "Update" : "Create"}
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          
          <Divider orientation="left">Basic Information</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Package Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Senior Citizen Wellness" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="code" label="Code">
                <Input placeholder="Auto" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="category" label="Category">
                <Input placeholder="e.g. Cardiac" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="targetGender" label="Target Gender">
                <Select>
                  <Option value="Both"><TeamOutlined /> Both</Option>
                  <Option value="Male"><ManOutlined /> Male</Option>
                  <Option value="Female"><WomanOutlined /> Female</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ageGroup" label="Age Group">
                <Input placeholder="e.g. 40+ Years, Kids" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Tests & Pricing</Divider>
          <Form.Item
            name="testIds"
            label="Included Tests"
            rules={[{ required: true, message: "Select at least one test" }]}
          >
            <Select
              mode="multiple"
              placeholder="Search and select tests to bundle"
              optionFilterProp="children"
              onChange={handleTestsChange}
              style={{ width: '100%' }}
            >
              {tests?.map((t) => (
                <Option key={t._id} value={t._id}>
                  {t.name} ({t.code}) - ₹{t.price}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16} align="middle">
            <Col span={12}>
               <Card size="small" style={{ background: "#f5f5f5", textAlign: "center" }}>
                  <Statistic 
                    title="Actual Value (Sum of Tests)" 
                    value={selectedTestsCost} 
                    precision={2} 
                    prefix="₹"
                    valueStyle={{ color: '#cf1322', textDecoration: 'line-through' }}
                  />
               </Card>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="offerPrice" 
                label="Offer Price (Final Cost)" 
                rules={[{ required: true, message: "Please set the package price" }]}
              >
                <InputNumber 
                  style={{ width: "100%", height: "50px", fontSize: "20px", paddingTop: "8px" }} 
                  min={0} 
                  prefix="₹" 
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Instructions & Details</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="precautions" label="Patient Preparations">
                <Input placeholder="e.g. 12 Hours Fasting Required" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tat" label="Report TAT">
                <Input placeholder="e.g. 24 Hours" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="image" label="Image URL (Optional)">
             <Input prefix={<GiftOutlined />} placeholder="http://example.com/banner.png" />
          </Form.Item>

          <Form.Item name="description" label="Marketing Description">
            <TextArea rows={4} placeholder="Describe the benefits of this package..." />
          </Form.Item>

        </Form>
      </Drawer>
    </div>
  );
};

export default PackageManager;