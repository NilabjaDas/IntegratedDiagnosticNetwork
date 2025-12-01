import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Table, Button, Space, Tag, Input, Popconfirm, Select, Modal } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import { userRequest } from "../requestMethods";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Container = styled.div`
  padding: 20px;
`;

const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 10px;
`;

const TemplateLibraryPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState(null);

  const token = useSelector((state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]?.token);
  const navigate = useNavigate();

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      let url = `/admin-templates?page=${page}&limit=${limit}`;
      if (searchText) url += `&search=${searchText}`;
      if (typeFilter) url += `&type=${typeFilter}`;

      const res = await userRequest(token).get(url);
      setTemplates(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error("Failed to load templates");
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, [page, limit, searchText, typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id) => {
    try {
      await userRequest(token).delete(`/admin-templates/${id}`);
      toast.success("Template deleted");
      fetchTemplates();
    } catch (err) {
      toast.error("Failed to delete template");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
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
      render: (type) => <Tag color={type === "BILL" ? "blue" : "green"}>{type}</Tag>,
    },
    {
      title: "Page Size",
      dataIndex: "pageSize",
      key: "pageSize",
    },
    {
      title: "Variables",
      dataIndex: "variables",
      key: "variables",
      render: (vars) => <span>{vars?.length || 0}</span>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/template-editor/${record._id}`)}
          />
          <Popconfirm title="Delete this template?" onConfirm={() => handleDelete(record._id)}>
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Container>
      <h1>Template Library</h1>
      <Toolbar>
        <Space>
          <Input
            placeholder="Search templates..."
            prefix={<SearchOutlined />}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
          <Select
            placeholder="Filter by Type"
            allowClear
            onChange={setTypeFilter}
            style={{ width: 150 }}
          >
            <Select.Option value="BILL">Bill</Select.Option>
            <Select.Option value="LAB_REPORT">Lab Report</Select.Option>
            <Select.Option value="PRESCRIPTION">Prescription</Select.Option>
          </Select>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/template-editor/new")}
        >
          Create Template
        </Button>
      </Toolbar>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: limit,
          total: total,
          onChange: (p, l) => {
            setPage(p);
            setLimit(l);
          }
        }}
      />
    </Container>
  );
};

export default TemplateLibraryPage;
