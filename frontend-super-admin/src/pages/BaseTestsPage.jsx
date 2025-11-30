import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Tooltip,
  Modal,
  message,
  Select,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  SearchOutlined
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import BaseTestForm from "../components/BaseTestForm";
import {
  getAllBaseTests,
  createBaseTest,
  updateBaseTest,
  deleteBaseTest,
} from "../redux/apiCalls";

const { confirm } = Modal;
const { Option } = Select;

const BaseTestsPage = () => {
  const dispatch = useDispatch();

  // Redux Data
  const { tests, isFetching, pagination } = useSelector((state) => state[process.env.REACT_APP_BASETESTS_DATA_KEY]);

  // Local State
  const [searchText, setSearchText] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // --- DEBOUNCE LOGIC ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchText);
    }, 400); // 400ms delay
    return () => clearTimeout(timer);
  }, [searchText]);

  // --- FETCH LOGIC ---
  useEffect(() => {
    // Fetch when: Component Mounts OR Search Term Changes OR Department Filter Changes
    // We pass Page 1 to reset to the first page on new search filters
    getAllBaseTests(dispatch, 1, pagination.limit || 20, debouncedTerm, departmentFilter);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTerm, departmentFilter]);

  // Handle Table Page Change
  const handleTableChange = (newPagination) => {
    getAllBaseTests(dispatch, newPagination.current, newPagination.pageSize, debouncedTerm, departmentFilter);
  };

  // Handle Input Typing
  const handleSearchInput = (e) => {
    setSearchText(e.target.value);
  };

  const handleDepartmentChange = (value) => {
    setDepartmentFilter(value);
    // Effect will trigger fetch
  };

  // --- CRUD Handlers ---
  const handleRefresh = () => {
    getAllBaseTests(dispatch, pagination.page, pagination.limit, debouncedTerm, departmentFilter);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    setIsDrawerOpen(true);
  };

  const handleDelete = (record) => {
    confirm({
      title: "Delete Test?",
      content: `Are you sure you want to delete ${record.name} (${record.code})?`,
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        const res = await deleteBaseTest(record._id);
        if (res.status === 200) {
          message.success("Test deleted successfully");
          handleRefresh();
        } else {
          message.error(res.message);
        }
      },
    });
  };

  const handleFormSubmit = async (values) => {
    setFormLoading(true);
    if (editingItem) {
      const res = await updateBaseTest(editingItem._id, values);
      if (res.status === 200) {
        message.success("Test updated successfully");
        setIsDrawerOpen(false);
        handleRefresh();
      } else {
        message.error(res.message);
      }
    } else {
      const res = await createBaseTest(values);
      if (res.status === 201) {
        message.success("Test created successfully");
        setIsDrawerOpen(false);
        handleRefresh(); // Should reset to page 1 ideally, but current page refresh works too
      } else {
        message.error(res.message);
      }
    }
    setFormLoading(false);
  };

  const columns = [
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      width: 100,
      render: (text) => <Tag color="geekblue">{text}</Tag>,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <span>
          <b>{text}</b>
          {record.alias && <div style={{ fontSize: "12px", color: "#888" }}>AKA: {record.alias}</div>}
        </span>
      ),
    },
    {
      title: "Category",
      key: "category",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.department === "Radiology" ? "purple" : "cyan"}>{record.department}</Tag>
          <span style={{ fontSize: "12px" }}>{record.category}</span>
        </Space>
      ),
    },
    {
      title: "Type",
      key: "type",
      render: (_, record) => (
        <span>
          {record.isDescriptive ? (
            <Tooltip title="Descriptive Report (Template)">
              <FileTextOutlined style={{ color: "orange", marginRight: 5 }} /> Descriptive
            </Tooltip>
          ) : (
            <Tooltip title="Parameter Based">
              <ExperimentOutlined style={{ color: "green", marginRight: 5 }} /> Parameters: {record.parameters?.length || 0}
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: "Specimen",
      dataIndex: "specimenType",
      key: "specimenType",
      responsive: ["md"],
    },
    {
      title: "Action",
      key: "action",
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <Space>
          <h2 style={{ margin: 0 }}>Base Test Catalog</h2>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
        </Space>
        
        <Space style={{ flexWrap: "wrap" }}>
          <Select 
            placeholder="Filter Dept" 
            style={{ width: 120 }} 
            allowClear 
            onChange={handleDepartmentChange}
          >
            <Option value="Pathology">Pathology</Option>
            <Option value="Radiology">Radiology</Option>
            <Option value="Cardiology">Cardiology</Option>
            <Option value="Other">Other</Option>
          </Select>
          
          {/* Updated Search Input */}
          <Input
            placeholder="Search code, name, alias..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchText}
            onChange={handleSearchInput}
            style={{ width: 250 }}
            allowClear
          />
          
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Add Test
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={tests}
        rowKey="_id"
        loading={isFetching}
        onChange={handleTableChange}
        scroll={{ x: 800 }}
        pagination={{
          current: pagination?.page,
          pageSize: pagination?.limit,
          total: pagination?.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} tests`
        }}
      />

      <BaseTestForm
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleFormSubmit}
        initialValues={editingItem}
        loading={formLoading}
      />
    </div>
  );
};

export default BaseTestsPage;