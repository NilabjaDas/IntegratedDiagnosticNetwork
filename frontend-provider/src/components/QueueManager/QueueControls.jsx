import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Select, Button, Space, Statistic, Divider, Radio, message } from 'antd';
import { DesktopOutlined, NotificationOutlined } from '@ant-design/icons';
import { callNextPatientInQueue, updateCounterStatus } from '../../redux/apiCalls';

const { Option } = Select;

const ControlsWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
`;

const QueueControls = ({ department, setDepartment, selectedCounter, setSelectedCounter, config, queueData, dispatch }) => {
    const [counterStatus, setCounterStatus] = useState("Offline");

    const waitingCount = queueData.filter(q => q.status === 'WAITING').length;
    const myActivePatients = queueData.filter(q => 
        selectedCounter && 
        q.assignedCounterId === selectedCounter.counterId && 
        ['CALLED', 'IN_PROGRESS'].includes(q.status)
    ).length;

    // Filter counters to only show ones for the currently selected department
    const availableCounters = config.counters?.filter(c => c.department === department);

    // Handle Staff toggling their desk Online/Paused
    const handleStatusChange = async (e) => {
        const newStatus = e.target.value;
        if (!selectedCounter) {
            message.warning("Please select a counter first.");
            return;
        }
        setCounterStatus(newStatus);
        await updateCounterStatus(selectedCounter.counterId, newStatus);
    };

    // Master Call Next Button
    const handleCallNext = async () => {
        if (!selectedCounter) {
            message.error("You must select your physical counter/desk to call a patient.");
            return;
        }
        if (counterStatus !== "Online") {
            message.warning("Your counter is currently Paused or Offline.");
            return;
        }
        
        await callNextPatientInQueue(dispatch, department, selectedCounter.counterId, selectedCounter.name);
    };

    const openTvDisplay = () => {
        window.open(`/tv-display/${department}`, '_blank');
    };

    return (
        <ControlsWrapper>
            <Space split={<Divider type="vertical" />}>
                <Statistic title="Global Waiting" value={waitingCount} valueStyle={{ color: '#cf1322' }} />
                <Statistic title="My Active" value={myActivePatients} valueStyle={{ color: '#096dd9' }} />
            </Space>

            <Select 
                value={department} 
                onChange={setDepartment} 
                style={{ width: 160 }}
                size="large"
            >
                {config.departments?.map(dept => (
                    <Option key={dept} value={dept}>{dept}</Option>
                ))}
            </Select>

            <Select 
                placeholder="Select Your Desk"
                value={selectedCounter?.counterId || null} 
                onChange={(val) => {
                    const counter = availableCounters.find(c => c.counterId === val);
                    setSelectedCounter(counter);
                    setCounterStatus(counter.status || "Offline");
                }} 
                style={{ width: 160 }}
                size="large"
            >
                {availableCounters?.map(c => (
                    <Option key={c.counterId} value={c.counterId}>{c.name}</Option>
                ))}
            </Select>

            <Radio.Group 
                value={counterStatus} 
                onChange={handleStatusChange} 
                buttonStyle="solid"
                disabled={!selectedCounter}
            >
                <Radio.Button value="Offline">Offline</Radio.Button>
                <Radio.Button value="Paused">Paused</Radio.Button>
                <Radio.Button value="Online">Online</Radio.Button>
            </Radio.Group>

            <Button 
                type="primary" 
                icon={<NotificationOutlined />} 
                size="large"
                onClick={handleCallNext}
                disabled={!selectedCounter || waitingCount === 0 || counterStatus !== "Online"}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
                Call Next Patient
            </Button>

            <Button 
                type="default" 
                icon={<DesktopOutlined />} 
                size="large"
                onClick={openTvDisplay}
            >
                TV
            </Button>
        </ControlsWrapper>
    );
};

export default QueueControls;