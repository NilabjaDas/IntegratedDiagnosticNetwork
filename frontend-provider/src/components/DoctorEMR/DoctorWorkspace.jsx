import React, { useState, useEffect, useMemo } from 'react';
import { Typography, message, Row, Col, Spin } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartmentQueue, updateTokenStatus, completeConsultation, getDoctors, getOrderDetails, recordManualPayment } from '../../redux/apiCalls';
import { updateTokenSuccess } from '../../redux/queueRedux';

import ActivePatientCard from './ActivePatientCard';
import WaitingQueueList from './WaitingQueueList';
import PrescriptionEditor from './PrescriptionEditor';
import EMRDeskPaymentModal from './EMRDeskPaymentModal';

const { Title, Text } = Typography;

const DoctorWorkspace = () => {
    const dispatch = useDispatch();
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [paymentModalData, setPaymentModalData] = useState(null);

    const { queue, isFetching } = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY]);
    const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);

    useEffect(() => {
        fetchDepartmentQueue(dispatch, "Consultation");
        if (doctors.length === 0) getDoctors(dispatch); 
    }, [dispatch, doctors.length]);

    const consultationQueue = useMemo(() => {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return queue.filter(token => token.department === 'Consultation' && token.date === todayStr);
    }, [queue]);

    const inCabinToken = consultationQueue.find(t => t.status === 'IN_CABIN' || t.status === 'CALLED');
    const inProgressToken = consultationQueue.find(t => t.status === 'IN_PROGRESS');

    // --- 🚨 FINANCIAL INTERCEPTOR 🚨 ---
    const handleActionInterceptor = async (tokenId, action) => {
        const token = consultationQueue.find(t => t._id === tokenId);
        
        if (!token.paymentStatus || token.paymentStatus === 'Paid') {
            return executeAction(tokenId, action);
        }

        const doctor = doctors.find(d => d._id === token.doctorId || d.doctorId === token.doctorId);
        const config = doctor?.billingPreferences || { paymentCollectionPoint: 'MANUAL_DESK_COLLECTION', doctorCapabilities: { allowedToCollect: true, allowedModes: ['Cash'], canWaiveFee: true } };

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

    if (isFetching && consultationQueue.length === 0) {
        return <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}><Spin size="large" /></div>;
    }

    return (
        <div style={{ padding: '24px', height: 'calc(100vh - 64px)', overflowY: 'auto', background: '#f0f2f5' }}>
            <div style={{ marginBottom: 24 }}>
                <Title level={3} style={{ margin: 0 }}>Doctor Workspace</Title>
                <Text type="secondary">Manage your active patients and waiting queue.</Text>
            </div>

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
                            onStartConsultation={(id) => handleActionInterceptor(id, 'START')} // <-- Interceptor
                            loading={actionLoadingId === inCabinToken?._id}
                        />
                    </Col>
                    
                    <Col span={24}>
                        <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <Title level={5} style={{ marginBottom: 16 }}>Waiting Queue</Title>
                            <WaitingQueueList 
                                queue={consultationQueue} 
                                onAction={handleActionInterceptor} // <-- Interceptor
                                loadingId={actionLoadingId} 
                            />
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
                role="Doctor" // Tells the modal to read doctorCapabilities (enables Waive Fee)
            />
        </div>
    );
};

export default DoctorWorkspace;