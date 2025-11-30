import React, { useState } from "react";
import { Table, Input, InputNumber, Button, Tag, Space, Switch, message, Tooltip, Modal } from "antd";
import { EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined, SettingOutlined, LinkOutlined, DisconnectOutlined } from "@ant-design/icons";
import { useSelector, useDispatch } from "react-redux";
import { updateMyTest, deleteMyTest } from "../redux/apiCalls";
import EditTestDrawer from "./EditTestDrawer"; // Import the new drawer

const TestManager = () => {
  const dispatch = useDispatch();
  // Ensure we select from the correct slice based on your env or default
  const { tests, isFetching } = useSelector((state) => state[process.env.REACT_APP_TESTS_DATA_KEY]);
  
  // Inline Editing State
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  
  // Drawer Editing State
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerData, setDrawerData] = useState(null);

  const [searchText, setSearchText] = useState("");

  // --- Inline Edit Handlers ---
  const handleInlineEdit = (record) => {
    setEditingId(record._id);
    setEditValues({ ...record });
  };

  const handleInlineCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleInlineSave = async () => {
    const res = await updateMyTest(dispatch, editingId, editValues);
    if (res.status === 200) {
      message.success("Quick update successful");
      setEditingId(null);
    } else {
      message.error("Update failed");
    }
  };

  // --- Full Drawer Edit Handlers ---
  const openFullEdit = (record) => {
    setDrawerData(record);
    setDrawerVisible(true);
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: "Remove Test",
      content: "Are you sure? This will remove it from your price list.",
      okText: "Yes, Remove",
      okType: "danger",
      onOk: () => deleteMyTest(dispatch, id),
    });
  };

  const filteredData = tests.filter(
    (t) =>
      t.name.toLowerCase().includes(searchText.toLowerCase()) ||
      t.testCode.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: "Link",
      key: "link",
      width: 50,
      render: (_, record) => (
        <Tooltip title={record.baseTestId ? "Linked to Master Catalog" : "Custom / Decoupled"}>
           {record.baseTestId ? <LinkOutlined style={{ color: "green" }} /> : <DisconnectOutlined style={{ color: "orange" }} />}
        </Tooltip>
      )
    },
    {
      title: "Code",
      dataIndex: "testCode",
      key: "testCode",
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Test Name",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <span>
          <b>{text}</b>
          <br />
          <small style={{ color: "#888" }}>{record.department}</small>
        </span>
      ),
    },
    {
      title: "Price (₹)",
      dataIndex: "price",
      key: "price",
      width: 120,
      render: (text, record) => {
        if (editingId === record._id) {
          return (
            <InputNumber
              value={editValues.price}
              onChange={(val) => setEditValues({ ...editValues, price: val })}
              min={0}
              size="small"
            />
          );
        }
        return <b style={{ color: "green" }}>₹ {text}</b>;
      },
    },
    {
      title: "Action",
      key: "action",
      width: 150,
      render: (_, record) => {
        const isEditing = editingId === record._id;
        return isEditing ? (
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              size="small"
              onClick={handleInlineSave}
            />
            <Button icon={<CloseOutlined />} size="small" onClick={handleInlineCancel} />
          </Space>
        ) : (
          <Space>
            <Tooltip title="Quick Price Edit">
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => handleInlineEdit(record)}
              />
            </Tooltip>
            <Tooltip title="Full Configuration">
              <Button
                icon={<SettingOutlined />}
                size="small"
                onClick={() => openFullEdit(record)}
              />
            </Tooltip>
            <Tooltip title="Remove">
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                onClick={() => handleDelete(record._id)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by name or code..."
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>
      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="_id"
        loading={isFetching}
        pagination={{ pageSize: 10 }}
      />

      <EditTestDrawer 
        open={drawerVisible} 
        onClose={() => setDrawerVisible(false)} 
        testData={drawerData} 
      />
    </div>
  );
};

export default TestManager;