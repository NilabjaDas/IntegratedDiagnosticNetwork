import React, { useState, useEffect, useMemo } from 'react';
import { Typography, message, Row, Col, Spin } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartmentQueue, updateTokenStatus, completeConsultation } from '../../redux/apiCalls';
import { updateTokenSuccess } from '../../redux/queueRedux';

import ActivePatientCard from './ActivePatientCard';
import WaitingQueueList from './WaitingQueueList';
import PrescriptionEditor from './PrescriptionEditor';

const { Title, Text } = Typography;

const DoctorWorkspace = () => {
    const dispatch = useDispatch();
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // 1. Pull the live queue directly from Redux
    const { queue, isFetching } = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY]);
    // 2. Fetch initial data on mount
    useEffect(() => {
        fetchDepartmentQueue(dispatch, "Consultation");
    }, [dispatch]);

    // --- CRITICAL FIX: FILTER OUT PATHOLOGY/RADIOLOGY TOKENS ---
// --- UI VIEW LAYER FILTERING ---
    const consultationQueue = useMemo(() => {
        // Generate today's date in YYYY-MM-DD format
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        return queue.filter(token => 
            token.department === 'Consultation' && 
            token.date === todayStr // <-- Protects the Live UI from future bookings!
        );
    }, [queue]);

    // 3. Derive current states from the FILTERED queue
    const inCabinToken = consultationQueue.find(t => t.status === 'IN_CABIN' || t.status === 'CALLED');
    const inProgressToken = consultationQueue.find(t => t.status === 'IN_PROGRESS');

    // --- HANDLERS USING YOUR DEFINED API CALLS ---

    const handleAction = async (tokenId, action) => {
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
            // Manually update Redux so the UI clears the patient immediately
            dispatch(updateTokenSuccess(updatedToken)); 
            message.success("Prescription saved and consultation completed!");
        } catch (error) {
            message.error("Failed to save prescription");
        } finally {
            setActionLoadingId(null);
        }
    };

    // Use filtered queue to determine if we should show the spinner
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
                            onStartConsultation={(id) => handleAction(id, 'START')}
                            loading={actionLoadingId === inCabinToken?._id}
                        />
                    </Col>
                    
                    <Col span={24}>
                        <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                            <Title level={5} style={{ marginBottom: 16 }}>Waiting Queue</Title>
                            <WaitingQueueList 
                                queue={consultationQueue} // <-- Pass the FILTERED array here
                                onAction={handleAction} 
                                loadingId={actionLoadingId} 
                            />
                        </div>
                    </Col>
                </Row>
            )}
        </div>
    );
};

export default DoctorWorkspace;