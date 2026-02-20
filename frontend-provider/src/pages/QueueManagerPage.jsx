// frontend-provider/src/pages/QueueManager/QueueManagerPage.jsx
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { Layout, Typography, Card } from 'antd';
import { fetchDepartmentQueue, updateTokenStatus } from '../redux/apiCalls';
import QueueControls from '../components/QueueControls';
import QueueTable from '../components/QueueTable';

const { Title } = Typography;
const { Content } = Layout;

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
    
    // Default to user's assigned department if available, else Pathology
    const [department, setDepartment] = useState('Pathology'); 

    useEffect(() => {
        if (department) {
            fetchDepartmentQueue(dispatch, department);
        }
    }, [dispatch, department]);

    const handleAction = async (tokenId, action) => {
        try {
            await updateTokenStatus(dispatch, tokenId, action);
        } catch (error) {
            console.error(`Action ${action} failed`, error);
        }
    };

    return (
        <Container>
            <HeaderSection>
                <Title level={2} style={{ margin: 0 }}>{department} Live Queue</Title>
                <QueueControls 
                    department={department} 
                    setDepartment={setDepartment} 
                    queueData={queue}
                />
            </HeaderSection>
            
            <Card bodyStyle={{ padding: 0 }} bordered={false} style={{ borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <QueueTable queue={queue} handleAction={handleAction} />
            </Card>
        </Container>
    );
};

export default QueueManagerPage;