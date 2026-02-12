import React, { useState, useEffect } from "react";
import { Table, Input, Button, Card, Tag, Modal, Form, InputNumber, message, Row, Col, Empty,Divider,Select,Checkbox } from "antd";
import { SearchOutlined, PlusOutlined, ExperimentOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { searchMasterCatalog, addTestFromMaster } from "../redux/apiCalls";
import CustomTestDrawer from "./CustomTestDrawer";

const { Search } = Input;
const { Option } = Select;

const MasterCatalog = () => {
  const dispatch = useDispatch();
  // Get Data & Pagination from Redux
  const { masterTests, masterPagination, isFetching, tests } = useSelector(
      (state) => state[process.env.REACT_APP_TESTS_DATA_KEY] || state.test
  );
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [isCustomDrawerOpen, setIsCustomDrawerOpen] = useState(false);
  
  // --- SEARCH & PAGINATION STATE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [form] = Form.useForm();

  // 1. Debounce Logic: Update 'debouncedTerm' after 500ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Fetch Logic: Runs when Debounced Term OR Page/Size Changes
  useEffect(() => {
    // Rule: 
    // - If Empty: Fetch All (Page 1)
    // - If 1 char: Skip
    // - If 2+ chars: Fetch Search
    if (debouncedTerm.length === 1) return;

    searchMasterCatalog(dispatch, debouncedTerm, currentPage, pageSize);
  }, [debouncedTerm, currentPage, pageSize, dispatch]);

  // 3. Reset Page on new Search
  const handleSearchInput = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to page 1 when typing starts
  };

  const handleTableChange = (pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  };

  // --- CRUD Logic (Unchanged) ---
  const isAlreadyAdded = (baseTestId) => {
    return tests.some((t) => t.baseTestId === baseTestId);
  };

const openAddModal = (record) => {
    setSelectedTest(record);
    form.setFieldsValue({
        price: 0,
        tat: "",
        customCode: record.code, 
        alias: "",
        // --- NEW FIELDS DEFAULTS ---
        processingLocation: "In-house",
        homeCollectionAvailable: false,
        fastingRequired: false,
        fastingDuration: null,
        dailyLimit: null
    });
    setIsModalOpen(true);
};
  const handleAddSubmit = async (values) => {
    const payload = {
      baseTestId: selectedTest._id,
      ...values,
    };

    const res = await addTestFromMaster(dispatch, payload);
    if (res.status === 201) {
      message.success(`${selectedTest.name} added to your list!`);
      setIsModalOpen(false);
      form.resetFields();
    } else {
      message.error(res.message || "Failed to add test.");
    }
  };

  const columns = [
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      render: (text) => <Tag>{text}</Tag>,
    },
    {
      title: "Test Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <b>{text}</b>,
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
    },
    {
      title: "Specimen",
      dataIndex: "specimenType",
      key: "specimenType",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => {
        const added = isAlreadyAdded(record._id);
        return (
          <Button
            type={added ? "dashed" : "primary"}
            icon={added ? null : <PlusOutlined />}
            disabled={added}
            onClick={() => openAddModal(record)}
          >
            {added ? "Added" : "Add to List"}
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Card 
        title="Master Test Catalog" 
        style={{ marginBottom: 20 }}
        extra={
            <Button icon={<PlusOutlined />} onClick={() => setIsCustomDrawerOpen(true)}>
                Create Custom Test
            </Button>
        }
      >
        <Input
          placeholder="Search test name, code, or category..."
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          size="large"
          value={searchTerm}
          onChange={handleSearchInput}
          allowClear
          style={{ borderRadius: '6px' }}
        />
        <div style={{ marginTop: 10, color: "#666", fontSize: '12px' }}>
          <small>
             {searchTerm.length === 0 
                ? "Showing all available tests from the master database." 
                : "Searching... (Results appear after 2 characters)"}
          </small>
        </div>
      </Card>

      {/* Table handles both Results and 'No Data' state automatically via dataSource */}
      <Table
        columns={columns}
        dataSource={masterTests}
        rowKey="_id"
        loading={isFetching}
        pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: masterPagination?.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} tests`
        }}
        onChange={handleTableChange}
        size="small"
        locale={{
            emptyText: (
                <Empty
                    image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg"
                    imageStyle={{ height: 60 }}
                    description={
                        <span>
                            No tests found. <br/>
                            Need something specific?
                        </span>
                    }
                >
                    <Button type="primary" icon={<ExperimentOutlined />} onClick={() => setIsCustomDrawerOpen(true)}>
                        Create Custom Test
                    </Button>
                </Empty>
            )
        }}
      />

      {/* Add from Master Modal */}
      <Modal
  title={`Add ${selectedTest?.name}`}
  open={isModalOpen}
  onCancel={() => setIsModalOpen(false)}
  onOk={form.submit}
  okText="Add Test"
  width={700} // Increased width slightly to fit new fields
>
  <Form layout="vertical" form={form} onFinish={handleAddSubmit}>
    <Divider orientation="left" style={{ margin: '10px 0' }}>Basic Info</Divider>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="price" label="Your Price" rules={[{ required: true }]}>
          <InputNumber style={{ width: "100%" }} min={0} prefix="₹" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="customCode" label="Test Code">
          <Input placeholder="Leave default or change" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="tat" label="Turnaround Time (TAT hours)">
          <InputNumber style={{ width: "100%" }} min={0} placeholder="e.g. 24" />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="alias" label="Alias (Optional)">
          <Input placeholder="Alt Name" />
        </Form.Item>
      </Col>
    </Row>

    <Divider orientation="left" style={{ margin: '10px 0' }}>Operational Details</Divider>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item name="processingLocation" label="Processing Location">
          <Select>
            <Option value="In-house">In-house</Option>
            <Option value="Outsourced">Outsourced</Option>
          </Select>
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item name="dailyLimit" label="Daily Limit (Optional)">
          <InputNumber style={{ width: "100%" }} min={1} placeholder="Leave blank for unlimited" />
        </Form.Item>
      </Col>
    </Row>
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item name="homeCollectionAvailable" valuePropName="checked">
          <Checkbox>Home Collection</Checkbox>
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="fastingRequired" valuePropName="checked">
          <Checkbox>Fasting Required</Checkbox>
        </Form.Item>
      </Col>
      
      {/* Dependency: Only show duration if fasting is required */}
      <Form.Item noStyle shouldUpdate={(prev, current) => prev.fastingRequired !== current.fastingRequired}>
        {({ getFieldValue }) => 
          getFieldValue("fastingRequired") ? (
            <Col span={8}>
              <Form.Item name="fastingDuration" label="Fasting Hours" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} style={{ width: "100%" }} placeholder="e.g. 12" />
              </Form.Item>
            </Col>
          ) : null
        }
      </Form.Item>
    </Row>
  </Form>
</Modal>

      {/* Custom Test Creation Drawer */}
      <CustomTestDrawer 
        open={isCustomDrawerOpen} 
        onClose={() => setIsCustomDrawerOpen(false)} 
      />

    </div>
  );
};

export default MasterCatalog;