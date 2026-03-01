import React, { useState, useEffect, useMemo } from 'react';
import { Typography, message, Row, Col, Card, Avatar, Space, Tag, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartmentQueue, updateTokenStatus, getDoctors, getOrderDetails, recordManualPayment } from '../../redux/apiCalls';
import { updateTokenSuccess } from '../../redux/queueRedux';

import WaitingQueueList from './WaitingQueueList';
import EMRDeskPaymentModal from './EMRDeskPaymentModal';

const { Title, Text } = Typography;

const AssistantWorkspace = () => {
    const dispatch = useDispatch();
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [paymentModalData, setPaymentModalData] = useState(null);

    const { queue, isFetching } = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY]);
    const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);

    useEffect(() => {
        fetchDepartmentQueue(dispatch, "Consultation");
        if (doctors.length === 0) getDoctors(dispatch); // Ensure we have doctor configs!
    }, [dispatch, doctors.length]);

    const consultationQueue = useMemo(() => {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return queue.filter(token => token.department === 'Consultation' && token.date === todayStr);
    }, [queue]);

    // --- 🚨 FINANCIAL INTERCEPTOR 🚨 ---
    const handleActionInterceptor = async (tokenId, action) => {
        const token = consultationQueue.find(t => t._id === tokenId);
        
        // 1. If Paid (or missing payment status for older data), let them through instantly!
        if (!token.paymentStatus || token.paymentStatus === 'Paid') {
            return executeAction(tokenId, action);
        }

        // 2. It's Unpaid. Fetch the Doctor's Billing Config.
        const doctor = doctors.find(d => d._id === token.doctorId || d.doctorId === token.doctorId);
        const config = doctor?.billingPreferences || { paymentCollectionPoint: 'MANUAL_DESK_COLLECTION', assistantCapabilities: { allowedToCollect: true, allowedModes: ['Cash'] } };

        // 3. Evaluate Rule
        if (config.paymentCollectionPoint === 'STRICT_PREPAID') {
            message.error("Strict Policy: Patient must complete payment at Reception before proceeding.");
            return;
        }

        if (config.paymentCollectionPoint === 'AUTO_PAY_ON_CONSULT') {
            await handleAutoPayAndProceed(token, action);
            return;
        }

        // Default: MANUAL_DESK_COLLECTION
        setPaymentModalData({ token, action, config });
    };

    // Auto-Pay Logic (Silently completes cash transaction in background)
    const handleAutoPayAndProceed = async (token, action) => {
        setActionLoadingId(token._id);
        try {
            const res = await getOrderDetails(token.orderId);
            if (res.status === 200) {
                const due = res.data.financials?.dueAmount || 0;
                if (due > 0) {
                    await recordManualPayment({ dbOrderId: token.orderId, amount: due, mode: 'Cash', notes: 'Auto-collected by Assistant' });
                    dispatch(updateTokenSuccess({ ...token, paymentStatus: 'Paid' }));
                }
            }
            await executeAction(token._id, action);
        } catch(err) {
            message.error("Auto-pay failed.");
        } finally {
            setActionLoadingId(null);
        }
    };

    // The actual state-changing API call
    const executeAction = async (tokenId, action) => {
        setActionLoadingId(tokenId);
        try {
            await updateTokenStatus(dispatch, tokenId, action);
            if (action === 'SEND_TO_CABIN') message.success("Patient called to cabin!");
        } catch (error) {
            message.error("Failed to update status");
        } finally {
            setActionLoadingId(null);
        }
    };

    const activeToken = consultationQueue.find(t => t.status === 'IN_CABIN' || t.status === 'CALLED' || t.status === 'IN_PROGRESS');

    if (isFetching && consultationQueue.length === 0) {
        return <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}><Spin size="large" /></div>;
    }

    return (
        <div style={{ padding: '24px', height: 'calc(100vh - 64px)', overflowY: 'auto', background: '#f0f2f5' }}>
            <div style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Assistant Workspace</Title>
                <Text type="secondary">Manage the waiting queue and send patients to the Doctor's Cabin.</Text>
            </div>

            <Row gutter={24}>
                <Col span={24} style={{ marginBottom: 24 }}>
                    <Card style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Title level={5} style={{ marginTop: 0, color: '#8c8c8c' }}>Doctor's Cabin Status</Title>
                        
                        {!activeToken ? (
                            <div style={{ padding: '16px 0', textAlign: 'center' }}>
                                <Text strong style={{ fontSize: 18, color: '#52c41a' }}>Cabin is Empty</Text><br/>
                                <Text type="secondary">Call the next patient from the queue below.</Text>
                            </div>
                        ) : (
                            <Row align="middle" justify="space-between" style={{ background: '#e6f7ff', padding: 16, borderRadius: 8, border: '1px solid #91d5ff' }}>
                                <Col>
                                    <Space size="large">
                                        <Avatar size={50} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <Text strong style={{ fontSize: 16, color: '#0050b3' }}>
                                                    {activeToken.patientDetails?.name || activeToken.patientName}
                                                </Text>
                                                <Tag color="blue">{activeToken.tokenNumber}</Tag>
                                            </div>
                                            <Text type="secondary">Age: {activeToken.patientDetails?.age || "N/A"} • Gender: {activeToken.patientDetails?.gender || "N/A"}</Text>
                                        </div>
                                    </Space>
                                </Col>
                                <Col>
                                    {activeToken.status === 'IN_PROGRESS' ? (
                                        <Tag color="orange" style={{ fontSize: 14, padding: '6px 12px' }}>Doctor is Consulting...</Tag>
                                    ) : (
                                        <Tag color="cyan" style={{ fontSize: 14, padding: '6px 12px' }}>Patient in Cabin</Tag>
                                    )}
                                </Col>
                            </Row>
                        )}
                    </Card>
                </Col>
                
                <Col span={24}>
                    <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <Title level={5} style={{ marginBottom: 16 }}>Waiting Queue</Title>
                        <WaitingQueueList 
                            queue={consultationQueue} 
                            onAction={handleActionInterceptor} // <-- Uses the Interceptor now!
                            loadingId={actionLoadingId} 
                        />
                    </div>
                </Col>
            </Row>

            <EMRDeskPaymentModal 
                visible={!!paymentModalData} 
                data={paymentModalData} 
                onCancel={() => setPaymentModalData(null)} 
                onSuccess={(tokenId, action) => {
                    setPaymentModalData(null);
                    executeAction(tokenId, action);
                }}
                role="Assistant" // Tells the modal to read assistantCapabilities
            />
        </div>
    );
};

export default AssistantWorkspace;