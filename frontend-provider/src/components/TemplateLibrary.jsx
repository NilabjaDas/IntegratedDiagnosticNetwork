import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Table, Button, Modal, Tag, Form, Input, message, Empty } from "antd";
import { CloudDownloadOutlined, AppstoreAddOutlined } from "@ant-design/icons";
import { useSelector, useDispatch } from "react-redux";
import { getTemplateLibrary, importTemplate, getInstitutionDetails } from "../redux/apiCalls";

const Container = styled.div`
  padding: 0 20px;
`;

const TemplateLibrary = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  // Redux State
  const { libraryTemplates, isFetching } = useSelector((state) => state[process.env.REACT_APP_TEMPLATELIBRARY_DATA_KEY]);
  // We need institution ID to refresh data after import
  // Adjust the key selector based on your store setup if needed
  const { brandDetails } = useSelector((state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY]); 

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    getTemplateLibrary(dispatch);
  }, [dispatch]);

  const handleImportClick = (template) => {
    setSelectedTemplate(template);
    form.resetFields();

    // Pre-fill default values if variables exist
    const initialValues = {};
    if (template.variables) {
        template.variables.forEach(v => {
            if (v.defaultValue) initialValues[v.key] = v.defaultValue;
        });
    }
    form.setFieldsValue(initialValues);
    setIsModalOpen(true);
  };

  const handleImportSubmit = async (values) => {
    setImporting(true);
    const res = await importTemplate({
        baseTemplateId: selectedTemplate._id,
        variableValues: values
    });
    setImporting(false);

    if (res.status === 200) {
        message.success("Template Imported Successfully!");
        setIsModalOpen(false);
        // Refresh Institution Data to show new template in the main list
        getInstitutionDetails(dispatch);
    } else {
        message.error(res.message);
    }
  };

  const columns = [
    {
      title: "Template Name",
      dataIndex: "name",
      key: "name",
      render: (text) => <b>{text}</b>
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type) => <Tag color="geekblue">{type}</Tag>,
    },
    {
      title: "Size",
      dataIndex: "pageSize",
      key: "pageSize",
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button
            type="primary"
            ghost
            size="small"
            icon={<CloudDownloadOutlined />}
            onClick={() => handleImportClick(record)}
        >
            Import
        </Button>
      ),
    },
  ];

  return (
    <Container>
      <div style={{ marginBottom: 16, background: '#f9f9f9', padding: 15, borderRadius: 8 }}>
        <h4 style={{ margin: 0 }}><AppstoreAddOutlined /> Global Template Library</h4>
        <p style={{ margin: 0, color: '#666', fontSize: 12 }}>Browse and import pre-designed templates from the master catalog.</p>
      </div>

      <Table
        columns={columns}
        dataSource={libraryTemplates}
        rowKey="_id"
        loading={isFetching}
        pagination={{ pageSize: 5 }}
        size="small"
        locale={{ emptyText: <Empty description="No global templates available" /> }}
      />

      <Modal
        title={`Import: ${selectedTemplate?.name}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={importing}
        okText="Import Template"
        destroyOnClose
      >
        <p style={{ marginBottom: 20 }}>
            This template requires some values to be configured before importing. 
            These values will replace placeholders like <code>{`{{PHONE}}`}</code> in the design.
        </p>
        
        <Form form={form} layout="vertical" onFinish={handleImportSubmit}>
            {selectedTemplate?.variables?.length > 0 ? (
                selectedTemplate.variables.map(v => (
                    <Form.Item
                        key={v.key}
                        name={v.key}
                        label={v.label}
                        rules={[{ required: true, message: 'This variable is required' }]}
                        tooltip={`Replaces {{${v.key}}}`}
                    >
                        <Input placeholder={v.defaultValue || ""} />
                    </Form.Item>
                ))
            ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#888', background: '#f5f5f5', borderRadius: 4 }}>
                    No variables required. Click Import to proceed.
                </div>
            )}
        </Form>
      </Modal>
    </Container>
  );
};

export default TemplateLibrary;