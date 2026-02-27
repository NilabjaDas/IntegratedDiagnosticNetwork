import React from 'react';
import { Table, Button, Tag, Space, Typography } from 'antd';
import { NotificationOutlined, PauseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const WaitingQueueList = ({ queue, onAction, loadingId }) => {
    
    // Only show patients who are waiting or on hold
    const displayQueue = queue.filter(t => t.status === 'WAITING' || t.status === 'HOLD');

    const columns = [
        {
            title: 'Token',
            dataIndex: 'tokenNumber',
            key: 'token',
            width: 100,
            render: (text, record) => (
                <Tag color={record.priority > 0 ? "volcano" : "blue"} style={{ fontWeight: 'bold', fontSize: 14 }}>
                    {text}
                </Tag>
            )
        },
        {
            title: 'Patient Name',
            key: 'name',
            render: (_, record) => (
                <div>
                    <Text strong>{record.patientDetails?.name || record.patientName}</Text>
                    <div style={{ fontSize: 12, color: '#888' }}>
                        {record.patientDetails?.age} Yrs • {record.patientDetails?.gender}
                    </div>
                </div>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: status => (
                <Tag color={status === 'HOLD' ? 'orange' : 'default'}>{status}</Tag>
            )
        },
        {
            title: 'Action',
            key: 'action',
            align: 'right',
            render: (_, record) => (
                <Space>
                    {record.status === 'WAITING' && (
                        <Button 
                            type="primary" 
                            ghost 
                            icon={<NotificationOutlined />}
                            loading={loadingId === record._id}
                            onClick={() => onAction(record._id, 'SEND_TO_CABIN')}
                        >
                            Call to Cabin
                        </Button>
                    )}
                    {record.status === 'HOLD' && (
                        <Button 
                            type="dashed" 
                            icon={<NotificationOutlined />}
                            loading={loadingId === record._id}
                            onClick={() => onAction(record._id, 'SEND_TO_CABIN')}
                        >
                            Recall
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <Table 
            columns={columns} 
            dataSource={displayQueue} 
            rowKey="_id" 
            pagination={false}
            size="middle"
            locale={{ emptyText: "Queue is empty." }}
        />
    );
};

export default WaitingQueueList;