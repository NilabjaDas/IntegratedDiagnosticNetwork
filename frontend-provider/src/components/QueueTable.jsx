import React from 'react';
import { Table, Tag, Button, Space, Tooltip } from 'antd';
import { PlayCircleOutlined, CheckCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';

const QueueTable = ({ queue, handleAction, selectedCounter }) => {
    
    const columns = [
        {
            title: 'Token',
            dataIndex: 'tokenNumber',
            key: 'tokenNumber',
            render: (text) => <strong style={{ fontSize: '1.2em' }}>{text}</strong>,
        },
        {
            title: 'Patient Name',
            dataIndex: ['patientDetails', 'name'],
            key: 'patientName',
            render: (text) => text || 'Walk-in Patient',
        },
        {
            title: 'Tests Requested',
            key: 'tests',
            render: (_, record) => (
                <>
                    {record.tests?.map((test, index) => (
                        <Tag color="blue" key={index}>{test.name}</Tag>
                    ))}
                </>
            ),
        },
        {
            title: 'Status & Location',
            key: 'status',
            render: (_, record) => {
                let color = record.status === 'WAITING' ? 'default' : 
                            record.status === 'CALLED' ? 'processing' : 
                            record.status === 'IN_PROGRESS' ? 'success' : 'warning';
                return (
                    <div>
                        <Tag color={color} style={{ fontSize: '13px', padding: '4px 10px', marginBottom: '4px' }}>
                            {record.status}
                        </Tag>
                        {record.assignedCounterName && (
                            <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                Desk: {record.assignedCounterName}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Actions',
            key: 'action',
            render: (_, record) => {
                // Determine if this specific row is assigned to the current staff member's desk
                const isMyPatient = selectedCounter && record.assignedCounterId === selectedCounter.counterId;

                return (
                    <Space size="middle">
                        {record.status === 'CALLED' && isMyPatient && (
                            <>
                                <Button type="default" style={{ color: '#52c41a', borderColor: '#52c41a' }} icon={<PlayCircleOutlined />} onClick={() => handleAction(record._id, 'START')}>
                                    Start Test
                                </Button>
                                <Button danger onClick={() => handleAction(record._id, 'HOLD')}>No Show</Button>
                            </>
                        )}
                        {record.status === 'IN_PROGRESS' && isMyPatient && (
                            <Button type="primary" style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => handleAction(record._id, 'COMPLETE')}>
                                Complete
                            </Button>
                        )}
                        {record.status === 'HOLD' && (
                            <Tooltip title="Flash TV Screen again">
                                <Button type="dashed" onClick={() => handleAction(record._id, 'RECALL')}>Recall</Button>
                            </Tooltip>
                        )}
                        {/* Note: 'WAITING' status has no actions here anymore. They must use the green "Call Next Patient" button at the top! */}
                    </Space>
                );
            },
        },
    ];

    const dataSource = queue.map(item => ({ ...item, key: item._id }));

    return (
        <Table 
            columns={columns} 
            dataSource={dataSource} 
            pagination={false} 
            rowClassName={(record) => {
                // Highlight rows that belong to the current logged-in desk
                if (selectedCounter && record.assignedCounterId === selectedCounter.counterId) {
                    return 'row-highlight-mine';
                }
                return '';
            }}
        />
    );
};

export default QueueTable;