import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { Layout, Typography, Card, message } from 'antd';
import { fetchDepartmentQueue, updateTokenStatus, fetchQueueCounters } from '../redux/apiCalls';
import QueueControls from '../components/QueueManager/QueueControls';
import QueueTable from '../components/QueueManager/QueueTable';

const { Title } = Typography;

const Container = styled.div`
  padding: 24px;
  background-color: #f0f2f5;
  min-height: 100vh;
`;

const HeaderSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const QueueManagerPage = () => {
    const dispatch = useDispatch();
    const queue = useSelector((state) => state[process.env.REACT_APP_QUEUE_DATA_KEY]?.queue || []); 
    
    // UI State
    const [department, setDepartment] = useState(''); 
    const [selectedCounter, setSelectedCounter] = useState(null);
    
    // Configuration Data from Backend
    const [config, setConfig] = useState({ departments: [], counters: [] });

    // 1. Initial Load: Fetch Physical Infrastructure
    useEffect(() => {
        const loadConfig = async () => {
            const data = await fetchQueueCounters();
            if (data) {
                setConfig(data);
                if (data.departments.length > 0) {
                    setDepartment(data.departments[0]);
                }
            }
        };
        loadConfig();
    }, []);

    // 2. Fetch Live Queue when Department changes
    useEffect(() => {
        if (department ) {
            fetchDepartmentQueue(dispatch, department);
            // Reset counter selection if they change departments
            setSelectedCounter(null); 
        }
    }, [dispatch, department]);

    // 3. Action Handler for Start/Complete/Hold
    const handleAction = async (tokenId, action) => {
        try {
            await updateTokenStatus(dispatch, tokenId, action);
            message.success(`Status updated to ${action}`);
        } catch (error) {
            message.error("Action failed");
        }
    };

    return (
        <Container>
            <HeaderSection>
                <Title level={2} style={{ margin: 0 }}>{department || 'Loading...'} Live Queue</Title>
                <QueueControls 
                    department={department} 
                    setDepartment={setDepartment} 
                    selectedCounter={selectedCounter}
                    setSelectedCounter={setSelectedCounter}
                    config={config}
                    queueData={queue}
                    dispatch={dispatch}
                />
            </HeaderSection>
            
            <Card bodyStyle={{ padding: 0 }} bordered={false} style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <QueueTable 
                    queue={queue} 
                    handleAction={handleAction} 
                    selectedCounter={selectedCounter}
                />
            </Card>
        </Container>
    );
};

export default QueueManagerPage;