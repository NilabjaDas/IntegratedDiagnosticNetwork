import React, { useState, useEffect } from 'react';
import { Modal, Button, Spin, Typography, Space, message, Divider } from 'antd';
import { useDispatch } from 'react-redux';
import { getOrderDetails, recordManualPayment } from '../../redux/apiCalls';
import { updateTokenSuccess } from '../../redux/queueRedux';
import { DollarCircleOutlined, QrcodeOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const EMRDeskPaymentModal = ({ visible, data, onCancel, onSuccess, role }) => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState(null);

    useEffect(() => {
        if (visible && data?.token?.orderId) {
            fetchOrder();
        } else {
            setOrder(null);
        }
    }, [visible, data]);

    const fetchOrder = async () => {
        setLoading(true);
        const res = await getOrderDetails(data.token.orderId);
        if (res.status === 200) setOrder(res.data);
        setLoading(false);
    };

  const handlePay = async (mode, isWaiver = false) => {
        setLoading(true);
        try {
            const due = order.financials.dueAmount;
            const payload = {
                dbOrderId: order._id, // <-- Changed to dbOrderId
                amount: due,
                mode: isWaiver ? 'Waiver' : mode, // <-- Handle waiver mode
                notes: isWaiver ? `Fee waived by ${role}` : `Collected by ${role} at EMR Desk`
            };
            
            await recordManualPayment(payload);
            message.success(isWaiver ? "Fee Waived!" : "Payment Recorded!");
            
            // Optimistically mark token as paid in local Redux
            dispatch(updateTokenSuccess({ ...data.token, paymentStatus: 'Paid' }));
            
            onSuccess(data.token._id, data.action);
        } catch (err) {
            message.error("Payment failed. Cannot proceed.");
        } finally {
            setLoading(false);
        }
    };

    if (!data) return null;

    const { config } = data;
    // Load the correct capabilities based on who is logged in
    const capabilities = role === 'Doctor' ? config.doctorCapabilities : config.assistantCapabilities;
    const dueAmount = order?.financials?.dueAmount || 0;

    return (
        <Modal
            title={`Pending Payment: ${data.token.patientDetails?.name}`}
            open={visible}
            onCancel={onCancel}
            footer={null}
            destroyOnClose
            centered
        >
            {loading ? <div style={{textAlign: 'center', padding: 40}}><Spin size="large"/></div> : (
                <div>
                    <div style={{ textAlign: 'center', marginBottom: 24, padding: 16, background: '#fff1f0', borderRadius: 8 }}>
                        <Text type="secondary" strong>Amount Due for Consultation</Text>
                        <Title level={2} style={{ margin: 0, color: '#cf1322' }}>₹{dueAmount}</Title>
                    </div>
                    
                    {!capabilities?.allowedToCollect ? (
                        <div style={{ textAlign: 'center', color: '#8c8c8c', padding: 20 }}>
                            You are not authorized to collect payments. <br/>
                            <strong>Please direct the patient to the reception desk.</strong>
                        </div>
                    ) : (
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            {capabilities.allowedModes?.includes('Cash') && (
                                <Button type="primary" block size="large" icon={<DollarCircleOutlined />} onClick={() => handlePay('Cash')} style={{ height: 50, fontSize: 16 }}>
                                    Collect Cash
                                </Button>
                            )}
                            {capabilities.allowedModes?.includes('UPI') && (
                                <Button block size="large" icon={<QrcodeOutlined />} onClick={() => handlePay('UPI')} style={{ height: 50, fontSize: 16 }}>
                                    Collect via UPI QR
                                </Button>
                            )}
                            
                            {/* Doctor-Only Feature: Waive Fee */}
                            {role === 'Doctor' && capabilities.canWaiveFee && (
                                <>
                                    <Divider style={{ margin: '12px 0', borderColor: '#d9d9d9' }}><Text type="secondary">OR</Text></Divider>
                                    <Button danger block size="large" type="dashed" icon={<SafetyCertificateOutlined />} onClick={() => handlePay('Cash', true)} style={{ height: 50, fontSize: 16 }}>
                                        Waive Fee (Mark 100% Free)
                                    </Button>
                                </>
                            )}
                        </Space>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default EMRDeskPaymentModal;