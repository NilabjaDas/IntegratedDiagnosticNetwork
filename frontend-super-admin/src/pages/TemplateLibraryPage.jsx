import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Table, Button, Space, Tag, Input, Popconfirm, Select, message, Empty } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, FilePdfOutlined } from "@ant-design/icons";
import { useSelector, useDispatch } from "react-redux";
import { getAllTemplates, deleteTemplate } from "../redux/apiCalls";
import TemplateEditorDrawer from "../components/TemplateEditorDrawer";

const Container = styled.div`
  padding: 24px;
  background: #f0f2f5;
  min-height: 100vh;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  h1 {
    margin: 0;
    font-size: 24px;
    color: #333;
  }
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 10px;
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
`;

const TemplateLibraryPage = () => {
  const dispatch = useDispatch();
  
  // Access Redux State (Using the environment variable key pattern)
  // Ensure 'template' is registered in your store.js with this key
  const { templates, pagination, isFetching } = useSelector(
    (state) => state[process.env.REACT_APP_BASETEMPLATES_DATA_KEY] || state.template || { templates: [], pagination: { page: 1, limit: 10, total: 0 } }
  );

  // Local State
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  
  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // Debounce Logic
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Fetch Logic
  const fetchData = (page = 1, limit = 10) => {
    getAllTemplates(
        dispatch, 
        page, 
        limit, 
        debouncedSearch, 
        typeFilter
    );
  };

  useEffect(() => {
    fetchData(pagination?.page, pagination?.limit);
    // eslint-disable-next-line
  }, [debouncedSearch, typeFilter, dispatch]);

  // Handlers
  const handleDelete = async (id) => {
    const res = await deleteTemplate(dispatch, id);
    if (res.status === 200) {
        message.success("Template deleted");
        // Refresh current page
        fetchData(pagination.page, pagination.limit);
    } else {
        message.error("Failed to delete");
    }
  };

  const handleTableChange = (newPagination) => {
     fetchData(newPagination.current, newPagination.pageSize);
  };

  const handleCreate = () => {
      setSelectedTemplateId(null);
      setIsDrawerOpen(true);
  };

  const handleEdit = (id) => {
      setSelectedTemplateId(id);
      setIsDrawerOpen(true);
  };

  const handleDrawerSuccess = () => {
      // Refresh data after save
      fetchData(1, pagination.limit); // Go to page 1 to see new item
  };

  const columns = [
    {
      title: "Template Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type) => {
        let color = "default";
        let icon = null;
        if (type === "BILL") { color = "blue"; icon = <FilePdfOutlined />; }
        if (type === "LAB_REPORT") { color = "green"; icon = <FilePdfOutlined />; }
        if (type === "PRESCRIPTION") { color = "purple"; icon = <FilePdfOutlined />; }
        return (
            <Tag color={color} icon={icon}>
                {type.replace("_", " ")}
            </Tag>
        );
      },
    },
    {
      title: "Size",
      dataIndex: "pageSize",
      key: "pageSize",
      width: 100,
    },
    {
      title: "Defaults",
      key: "isDefault",
      render: (_, record) => record.isDefault && <Tag color="cyan">Default</Tag>
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record._id)}
          />
          <Popconfirm 
            title="Delete Template"
            description="Are you sure? This might affect institutions using it."
            onConfirm={() => handleDelete(record._id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Container>
      <HeaderRow>
        <h1>Template Library</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={handleCreate}
        >
          Create New Template
        </Button>
      </HeaderRow>

      <Toolbar>
        <Space size="middle">
          <Input
            placeholder="Search by name..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="Filter Type"
            allowClear
            onChange={setTypeFilter}
            style={{ width: 180 }}
          >
            <Select.Option value="BILL">Bill / Invoice</Select.Option>
            <Select.Option value="LAB_REPORT">Lab Report</Select.Option>
            <Select.Option value="PRESCRIPTION">Prescription</Select.Option>
          </Select>
        </Space>
      </Toolbar>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="_id"
        loading={isFetching}
        pagination={{
          current: pagination?.page || 1,
          pageSize: pagination?.limit || 10,
          total: pagination?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} templates`
        }}
        onChange={handleTableChange}
        locale={{ emptyText: <Empty description="No Templates Found" /> }}
        bordered
        size="middle"
        scroll={{ x: 800 }}
        style={{ background: 'white', borderRadius: 8 }}
      />

      {/* The Drawer for Create/Edit */}
      <TemplateEditorDrawer
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        templateId={selectedTemplateId}
        onSuccess={handleDrawerSuccess}
      />
    </Container>
  );
};

export default TemplateLibraryPage;