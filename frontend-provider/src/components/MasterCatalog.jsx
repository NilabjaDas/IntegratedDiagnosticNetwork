import React, { useState } from "react";
import { Table, Input, Button, Card, Tag, Modal, Form, InputNumber, message, Row, Col, Empty } from "antd";
import { SearchOutlined, PlusOutlined, ExperimentOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { searchMasterCatalog, addTestFromMaster } from "../redux/apiCalls";
import CustomTestDrawer from "./CustomTestDrawer";

const { Search } = Input;

const MasterCatalog = () => {
  const dispatch = useDispatch();
  const { masterTests, isFetching, tests } = useSelector((state) => state[process.env.REACT_APP_TESTS_DATA_KEY]);
  
  // State for Add from Master Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  
  // State for Create Custom Drawer
  const [isCustomDrawerOpen, setIsCustomDrawerOpen] = useState(false);
  
  // Track if a search has been performed
  const [hasSearched, setHasSearched] = useState(false);
  const [form] = Form.useForm();

  // Check if test is already added to avoid duplicates
  const isAlreadyAdded = (baseTestId) => {
    return tests.some((t) => t.baseTestId === baseTestId);
  };

  const handleSearch = (value) => {
    if (value.trim()) {
      setHasSearched(true);
      searchMasterCatalog(dispatch, value);
    }
  };

  const openAddModal = (record) => {
    setSelectedTest(record);
    form.setFieldsValue({
      price: 0,
      tat: "",
      customCode: record.code, 
      alias: "",
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
        title="Search Global Database" 
        style={{ marginBottom: 20 }}
        extra={
            <Button icon={<PlusOutlined />} onClick={() => setIsCustomDrawerOpen(true)}>
                Create Custom Test
            </Button>
        }
      >
        <Search
          placeholder="Type test name (e.g. CBC, Lipid Profile)..."
          enterButton={<SearchOutlined />}
          size="large"
          onSearch={handleSearch}
          loading={isFetching}
        />
        <div style={{ marginTop: 10, color: "#666" }}>
          <small>Search the master catalog. If you can't find what you need, create a custom test.</small>
        </div>
      </Card>

      {/* Results Table */}
      {masterTests.length > 0 ? (
        <Table
          columns={columns}
          dataSource={masterTests}
          rowKey="_id"
          pagination={false}
          size="small"
        />
      ) : (
        /* Show Empty State if searched but no results */
        hasSearched && !isFetching && (
            <Empty
                image="https://gw.alipayobjects.com/zos/antfincdn/ZHrcdLPrvN/empty.svg"
                imageStyle={{ height: 60 }}
                description={
                    <span>
                        No matches found in global catalog. <br/>
                        Need a specific test?
                    </span>
                }
            >
                <Button type="primary" icon={<ExperimentOutlined />} onClick={() => setIsCustomDrawerOpen(true)}>
                    Create Custom Test Now
                </Button>
            </Empty>
        )
      )}

      {/* Add from Master Modal */}
      <Modal
        title={`Add ${selectedTest?.name}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={form.submit}
        okText="Add Test"
      >
        <Form layout="vertical" form={form} onFinish={handleAddSubmit}>
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
              <Form.Item name="tat" label="Turnaround Time (TAT)">
                <Input placeholder="e.g. 4 Hours" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="alias" label="Alias (Optional)">
                <Input placeholder="Alt Name" />
              </Form.Item>
            </Col>
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