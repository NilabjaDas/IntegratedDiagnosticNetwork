import React, { useState } from "react";
import { Table, Input, InputNumber, Button, Tag, Space, message, Tooltip, Modal } from "antd";
import { EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined, SettingOutlined, LinkOutlined, DisconnectOutlined } from "@ant-design/icons";
import { useSelector, useDispatch } from "react-redux";
import { updateMyTest, deleteMyTest } from "../../redux/apiCalls";
import EditTestDrawer from "./EditTestDrawer"; 

const TestManager = () => {
  const dispatch = useDispatch();
  const { tests, isFetching } = useSelector((state) => state[process.env.REACT_APP_TESTS_DATA_KEY]);
  
  // --- Pagination State (NEW) ---
  const [tableParams, setTableParams] = useState({
    current: 1,
    pageSize: 10,
    showSizeChanger: true, 
  });

  // Inline Editing State
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  
  // Drawer Editing State
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerData, setDrawerData] = useState(null);

  const [searchText, setSearchText] = useState("");

  // --- Handlers ---
  const handleTableChange = (pagination) => {
    setTableParams({
      ...tableParams,
      current: pagination.current,
      pageSize: pagination.pageSize,
    });
  };

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

  const filteredData = tests?.filter(
    (t) =>
      t.name.toLowerCase().includes(searchText.toLowerCase()) ||
      t.testCode.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    // 1. NEW: Serial Number Column
    {
      title: "#",
      key: "index",
      width: 60,
      render: (text, record, index) => {
        const runningIndex = (tableParams.current - 1) * tableParams.pageSize + index + 1;
        return <span style={{ color: '#888' }}>{runningIndex}</span>;
      },
    },
    {
      title: "Link",
      key: "link",
      width: 60,
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
      width: 200,
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
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by name or code..."
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      {/* 2. Container with fixed height for scrolling */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="_id"
          loading={isFetching}
          
          // 3. Connect Pagination State
          pagination={tableParams}
          onChange={handleTableChange}
          
          // 4. Set Scroll (Subtract header/footer space approx 110px)
          scroll={{ y: 'calc(80vh - 250px)' }} 
        />
      </div>

      <EditTestDrawer 
        open={drawerVisible} 
        onClose={() => setDrawerVisible(false)} 
        testData={drawerData} 
      />
    </div>
  );
};

export default TestManager;