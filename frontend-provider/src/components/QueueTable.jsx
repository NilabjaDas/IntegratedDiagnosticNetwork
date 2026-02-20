// frontend-provider/src/pages/QueueManager/components/QueueTable.jsx
import React from 'react';
import { Table, Tag, Button, Space } from 'antd';
import { PlayCircleOutlined, CheckCircleOutlined, PauseCircleOutlined, SoundOutlined } from '@ant-design/icons';

const QueueTable = ({ queue, handleAction }) => {
    
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
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                let color = status === 'WAITING' ? 'default' : 
                            status === 'CALLED' ? 'processing' : 
                            status === 'IN_PROGRESS' ? 'success' : 'warning';
                return <Tag color={color} style={{ fontSize: '14px', padding: '4px 10px' }}>{status}</Tag>;
            },
        },
        {
            title: 'Actions',
            key: 'action',
            render: (_, record) => (
                <Space size="middle">
                    {record.status === 'WAITING' && (
                        <Button type="primary" icon={<SoundOutlined />} onClick={() => handleAction(record._id, 'CALL')}>
                            Call Patient
                        </Button>
                    )}
                    {record.status === 'CALLED' && (
                        <>
                            <Button type="default" style={{ color: '#52c41a', borderColor: '#52c41a' }} icon={<PlayCircleOutlined />} onClick={() => handleAction(record._id, 'START')}>
                                Start
                            </Button>
                            <Button danger onClick={() => handleAction(record._id, 'HOLD')}>No Show (Hold)</Button>
                        </>
                    )}
                    {record.status === 'IN_PROGRESS' && (
                        <Button type="primary" style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => handleAction(record._id, 'COMPLETE')}>
                            Complete Test
                        </Button>
                    )}
                    {record.status === 'HOLD' && (
                        <Button type="dashed" onClick={() => handleAction(record._id, 'CALL')}>Recall</Button>
                    )}
                </Space>
            ),
        },
    ];

    // AntD requires a 'key' prop on data source arrays
    const dataSource = queue.map(item => ({ ...item, key: item._id }));

    return (
        <Table 
            columns={columns} 
            dataSource={dataSource} 
            pagination={false} 
            rowClassName={(record) => record.status === 'CALLED' ? 'row-highlight-called' : ''}
        />
    );
};

export default QueueTable;