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
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import BaseTestForm from "../components/BaseTestForm";
import {
  getAllBaseTests,
  createBaseTest,
  updateBaseTest,
  deleteBaseTest,
} from "../redux/apiCalls";

const { Search } = Input;
const { confirm } = Modal;
const { Option } = Select;

const BaseTestsPage = () => {
  const dispatch = useDispatch();

  // Make sure 'baseTest' matches the key you used in store.js
  const { tests, isFetching, pagination } = useSelector((state) => state[process.env.REACT_APP_BASETESTS_DATA_KEY]);

  const [searchText, setSearchText] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = (page = 1, limit = 20) => {
    getAllBaseTests(dispatch, page, limit, searchText, departmentFilter);
  };

  const handleTableChange = (newPagination) => {
    handleRefresh(newPagination.current, newPagination.pageSize);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    getAllBaseTests(dispatch, 1, pagination.limit, value, departmentFilter);
  };

  const handleDepartmentChange = (value) => {
    setDepartmentFilter(value);
    getAllBaseTests(dispatch, 1, pagination.limit, searchText, value);
  };

  // --- CRUD ---

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
          handleRefresh(pagination.page, pagination.limit);
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
        handleRefresh(pagination.page, pagination.limit);
      } else {
        message.error(res.message);
      }
    } else {
      const res = await createBaseTest(values);
      if (res.status === 201) {
        message.success("Test created successfully");
        setIsDrawerOpen(false);
        handleRefresh(1, pagination.limit);
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
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
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
          <Button icon={<ReloadOutlined />} onClick={() => handleRefresh(pagination.page, pagination.limit)} />
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
          <Search
            placeholder="Search code or name..."
            onSearch={handleSearch}
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