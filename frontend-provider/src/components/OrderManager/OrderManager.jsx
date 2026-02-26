import React, { useEffect, useState } from "react";
import { Table, Button, Input, Tag, Space, Card, Row, Col, Badge, Typography } from "antd";
import { PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { getOrders } from "../../redux/apiCalls";
import styled from "styled-components";
import moment from "moment";

// Import from the OrderManager subfolder
import CreateOrderDrawer from "./CreateOrderDrawer";
import OrderDetailsDrawer from "./OrderDetailsDrawer";
import ActionRequiredDashboard from './ActionRequiredDashboard';

const { Title, Text } = Typography;

const PageContainer = styled.div`
  padding: 24px;
  min-height: 100vh;
  background-color: #f4f6f8;

  .cancelled-row {
    text-decoration: line-through;
    color: #820e0e;
    background-color: #fafafa;
  }

  .cancelled-row .ant-tag {
    text-decoration: none; 
    opacity: 0.7;
  }
`;

const OrderManager = () => {
  const dispatch = useDispatch();
  const { orders, isFetching } = useSelector((state) => state[process.env.REACT_APP_ORDERS_DATA_KEY]);
  
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false);
  const [detailsDrawerId, setDetailsDrawerId] = useState(null);
  const [tableParams, setTableParams] = useState({ current: 1, pageSize: 10, showSizeChanger: true });
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      getOrders(dispatch, { search: searchText });
    }, 600); 
    return () => clearTimeout(delayDebounceFn);
  }, [searchText, dispatch]);

  const columns = [
    {
      title: "#",
      key: "index",
      width: 60,
      render: (text, record, index) => {
        const runningIndex = (tableParams.current - 1) * tableParams.pageSize + index + 1;
        return <span style={{ color: "#888" }}>{runningIndex}</span>;
      },
    },
    { title: "Order ID", dataIndex: "displayId", key: "displayId", render: (text) => <b>{text}</b> },
    {
      title: "Patient", dataIndex: "patientDetails", key: "patientDetails",
      render: (p) => p ? (
          <div><div style={{ fontWeight: 500 }}>{p.name}</div><small style={{ color: "#888" }}>{p.mobile || "N/A"}</small></div>
        ) : <Tag color="red">Unknown</Tag>,
    },
    {
      title: "Order Date", dataIndex: "createdAt", key: "date",
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (date) => moment(date).format("DD MMM, h:mm A"),
    },
    {
      title: "App. Date", dataIndex: "appointment", key: "appDate",
      render: (p) => p ? <div><div style={{ fontWeight: 500 }}>{moment(p.date).format("DD MMM")}</div></div> : <Text type="secondary">-</Text>,
    },
    {
      title: "Financials", key: "financials",
      filters: [{ text: "Paid", value: "Paid" }, { text: "Pending", value: "Pending" }, { text: "Partially Paid", value: "PartiallyPaid" }, { text: "Cancelled", value: "Cancelled" }],
      onFilter: (value, record) => record.financials?.status === value,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <span>Total: <b>₹{record.financials?.netAmount}</b></span>
            {record.financials?.dueAmount > 0 && <Tag color="red">Due: ₹{record.financials.dueAmount}</Tag>}
          </Space>
          <Badge status={record.financials?.status === "Paid" ? "success" : record.financials?.status === "Cancelled" ? "default" : "processing"} text={record.financials?.status} style={{ fontSize: 12 }} />
        </Space>
      ),
    },
    {
      title: "Work Status", dataIndex: "appointment", key: "appointment",
      filters: [{ text: "Scheduled", value: "Scheduled" }, { text: "Completed", value: "Completed" }, { text: "Cancelled", value: "Cancelled" }],
      onFilter: (value, record) => {
        if (record.financials?.status === "Cancelled") return value === "Cancelled";
        return record.appointment?.status === value;
      },
      render: (appointment, record) => {
        if (record.financials?.status === "Cancelled" || record.cancellation?.isCancelled) {
          return <Tag color="default" style={{ textDecoration: "none" }}>Cancelled</Tag>;
        }
        return appointment?.status !== "Completed" ? <Tag color="orange">In Progress</Tag> : <Tag color="green">Completed</Tag>;
      },
    },
  ];

  const handleTableChange = (pagination) => {
    setTableParams({ ...tableParams, current: pagination.current, pageSize: pagination.pageSize });
  };

  return (
    <PageContainer>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
              <Title level={2} style={{ margin: 0 }}>Orders Management</Title>
              <Text type="secondary">Manage patient orders, billing, and appointments.</Text>
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreateDrawerVisible(true)}>
              New Order
          </Button>
      </div>

      <ActionRequiredDashboard />

      {/* TABLE SECTION */}
      <Card bodyStyle={{ padding: '24px' }} style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginTop: 24 }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input
              placeholder="Search Order ID or Patient Name..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={16} style={{ textAlign: "right" }}>
            <Button icon={<ReloadOutlined />} onClick={() => getOrders(dispatch)}>Refresh Data</Button>
          </Col>
        </Row>
        
        <Table
          columns={columns} dataSource={orders} rowKey="_id" loading={isFetching}
          pagination={tableParams} onChange={handleTableChange} scroll={{ y: "calc(100vh - 380px)" }} 
          rowClassName={(record) => record.financials?.status === "Cancelled" ? "cancelled-row" : ""}
          onRow={(record) => ({ onClick: () => setDetailsDrawerId(record._id), style: { cursor: "pointer" } })}
        />
      </Card>

      <CreateOrderDrawer open={createDrawerVisible} onClose={() => { setCreateDrawerVisible(false); getOrders(dispatch); }} />
      <OrderDetailsDrawer open={!!detailsDrawerId} orderId={detailsDrawerId} onClose={() => { setDetailsDrawerId(null); getOrders(dispatch); }} />
    </PageContainer>
  );
};

export default OrderManager;