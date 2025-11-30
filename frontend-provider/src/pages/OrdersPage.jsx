import React, { useEffect, useState } from "react";
import { Table, Button, Input, Tag, Space, DatePicker, Card, Row, Col, Badge } from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { getOrders } from "../redux/apiCalls";
import CreateOrderDrawer from "../components/CreateOrderDrawer";
import OrderDetailsDrawer from "../components/OrderDetailsDrawer"; // New Import
import styled from "styled-components";
import moment from "moment";

const { RangePicker } = DatePicker;

const PageContainer = styled.div`
  padding: 24px;
  background: #f0f2f5;
  min-height: 100vh;
`;

const OrdersPage = () => {
  const dispatch = useDispatch();
  // Ensure we use the correct environment key
  const { orders, isFetching } = useSelector((state) => state[process.env.REACT_APP_ORDERS_DATA_KEY]); 
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false);
  const [detailsDrawerId, setDetailsDrawerId] = useState(null); // Tracks ID for View/Edit
  
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    getOrders(dispatch);
  }, [dispatch]);

  const handleSearch = (val) => {
    getOrders(dispatch, { search: val });
  };

  const columns = [
    {
      title: "Order ID",
      dataIndex: "displayId",
      key: "displayId",
      render: (text) => <b>{text}</b>,
    },
    {
      title: "Patient",
      dataIndex: "patientId",
      key: "patient",
      render: (p) => p ? (
        <div>
          <div style={{fontWeight: 500}}>{p.firstName} {p.lastName}</div>
          <small style={{color: '#888'}}>{p.mobile}</small>
        </div>
      ) : <Tag color="red">Unknown</Tag>,
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "date",
      render: (date) => moment(date).format("DD MMM, h:mm A"),
    },
    {
      title: "Financials",
      key: "financials",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
            <Space>
                <span>Total: <b>₹{record.financials?.netAmount}</b></span>
                {record.financials?.dueAmount > 0 && (
                    <Tag color="red">Due: ₹{record.financials.dueAmount}</Tag>
                )}
            </Space>
            <Badge 
                status={record.financials?.status === 'Paid' ? 'success' : 'processing'} 
                text={record.financials?.status} 
                style={{ fontSize: 12 }}
            />
        </Space>
      ),
    },
    {
      title: "Work Status",
      dataIndex: "items",
      key: "status",
      render: (items) => {
        const isPending = items.some(i => i.status === "Pending");
        return isPending ? <Tag color="orange">In Progress</Tag> : <Tag color="green">Completed</Tag>;
      }
    }
  ];

  return (
    <PageContainer>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2>Order Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateDrawerVisible(true)}>
          New Order
        </Button>
      </div>

      <Card bordered={false}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input.Search 
                placeholder="Search Order ID..." 
                onSearch={handleSearch} 
                allowClear
                enterButton
            />
          </Col>
          <Col span={8}>
             <RangePicker onChange={() => {}} style={{ width: '100%' }} />
          </Col>
          <Col span={8} style={{ textAlign: 'right' }}>
             <Button icon={<ReloadOutlined />} onClick={() => getOrders(dispatch)}>Refresh</Button>
          </Col>
        </Row>

        <Table 
            columns={columns} 
            dataSource={orders} 
            rowKey="_id" 
            loading={isFetching}
            pagination={{ pageSize: 10 }}
            onRow={(record) => ({
                onClick: () => setDetailsDrawerId(record._id), // Click row to open details
                style: { cursor: 'pointer' }
            })}
        />
      </Card>

      {/* Drawer for Creating New Order */}
      <CreateOrderDrawer 
        open={createDrawerVisible} 
        onClose={() => {
            setCreateDrawerVisible(false);
            getOrders(dispatch); // Refresh list after create
        }} 
      />

      {/* Drawer for Viewing/Editing Existing Order */}
      <OrderDetailsDrawer
        open={!!detailsDrawerId}
        orderId={detailsDrawerId}
        onClose={() => {
            setDetailsDrawerId(null);
            getOrders(dispatch); // Refresh list after edit (payment update)
        }}
      />
    </PageContainer>
  );
};

export default OrdersPage;