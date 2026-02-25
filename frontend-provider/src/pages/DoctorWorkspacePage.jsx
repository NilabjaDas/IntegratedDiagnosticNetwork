import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, message, Form, Button, Modal, Input, TimePicker, InputNumber, DatePicker } from 'antd';
import dayjs from 'dayjs';

// API Calls
import { getDoctors, fetchDoctorQueue, updateTokenStatus, completeConsultation, createSpecialShift } from '../redux/apiCalls';

// Modular Components
import WorkspaceHeader from '../components/Doctor EMR/WorkspaceHeader';
import WorkspaceQueueList from '../components/Doctor EMR/WorkspaceQueueList';
import WorkspaceEditor from '../components/Doctor EMR/WorkspaceEditor';

const PageContainer = styled.div`
  padding: 24px;
  background-color: #f4f6f8;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const DoctorWorkspacePage = () => {
    const dispatch = useDispatch();
    const doctors = useSelector((state) => state[process.env.REACT_APP_DOCTORS_KEY]?.doctors || []);
    
    // State
    const [selectedDoctorId, setSelectedDoctorId] = useState(null);
    const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
    const [queue, setQueue] = useState([]);
    const [loadingQueue, setLoadingQueue] = useState(false);


    // Active Consultation State
    const [activeToken, setActiveToken] = useState(null);
    const [prescriptionContent, setPrescriptionContent] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getDoctors(dispatch);
    }, [dispatch]);

    useEffect(() => {
        if (selectedDoctorId && selectedDate) {
            loadQueue();
        } else {
            setQueue([]);
            setActiveToken(null);
        }
    }, [selectedDoctorId, selectedDate]);

    const loadQueue = async () => {
        setLoadingQueue(true);
        try {
            const data = await fetchDoctorQueue(selectedDate, selectedDoctorId);
            setQueue(data);
            
            // Re-sync active token if it exists in the new data
            const currentActive = data.find(t => t.status === 'IN_PROGRESS');
            if (currentActive) {
                setActiveToken(currentActive);
                // Only override editor if it's empty, so we don't wipe out unsaved typing
                setPrescriptionContent(prev => prev ? prev : (currentActive.prescriptionHtml || ""));
            }
        } catch (error) {
            message.error("Failed to load queue.");
        }
        setLoadingQueue(false);
    };

    // --- WORKFLOW ACTIONS ---

    // 1. Doctor clicks "Call to Cabin"
    const handlePingTV = async (token) => {
        try {
            // FIX: Added 'dispatch' as the first argument
            await updateTokenStatus(dispatch, token._id, 'RECALL'); 
            message.success(`Patient ${token.tokenNumber} announced on TV screen.`);
            loadQueue(); 
        } catch (error) {
            message.error("Failed to ping TV.");
        }
    };
    // 2. Patient walks in, Doctor clicks "Start"
  const handleStartConsultation = async (token) => {
        try {
            // FIX: Added 'dispatch' as the first argument
            await updateTokenStatus(dispatch, token._id, 'START');
            message.success("Consultation Started");
            setActiveToken(token);
            setPrescriptionContent(token.prescriptionHtml || "");
            loadQueue(); 
        } catch (error) {
            message.error("Failed to start consultation.");
        }
    };

    // 3. Doctor clicks "Hold" (e.g., waiting for lab test)
    const handleHoldConsultation = async (token) => {
        try {
            // FIX: Added 'dispatch' as the first argument
            await updateTokenStatus(dispatch, token._id, 'HOLD');
            message.info("Patient placed on hold.");
            setActiveToken(null);
            setPrescriptionContent("");
            loadQueue();
        } catch (error) {
            message.error("Failed to hold consultation.");
        }
    };

    // 4. Doctor completes the visit (No dispatch needed for this one in apiCalls)
    const handleSavePrescription = async (tokenId, htmlContent) => {
        setSaving(true);
        try {
            await completeConsultation(tokenId, htmlContent);
            message.success("Consultation Completed & Prescription Saved!");
            setActiveToken(null);
            setPrescriptionContent("");
            loadQueue();
        } catch (error) {
            message.error("Failed to save prescription.");
        }
        setSaving(false);
    };

    return (
        <PageContainer>




            <WorkspaceHeader 
                doctors={doctors}
                selectedDoctorId={selectedDoctorId}
                setSelectedDoctorId={setSelectedDoctorId}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
            />

            {selectedDoctorId && (
                <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
                    
                    <Col span={8} style={{ display: 'flex', flexDirection: 'column' }}>
                        <WorkspaceQueueList 
                            queue={queue}
                            loadingQueue={loadingQueue}
                            activeToken={activeToken}
                            onPingTV={handlePingTV}
                            onStartConsultation={handleStartConsultation}
                        />
                    </Col>
                    <Col span={16} style={{ display: 'flex', flexDirection: 'column' }}>
                        <WorkspaceEditor 
                            activeToken={activeToken}
                            prescriptionContent={prescriptionContent}
                            setPrescriptionContent={setPrescriptionContent}
                            onSave={handleSavePrescription}
                            onHold={handleHoldConsultation}
                            saving={saving}
                        />
                    </Col>
                </Row>
            )}
        </PageContainer>
    );
};

export default DoctorWorkspacePage;