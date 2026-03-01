import React, { useState, useEffect, useMemo } from 'react';
import { Typography, message, Row, Col, Spin, Select, Empty, Card } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartmentQueue, updateTokenStatus, completeConsultation, getDoctors, getOrderDetails, recordManualPayment } from '../../redux/apiCalls';
import { updateTokenSuccess } from '../../redux/queueRedux';

import ActivePatientCard from './ActivePatientCard';
import WaitingQueueList from './WaitingQueueList';
import PrescriptionEditor from './PrescriptionEditor';
import EMRDeskPaymentModal from './EMRDeskPaymentModal';
import ShiftControlBanner from './ShiftControlBanner'; // <-- Import Banner

const { Title, Text } = Typography;
const { Option } = Select;

const DoctorWorkspace = () => {
    const dispatch = useDispatch();
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [paymentModalData, setPaymentModalData] = useState(null);

    // --- STATE FOR SHIFT & DOCTOR FILTERING ---
    const [selectedDoctorId, setSelectedDoctorId] = useState(null);
    const [activeShiftName, setActiveShiftName] = useState(null);

    const { queue, isFetching } = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY]);
    const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);

    useEffect(() => {
        fetchDepartmentQueue(dispatch, "Consultation");
        if (doctors.length === 0) getDoctors(dispatch); 
    }, [dispatch, doctors.length]);

    // Auto-select doctor
    useEffect(() => {
        if (doctors.length === 1 && !selectedDoctorId) {
            setSelectedDoctorId(doctors[0]._id || doctors[0].doctorId);
        }
    }, [doctors, selectedDoctorId]);

    const selectedDoctor = doctors.find(d => d._id === selectedDoctorId || d.doctorId === selectedDoctorId);

    // --- FILTER QUEUE STRICTLY BY SHIFT ---
    const consultationQueue = useMemo(() => {
        if (!selectedDoctorId || !activeShiftName) return [];

        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        return queue.filter(token => 
            token.department === 'Consultation' && 
            token.date === todayStr &&
            (token.doctorId === selectedDoctorId || token.doctorId === selectedDoctor?.doctorId) &&
            token.shiftName === activeShiftName // ONLY SHOW THIS SHIFT
        );
    }, [queue, selectedDoctorId, activeShiftName, selectedDoctor]);

    const inCabinToken = consultationQueue.find(t => t.status === 'IN_CABIN' || t.status === 'CALLED');
    const inProgressToken = consultationQueue.find(t => t.status === 'IN_PROGRESS');

    // --- FINANCIAL INTERCEPTOR ---
    const handleActionInterceptor = async (tokenId, action) => {
        const token = consultationQueue.find(t => t._id === tokenId);
        
        if (!token.paymentStatus || token.paymentStatus === 'Paid') {
            return executeAction(tokenId, action);
        }

        const config = selectedDoctor?.billingPreferences || { paymentCollectionPoint: 'MANUAL_DESK_COLLECTION', doctorCapabilities: { allowedToCollect: true, allowedModes: ['Cash'], canWaiveFee: true } };

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
                    await recordManualPayment({ dbOrderId: token.orderId, amount: due, mode: 'Cash', notes: 'Auto-collected by Doctor' });
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
            if (action === 'START') message.success("Consultation Started");
        } catch (error) {
            message.error("Failed to update status");
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleComplete = async (tokenId, html) => {
        setActionLoadingId(tokenId);
        try {
            const updatedToken = await completeConsultation(tokenId, html);
            dispatch(updateTokenSuccess(updatedToken)); 
            message.success("Prescription saved and consultation completed!");
        } catch (error) {
            message.error("Failed to save prescription");
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div style={{ padding: '24px', height: 'calc(100vh - 64px)', overflowY: 'auto', background: '#f0f2f5' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Title level={3} style={{ margin: 0 }}>Doctor Workspace</Title>
                    <Text type="secondary">Manage your active patients and waiting queue.</Text>
                </div>
                
                {/* DOCTOR SELECTOR */}
                <div style={{ background: '#fff', padding: '8px 16px', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <Text strong style={{ marginRight: 12 }}>My Profile:</Text>
                    <Select 
                        style={{ width: 250 }} 
                        placeholder="Select your profile" 
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
                    role="Doctor" 
                    onActiveShiftChange={(shiftName) => setActiveShiftName(shiftName)} 
                />
            )}

            {!activeShiftName ? (
                <Card style={{ textAlign: 'center', padding: 40, borderRadius: 8 }}>
                    <Empty description={<Text type="secondary" style={{ fontSize: 16 }}>Please start your shift to view your patients.</Text>} />
                </Card>
            ) : (
                <>
                    {inProgressToken ? (
                        <PrescriptionEditor 
                            activeToken={inProgressToken} 
                            onComplete={handleComplete}
                            loading={actionLoadingId === inProgressToken._id}
                        />
                    ) : (
                        <Row gutter={24}>
                            <Col span={24} style={{ marginBottom: 24 }}>
                                <ActivePatientCard 
                                    activeToken={inCabinToken} 
                                    onStartConsultation={(id) => handleActionInterceptor(id, 'START')} 
                                    loading={actionLoadingId === inCabinToken?._id}
                                />
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
                </>
            )}

            <EMRDeskPaymentModal 
                visible={!!paymentModalData} 
                data={paymentModalData} 
                onCancel={() => setPaymentModalData(null)} 
                onSuccess={(tokenId, action) => {
                    setPaymentModalData(null);
                    executeAction(tokenId, action);
                }}
                role="Doctor"
            />
        </div>
    );
};

export default DoctorWorkspace;