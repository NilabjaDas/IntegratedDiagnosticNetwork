import React, { useEffect, useState } from "react";
import {
  Drawer,
  Descriptions,
  Table,
  Tag,
  Button,
  Tabs,
  Card,
  Statistic,
  Row,
  Col,
  Space,
  Spin,
  Alert,
  Input,
  message,
  Popconfirm,
  Modal
} from "antd";
import { 
  PrinterOutlined, 
  DollarCircleOutlined, 
  HistoryOutlined, 
  FileTextOutlined,
  EditOutlined,
  StopOutlined,
  SaveOutlined
} from "@ant-design/icons";
import { getOrderDetails, updateOrderNotes, cancelOrder } from "../redux/apiCalls";
import PaymentModal from "./PaymentModal";
import ModifyItemsModal from "./ModifyItemsModal";
import moment from "moment";

const { TextArea } = Input;

const OrderDetailsDrawer = ({ open, onClose, orderId }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Modal States
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [modifyModalVisible, setModifyModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  
  // Local Notes State
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchDetails = async () => {
    if (!orderId) return;
    setLoading(true);
    const res = await getOrderDetails(orderId);
    setLoading(false);
    if (res.status === 200) {
      setOrder(res.data);
      setNotes(res.data.notes || "");
    }
  };

  useEffect(() => {
    if (open) fetchDetails();
  }, [open, orderId]);

  // --- HANDLERS ---

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const res = await updateOrderNotes(orderId, notes);
    setSavingNotes(false);
    if(res.status === 200) message.success("Notes updated");
    else message.error("Failed to update notes");
  };

  const handleCancelOrder = async () => {
    if(!cancelReason) return message.error("Please provide a reason");
    
    setLoading(true);
    const res = await cancelOrder(orderId, cancelReason);
    setLoading(false);
    
    if(res.status === 200) {
        message.success("Order Cancelled");
        setCancelModalVisible(false);
        fetchDetails(); // Refresh
    } else {
        message.error(res.message);
    }
  };

  // --- RENDER HELPERS ---
  const renderStatusTag = (status) => {
    const colors = { Pending: "orange", Completed: "green", Cancelled: "red", Reported: "blue" };
    return <Tag color={colors[status] || "default"}>{status}</Tag>;
  };

  const isCancelled = order?.financials?.status === "Cancelled";

  if (!open) return null;

  return (
    <>
      <Drawer
        title={
            <Space>
                <span>Order #{order?.displayId}</span>
                {isCancelled && <Tag color="red">CANCELLED</Tag>}
            </Space>
        }
        width={850}
        onClose={onClose}
        open={open}
        extra={
          <Space>
             {!isCancelled && (
                <Button danger icon={<StopOutlined />} onClick={() => setCancelModalVisible(true)}>
                    Cancel Order
                </Button>
             )}
            <Button icon={<PrinterOutlined />}>Print Bill</Button>
          </Space>
        }
      >
        {loading || !order ? (
          <div style={{ textAlign: "center", marginTop: 50 }}><Spin size="large" /></div>
        ) : (
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: "1",
                label: <span><FileTextOutlined /> Details</span>,
                children: (
                  <Space direction="vertical" style={{ width: "100%" }} size="large">
                    
                    {/* Cancellation Alert */}
                    {isCancelled && (
                        <Alert 
                            message="Order Cancelled" 
                            description={`Reason: ${order.cancellation?.reason} | Date: ${moment(order.cancellation?.date).format("DD MMM YY")}`}
                            type="error" 
                            showIcon 
                        />
                    )}

                    {/* Patient Info */}
                    <Card size="small" title="Patient Information">
                      <Descriptions column={2} size="small">
                        <Descriptions.Item label="Name">{order.patientId?.firstName} {order.patientId?.lastName}</Descriptions.Item>
                        <Descriptions.Item label="Mobile">{order.patientId?.mobile}</Descriptions.Item>
                        <Descriptions.Item label="Age/Gender">{order.patientId?.age} Y / {order.patientId?.gender}</Descriptions.Item>
                        <Descriptions.Item label="UHID">{order.patientId?.uhid || "-"}</Descriptions.Item>
                      </Descriptions>
                    </Card>

                    {/* Items & Modify */}
                    <Card 
                        size="small" 
                        title="Ordered Services" 
                        extra={
                            !isCancelled && (
                                <Button 
                                    type="link" 
                                    icon={<EditOutlined />} 
                                    onClick={() => setModifyModalVisible(true)}
                                >
                                    Modify Items
                                </Button>
                            )
                        }
                    >
                        <Table 
                            columns={[
                                { title: "Service", dataIndex: "name" },
                                { title: "Type", dataIndex: "itemType", render: (t) => <Tag>{t}</Tag> },
                                { title: "Price", dataIndex: "price", render: (p) => `₹${p}` },
                                { title: "Status", dataIndex: "status", render: (s) => renderStatusTag(s) },
                            ]}
                            dataSource={order.items} 
                            rowKey="_id" 
                            pagination={false} 
                            size="small"
                            bordered
                        />
                    </Card>

                    {/* Notes */}
                    <Card size="small" title="Internal Notes">
                        <TextArea 
                            rows={2} 
                            value={notes} 
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add notes about this order..."
                            disabled={isCancelled}
                        />
                        {!isCancelled && (
                            <div style={{ marginTop: 8, textAlign: 'right' }}>
                                <Button 
                                    type="primary" 
                                    size="small" 
                                    icon={<SaveOutlined />} 
                                    onClick={handleSaveNotes} 
                                    loading={savingNotes}
                                >
                                    Save Note
                                </Button>
                            </div>
                        )}
                    </Card>
                  </Space>
                ),
              },
              {
                key: "2",
                label: <span><DollarCircleOutlined /> Financials</span>,
                children: (
                  <Space direction="vertical" style={{ width: "100%" }} size="large">
                    
                    {/* Financial Summary */}
                   <Row gutter={16}>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic 
                             title="Total Bill" 
                             value={order.financials.totalAmount} 
                             prefix="₹" 
                             valueStyle={{ fontSize: 16 }} 
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic 
                             title="Discount" 
                             value={order.financials.discountAmount} 
                             prefix="₹" 
                             valueStyle={{ fontSize: 16, color: '#faad14' }} 
                          />
                          {order.financials.discountReason && (
                              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                                ({order.financials.discountReason})
                              </div>
                          )}
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic 
                             title="Paid" 
                             value={order.financials.paidAmount} 
                             prefix="₹" 
                             valueStyle={{ fontSize: 16, color: '#3f8600' }} 
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic 
                             title="Due" 
                             value={order.financials.dueAmount} 
                             prefix="₹" 
                             valueStyle={{ fontSize: 16, color: '#cf1322' }} 
                          />
                        </Card>
                      </Col>
                    </Row>

                    {/* Action Button */}
                    {order.financials.dueAmount > 0 && !isCancelled ? (
                      <Button 
                        type="primary" 
                        block 
                        size="large" 
                        icon={<DollarCircleOutlined />}
                        onClick={() => setPaymentModalVisible(true)}
                      >
                        Collect Payment
                      </Button>
                    ) : (
                      isCancelled ? <Alert message="Order is Cancelled. No payment required." type="info" /> : <Alert message="Payment Complete" type="success" showIcon />
                    )}

                    {/* Ledger History */}
                    <Card size="small" title={<span><HistoryOutlined /> Transaction History</span>}>
                      <Table 
                        columns={[
                            { title: "Date", dataIndex: "date", render: (d) => moment(d).format("DD/MM/YY HH:mm") },
                            { title: "Mode", dataIndex: "paymentMode", render: (m) => <Tag>{m}</Tag> },
                            { title: "Details", render: (_,r) => <small>{r.paymentMethod || r.transactionId || "-"}</small> },
                            { title: "Amount", dataIndex: "amount", render: (a) => <b style={{ color: "green" }}>₹{a}</b> },
                        ]}
                        dataSource={order.transactions} 
                        rowKey="_id" 
                        pagination={false} 
                        size="small"
                      />
                    </Card>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* --- MODALS --- */}
      
      {/* Payment */}
      {order && (
        <PaymentModal 
          open={paymentModalVisible}
          onCancel={() => setPaymentModalVisible(false)}
          order={order}
          onSuccess={() => {
            setPaymentModalVisible(false);
            fetchDetails();
          }}
        />
      )}

      {/* Modify Items */}
      {order && (
        <ModifyItemsModal 
            open={modifyModalVisible}
            onCancel={() => setModifyModalVisible(false)}
            order={order}
            onSuccess={() => {
                setModifyModalVisible(false);
                fetchDetails();
            }}
        />
      )}

      {/* Cancel Order Modal */}
      <Modal
        title="Cancel Order"
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        onOk={handleCancelOrder}
        okText="Confirm Cancellation"
        okButtonProps={{ danger: true, loading: loading }}
      >
          <p>Are you sure you want to cancel this order? This action cannot be undone.</p>
          <Input 
            placeholder="Reason for cancellation (Required)" 
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
      </Modal>
    </>
  );
};

export default OrderDetailsDrawer;