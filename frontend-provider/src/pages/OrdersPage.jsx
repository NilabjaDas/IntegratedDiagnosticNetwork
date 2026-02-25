import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Input,
  Tag,
  Space,
  DatePicker,
  Card,
  Row,
  Col,
  Badge,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { getOrders } from "../redux/apiCalls";
import CreateOrderDrawer from "../components/OrderManager/CreateOrderDrawer";
import OrderDetailsDrawer from "../components/OrderManager/OrderDetailsDrawer";
import ActionRequiredDashboard from '../components/OrderManager/ActionRequiredDashboard';
import styled from "styled-components";
import moment from "moment";

const { RangePicker } = DatePicker;

// Updated Styles for Strikethrough
const PageContainer = styled.div`
  height: 100%;
  /* Strikethrough style for cancelled rows */
  .cancelled-row {
    text-decoration: line-through;
    color: #820e0e;
    background-color: #fafafa;
  }

  .cancelled-row .ant-tag {
    text-decoration: none; /* Keep tags readable */
    opacity: 0.7;
  }
`;

const OrdersPage = () => {
  const dispatch = useDispatch();
  const { orders, isFetching } = useSelector(
    (state) => state[process.env.REACT_APP_ORDERS_DATA_KEY],
  );
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false);
  const [detailsDrawerId, setDetailsDrawerId] = useState(null);
  const [tableParams, setTableParams] = useState({
    current: 1,
    pageSize: 10,
    showSizeChanger: true, // Allows changing items per page
  });
  const [searchText, setSearchText] = useState("");

  // 1. Initial Load & Debounced Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      getOrders(dispatch, { search: searchText });
    }, 600); // 600ms delay for better typing experience

    return () => clearTimeout(delayDebounceFn);
  }, [searchText, dispatch]);

  const columns = [
    // 2. Added Serial Number Column
    {
      title: "#",
      key: "index",
      width: 60,
      render: (text, record, index) => {
        // Calculate the running index
        const runningIndex =
          (tableParams.current - 1) * tableParams.pageSize + index + 1;
        return <span style={{ color: "#888" }}>{runningIndex}</span>;
      },
    },
    {
      title: "Order ID",
      dataIndex: "displayId",
      key: "displayId",
      render: (text) => <b>{text}</b>,
    },
    {
      title: "Patient",
      dataIndex: "patientDetails",
      key: "patientDetails",
      render: (p) =>
        p ? (
          <div>
            <div style={{ fontWeight: 500 }}>{p.name}</div>
            <small style={{ color: "#888" }}>{p.mobile || "N/A"}</small>
          </div>
        ) : (
          <Tag color="red">Unknown</Tag>
        ),
    },
    {
      title: "Order Date",
      dataIndex: "createdAt",
      key: "date",
      // 3. Added Sorting
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (date) => moment(date).format("DD MMM, h:mm A"),
    },
    {
      title: "App. Date",
      dataIndex: "appointment",
      key: "date",
      // 3. Added Sorting
      // sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (p) =>
        p ? (
          <div>
            <div style={{ fontWeight: 500 }}>
              {moment(p.date).format("DD MMM")}
            </div>
          </div>
        ) : (
          <Tag color="red">Unknown</Tag>
        ),
    },
    {
      title: "Financials",
      key: "financials",
      // 3. Added Filtering
      filters: [
        { text: "Paid", value: "Paid" },
        { text: "Pending", value: "Pending" },
        { text: "Partially Paid", value: "PartiallyPaid" },
        { text: "Cancelled", value: "Cancelled" },
      ],
      onFilter: (value, record) => record.financials?.status === value,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <span>
              Total: <b>₹{record.financials?.netAmount}</b>
            </span>
            {record.financials?.dueAmount > 0 && (
              <Tag color="red">Due: ₹{record.financials.dueAmount}</Tag>
            )}
          </Space>
          <Badge
            status={
              record.financials?.status === "Paid"
                ? "success"
                : record.financials?.status === "Cancelled"
                  ? "default"
                  : "processing"
            }
            text={record.financials?.status}
            style={{ fontSize: 12 }}
          />
        </Space>
      ),
    },
    {
      title: "Work Status",
      dataIndex: "appointment",
      key: "appointment",
      filters: [
        { text: "Scheduled", value: "Scheduled" },
        { text: "Completed", value: "Completed" },
        { text: "Cancelled", value: "Cancelled" },
      ],
      onFilter: (value, record) => {
        // If the order is cancelled financially, treat work status as cancelled too
        if (record.financials?.status === "Cancelled")
          return value === "Cancelled";
        return record.appointment?.status === value;
      },
      render: (appointment, record) => {
        // 4. Handle Cancelled Logic
        if (
          record.financials?.status === "Cancelled" ||
          record.cancellation?.isCancelled
        ) {
          return (
            <Tag color="default" style={{ textDecoration: "none" }}>
              Cancelled
            </Tag>
          );
        }

        const isPending = appointment?.status !== "Completed";
        return isPending ? (
          <Tag color="orange">In Progress</Tag>
        ) : (
          <Tag color="green">Completed</Tag>
        );
      },
    },
  ];
  const handleTableChange = (pagination, filters, sorter) => {
    setTableParams({
      ...tableParams,
      current: pagination.current,
      pageSize: pagination.pageSize,
    });
  };
  return (
    <PageContainer>
<ActionRequiredDashboard />
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            {/* 1. Search on Key Press (onChange) */}
            <Input
              placeholder="Search Order ID or Patient Name..."
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          {/* <Col span={8}>
             <RangePicker onChange={() => {}} style={{ width: '100%' }} />
          </Col> */}
          <Col span={8}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => getOrders(dispatch)}
            >
              Refresh
            </Button>
          </Col>
          <Col span={8} style={{ textAlign: "right" }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateDrawerVisible(true)}
            >
              New Order
            </Button>
          </Col>
        </Row>
        <div style={{ height: "70vh" }}>
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="_id"
            loading={isFetching}
            // Connect the state here
            pagination={tableParams}
            onChange={handleTableChange}
            scroll={{ y: "calc(70vh - 110px)" }}
            rowClassName={(record) =>
              record.financials?.status === "Cancelled" ? "cancelled-row" : ""
            }
            onRow={(record) => ({
              onClick: () => setDetailsDrawerId(record._id),
              style: { cursor: "pointer" },
            })}
          />
        </div>

      <CreateOrderDrawer
        open={createDrawerVisible}
        onClose={() => {
          setCreateDrawerVisible(false);
          getOrders(dispatch);
        }}
      />

      <OrderDetailsDrawer
        open={!!detailsDrawerId}
        orderId={detailsDrawerId}
        onClose={() => {
          setDetailsDrawerId(null);
          getOrders(dispatch);
        }}
      />
    </PageContainer>
  );
};

export default OrdersPage;
