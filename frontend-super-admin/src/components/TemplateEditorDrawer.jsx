import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Form, Input, Select, Button, InputNumber, Row, Col, Space, Drawer, message } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { createTemplate, updateTemplate, getTemplateById } from "../redux/apiCalls"; // Correct Import

const SectionTitle = styled.h3`
  margin-top: 20px;
  margin-bottom: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
  font-size: 16px;
`;

const CodeEditor = styled.textarea`
  width: 100%;
  height: 200px;
  font-family: 'Courier New', Courier, monospace;
  padding: 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background-color: #1e1e1e;
  color: #d4d4d4;
  resize: vertical;
`;

const TemplateEditorDrawer = ({ open, onClose, templateId, onSuccess }) => {
  const isEdit = !!templateId;
  const [form] = Form.useForm();
  const dispatch = useDispatch(); // Need dispatch for apiCalls
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  
  // Use Redux state if you want, or just use the return value from apiCall
  // const { currentTemplate } = useSelector((state) => state.template); 

  // Fetch Data when Drawer opens in Edit mode
  useEffect(() => {
    if (open) {
      form.resetFields(); // Clear previous data
      
      if (isEdit) {
        fetchTemplate();
      } else {
        // Set Defaults for New Template
        form.setFieldsValue({
          pageSize: "A4", 
          orientation: "portrait",
          margins_top: 10, margins_bottom: 10, margins_left: 10, margins_right: 10,
          showLogo: true, showInstitutionDetails: true, showQrCode: true,
          showTax: true, showDiscount: true,
          type: "BILL"
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateId]);

  const fetchTemplate = async () => {
    setFetching(true);
    // Use the API call from Redux folder
    const data = await getTemplateById(dispatch, templateId);
    setFetching(false);

    if (data) {
      // Flatten structure for Form
      form.setFieldsValue({
        ...data,
        ...data.content, // Spread content to top level for form
        
        // Map nested bill columns if they exist
        showTax: data.content?.billColumns?.showTax,
        showDiscount: data.content?.billColumns?.showDiscount,
        
        // Map margins
        margins_top: data.margins?.top,
        margins_bottom: data.margins?.bottom,
        margins_left: data.margins?.left,
        margins_right: data.margins?.right,
      });
    } else {
      // Handle error (apiCalls usually handles global error dispatch)
      onClose();
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    
    // Reconstruct Payload structure matching Mongoose Schema
    const payload = {
      name: values.name,
      description: values.description,
      category: values.category,
      type: values.type,
      pageSize: values.pageSize,
      orientation: values.orientation,
      margins: {
        top: values.margins_top,
        bottom: values.margins_bottom,
        left: values.margins_left,
        right: values.margins_right
      },
      content: {
        headerHtml: values.headerHtml,
        footerHtml: values.footerHtml,
        showLogo: values.showLogo,
        showInstitutionDetails: values.showInstitutionDetails,
        showQrCode: values.showQrCode,
        billColumns: {
           showTax: values.showTax,
           showDiscount: values.showDiscount
        },
      },
      variables: values.variables,
      previewImage: values.previewImage
    };

    let res;
    if (isEdit) {
      res = await updateTemplate(dispatch, templateId, payload);
    } else {
      res = await createTemplate(dispatch, payload);
    }
    
    setLoading(false);

    if (res.status === 200 || res.status === 201) {
        message.success(isEdit ? "Template updated" : "Template created");
        onSuccess(); // Trigger refresh in parent
        onClose();   // Close drawer
    } else {
        message.error(res.message || "Operation failed");
    }
  };

  return (
    <Drawer
      title={isEdit ? "Edit Template" : "Create New Template"}
      width={800}
      onClose={onClose}
      open={open}
      bodyStyle={{ paddingBottom: 80 }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={form.submit} type="primary" loading={loading} disabled={fetching}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </Space>
      }
    >
      <Form 
        layout="vertical" 
        form={form} 
        onFinish={onFinish} 
        disabled={fetching}
      >
        {/* 1. BASIC INFO */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Standard OPD Bill" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="category" label="Category" rules={[{ required: true }]}>
               <Input placeholder="e.g. Cardiology" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="BILL">Bill</Select.Option>
                <Select.Option value="LAB_REPORT">Lab Report</Select.Option>
                <Select.Option value="PRESCRIPTION">Prescription</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="Description">
           <Input.TextArea rows={2} placeholder="Internal note about this template..." />
        </Form.Item>

        {/* 2. LAYOUT CONFIG */}
        <SectionTitle>Layout Configuration</SectionTitle>
        <Row gutter={16}>
           <Col span={6}>
               <Form.Item name="pageSize" label="Page Size">
                   <Select>
                       <Select.Option value="A4">A4</Select.Option>
                       <Select.Option value="A5">A5</Select.Option>
                       <Select.Option value="Letter">Letter</Select.Option>
                       <Select.Option value="Thermal80mm">Thermal 80mm</Select.Option>
                   </Select>
               </Form.Item>
           </Col>
           <Col span={6}>
               <Form.Item name="orientation" label="Orientation">
                   <Select>
                       <Select.Option value="portrait">Portrait</Select.Option>
                       <Select.Option value="landscape">Landscape</Select.Option>
                   </Select>
               </Form.Item>
           </Col>
           <Col span={12}>
               <Form.Item label="Margins (mm)">
                   <Space>
                       <Form.Item name="margins_top" noStyle><InputNumber placeholder="Top" style={{width: 70}} /></Form.Item>
                       <Form.Item name="margins_bottom" noStyle><InputNumber placeholder="Bot" style={{width: 70}} /></Form.Item>
                       <Form.Item name="margins_left" noStyle><InputNumber placeholder="Left" style={{width: 70}} /></Form.Item>
                       <Form.Item name="margins_right" noStyle><InputNumber placeholder="Right" style={{width: 70}} /></Form.Item>
                   </Space>
               </Form.Item>
           </Col>
        </Row>

        {/* 3. HTML CONTENT */}
        <SectionTitle>HTML Content</SectionTitle>
        <p style={{color: '#888', fontSize: '12px'}}>Use Handlebars syntax for variables: <code>{`{{PatientName}}`}</code>, <code>{`{{TotalAmount}}`}</code></p>
        
        <Row gutter={16}>
            <Col span={24}>
                <Form.Item name="headerHtml" label="Header HTML">
                    <CodeEditor placeholder="<div class='header'>...</div>" />
                </Form.Item>
            </Col>
            <Col span={24}>
                <Form.Item name="footerHtml" label="Footer HTML">
                    <CodeEditor placeholder="<div class='footer'>...</div>" />
                </Form.Item>
            </Col>
        </Row>

        {/* 4. VARIABLES (Dynamic Inputs) */}
        <SectionTitle>Variables Definition</SectionTitle>
        <Form.List name="variables">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                <Form.Item
                  {...restField}
                  name={[name, 'key']}
                  rules={[{ required: true, message: 'Missing Key' }]}
                >
                  <Input placeholder="Key (e.g. PHONE)" />
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[name, 'label']}
                  rules={[{ required: true, message: 'Missing Label' }]}
                >
                  <Input placeholder="Label (e.g. Phone Number)" />
                </Form.Item>
                <Form.Item
                  {...restField}
                  name={[name, 'defaultValue']}
                >
                  <Input placeholder="Default Value" />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(name)} />
              </Space>
            ))}
            <Form.Item>
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Add Variable
              </Button>
            </Form.Item>
          </>
        )}
        </Form.List>

      </Form>
    </Drawer>
  );
};

export default TemplateEditorDrawer;