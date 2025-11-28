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
  Spin,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import InstitutionForm from "../components/InstitutionForm";
import {
  getAllInstitutions,
  createInstitution,
  deactivateInstitution,
  editInstitution,
  deleteInstitution,
  activateInstitution,
} from "../redux/apiCalls";

const { Search } = Input;
const { confirm } = Modal;

const InstitutionsPage = () => {
  const dispatch = useDispatch();

  // --- FIXED SELECTOR ---
  // We select the whole slice ("state.institution"), NOT "state.institution.institutions"
  // Make sure 'institution' matches the key you used in store.js combineReducers
  const institutionSlice = useSelector((state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY]);

  // --- DESTRUCTURING ---
  // Now we can safely extract the array, fetching status, and pagination from the slice
  const {
    institutions = [],
    isFetching = false,
    pagination = { current: 1, pageSize: 10, total: 0 },
  } = institutionSlice || {};

  const [searchText, setSearchText] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    // Check if the slice exists and if the list is empty
    if (!institutionSlice || institutions.length === 0) {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = (page = 1, limit = 10, search = searchText) => {
    getAllInstitutions(dispatch, page, limit, search);
  };

  const handleTableChange = (newPagination) => {
    handleRefresh(newPagination.current, newPagination.pageSize, searchText);
  };

  const handleSearch = (value) => {
    setSearchText(value);
    handleRefresh(1, pagination.pageSize, value);
  };

  // --- CRUD Operations ---

  const handleAdd = () => {
    setEditingItem(null);
    setIsDrawerOpen(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    setIsDrawerOpen(true);
  };


   const handleActivate = (record) => {
    confirm({
      title: "Activate Institution?",
      content: `Are you sure you want to activate ${record.institutionName}?`,
      okText: "Yes, Activate",
      okType: "danger",
      onOk: async () => {
        const res = await activateInstitution(record.institutionId);
        if (res.status === 200) {
          message.success("Institution activated successfully");
          handleRefresh(pagination.current, pagination.pageSize, searchText);
        } else {
          message.error(res.message);
        }
      },
    });
  };

  const handleDeactivate = (record) => {
    confirm({
      title: "Deactivate Institution?",
      content: `Are you sure you want to deactivate ${record.institutionName}?`,
      okText: "Yes, Deactivate",
      okType: "danger",
      onOk: async () => {
        const res = await deactivateInstitution(record.institutionId);
        if (res.status === 200) {
          message.success("Institution deactivated successfully");
          handleRefresh(pagination.current, pagination.pageSize, searchText);
        } else {
          message.error(res.message);
        }
      },
    });
  };

  const handleDelete = (record) => {
    confirm({
      title: "Delete Institution?",
      content: `This will PERMANENTLY delete ${record.institutionName} and its database.`,
      okText: "Delete Permanently",
      okType: "danger",
      onOk: async () => {
        const res = await deleteInstitution(record.institutionId);
        if (res.status === 200) {
          message.success("Institution deleted successfully");
          handleRefresh(pagination.current, pagination.pageSize, searchText);
        } else {
          message.error(res.message);
        }
      },
    });
  };

  const handleFormSubmit = async (values) => {
    console.log(editingItem)
    setFormLoading(true);
    if (editingItem) {
      const res = await editInstitution(editingItem.institutionId,values);
      console.log(res)
      if (res.status === 200) {
        message.success("Institution updated successfully!");
        setIsDrawerOpen(false);
        handleRefresh(1, pagination.pageSize, searchText);
      } else {
        message.error(res.message);
      }
    } else {
      const res = await createInstitution(values);
      if (res.status === 201) {
        message.success("Institution created successfully!");
        setIsDrawerOpen(false);
        handleRefresh(1, pagination.pageSize, searchText);
      } else {
        message.error(res.message);
      }
    }
    setFormLoading(false);
  };

  // --- Columns ---
  const columns = [
    {
      title: "Name",
      dataIndex: "institutionName",
      key: "institutionName",
      render: (text) => <b>{text}</b>,
    },
    {
      title: "Code",
      dataIndex: "institutionCode",
      key: "institutionCode",
    },
    {
      title: "Domain",
      dataIndex: "primaryDomain",
      key: "primaryDomain",
      render: (text) => (
        <a href={`http://${text}`} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      ),
    },
    {
      title: "Plan",
      dataIndex: ["subscription", "type"],
      key: "plan",
      render: (type) => <Tag color="blue">{type?.toUpperCase()}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={status ? "green" : "red"}>
          {status ? "ACTIVE" : "INACTIVE"}
        </Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="Edit Details">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>

          {record.status && (
            <Tooltip title="Deactivate">
              <Button
                type="text"
                danger
                icon={<StopOutlined />}
                onClick={() => handleDeactivate(record)}
              />
            </Tooltip>
          )}

          {!record.status && (
            <Tooltip title="Activate">
              <Button
                type="text"
                variant = "text" 
                color = "green"
                icon={<CheckCircleOutlined/>}
                onClick={() => handleActivate(record)}
              />
            </Tooltip>
          )}

          <Tooltip title="Delete Permanently">
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

  // Loader if slice is not yet initialized
  if (!institutionSlice) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <Space>
          <h2 style={{ margin: 0 }}>Institutions</h2>
          <Search
            placeholder="Search..."
            onSearch={handleSearch}
            style={{ width: 300 }}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() =>
              handleRefresh(pagination.current, pagination.pageSize, searchText)
            }
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Institution
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={institutions}
        rowKey="institutionId"
        loading={isFetching}
        onChange={handleTableChange}
        scroll={{ x: 800 }}
        pagination={{
          current: pagination.page, // Note: Redux stores 'page', AntD expects 'current'
          pageSize: pagination.limit,
          total: pagination.total,
        }}
      />

      <InstitutionForm
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleFormSubmit}
        initialValues={editingItem}
        loading={formLoading}
      />
    </div>
  );
};

export default InstitutionsPage;