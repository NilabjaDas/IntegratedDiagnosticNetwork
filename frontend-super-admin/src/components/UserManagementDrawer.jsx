import React, { useEffect, useState } from "react";
import {
  Drawer,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Tooltip,
  message,
  Popconfirm,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined
} from "@ant-design/icons";
import {
  getInstitutionUsers,
  createInstitutionUser,
  updateInstitutionUser,
  deleteInstitutionUser
} from "../redux/apiCalls";

const { Option } = Select;

const UserManagementDrawer = ({ open, onClose, institution }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const [form] = Form.useForm();

  // Fetch users when drawer opens
  useEffect(() => {
    if (open && institution?.institutionId) {
      fetchUsers();
    } else {
      setUsers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, institution]);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await getInstitutionUsers(institution.institutionId);
    if (res.status === 200) {
      setUsers(res.data);
    } else {
      message.error(res.message);
    }
    setLoading(false);
  };

  // --- Modal / Form Handlers ---

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    // Default values
    form.setFieldsValue({
      isActive: true,
      role: "admin"
    });
    setIsModalOpen(true);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    form.resetFields();
    form.setFieldsValue({
      ...user,
      password: "" // Don't show hash, allow blank to keep current
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (userId) => {
    const res = await deleteInstitutionUser(institution.institutionId, userId);
    if (res.status === 200) {
      message.success("User deleted");
      fetchUsers();
    } else {
      message.error(res.message);
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setModalLoading(true);

      let res;
      if (editingUser) {
        // Update
        res = await updateInstitutionUser(institution.institutionId, editingUser.userId, values);
      } else {
        // Create
        res = await createInstitutionUser(institution.institutionId, values);
      }

      if (res.status === 200 || res.status === 201) {
        message.success(editingUser ? "User updated" : "User created");
        setIsModalOpen(false);
        fetchUsers();
      } else {
        message.error(res.message);
      }
    } catch (info) {
      console.log("Validate Failed:", info);
    } finally {
      setModalLoading(false);
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "fullName",
      key: "fullName",
      render: (text) => <b>{text}</b>
    },
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role) => <Tag color="blue">{role.toUpperCase()}</Tag>
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (active) => (
        <Tag color={active ? "green" : "red"}>{active ? "ACTIVE" : "INACTIVE"}</Tag>
      )
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button 
              icon={<EditOutlined />} 
              size="small" 
              onClick={() => handleEdit(record)} 
            />
          </Tooltip>
          <Popconfirm 
            title="Are you sure?" 
            onConfirm={() => handleDelete(record.userId)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      <Drawer
        title={`Users: ${institution?.institutionName || ""}`}
        width={720}
        onClose={onClose}
        open={open}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Add User
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="userId"
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </Drawer>

      <Modal
        title={editingUser ? "Edit User" : "Add New User"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleModalSubmit}
        confirmLoading={modalLoading}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="fullName"
            label="Full Name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="John Doe" />
          </Form.Item>

          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input placeholder="johndoe" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="password"
            label={editingUser ? "Password (leave blank to keep current)" : "Password"}
            rules={[{ required: !editingUser, message: "Required" }]}
          >
            <Input.Password placeholder="Secret123" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="mail@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="+91 9999999999" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                <Select>
                  <Option value="admin">Admin</Option>
                  <Option value="doctor">Doctor</Option>
                  <Option value="receptionist">Receptionist</Option>
                  <Option value="technician">Technician</Option>
                  <Option value="pathologist">Pathologist</Option>
                  <Option value="accountant">Accountant</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="designation" label="Designation">
                <Input placeholder="e.g. Senior Admin" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="isActive" label="Account Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UserManagementDrawer;