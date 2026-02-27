import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Table, Input, message, Tag, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { userRequest } from '../../requestMethods';

const ClinicalMasterImportModal = ({ visible, onClose, onImport, loading, existingTests = [] }) => {
    const [masterTests, setMasterTests] = useState([]);
    const [fetching, setFetching] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    // Extract an array of masterTestIds that are already in the institution's catalog
    const importedMasterIds = useMemo(() => {
        return existingTests.map(t => t.masterTestId).filter(Boolean);
    }, [existingTests]);

    useEffect(() => {
        if (visible) {
            fetchMasterCatalog();
            setSelectedRowKeys([]); // Reset selection when opening
            setSearchText("");
        }
    }, [visible]);

    const fetchMasterCatalog = async () => {
        setFetching(true);
        try {
            const res = await userRequest.get("/catalog/tests"); 
            setMasterTests(res.data || []);
        } catch (error) {
            message.error("Failed to load master catalog.");
        }
        setFetching(false);
    };

    const handleImportClick = () => {
        if (selectedRowKeys.length === 0) return;

        // Find the full test objects that were selected
        const selectedTests = masterTests.filter(t => selectedRowKeys.includes(t._id));
        
        // Map them to match the ClinicalTest schema format
        const payload = selectedTests.map(t => ({
            name: t.name,
            alias: t.shortName || t.alias || "", 
            department: t.department || "Pathology",
            category: t.category || "General",
            masterTestId: t._id, 
            isActive: true
        }));

        onImport(payload); 
    };

    const filteredTests = masterTests.filter(t => 
        t.name?.toLowerCase().includes(searchText.toLowerCase()) || 
        t.department?.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns = [
        { 
            title: 'Test Name', 
            dataIndex: 'name', 
            key: 'name', 
            render: (text, record) => {
                const isImported = importedMasterIds.includes(record._id);
                return (
                    <Space>
                        <strong style={{ color: isImported ? '#bfbfbf' : 'inherit' }}>{text}</strong>
                        {isImported && <Tag color="default">Already Added</Tag>}
                    </Space>
                );
            } 
        },
        { title: 'Department', dataIndex: 'department', key: 'department', render: text => <Tag color="geekblue">{text}</Tag> },
        { title: 'Category', dataIndex: 'category', key: 'category' }
    ];

    return (
        <Modal
            title="Import from Master Catalog"
            open={visible}
            onCancel={onClose}
            width={800}
            okText={`Import ${selectedRowKeys.length} Tests`}
            onOk={handleImportClick}
            confirmLoading={loading}
            okButtonProps={{ disabled: selectedRowKeys.length === 0 }}
            destroyOnClose
        >
            <div style={{ marginBottom: 16, marginTop: 16 }}>
                <Input
                    placeholder="Search master catalog by name or department..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                />
            </div>

            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: newSelectedRowKeys => setSelectedRowKeys(newSelectedRowKeys),
                    preserveSelectedRowKeys: true, // <--- FIX: Keeps selections active during search filtering!
                    getCheckboxProps: (record) => ({
                        disabled: importedMasterIds.includes(record._id), // <--- FIX: Greys out the checkbox if already imported
                    }),
                }}
                columns={columns}
                dataSource={filteredTests}
                rowKey="_id"
                loading={fetching}
                pagination={{ pageSize: 10 }}
                size="small"
                scroll={{ y: 400 }}
            />
        </Modal>
    );
};

export default ClinicalMasterImportModal;