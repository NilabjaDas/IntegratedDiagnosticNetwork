// frontend-provider/src/pages/QueueManager/components/QueueControls.jsx
import React from 'react';
import styled from 'styled-components';
import { Select, Button, Space, Statistic, Divider } from 'antd';
import { DesktopOutlined } from '@ant-design/icons';

const { Option } = Select;

const ControlsWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;

const QueueControls = ({ department, setDepartment, queueData }) => {
    
    const waitingCount = queueData.filter(q => q.status === 'WAITING').length;

    const openTvDisplay = () => {
        // Opens the TV screen in a new tab to drag to an external monitor
        window.open(`/tv-display/${department}`, '_blank');
    };

    return (
        <ControlsWrapper>
            <Space split={<Divider type="vertical" />}>
                <Statistic title="Waiting" value={waitingCount} valueStyle={{ color: '#cf1322' }} />
                <Statistic title="Total Today" value={queueData.length} />
            </Space>

            <Select 
                value={department} 
                onChange={setDepartment} 
                style={{ width: 180 }}
                size="large"
            >
                <Option value="Pathology">Pathology Desk</Option>
                <Option value="Radiology">Radiology Room 1</Option>
                <Option value="Cardiology">Cardiology</Option>
            </Select>

            <Button 
                type="primary" 
                icon={<DesktopOutlined />} 
                size="large"
                onClick={openTvDisplay}
                style={{ backgroundColor: '#2f54eb', borderColor: '#2f54eb' }}
            >
                Launch TV Display
            </Button>
        </ControlsWrapper>
    );
};

export default QueueControls;