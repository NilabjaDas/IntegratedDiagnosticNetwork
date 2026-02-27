import React, { useState } from 'react';
import { Table, Button, Input, Tag, Space, Card, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';

const ClinicalTestTable = ({ tests, loading, onEdit, onDelete }) => {
    const [searchText, setSearchText] = useState("");

    const filteredTests = tests.filter(t => 
        t.name?.toLowerCase().includes(searchText.toLowerCase()) || 
        t.alias?.toLowerCase().includes(searchText.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns = [
        { 
            title: 'Test Name', 
            dataIndex: 'name', 
            key: 'name', 
            render: (text, record) => (
                <strong>
                    {text} {record.alias && <span style={{color: '#888', fontWeight: 'normal', fontSize: 12}}>({record.alias})</span>}
                </strong>
            ) 
        },
        { title: 'Department', dataIndex: 'department', key: 'department', render: text => <Tag color="geekblue">{text}</Tag> },
        { title: 'Category', dataIndex: 'category', key: 'category' },
        { 
            title: 'Source', 
            key: 'source', 
            render: (_, record) => record.masterTestId ? <Tag color="purple">Catalog</Tag> : <Tag color="orange">Custom</Tag> 
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
                    <Popconfirm title="Delete this test?" onConfirm={() => onDelete(record._id)}>
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
                    placeholder="Search test by name, alias, or category..."
                    prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    style={{ width: 350 }}
                    allowClear
                />
            </div>
            <Table 
                columns={columns} 
                dataSource={filteredTests} 
                rowKey="_id" 
                loading={loading} 
                pagination={{ pageSize: 10, showSizeChanger: true }}
                size="middle"
            />
        </Card>
    );
};

export default ClinicalTestTable;