import React, { useState, useEffect, useMemo } from 'react';
import { Typography, message, Row, Col, Card, Avatar, Space, Tag, Spin, Select, Empty } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartmentQueue, updateTokenStatus, getDoctors, getOrderDetails, recordManualPayment } from '../../redux/apiCalls';
import { updateTokenSuccess } from '../../redux/queueRedux';

import WaitingQueueList from './WaitingQueueList';
import EMRDeskPaymentModal from './EMRDeskPaymentModal';
import ShiftControlBanner from './ShiftControlBanner'; // <-- Import Banner

const { Title, Text } = Typography;
const { Option } = Select;

const AssistantWorkspace = () => {
    const dispatch = useDispatch();
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [paymentModalData, setPaymentModalData] = useState(null);
    
    // --- NEW STATE FOR SHIFT & DOCTOR FILTERING ---
    const [selectedDoctorId, setSelectedDoctorId] = useState(null);
    const [activeShiftName, setActiveShiftName] = useState(null);

    const { queue, isFetching } = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY]);
    const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);

    useEffect(() => {
        fetchDepartmentQueue(dispatch, "Consultation");
        if (doctors.length === 0) getDoctors(dispatch); 
    }, [dispatch, doctors.length]);

    // Auto-select doctor if there is only 1
    useEffect(() => {
        if (doctors.length === 1 && !selectedDoctorId) {
            setSelectedDoctorId(doctors[0]._id || doctors[0].doctorId);
        }
    }, [doctors, selectedDoctorId]);

    const selectedDoctor = doctors.find(d => d._id === selectedDoctorId || d.doctorId === selectedDoctorId);

    // --- FILTER QUEUE STRICTLY BY SHIFT ---
    const consultationQueue = useMemo(() => {
        if (!selectedDoctorId || !activeShiftName) return []; // LOCK THE QUEUE IF NO SHIFT IS ACTIVE

        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        return queue.filter(token => 
            token.department === 'Consultation' && 
            token.date === todayStr &&
            (token.doctorId === selectedDoctorId || token.doctorId === selectedDoctor?.doctorId) &&
            token.shiftName === activeShiftName // ONLY SHOW THIS SHIFT'S PATIENTS!
        );
    }, [queue, selectedDoctorId, activeShiftName, selectedDoctor]);

    const activeToken = consultationQueue.find(t => t.status === 'IN_CABIN' || t.status === 'CALLED' || t.status === 'IN_PROGRESS');

    // --- FINANCIAL INTERCEPTOR ---
    const handleActionInterceptor = async (tokenId, action) => {
        const token = consultationQueue.find(t => t._id === tokenId);
        
        if (!token.paymentStatus || token.paymentStatus === 'Paid') {
            return executeAction(tokenId, action);
        }

        const config = selectedDoctor?.billingPreferences || { paymentCollectionPoint: 'MANUAL_DESK_COLLECTION', assistantCapabilities: { allowedToCollect: true, allowedModes: ['Cash'] } };

        if (config.paymentCollectionPoint === 'STRICT_PREPAID') {
            message.error("Strict Policy: Patient must complete payment at Reception before proceeding.");
            return;
        }

        if (config.paymentCollectionPoint === 'AUTO_PAY_ON_CONSULT') {
            await handleAutoPayAndProceed(token, action);
            return;
        }

        setPaymentModalData({ token, action, config });
    };

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

    return (
        <div style={{ padding: '24px', height: 'calc(100vh - 64px)', overflowY: 'auto', background: '#f0f2f5' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Assistant Workspace</Title>
                    <Text type="secondary">Manage the waiting queue and send patients to the Doctor's Cabin.</Text>
                </div>
                
                {/* DOCTOR SELECTOR */}
                <div style={{ background: '#fff', padding: '8px 16px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <Text strong style={{ marginRight: 12 }}>Select Doctor:</Text>
                    <Select 
                        style={{ width: 250 }} 
                        placeholder="Choose Doctor to manage" 
                        value={selectedDoctorId} 
                        onChange={setSelectedDoctorId}
                    >
                        {doctors.map(d => (
                            <Option key={d._id || d.doctorId} value={d._id || d.doctorId}>
                                Dr. {d.personalInfo?.firstName} {d.personalInfo?.lastName}
                            </Option>
                        ))}
                    </Select>
                </div>
            </div>

            {selectedDoctor && (
                <ShiftControlBanner 
                    doctor={selectedDoctor} 
                    role="Assistant" 
                    onActiveShiftChange={(shiftName) => setActiveShiftName(shiftName)} 
                />
            )}

            {!activeShiftName ? (
                <Card style={{ textAlign: 'center', padding: 40, borderRadius: 8 }}>
                    <Empty description={<Text type="secondary" style={{ fontSize: 16 }}>Please start a shift to view the waiting queue.</Text>} />
                </Card>
            ) : (
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
                            <Title level={5} style={{ marginBottom: 16 }}>Waiting Queue ({activeShiftName})</Title>
                            {isFetching && consultationQueue.length === 0 ? <Spin /> : (
                                <WaitingQueueList 
                                    queue={consultationQueue} 
                                    onAction={handleActionInterceptor} 
                                    loadingId={actionLoadingId} 
                                />
                            )}
                        </div>
                    </Col>
                </Row>
            )}

            <EMRDeskPaymentModal 
                visible={!!paymentModalData} 
                data={paymentModalData} 
                onCancel={() => setPaymentModalData(null)} 
                onSuccess={(tokenId, action) => {
                    setPaymentModalData(null);
                    executeAction(tokenId, action);
                }}
                role="Assistant" 
            />
        </div>
    );
};

export default AssistantWorkspace;