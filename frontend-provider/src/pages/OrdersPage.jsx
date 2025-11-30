import React, { useEffect, useState } from "react";
import { Table, Button, Input, Tag, Space, DatePicker, Card, Row, Col } from "antd";
import { PlusOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { getOrders } from "../redux/apiCalls";
import CreateOrderDrawer from "../components/CreateOrderDrawer"; // We will build this next
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
  const { orders, isFetching } = useSelector((state) => state[process.env.REACT_APP_ORDERS_DATA_KEY]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [search, setSearch] = useState("");

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
          <div>{p.firstName} {p.lastName}</div>
          <small style={{color: '#888'}}>{p.mobile}</small>
        </div>
      ) : <Tag color="red">Unknown</Tag>,
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      key: "date",
      render: (date) => moment(date).format("DD MMM YYYY, h:mm A"),
    },
    {
      title: "Amount",
      dataIndex: "netAmount",
      key: "amount",
      render: (amt) => <span style={{ color: "green", fontWeight: "bold" }}>₹{amt}</span>,
    },
    {
      title: "Status",
      dataIndex: "items",
      key: "status",
      render: (items) => {
        // Simple logic: if any item is pending, order is pending
        const isPending = items.some(i => i.status === "Pending");
        return isPending ? <Tag color="orange">Pending</Tag> : <Tag color="green">Completed</Tag>;
      }
    },
    {
      title: "Payment",
      dataIndex: "paymentStatus",
      key: "pay",
      render: (status) => (
        <Tag color={status === "Paid" ? "green" : "volcano"}>{status}</Tag>
      ),
    }
  ];

  return (
    <PageContainer>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2>Order Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>
          New Order
        </Button>
      </div>

      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input.Search 
                placeholder="Search Order ID..." 
                onSearch={handleSearch} 
                allowClear
            />
          </Col>
          <Col span={8}>
             <RangePicker onChange={() => {}} />
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
        />
      </Card>

      <CreateOrderDrawer 
        open={drawerVisible} 
        onClose={() => setDrawerVisible(false)} 
      />
    </PageContainer>
  );
};

export default OrdersPage;