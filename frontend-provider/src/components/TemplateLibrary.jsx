import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Table, Button, Modal, Tag, Space, Form, Input, Card, Row, Col } from "antd";
import { CloudDownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { userRequest } from "../requestMethods";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { getInstitution } from "../redux/apiCalls";

const Container = styled.div`
  padding: 20px;
`;

const TemplateLibrary = () => {
  const [libraryTemplates, setLibraryTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  // Import Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variableForm] = Form.useForm();

  const token = useSelector((state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]?.token);
  const { brandDetails } = useSelector((state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY]);
  const dispatch = useDispatch();

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const res = await userRequest(token).get("/tenant-templates/library");
      setLibraryTemplates(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load library");
    }
    setLoading(false);
  };

  const handleImportClick = (template) => {
    setSelectedTemplate(template);
    // Pre-fill form if needed, or clear it
    variableForm.resetFields();

    // Set default values from template definition
    const initialValues = {};
    if (template.variables) {
        template.variables.forEach(v => {
            if (v.defaultValue) initialValues[v.key] = v.defaultValue;
        });
    }
    variableForm.setFieldsValue(initialValues);
    setIsModalOpen(true);
  };

  const handleImportSubmit = async (values) => {
    try {
        await userRequest(token).post("/tenant-templates/import", {
            baseTemplateId: selectedTemplate._id,
            variableValues: values
        });
        toast.success("Template Imported Successfully!");
        setIsModalOpen(false);

        // Refresh local data so "My Templates" tab updates
        // We need to re-fetch the institution details
        getInstitution(dispatch, brandDetails.institutionId);

    } catch (err) {
        console.error(err);
        toast.error("Failed to import template");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
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
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button
            type="primary"
            ghost
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
      <h3>Global Template Library</h3>
      <p>Browse and import templates from the master catalog.</p>

      <Table
        columns={columns}
        dataSource={libraryTemplates}
        rowKey="_id"
        loading={loading}
      />

      <Modal
        title={`Import: ${selectedTemplate?.name}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => variableForm.submit()}
        okText="Import Template"
      >
        <p>This template requires some values to be set before importing.</p>
        <Form form={variableForm} layout="vertical" onFinish={handleImportSubmit}>
            {selectedTemplate?.variables?.length > 0 ? (
                selectedTemplate.variables.map(v => (
                    <Form.Item
                        key={v.key}
                        name={v.key}
                        label={v.label}
                        rules={[{ required: true, message: 'Required' }]}
                    >
                        <Input placeholder={v.defaultValue || ""} />
                    </Form.Item>
                ))
            ) : (
                <p style={{ color: 'gray', fontStyle: 'italic' }}>No additional variables required.</p>
            )}
        </Form>
      </Modal>
    </Container>
  );
};

export default TemplateLibrary;
