import React, { useState } from 'react';
import { Table, Button, Input, Tag, Space, Card, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';

const ClinicalMedicineTable = ({ medicines, loading, onEdit, onDelete }) => {
    const [searchText, setSearchText] = useState("");

    const filteredMedicines = medicines.filter(m => 
        m.name?.toLowerCase().includes(searchText.toLowerCase()) || 
        m.brand?.toLowerCase().includes(searchText.toLowerCase()) ||
        m.shortName?.toLowerCase().includes(searchText.toLowerCase()) ||
        m.treatmentFor?.some(t => t.toLowerCase().includes(searchText.toLowerCase()))
    );

    const columns = [
        { 
            title: 'Medicine Name', 
            dataIndex: 'name', 
            key: 'name', 
            render: (text, record) => (
                <strong>
                    {text} {record.shortName && <span style={{color: '#888', fontWeight: 'normal', fontSize: 12}}>({record.shortName})</span>}
                </strong>
            ) 
        },
        { title: 'Brand', dataIndex: 'brand', key: 'brand' },
        { title: 'Type', dataIndex: 'type', key: 'type', render: text => <Tag color="blue">{text}</Tag> },
        { title: 'Strength', dataIndex: 'strength', key: 'strength' },
        { 
            title: 'Demographic', 
            dataIndex: 'targetDemographic', 
            key: 'targetDemographic',
            render: text => text === 'All Ages' ? <span style={{color: '#888'}}>All Ages</span> : <Tag color="purple">{text}</Tag>
        },
        { 
            title: 'Indications', 
            dataIndex: 'treatmentFor', 
            key: 'treatmentFor', 
            render: tags => tags?.map(t => <Tag key={t}>{t}</Tag>) 
        },
        { 
            title: 'Status', 
            dataIndex: 'isActive', 
            key: 'isActive', 
            render: active => active ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag> 
        },
        { 
            title: 'Actions', 
            key: 'actions', 
            width: 100,
            render: (_, record) => (
                <Space>
                    <Button type="text" icon={<EditOutlined style={{ color: '#1890ff' }} />} onClick={() => onEdit(record)} />
                    <Popconfirm title="Delete this medicine?" onConfirm={() => onDelete(record._id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Card bodyStyle={{ padding: '24px' }} style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ marginBottom: 16 }}>
                <Input
                    placeholder="Search medicine by name, generic, brand, or indication..."
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    style={{ width: 350 }}
                    allowClear
                />
            </div>
            <Table 
                columns={columns} 
                dataSource={filteredMedicines} 
                rowKey="_id" 
                loading={loading} 
                pagination={{ pageSize: 10, showSizeChanger: true }}
                size="middle"
            />
        </Card>
    );
};

export default ClinicalMedicineTable;